'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  Smartphone,
  Trash2,
  UploadCloud,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import RichChapterEditor from './rich-chapter-editor.jsx';

const blankBook = {
  id: null,
  slug: '',
  title: '',
  originalTitle: '',
  seriesTitle: '',
  seriesNumber: '',
  author: '',
  dedication: '',
  synopsis: '',
  genres: [],
  genresText: '',
  tropes: [],
  tropesText: '',
  driveUrl: '',
  status: 'Черновик',
  progress: 0,
  coverKey: null,
  coverUrl: null,
  published: false,
};

const blankChapter = {
  id: null,
  chapterNumber: 1,
  title: '',
  pointOfView: '',
  body: '',
  bodyRich: '',
  footnotes: [],
  heatLevel: 0,
  driveUrl: '',
  status: 'draft',
};

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function formatAdminDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
  } catch {
    return '';
  }
}

function splitBookTags(value, limit) {
  const seen = new Set();
  return String(value || '').split(/[,;\n]+/).map((item) => item.trim()).filter((item) => {
    const key = item.toLocaleLowerCase('ru-RU');
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

const reportReasonLabels = {
  spam: 'Спам или реклама',
  insult: 'Оскорбление или травля',
  spoiler: 'Спойлер без предупреждения',
  inappropriate: 'Неприемлемый текст',
  other: 'Другая причина',
};

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение.')), type, quality);
  });
}

async function prepareImage(file, { prefix = 'cover', artwork = false } = {}) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Поддерживаются JPG, PNG и WEBP.');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Исходное изображение должно быть меньше 20 МБ.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Не удалось прочитать изображение.'));
      image.src = objectUrl;
    });

    const attempts = artwork ? [
      { width: 1800, height: 1800, quality: 0.84 },
      { width: 1450, height: 1450, quality: 0.76 },
      { width: 1100, height: 1100, quality: 0.68 },
    ] : [
      { width: 1200, height: 1800, quality: 0.84 },
      { width: 1000, height: 1500, quality: 0.76 },
      { width: 800, height: 1200, quality: 0.68 },
    ];

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.width / image.naturalWidth, attempt.height / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, 'image/webp', attempt.quality);
      if (blob.size <= 1_500_000) {
        return new File([blob], `booknerd-${prefix}-${Date.now()}.webp`, { type: 'image/webp' });
      }
    }
    throw new Error('Не удалось уменьшить изображение. Выберите файл поменьше.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function Brand() {
  return (
    <a className="admin-brand" href="/">
      <span>B</span>
      <strong>BOOKNERD.</strong>
    </a>
  );
}

function Notice({ notice, onClose }) {
  if (!notice) return null;
  return (
    <div className={`admin-notice ${notice.type === 'error' ? 'is-error' : ''}`} role="status">
      {notice.type === 'success' ? <Check size={18} /> : <span>!</span>}
      <p>{notice.message}</p>
      <button onClick={onClose} aria-label="Закрыть уведомление"><X size={17} /></button>
    </div>
  );
}

