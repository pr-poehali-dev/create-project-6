import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  WEBNOVEL_API,
  exportBook,
  type Chapter,
  type Catalog,
  type ChapterContent,
} from '@/lib/bookExport';

const HERO_IMG =
  'https://cdn.poehali.dev/projects/08d64609-ca87-4c30-b7b4-f6613e60a51c/files/ccbbb65c-1c8a-48ba-bc4e-b6c3a262b724.jpg';

type Section = 'home' | 'download' | 'history';

const FORMATS = [
  { id: 'txt', label: 'TXT', icon: 'FileText', desc: 'Простой текст' },
  { id: 'epub', label: 'EPUB', icon: 'BookOpen', desc: 'Для читалок' },
  { id: 'fb2', label: 'FB2', icon: 'BookMarked', desc: 'FictionBook' },
];

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: 'home', label: 'Главная', icon: 'Home' },
  { id: 'download', label: 'Загрузка', icon: 'Download' },
  { id: 'history', label: 'История', icon: 'Clock' },
];

const FEATURES = [
  { icon: 'Zap', title: 'Молниеносно', text: 'Параллельное сканирование и скачивание глав на максимальной скорости' },
  { icon: 'FileType2', title: '3 формата', text: 'Автоконвертация в TXT, EPUB и FB2 для любой читалки' },
  { icon: 'Languages', title: 'Перевод на русский', text: 'Просмотр перевода глав с индикатором прогресса' },
  { icon: 'Eye', title: 'Превью главы', text: 'Читайте содержимое перед скачиванием прямо на сайте' },
  { icon: 'ListChecks', title: 'Выбор глав', text: 'Скачивайте всю книгу или только нужный диапазон' },
  { icon: 'History', title: 'История загрузок', text: 'Аккаунт по почте хранит все ваши скачанные книги' },
];

