'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, EyeOff, Heart, LoaderCircle, MessageCircle, Plus, Sparkles, UsersRound } from 'lucide-react';
import { SiteFooter, SiteHeader } from './page-chrome.jsx';
import { getVisitorKey } from './site-analytics.js';

const TABS = [
  ['all', 'Всё'], ['club', 'Клубы'], ['readalong', 'Совместное чтение'], ['poll', 'Голосования'], ['theory', 'Теории'],
];
const LABELS = { club: 'Книжный клуб', readalong: 'Совместное чтение', poll: 'Голосование', theory: 'Теория читателя' };

export default function CommunityPage({ books = [] }) {
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [revealed, setRevealed] = useState(new Set());
  const [bestComments, setBestComments] = useState([]);
  const [form, setForm] = useState({ kind: 'theory', authorName: '', title: '', body: '', bookId: '', isSpoiler: false });

  const reload = () => fetch(`/api/community?visitorKey=${encodeURIComponent(getVisitorKey())}`, { cache: 'no-store' }).then((response) => response.json()).then((data) => setPosts(data.posts || []));
  useEffect(() => {
    const savedName = localStorage.getItem('booknerd-comment-name') || '';
    const query = new URLSearchParams(window.location.search);
    const requestedKind = TABS.some(([value]) => value === query.get('kind')) ? query.get('kind') : 'theory';
    const requestedBook = books.some((book) => book.id === query.get('book')) ? query.get('book') : '';
    setForm((current) => ({ ...current, authorName: savedName, kind: requestedKind, bookId: requestedBook }));
    if (requestedKind !== 'theory') setTab(requestedKind);
    Promise.all([
      reload(),
      fetch('/api/discovery', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => setBestComments(data?.commentsWeek || [])),
    ]).catch(() => setNotice('Не удалось загрузить часть обсуждений.')).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => tab === 'all' ? posts : posts.filter((post) => post.kind === tab), [posts, tab]);
  const commentAuthor = bestComments[0]?.author_name || '';

  const send = async (payload) => {
    const response = await fetch('/api/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitorKey: getVisitorKey(), ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Не удалось сохранить.');
    return data;
  };

  const vote = async (post) => {
    try {
      const data = await send({ action: 'vote', postId: post.id });
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, voted: data.voted, votes: data.votes } : item));
    } catch (error) { setNotice(error.message); }
  };

  return (
    <div className="site-shell inner-site-shell community-page">
      <SiteHeader active="community" />
      <main>
        <section className="inner-hero community-hero"><span className="section-number">СООБЩЕСТВО</span><div><h1>Читать — хорошо.<br /><em>Обсуждать — ещё лучше.</em></h1><p>Клубы, совместное чтение, голосования и теории собраны в одном месте. Спойлеры всегда отмечены.</p></div></section>

        <section className="community-content">
          <div className="community-weekly">
            <article><Sparkles size={22} /><span><small>КОММЕНТАРИЙ НЕДЕЛИ</small><strong>{bestComments[0]?.body ? `«${bestComments[0].body}»` : 'Первый лучший комментарий недели ещё впереди.'}</strong></span></article>
            <article><UsersRound size={22} /><span><small>АВТОР КОММЕНТАРИЯ НЕДЕЛИ</small><strong>{commentAuthor || 'Место пока свободно'}</strong></span></article>
          </div>

          <div className="community-layout">
            <div>
              <div className="community-tabs">{TABS.map(([value, label]) => <button className={tab === value ? 'is-active' : ''} type="button" onClick={() => setTab(value)} key={value}>{label}</button>)}</div>
              {loading ? <div className="community-empty"><LoaderCircle className="spin" /> Загружаем обсуждения…</div> : visible.length ? <div className="community-feed">
                {visible.map((post) => {
                  const hidden = post.isSpoiler && !revealed.has(post.id);
                  return <article key={post.id}>
                    <header><span>{LABELS[post.kind]}</span>{post.bookTitle ? <a href={`/books/${post.bookSlug}`}>{post.bookTitle}</a> : null}</header>
                    <h2>{post.title}</h2>
                    {hidden ? <button className="community-spoiler" type="button" onClick={() => setRevealed(new Set([...revealed, post.id]))}><EyeOff size={19} /> Открыть обсуждение со спойлерами</button> : <p>{post.body || (post.kind === 'poll' ? 'Нажмите «Голосовать», чтобы поддержать этот вариант.' : '')}</p>}
                    <footer><span><strong>{post.authorName}</strong><small>{new Date(post.createdAt).toLocaleDateString('ru-RU')}</small></span><button className={post.voted ? 'is-voted' : ''} type="button" onClick={() => vote(post)}><Heart size={16} fill={post.voted ? 'currentColor' : 'none'} /> {post.votes}</button></footer>
                  </article>;
                })}
              </div> : <div className="community-empty"><MessageCircle size={30} /><strong>Здесь пока тихо</strong><p>Создайте первый клуб, опрос или теорию.</p></div>}
            </div>

            <form className="community-create" onSubmit={(event) => {
              event.preventDefault();
              send(form).then(() => {
                localStorage.setItem('booknerd-comment-name', form.authorName);
                setForm((current) => ({ ...current, title: '', body: '', isSpoiler: false }));
                setNotice('Опубликовано в сообществе.');
                reload();
              }).catch((error) => setNotice(error.message));
            }}>
              <div><Plus size={20} /><span><small>НОВОЕ ОБСУЖДЕНИЕ</small><h2>Создать публикацию</h2></span></div>
              <label><span>Формат</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>{TABS.slice(1).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>Книга</span><select value={form.bookId} onChange={(event) => setForm({ ...form, bookId: event.target.value })}><option value="">Без привязки</option>{books.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select></label>
              <label><span>Ваше имя</span><input value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} required /></label>
              <label><span>Название</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
              <label><span>Текст или варианты голосования</span><textarea rows="6" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
              <label className="community-check"><input type="checkbox" checked={form.isSpoiler} onChange={(event) => setForm({ ...form, isSpoiler: event.target.checked })} /><span>Есть спойлеры</span></label>
              <button type="submit"><BookOpen size={17} /> Опубликовать</button>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
      {notice ? <div className="toast" role="status"><Check size={17} />{notice}</div> : null}
    </div>
  );
}
