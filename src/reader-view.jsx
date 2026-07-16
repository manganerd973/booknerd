'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Bold as BoldIcon,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  ExternalLink,
  List,
  Lock,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Sun,
  Type,
  X,
} from 'lucide-react';
import CommentsSection from './comments-section.jsx';

const SETTINGS_KEY = 'booknerd-reader-settings-v2';
const BOOKMARKS_KEY = 'booknerd-reader-bookmarks-v2';

const DEFAULT_SETTINGS = {
  theme: 'paper',
  motion: 'slide',
  fontSize: 20,
  fontFamily: 'Georgia',
  lineHeight: 1.72,
  bold: false,
  align: 'left',
  brightness: 100,
};

const READING_MODE_OPTIONS = [
  { id: 'slide', name: 'Сдвиг', description: 'Страницы плавно двигаются в сторону' },
  { id: 'curl', name: 'Перелистывание', description: 'Эффект переворачивания бумажной страницы' },
  { id: 'fade', name: 'Быстрое затухание', description: 'Новая страница появляется без движения' },
  { id: 'scroll', name: 'Прокрутка', description: 'Непрерывный текст сверху вниз' },
];

const THEME_OPTIONS = [
  { id: 'original', name: 'Оригинал', sample: 'Aa' },
  { id: 'night', name: 'Тишина', sample: 'Aa' },
  { id: 'paper', name: 'Бумага', sample: 'Aa' },
  { id: 'bold', name: 'Контраст', sample: 'Aa' },
  { id: 'calm', name: 'Спокойствие', sample: 'Aa' },
  { id: 'focus', name: 'Фокус', sample: 'Aa' },
];