function EmptyState({ title, text, action }) {
  return (
    <div className="admin-empty">
      <BookOpen size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export default function AdminDashboard({ currentUser, signOutHref }) {
  const [view, setView] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [bookForm, setBookForm] = useState(blankBook);
  const [chapters, setChapters] = useState([]);
  const [artworks, setArtworks] = useState([]);
  const [artworkCaption, setArtworkCaption] = useState('');
  const [chapterForm, setChapterForm] = useState(blankChapter);
  const [footnoteDraft, setFootnoteDraft] = useState(null);
  const [team, setTeam] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [teamEmail, setTeamEmail] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [audience, setAudience] = useState(null);
  const chapterBodyRef = useRef(null);
  const chapterSelectionRef = useRef('');

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('/api/admin/books');
      setBooks(data.books || []);
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const data = await api('/api/admin/comments');
      setComments(data.comments || []);
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setCommentsLoading(false);
    }
  }, [flash]);

  const loadAudience = useCallback(async () => {
    if (currentUser.role !== 'owner') return;
    try {
      setAudience(await api('/api/admin/analytics'));
    } catch {
      setAudience(null);
    }
  }, [currentUser.role]);

  useEffect(() => { loadBooks(); }, [loadBooks]);
  useEffect(() => {
    if (currentUser.role !== 'owner') return undefined;
    loadAudience();
    const timer = window.setInterval(loadAudience, 30000);
    return () => window.clearInterval(timer);
  }, [currentUser.role, loadAudience]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return books;
    return books.filter((book) => `${book.title} ${book.author} ${book.status} ${(book.tropes || []).join(' ')}`.toLowerCase().includes(normalized));
  }, [books, query]);

  const stats = useMemo(() => ({
    all: books.length,
    published: books.filter((book) => book.published).length,
    chapters: books.reduce((sum, book) => sum + Number(book.chapterCount || 0), 0),
    drafts: books.filter((book) => !book.published).length,
  }), [books]);

  const navigate = (next) => {
    setView(next);
    setMenuOpen(false);
    if (next === 'team') loadTeam();
    if (next === 'comments') loadComments();
  };

  const pendingComments = comments.filter((comment) => comment.status === 'pending').length;
  const reportedComments = comments.filter((comment) => (comment.reports || []).length > 0).length;
  const commentsNeedingAttention = comments.filter((comment) => comment.status === 'pending' || (comment.reports || []).length > 0).length;

  const startNewBook = () => {
    setBookForm({ ...blankBook });
    setChapters([]);
    setArtworks([]);
    setArtworkCaption('');
    setChapterForm({ ...blankChapter });
    setFootnoteDraft(null);
    navigate('book');
  };

  const openBook = async (book) => {
    setBookForm({
      ...blankBook,
      ...book,
      genresText: (book.genres || []).join(', '),
      tropesText: (book.tropes || []).join(', '),
    });
    setArtworks([]);
    setArtworkCaption('');
    setChapterForm({ ...blankChapter });
    setFootnoteDraft(null);
    navigate('book');
    try {
      const [chapterData, artworkData] = await Promise.all([
        api(`/api/admin/books/${book.id}/chapters`),
        api(`/api/admin/books/${book.id}/artworks`),
      ]);
      setChapters(chapterData.chapters || []);
      setArtworks(artworkData.artworks || []);
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const saveBook = async (event) => {
    event.preventDefault();
    if (!bookForm.title.trim() || !bookForm.author.trim()) {
      flash('Укажите название книги и автора.', 'error');
      return;
    }
    setSaving(true);
    try {
      const editing = Boolean(bookForm.id);
      const genres = splitBookTags(bookForm.genresText ?? (bookForm.genres || []).join(', '), 20);
      const tropes = splitBookTags(bookForm.tropesText ?? (bookForm.tropes || []).join(', '), 40);
      const payload = { ...bookForm, genres, tropes };
      const data = await api(editing ? `/api/admin/books/${bookForm.id}` : '/api/admin/books', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const id = bookForm.id || data.id;
      setBookForm((current) => ({ ...current, id, slug: data.slug, genres, tropes, genresText: genres.join(', '), tropesText: tropes.join(', ') }));
      flash(editing ? 'Книга сохранена.' : 'Книга добавлена. Теперь можно создать главы.');
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const preparedFile = await prepareImage(file);
      const formData = new FormData();
      formData.append('cover', preparedFile, preparedFile.name);
      const data = await api('/api/admin/covers', { method: 'POST', body: formData });
      setBookForm((current) => ({ ...current, coverKey: data.key, coverUrl: data.coverUrl }));
      flash('Обложка подготовлена и сохранена. Теперь сохраните книгу.');
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const uploadArtwork = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!bookForm.id) {
      flash('Сначала сохраните книгу.', 'error');
      event.target.value = '';
      return;
    }
    setArtworkUploading(true);
    try {
      const preparedFile = await prepareImage(file, { prefix: 'artwork', artwork: true });
      const formData = new FormData();
      formData.append('image', preparedFile, preparedFile.name);
      formData.append('caption', artworkCaption);
      const data = await api(`/api/admin/books/${bookForm.id}/artworks`, { method: 'POST', body: formData });
      setArtworks((current) => [...current, data.artwork]);
      setArtworkCaption('');
      flash('Арт добавлен в галерею книги.');
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setArtworkUploading(false);
      event.target.value = '';
    }
  };

  const deleteArtwork = async (artwork) => {
    if (!window.confirm('Удалить этот арт из галереи?')) return;
    try {
      await api(`/api/admin/artworks/${artwork.id}`, { method: 'DELETE' });
      setArtworks((current) => current.filter((item) => item.id !== artwork.id));
      flash('Арт удалён.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const deleteBook = async () => {
    if (!bookForm.id || !window.confirm(`Удалить «${bookForm.title}» вместе со всеми главами?`)) return;
    try {
      await api(`/api/admin/books/${bookForm.id}`, { method: 'DELETE' });
      flash('Книга удалена.');
      await loadBooks();
      navigate('dashboard');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const deleteBookFromList = async (event, book) => {
    event.stopPropagation();
    if (!window.confirm(`Удалить «${book.title}» вместе со всеми главами?`)) return;
    try {
      await api(`/api/admin/books/${book.id}`, { method: 'DELETE' });
      flash('Книга удалена.');
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const startNewChapter = () => {
    setChapterForm({ ...blankChapter, chapterNumber: chapters.length + 1 });
    setFootnoteDraft(null);
  };

  const startFootnote = () => {
    const editor = chapterBodyRef.current;
    const selection = window.getSelection?.();
    const anchor = selection?.anchorNode;
    const liveTerm = selection?.rangeCount && anchor && editor?.contains(anchor.nodeType === 1 ? anchor : anchor.parentElement)
      ? selection.toString().trim()
      : '';
    const term = liveTerm || chapterSelectionRef.current;
    if (!term) {
      flash('Сначала выделите слово или короткую фразу в тексте главы.', 'error');
      editor?.focus();
      return;
    }
    if (term.length > 120 || term.includes('\n')) {
      flash('Для сноски выберите одно слово или короткую фразу до 120 знаков.', 'error');
      return;
    }
    const existing = (chapterForm.footnotes || []).find((footnote) => footnote.term.toLocaleLowerCase('ru-RU') === term.toLocaleLowerCase('ru-RU'));
    chapterSelectionRef.current = '';
    setFootnoteDraft(existing ? { ...existing } : { id: null, term, explanation: '' });
  };

  const editFootnote = (footnote) => {
    setFootnoteDraft({ ...footnote });
  };

  const saveFootnote = () => {
    if (!footnoteDraft) return;
    const term = String(footnoteDraft.term || '').trim().slice(0, 120);
    const explanation = String(footnoteDraft.explanation || '').trim().slice(0, 2000);
    if (!term || !explanation) {
      flash('Напишите объяснение для выбранного слова.', 'error');
      return;
    }
    const id = footnoteDraft.id || (crypto.randomUUID ? crypto.randomUUID() : `footnote-${Date.now()}`);
    setChapterForm((current) => {
      const footnotes = current.footnotes || [];
      const next = footnoteDraft.id
        ? footnotes.map((footnote) => footnote.id === footnoteDraft.id ? { id, term, explanation } : footnote)
        : [...footnotes.filter((footnote) => footnote.term.toLocaleLowerCase('ru-RU') !== term.toLocaleLowerCase('ru-RU')), { id, term, explanation }];
      return { ...current, footnotes: next };
    });
    setFootnoteDraft(null);
    flash('Сноска добавлена. Теперь сохраните главу.');
  };

  const deleteFootnote = (id) => {
    if (!window.confirm('Удалить эту сноску?')) return;
    setChapterForm((current) => ({ ...current, footnotes: (current.footnotes || []).filter((footnote) => footnote.id !== id) }));
    if (footnoteDraft?.id === id) setFootnoteDraft(null);
    flash('Сноска удалена. Сохраните главу.');
  };

  const saveChapter = async (event) => {
    event.preventDefault();
    if (!bookForm.id) {
      flash('Сначала сохраните книгу.', 'error');
      return;
    }
    if (!chapterForm.title.trim()) {
      flash('Укажите название главы.', 'error');
      return;
    }
    setSaving(true);
    try {
      const editing = Boolean(chapterForm.id);
      const data = await api(
        editing ? `/api/admin/chapters/${chapterForm.id}` : `/api/admin/books/${bookForm.id}/chapters`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(chapterForm),
        },
      );
      flash(chapterForm.status === 'published' ? 'Глава опубликована.' : 'Глава сохранена в черновиках.');
      const refreshed = await api(`/api/admin/books/${bookForm.id}/chapters`);
      setChapters(refreshed.chapters || []);
      const updated = (refreshed.chapters || []).find((chapter) => chapter.id === (chapterForm.id || data.id));
      setChapterForm(updated || { ...blankChapter });
      setFootnoteDraft(null);
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteChapter = async () => {
    if (!chapterForm.id || !window.confirm('Удалить эту главу?')) return;
    try {
      await api(`/api/admin/chapters/${chapterForm.id}`, { method: 'DELETE' });
      setChapters((current) => current.filter((chapter) => chapter.id !== chapterForm.id));
      setChapterForm({ ...blankChapter, chapterNumber: Math.max(1, chapters.length) });
      setFootnoteDraft(null);
      flash('Глава удалена.');
      await loadBooks();
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  async function loadTeam() {
    if (currentUser.role !== 'owner') return;
    try {
      const data = await api('/api/admin/team');
      setTeam(data.team || []);
    } catch (error) {
      flash(error.message, 'error');
    }
  }

  const addTeamMember = async (event) => {
    event.preventDefault();
    if (!teamEmail.trim()) return;
    try {
      await api('/api/admin/team', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: teamEmail }),
      });
      setTeamEmail('');
      await loadTeam();
      flash('Участник добавлен. Теперь он сможет войти в панель.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const removeTeamMember = async (email) => {
    if (!window.confirm(`Закрыть доступ для ${email}?`)) return;
    try {
      await api('/api/admin/team', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await loadTeam();
      flash('Доступ участника закрыт.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const approveComment = async (comment) => {
    try {
      await api(`/api/admin/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'approved', kind: comment.kind }),
      });
      await loadComments();
      flash(comment.kind === 'review' ? 'Отзыв опубликован.' : 'Комментарий опубликован.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const hideComment = async (comment) => {
    try {
      await api(`/api/admin/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'pending', kind: comment.kind }),
      });
      await loadComments();
      flash(comment.kind === 'review' ? 'Отзыв скрыт от читателей.' : 'Комментарий скрыт от читателей.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const deleteComment = async (comment) => {
    if (!window.confirm(`Удалить ${comment.kind === 'review' ? 'отзыв' : 'комментарий'} от ${comment.authorName}?`)) return;
    try {
      await api(`/api/admin/comments/${comment.id}?kind=${comment.kind || 'comment'}`, { method: 'DELETE' });
      await loadComments();
      flash(comment.kind === 'review' ? 'Отзыв удалён.' : 'Комментарий удалён.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  const clearCommentReports = async (comment) => {
    try {
      await api(`/api/admin/comments/${comment.id}/reports`, { method: 'DELETE' });
      await loadComments();
      flash('Жалобы отмечены как рассмотренные.');
    } catch (error) {
      flash(error.message, 'error');
    }
  };

  return (
    <div className="admin-shell">
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <aside className={`admin-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-head">
          <Brand />
          <button className="admin-close-menu" onClick={() => setMenuOpen(false)}><X size={20} /></button>
        </div>
        <div className="admin-workspace-label">Редакционная</div>
        <nav className="admin-nav" aria-label="Панель управления">
          <button className={view === 'dashboard' ? 'is-active' : ''} onClick={() => navigate('dashboard')}>
            <LayoutDashboard size={19} /> Обзор
          </button>
          <button className={view === 'books' ? 'is-active' : ''} onClick={() => navigate('books')}>
            <BookOpen size={19} /> Все книги <span>{books.length}</span>
          </button>
          <button className={view === 'book' && !bookForm.id ? 'is-active' : ''} onClick={startNewBook}>
            <Plus size={19} /> Добавить книгу
          </button>
          <button className={view === 'comments' ? 'is-active' : ''} onClick={() => navigate('comments')}>
            <MessageCircle size={19} /> Комментарии и отзывы {commentsNeedingAttention > 0 && <span>{commentsNeedingAttention}</span>}
          </button>
          {currentUser.role === 'owner' && (
            <button className={view === 'team' ? 'is-active' : ''} onClick={() => navigate('team')}>
              <Users size={19} /> Команда
            </button>
          )}
        </nav>
        <div className="admin-sidebar-note">
          <span>✦</span>
          <p>Каждая глава проходит перевод, редактуру и корректуру.</p>
        </div>
        <div className="admin-user">
          <div className="admin-avatar">{currentUser.displayName.slice(0, 1).toUpperCase()}</div>
          <div><strong>{currentUser.role === 'owner' ? 'Владелица' : 'Участник команды'}</strong><span>{currentUser.role === 'owner' ? 'Полный доступ' : currentUser.email}</span></div>
          <a href={signOutHref} aria-label="Выйти"><LogOut size={18} /></a>
        </div>
      </aside>

      {menuOpen && <button className="admin-menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню" />}

      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-menu-toggle" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div>
            <span>BOOKNERD · ПАНЕЛЬ КОМАНДЫ</span>
            <strong>{view === 'book' ? (bookForm.id ? 'Редактирование книги' : 'Новая книга') : view === 'team' ? 'Доступ команды' : view === 'comments' ? 'Комментарии и отзывы' : 'Управление библиотекой'}</strong>
          </div>
          <a href="/" target="_blank">Открыть сайт <ChevronRight size={17} /></a>
        </header>

        {(view === 'dashboard' || view === 'books') && (
          <section className="admin-content">
            <div className="admin-hero-row">
              <div>
                <span className="admin-kicker">ИСТОРИИ ПОД ВАШИМ КОНТРОЛЕМ</span>
                <h1>{view === 'dashboard' ? <>Добро пожаловать<br />в <em>редакционную.</em></> : <>Все книги<br /><em>BOOKNERD.</em></>}</h1>
                <p>Добавляйте переводы, готовьте главы и решайте, когда история появится у читателей.</p>
              </div>
              <button className="admin-primary" onClick={startNewBook}><Plus size={19} /> Добавить книгу</button>
            </div>

            <div className="admin-stats">
              <article><span>01</span><strong>{stats.all}</strong><p>книг в библиотеке</p></article>
              <article><span>02</span><strong>{stats.published}</strong><p>опубликовано</p></article>
              <article><span>03</span><strong>{stats.chapters}</strong><p>глав добавлено</p></article>
              <article><span>04</span><strong>{stats.drafts}</strong><p>черновиков</p></article>
            </div>

            {currentUser.role === 'owner' ? (
              <section className="admin-audience">
                <div><span>ЖИВАЯ СТАТИСТИКА</span><h2>Читатели BOOKNERD</h2><p>Количество читателей обновляется примерно раз в 30 секунд.</p></div>
                <div className="admin-audience-grid">
                  <article><Wifi size={23} /><strong>{audience?.onlineReaders ?? '—'}</strong><p>сейчас читают</p></article>
                  <article><Smartphone size={23} /><strong>{audience?.installs ?? '—'}</strong><p>установили на телефон</p></article>
                  <article><Send size={23} /><strong>{audience?.telegramVisitors ?? '—'}</strong><p>перешли в Telegram</p><small>{audience ? `${audience.telegramClicks} переходов всего` : 'считаем переходы по ссылке'}</small></article>
                </div>
              </section>
            ) : null}

            <div className="admin-list-head">
              <div><span>{view === 'dashboard' ? 'ПОСЛЕДНИЕ КНИГИ' : 'КАТАЛОГ'}</span><h2>{view === 'dashboard' ? 'Продолжить работу' : 'Управление книгами'}</h2></div>
              <label className="admin-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти книгу" /></label>
            </div>

            {loading ? (
              <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем библиотеку…</div>
            ) : filteredBooks.length ? (
              <div className="admin-book-grid">
                {filteredBooks.slice(0, view === 'dashboard' ? 6 : undefined).map((book) => (
                  <article className="admin-book-card" key={book.id} onClick={() => openBook(book)} onKeyDown={(event) => event.key === 'Enter' && openBook(book)} role="button" tabIndex="0">
                    <div className="admin-book-cover">
                      {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <><span>перевод booknerd</span><strong>{book.title}</strong><small>{book.author}</small></>}
                      <b className={book.published ? 'is-live' : ''}>{book.published ? 'На сайте' : 'Черновик'}</b>
                    </div>
                    <div className="admin-book-card-copy">
                      <span>{book.status} · {book.progress}%</span>
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      {(book.tropes || []).length ? <small className="admin-book-tropes">{book.tropes.slice(0, 2).join(' · ')}</small> : null}
                      <div><FileText size={15} /> {book.chapterCount || 0} глав <ChevronRight size={18} /></div>
                    </div>
                    {currentUser.role === 'owner' && <button className="admin-book-card-delete" type="button" onClick={(event) => deleteBookFromList(event, book)} aria-label={`Удалить книгу ${book.title}`}><Trash2 size={15} /></button>}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Библиотека пока пуста" text="Добавьте первую настоящую книгу BOOKNERD." action={<button className="admin-primary" onClick={startNewBook}><Plus size={18} /> Добавить книгу</button>} />
            )}
          </section>
        )}

        {view === 'book' && (
          <section className="admin-content admin-editor-page">
            <button className="admin-back" onClick={() => navigate('books')}><ArrowLeft size={18} /> Ко всем книгам</button>
            <div className="admin-editor-heading">
              <div><span className="admin-kicker">{bookForm.id ? 'РЕДАКТИРОВАНИЕ' : 'НОВАЯ ИСТОРИЯ'}</span><h1>{bookForm.title || 'Новая книга'}</h1></div>
              {bookForm.id && currentUser.role === 'owner' && <button className="admin-danger" onClick={deleteBook}><Trash2 size={17} /> Удалить книгу</button>}
            </div>

            <form className="admin-book-form" onSubmit={saveBook}>
              <div className="admin-form-main">
                <section className="admin-form-card">
                  <div className="admin-card-title"><span>01</span><div><h2>Основная информация</h2><p>То, что увидят читатели на странице книги.</p></div></div>
                  <div className="admin-fields two-columns">
                    <label><span>Название книги *</span><input value={bookForm.title} onChange={(event) => setBookForm({ ...bookForm, title: event.target.value })} placeholder="Например, Плетёное королевство" /></label>
                    <label><span>Автор *</span><input value={bookForm.author} onChange={(event) => setBookForm({ ...bookForm, author: event.target.value })} placeholder="Имя автора" /></label>
                    <label><span>Оригинальное название</span><input value={bookForm.originalTitle} onChange={(event) => setBookForm({ ...bookForm, originalTitle: event.target.value })} placeholder="Название на языке оригинала" /></label>
                    <label><span>Адрес страницы</span><input value={bookForm.slug} onChange={(event) => setBookForm({ ...bookForm, slug: event.target.value })} placeholder="sozdayotsya-avtomaticheski" /></label>
                    <label><span>Название серии</span><input value={bookForm.seriesTitle || ''} onChange={(event) => setBookForm({ ...bookForm, seriesTitle: event.target.value })} placeholder="Например, Хроники Севера" /></label>
                    <label><span>Номер книги в серии</span><input type="number" min="1" value={bookForm.seriesNumber || ''} onChange={(event) => setBookForm({ ...bookForm, seriesNumber: event.target.value ? Number(event.target.value) : '' })} placeholder="1" /></label>
                    <label className="admin-drive-field"><span>Файл книги в Google Drive</span><input type="url" value={bookForm.driveUrl || ''} onChange={(event) => setBookForm({ ...bookForm, driveUrl: event.target.value })} placeholder="https://drive.google.com/…" /></label>
                  </div>
                  <label className="admin-full-field"><span>Аннотация</span><textarea value={bookForm.synopsis} onChange={(event) => setBookForm({ ...bookForm, synopsis: event.target.value })} placeholder="Расскажите читателю, о чём эта история…" rows={7} /><small>{bookForm.synopsis.length} / 12 000</small></label>
                  <label className="admin-full-field"><span>Кому посвящена книга</span><textarea value={bookForm.dedication || ''} onChange={(event) => setBookForm({ ...bookForm, dedication: event.target.value })} placeholder="Например: Всем девушкам, которые однажды выбрали себя…" rows={3} /><small>Посвящение появится на главной странице книги.</small></label>
                  <div className="admin-fields two-columns">
                    <label><span>Жанры</span><input value={bookForm.genresText || ''} onChange={(event) => setBookForm({ ...bookForm, genresText: event.target.value })} placeholder="Романтика, Фэнтези, Young Adult" /><small>Разделяйте жанры запятыми.</small></label>
                    <label><span>Тропы</span><input value={bookForm.tropesText || ''} onChange={(event) => setBookForm({ ...bookForm, tropesText: event.target.value })} placeholder="Враги в возлюбленные, найденная семья" /><small>Разделяйте тропы запятыми.</small></label>
                    <label><span>Статус перевода</span><select value={bookForm.status} onChange={(event) => setBookForm({ ...bookForm, status: event.target.value })}><option>Черновик</option><option>Скоро</option><option>В работе</option><option>Новый перевод</option><option>Готово</option><option>На паузе</option></select></label>
                    <label><span>Готовность перевода: {bookForm.progress}%</span><input type="range" min="0" max="100" value={bookForm.progress} onChange={(event) => setBookForm({ ...bookForm, progress: Number(event.target.value) })} /></label>
                    <label className="admin-switch-row"><span><strong>Показывать книгу на сайте</strong><small>Читатели увидят аннотацию и опубликованные главы.</small></span><input type="checkbox" checked={bookForm.published} onChange={(event) => setBookForm({ ...bookForm, published: event.target.checked })} /></label>
                  </div>
                </section>
              </div>

              <aside className="admin-form-side">
                <section className="admin-form-card admin-cover-card">
                  <div className="admin-card-title compact"><span>02</span><div><h2>Обложка</h2><p>JPG, PNG или WEBP. Сайт сам уменьшит изображение.</p></div></div>
                  <div className="admin-cover-preview">
                    {bookForm.coverUrl ? <img src={bookForm.coverUrl} alt="Обложка книги" /> : <><ImagePlus size={38} /><strong>{bookForm.title || 'Обложка книги'}</strong><small>BOOKNERD EDITION</small></>}
                  </div>
                  <label className="admin-upload-button">{uploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />} {uploading ? 'Загрузка…' : 'Загрузить обложку'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadCover} disabled={uploading} /></label>
                </section>
                <button className="admin-primary admin-save-book" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} {saving ? 'Сохраняем…' : 'Сохранить книгу'}</button>
              </aside>
            </form>

            <section className={`admin-artwork-section ${!bookForm.id ? 'is-disabled' : ''}`}>
              <div className="admin-list-head">
                <div><span>03 / АРТЫ</span><h2>Галерея книги</h2><p>Добавьте до 8 атмосферных иллюстраций, чтобы заинтересовать читателей.</p></div>
                <span className="admin-artwork-count">{artworks.length} / 8</span>
              </div>
              {!bookForm.id ? (
                <EmptyState title="Сначала сохраните книгу" text="После сохранения сюда можно будет загрузить арты." />
              ) : (
                <div className="admin-artwork-workspace">
                  <div className="admin-artwork-upload">
                    <ImagePlus size={34} />
                    <div><strong>Новый арт</strong><p>Можно загрузить вертикальное или горизонтальное изображение.</p></div>
                    <label><span>Подпись к арту</span><input value={artworkCaption} onChange={(event) => setArtworkCaption(event.target.value)} maxLength={240} placeholder="Например, главные герои в зимнем саду" /></label>
                    <label className="admin-upload-button">{artworkUploading ? <LoaderCircle className="spin" size={18} /> : <UploadCloud size={18} />} {artworkUploading ? 'Загружаем…' : 'Выбрать изображение'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadArtwork} disabled={artworkUploading || artworks.length >= 8} /></label>
                    <small>JPG, PNG или WEBP. Сайт сам уменьшит изображение.</small>
                  </div>
                  {artworks.length ? (
                    <div className="admin-artwork-grid">
                      {artworks.map((artwork, index) => (
                        <article key={artwork.id}>
                          <img src={artwork.imageUrl} alt={artwork.caption || `Арт ${index + 1}`} />
                          <div><span>{String(index + 1).padStart(2, '0')}</span><p>{artwork.caption || 'Без подписи'}</p><button type="button" onClick={() => deleteArtwork(artwork)} aria-label="Удалить арт"><Trash2 size={16} /></button></div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-artwork-empty"><ImagePlus size={40} /><strong>Галерея пока пуста</strong><p>Первый арт появится здесь сразу после загрузки.</p></div>
                  )}
                </div>
              )}
            </section>

            <section className={`admin-chapter-section ${!bookForm.id ? 'is-disabled' : ''}`}>
              <div className="admin-list-head">
                <div><span>04 / ГЛАВЫ</span><h2>Текст перевода</h2><p>Добавляйте главы, храните черновики и публикуйте готовый текст.</p></div>
                <button className="admin-secondary" onClick={startNewChapter} disabled={!bookForm.id}><Plus size={18} /> Новая глава</button>
              </div>
              {!bookForm.id ? (
                <EmptyState title="Сначала сохраните книгу" text="После сохранения здесь появится редактор глав." />
              ) : (
                <div className="admin-chapter-workspace">
                  <aside className="admin-chapter-list">
                    {chapters.length ? chapters.map((chapter) => (
                      <button key={chapter.id} className={chapterForm.id === chapter.id ? 'is-active' : ''} onClick={() => { setChapterForm({ ...blankChapter, ...chapter, footnotes: chapter.footnotes || [] }); setFootnoteDraft(null); }}>
                        <span>{String(chapter.chapterNumber).padStart(2, '0')}</span><div><strong>{chapter.title}</strong><small>{chapter.status === 'published' ? 'Опубликована' : 'Черновик'}{chapter.heatLevel ? ` · ${'🔥'.repeat(chapter.heatLevel)}` : ''}</small></div><ChevronRight size={17} />
                      </button>
                    )) : <p className="admin-no-chapters">Глав пока нет. Создайте первую.</p>}
                  </aside>
                  <form className="admin-chapter-editor" onSubmit={saveChapter}>
                    <div className="admin-chapter-editor-top">
                      <label><span>Номер</span><input type="number" min="1" value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: Number(event.target.value) })} /></label>
                      <label className="grow"><span>Название главы</span><input value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} placeholder="Название главы" /></label>
                      <label className="grow"><span>От лица героя</span><input value={chapterForm.pointOfView || ''} onChange={(event) => setChapterForm({ ...chapterForm, pointOfView: event.target.value })} placeholder="Например, Лейла" /></label>
                      <label><span>Статус</span><select value={chapterForm.status} onChange={(event) => setChapterForm({ ...chapterForm, status: event.target.value })}><option value="draft">Черновик</option><option value="published">Опубликована</option></select></label>
                      <label><span>Горячие сцены</span><select value={chapterForm.heatLevel || 0} onChange={(event) => setChapterForm({ ...chapterForm, heatLevel: Number(event.target.value) })}><option value="0">Нет</option><option value="1">Намёк · 🔥</option><option value="2">Горячая сцена · 🔥🔥</option><option value="3">Очень горячая · 🔥🔥🔥</option></select></label>
                    </div>
                    <div className="admin-chapter-body"><span>Текст главы с оформлением</span><RichChapterEditor key={`${bookForm.id || 'book'}-${chapterForm.id || 'new'}-${chapterForm.chapterNumber}`} ref={chapterBodyRef} value={chapterForm.bodyRich} fallbackText={chapterForm.body} onTextSelect={(text) => { chapterSelectionRef.current = text; }} onChange={({ body, bodyRich }) => setChapterForm((current) => ({ ...current, body, bodyRich }))} /></div>
                    <section className="admin-footnotes-panel">
                      <header>
                        <div><span>СНОСКИ КОМАНДЫ</span><strong>Пояснения для читателей</strong><small>Выделите слово или короткую фразу в тексте выше и нажмите кнопку. Сноски могут создавать вы и выбранные участники команды.</small></div>
                        <button type="button" className="admin-secondary" onClick={startFootnote}><Plus size={17} /> Добавить сноску</button>
                      </header>
                        {footnoteDraft ? (
                          <div className="admin-footnote-editor">
                            <label><span>Слово или фраза</span><input value={footnoteDraft.term} onChange={(event) => setFootnoteDraft({ ...footnoteDraft, term: event.target.value })} maxLength="120" /></label>
                            <label><span>Объяснение</span><textarea value={footnoteDraft.explanation} onChange={(event) => setFootnoteDraft({ ...footnoteDraft, explanation: event.target.value })} maxLength="2000" rows="4" placeholder="Например: архаичное слово, исторический термин или важная деталь мира книги…" /></label>
                            <div><button type="button" className="admin-secondary" onClick={() => setFootnoteDraft(null)}>Отмена</button><button type="button" className="admin-primary" onClick={saveFootnote}><Check size={17} /> Сохранить сноску</button></div>
                          </div>
                        ) : null}
                        {(chapterForm.footnotes || []).length ? (
                          <div className="admin-footnote-list">
                            {(chapterForm.footnotes || []).map((footnote, index) => (
                              <article key={footnote.id || `${footnote.term}-${index}`}>
                                <span>{index + 1}</span>
                                <button type="button" onClick={() => editFootnote(footnote)}><strong>{footnote.term}</strong><small>{footnote.explanation}</small></button>
                                <button type="button" onClick={() => deleteFootnote(footnote.id)} aria-label={`Удалить сноску ${footnote.term}`}><Trash2 size={16} /></button>
                              </article>
                            ))}
                          </div>
                        ) : <p className="admin-footnote-empty">Сносок пока нет.</p>}
                    </section>
                    <label className="admin-chapter-drive"><span>Файл главы в Google Drive</span><input type="url" value={chapterForm.driveUrl || ''} onChange={(event) => setChapterForm({ ...chapterForm, driveUrl: event.target.value })} placeholder="https://drive.google.com/…" /></label>
                    <div className="admin-chapter-actions">
                      {chapterForm.id && <button type="button" className="admin-danger" onClick={deleteChapter}><Trash2 size={17} /> Удалить</button>}
                      <span>{chapterForm.body.length.toLocaleString('ru-RU')} знаков</span>
                      <button className="admin-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Сохранить главу</button>
                    </div>
                  </form>
                </div>
              )}
            </section>
          </section>
        )}

        {view === 'comments' && (
          <section className="admin-content admin-comments-page">
            <div className="admin-hero-row">
              <div><span className="admin-kicker">МНЕНИЯ ЧИТАТЕЛЕЙ</span><h1>Комментарии<br /><em>и отзывы.</em></h1><p>Они публикуются сразу. Здесь можно скрыть или удалить любой комментарий и отзыв.</p></div>
              <button className="admin-secondary" onClick={loadComments}><MessageCircle size={18} /> Обновить</button>
            </div>
            <div className="admin-comment-summary">
              <article><strong>{pendingComments}</strong><span>скрыто вручную</span></article>
              <article><strong>{comments.filter((comment) => comment.status === 'approved').length}</strong><span>опубликовано</span></article>
              <article><strong>{reportedComments}</strong><span>с жалобами</span></article>
            </div>
            {commentsLoading ? (
              <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем комментарии…</div>
            ) : comments.length ? (
              <div className="admin-comment-list">
                {comments.map((comment) => (
                  <article className={`admin-comment-card ${comment.status === 'approved' ? 'is-approved' : 'is-pending'} ${(comment.reports || []).length ? 'is-reported' : ''}`} key={comment.id}>
                    <div className="admin-comment-meta">
                      <span>{comment.status === 'approved' ? 'Опубликован' : 'Скрыт'}</span>
                      {comment.kind === 'review' ? <b>Отзыв · {comment.rating}/10</b> : null}
                      {comment.isSpoiler ? <b className="admin-comment-spoiler">Спойлер</b> : null}
                      {(comment.reports || []).length ? <b>Жалоб: {comment.reports.length}</b> : null}
                      <time dateTime={comment.createdAt}>{formatAdminDate(comment.createdAt)}</time>
                    </div>
                    <h3>{comment.authorName}</h3>
                    <p>{comment.body}</p>
                    {(comment.reports || []).length ? (
                      <div className="admin-comment-reports">
                        <strong>Причины жалоб</strong>
                        {comment.reports.map((report, index) => (
                          <div key={`${report.createdAt}-${index}`}><span>{reportReasonLabels[report.reason] || 'Другая причина'}</span>{report.details ? <p>{report.details}</p> : null}</div>
                        ))}
                      </div>
                    ) : null}
                    <div className="admin-comment-source">
                      <BookOpen size={15} />
                      <a href={comment.chapterId ? `/books/${comment.bookSlug}/chapters/${comment.chapterId}` : `/books/${comment.bookSlug}`} target="_blank" rel="noreferrer">
                        {comment.bookTitle}{comment.chapterTitle ? ` · глава ${comment.chapterNumber}: ${comment.chapterTitle}` : ' · страница книги'}
                      </a>
                    </div>
                    <div className="admin-comment-actions">
                      {comment.status === 'pending'
                        ? <button className="admin-primary" onClick={() => approveComment(comment)}><Check size={16} /> Вернуть на сайт</button>
                        : <button className="admin-secondary" onClick={() => hideComment(comment)}>Скрыть</button>}
                      {(comment.reports || []).length ? <button className="admin-secondary" onClick={() => clearCommentReports(comment)}><Check size={16} /> Жалобы рассмотрены</button> : null}
                      <button className="admin-danger" onClick={() => deleteComment(comment)}><Trash2 size={16} /> Удалить</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Комментариев и отзывов пока нет" text="Когда читатели начнут обсуждение, новые сообщения появятся здесь." />
            )}
          </section>
        )}

        {view === 'team' && currentUser.role === 'owner' && (
          <section className="admin-content admin-team-page">
            <div className="admin-hero-row">
              <div><span className="admin-kicker">ДОСТУП К РЕДАКЦИОННОЙ</span><h1>Твоя <em>команда.</em></h1><p>Добавляйте только тех, кому доверяете книги, главы и публикацию.</p></div>
            </div>
            <div className="admin-team-layout">
              <form className="admin-invite-card" onSubmit={addTeamMember}>
                <Users size={30} />
                <h2>Добавить участника</h2>
                <p>Введите email участника. После этого он сможет войти по этому email и отдельному командному паролю.</p>
                <label><span>Email участника</span><input type="email" value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} placeholder="name@example.com" required /></label>
                <button className="admin-primary" type="submit"><Plus size={18} /> Открыть доступ</button>
              </form>
              <section className="admin-team-list">
                <div className="admin-card-title"><span>01</span><div><h2>Участники редакционной</h2><p>{team.length} человек с доступом</p></div></div>
                {team.map((member) => (
                  <article key={member.email}>
                    <div className="admin-avatar">{member.email.slice(0, 1).toUpperCase()}</div>
                    <div><strong>{member.role === 'owner' ? 'Владелица BOOKNERD' : 'Участник команды'}</strong><span>{member.displayName || member.email}</span></div>
                    <b>{member.role === 'owner' ? 'Полный доступ' : 'Книги и главы'}</b>
                    {member.role !== 'owner' && <button onClick={() => removeTeamMember(member.email)} aria-label={`Закрыть доступ для ${member.email}`}><Trash2 size={17} /></button>}
                  </article>
                ))}
              </section>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
