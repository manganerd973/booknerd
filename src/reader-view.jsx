'use client';
import PurpleCat from './purple-cat.jsx';

import BookGlossary from './book-glossary.jsx';
import WorldMapViewer from './world-map-viewer.jsx';

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
  Cat,
  Clock3,
  Flag,
  Heart,
  ChevronRight,
  ExternalLink,
  Highlighter,
  List,
  Lock,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Pause,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  SmilePlus,
  StickyNote,
  Sun,
  Trash2,
  Type,
  BookMarked,
  Film,
  Map as MapIcon,
  Music2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import CommentsSection from './comments-section.jsx';
import { ShelfBook } from './book-shelves.jsx';
import { richDocumentFor } from '../lib/rich-document.js';
import { getVisitorKey, trackReaderPresence } from './site-analytics.js';
import {
  APP_THEME_OPTIONS,
  getStoredAppTheme,
  READER_THEME_FOLLOWS_APP_KEY,
  setStoredAppTheme,
} from './app-preferences.jsx';
import {
  AnnotatedParagraph,
  HIGHLIGHT_COLORS,
  ReaderSticker,
  SelectionAnnotationBar,
  StickerPicker,
  stickerById,
} from './reader-annotations.jsx';

const SETTINGS_KEY = 'booknerd-reader-settings-v2';
const ANNOTATIONS_KEY_PREFIX = 'booknerd-reader-annotations-v1';
const CHAPTER_EMOTIONS = ['😂', '😭', '😍', '😡', '😱', '🤍'];

const BOOKMARK_CATEGORIES = [
  { id: 'favorite', label: 'Любимый момент', symbol: '♡', color: '#ec8dad' },
  { id: 'later', label: 'Вернуться позже', symbol: '↩', color: '#8ca9d8' },
  { id: 'important', label: 'Важное', symbol: '!', color: '#ddae58' },
  { id: 'funny', label: 'Смешное', symbol: '☺', color: '#77ad82' },
];

const ERROR_CATEGORIES = [
  { id: 'typo', label: 'Опечатка' },
  { id: 'gender', label: 'Неправильный род' },
  { id: 'missing', label: 'Пропущенный текст' },
  { id: 'other', label: 'Другая ошибка' },
];

const DEFAULT_SETTINGS = {
  theme: 'paper',
  motion: 'scroll',
  motionChosen: false,
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
  { id: 'scroll', name: 'Целая глава', description: 'Вся глава на одной прокручиваемой странице' },
];