const FONT_OPTIONS = [
  { id: 'Georgia', name: 'Georgia' },
  { id: 'Times New Roman', name: 'Times New Roman' },
  { id: 'Palatino', name: 'Palatino' },
  { id: 'Charter', name: 'Charter' },
  { id: 'Arial', name: 'Arial' },
  { id: 'Verdana', name: 'Verdana' },
  { id: 'Trebuchet MS', name: 'Trebuchet' },
];

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function paragraphsFor(value) {
  const paragraphs = String(value || '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs : ['Текст этой главы готовится к публикации.'];
}

function ChapterFlow({ book, chapter, showDriveLink = false, measuring = false }) {
  const paragraphs = useMemo(() => paragraphsFor(chapter.body), [chapter.body]);

  return (
    <article className="reader-flow-chapter">
      <header className="reader-flow-intro">
        <span>{book.title}</span>
        <h1><small>Глава {chapter.chapterNumber}</small>{chapter.title}</h1>
        {showDriveLink && chapter.driveUrl ? measuring ? (
          <span className="reader-flow-drive">Файл главы <ExternalLink size={14} /></span>
        ) : (
          <a className="reader-flow-drive" href={chapter.driveUrl} target="_blank" rel="noreferrer">
            Файл главы <ExternalLink size={14} />
          </a>
        ) : null}
        <div className="reader-flow-rule"><i />✦<i /></div>
      </header>
      <div className="reader-flow-copy">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    </article>
  );
}

function ReaderSheet({ title, eyebrow, onClose, children, wide = false }) {
  return (
    <div className="reader-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`reader-sheet ${wide ? 'reader-sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>{eyebrow ? <small>{eyebrow}</small> : null}<h2>{title}</h2></div>
          <button type="button" onClick={onClose} aria-label="Закрыть"><X size={25} /></button>
        </header>
        <div className="reader-sheet-body">{children}</div>
      </aside>
    </div>
  );
}

function ReadingModeIcon({ mode, size = 22 }) {
  if (mode === 'curl') return <BookOpen size={size} />;
  if (mode === 'fade') return <Sun size={size} />;
  if (mode === 'scroll') return <AlignJustify size={size} />;
  return <ArrowRight size={size} />;
}

export default function ReaderView({ book, chapter, chapters = [], previous, next }) {
  const chapterList = useMemo(() => chapters.length ? chapters : [chapter], [chapters, chapter]);
  const chapterIndex = Math.max(0, chapterList.findIndex((item) => item.id === chapter.id));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [page, setPage] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [pageCounts, setPageCounts] = useState(() => chapterList.map(() => 1));
  const [measurementReady, setMeasurementReady] = useState(false);
  const [panel, setPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [toast, setToast] = useState('');
  const [orientationLocked, setOrientationLocked] = useState(false);
  const viewportRef = useRef(null);
  const measureRefs = useRef(new Map());
  const initialPositionApplied = useRef(false);
  const touchStart = useRef(null);

  const updateSetting = useCallback((key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const fontExists = FONT_OPTIONS.some((font) => font.id === saved.fontFamily);
      const themeExists = THEME_OPTIONS.some((theme) => theme.id === saved.theme);
      const motionExists = READING_MODE_OPTIONS.some((mode) => mode.id === saved.motion);
      setSettings({
        ...DEFAULT_SETTINGS,
        ...saved,
        fontFamily: fontExists ? saved.fontFamily : DEFAULT_SETTINGS.fontFamily,
        theme: themeExists ? saved.theme : DEFAULT_SETTINGS.theme,
        motion: motionExists ? saved.motion : DEFAULT_SETTINGS.motion,
        fontSize: clamp(Number(saved.fontSize) || DEFAULT_SETTINGS.fontSize, 16, 30),
        lineHeight: clamp(Number(saved.lineHeight) || DEFAULT_SETTINGS.lineHeight, 1.35, 2.1),
        brightness: clamp(Number(saved.brightness) || DEFAULT_SETTINGS.brightness, 35, 100),
      });
      const savedBookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
      setBookmarks(Array.isArray(savedBookmarks) ? savedBookmarks : []);
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setSettingsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage is optional */ }
  }, [settings, settingsReady]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const update = () => {
      const width = Math.max(1, Math.round(node.clientWidth));
      const height = Math.max(1, Math.round(node.clientHeight));
      setDimensions((current) => current.width === width && current.height === height ? current : { width, height });
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useLayoutEffect(() => {
    if (!settingsReady || !dimensions.width || !dimensions.height) return undefined;
    setMeasurementReady(false);
    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;

    const measure = () => {
      if (cancelled) return;
      const counts = chapterList.map((item) => {
        const node = measureRefs.current.get(item.id);
        if (!node) return 1;
        return Math.max(1, Math.ceil((node.scrollWidth - 1) / dimensions.width));
      });
      setPageCounts((current) => current.join(',') === counts.join(',') ? current : counts);
      setMeasurementReady(true);
    };

    const schedule = () => {
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(measure);
      });
    };
    schedule();
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [chapterList, dimensions, settings.align, settings.bold, settings.fontFamily, settings.fontSize, settings.lineHeight, settingsReady]);

  const currentChapterPages = pageCounts[chapterIndex] || 1;

  useEffect(() => {
    setPage((current) => clamp(current, 0, Math.max(0, currentChapterPages - 1)));
  }, [currentChapterPages]);

  useEffect(() => {
    initialPositionApplied.current = false;
    setPage(0);
  }, [chapter.id]);

  useEffect(() => {
    if (!measurementReady || initialPositionApplied.current) return;
    let wantedPage = 0;
    try {
      const requested = new URLSearchParams(window.location.search).get('page');
      if (requested === 'last') wantedPage = currentChapterPages - 1;
      else if (requested && Number.isFinite(Number(requested))) wantedPage = Number(requested) - 1;
      else wantedPage = Number(localStorage.getItem(`booknerd-reader-position:${book.id}:${chapter.id}`) || 0);
    } catch { /* start at the beginning */ }
    setPage(clamp(wantedPage, 0, Math.max(0, currentChapterPages - 1)));
    initialPositionApplied.current = true;
  }, [book.id, chapter.id, currentChapterPages, measurementReady]);

  useEffect(() => {
    if (!initialPositionApplied.current) return;
    try { localStorage.setItem(`booknerd-reader-position:${book.id}:${chapter.id}`, String(page)); } catch { /* optional */ }
  }, [book.id, chapter.id, page]);

  const bookPageOffset = useMemo(
    () => pageCounts.slice(0, chapterIndex).reduce((total, count) => total + count, 0),
    [chapterIndex, pageCounts]
  );
  const totalBookPages = Math.max(1, pageCounts.reduce((total, count) => total + count, 0));
  const currentBookPage = clamp(bookPageOffset + page + 1, 1, totalBookPages);
  const percent = Math.round((currentBookPage / totalBookPages) * 100);
  const pagesLeftInChapter = Math.max(0, currentChapterPages - page - 1);
  const bookmarkId = `${chapter.id}:${page}`;
  const isBookmarked = bookmarks.includes(bookmarkId);

  const goBackward = useCallback(() => {
    if (settings.motion === 'scroll') {
      const node = viewportRef.current;
      if (node && node.scrollTop > 4) {
        node.scrollBy({ top: -Math.max(240, node.clientHeight * .88), behavior: 'smooth' });
        return;
      }
    }
    if (page > 0) {
      setPage((current) => current - 1);
      return;
    }
    if (previous) window.location.href = `/books/${book.slug}/chapters/${previous.id}?page=last`;
  }, [book.slug, page, previous, settings.motion]);

  const goForward = useCallback(() => {
    if (settings.motion === 'scroll') {
      const node = viewportRef.current;
      if (node && node.scrollTop < node.scrollHeight - node.clientHeight - 4) {
        node.scrollBy({ top: Math.max(240, node.clientHeight * .88), behavior: 'smooth' });
        return;
      }
    }
    if (page < currentChapterPages - 1) {
      setPage((current) => current + 1);
      return;
    }
    if (next) window.location.href = `/books/${book.slug}/chapters/${next.id}`;
    else window.location.href = `/books/${book.slug}`;
  }, [book.slug, currentChapterPages, next, page, settings.motion]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !measurementReady) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (settings.motion === 'scroll') {
        const maximum = Math.max(0, node.scrollHeight - node.clientHeight);
        node.scrollTop = currentChapterPages > 1 ? (page / (currentChapterPages - 1)) * maximum : 0;
      } else {
        node.scrollTop = 0;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapter.id, currentChapterPages, measurementReady, settings.motion]);

  const handleReaderScroll = useCallback((event) => {
    if (settings.motion !== 'scroll') return;
    const node = event.currentTarget;
    const maximum = node.scrollHeight - node.clientHeight;
    const ratio = maximum > 0 ? node.scrollTop / maximum : 0;
    const visiblePage = Math.round(ratio * Math.max(0, currentChapterPages - 1));
    setPage((current) => current === visiblePage ? current : visiblePage);
  }, [currentChapterPages, settings.motion]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (panel || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); goBackward(); }
      if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); goForward(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goBackward, goForward, panel]);

  const toggleBookmark = () => {
    const nextBookmarks = isBookmarked ? bookmarks.filter((item) => item !== bookmarkId) : [...bookmarks, bookmarkId];
    setBookmarks(nextBookmarks);
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(nextBookmarks)); } catch { /* optional */ }
    setToast(isBookmarked ? 'Закладка удалена' : 'Страница добавлена в закладки');
  };

  const sharePage = async () => {
    const shareData = { title: `${book.title} — ${chapter.title}`, text: `Читаю «${book.title}» на BOOKNERD`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        setToast('Ссылка скопирована');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setToast('Не удалось поделиться ссылкой');
    }
  };

  const toggleOrientationLock = async () => {
    try {
      if (orientationLocked) {
        screen.orientation?.unlock?.();
        setOrientationLocked(false);
        setToast('Поворот экрана снова разрешён');
      } else if (screen.orientation?.lock) {
        await screen.orientation.lock('portrait');
        setOrientationLocked(true);
        setToast('Экран закреплён вертикально');
      } else {
        setToast('Закрепление доступно после установки сайта на экран телефона');
      }
    } catch {
      setToast('Браузер не разрешил закрепить поворот');
    }
  };

  const openComments = () => {
    setPanel(null);
    window.setTimeout(() => document.getElementById('chapter-comments')?.scrollIntoView({ behavior: 'smooth' }), 80);
  };

  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLocaleLowerCase('ru-RU');
    if (needle.length < 2) return [];
    return chapterList.flatMap((item) => {
      const body = String(item.body || '');
      const haystack = `${item.title}\n${body}`.toLocaleLowerCase('ru-RU');
      const foundAt = haystack.indexOf(needle);
      if (foundAt < 0) return [];
      const bodyPosition = Math.max(0, body.toLocaleLowerCase('ru-RU').indexOf(needle));
      const start = Math.max(0, bodyPosition - 70);
      const end = Math.min(body.length, bodyPosition + needle.length + 120);
      const snippet = `${start > 0 ? '…' : ''}${body.slice(start, end).replace(/\s+/g, ' ')}${end < body.length ? '…' : ''}`;
      return [{ ...item, snippet: snippet || item.title }];
    }).slice(0, 30);
  }, [chapterList, searchQuery]);

  const fontStyle = {
    '--reader-font-size': `${settings.fontSize}px`,
    '--reader-font-family': `"${settings.fontFamily}", Georgia, serif`,
    '--reader-line-height': settings.lineHeight,
    '--reader-font-weight': settings.bold ? 700 : 400,
    '--reader-text-align': settings.align,
  };

  const flowStyle = dimensions.width && dimensions.height ? {
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    columnWidth: `${dimensions.width}px`,
    columnGap: '0px',
    columnFill: 'auto',
  } : undefined;

  const motionKey = settings.motion === 'fade' || settings.motion === 'curl'
    ? `${chapter.id}-${settings.motion}-${page}`
    : `${chapter.id}-${settings.motion}`;

  return (
    <main className="reader-page reader-modern" data-reader-theme={settings.theme} style={fontStyle}>
      <section className="reader-experience" data-reading-mode={settings.motion} aria-label={`Читалка: ${book.title}`}>
        <header className="reader-book-header">
          <a className="reader-book-brand" href="/"><span>B</span><strong>BOOKNERD</strong></a>
          <div className="reader-book-progress" aria-label={`Прочитано ${percent}%`}>
            <div><i style={{ width: `${percent}%` }} /></div><span>{percent}%</span>
          </div>
        </header>

        <nav className="reader-quickbar" aria-label="Быстрые настройки чтения">
          <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize - 1, 16, 30))} aria-label="Уменьшить текст">A−</button>
          <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize + 1, 16, 30))} aria-label="Увеличить текст">A+</button>
          <button type="button" onClick={() => updateSetting('theme', settings.theme === 'night' ? 'paper' : 'night')} aria-label="Светлая или ночная тема">
            {settings.theme === 'night' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <a href={`/books/${book.slug}`}><BookOpen size={17} /> О книге</a>
          <button type="button" className="reader-menu-button" onClick={() => setPanel('menu')} aria-label="Меню читалки"><Menu size={21} /></button>
        </nav>

        <div className="reader-stage">
          <div className="reader-pages-left" aria-live="polite">
            {!measurementReady ? 'Считаем страницы…' : pagesLeftInChapter > 0 ? `Осталось ${pagesLeftInChapter} стр. в главе` : 'Последняя страница главы'}
          </div>
          <button type="button" className="reader-page-arrow reader-page-arrow-left" onClick={goBackward} disabled={!previous && page === 0} aria-label="Предыдущая страница"><ArrowLeft size={22} /></button>
          <div
            className="reader-page-window"
            ref={viewportRef}
            onScroll={handleReaderScroll}
            onTouchStart={(event) => { touchStart.current = settings.motion === 'scroll' ? null : (event.touches[0]?.clientX ?? null); }}
            onTouchEnd={(event) => {
              if (touchStart.current == null) return;
              const finish = event.changedTouches[0]?.clientX ?? touchStart.current;
              const distance = finish - touchStart.current;
              touchStart.current = null;
              if (Math.abs(distance) < 45) return;
              if (distance > 0) goBackward(); else goForward();
            }}
          >
            <div className={`reader-motion-surface reader-motion-${settings.motion}`} key={motionKey}>
              <div className="reader-column-flow reader-visible-flow" style={{ ...flowStyle, transform: `translate3d(-${page * dimensions.width}px, 0, 0)` }}>
                <ChapterFlow book={book} chapter={chapter} showDriveLink />
              </div>
            </div>
          </div>
          <button type="button" className="reader-page-arrow reader-page-arrow-right" onClick={goForward} aria-label="Следующая страница"><ArrowRight size={22} /></button>
        </div>

        <footer className="reader-page-footer">
          <button type="button" onClick={goBackward} disabled={!previous && page === 0}><ArrowLeft size={18} /><span>Предыдущая</span></button>
          <div>
            <strong aria-live="polite">{measurementReady ? `${currentBookPage} из ${totalBookPages}` : '— из —'}</strong>
            <button type="button" onClick={openComments}><MessageCircle size={16} /> Комментарии</button>
          </div>
          <button type="button" onClick={goForward}><span>Следующая</span><ArrowRight size={18} /></button>
        </footer>
        <div className="reader-dimmer" aria-hidden="true" style={{ opacity: ((100 - settings.brightness) / 100) * .58 }} />
      </section>

      <div className="reader-measure-layer" aria-hidden="true">
        {dimensions.width && dimensions.height ? chapterList.map((item) => (
          <div
            className="reader-column-flow reader-measure-flow"
            key={item.id}
            ref={(node) => {
              if (node) measureRefs.current.set(item.id, node);
              else measureRefs.current.delete(item.id);
            }}
            style={flowStyle}
          >
            <ChapterFlow book={book} chapter={item} showDriveLink measuring />
          </div>
        )) : null}
      </div>

      <section id="chapter-comments" className="reader-discussion-wrap">
        <CommentsSection bookId={book.id} chapterId={chapter.id} />
      </section>

      {panel === 'menu' ? (
        <ReaderSheet title="Меню чтения" eyebrow={`${currentBookPage} из ${totalBookPages}`} onClose={() => setPanel(null)}>
          <div className="reader-menu-list">
            <button type="button" onClick={() => setPanel('contents')}><List size={22} /><span><strong>Содержание</strong><small>Все главы книги</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('search')}><Search size={22} /><span><strong>Поиск по книге</strong><small>Найти слово во всех главах</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('settings')}><SlidersHorizontal size={22} /><span><strong>Темы и настройки</strong><small>Шрифт, размер, фон и яркость</small></span><ChevronRight size={18} /></button>
          </div>
          <div className="reader-menu-actions">
            <button type="button" onClick={sharePage}><Share2 size={21} /><span>Поделиться</span></button>
            <button type="button" onClick={toggleOrientationLock} className={orientationLocked ? 'is-active' : ''}><Lock size={21} /><span>Поворот</span></button>
            <button type="button" onClick={() => updateSetting('align', settings.align === 'left' ? 'justify' : 'left')} className={settings.align === 'justify' ? 'is-active' : ''}><AlignJustify size={21} /><span>Текст</span></button>
            <button type="button" onClick={toggleBookmark} className={isBookmarked ? 'is-active' : ''}>{isBookmarked ? <BookmarkCheck size={21} /> : <Bookmark size={21} />}<span>Закладка</span></button>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'contents' ? (
        <ReaderSheet title="Содержание" eyebrow={`Страница ${currentBookPage} из ${totalBookPages}`} onClose={() => setPanel(null)} wide>
          <div className="reader-contents-book">
            <div className="reader-contents-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>B</span>}</div>
            <div><small>{book.author}</small><strong>{book.title}</strong><span>Глава {chapter.chapterNumber} · {chapter.title}</span></div>
          </div>
          <div className="reader-contents-list">
            {chapterList.map((item, index) => {
              const startsAt = pageCounts.slice(0, index).reduce((total, count) => total + count, 0) + 1;
              return (
                <a className={item.id === chapter.id ? 'is-current' : ''} href={`/books/${book.slug}/chapters/${item.id}`} key={item.id}>
                  <span><small>Глава {item.chapterNumber}</small><strong>{item.title}</strong></span>
                  <em>{measurementReady ? startsAt : '—'}</em>
                </a>
              );
            })}
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'search' ? (
        <ReaderSheet title="Поиск по книге" eyebrow={book.title} onClose={() => setPanel(null)} wide>
          <label className="reader-search-field"><Search size={21} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Введите слово или фразу" /></label>
          {searchQuery.trim().length < 2 ? <p className="reader-search-hint">Введите хотя бы две буквы. Поиск пройдёт по всем опубликованным главам.</p> : null}
          <div className="reader-search-results">
            {searchQuery.trim().length >= 2 && !searchResults.length ? <p>Ничего не найдено.</p> : searchResults.map((result) => (
              <a href={`/books/${book.slug}/chapters/${result.id}`} key={result.id}>
                <small>Глава {result.chapterNumber}</small><strong>{result.title}</strong><span>{result.snippet}</span>
              </a>
            ))}
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'settings' ? (
        <ReaderSheet title="Темы и настройки" eyebrow="Читалка BOOKNERD" onClose={() => setPanel(null)} wide>
          <button className="reader-mode-selector" type="button" onClick={() => setPanel('reading-mode')}>
            <ReadingModeIcon mode={settings.motion} size={24} />
            <span><small>Способ чтения</small><strong>{READING_MODE_OPTIONS.find((mode) => mode.id === settings.motion)?.name}</strong></span>
            <ChevronRight size={20} />
          </button>
          <section className="reader-settings-block">
            <div className="reader-setting-stepper">
              <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize - 1, 16, 30))}>A−</button>
              <span>{settings.fontSize}px</span>
              <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize + 1, 16, 30))}>A+</button>
            </div>
            <div className="reader-setting-pair">
              <button type="button" className={settings.align === 'left' ? 'is-active' : ''} onClick={() => updateSetting('align', 'left')}><AlignLeft size={22} /> По левому краю</button>
              <button type="button" className={settings.align === 'justify' ? 'is-active' : ''} onClick={() => updateSetting('align', 'justify')}><AlignJustify size={22} /> По ширине</button>
            </div>
            <label className="reader-range"><span><Sun size={17} /> Яркость страницы</span><input type="range" min="35" max="100" value={settings.brightness} onChange={(event) => updateSetting('brightness', Number(event.target.value))} /><strong>{settings.brightness}%</strong></label>
            <label className="reader-range"><span><Type size={17} /> Межстрочный интервал</span><input type="range" min="1.35" max="2.1" step="0.05" value={settings.lineHeight} onChange={(event) => updateSetting('lineHeight', Number(event.target.value))} /><strong>{settings.lineHeight.toFixed(2)}</strong></label>
          </section>

          <section className="reader-theme-grid" aria-label="Темы страницы">
            {THEME_OPTIONS.map((theme) => (
              <button type="button" data-theme-preview={theme.id} className={settings.theme === theme.id ? 'is-active' : ''} onClick={() => updateSetting('theme', theme.id)} key={theme.id}>
                <strong>{theme.sample}</strong><span>{theme.name}</span>{settings.theme === theme.id ? <Check size={17} /> : null}
              </button>
            ))}
          </section>

          <section className="reader-settings-block reader-font-settings">
            <button type="button" onClick={() => setPanel('fonts')}><Type size={22} /><span><small>Шрифт</small><strong>{FONT_OPTIONS.find((font) => font.id === settings.fontFamily)?.name}</strong></span><ChevronRight size={19} /></button>
            <button type="button" className={settings.bold ? 'is-active' : ''} onClick={() => updateSetting('bold', !settings.bold)}><BoldIcon size={22} /><span><small>Начертание</small><strong>Жирный текст</strong></span><i aria-hidden="true" /></button>
          </section>
          <button className="reader-reset-button" type="button" onClick={() => setSettings(DEFAULT_SETTINGS)}><RotateCcw size={19} /> Сбросить настройки</button>
        </ReaderSheet>
      ) : null}

      {panel === 'reading-mode' ? (
        <ReaderSheet title="Способ чтения" eyebrow="Как будут меняться страницы" onClose={() => setPanel('settings')}>
          <div className="reader-reading-mode-list">
            {READING_MODE_OPTIONS.map((mode) => (
              <button
                type="button"
                className={settings.motion === mode.id ? 'is-active' : ''}
                onClick={() => { updateSetting('motion', mode.id); setPanel('settings'); }}
                key={mode.id}
              >
                <ReadingModeIcon mode={mode.id} size={24} />
                <span><strong>{mode.name}</strong><small>{mode.description}</small></span>
                {settings.motion === mode.id ? <Check size={22} /> : null}
              </button>
            ))}
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'fonts' ? (
        <ReaderSheet title="Выбор шрифта" eyebrow="Предпросмотр текста сразу изменится" onClose={() => setPanel('settings')}>
          <div className="reader-font-list">
            {FONT_OPTIONS.map((font) => (
              <button type="button" style={{ fontFamily: `"${font.id}", serif` }} className={settings.fontFamily === font.id ? 'is-active' : ''} onClick={() => { updateSetting('fontFamily', font.id); setPanel('settings'); }} key={font.id}>
                <span>{font.name}</span>{settings.fontFamily === font.id ? <Check size={22} /> : null}
              </button>
            ))}
          </div>
        </ReaderSheet>
      ) : null}

      {toast ? <div className="reader-toast" role="status">{toast}</div> : null}
    </main>
  );
}
