'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, MessageCircle, Send } from 'lucide-react';
import CommentVotes from './comment-votes.jsx';
import CommentReport from './comment-report.jsx';

async function commentsApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  } catch {
    return '';
  }
}

export default function CommentsSection({ bookId, chapterId = null }) {
  const [comments, setComments] = useState([]);
  const [authorName, setAuthorName] = useState('');
  const [savedAuthorName, setSavedAuthorName] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ bookId });
      if (chapterId) query.set('chapterId', chapterId);
      const data = await commentsApi(`/api/comments?${query.toString()}`);
      setComments(data.comments || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId]);

  useEffect(() => {
    try {
      const savedName = String(localStorage.getItem('booknerd-comment-name') || '').trim();
      if (savedName.length >= 2) {
        setAuthorName(savedName);
        setSavedAuthorName(savedName);
      }
    } catch { /* optional */ }
    loadComments();
  }, [loadComments]);

  const rememberAuthor = (value = authorName) => {
    const normalizedName = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (normalizedName.length < 2) return false;
    setAuthorName(normalizedName);
    setSavedAuthorName(normalizedName);
    try { localStorage.setItem('booknerd-comment-name', normalizedName); } catch { /* optional */ }
    return true;
  };

  const changeAuthor = () => {
    setSavedAuthorName('');
    setAuthorName('');
    setNotice('');
    try { localStorage.removeItem('booknerd-comment-name'); } catch { /* optional */ }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setNotice('');
    setError('');
    try {
      await commentsApi('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookId, chapterId, authorName, body, website }),
      });
      rememberAuthor(authorName);
      setBody('');
      setWebsite('');
      setNotice('Комментарий отправлен. Он появится после проверки командой BOOKNERD.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="reader-comments" aria-labelledby={`comments-${chapterId || bookId}`}>
      <div className="reader-comments-heading">
        <span className="editorial-section-number">{chapterId ? 'КОММЕНТАРИИ К ГЛАВЕ' : 'КОММЕНТАРИИ К КНИГЕ'}</span>
        <h2 id={`comments-${chapterId || bookId}`}>Обсуждение</h2>
        <p>Делитесь впечатлениями без спойлеров. Комментарии появляются после проверки.</p>
      </div>

      <div className="reader-comments-layout">
        <div className="reader-comment-list" aria-live="polite">
          {loading ? (
            <div className="reader-comments-empty"><LoaderCircle className="spin" size={22} /> Загружаем комментарии…</div>
          ) : comments.length ? comments.map((comment) => (
            <article className="reader-comment" key={comment.id}>
              <div><strong>{comment.authorName}</strong><time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time></div>
              <p>{comment.body}</p>
              <div className="reader-comment-actions"><CommentVotes commentId={comment.id} initialUpVotes={comment.upVotes} initialDownVotes={comment.downVotes} /><CommentReport commentId={comment.id} /></div>
            </article>
          )) : (
            <div className="reader-comments-empty"><MessageCircle size={25} /><span>Пока комментариев нет. Можно быть первой.</span></div>
          )}
        </div>

        <form className="reader-comment-form" onSubmit={submit}>
          <h3>Оставить комментарий</h3>
          {savedAuthorName ? (
            <div className="reader-comment-identity">
              <span>Вы комментируете как <strong>{savedAuthorName}</strong></span>
              <button type="button" onClick={changeAuthor}>Сменить</button>
            </div>
          ) : (
            <>
              <label><span>Имя или псевдоним</span><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} onBlur={() => rememberAuthor(authorName)} maxLength={60} minLength={2} required /></label>
              <p className="reader-comment-name-help">Введите один раз — сайт запомнит псевдоним на этом устройстве.</p>
            </>
          )}
          <label><span>Комментарий</span><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={6} required /></label>
          <label className="reader-comment-honeypot" aria-hidden="true"><span>Сайт</span><input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <small>{body.length} / 2000</small>
          {notice && <p className="reader-comment-notice">{notice}</p>}
          {error && <p className="reader-comment-error">{error}</p>}
          <button type="submit" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? 'Отправляем…' : 'Отправить на проверку'}</button>
        </form>
      </div>
    </section>
  );
}
