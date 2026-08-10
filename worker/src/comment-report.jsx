'use client';

import React, { useState } from 'react';
import { Flag, LoaderCircle, Send, X } from 'lucide-react';
import { getCommentVoterKey } from './comment-votes.jsx';

const reasons = [
  ['spam', 'Спам или реклама'],
  ['insult', 'Оскорбление или травля'],
  ['spoiler', 'Спойлер без предупреждения'],
  ['inappropriate', 'Неприемлемый текст'],
  ['other', 'Другая причина'],
];

export default function CommentReport({ commentId, compact = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await fetch(`/api/comments/${commentId}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voterKey: getCommentVoterKey(), reason, details }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Жалоба не отправлена.');
      setNotice('Жалоба отправлена команде.');
      setOpen(false);
      setReason('');
      setDetails('');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`comment-report ${compact ? 'is-compact' : ''}`}>
      <button className="comment-report-trigger" type="button" onClick={() => { setOpen((value) => !value); setNotice(''); setError(''); }} aria-expanded={open}>
        <Flag size={compact ? 13 : 14} /> Жалоба
      </button>
      {notice && <span className="comment-report-success" role="status">{notice}</span>}
      {open && (
        <form className="comment-report-form" onSubmit={submit}>
          <div><strong>Почему вы жалуетесь?</strong><button type="button" onClick={() => setOpen(false)} aria-label="Закрыть"><X size={15} /></button></div>
          <label><span>Причина</span><select value={reason} onChange={(event) => setReason(event.target.value)} required><option value="">Выберите причину</option>{reasons.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>Пояснение — необязательно</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3} placeholder="Что именно не так с комментарием?" /></label>
          {error && <p>{error}</p>}
          <button className="comment-report-submit" type="submit" disabled={sending}>{sending ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Отправить жалобу</button>
        </form>
      )}
    </div>
  );
}
