'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Camera, Check, Library, LoaderCircle, MessageCircle, Pencil, Save, Sparkles, Star, Trash2, UserRound } from 'lucide-react';
import ProfileRecovery from './profile-recovery.jsx';
import { getVisitorKey } from './site-analytics.js';
import { loadReaderLibrary } from './reader-library.jsx';
import { APP_THEME_OPTIONS, setStoredAppTheme, setStoredAtmosphere } from './app-preferences.jsx';
import ProfileNotificationSettings from './profile-notification-settings.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';
import { InstallInstructions, useBooknerdInstall } from './pwa-register.jsx';

async function resizeAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Выберите JPG, PNG или WEBP размером до 5 МБ.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 384 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob || blob.size > 256 * 1024) throw new Error('Не удалось уменьшить фото. Попробуйте другое изображение.');
    return new File([blob], 'avatar.' + (blob.type === 'image/webp' ? 'webp' : 'png'), { type: blob.type });
  } finally { URL.revokeObjectURL(url); }
}

const DEFAULT_PROFILE = { displayName: 'Читатель BOOKNERD', photoUrl: '', photoName: '', bio: '', createdAt: null, banner: 'books', favoriteCharacters: [], favoriteQuotes: [], appTheme: 'original', atmosphere: 'auto' };