export default function Index() {
  const { toast } = useToast();
  const [section, setSection] = useState<Section>('home');
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState('epub');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [preview, setPreview] = useState<Chapter | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const chapters = catalog?.chapters ?? [];

  const goDownload = () => setSection('download');

  const scan = async () => {
    if (!url.trim()) {
      toast({ title: 'Вставьте ссылку', description: 'Нужна ссылка на книгу с webnovel.com' });
      return;
    }
    setScanning(true);
    setCatalog(null);
    setSelected([]);
    try {
      const res = await fetch(WEBNOVEL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'catalog', url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Ошибка сканирования');
      setCatalog(data);
      setSelected(data.chapters.filter((c: Chapter) => c.free).map((c: Chapter) => c.id));
      toast({ title: 'Главы найдены', description: `${data.total} глав в «${data.title}»` });
    } catch (e) {
      toast({
        title: 'Не удалось найти главы',
        description: e instanceof Error ? e.message : 'Попробуйте другую ссылку',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const openPreview = async (c: Chapter) => {
    setPreview(c);
    setPreviewText('');
    setPreviewLoading(true);
    try {
      const res = await fetch(WEBNOVEL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chapter', bookId: catalog!.bookId, chapterId: c.id }),
      });
      const data: ChapterContent = await res.json();
      setPreviewText(data.content || data.error || 'Содержимое недоступно');
    } catch {
      setPreviewText('Не удалось загрузить главу');
    } finally {
      setPreviewLoading(false);
    }
  };

  const runDownload = async () => {
    if (!catalog) return;
    setConfirmOpen(false);
    setDownloading(true);
    setProgress(0);
    setDoneCount(0);

    const ids = selected;
    const results: ChapterContent[] = [];
    const BATCH = 10;
    let done = 0;

    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const slice = ids.slice(i, i + BATCH);
        const res = await fetch(WEBNOVEL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'chapters', bookId: catalog.bookId, chapterIds: slice }),
        });
        const data = await res.json();
        (data.chapters || []).forEach((ch: ChapterContent) => results.push(ch));
        done += slice.length;
        setDoneCount(done);
        setProgress(Math.round((done / ids.length) * 100));
      }

      const ordered = ids
        .map((id) => results.find((r) => r.id === id))
        .filter((r): r is ChapterContent => !!r && !!r.content);

      if (ordered.length === 0) {
        toast({ title: 'Главы недоступны', description: 'Не удалось получить содержимое', variant: 'destructive' });
        return;
      }

      exportBook(format, catalog.title, catalog.author, ordered);
      toast({ title: 'Готово!', description: `Скачано ${ordered.length} глав в ${format.toUpperCase()}` });
    } catch (e) {
      toast({
        title: 'Ошибка скачивания',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 glass">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary glow-shadow">
              <Icon name="BookDown" size={20} className="text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-wide">NOVEL<span className="text-gradient">GRAB</span></span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setSection(n.id)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  section === n.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={n.icon} size={16} />
                {n.label}
              </button>
            ))}
          </nav>
          <Button variant="outline" className="rounded-full border-white/15">
            <Icon name="User" size={16} className="mr-1" /> Войти
          </Button>
        </div>
      </header>

      {/* HOME */}
      {section === 'home' && (
        <main>
          <section className="container grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
            <div className="animate-fade-in">
              <Badge className="mb-5 rounded-full border-accent/40 bg-accent/10 text-accent" variant="outline">
                <Icon name="Sparkles" size={13} className="mr-1" /> Скачивай книги с Webnovel
              </Badge>
              <h1 className="font-display text-5xl font-bold leading-[1.05] md:text-7xl">
                Твоя библиотека —<br />
                <span className="text-gradient">в один клик</span>
              </h1>
              <p className="mt-6 max-w-md text-lg text-muted-foreground">
                Вставь ссылку на книгу — получи список глав, выбери нужные и скачай в TXT, EPUB или FB2. С переводом на русский.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={goDownload} className="rounded-full glow-shadow">
                  <Icon name="Download" size={18} className="mr-2" /> Начать загрузку
                </Button>
                <Button size="lg" variant="outline" onClick={() => setSection('history')} className="rounded-full border-white/15">
                  <Icon name="Clock" size={18} className="mr-2" /> История
                </Button>
              </div>
            </div>
            <div className="relative animate-float">
              <div className="absolute inset-0 -z-10 rounded-[2rem] bg-primary/30 blur-3xl" />
              <img src={HERO_IMG} alt="NovelGrab" className="rounded-[2rem] border border-white/10 shadow-2xl" />
            </div>
          </section>

          <section className="container pb-24">
            <h2 className="mb-10 text-center font-display text-4xl font-bold">Возможности загрузчика</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <div
                  key={f.title}
                  className="glass animate-fade-in rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent">
                    <Icon name={f.icon} size={22} className="text-white" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* DOWNLOAD */}
      {section === 'download' && (
        <main className="container max-w-3xl py-12">
          <h1 className="font-display text-4xl font-bold">Загрузка книги</h1>
          <p className="mt-2 text-muted-foreground">Вставь ссылку на книгу с webnovel.com</p>

          <div className="glass mt-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && scan()}
              placeholder="https://m.webnovel.com/book/..."
              className="h-12 border-white/10 bg-background/50 text-base"
            />
            <Button onClick={scan} disabled={scanning} size="lg" className="h-12 rounded-xl glow-shadow">
              {scanning ? (
                <><Icon name="Loader2" size={18} className="mr-2 animate-spin" /> Сканирую…</>
              ) : (
                <><Icon name="Search" size={18} className="mr-2" /> Найти главы</>
              )}
            </Button>
          </div>

          {catalog && (
            <div className="mt-8 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">{catalog.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {catalog.total} глав · выбрано {selected.length}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-full border-white/15"
                    onClick={() => setSelected(chapters.filter((c) => c.free).map((c) => c.id))}>
                    Все бесплатные
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-white/15"
                    onClick={() => setSelected([])}>
                    Снять всё
                  </Button>
                </div>
              </div>

              {/* Format picker */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`glass flex flex-col items-center gap-1 rounded-2xl p-4 transition-all ${
                      format === f.id ? 'border-primary bg-primary/10' : 'hover:border-white/25'
                    }`}
                  >
                    <Icon name={f.icon} size={22} className={format === f.id ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="font-display font-semibold">{f.label}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </button>
                ))}
              </div>

              {/* Chapter list */}
              <div className="mt-5 max-h-[420px] space-y-2 overflow-auto pr-1">
                {chapters.map((c) => (
                  <div
                    key={c.id}
                    className={`glass flex items-center gap-3 rounded-xl p-3 transition-all ${
                      !c.free ? 'opacity-50' : selected.includes(c.id) ? 'border-primary/50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={selected.includes(c.id)}
                      disabled={!c.free}
                      onCheckedChange={() => toggle(c.id)}
                    />
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">
                      {c.n}
                    </span>
                    <span className="flex-1 truncate text-sm">{c.title}</span>
                    {c.free ? (
                      <Badge variant="outline" className="border-accent/40 text-accent">free</Badge>
                    ) : (
                      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
                        <Icon name="Lock" size={11} className="mr-1" /> платно
                      </Badge>
                    )}
                    <button onClick={() => openPreview(c)} disabled={!c.free}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30">
                      <Icon name="Eye" size={16} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Download bar */}
              <div className="glass sticky bottom-4 mt-6 rounded-2xl p-4">
                {downloading ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">Скачивание…</span>
                      <span className="text-muted-foreground">{doneCount} / {selected.length} глав</span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                ) : (
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={selected.length === 0}
                    size="lg"
                    className="w-full rounded-xl glow-shadow"
                  >
                    <Icon name="Download" size={18} className="mr-2" />
                    Скачать {selected.length} глав в {format.toUpperCase()}
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* HISTORY */}
      {section === 'history' && (
        <main className="container max-w-3xl py-12">
          <h1 className="font-display text-4xl font-bold">История загрузок</h1>
          <p className="mt-2 text-muted-foreground">Войдите в аккаунт, чтобы хранить и перескачивать книги</p>
          <div className="glass mt-8 flex flex-col items-center gap-4 rounded-2xl p-12 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary">
              <Icon name="Clock" size={30} className="text-muted-foreground" />
            </div>
            <p className="max-w-xs text-muted-foreground">
              Здесь появятся скачанные книги. Создайте аккаунт по почте — без подтверждения.
            </p>
            <Button className="rounded-full glow-shadow">
              <Icon name="UserPlus" size={16} className="mr-2" /> Создать аккаунт
            </Button>
          </div>
        </main>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setPreview(null)}>
          <div className="glass flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="font-display text-2xl font-bold">{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="rounded-lg p-1 hover:bg-secondary">
                <Icon name="X" size={20} />
              </button>
            </div>
            <div className="min-h-[120px] flex-1 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {previewLoading ? (
                <div className="flex items-center gap-2"><Icon name="Loader2" size={16} className="animate-spin" /> Загрузка…</div>
              ) : (
                previewText
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl border-white/15" disabled>
                <Icon name="Languages" size={16} className="mr-2" /> Перевод RU
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => setPreview(null)}>
                <Icon name="Check" size={16} className="mr-2" /> Готово
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm download modal */}
      {confirmOpen && catalog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setConfirmOpen(false)}>
          <div className="glass w-full max-w-md rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15">
              <Icon name="Download" size={26} className="text-primary" />
            </div>
            <h3 className="font-display text-2xl font-bold">Подтвердите скачивание</h3>
            <p className="mt-2 text-muted-foreground">
              Скачать <b className="text-foreground">{selected.length}</b> глав книги «{catalog.title}»
              в формате <b className="text-foreground">{format.toUpperCase()}</b>?
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl border-white/15" onClick={() => setConfirmOpen(false)}>
                Отмена
              </Button>
              <Button className="flex-1 rounded-xl glow-shadow" onClick={runDownload}>
                <Icon name="Check" size={16} className="mr-2" /> Скачать
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom mobile nav */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around py-2 md:hidden">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setSection(n.id)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${
              section === n.id ? 'text-primary' : 'text-muted-foreground'
            }`}>
            <Icon name={n.icon} size={20} />
            {n.label}
          </button>
        ))}
      </nav>

      <footer className="container py-10 text-center text-sm text-muted-foreground">
        NovelGrab · загрузчик книг с Webnovel · только бесплатные главы
      </footer>
    </div>
  );
}
