'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, MessageCircle, Reply, Send, X } from 'lucide-react';
import CommentVotes from './comment-votes.jsx';
import CommentReport from './comment-report.jsx';
import { getVisitorKey } from './site-analytics.js';

async function commentsApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function buildThreads(comments) {
  const byParent = new Map();
  const knownIds = new Set(comments.map((comment) => comment.id));
  comments.forEach((comment) => {
    const parentId = comment.parentId && knownIds.has(comment.parentId) ? comment.parentId : null;
    const siblings = byParent.get(parentId) || [];
    siblings.push(comment);
    byParent.set(parentId, siblings);
  });
  return byParent;
}

function CommentBody({ comment }) {
  const [revealed, setRevealed] = useState(false);
  if (!comment.isSpoiler) return <p>{comment.body}</p>;
  if (!revealed) {
    return (
      <button className="reader-comment-spoiler-cover" type="button" onClick={() => setRevealed(true)}>
        <EyeOff size={22} />
        <span><strong>В комментарии есть спойлер</strong><small>Нажмите, чтобы показать текст</small></span>
      </button>
    );
  }
  return (
    <div className="reader-comment-spoiler-open">
      <p>{comment.body}</p>
      <button type="button" onClick={() => setRevealed(false)}><EyeOff size={14} /> Скрыть спойлер</button>
    </div>
  );
}

export default function CommentsSection({ bookId, chapterId = null }) {
  const [comments, setComments] = useState([]);
  const [authorName, setAuthorName] = useState('');
  const [savedAuthorName, setSavedAuthorName] = useState('');
  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const threads = buildThreads(comments);
  const sectionId = `comments-${chapterId || bookId}`;
  const formId = `comment-form-${chapterId || bookId}`;

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
        body: JSON.stringify({ bookId, chapterId, parentId: replyingTo?.id || null, visitorKey: getVisitorKey(), authorName, body, isSpoiler, website }),
      });
      rememberAuthor(authorName);
      setBody('');
      setIsSpoiler(false);
      setWebsite('');
      setNotice(replyingTo ? 'Ответ опубликован. Читатель получит уведомление, если включил его.' : 'Комментарий опубликован. Он уже виден другим читателям.');
      setReplyingTo(null);
      await loadComments();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  const startReply = (comment) => {
    setReplyingTo(comment);
    setNotice('');
    requestAnimationFrame(() => document.getElementById(formId)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  const renderComment = (comment, depth = 0, visited = new Set()) => {
    if (visited.has(comment.id)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(comment.id);
    const replies = threads.get(comment.id) || [];
    return (
      <div className={`reader-comment-thread ${depth ? 'is-reply-thread' : ''}`} key={comment.id}>
        <article className={`reader-comment ${depth ? 'is-reply' : ''}`}>
          <header className="reader-comment-header">
            <strong>{comment.authorName}</strong>
          </header>
          <CommentBody comment={comment} />
          <div className="reader-comment-actions">
            <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
            <CommentVotes commentId={comment.id} initialUpVotes={comment.upVotes} initialDownVotes={comment.downVotes} compact />
            <button className="reader-comment-reply" type="button" onClick={() => startReply(comment)}><Reply size={13} /> Ответить</button>
            <CommentReport commentId={comment.id} compact />
          </div>
        </article>
        {replies.length ? <div className="reader-comment-replies">{replies.map((reply) => renderComment(reply, depth + 1, nextVisited))}</div> : null}
      </div>
    );
  };

  return (
    <section className="reader-comments" aria-labelledby={sectionId}>
      <div className="reader-comments-heading">
        <span className="editorial-section-number">{chapterId ? 'КОММЕНТАРИИ К ГЛАВЕ' : 'КОММЕНТАРИИ К КНИГЕ'}</span>
        <h2 id={sectionId}>Обсуждение</h2>
        <p>Комментарии публикуются сразу. Если в тексте есть важная деталь сюжета, отметьте её как спойлер.</p>
      </div>

      <div className="reader-comments-layout">
        <div className="reader-comment-list" aria-live="polite">
          {loading ? (
            <div className="reader-comments-empty"><LoaderCircle className="spin" size={22} /> Загружаем комментарии…</div>
          ) : comments.length ? (threads.get(null) || []).map((comment) => renderComment(comment)) : (
            <div className="reader-comments-empty"><MessageCircle size={25} /><span>Пока комментариев нет. Можно быть первой.</span></div>
          )}
        </div>

        <form className="reader-comment-form" id={formId} onSubmit={submit}>
          <h3>{replyingTo ? `Ответ для ${replyingTo.authorName}` : 'Оставить комментарий'}</h3>
          {replyingTo ? <div className="reader-comment-replying"><Reply size={15} /><span>“{replyingTo.body.slice(0, 120)}{replyingTo.body.length > 120 ? '…' : ''}”</span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Отменить ответ"><X size={15} /></button></div> : null}
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
          <label className="reader-comment-spoiler-toggle">
            <input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} />
            <Eye size={20} />
            <span><strong>В комментарии есть спойлер</strong><small>Текст будет скрыт, пока читатель сам его не откроет.</small></span>
          </label>
          <label className="reader-comment-honeypot" aria-hidden="true"><span>Сайт</span><input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <small>{body.length} / 2000</small>
          {notice && <p className="reader-comment-notice">{notice}</p>}
          {error && <p className="reader-comment-error">{error}</p>}
          <button type="submit" disabled={sending}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? 'Публикуем…' : 'Опубликовать комментарий'}</button>
        </form>
      </div>
    </section>
  );
}
