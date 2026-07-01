import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const HERO_IMG =
  'https://cdn.poehali.dev/projects/08d64609-ca87-4c30-b7b4-f6613e60a51c/files/ccbbb65c-1c8a-48ba-bc4e-b6c3a262b724.jpg';

type Section = 'home' | 'download' | 'history';

const DEMO_CHAPTERS = [
  { n: 1, title: "UOS Chapter 001: Konoha's Second Sun", date: '1 месяц назад', free: true },
  { n: 2, title: 'UOS Chapter 002: Night of the Nine-Tails', date: '1 месяц назад', free: true },
  { n: 3, title: "UOS Chapter 003: A Mere Tailed Beast Bomb Can't Compare", date: '1 месяц назад', free: true },
  { n: 4, title: "UOS Chapter 004: Good People Don't Live Long", date: '1 месяц назад', free: true },
  { n: 5, title: 'UOS Chapter 005: Beating Up Shimura Danzo', date: '1 месяц назад', free: true },
  { n: 6, title: 'UOS Chapter 006: The Uchiha Legacy', date: '1 месяц назад', free: false },
];

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
  const [section, setSection] = useState<Section>('home');
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [chapters, setChapters] = useState<typeof DEMO_CHAPTERS>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [format, setFormat] = useState('epub');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<(typeof DEMO_CHAPTERS)[0] | null>(null);

  const goDownload = () => setSection('download');

  const scan = () => {
    setScanning(true);
    setChapters([]);
    setTimeout(() => {
      setChapters(DEMO_CHAPTERS);
      setSelected(DEMO_CHAPTERS.filter((c) => c.free).map((c) => c.n));
      setScanning(false);
    }, 1400);
  };

  const toggle = (n: number) =>
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));

  const startDownload = () => {
    setDownloading(true);
    setProgress(0);
    const total = selected.length;
    let done = 0;
    const timer = setInterval(() => {
      done += 1;
      setProgress(Math.round((done / total) * 100));
      if (done >= total) {
        clearInterval(timer);
        setTimeout(() => setDownloading(false), 600);
      }
    }, 500);
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
          <p className="mt-2 text-muted-foreground">Вставь ссылку на книгу с m.webnovel.com</p>

          <div className="glass mt-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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

          {chapters.length > 0 && (
            <div className="mt-8 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold">120 глав обновлено</h2>
                  <p className="text-sm text-muted-foreground">
                    Выбрано {selected.length} · доступны бесплатные главы
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-full border-white/15"
                    onClick={() => setSelected(chapters.filter((c) => c.free).map((c) => c.n))}>
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
              <div className="mt-5 space-y-2">
                {chapters.map((c) => (
                  <div
                    key={c.n}
                    className={`glass flex items-center gap-3 rounded-xl p-3 transition-all ${
                      !c.free ? 'opacity-50' : selected.includes(c.n) ? 'border-primary/50' : ''
                    }`}
                  >
                    <Checkbox
                      checked={selected.includes(c.n)}
                      disabled={!c.free}
                      onCheckedChange={() => toggle(c.n)}
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
                    <button onClick={() => setPreview(c)} disabled={!c.free}
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
                      <span className="text-muted-foreground">
                        {Math.round((progress / 100) * selected.length)} / {selected.length} глав
                      </span>
                    </div>
                    <Progress value={progress} className="h-2.5" />
                  </div>
                ) : (
                  <Button
                    onClick={startDownload}
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
          <div className="glass max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="font-display text-2xl font-bold">{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="rounded-lg p-1 hover:bg-secondary">
                <Icon name="X" size={20} />
              </button>
            </div>
            <p className="text-muted-foreground">
              Здесь отобразится содержимое главы для предпросмотра перед скачиванием — оригинальный текст и, при желании,
              перевод на русский с индикатором прогресса.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl border-white/15">
                <Icon name="Languages" size={16} className="mr-2" /> Перевод RU
              </Button>
              <Button className="flex-1 rounded-xl" onClick={() => setPreview(null)}>
                <Icon name="Check" size={16} className="mr-2" /> Готово
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
