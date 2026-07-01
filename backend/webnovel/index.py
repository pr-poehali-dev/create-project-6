import json
import re
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
}

UA = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) '
                  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://m.webnovel.com/',
}


def _get(url: str, timeout: int = 15) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', errors='ignore')


def extract_book_id(book_url: str) -> str:
    m = re.search(r'_(\d{5,})', book_url)
    if m:
        return m.group(1)
    m = re.search(r'/book/[^/]*?(\d{10,})', book_url)
    if m:
        return m.group(1)
    m = re.search(r'(\d{15,})', book_url)
    return m.group(1) if m else ''


def _parse_catalog_from_api(book_id: str):
    endpoints = [
        f'https://www.webnovel.com/go/pcm/chapter/getChapterList?bookId={book_id}&_csrfToken=',
        f'https://www.webnovel.com/go/pcm/chapter/getContentList?_csrfToken=&bookId={book_id}',
        f'https://m.webnovel.com/go/pcm/chapter/getChapterList?bookId={book_id}&_csrfToken=',
    ]
    for api in endpoints:
        try:
            raw = _get(api)
            data = json.loads(raw)
        except Exception:
            continue
        d = data.get('data', {})
        book_info = d.get('bookInfo', {}) or d.get('bookItem', {})
        vols = d.get('volumeItems') or d.get('chapterList') or []
        chapters = []
        for vol in vols:
            items = vol.get('chapterItems') or vol.get('chapters') or []
            for ch in items:
                is_vip = ch.get('isVip', 0)
                cid = ch.get('chapterId') or ch.get('id') or ''
                name = ch.get('chapterName') or ch.get('name') or f'Chapter {len(chapters)+1}'
                chapters.append({
                    'n': ch.get('chapterIndex') or ch.get('index') or len(chapters) + 1,
                    'id': str(cid),
                    'title': name,
                    'free': is_vip == 0,
                    'vip': bool(is_vip),
                })
        if chapters:
            return {
                'title': book_info.get('bookName', 'Webnovel Book'),
                'author': book_info.get('authorName', ''),
                'total': len(chapters),
                'chapters': chapters,
            }
    return None


def _parse_catalog_from_html(book_id: str):
    urls = [
        f'https://www.webnovel.com/book/{book_id}/catalog',
        f'https://m.webnovel.com/book/{book_id}/catalog',
    ]
    html = ''
    for u in urls:
        try:
            html = _get(u, timeout=20)
            if html:
                break
        except Exception:
            continue
    if not html:
        return None

    title_m = re.search(r'<title>([^<]+)</title>', html)
    title = title_m.group(1).strip() if title_m else 'Webnovel Book'
    title = re.sub(r'\s*-\s*WebNovel.*$', '', title).strip()

    chapters = []
    pattern = re.compile(
        r'/book/[^"\']*?/([0-9]{15,})[^"\']*?["\'][^>]*?>(?:<[^>]+>\s*)*([^<]{2,150})',
        re.I)
    seen = set()
    for m in pattern.finditer(html):
        cid = m.group(1)
        name = re.sub(r'\s+', ' ', m.group(2)).strip()
        if cid in seen or not name:
            continue
        seen.add(cid)
        window = html[max(0, m.start() - 200):m.end() + 200].lower()
        is_locked = 'lock' in window
        chapters.append({
            'n': len(chapters) + 1,
            'id': cid,
            'title': name,
            'free': not is_locked,
            'vip': is_locked,
        })

    if not chapters:
        return None
    return {'title': title, 'author': '', 'total': len(chapters), 'chapters': chapters}


def get_catalog(book_id: str) -> dict:
    result = _parse_catalog_from_api(book_id)
    if not result:
        result = _parse_catalog_from_html(book_id)
    if not result:
        raise RuntimeError('Не удалось получить список глав. Webnovel мог изменить структуру или блокирует запрос.')
    return result


def get_chapter_content(book_id: str, chapter_id: str) -> dict:
    endpoints = [
        f'https://www.webnovel.com/go/pcm/chapter/getContent?_csrfToken=&bookId={book_id}&chapterId={chapter_id}',
        f'https://m.webnovel.com/go/pcm/chapter/getContent?_csrfToken=&bookId={book_id}&chapterId={chapter_id}',
    ]
    for api in endpoints:
        try:
            raw = _get(api)
            data = json.loads(raw)
        except Exception:
            continue
        ci = data.get('data', {}).get('chapterInfo', {})
        if not ci:
            continue
        name = ci.get('chapterName', '')
        contents = ci.get('contents', [])
        if contents:
            paragraphs = [c.get('content', '') for c in contents]
            text = '\n\n'.join(p for p in paragraphs if p)
        else:
            text = ci.get('content', '')
        text = re.sub(r'<[^>]+>', '', text)
        return {'id': str(chapter_id), 'title': name, 'content': text.strip()}
    return {'id': str(chapter_id), 'title': '', 'content': '',
            'error': 'Глава недоступна (возможно, платная или заблокирована)'}


def handler(event, context):
    """Парсинг книг с Webnovel: список глав и содержимое глав по ссылке."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}
    action = body.get('action', 'catalog')

    try:
        if action == 'catalog':
            book_url = body.get('url', '')
            book_id = extract_book_id(book_url)
            if not book_id:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Не удалось определить ID книги из ссылки'})}
            result = get_catalog(book_id)
            result['bookId'] = book_id
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps(result, ensure_ascii=False)}

        if action == 'chapter':
            book_id = body.get('bookId', '')
            chapter_id = body.get('chapterId', '')
            content = get_chapter_content(book_id, chapter_id)
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps(content, ensure_ascii=False)}

        if action == 'chapters':
            book_id = body.get('bookId', '')
            ids = body.get('chapterIds', [])[:50]

            def fetch(cid):
                try:
                    return get_chapter_content(book_id, cid)
                except Exception as e:
                    return {'id': str(cid), 'title': '', 'content': '', 'error': str(e)}

            with ThreadPoolExecutor(max_workers=8) as ex:
                results = list(ex.map(fetch, ids))
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'chapters': results}, ensure_ascii=False)}

        return {'statusCode': 400, 'headers': CORS,
                'body': json.dumps({'error': 'Неизвестное действие'})}

    except urllib.error.HTTPError as e:
        return {'statusCode': 502, 'headers': CORS,
                'body': json.dumps({'error': f'Webnovel вернул ошибку {e.code}'})}
    except Exception as e:
        return {'statusCode': 500, 'headers': CORS,
                'body': json.dumps({'error': str(e)})}