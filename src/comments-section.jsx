'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, Reply, Send, X } from 'lucide-react';
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

export default function CommentsSection({ bookId, chapterId = null, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [total, setTotal] = useState(0);
  const [authorName, setAuthorName] = useState('');

  const [body, setBody] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [order, setOrder] = useState('new');
  const ordered = [...comments].sort((a, b) => {
    const newest = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    if (order === 'old') return -newest;
    if (order === 'best') return (Number(b.upVotes || 0) - Number(b.downVotes || 0)) -
      (Number(a.upVotes || 0) - Number(a.downVotes || 0)) || newest;
    return newest;
  });
  const threads = buildThreads(ordered);
  const sectionId = `comments-${chapterId || bookId}`;
  const formId = `comment-form-${chapterId || bookId}`;

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ bookId });
      if (chapterId) query.set('chapterId', chapterId);
      const data = await commentsApi(`/api/comments?${query.toString()}`);
      setComments(data.comments || []);
      const count = Number(data.total ?? data.comments?.length ?? 0);
      setTotal(count);
      onCountChange?.(count);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [bookId, chapterId, onCountChange]);

  useEffect(() => { loadComments(); }, [loadComments]);
  useEffect(() => {
    let active = true;
    commentsApi(`/api/reader-hub?summary=1&visitorKey=${encodeURIComponent(getVisitorKey())}`)
      .then(data => { if (active) setAuthorName(data.displayName || ''); })
      .catch(() => { if (active) setError('Не удалось загрузить профиль. Обновите страницу.'); });
    return () => { active = false; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setNotice('');
    setError('');
    try {
      await commentsApi('/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookId, chapterId: replyingTo?.chapterId || chapterId, parentId: replyingTo?.id || null, visitorKey: getVisitorKey(), body, isSpoiler, website }),
      });
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
            <strong>{comment.isAdmin ? 'BOOKNERD' : comment.authorName}</strong>{comment.isAdmin && <span style={{ color: '#a78bfa', fontWeight: 700 }}> · Администратор BOOKNERD</span>}
          </header>
          {!chapterId && comment.chapterNumber != null && <small className="comment-chapter-label">Глава {comment.chapterNumber}</small>}
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
        <h2 id={sectionId}>Комментарии <small>{total}</small></h2>
      </div>
      <div className="reader-comment-sort" role="group" aria-label="Сортировка комментариев">
        {[['best', 'Лучшие'], ['new', 'Новые'], ['old', 'Старые']].map(([key, label]) =>
          <button type="button" key={key} aria-pressed={order === key} onClick={() => setOrder(key)}>{label}</button>
        )}
      </div>
      <div className="reader-comments-layout">
        <form className="reader-comment-form" id={formId} onSubmit={submit}>
          {replyingTo && <h3>Ответ для {replyingTo.authorName}</h3>}
          {replyingTo ? <div className="reader-comment-replying"><Reply size={15} /><span>“{replyingTo.body.slice(0, 120)}{replyingTo.body.length > 120 ? '…' : ''}”</span><button type="button" onClick={() => setReplyingTo(null)} aria-label="Отменить ответ"><X size={15} /></button></div> : null}
          <div className="reader-comment-identity">{authorName ? <span>Ваш профиль: <strong>{authorName}</strong></span> : <a href="/profile">Укажите имя в профиле, чтобы оставить комментарий</a>}</div>
          <label><span className="visually-hidden">Комментарий</span><textarea placeholder="Напишите комментарий…" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={6} required /></label>
          <label className="reader-comment-spoiler-toggle">
            <input type="checkbox" checked={isSpoiler} onChange={(event) => setIsSpoiler(event.target.checked)} />
            <Eye size={20} />
            <span>Спойлер</span>
          </label>
          <label className="reader-comment-honeypot" aria-hidden="true"><span>Сайт</span><input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <small>{body.length} / 2000</small>
          {notice && <p className="reader-comment-notice">{notice}</p>}
          {error && <p className="reader-comment-error">{error}</p>}
          <div className="reader-comment-submit"><span>Будьте уважительны</span><button type="submit" disabled={sending || !authorName}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />} {sending ? 'Публикуем…' : 'Отправить'}</button></div>
        </form>
        <div className="reader-comment-list" aria-live="polite">
          {loading ? <div className="reader-comments-empty"><LoaderCircle className="spin" size={22} /> Загружаем комментарии…</div>
            : comments.length ? (threads.get(null) || []).map((comment) => renderComment(comment))
            : <p className="reader-comments-empty">{chapterId ? 'Что думаете об этой главе?' : 'Что думаете об этой книге?'}</p>}
        </div>
      </div>
    </section>
  );
}
