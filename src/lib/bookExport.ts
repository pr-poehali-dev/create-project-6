export const WEBNOVEL_API = 'https://functions.poehali.dev/5d352f33-c79d-49bb-aae8-f3a6f6733e1e';

export interface Chapter {
  n: number;
  id: string;
  title: string;
  free: boolean;
  vip?: boolean;
}

export interface Catalog {
  bookId: string;
  title: string;
  author: string;
  total: number;
  chapters: Chapter[];
}

export interface ChapterContent {
  id: string;
  title: string;
  content: string;
  error?: string;
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'book';

export function exportTxt(title: string, chapters: ChapterContent[]) {
  const parts = chapters.map((c) => `${c.title}\n\n${c.content}`);
  const text = `${title}\n\n\n${parts.join('\n\n\n' + '='.repeat(40) + '\n\n\n')}`;
  download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeName(title)}.txt`);
}

export function exportFb2(title: string, author: string, chapters: ChapterContent[]) {
  const body = chapters
    .map(
      (c) =>
        `<section><title><p>${esc(c.title)}</p></title>${c.content
          .split(/\n{2,}/)
          .map((p) => `<p>${esc(p.trim())}</p>`)
          .join('')}</section>`
    )
    .join('');
  const fb2 =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">` +
    `<description><title-info><book-title>${esc(title)}</book-title>` +
    `<author><nickname>${esc(author || 'Webnovel')}</nickname></author>` +
    `<lang>en</lang></title-info></description>` +
    `<body><title><p>${esc(title)}</p></title>${body}</body></FictionBook>`;
  download(new Blob([fb2], { type: 'application/x-fictionbook+xml;charset=utf-8' }), `${safeName(title)}.fb2`);
}

// Minimal uncompressed ZIP writer for EPUB (store method, no compression).
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function strBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function buildZip(files: { name: string; data: Uint8Array }[]): Blob {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);

  for (const f of files) {
    const nameBytes = strBytes(f.name);
    const crc = crc32(f.data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBytes.length), u16(0), nameBytes, f.data,
    ]);
    chunks.push(local);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(f.data.length), u32(f.data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  }
  const centralData = concat(central);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralData.length), u32(offset), u16(0),
  ]);
  return new Blob([concat(chunks), centralData, end], { type: 'application/epub+zip' });
}

function concat(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export function exportEpub(title: string, author: string, chapters: ChapterContent[]) {
  const uid = 'urn:uuid:' + Math.random().toString(36).slice(2);
  const files: { name: string; data: Uint8Array }[] = [];

  files.push({ name: 'mimetype', data: strBytes('application/epub+zip') });
  files.push({
    name: 'META-INF/container.xml',
    data: strBytes(
      `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`
    ),
  });

  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const navPoints: string[] = [];

  chapters.forEach((c, i) => {
    const id = `chap${i + 1}`;
    const fname = `${id}.xhtml`;
    const paras = c.content
      .split(/\n{2,}/)
      .map((p) => `<p>${esc(p.trim())}</p>`)
      .join('');
    files.push({
      name: `OEBPS/${fname}`,
      data: strBytes(
        `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${esc(
          c.title
        )}</title></head><body><h2>${esc(c.title)}</h2>${paras}</body></html>`
      ),
    });
    manifestItems.push(`<item id="${id}" href="${fname}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    navPoints.push(
      `<navPoint id="${id}" playOrder="${i + 1}"><navLabel><text>${esc(
        c.title
      )}</text></navLabel><content src="${fname}"/></navPoint>`
    );
  });

  files.push({
    name: 'OEBPS/toc.ncx',
    data: strBytes(
      `<?xml version="1.0" encoding="utf-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head><docTitle><text>${esc(
        title
      )}</text></docTitle><navMap>${navPoints.join('')}</navMap></ncx>`
    ),
  });

  files.push({
    name: 'OEBPS/content.opf',
    data: strBytes(
      `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(
        title
      )}</dc:title><dc:creator>${esc(author || 'Webnovel')}</dc:creator><dc:language>en</dc:language><dc:identifier id="bookid">${uid}</dc:identifier></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>${manifestItems.join(
        ''
      )}</manifest><spine toc="ncx">${spineItems.join('')}</spine></package>`
    ),
  });

  download(buildZip(files), `${safeName(title)}.epub`);
}

export function exportBook(
  format: string,
  title: string,
  author: string,
  chapters: ChapterContent[]
) {
  if (format === 'txt') return exportTxt(title, chapters);
  if (format === 'fb2') return exportFb2(title, author, chapters);
  return exportEpub(title, author, chapters);
}