'use client';
import React, { useState } from 'react';
export default function AdminCommentReply({ commentId, onSent }) {
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  async function submit() {
    setBusy(true); setNotice('');
    try {
      const response = await fetch(`/api/admin/comments/${commentId}/reply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body, isSpoiler: spoiler }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setBody(''); setNotice('Ответ BOOKNERD опубликован.'); onSent?.();
    } catch (error) { setNotice(error.message || 'Не удалось отправить ответ.'); }
    finally { setBusy(false); }
  }
  return <details style={{ marginTop: 16 }}><summary>Ответить как Администратор BOOKNERD</summary>
    <label>Ответ<textarea rows={4} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} style={{ width: '100%' }} /></label>
    <label><input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} /> Спойлер</label>
    <button type="button" className="admin-primary" disabled={busy || body.trim().length < 3} onClick={submit}>{busy ? 'Отправляем…' : 'Отправить ответ BOOKNERD'}</button>
    {notice && <p role="status">{notice}</p>}
  </details>;
}