const THEME_OPTIONS = [
  { id: 'original', name: 'Оригинал', sample: 'Aa' },
  { id: 'night', name: 'Звёздная ночь', sample: 'Aa' },
  { id: 'paper', name: 'Старинный архив', sample: 'Aa' },
  { id: 'bold', name: 'Лесная библиотека', sample: 'Aa' },
  { id: 'calm', name: 'Японский сад', sample: 'Aa' },
  { id: 'focus', name: 'Осеннее кафе', sample: 'Aa' },
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

function readerThemeForApp(appTheme) {
  if (appTheme === 'black') return 'night';
  if (appTheme === 'white') return 'original';
  if (appTheme === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'original';
  return 'paper';
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function manualChapterTitle(chapter) {
  const title = String(chapter?.title || '').trim();
  if (!title) return '';

  const automaticPrefix = /^Глава\s+\d+(?:\s*[.:\-–—]\s*|\s+)/iu;
  if (automaticPrefix.test(title)) return title.replace(automaticPrefix, '').trim();
  return /^Глава\s+\d+$/iu.test(title) ? '' : title;
}

function readerChapterTitle(chapter) {
  return manualChapterTitle(chapter) || 'Название не указано';
}

function blocksFor(chapter) {
  const documentValue = richDocumentFor(chapter.bodyRich, chapter.body);
  return documentValue.blocks.length ? documentValue.blocks : [{ type: 'paragraph', runs: [{ text: 'Текст этой главы готовится к публикации.' }] }];
}

const wordForms = { one: 'слово', few: 'слова', many: 'слов', other: 'слов' };
const wordPlural = new Intl.PluralRules('ru');

function ChapterFlow({
  book,
  chapter,
  showDriveLink = false,
  commentCount = null,
  onOpenComments,
  measuring = false,
  annotations = [],
  onOpenAnnotation,
  onOpenFootnote,
  onSelectionEnd,
}) {
  const blocks = useMemo(() => blocksFor(chapter), [chapter.body, chapter.bodyRich]);
  const wordCount = useMemo(() => {
    const document = richDocumentFor(chapter.bodyRich, chapter.body);
    return document.blocks.reduce((total, block) => {
      const text = block.runs.map((run) => run.text).join('');
      return total + (text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-’'][\p{L}\p{M}\p{N}]+)*/gu)?.length || 0);
    }, 0);
  }, [chapter.body, chapter.bodyRich]);
  const minutes = Math.ceil(wordCount / 200);
  const CommentControl = onOpenComments ? 'button' : 'span';
  const chapterTitle = manualChapterTitle(chapter);

  return (
    <article className="reader-flow-chapter">
      <header className="reader-flow-intro">
        <span>{book.title}</span>
        <h1>{chapterTitle || `Глава ${chapter.chapterNumber}`}</h1>
        {showDriveLink && chapter.driveUrl ? measuring ? (
          <span className="reader-flow-drive">Файл главы <ExternalLink size={14} /></span>
        ) : (
          <a className="reader-flow-drive" href={chapter.driveUrl} target="_blank" rel="noreferrer">
            Файл главы <ExternalLink size={14} />
          </a>
        ) : null}
        <div className="reader-chapter-meta" aria-label="Сведения о главе">
          <span aria-label={`Примерное время чтения: ${minutes} мин`}><Clock3 size={15} aria-hidden="true" /> {minutes} мин</span>
          <span><BookOpen size={15} aria-hidden="true" /> {wordCount} {wordForms[wordPlural.select(wordCount)]}</span>
          <CommentControl {...(onOpenComments ? { type: 'button', onClick: onOpenComments, 'aria-label': `Открыть комментарии к главе${commentCount === null ? '' : `: ${commentCount}`}` } : {})}><MessageCircle size={15} aria-hidden="true" /> {commentCount ?? '—'}</CommentControl>
          {Number.isFinite(book.ageRating) && <span className="reader-chapter-age" aria-label={`Возрастной рейтинг ${book.ageRating}+`}>{book.ageRating}+</span>}
        </div>
        <p className="reader-error-hint"><strong>Нашли ошибку?</strong> Выделите фрагмент текста и нажмите «Предложить правку».</p>
      </header>
      <div className="reader-flow-copy">
        {blocks.map((block, index) => {
          const text = block.runs.map((run) => run.text).join('');
          if (block.type === 'image') return <figure className={`reader-inline-image is-${block.size || 'small'} align-${block.align || 'center'}`} key={index}><img src={block.src} alt={block.alt || ''} onLoad={() => window.dispatchEvent(new Event('resize'))} /></figure>;
          const element = block.chatSide ? 'p' : block.type === 'heading' ? 'h2' : block.type === 'subheading' ? 'h3' : block.type === 'blockquote' ? 'blockquote' : 'p';
          const listMarker = block.type === 'list-item' ? block.listType === 'number' ? `${block.listIndex || index + 1}.` : '•' : '';
          return <AnnotatedParagraph
            text={text}
            runs={block.runs}
            as={element}
            className={`reader-rich-block reader-rich-${block.type}${block.chatSide ? ` reader-chat-message is-${block.chatSide}` : ''}`}
            style={{ textAlign: block.align || undefined, textIndent: block.textIndent || undefined, marginLeft: block.marginLeft || undefined }}
            listMarker={listMarker}
            chatSender={block.chatSender}
            chatSide={block.chatSide}
            paragraphIndex={index}
            chapterId={chapter.id}
            annotations={annotations.flatMap((annotation) => {
              const segmentIndex = Array.isArray(annotation.segments)
                ? annotation.segments.findIndex((item) => Number(item.paragraphIndex) === index)
                : -1;
              const segment = segmentIndex >= 0 ? annotation.segments[segmentIndex] : null;
              if (segment) return [{
                ...annotation,
                ...segment,
                text: segment.text,
                sticker: segmentIndex === annotation.segments.length - 1 ? annotation.sticker : '',
              }];
              return Number(annotation.paragraphIndex) === index ? [annotation] : [];
            })}
            footnotes={chapter.footnotes || []}
            onOpenAnnotation={measuring ? undefined : onOpenAnnotation}
            onOpenFootnote={measuring ? undefined : onOpenFootnote}
            onSelectionEnd={measuring ? undefined : onSelectionEnd}
            key={index}
          />;
        })}
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

export default function ReaderView({ book, chapter, chapters = [], previous, next, recommendations = [], similar = [], supportLinks = [], supportCard = '', initialCommentCount = null }) {
  const chapterList = useMemo(() => chapters.length ? chapters : [chapter], [chapters, chapter]);
  const chapterIndex = Math.max(0, chapterList.findIndex((item) => item.id === chapter.id));
  const translationCompleted = book.status === 'Завершено';
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [page, setPage] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [pageCounts, setPageCounts] = useState(() => chapterList.map(() => 1));
  const [measurementReady, setMeasurementReady] = useState(false);
  const [panel, setPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkDraft, setBookmarkDraft] = useState(null);
  const [errorDraft, setErrorDraft] = useState(null);
  const [extraSaving, setExtraSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [orientationLocked, setOrientationLocked] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [supportDismissed, setSupportDismissed] = useState(false);
  const [chapterLike, setChapterLike] = useState({ liked: false, total: 0 });
  const [likeReady, setLikeReady] = useState(false);
  const [likeSaving, setLikeSaving] = useState(false);
  const [annotations, setAnnotations] = useState([]);
  const [annotationsReady, setAnnotationsReady] = useState(false);
  const [textSelection, setTextSelection] = useState(null);
  const [readerHub, setReaderHub] = useState({ dictionary: [], reactions: [], emotionTotals: [], myEmotions: [] });
  const [dictionaryDraft, setDictionaryDraft] = useState(null);
  const [ambientSound, setAmbientSound] = useState('');
  const [chapterMusicPlaying, setChapterMusicPlaying] = useState(false);
  const [chapterMusicVolume, setChapterMusicVolume] = useState(.65);

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== 'hidden') trackReaderPresence(book.id, chapter.id);
    };
    ping();
    const timer = window.setInterval(ping, 60000);
    document.addEventListener('visibilitychange', ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', ping);
    };
  }, [book.id, chapter.id]);

  const [activeAnnotationId, setActiveAnnotationId] = useState(null);
  const [activeFootnote, setActiveFootnote] = useState(null);
  const [noteDraft, setNoteDraft] = useState(null);
  const viewportRef = useRef(null);
  const measureRefs = useRef(new Map());
  const initialPositionApplied = useRef(false);
  const touchStart = useRef(null);
  const readerTap = useRef({ tracking: false, x: 0, y: 0, last: 0 });
  const ambientAudioRef = useRef(null);
  const chapterAudioRef = useRef(null);

  const annotationStorageKey = `${ANNOTATIONS_KEY_PREFIX}:${book.id}`;
  const chapterAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.chapterId === chapter.id),
    [annotations, chapter.id]
  );
  const activeAnnotation = annotations.find((annotation) => annotation.id === activeAnnotationId) || null;
  const annotationVersion = annotations.map((annotation) => `${annotation.id}:${annotation.updatedAt || annotation.createdAt}:${annotation.color}:${annotation.sticker}:${annotation.note}`).join('|');

  const updateSetting = useCallback((key, value) => {
    setSettings((current) => ({ ...current, [key]: value, motionChosen: key === 'motion' || current.motionChosen }));
  }, []);

  const updateReaderTheme = useCallback((theme) => {
    try { localStorage.setItem(READER_THEME_FOLLOWS_APP_KEY, '0'); } catch { /* preference remains active for this visit */ }
    updateSetting('theme', theme);
  }, [updateSetting]);

  const updateAppTheme = useCallback((appTheme) => {
    setStoredAppTheme(appTheme);
    updateSetting('theme', readerThemeForApp(appTheme));
  }, [updateSetting]);

  useLayoutEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      const fontExists = FONT_OPTIONS.some((font) => font.id === saved.fontFamily);
      const themeExists = THEME_OPTIONS.some((theme) => theme.id === saved.theme);
      const motionExists = READING_MODE_OPTIONS.some((mode) => mode.id === saved.motion);
      const followsAppTheme = localStorage.getItem(READER_THEME_FOLLOWS_APP_KEY) !== '0';
      setSettings({
        ...DEFAULT_SETTINGS,
        ...saved,
        fontFamily: fontExists ? saved.fontFamily : DEFAULT_SETTINGS.fontFamily,
        theme: followsAppTheme ? readerThemeForApp(getStoredAppTheme()) : themeExists ? saved.theme : DEFAULT_SETTINGS.theme,
        motion: saved.continuousReaderVersion === 1 && motionExists && saved.motionChosen ? saved.motion : 'scroll',
        continuousReaderVersion: 1,
        fontSize: clamp(Number(saved.fontSize) || DEFAULT_SETTINGS.fontSize, 14, 30),
        lineHeight: clamp(Number(saved.lineHeight) || DEFAULT_SETTINGS.lineHeight, 1.35, 2.1),
        brightness: clamp(Number(saved.brightness) || DEFAULT_SETTINGS.brightness, 35, 100),
      });
    } catch {
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setSettingsReady(true);
    }
  }, []);

  useEffect(() => {
    const syncAppTheme = (event) => {
      let follows = true;
      try { follows = localStorage.getItem(READER_THEME_FOLLOWS_APP_KEY) !== '0'; } catch { /* follow during this visit */ }
      if (follows) updateSetting('theme', readerThemeForApp(event.detail || getStoredAppTheme()));
    };
    window.addEventListener('booknerd-theme-change', syncAppTheme);
    return () => window.removeEventListener('booknerd-theme-change', syncAppTheme);
  }, [updateSetting]);

  useEffect(() => {
    if (!settingsReady) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage is optional */ }
  }, [settings, settingsReady]);

  useEffect(() => {
    setAnnotationsReady(false);
    try {
      const saved = JSON.parse(localStorage.getItem(annotationStorageKey) || '[]');
      setAnnotations(Array.isArray(saved) ? saved : []);
    } catch {
      setAnnotations([]);
    } finally {
      setAnnotationsReady(true);
    }
  }, [annotationStorageKey]);

  useEffect(() => {
    if (!annotationsReady) return;
    try { localStorage.setItem(annotationStorageKey, JSON.stringify(annotations)); } catch { /* device storage is optional */ }
  }, [annotationStorageKey, annotations, annotationsReady]);

  useEffect(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookId: book.id });
    fetch(`/api/reader-bookmarks?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setBookmarks(Array.isArray(data.bookmarks) ? data.bookmarks : []))
      .catch(() => setBookmarks([]));
  }, [book.id]);

  const refreshReaderHub = useCallback(() => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), bookId: book.id, chapterId: chapter.id });
    return fetch(`/api/reader-hub?${query.toString()}`, { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => setReaderHub({
        dictionary: Array.isArray(data.dictionary) ? data.dictionary : [],
        reactions: Array.isArray(data.reactions) ? data.reactions : [],
        emotionTotals: Array.isArray(data.emotionTotals) ? data.emotionTotals : [],
        myEmotions: Array.isArray(data.myEmotions) ? data.myEmotions : [],
      }))
      .catch(() => {});
  }, [book.id, chapter.id]);

  useEffect(() => { refreshReaderHub(); }, [refreshReaderHub]);

  useEffect(() => () => {
    if (ambientAudioRef.current) {
      ambientAudioRef.current.close?.().catch?.(() => {});
      ambientAudioRef.current = null;
    }
    chapterAudioRef.current?.pause?.();
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('booknerd-chapter-music-volume-v1'));
      if (Number.isFinite(saved)) setChapterMusicVolume(clamp(saved, 0, 1));
    } catch { /* device storage is optional */ }
  }, []);

  useEffect(() => {
    if (chapterAudioRef.current) chapterAudioRef.current.volume = chapterMusicVolume;
    try { localStorage.setItem('booknerd-chapter-music-volume-v1', String(chapterMusicVolume)); } catch { /* device storage is optional */ }
  }, [chapterMusicVolume]);

  useEffect(() => {
    const audio = chapterAudioRef.current;
    audio?.pause?.();
    if (audio) audio.currentTime = 0;
    setChapterMusicPlaying(false);
  }, [chapter.id]);

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
        if (!node) return Math.max(1, Math.ceil((item.body || '').length / 1800));
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
  }, [annotationVersion, chapter.id, settings.motion, chapterList, dimensions, settings.align, settings.bold, settings.fontFamily, settings.fontSize, settings.lineHeight, settingsReady]);

  const currentChapterPages = pageCounts[chapterIndex] || 1;

  useEffect(() => {
    setPage((current) => clamp(current, 0, Math.max(0, currentChapterPages - 1)));
  }, [currentChapterPages]);

  useEffect(() => {
    initialPositionApplied.current = false;
    setPage(0);
    setTextSelection(null);
    setActiveAnnotationId(null);
    setActiveFootnote(null);
    setNoteDraft(null);
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
    try { localStorage.setItem('booknerd-last-reading-v1', JSON.stringify({ bookId: book.id, bookSlug: book.slug, bookTitle: book.title, coverUrl: book.coverUrl, lastChapterId: chapter.id, chapterNumber: chapter.chapterNumber, chapterTitle: chapter.title, lastPage: page, lastOpenedAt: new Date().toISOString() })); localStorage.setItem(`booknerd-reader-position:${book.id}:${chapter.id}`, String(page)); } catch { /* optional */ }
  }, [book.id, chapter.id, chapterIndex, chapterList.length, currentChapterPages, page]);

  const bookPageOffset = useMemo(
    () => pageCounts.slice(0, chapterIndex).reduce((total, count) => total + count, 0),
    [chapterIndex, pageCounts]
  );
  const totalBookPages = Math.max(1, pageCounts.reduce((total, count) => total + count, 0));
  const currentBookPage = clamp(bookPageOffset + page + 1, 1, totalBookPages);
  const percent = Math.round((currentBookPage / totalBookPages) * 100);
  const pagesLeftInChapter = Math.max(0, currentChapterPages - page - 1);
  const estimatedMinutesLeft = Math.max(1, Math.ceil((totalBookPages - currentBookPage) * 1.8));
  const chapterBlockCount = Math.max(1, blocksFor(chapter).length);
  const currentChapterEmotionTotals = readerHub.emotionTotals.filter((item) => item.chapter_id === chapter.id);
  const myChapterEmotion = readerHub.myEmotions.find((item) => item.chapter_id === chapter.id)?.emoji || '';
  const currentPageBookmark = bookmarks.find((item) => item.chapterId === chapter.id && Number(item.page) === page && !item.quote);
  const isBookmarked = Boolean(currentPageBookmark);
  const readingStateRef = useRef({ page, percent, chapterProgress: 0 });
  const chapterProgress = Math.round(((page + 1) / Math.max(1, currentChapterPages)) * 100);

  useEffect(() => {
    readingStateRef.current = { page, percent, chapterProgress };
  }, [chapterProgress, page, percent]);


  useEffect(() => {
    let stopped = false;
    const notificationReturn = (() => {
      try { return new URLSearchParams(window.location.search).get('notification') === '1'; } catch { return false; }
    })();
    const record = (seconds = 0, completed = false) => {
      if (stopped && !completed) return;
      const currentReadingState = readingStateRef.current;
      fetch('/api/reading-progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          visitorKey: getVisitorKey(),
          bookId: book.id,
          chapterId: chapter.id,
          seconds,
          chapterProgress: completed ? 100 : currentReadingState.chapterProgress,
          bookProgress: completed && !next && translationCompleted ? 100 : currentReadingState.percent,
          page: currentReadingState.page,
          completed,
          notificationReturn,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    let lastRecordedAt = Date.now();
    let visible = !document.hidden;
    const flush = () => {
      const now = Date.now();
      const seconds = visible ? Math.min(120, Math.floor((now - lastRecordedAt) / 1000)) : 0;
      lastRecordedAt = now;
      if (visible && seconds > 0) record(seconds, false);
    };
    const visibility = () => { flush(); visible = !document.hidden; lastRecordedAt = Date.now(); };
    record(0, false);
    const timer = window.setInterval(flush, 120000);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', flush);
    return () => {
      flush(); stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [book.id, chapter.id, next?.id, translationCompleted]);

  const markChapterComplete = useCallback(() => {
    fetch('/api/reading-progress', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        visitorKey: getVisitorKey(),
        bookId: book.id,
        chapterId: chapter.id,
        seconds: 0,
        chapterProgress: 100,
        bookProgress: next || !translationCompleted ? percent : 100,
        page,
        completed: true,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [book.id, chapter.id, next, page, percent, translationCompleted]);

  useEffect(() => {
    if (showCompletion) markChapterComplete();
  }, [markChapterComplete, showCompletion]);

  const goToNextChapter = (markComplete = true) => {
    if (!next) {
      setShowCompletion(true);
      return;
    }
    if (markComplete) markChapterComplete();
    window.location.href = `/books/${book.slug}/chapters/${next.id}`;
  };

  useEffect(() => {
    const controller = new AbortController();
    setLikeReady(false);
    const query = new URLSearchParams({ chapterId: chapter.id, visitorKey: getVisitorKey() });
    fetch(`/api/chapter-likes?${query}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) { setChapterLike(data); setLikeReady(true); } })
      .catch(() => {});
    return () => controller.abort();
  }, [chapter.id]);

  const toggleChapterLike = async () => {
    if (!likeReady || likeSaving) return;
    setLikeSaving(true);
    try {
      const response = await fetch('/api/chapter-likes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chapterId: chapter.id, visitorKey: getVisitorKey(), liked: !chapterLike.liked }),
      });
      if (!response.ok) throw new Error();
      setChapterLike(await response.json());
    } catch {
      setToast('Не удалось изменить отметку главы.');
    } finally {
      setLikeSaving(false);
    }
  };

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
    setShowCompletion(true);
  }, [book.slug, currentChapterPages, next, page, settings.motion]);

  const startReaderTap = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target.closest('button, a, input, textarea, select, label')) return;
    readerTap.current.tracking = true;
    readerTap.current.x = event.clientX;
    readerTap.current.y = event.clientY;
  };

  const finishReaderTap = (event) => {
    if (!readerTap.current.tracking) return;
    readerTap.current.tracking = false;
    const moved = Math.hypot(event.clientX - readerTap.current.x, event.clientY - readerTap.current.y);
    if (moved > 18) return;
    if (window.getSelection?.()?.toString().trim()) return;
    if (event.target.closest?.('[data-annotation-id]')) return;
    const now = Date.now();
    if (now - readerTap.current.last <= 360) {
      readerTap.current.last = 0;
      setPanel(null);
      setChromeHidden((current) => !current);
    } else {
      readerTap.current.last = now;
    }
  };

  const clearTextSelection = useCallback(() => {
    try { window.getSelection()?.removeAllRanges(); } catch { /* selection may already be gone */ }
    setTextSelection(null);
  }, []);

  const captureTextSelection = useCallback(() => {
    window.setTimeout(() => {
      const selection = window.getSelection?.();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      const endNode = range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement;
      const startParagraph = startNode?.closest?.('[data-reader-paragraph="true"]');
      const endParagraph = endNode?.closest?.('[data-reader-paragraph="true"]');
      if (!startParagraph || !endParagraph) return;
      if (startParagraph.dataset.chapterId !== chapter.id || endParagraph.dataset.chapterId !== chapter.id) return;

      const flow = startParagraph.closest('.reader-visible-flow');
      if (!flow || flow !== endParagraph.closest('.reader-visible-flow')) return;
      const paragraphs = [...flow.querySelectorAll('[data-reader-paragraph="true"]')];
      const firstIndex = paragraphs.indexOf(startParagraph);
      const lastIndex = paragraphs.indexOf(endParagraph);
      if (firstIndex < 0 || lastIndex < firstIndex) return;

      const offsetInParagraph = (paragraph, node, offset) => {
        const helper = document.createRange();
        helper.selectNodeContents(paragraph);
        helper.setEnd(node, offset);
        return helper.toString().length;
      };

      const selectedText = range.toString().trim();
      if (!selectedText) return;
      const segments = paragraphs.slice(firstIndex, lastIndex + 1).map((paragraph, relativeIndex, selectedParagraphs) => {
        const paragraphRange = document.createRange();
        paragraphRange.selectNodeContents(paragraph);
        if (relativeIndex === 0) paragraphRange.setStart(range.startContainer, range.startOffset);
        if (relativeIndex === selectedParagraphs.length - 1) paragraphRange.setEnd(range.endContainer, range.endOffset);
        const rawText = paragraphRange.toString();
        const leadingSpace = rawText.match(/^\s*/)?.[0]?.length || 0;
        const trailingSpace = rawText.match(/\s*$/)?.[0]?.length || 0;
        const start = relativeIndex === 0
          ? offsetInParagraph(paragraph, range.startContainer, range.startOffset) + leadingSpace
          : leadingSpace;
        const text = rawText.trim();
        return {
          paragraphIndex: Number(paragraph.dataset.paragraphIndex),
          start,
          end: Math.max(start, start + rawText.length - leadingSpace - trailingSpace),
          text,
        };
      }).filter((segment) => segment.text && segment.end > segment.start);
      if (!segments.length) return;

      setChromeHidden(false);
      setTextSelection({
        chapterId: chapter.id,
        paragraphIndex: segments[0].paragraphIndex,
        start: segments[0].start,
        end: segments[0].end,
        text: selectedText,
        segments,
        page,
      });
    }, 10);
  }, [chapter.id, page]);

  const addAnnotation = useCallback((source, patch = {}) => {
    if (!source?.text) return null;
    const now = new Date().toISOString();
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const annotation = {
      id,
      chapterId: source.chapterId,
      chapterTitle: chapterList.find((item) => item.id === source.chapterId)?.title || chapter.title,
      chapterNumber: chapterList.find((item) => item.id === source.chapterId)?.chapterNumber || chapter.chapterNumber,
      paragraphIndex: source.paragraphIndex,
      start: source.start,
      end: source.end,
      text: source.text,
      segments: Array.isArray(source.segments) ? source.segments : undefined,
      page: Number(source.page) || 0,
      color: patch.color || '#ffe066',
      note: String(patch.note || '').trim(),
      sticker: patch.sticker || '',
      publicNote: patch.publicNote === true,
      publicSpoiler: patch.publicSpoiler === true,
      createdAt: now,
      updatedAt: now,
    };
    setAnnotations((current) => [...current, annotation]);
    clearTextSelection();
    setToast(patch.note ? 'Заметка сохранена' : patch.sticker ? 'Стикер добавлен' : 'Фраза выделена');
    return id;
  }, [chapter.chapterNumber, chapter.title, chapterList, clearTextSelection]);

  const updateAnnotation = useCallback((id, patch) => {
    setAnnotations((current) => current.map((annotation) => annotation.id === id
      ? { ...annotation, ...patch, updatedAt: new Date().toISOString() }
      : annotation));
  }, []);

  const deletePublicNote = useCallback((sourceAnnotationId) => {
    const query = new URLSearchParams({ visitorKey: getVisitorKey(), sourceAnnotationId });
    return fetch(`/api/reader-notes?${query.toString()}`, { method: 'DELETE' });
  }, []);

  const publishReaderNote = useCallback(async (annotation) => {
    const response = await fetch('/api/reader-notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        visitorKey: getVisitorKey(),
        sourceAnnotationId: annotation.id,
        bookId: book.id,
        chapterId: annotation.chapterId,
        quote: annotation.text,
        note: annotation.note,
        paragraphIndex: annotation.paragraphIndex,
        page: annotation.page,
        isSpoiler: annotation.publicSpoiler === true,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось отправить заметку.');
    return data;
  }, [book.id]);

  const deleteAnnotation = useCallback((id) => {
    const removed = annotations.find((annotation) => annotation.id === id);
    setAnnotations((current) => current.filter((annotation) => annotation.id !== id));
    if (removed?.publicNote) deletePublicNote(id).catch(() => {});
    setActiveAnnotationId(null);
    setPanel(null);
    setToast('Пометка удалена');
  }, [annotations, deletePublicNote]);

  const openAnnotation = useCallback((id) => {
    clearTextSelection();
    setActiveAnnotationId(id);
    setPanel('annotation');
  }, [clearTextSelection]);

  const openFootnote = useCallback((footnote) => {
    if (!footnote) return;
    clearTextSelection();
    setChromeHidden(false);
    setActiveFootnote(footnote);
    setPanel('footnote');
  }, [clearTextSelection]);

  const openNewNote = useCallback(() => {
    if (!textSelection) return;
    setNoteDraft({ ...textSelection, mode: 'new', color: '#ffe066', note: '', sticker: '', publicNote: false, publicSpoiler: false });
    clearTextSelection();
    setPanel('annotation-note');
  }, [clearTextSelection, textSelection]);

  const openEditNote = useCallback((annotation) => {
    if (!annotation) return;
    setNoteDraft({ ...annotation, mode: 'edit', wasPublic: annotation.publicNote === true });
    setPanel('annotation-note');
  }, []);

  const saveNoteDraft = useCallback(async () => {
    if (!noteDraft) return;
    const wasPublic = noteDraft.mode === 'edit' && noteDraft.wasPublic === true;
    let annotationId = noteDraft.id;
    const publicNote = noteDraft.publicNote === true;
    const publicSpoiler = noteDraft.publicSpoiler === true;
    if (noteDraft.mode === 'edit') {
      updateAnnotation(noteDraft.id, {
        color: noteDraft.color,
        note: String(noteDraft.note || '').trim(),
        sticker: noteDraft.sticker || '',
        publicNote,
        publicSpoiler,
      });
      setToast('Пометка обновлена');
    } else {
      annotationId = addAnnotation(noteDraft, {
        color: noteDraft.color,
        note: noteDraft.note,
        sticker: noteDraft.sticker,
        publicNote,
        publicSpoiler,
      });
    }
    setNoteDraft(null);
    setPanel(null);
    if (publicNote && annotationId) {
      try {
        await publishReaderNote({
          ...noteDraft,
          id: annotationId,
          note: String(noteDraft.note || '').trim(),
          publicSpoiler,
        });
        setToast(publicSpoiler ? 'Заметка сохранена, но спойлер не попадёт на главную' : 'Заметка отправлена в редакцию для «Цитаты дня»');
      } catch (error) {
        updateAnnotation(annotationId, { publicNote: false });
        setToast(`Личная заметка сохранена. ${error.message}`);
      }
    } else if (wasPublic && annotationId) {
      deletePublicNote(annotationId).catch(() => {});
      setToast('Заметка снова только личная');
    }
  }, [addAnnotation, deletePublicNote, noteDraft, publishReaderNote, updateAnnotation]);

  const translateSelectedText = useCallback(() => {
    if (!textSelection?.text) return;
    const targetLanguage = /[а-яё]/i.test(textSelection.text) ? 'en' : 'ru';
    window.open(`https://translate.google.com/?sl=auto&tl=${targetLanguage}&text=${encodeURIComponent(textSelection.text)}&op=translate`, '_blank', 'noopener,noreferrer');
  }, [textSelection]);

  const searchSelectedText = useCallback(() => {
    if (!textSelection?.text) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(textSelection.text)}`, '_blank', 'noopener,noreferrer');
  }, [textSelection]);

  const copySelectedText = useCallback(async () => {
    if (!textSelection?.text) return;
    try {
      await navigator.clipboard.writeText(textSelection.text);
      setToast('Отрывок скопирован');
      clearTextSelection();
    } catch {
      setToast('Не удалось скопировать отрывок');
    }
  }, [clearTextSelection, textSelection]);

  const shareSelectedText = useCallback(async () => {
    if (!textSelection?.text) return;
    const data = { title: `${book.title} — ${chapter.title}`, text: `“${textSelection.text}”\n\n${book.title}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
      setToast(navigator.share ? 'Отрывок отправлен' : 'Отрывок и ссылка скопированы');
      clearTextSelection();
    } catch (error) {
      if (error?.name !== 'AbortError') setToast('Не удалось поделиться отрывком');
    }
  }, [book.title, chapter.title, clearTextSelection, textSelection]);

  const reactToSelection = useCallback(async (emoji) => {
    if (!textSelection?.text) return;
    try {
      const response = await fetch('/api/reader-hub', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'reaction',
          visitorKey: getVisitorKey(),
          bookId: book.id,
          chapterId: chapter.id,
          paragraphIndex: textSelection.paragraphIndex,
          selectedText: textSelection.text,
          emoji,
        }),
      });
      if (!response.ok) throw new Error('Не удалось поставить реакцию.');
      clearTextSelection();
      await refreshReaderHub();
      setToast(`Реакция ${emoji} сохранена`);
    } catch (error) {
      setToast(error.message);
    }
  }, [book.id, chapter.id, clearTextSelection, refreshReaderHub, textSelection]);

  const openDictionaryDraft = useCallback(() => {
    if (!textSelection?.text) return;
    setDictionaryDraft({ word: textSelection.text.slice(0, 240), meaning: '', quote: textSelection.text });
    clearTextSelection();
    setPanel('dictionary-edit');
  }, [clearTextSelection, textSelection]);

  const saveDictionaryEntry = useCallback(async () => {
    if (!dictionaryDraft?.word?.trim()) return;
    setExtraSaving(true);
    try {
      const response = await fetch('/api/reader-hub', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'dictionary',
          visitorKey: getVisitorKey(),
          bookId: book.id,
          chapterId: chapter.id,
          ...dictionaryDraft,
        }),
      });
      if (!response.ok) throw new Error('Не удалось сохранить слово.');
      setDictionaryDraft(null);
      await refreshReaderHub();
      setPanel('dictionary');
      setToast('Слово добавлено в личный словарь');
    } catch (error) {
      setToast(error.message);
    } finally {
      setExtraSaving(false);
    }
  }, [book.id, chapter.id, dictionaryDraft, refreshReaderHub]);

  const deleteDictionaryEntry = useCallback(async (id) => {
    await fetch('/api/reader-hub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'deleteDictionary', visitorKey: getVisitorKey(), id }),
    }).catch(() => {});
    refreshReaderHub();
  }, [refreshReaderHub]);

  const saveChapterEmotion = useCallback(async (emoji) => {
    try {
      const response = await fetch('/api/reader-hub', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'emotion', visitorKey: getVisitorKey(), bookId: book.id, chapterId: chapter.id, emoji }),
      });
      if (!response.ok) throw new Error('Не удалось сохранить эмоцию.');
      await refreshReaderHub();
      setToast(`Эмоция главы ${emoji} сохранена`);
    } catch (error) {
      setToast(error.message);
    }
  }, [book.id, chapter.id, refreshReaderHub]);

  const stopAmbientSound = useCallback(() => {
    const context = ambientAudioRef.current;
    ambientAudioRef.current = null;
    setAmbientSound('');
    context?.close?.().catch?.(() => {});
  }, []);

  const stopChapterMusic = useCallback(() => {
    chapterAudioRef.current?.pause?.();
    setChapterMusicPlaying(false);
  }, []);

  const toggleChapterMusic = useCallback(async () => {
    const audio = chapterAudioRef.current;
    if (!audio || !chapter.musicUrl) return;
    if (!audio.paused) {
      stopChapterMusic();
      return;
    }
    stopAmbientSound();
    try {
      audio.volume = chapterMusicVolume;
      await audio.play();
      setChapterMusicPlaying(true);
    } catch {
      setChapterMusicPlaying(false);
      setToast('Не удалось включить музыку. Проверьте подключение и попробуйте ещё раз.');
    }
  }, [chapter.musicUrl, chapterMusicVolume, stopAmbientSound, stopChapterMusic]);

  const toggleAmbientSound = useCallback((kind) => {
    if (ambientSound === kind) {
      stopAmbientSound();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      setToast('Этот браузер не поддерживает фоновые звуки.');
      return;
    }
    stopChapterMusic();
    const previous = ambientAudioRef.current;
    previous?.close?.().catch?.(() => {});
    const context = new AudioContext();
    const duration = 3;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const noise = Math.random() * 2 - 1;
      data[index] = kind === 'fire' ? noise * (Math.random() > .985 ? .9 : .12) : noise;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = kind === 'rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = kind === 'rain' ? 1200 : kind === 'forest' ? 900 : 520;
    gain.gain.value = kind === 'rain' ? .035 : kind === 'forest' ? .018 : .045;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    ambientAudioRef.current = context;
    setAmbientSound(kind);
  }, [ambientSound, stopAmbientSound, stopChapterMusic]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node || !measurementReady) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (settings.motion === 'scroll') {
        const maximum = Math.max(0, (node.firstElementChild?.offsetHeight ?? node.scrollHeight) - node.clientHeight);
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
    const maximum = (node.firstElementChild?.offsetHeight ?? node.scrollHeight) - node.clientHeight;
    const ratio = maximum > 0 ? Math.min(1, node.scrollTop / maximum) : node.scrollTop > 0 ? 1 : 0;
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

  const openBookmarkDraft = (source = null) => {
    setBookmarkDraft({
      category: 'later',
      quote: source?.text || '',
      paragraphIndex: Number(source?.paragraphIndex || 0),
      page: Number(source?.page ?? page),
    });
    clearTextSelection();
    setPanel('bookmark');
  };

  const saveBookmark = async () => {
    if (!bookmarkDraft) return;
    setExtraSaving(true);
    try {
      const response = await fetch('/api/reader-bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          visitorKey: getVisitorKey(),
          bookId: book.id,
          chapterId: chapter.id,
          ...bookmarkDraft,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить закладку.');
      setBookmarks((current) => [{
        ...data.bookmark,
        chapterNumber: chapter.chapterNumber,
        chapterTitle: chapter.title,
      }, ...current]);
      setBookmarkDraft(null);
      setPanel('bookmarks');
      setToast('Закладка сохранена');
    } catch (error) {
      setToast(error.message);
    } finally {
      setExtraSaving(false);
    }
  };

  const deleteBookmark = async (bookmark) => {
    setExtraSaving(true);
    try {
      const query = new URLSearchParams({ visitorKey: getVisitorKey(), id: bookmark.id });
      const response = await fetch(`/api/reader-bookmarks?${query.toString()}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Не удалось удалить закладку.');
      setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
      setToast('Закладка удалена');
    } catch (error) {
      setToast(error.message);
    } finally {
      setExtraSaving(false);
    }
  };

  const toggleBookmark = () => {
    if (currentPageBookmark) {
      deleteBookmark(currentPageBookmark);
      return;
    }
    openBookmarkDraft();
  };

  const openErrorDraft = () => {
    if (!textSelection) return;
    setErrorDraft({
      category: 'typo',
      selectedText: textSelection.text,
      paragraphIndex: textSelection.paragraphIndex,
      page: textSelection.page,
      details: '',
    });
    clearTextSelection();
    setPanel('report-error');
  };

  const submitErrorReport = async () => {
    if (!errorDraft) return;
    setExtraSaving(true);
    try {
      const response = await fetch('/api/reader-errors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          visitorKey: getVisitorKey(),
          bookId: book.id,
          chapterId: chapter.id,
          ...errorDraft,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось отправить сообщение.');
      setErrorDraft(null);
      setPanel(null);
      setToast(errorDraft.scope === 'chapter' ? 'Жалоба отправлена команде Booknerd.' : 'Спасибо! Предложение отправлено команде Booknerd.');
    } catch (error) {
      setToast(error.message);
    } finally {
      setExtraSaving(false);
    }
  };

  const sharePage = async () => {
    const chapterUrl = new URL(window.location.pathname, window.location.origin).href;
    const shareData = { title: `${book.title} — ${chapter.title}`, text: `Читаю «${book.title}» на BOOKNERD`, url: chapterUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(chapterUrl);
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
    if (settings.motion !== 'scroll') setPage(Math.max(0, currentChapterPages - 1));
    window.setTimeout(() => document.getElementById(`comments-${chapter.id}`)?.scrollIntoView({ behavior: 'smooth' }), 80);
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

  const chapterComments = (
    <section id="chapter-comments" className="reader-discussion-wrap">
      <div className="reader-chapter-end-content">
        {!supportDismissed && (supportCard || supportLinks.length > 0) && <section className="reader-chapter-support">
          <button type="button" className="reader-support-close" aria-label="Скрыть блок поддержки" onClick={() => setSupportDismissed(true)}><X size={19} /></button>
          <div className="reader-support-message"><p>Мур! Если хотите порадовать нас шоколадкой, то вот наши реквизиты</p><PurpleCat /></div>
          <h2>Подкормите котика переводчиков</h2>
          {supportCard && <details className="reader-support-card"><summary>Перевод на карту</summary><p>{supportCard.replace(/(.{4})(?=.)/g, '$1 ')}</p>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(supportCard); setToast('Номер карты скопирован'); } catch { setToast('Выделите номер и скопируйте его вручную.'); } }}>Скопировать номер</button>
          </details>}
          <div>{supportLinks.map(({ label, url }) => <a key={label} href={url} target="_blank" rel="noreferrer">{label}</a>)}</div>
        </section>}
        <nav className="reader-chapter-end" aria-label="Переход между главами">
          {previous && <a href={`/books/${book.slug}/chapters/${previous.id}`}><small><ArrowLeft size={15} /> Назад</small><strong>Глава {previous.chapterNumber}</strong></a>}
          {next
            ? <button type="button" onClick={() => goToNextChapter()}><small>Дальше <ArrowRight size={15} /></small><strong>Глава {next.chapterNumber}</strong></button>
            : <button type="button" onClick={() => goToNextChapter()}><strong>Завершить чтение</strong></button>}
        </nav>
        <div className="reader-chapter-actions">
          <button className="reader-chapter-like" type="button" aria-label="Нравится глава" aria-pressed={chapterLike.liked} disabled={!likeReady || likeSaving} onClick={toggleChapterLike}><Heart size={19} fill={chapterLike.liked ? 'currentColor' : 'none'} /> {chapterLike.total}</button>
          <button type="button" onClick={openComments}><MessageCircle size={19} /> Комментарии{commentCount !== null && ` · ${commentCount}`}</button>
          <button type="button" className="reader-chapter-report" onClick={() => { setErrorDraft({ scope: 'chapter', category: 'other', page, details: '' }); setPanel('report-error'); }}><Flag size={17} /> Пожаловаться</button>
        </div>
        <div className="reader-chapter-shortcuts">
          <a href={`/books/${book.slug}`}><BookOpen size={20} /> К книге</a>
          <button type="button" onClick={sharePage}><Share2 size={20} /> Поделиться</button>
        </div>
      <CommentsSection bookId={book.id} chapterId={chapter.id} onCountChange={setCommentCount} key={chapter.id} />
        {[['Рекомендуем вам', recommendations], ['Похожие по жанрам', similar]].map(([title, items]) => items.length > 0 &&
          <section className="reader-chapter-recommendations" key={title}>
            <h2>{title}</h2><div className="shelf-row" tabIndex={0} role="region" aria-label={title}>
              {items.map((item) => <ShelfBook key={item.id} book={item} badge={item.ageRating === 18 ? '18+' : undefined} />)}
            </div>
          </section>
        )}
      </div>
      {chapter.teamNote && (
        <aside className="chapter-team-note">
          <span>✦</span>
          <div><small>ЗАМЕТКА КОМАНДЫ</small><p>{chapter.teamNote}</p></div>
        </aside>
      )}

    </section>
  );

  useLayoutEffect(() => {
    const page = document.querySelector('.reader-modern');
    if (!page) return;
    const color = getComputedStyle(page).getPropertyValue('--reader-page').trim();
    const nodes = [document.documentElement, document.body];
    const previous = nodes.map(node => node.style.backgroundColor);
    const meta = document.querySelector('meta[name="theme-color"]');
    const oldMeta = meta?.content;
    nodes.forEach(node => node.style.setProperty('background-color', color, 'important'));
    if (meta) meta.content = color;
    return () => { nodes.forEach((node, i) => { node.style.removeProperty('background-color'); if (previous[i]) node.style.backgroundColor = previous[i]; }); if (meta) meta.content = oldMeta; };
  }, [settings.theme]);

  return (
    <main className="reader-page reader-modern" data-reader-theme={settings.theme} data-reader-chrome={chromeHidden ? 'hidden' : 'visible'} style={fontStyle}>
      <section
        className="reader-experience"
        data-reading-mode={settings.motion}
        aria-label={`Читалка: ${book.title}. Дважды нажмите на текст, чтобы скрыть или вернуть элементы управления.`}
        onPointerDown={startReaderTap}
        onPointerUp={finishReaderTap}
        onPointerCancel={() => { readerTap.current.tracking = false; }}
        onDoubleClick={(event) => event.preventDefault()}
      >
        <header className="reader-compact-header">
          <div className="reader-compact-progress" role="progressbar" aria-label="Прогресс чтения книги" aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>
          <a href={`/books/${book.slug}`} aria-label="К странице книги"><ArrowLeft size={21} /></a>
          <div className="reader-compact-title"><strong>{book.title}</strong><small>Глава {chapter.chapterNumber}</small></div>
          <button type="button" onClick={() => updateReaderTheme(settings.theme === 'night' ? 'paper' : 'night')} aria-label="Переключить тему">{settings.theme === 'night' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button type="button" onClick={() => setPanel('settings')} aria-label="Настройки чтения">Аа</button>
          <button type="button" onClick={() => setPanel('book-glossary')} aria-label="Словарь книги"><BookMarked size={19} /></button>
          <button type="button" onClick={() => setPanel('menu')} aria-label="Меню читалки"><Menu size={19} /></button>
        </header>
        {chapter.musicUrl ? <audio ref={chapterAudioRef} src={chapter.musicUrl} preload="metadata" onPlay={() => setChapterMusicPlaying(true)} onPause={() => setChapterMusicPlaying(false)} onEnded={() => setChapterMusicPlaying(false)} /> : null}

        <div className="reader-stage">
          <div className="reader-pages-left" aria-live="polite">
            {!measurementReady ? 'Считаем страницы…' : pagesLeftInChapter > 0 ? `Осталось ${pagesLeftInChapter} стр. · около ${estimatedMinutesLeft >= 60 ? `${Math.floor(estimatedMinutesLeft / 60)} ч ${estimatedMinutesLeft % 60} мин` : `${estimatedMinutesLeft} мин`} до конца книги` : 'Последняя страница главы'}
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
              <div className="reader-column-flow reader-visible-flow" style={settings.motion === 'scroll' ? { width: '100%', height: 'auto', columnCount: 'auto', columnWidth: 'auto', transform: 'none' } : { ...flowStyle, transform: `translate3d(-${page * dimensions.width}px, 0, 0)` }}>
                <ChapterFlow
                  book={book}
                  chapter={chapter}
                  showDriveLink
                  commentCount={commentCount}
                  onOpenComments={openComments}
                  annotations={chapterAnnotations}
                  onOpenAnnotation={openAnnotation}
                  onOpenFootnote={openFootnote}
                  onSelectionEnd={captureTextSelection}
                />
              </div>
            </div>
            {settings.motion === 'scroll' ? chapterComments : null}
          </div>
          <button type="button" className="reader-page-arrow reader-page-arrow-right" onClick={goForward} aria-label="Следующая страница"><ArrowRight size={22} /></button>
        </div>

        <footer className="reader-page-footer reader-chapter-toolbar">
          <button type="button" onClick={settings.motion === 'scroll' && previous ? () => { window.location.href = `/books/${book.slug}/chapters/${previous.id}`; } : goBackward} disabled={!previous && (settings.motion === 'scroll' || page === 0)}><ArrowLeft size={19} /><span>Назад</span></button>
          <button type="button" onClick={() => setPanel('contents')}><List size={19} /><span>Главы</span></button>
          <button type="button" aria-pressed={chapterLike.liked} disabled={!likeReady || likeSaving} onClick={toggleChapterLike}><Heart size={19} fill={chapterLike.liked ? 'currentColor' : 'none'} /><span>Нравится</span></button>
          <button type="button" onClick={openComments}><MessageCircle size={19} /><span>Комментарии</span></button>
          <button type="button" onClick={settings.motion === 'scroll' && next ? () => goToNextChapter(page >= currentChapterPages - 1 && measurementReady) : goForward}><ArrowRight size={19} /><span>Далее</span></button>
        </footer>
        <div className="reader-dimmer" aria-hidden="true" style={{ opacity: ((100 - settings.brightness) / 100) * .58 }} />
      </section>

      <div className="reader-measure-layer" aria-hidden="true">
        {dimensions.width && dimensions.height ? (settings.motion === 'scroll' ? [chapter] : chapterList).map((item) => (
          <div
            className="reader-column-flow reader-measure-flow"
            key={item.id}
            ref={(node) => {
              if (node) measureRefs.current.set(item.id, node);
              else measureRefs.current.delete(item.id);
            }}
            style={flowStyle}
          >
            <ChapterFlow
              book={book}
              chapter={item}
              showDriveLink
              measuring
              commentCount={item.id === chapter.id ? commentCount : null}
              annotations={annotations.filter((annotation) => annotation.chapterId === item.id)}
            />
          </div>
        )) : null}
      </div>

      {settings.motion !== 'scroll' && page >= currentChapterPages - 1 && measurementReady ? chapterComments : null}

      <SelectionAnnotationBar
        selection={textSelection}
        onHighlight={(color) => addAnnotation(textSelection, { color })}
        onNote={openNewNote}
        onSticker={(sticker) => addAnnotation(textSelection, { color: '#fff1a8', sticker })}
        onReaction={reactToSelection}
        onDictionary={openDictionaryDraft}
        onBookmark={() => openBookmarkDraft(textSelection)}
        onReport={openErrorDraft}
        onTranslate={translateSelectedText}
        onSearch={searchSelectedText}
        onCopy={copySelectedText}
        onShare={shareSelectedText}
        onClose={clearTextSelection}
      />

      {panel === 'footnote' && activeFootnote ? (
        <ReaderSheet title={activeFootnote.term} eyebrow={`Сноска ${activeFootnote.number}`} onClose={() => { setActiveFootnote(null); setPanel(null); }}>
          <div className="reader-footnote-sheet">
            <span>{activeFootnote.number}</span>
            <p>{activeFootnote.explanation}</p>
            <small>Пояснение от команды BOOKNERD</small>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'menu' ? (
        <ReaderSheet title="Меню чтения" eyebrow={`${currentBookPage} из ${totalBookPages}`} onClose={() => setPanel(null)}>
          <div className="reader-menu-list">
            <button type="button" onClick={() => setPanel('book-glossary')}><BookMarked size={22} /><span><strong>Словарь книги</strong><small>Слова, персонажи и пояснения команды</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('contents')}><List size={22} /><span><strong>Содержание</strong><small>Все главы книги</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('search')}><Search size={22} /><span><strong>Поиск по книге</strong><small>Найти слово во всех главах</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('annotations')}><Highlighter size={22} /><span><strong>Мои пометки</strong><small>{annotations.length ? `${annotations.length} сохранено` : 'Выделения, заметки и стикеры'}</small></span><ChevronRight size={18} /></button>
            {book.worldMapUrl ? <button type="button" onClick={() => setPanel('world-map')}><MapIcon size={22} /><span><strong>Карта мира</strong><small>Открыть поверх чтения и закрыть одним нажатием</small></span><ChevronRight size={18} /></button> : null}
            <button type="button" onClick={() => setPanel('chapter-map')}><MapIcon size={22} /><span><strong>Мини‑карта главы</strong><small>Все пометки и эмоции по ходу текста</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('dictionary')}><BookMarked size={22} /><span><strong>Личный словарь</strong><small>{readerHub.dictionary.length ? `${readerHub.dictionary.length} слов` : 'Незнакомые слова и пояснения'}</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('bookmarks')}><Bookmark size={22} /><span><strong>Мои закладки</strong><small>{bookmarks.length ? `${bookmarks.length} сохранено` : 'Любимое, важное и смешное'}</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('atmosphere')}><Music2 size={22} /><span><strong>Атмосфера чтения</strong><small>Музыка, дождь, лес или камин</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => { setPanel(null); setChromeHidden(true); }}><Film size={22} /><span><strong>Режим кино</strong><small>Оставить на экране только текст</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('reading-mode')}><ReadingModeIcon mode={settings.motion} size={22} /><span><strong>Способ чтения</strong><small>{READING_MODE_OPTIONS.find((mode) => mode.id === settings.motion)?.name}</small></span><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPanel('settings')}><SlidersHorizontal size={22} /><span><strong>Темы и настройки</strong><small>Шрифт, размер, фон и яркость</small></span><ChevronRight size={18} /></button>
            <a href="/go/telegram" target="_blank" rel="noreferrer"><ExternalLink size={22} /><span><strong>Telegram BOOKNERD</strong><small>@booknerd_tr</small></span><ChevronRight size={18} /></a>
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
            <div><small>{book.author}</small><strong>{book.title}</strong><span>{readerChapterTitle(chapter)}</span></div>
          </div>
          <div className="reader-contents-list">
            {chapterList.map((item, index) => {
              const startsAt = pageCounts.slice(0, index).reduce((total, count) => total + count, 0) + 1;
              return (
                <a className={item.id === chapter.id ? 'is-current' : ''} href={`/books/${book.slug}/chapters/${item.id}`} key={item.id}>
                  <span><strong>{readerChapterTitle(item)}</strong></span>
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
                <strong>{readerChapterTitle(result)}</strong><span>{result.snippet}</span>
              </a>
            ))}
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'world-map' && book.worldMapUrl ? (
        <ReaderSheet title="Карта мира" eyebrow={book.title} onClose={() => setPanel(null)} wide>
          <WorldMapViewer url={book.worldMapUrl} title={book.title} />
        </ReaderSheet>
      ) : null}

      {panel === 'chapter-map' ? (
        <ReaderSheet title="Мини‑карта главы" eyebrow={readerChapterTitle(chapter)} onClose={() => setPanel('menu')} wide>
          <div className="reader-mini-map">
            <div className="reader-mini-map-track" aria-hidden="true">
              {[...chapterAnnotations, ...readerHub.reactions.map((reaction) => ({
                id: `reaction-${reaction.id}`,
                paragraphIndex: reaction.paragraph_index,
                color: '#ec8dad',
              }))].map((item) => (
                <i
                  style={{ top: `${clamp(((Number(item.paragraphIndex) || 0) / Math.max(1, chapterBlockCount)) * 100, 1, 98)}%`, '--map-color': item.color || '#7fa889' }}
                  key={item.id}
                />
              ))}
            </div>
            <div className="reader-mini-map-copy">
              <strong>{chapterAnnotations.length} пометок · {readerHub.reactions.length} реакций</strong>
              <p>Метки показывают, где в главе вы оставляли заметки, стикеры и эмоции.</p>
              {!chapterAnnotations.length && !readerHub.reactions.length ? <span>Выделите любой фрагмент текста — даже несколько абзацев или всю страницу.</span> : null}
              {chapterAnnotations.map((annotation) => (
                <button type="button" onClick={() => { setPage(clamp(Number(annotation.page) || 0, 0, currentChapterPages - 1)); setActiveAnnotationId(annotation.id); setPanel('annotation'); }} key={annotation.id}>
                  <i style={{ '--map-color': annotation.color || '#ffe066' }} />
                  <span><small>{Math.round(((Number(annotation.paragraphIndex) || 0) / Math.max(1, chapterBlockCount)) * 100)}% главы</small><strong>“{annotation.text.slice(0, 110)}{annotation.text.length > 110 ? '…' : ''}”</strong></span>
                </button>
              ))}
            </div>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'book-glossary' ? <ReaderSheet title="Словарь книги" eyebrow={book.title} onClose={() => setPanel(null)} wide><BookGlossary bookId={book.id} embedded /></ReaderSheet> : null}

      {panel === 'dictionary' ? (
        <ReaderSheet title="Личный словарь" eyebrow={`${readerHub.dictionary.length} сохранено`} onClose={() => setPanel('menu')} wide>
          {!readerHub.dictionary.length ? (
            <div className="reader-annotation-empty"><BookMarked size={31} /><strong>Словарь пока пуст</strong><span>Выделите слово или фразу и выберите «В словарь».</span></div>
          ) : (
            <div className="reader-dictionary-list">
              {readerHub.dictionary.map((entry) => (
                <article key={entry.id}>
                  <div><small>{entry.chapter_title || readerChapterTitle(chapter)}</small><strong>{entry.word}</strong><p>{entry.meaning || 'Пояснение можно добавить позже.'}</p>{entry.quote ? <blockquote>“{entry.quote}”</blockquote> : null}</div>
                  <button type="button" onClick={() => deleteDictionaryEntry(entry.id)} aria-label="Удалить из словаря"><Trash2 size={17} /></button>
                </article>
              ))}
            </div>
          )}
        </ReaderSheet>
      ) : null}

      {panel === 'dictionary-edit' && dictionaryDraft ? (
        <ReaderSheet title="Добавить в словарь" eyebrow="Личная запись" onClose={() => { setDictionaryDraft(null); setPanel(null); }}>
          <div className="reader-dictionary-editor">
            <label><span>Слово или выражение</span><input value={dictionaryDraft.word} onChange={(event) => setDictionaryDraft((current) => ({ ...current, word: event.target.value }))} /></label>
            <label><span>Значение</span><textarea rows="5" value={dictionaryDraft.meaning} onChange={(event) => setDictionaryDraft((current) => ({ ...current, meaning: event.target.value }))} placeholder="Запишите перевод или объяснение своими словами…" /></label>
            <button className="reader-sheet-primary" type="button" disabled={extraSaving} onClick={saveDictionaryEntry}>{extraSaving ? 'Сохраняем…' : 'Сохранить в словарь'}</button>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'atmosphere' ? (
        <ReaderSheet title="Атмосфера чтения" eyebrow="Звук можно выключить в любой момент" onClose={() => setPanel('menu')}>
          <div className="reader-atmosphere-panel">

            {book.playlistUrl ? <a href={book.playlistUrl} target="_blank" rel="noreferrer"><Music2 size={22} /><span><strong>Плейлист книги</strong><small>Открыть музыкальную подборку команды</small></span><ExternalLink size={17} /></a> : null}
            {[['rain', 'Дождь', 'Мягкий шум за окном'], ['forest', 'Лес', 'Тихая природная атмосфера'], ['fire', 'Камин', 'Тёплое потрескивание']].map(([id, title, description]) => (
              <button type="button" className={ambientSound === id ? 'is-active' : ''} onClick={() => toggleAmbientSound(id)} key={id}>
                {ambientSound === id ? <VolumeX size={22} /> : <Volume2 size={22} />}
                <span><strong>{title}</strong><small>{ambientSound === id ? 'Нажмите, чтобы выключить' : description}</small></span>
              </button>
            ))}
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'bookmarks' ? (
        <ReaderSheet title="Мои закладки" eyebrow={`${bookmarks.length} в этой книге`} onClose={() => setPanel('menu')} wide>
          <div className="reader-bookmark-sheet-head">
            <p>Закладки сохраняют не только страницу, но и выбранную фразу с её смыслом.</p>
            <button type="button" onClick={() => openBookmarkDraft()}><Plus size={17} /> Закладка на текущем месте</button>
          </div>
          {!bookmarks.length ? (
            <div className="reader-annotation-empty"><Bookmark size={31} /><strong>Закладок пока нет</strong><span>Выделите фразу или сохраните текущую страницу.</span></div>
          ) : (
            <div className="reader-bookmark-list">
              {bookmarks.map((bookmark) => {
                const category = BOOKMARK_CATEGORIES.find((item) => item.id === bookmark.category) || BOOKMARK_CATEGORIES[1];
                return (
                  <article key={bookmark.id}>
                    <a href={`/books/${book.slug}/chapters/${bookmark.chapterId}?page=${Number(bookmark.page || 0) + 1}`} style={{ '--bookmark-color': category.color }}>
                      <span>{category.symbol}</span>
                      <div><small>{category.label} · {readerChapterTitle({ title: bookmark.chapterTitle, chapterNumber: bookmark.chapterNumber })}</small><strong>{bookmark.quote ? `“${bookmark.quote}”` : manualChapterTitle({ title: bookmark.chapterTitle, chapterNumber: bookmark.chapterNumber }) || 'Сохранённое место'}</strong></div>
                      <ChevronRight size={17} />
                    </a>
                    <button type="button" onClick={() => deleteBookmark(bookmark)} disabled={extraSaving} aria-label="Удалить закладку"><Trash2 size={16} /></button>
                  </article>
                );
              })}
            </div>
          )}
        </ReaderSheet>
      ) : null}

      {panel === 'bookmark' && bookmarkDraft ? (
        <ReaderSheet title="Новая закладка" eyebrow={bookmarkDraft.quote ? 'Выбранная фраза' : `${readerChapterTitle(chapter)} · страница ${bookmarkDraft.page + 1}`} onClose={() => { setBookmarkDraft(null); setPanel(null); }}>
          <div className="reader-bookmark-editor">
            {bookmarkDraft.quote ? <blockquote>“{bookmarkDraft.quote}”</blockquote> : <p>Сохранить это место, чтобы быстро вернуться позже.</p>}
            <div>
              {BOOKMARK_CATEGORIES.map((category) => (
                <button className={bookmarkDraft.category === category.id ? 'is-active' : ''} style={{ '--bookmark-color': category.color }} type="button" onClick={() => setBookmarkDraft({ ...bookmarkDraft, category: category.id })} key={category.id}>
                  <span>{category.symbol}</span><strong>{category.label}</strong>{bookmarkDraft.category === category.id ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
            <button className="reader-sheet-primary" type="button" onClick={saveBookmark} disabled={extraSaving}>{extraSaving ? 'Сохраняем…' : 'Сохранить закладку'}</button>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'report-error' && errorDraft ? (
        <ReaderSheet title={errorDraft.scope === 'chapter' ? 'Пожаловаться на главу' : 'Предложить правку'} eyebrow={`${readerChapterTitle(chapter)} · страница ${errorDraft.page + 1}`} onClose={() => { setErrorDraft(null); setPanel(null); }} wide>
          <div className="reader-error-report">
            {errorDraft.selectedText && <blockquote>“{errorDraft.selectedText}”</blockquote>}
            <p>{errorDraft.scope === 'chapter' ? 'Опишите проблему, и команда Booknerd получит сообщение.' : 'Команда сразу увидит книгу, главу, страницу и точный фрагмент.'}</p>
            <div>
              {ERROR_CATEGORIES.map((category) => (
                <label className={errorDraft.category === category.id ? 'is-active' : ''} key={category.id}>
                  <input type="radio" name="reader-error-category" checked={errorDraft.category === category.id} onChange={() => setErrorDraft({ ...errorDraft, category: category.id })} />
                  <span>{errorDraft.category === category.id ? <Check size={14} /> : null}</span><strong>{category.label}</strong>
                </label>
              ))}
            </div>
            <label><span>{errorDraft.scope === 'chapter' ? 'Причина жалобы' : 'Комментарий к правке'}</span><textarea rows="4" maxLength="2000" value={errorDraft.details} onChange={(event) => setErrorDraft({ ...errorDraft, details: event.target.value })} placeholder={errorDraft.scope === 'chapter' ? 'Что случилось?' : 'Напишите правильный вариант или объясните, что нужно исправить…'} /></label>
            <button className="reader-sheet-primary" type="button" onClick={submitErrorReport} disabled={extraSaving || (errorDraft.scope === 'chapter' && !errorDraft.details.trim())}>{extraSaving ? 'Отправляем…' : errorDraft.scope === 'chapter' ? 'Отправить жалобу' : 'Отправить правку'}</button>
          </div>
        </ReaderSheet>
      ) : null}

      {panel === 'annotations' ? (
        <ReaderSheet title="Мои пометки" eyebrow={`${annotations.length} в этой книге`} onClose={() => setPanel('menu')} wide>
          <p className="reader-annotation-intro">Выделения, личные заметки и стикеры хранятся только на этом устройстве.</p>
          {!annotations.length ? (
            <div className="reader-annotation-empty">
              <Highlighter size={31} />
              <strong>Пометок пока нет</strong>
              <span>Выделите фразу в тексте — появится меню аннотирования.</span>
            </div>
          ) : (
            <div className="reader-annotation-list">
              {[...annotations].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt))).map((annotation) => {
                const content = (
                  <>
                    <span className="reader-annotation-list-icon" style={{ '--annotation-color': annotation.color || '#ffe066' }}>
                      {annotation.sticker ? <ReaderSticker stickerId={annotation.sticker} size={48} /> : annotation.note ? <StickyNote size={21} /> : <Highlighter size={21} />}
                    </span>
                    <span className="reader-annotation-list-copy">
                      <small>{readerChapterTitle({ title: annotation.chapterTitle, chapterNumber: annotation.chapterNumber })}</small>
                      <strong>“{annotation.text}”</strong>
                      {annotation.note ? <em>{annotation.note}</em> : null}
                    </span>
                    <ChevronRight size={18} />
                  </>
                );
                return annotation.chapterId === chapter.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(clamp(Number(annotation.page) || 0, 0, Math.max(0, currentChapterPages - 1)));
                      setActiveAnnotationId(annotation.id);
                      setPanel('annotation');
                    }}
                    key={annotation.id}
                  >
                    {content}
                  </button>
                ) : (
                  <a href={`/books/${book.slug}/chapters/${annotation.chapterId}?page=${Number(annotation.page || 0) + 1}`} key={annotation.id}>
                    {content}
                  </a>
                );
              })}
            </div>
          )}
        </ReaderSheet>
      ) : null}

      {panel === 'annotation' ? (
        <ReaderSheet title="Пометка" eyebrow={activeAnnotation ? readerChapterTitle({ title: activeAnnotation.chapterTitle, chapterNumber: activeAnnotation.chapterNumber }) : 'Моя пометка'} onClose={() => setPanel('annotations')}>
          {activeAnnotation ? (
            <div className="reader-annotation-detail">
              <blockquote style={{ '--annotation-color': activeAnnotation.color || '#ffe066' }}>“{activeAnnotation.text}”</blockquote>
              <section>
                <small>Цвет выделения</small>
                <div className="reader-annotation-colors">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      type="button"
                      className={activeAnnotation.color === color.value ? 'is-active' : ''}
                      style={{ '--swatch': color.value }}
                      onClick={() => updateAnnotation(activeAnnotation.id, { color: color.value })}
                      aria-label={color.name}
                      title={color.name}
                      key={color.id}
                    >{activeAnnotation.color === color.value ? <Check size={14} /> : null}</button>
                  ))}
                </div>
              </section>
              {activeAnnotation.sticker ? (
                <div className="reader-annotation-sticker-card">
                  <ReaderSticker stickerId={activeAnnotation.sticker} size={76} />
                  <span><small>Эмоция</small><strong>{stickerById(activeAnnotation.sticker)?.name}</strong></span>
                </div>
              ) : null}
              <section className="reader-annotation-note-card">
                <small>Личная заметка</small>
                <p>{activeAnnotation.note || 'К этой фразе ещё нет заметки.'}</p>
                {activeAnnotation.publicNote ? <em>{activeAnnotation.publicSpoiler ? 'Отмечена как спойлер и не показывается на главной' : 'Предложена редакции для «Цитаты дня»'}</em> : null}
              </section>
              <div className="reader-annotation-detail-actions">
                <button type="button" onClick={() => openEditNote(activeAnnotation)}><StickyNote size={18} /> Изменить заметку и стикер</button>
                <button type="button" className="is-danger" onClick={() => deleteAnnotation(activeAnnotation.id)}><Trash2 size={18} /> Удалить пометку</button>
              </div>
            </div>
          ) : (
            <div className="reader-annotation-empty"><Highlighter size={31} /><strong>Пометка не найдена</strong></div>
          )}
        </ReaderSheet>
      ) : null}

      {panel === 'annotation-note' && noteDraft ? (
        <ReaderSheet title={noteDraft.mode === 'edit' ? 'Изменить пометку' : 'Добавить заметку'} eyebrow="Личная аннотация" onClose={() => { setNoteDraft(null); setPanel(noteDraft.mode === 'edit' ? 'annotation' : null); }} wide>
          <div className="reader-note-editor">
            <blockquote style={{ '--annotation-color': noteDraft.color || '#ffe066' }}>“{noteDraft.text}”</blockquote>
            <label>
              <span>Ваша заметка</span>
              <textarea
                autoFocus
                rows="5"
                maxLength="2000"
                value={noteDraft.note || ''}
                onChange={(event) => setNoteDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="Запишите мысль, теорию или любимую цитату…"
              />
              <small>{String(noteDraft.note || '').length} / 2000</small>
            </label>
            <section>
              <span>Цвет выделения</span>
              <div className="reader-annotation-colors">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    type="button"
                    className={noteDraft.color === color.value ? 'is-active' : ''}
                    style={{ '--swatch': color.value }}
                    onClick={() => setNoteDraft((current) => ({ ...current, color: color.value }))}
                    aria-label={color.name}
                    title={color.name}
                    key={color.id}
                  >{noteDraft.color === color.value ? <Check size={14} /> : null}</button>
                ))}
              </div>
            </section>
            <section>
              <div className="reader-note-sticker-heading"><span>Стикер‑эмоция</span>{noteDraft.sticker ? <button type="button" onClick={() => setNoteDraft((current) => ({ ...current, sticker: '' }))}>Убрать</button> : null}</div>
              <StickerPicker value={noteDraft.sticker || ''} onSelect={(sticker) => setNoteDraft((current) => ({ ...current, sticker: current.sticker === sticker ? '' : sticker }))} />
            </section>
            <section className="reader-public-note-consent">
              <label>
                <input type="checkbox" checked={noteDraft.publicNote === true} onChange={(event) => setNoteDraft((current) => ({ ...current, publicNote: event.target.checked, publicSpoiler: event.target.checked ? current.publicSpoiler : false }))} />
                <span><strong>Предложить для «Цитаты дня»</strong><small>Редакция увидит выделенную фразу, эту заметку и ваш псевдоним. Без галочки всё останется только на этом устройстве.</small></span>
              </label>
              {noteDraft.publicNote ? (
                <label>
                  <input type="checkbox" checked={noteDraft.publicSpoiler === true} onChange={(event) => setNoteDraft((current) => ({ ...current, publicSpoiler: event.target.checked }))} />
                  <span><strong>Здесь есть спойлер</strong><small>Такая заметка сохранится для редакции, но не появится на главной.</small></span>
                </label>
              ) : null}
            </section>
            <div className="reader-note-editor-actions">
              <button type="button" onClick={() => { setNoteDraft(null); setPanel(noteDraft.mode === 'edit' ? 'annotation' : null); }}>Отмена</button>
              <button type="button" className="is-primary" onClick={saveNoteDraft}><Check size={18} /> Сохранить пометку</button>
            </div>
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
              <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize - 1, 14, 30))}>A−</button>
              <span>{settings.fontSize}px</span>
              <button type="button" onClick={() => updateSetting('fontSize', clamp(settings.fontSize + 1, 14, 30))}>A+</button>
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
              <button type="button" data-theme-preview={theme.id} className={settings.theme === theme.id ? 'is-active' : ''} onClick={() => updateReaderTheme(theme.id)} key={theme.id}>
                <strong>{theme.sample}</strong><span>{theme.name}</span>{settings.theme === theme.id ? <Check size={17} /> : null}
              </button>
            ))}
          </section>

          <section className="reader-app-theme-settings">
            <div className="reader-settings-heading"><Palette size={21} /><span><small>Цвет приложения</small><strong>Оформление всех страниц BOOKNERD</strong></span></div>
            <div>
              {APP_THEME_OPTIONS.map(({ id, label, Icon }) => (
                <button type="button" className={getStoredAppTheme() === id ? 'is-active' : ''} onClick={() => updateAppTheme(id)} key={id}>
                  <Icon size={19} /><span>{label}</span>{getStoredAppTheme() === id ? <Check size={16} /> : null}
                </button>
              ))}
            </div>
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

      {showCompletion ? (
        <ReaderSheet
          title={next ? 'Глава прочитана!' : translationCompleted ? 'Спасибо, что прочитали!' : 'Продолжение скоро'}
          eyebrow={next ? readerChapterTitle(chapter) : translationCompleted ? `Вы закончили «${book.title}»` : `Последняя опубликованная глава «${book.title}»`}
          onClose={() => setShowCompletion(false)}
          wide
        >
          <div className="reader-completion">
            <div className="reader-completion-copy">
              <Check size={28} />
              <p>{next
                ? 'Вы дошли до конца главы. Отметьте эмоцию — она попадёт на общую эмоциональную карту книги.'
                : translationCompleted
                  ? 'Вы дошли до последней страницы. Оставьте оценку и отзыв — он сразу появится на главной странице этой книги.'
                  : 'Вы прочитали всё, что уже опубликовано. Книга автоматически остаётся в разделе «Читаю», а после выхода новой главы можно будет продолжить с этого места.'}</p>
            </div>
            <section className="reader-emotion-map">
              <small>Какая эмоция осталась после главы?</small>
              <div>
                {CHAPTER_EMOTIONS.map((emoji) => {
                  const total = Number(currentChapterEmotionTotals.find((item) => item.emoji === emoji)?.total || 0);
                  return <button type="button" className={myChapterEmotion === emoji ? 'is-active' : ''} onClick={() => saveChapterEmotion(emoji)} key={emoji}><span>{emoji}</span><strong>{total}</strong></button>;
                })}
              </div>
              <p>Так постепенно складывается эмоциональная карта всей книги.</p>
            </section>

            {next ? (
              <a href={`/books/${book.slug}/chapters/${next.id}`}>Читать дальше <ArrowRight size={18} /></a>
            ) : translationCompleted ? (
              <><a href={`/community?book=${encodeURIComponent(book.id)}&kind=poll`}>Ответить на опрос после книги <MessageCircle size={18} /></a><a href={`/books/${book.slug}`}>Перейти на страницу книги <ArrowRight size={18} /></a></>
            ) : (
              <><a href="/library">Открыть раздел «Читаю» <BookOpen size={18} /></a><a href={`/books/${book.slug}`}>Вернуться к книге <ArrowRight size={18} /></a></>
            )}
          </div>
        </ReaderSheet>
      ) : null}

      {toast ? <div className="reader-toast" role="status">{toast}</div> : null}
    </main>
  );
}
