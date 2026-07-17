'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Quote, Send, Star } from 'lucide-react';
import { getCommentVoterKey } from './comment-votes.jsx';
import { RatingStars } from './book-rating.jsx';

async function reviewsApi(url, options) {
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

function ReviewForm({ bookId, initialReview = null, onPublished, completion = false }) {
  const [authorName, setAuthorName] = useState('');
  const [savedAuthorName, setSavedAuthorName] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState(0);
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const savedName = String(localStorage.getItem('booknerd-comment-name') || '').trim();
      if (savedName.length >= 2) {
        setAuthorName(savedName);
        setSavedAuthorName(savedName);
      }
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    if (!initialReview) return;
    setAuthorName(initialReview.authorName || '');
    setSavedAuthorName(initialReview.authorName || '');
    setBody(initialReview.body || '');
    setRating(Number(initialReview.rating || 0));
  }, [initialReview]);

  const rememberAuthor = (value = authorName) => {
    const normalized = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (normalized.length < 2) return false;
    setAuthorName(normalized);
    setSavedAuthorName(normalized);
    try { localStorage.setItem('booknerd-comment-name', normalized); } catch { /* optional */ }
    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setNotice('');
    setError('');
    try {
      const data = await reviewsApi(`/api/books/${bookId}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voterKey: getCommentVoterKey(), authorName, body, rating, website }),
      });
      rememberAuthor(authorName);
      setWebsite('');
      setNotice('Спасибо! Отзыв уже опубликован на странице книги.');
      window.dispatchEvent(new CustomEvent('booknerd:rating-updated', { detail: { bookId } }));
      onPublished?.(data.review);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className={`book-review-form ${completion ? 'is-completion' : ''}`} onSubmit={submit}>
      <div className="book-review-form-title">
        <span>{initialReview ? 'Ваш отзыв' : 'Поделитесь впечатлениями'}</span>
        <h3>{initialReview ? 'Отзыв можно обновить' : 'Оставить отзыв'}</h3>
      </div>
      {savedAuthorName ? (
        <div className="book-review-identity"><span>Вы пишете как <strong>{savedAuthorName}</strong></span><button type="button" onClick={() => { setSavedAuthorName(''); setAuthorName(''); }}>Сменить</button></div>
      ) : (
        <label><span>Имя или псевдоним</span><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} onBlur={() => rememberAuthor(authorName)} minLength={2} maxLength={60} required /></label>
      )}
      <fieldset className="book-review-rating-field">
        <legend>Ваша оценка: {rating ? `${rating} из 10` : 'выберите звёзды'}</legend>
        <RatingStars value={rating} onChange={setRating} disabled={sending} size={completion ? 24 : 21} />
      </fieldset>
      <label><span>Отзыв о книге</span><textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={3000} rows={completion ? 6 : 5} placeholder="Что особенно понравилось? Какие чувства остались после финала?" required /></label>
      <label className="book-review-honeypot" aria-hidden="true"><span>Сайт</span><input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
      <div className="book-review-form-foot"><small>{body.length} / 3000</small><button type="submit" disabled={sending || !rating}>{sending ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}{sending ? 'Публикуем…' : initialReview ? 'Обновить отзыв' : 'Опубликовать отзыв'}</button></div>
      {notice ? <p className="book-review-notice" role="status">{notice}</p> : null}
      {error ? <p className="book-review-error" role="status">{error}</p> : null}
    </form>
  );
}

export function CompletionReviewForm({ bookId, onPublished }) {
  return <ReviewForm bookId={bookId} onPublished={onPublished} completion />;
}

export default function BookReviews({ bookId }) {
  const [reviews, setReviews] = useState([]);
  const [currentReview, setCurrentReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reviewsApi(`/api/books/${bookId}/reviews?voterKey=${encodeURIComponent(getCommentVoterKey())}`);
      setReviews(data.reviews || []);
      setCurrentReview(data.currentReview || null);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="book-reviews" aria-labelledby={`book-reviews-${bookId}`}>
      <div className="book-reviews-heading">
        <div><span className="editorial-section-number">04 / ОТЗЫВЫ ЧИТАТЕЛЕЙ</span><h2 id={`book-reviews-${bookId}`}>После последней<br /><em>страницы.</em></h2></div>
        <p>Расскажите, чем запомнилась история. Отзыв появится здесь сразу после публикации.</p>
      </div>
      <div className="book-reviews-layout">
        <div className="book-review-list" aria-live="polite">
          {loading ? <div className="book-reviews-empty"><LoaderCircle className="spin" size={22} /> Загружаем отзывы…</div> : reviews.length ? reviews.map((review) => (
            <article className="book-review-card" key={review.id}>
              <Quote size={28} />
              <div className="book-review-card-rating"><Star size={15} fill="currentColor" /><strong>{review.rating}/10</strong></div>
              <blockquote>{review.body}</blockquote>
              <footer><strong>{review.authorName}</strong><time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></footer>
            </article>
          )) : <div className="book-reviews-empty"><Quote size={27} /><span>Отзывов пока нет. Ваш может стать первым.</span></div>}
          {error ? <p className="book-review-error">{error}</p> : null}
        </div>
        <ReviewForm bookId={bookId} initialReview={currentReview} onPublished={load} />
      </div>
    </section>
  );
}