function formatDuration(seconds) {
  const minutes = Math.round(Number(seconds || 0) / 60);
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

function levelFor(stats) {
  const points = Number(stats?.chaptersRead || 0) * 10 + Number(stats?.booksRead || 0) * 100 + Math.floor(Number(stats?.readingSeconds || 0) / 600);
  return { level: Math.max(1, Math.floor(points / 250) + 1), points, next: 250 - (points % 250 || 250) };
}

function achievementsFor(stats, library) {
  const achievements = [
    { icon: '🏅', title: 'Первая глава', unlocked: Number(stats?.chaptersRead || 0) >= 1 },
    { icon: '📚', title: 'Прочитано 100 глав', unlocked: Number(stats?.chaptersRead || 0) >= 100 },
    { icon: '🌙', title: 'Ночной читатель', unlocked: (stats?.activeHours || []).some((item) => Number(item.hour) >= 23 || Number(item.hour) <= 3), hint: 'Читайте после полуночи' },
    { icon: '☕', title: 'Утренний читатель', unlocked: (stats?.activeHours || []).some((item) => Number(item.hour) >= 5 && Number(item.hour) <= 9), hint: 'Читайте до 9 утра' },
    { icon: '❤️', title: 'Первая завершённая книга', unlocked: Number(stats?.booksRead || 0) >= 1 },
    { icon: '🔥', title: 'Неделя без пропусков', unlocked: Number(stats?.longestStreak || 0) >= 7 },
    { icon: '🌍', title: 'Книги из 5 стран', unlocked: new Set(library.map((item) => item.book?.country).filter(Boolean)).size >= 5 },
  ];
  return achievements;
}

export default function ProfilePage({ books = [] }) {
  const { device, installed } = useBooknerdInstall();
  if (installed) return <InstalledProfile books={books} />;
  return (
    <div className="site-shell shelf-page">
      <SiteHeader compact />
      <main className="booknerd-profile-install">
        {device ? <>
          <img src="/booknerd-icon-v4-192.png" width="64" height="64" alt="" />
          <h1>Профиль в приложении Booknerd</h1>
          <InstallInstructions />
          <a href="/">Вернуться к книгам</a>
        </> : <p role="status">Проверяем режим запуска…</p>}
      </main>
      <SiteFooter />
    </div>
  );
}

function InstalledProfile({ books }) {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [ownComments, setOwnComments] = useState([]);
  const [stats, setStats] = useState(null);
  const [library, setLibrary] = useState([]);
  const [memories, setMemories] = useState({ annotations: [] });
  const [notice, setNotice] = useState('');
  const [photoSaving, setPhotoSaving] = useState(false);
  const photoInputRef = useRef(null);
  const booksById = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const enrichedLibrary = useMemo(() => library.map((item) => ({ ...item, book: booksById.get(item.bookId) })).filter((item) => item.book), [booksById, library]);
  const favoriteBooks = enrichedLibrary.filter((item) => item.status === 'favorite');
  const completedBooks = enrichedLibrary.filter((item) => item.status === 'finished');
  const level = levelFor(stats);
  const achievements = achievementsFor(stats, enrichedLibrary);

  useEffect(() => {
    const visitorKey = getVisitorKey();
    Promise.all([
      fetch(`/api/reader-hub?profileView=1&visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()),
      fetch(`/api/reader-stats?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()).catch(() => ({})),
      loadReaderLibrary().catch(() => []),
    ]).then(([hub, statData, libraryData]) => {
      if (hub.profile) setProfile({ ...DEFAULT_PROFILE, ...hub.profile });
      setStats(statData.stats || null);
      setOwnComments(hub.ownComments || []);
      setLibrary(libraryData || []);
      const annotations = [];
      try {
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index) || '';
          if (!key.startsWith('booknerd-reader-annotations-v1:')) continue;
          const entries = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(entries)) annotations.push(...entries);
        }
      } catch { /* memory box still works with server data */ }
      setMemories({ annotations });
    }).catch(() => setNotice('Не удалось загрузить часть статистики.'));
  }, []);

  const save = async () => {
    const response = await fetch('/api/reader-hub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitorKey: getVisitorKey(), action: 'profile', ...profile }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(data.error || 'Не удалось сохранить профиль.'); return; }
    setProfile((current) => ({ ...current, ...data.profile }));
    setStoredAppTheme(data.profile.appTheme);
    setStoredAtmosphere(data.profile.atmosphere);
    window.dispatchEvent(new CustomEvent('booknerd-profile-name', { detail: data.profile.displayName }));
    setNotice('Профиль сохранён.');
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoSaving(true);
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('visitorKey', getVisitorKey());
      formData.set('photo', await resizeAvatar(file));
      const response = await fetch('/api/reader-profile-photo', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить фотографию.');
      setProfile((current) => ({ ...current, ...data.photo }));
      window.dispatchEvent(new CustomEvent('booknerd-profile-photo', { detail: data.photo.photoUrl }));
      setNotice('Фотография профиля сохранена.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPhotoSaving(false);
    }
  };

  const removePhoto = async () => {
    setPhotoSaving(true);
    setNotice('');
    try {
      const query = new URLSearchParams({ visitorKey: getVisitorKey() });
      const response = await fetch(`/api/reader-profile-photo?${query.toString()}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось удалить фотографию.');
      setProfile((current) => ({ ...current, photoUrl: '', photoName: '' }));
      window.dispatchEvent(new CustomEvent('booknerd-profile-photo', { detail: '' }));
      setNotice('Фотография профиля удалена.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPhotoSaving(false);
    }
  };

  return (
    <div className="site-shell inner-site-shell profile-page shelf-page profile-modern">
      <SiteHeader active="profile" compact />
      <main>
        <div className="profile-content">
          <section className="profile-summary">
            <div className="profile-summary-head">
              <div className="profile-summary-avatar">{profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : <UserRound size={36} />}</div>
              <div><h1>{profile.displayName}</h1><span className="profile-level-badge">Уровень {level.level}</span></div>
              <a className="shelf-control profile-edit-link" href="#profile-settings" aria-label="Настройки профиля"><Pencil size={19} /></a>
            </div>
            {profile.bio ? <p className="profile-bio">{profile.bio}</p> : <a className="profile-bio-link" href="#profile-settings">＋ Добавить пару слов о себе</a>}
            <a className="shelf-control profile-comments-link" href="#profile-comments"><MessageCircle size={17} /> Мои комментарии <span>{ownComments[0]?.total || 0}</span></a>
            <dl className="profile-facts">
              <div><dt>Уровень</dt><dd><strong>{level.level}</strong><progress max={250} value={level.points % 250} aria-label="Опыт до следующего уровня" /><small>{level.points % 250} / 250 XP · всего {level.points} XP</small></dd></div>
              <div><dt>Прочитано</dt><dd><strong>{stats?.chaptersRead || 0} гл.</strong><small>{formatDuration(stats?.readingSeconds)}</small></dd></div>
              <div><dt>В библиотеке</dt><dd><strong>{enrichedLibrary.length}</strong></dd></div>
              <div><dt>Лучшая серия чтения</dt><dd><strong>{stats?.longestStreak || 0} дн.</strong></dd></div>
              {profile.createdAt && <div><dt>С нами с</dt><dd><strong>{new Date(profile.createdAt).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}</strong></dd></div>}
            </dl>
            {stats?.favoriteGenres?.length > 0 && <p className="profile-summary-line"><span>Любимые жанры</span>{stats.favoriteGenres.join(' · ')}</p>}
            <p className="profile-summary-line"><span>До уровня {level.level + 1}</span>{level.next} XP</p>
          </section>

          <section id="profile-comments" className="profile-personal-list">
            <h2>Мои комментарии</h2>
            {ownComments.length ? <ul>{ownComments.map((comment) => <li key={comment.id}>
              <a href={comment.chapter_id ? `/books/${comment.slug}/chapters/${comment.chapter_id}?page=last#chapter-comments` : `/books/${comment.slug}#comments-${comment.book_id}`}>
                <strong>{comment.title}{comment.chapter_number ? ` · гл. ${comment.chapter_number}` : ''}</strong>
                <span>{comment.is_spoiler ? 'Комментарий со спойлером' : comment.body}</span>
              </a>
            </li>)}</ul> : <p>Здесь появятся ваши комментарии к книгам и главам.</p>}
          </section>
          <ProfileRecovery />
          <section className="profile-editor" id="profile-settings">
            <div><h2>Настройки профиля</h2></div>
            <div className="profile-fields">
              <label><span>Имя или псевдоним</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label>
              <label className="profile-wide"><span>О себе</span><textarea rows={3} maxLength={280} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
              <div className="profile-avatar-actions profile-wide">
                <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoSaving}>{photoSaving ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />} {profile.photoUrl ? 'Заменить фото' : 'Добавить фото'}</button>
                {profile.photoUrl && <button type="button" onClick={removePhoto} disabled={photoSaving} aria-label="Удалить фотографию профиля"><Trash2 size={15} /></button>}
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} hidden />
              </div>
              <label><span>Баннер профиля</span><select value={profile.banner} onChange={(event) => setProfile({ ...profile, banner: event.target.value })}><option value="books">Книжные полки</option><option value="stars">Звёздная ночь</option><option value="forest">Лесная библиотека</option><option value="archive">Старинный архив</option><option value="garden">Японский сад</option></select></label>
              <label><span>Цвет приложения</span><select value={profile.appTheme} onChange={(event) => setProfile({ ...profile, appTheme: event.target.value })}>{APP_THEME_OPTIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
              <label><span>Сезонная атмосфера</span><select value={profile.atmosphere} onChange={(event) => setProfile({ ...profile, atmosphere: event.target.value })}><option value="auto">Автоматически</option><option value="none">Выключена</option><option value="spring">Сакура</option><option value="summer">Лето</option><option value="autumn">Осенний дождь</option><option value="winter">Снег</option></select></label>
              <label className="profile-wide"><span>Любимые персонажи — каждый с новой строки</span><textarea rows="4" value={profile.favoriteCharacters.join('\n')} onChange={(event) => setProfile({ ...profile, favoriteCharacters: event.target.value.split('\n').filter(Boolean) })} /></label>
              <label className="profile-wide"><span>Любимые цитаты — каждая с новой строки</span><textarea rows="5" value={profile.favoriteQuotes.join('\n')} onChange={(event) => setProfile({ ...profile, favoriteQuotes: event.target.value.split('\n').filter(Boolean) })} /></label>
              <button type="button" onClick={save}><Save size={17} /> Сохранить профиль</button>
            </div>
          </section>

          <ProfileNotificationSettings />

          <section className="profile-achievements">
            <div className="profile-section-title"><Award size={25} /><div><small>ДОСТИЖЕНИЯ</small><h2>Ваши книжные награды</h2></div></div>
            <div>{achievements.map((item) => <article className={item.unlocked ? 'is-unlocked' : ''} key={item.title}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.unlocked ? 'Получено' : item.hint || 'Пока закрыто'}</small>{item.unlocked ? <Check size={15} /> : null}</article>)}</div>
          </section>

          <section className="profile-shelves">
            <div><small>ПОЛКА ЛЮБИМЫХ КНИГ</small><h2>{favoriteBooks.length ? 'То, к чему хочется возвращаться' : 'Здесь появятся любимые книги'}</h2></div>
            <div>{favoriteBooks.slice(0, 8).map(({ book }) => <a href={`/books/${book.slug}`} key={book.id}>{book.coverUrl ? <img src={book.coverUrl} alt="" /> : <span>B</span>}<strong>{book.title}</strong></a>)}</div>
          </section>

          <section className="profile-reading-history" id="profile-history">
            <div className="profile-section-title"><Library size={24} /><div><h2>История чтения</h2></div></div>
            {enrichedLibrary.some((item) => item.lastChapterId) ? <div>{enrichedLibrary.filter((item) => item.lastChapterId).map((item) =>
              <a href={`/books/${item.book.slug}/chapters/${item.lastChapterId}?page=${Number(item.lastPage || 0) + 1}`} key={item.bookId}><Star size={16} /><span><strong>{item.book.title}</strong><small>Глава {item.chapterNumber || '—'}</small></span></a>
            )}</div> : <p>Здесь появятся главы, которые вы открывали.</p>}
          </section>

          <section className="profile-memory-box">
            <div className="profile-section-title"><Sparkles size={24} /><div><small>КОРОБКА ВОСПОМИНАНИЙ</small><h2>Ваш читательский год</h2></div></div>
            <p>BOOKNERD собирает завершённые книги, любимые цитаты, реакции, заметки и первые впечатления.</p>
            <div><article><strong>{completedBooks.length}</strong><span>завершённых книг</span></article><article><strong>{memories.annotations.length}</strong><span>заметок и выделений</span></article><article><strong>{profile.favoriteQuotes.length}</strong><span>любимых цитат</span></article></div>
            {memories.annotations[0]?.text ? <blockquote>“{memories.annotations[0].text}”</blockquote> : null}
          </section>

          <section className="profile-genres"><h2>Статистика по вкусам</h2><div>{(stats?.favoriteGenres || []).map((genre) => <span key={genre}>{genre}</span>)}</div><p>{stats?.favoriteTropes?.length ? `Любимые тропы: ${stats.favoriteTropes.join(' · ')}` : 'Жанры и тропы появятся по мере чтения.'}</p><div className="profile-taste-facts"><article><small>Любимый автор</small><strong>{stats?.favoriteAuthors?.[0] || '—'}</strong></article><article><small>Любимая страна</small><strong>{stats?.favoriteCountries?.[0] || '—'}</strong></article><article><small>Самый читаемый день</small><strong>{stats?.mostReadDay || '—'}</strong></article><article><small>За эту неделю</small><strong>{stats?.week?.chapters || 0} глав · {formatDuration(stats?.week?.seconds)}</strong></article><article><small>За этот месяц</small><strong>{stats?.wrapped?.chapters || 0} глав · {formatDuration(stats?.wrapped?.seconds)}</strong></article></div></section>
        </div>
      </main>
      <SiteFooter />
      {notice ? <div className="toast" role="status"><Check size={17} />{notice}</div> : null}
    </div>
  );
}
