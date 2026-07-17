'use client';

import React, { useEffect, useState } from 'react';
import { LoaderCircle, Star } from 'lucide-react';
import { getCommentVoterKey } from './comment-votes.jsx';

async function ratingApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить оценку.');
  return data;
}

export function RatingStars({ value = 0, onChange, disabled = false, size = 22, label = 'Оценка книги' }) {
  const [hovered, setHovered] = useState(0);
  const shown = hovered || value;
  return (
    <div className="book-rating-stars" role="group" aria-label={label} onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
        <button
          type="button"
          key={rating}
          className={rating <= shown ? 'is-active' : ''}
          onMouseEnter={() => setHovered(rating)}
          onFocus={() => setHovered(rating)}
          onBlur={() => setHovered(0)}
          onClick={() => onChange?.(rating)}
          disabled={disabled}
          aria-label={`${rating} из 10`}
          aria-pressed={value === rating}
          title={`${rating} из 10`}
        >
          <Star size={size} fill={rating <= shown ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function BookRating({ bookId }) {
  const [summary, setSummary] = useState({ average: 0, count: 0, userRating: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const load = () => {
      const voterKey = getCommentVoterKey();
      ratingApi(`/api/books/${bookId}/rating?voterKey=${encodeURIComponent(voterKey)}`)
        .then((data) => { if (active) setSummary(data); })
        .catch((error) => { if (active) setNotice(error.message); })
        .finally(() => { if (active) setLoading(false); });
    };
    const onRatingUpdated = (event) => { if (event.detail?.bookId === bookId) load(); };
    load();
    window.addEventListener('booknerd:rating-updated', onRatingUpdated);
    return () => { active = false; window.removeEventListener('booknerd:rating-updated', onRatingUpdated); };
  }, [bookId]);

  const rate = async (rating) => {
    const nextRating = summary.userRating === rating ? 0 : rating;
    setSaving(true);
    setNotice('');
    try {
      const data = await ratingApi(`/api/books/${bookId}/rating`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voterKey: getCommentVoterKey(), rating: nextRating }),
      });
      setSummary(data);
      setNotice(nextRating ? `Ваша оценка: ${nextRating} из 10` : 'Оценка сброшена');
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="book-rating-card" aria-label="Оценка читателей">
      <div className="book-rating-summary">
        <span>Оценка читателей</span>
        <strong>{summary.count ? summary.average.toFixed(1) : '—'}<small>/10</small></strong>
        <em>{summary.count ? `${summary.count} ${summary.count === 1 ? 'оценка' : 'оценок'}` : 'Будьте первой'}</em>
      </div>
      <div className="book-rating-action">
        <span>{summary.userRating ? `Ваша оценка — ${summary.userRating}` : 'Оцените книгу от 0 до 10'}</span>
        {loading ? <LoaderCircle className="spin" size={22} /> : <RatingStars value={summary.userRating} onChange={rate} disabled={saving} size={20} />}
        {summary.userRating ? <button type="button" onClick={() => rate(summary.userRating)} disabled={saving}>Поставить 0 / сбросить</button> : null}
        {notice ? <small role="status">{notice}</small> : null}
      </div>
    </section>
  );
}
