'use client';
import React, { useState } from 'react';
import { getVisitorKey } from './site-analytics.js';
export default function ProfileRecovery() {
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(action) {
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/reader-recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, visitorKey: getVisitorKey(), code: input.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === 'create') { setCode(data.code); return; }
      localStorage.setItem('booknerd-visitor-v1', data.visitorKey);
      window.location.reload();
    } catch (error) { setNotice(error.message || 'Не удалось сохранить доступ в браузере.'); }
    finally { setBusy(false); }
  }
  return <section className="profile-editor" aria-label="Восстановление профиля">
    <h2>Сохранить доступ к профилю</h2>
    <p>Перед удалением приложения сохраните секретный код в надёжном месте. Он вернёт этот профиль после переустановки. Не передавайте код другим людям: он даёт доступ к вашему профилю.</p>
    <button className="shelf-control" disabled={busy} onClick={() => send('create')}>Получить код восстановления</button>
    {code && <label style={{ display: 'block', marginTop: 12 }}>Ваш секретный код<textarea readOnly value={code} onFocus={e => e.target.select()} rows={4} style={{ width: '100%', overflowWrap: 'anywhere' }} /><small>Скопируйте код и сохраните вне приложения.</small></label>}
    <details style={{ marginTop: 20 }}><summary>Вернуть прежний профиль</summary>
      <p>Вставьте ранее сохранённый код. На этом устройстве откроется прежний профиль; данные текущего профиля не объединяются с ним.</p>
      <label>Код восстановления<textarea value={input} onChange={e => setInput(e.target.value)} rows={4} maxLength={200} autoComplete="off" spellCheck={false} style={{ width: '100%' }} /></label>
      <button className="shelf-control" disabled={busy || !input.trim()} onClick={() => send('restore')}>Восстановить профиль</button>
    </details>
    <p>Вернутся данные, сохранённые на сервере. Офлайн-книги и локальные выделения нужно сохранить отдельно. После смены пароля владельца потребуется новый код.</p>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
