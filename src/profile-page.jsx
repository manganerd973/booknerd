'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, BookHeart, BookOpen, Camera, Check, Clock3, Flame, Library, LoaderCircle, Save, Sparkles, Star, Trash2, UserRound } from 'lucide-react';
import { getVisitorKey } from './site-analytics.js';
import { loadReaderLibrary } from './reader-library.jsx';
import { APP_THEME_OPTIONS, setStoredAppTheme, setStoredAtmosphere } from './app-preferences.jsx';
import ProfileNotificationSettings from './profile-notification-settings.jsx';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';

const DEFAULT_PROFILE = { displayName: 'Читатель BOOKNERD', photoUrl: '', photoName: '', banner: 'books', favoriteCharacters: [], favoriteQuotes: [], appTheme: 'original', atmosphere: 'auto' };

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
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [stats, setStats] = useState(null);
  const [library, setLibrary] = useState([]);
  const [memories, setMemories] = useState({ annotations: [], capsules: [] });
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
      fetch(`/api/reader-hub?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()),
      fetch(`/api/reader-stats?visitorKey=${encodeURIComponent(visitorKey)}`, { cache: 'no-store' }).then((response) => response.json()),
      loadReaderLibrary(),
    ]).then(([hub, statData, libraryData]) => {
      if (hub.profile) setProfile({ ...DEFAULT_PROFILE, ...hub.profile });
      setStats(statData.stats || null);
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
      setMemories({ annotations, capsules: hub.capsules || [] });
    }).catch(() => setNotice('Не удалось загрузить часть статистики.'));
  }, []);

  const save = async () => {
    const response = await fetch('/api/reader-hub', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitorKey: getVisitorKey(), action: 'profile', ...profile }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(data.error || 'Не удалось сохранить профиль.'); return; }
    setProfile((current) => ({ ...current, ...data.profile }));
    setStoredAppTheme(data.profile.appTheme);
    setStoredAtmosphere(data.profile.atmosphere);
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
      formData.set('photo', file);
      const response = await fetch('/api/reader-profile-photo', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить фотографию.');
      setProfile((current) => ({ ...current, ...data.photo }));
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
      setNotice('Фотография профиля удалена.');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setPhotoSaving(false);
    }
  };

  return (
    <div className="site-shell inner-site-shell profile-page">
      <SiteHeader active="profile" />
      <main>
        <section className={`profile-banner is-${profile.banner}`}>
          <div className="profile-avatar-wrap">
            <div className={`profile-avatar ${profile.photoUrl ? 'has-photo' : ''}`}>
              {profile.photoUrl ? <img src={profile.photoUrl} alt={`Фото профиля ${profile.displayName}`} /> : <UserRound size={38} />}
            </div>
            <div className="profile-avatar-actions">
              <button type="button" onClick={() => photoInputRef.current?.click()} disabled={photoSaving}>{photoSaving ? <LoaderCircle className="spin" size={15} /> : <Camera size={15} />}<span>{profile.photoUrl ? 'Заменить' : 'Добавить фото'}</span></button>
              {profile.photoUrl ? <button type="button" onClick={removePhoto} disabled={photoSaving} aria-label="Удалить фотографию профиля"><Trash2 size={14} /></button> : null}
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} hidden />
            </div>
          </div>
          <div><small>КАРТОЧКА ЧИТАТЕЛЯ</small><h1>{profile.displayName}</h1><p>Уровень {level.level} · {level.points} очков чтения</p></div>
          <span><Sparkles size={18} /> BOOKNERD READER</span>
        </section>

        <section className="profile-content">
          <div className="profile-stat-grid">
            <article><BookOpen size={20} /><strong>{stats?.chaptersRead || 0}</strong><span>глав прочитано</span></article>
            <article><BookHeart size={20} /><strong>{stats?.booksRead || 0}</strong><span>книг завершено</span></article>
            <article><Clock3 size={20} /><strong>{formatDuration(stats?.readingSeconds)}</strong><span>за чтением</span></article>
            <article><Flame size={20} /><strong>{stats?.longestStreak || 0}</strong><span>дней подряд</span></article>
          </div>

          <section className="profile-editor">
            <div><span className="section-number">МОЙ ПРОФИЛЬ</span><h2>Настройте свою<br /><em>читательскую полку.</em></h2></div>
            <div className="profile-fields">
              <label><span>Имя или псевдоним</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></label>
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

          <section className="profile-reading-history">
            <div className="profile-section-title"><Library size={24} /><div><small>ИСТОРИЯ ЗАВЕРШЁННЫХ КНИГ</small><h2>{completedBooks.length} завершено</h2></div></div>
            {completedBooks.length ? <div>{completedBooks.map(({ book, updatedAt }) => <a href={`/books/${book.slug}`} key={book.id}><Star size={16} /><span><strong>{book.title}</strong><small>{book.author}{book.country ? ` · ${book.country}` : ''}</small></span></a>)}</div> : <p>Первая завершённая история появится здесь.</p>}
          </section>

          <section className="profile-memory-box">
            <div className="profile-section-title"><Sparkles size={24} /><div><small>КОРОБКА ВОСПОМИНАНИЙ</small><h2>Ваш читательский год</h2></div></div>
            <p>BOOKNERD собирает завершённые книги, любимые цитаты, реакции, заметки и первые впечатления.</p>
            <div><article><strong>{completedBooks.length}</strong><span>завершённых книг</span></article><article><strong>{memories.annotations.length}</strong><span>заметок и выделений</span></article><article><strong>{profile.favoriteQuotes.length}</strong><span>любимых цитат</span></article><article><strong>{memories.capsules.length}</strong><span>капсул времени</span></article></div>
            {memories.annotations[0]?.text ? <blockquote>“{memories.annotations[0].text}”</blockquote> : null}
          </section>

          <section className="profile-genres"><h2>Статистика по вкусам</h2><div>{(stats?.favoriteGenres || []).map((genre) => <span key={genre}>{genre}</span>)}</div><p>{stats?.favoriteTropes?.length ? `Любимые тропы: ${stats.favoriteTropes.join(' · ')}` : 'Жанры и тропы появятся по мере чтения.'}</p><div className="profile-taste-facts"><article><small>Любимый автор</small><strong>{stats?.favoriteAuthors?.[0] || '—'}</strong></article><article><small>Любимая страна</small><strong>{stats?.favoriteCountries?.[0] || '—'}</strong></article><article><small>Самый читаемый день</small><strong>{stats?.mostReadDay || '—'}</strong></article><article><small>За эту неделю</small><strong>{stats?.week?.chapters || 0} глав · {formatDuration(stats?.week?.seconds)}</strong></article><article><small>За этот месяц</small><strong>{stats?.wrapped?.chapters || 0} глав · {formatDuration(stats?.wrapped?.seconds)}</strong></article></div></section>
        </section>
      </main>
      <SiteFooter />
      {notice ? <div className="toast" role="status"><Check size={17} />{notice}</div> : null}
    </div>
  );
}
