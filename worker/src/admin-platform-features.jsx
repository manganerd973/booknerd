'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clock3,
  Eye,
  FileClock,
  Flag,
  LoaderCircle,
  Monitor,
  RotateCcw,
  Smartphone,
  Tablet,
  Trash2,
  Vote,
  X,
} from 'lucide-react';
import { richDocumentFor } from '../lib/rich-document.js';

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие.');
  return data;
}

const ERROR_LABELS = {
  typo: 'Опечатка',
  gender: 'Неправильный род',
  missing: 'Пропущенный текст',
  other: 'Другая ошибка',
};

const WORKFLOW_LABELS = {
  draft: 'Черновик',
  translating: 'Переводится',
  editing: 'На редактуре',
  proofreading: 'На проверке',
  ready: 'Готово',
  scheduled: 'Запланировано',
  published: 'Опубликовано',
};

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function AdminErrorReports({ onNotice }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    return api('/api/admin/reader-errors')
      .then((data) => setReports(data.reports || []))
      .catch((error) => onNotice(error.message, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  const toggle = async (report) => {
    try {
      await api('/api/admin/reader-errors', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: report.status === 'new' ? 'resolved' : 'new' }),
      });
      await reload();
    } catch (error) {
      onNotice(error.message, 'error');
    }
  };

  return (
    <section className="admin-content admin-error-page">
      <div className="admin-hero-row">
        <div><span className="admin-kicker">ПРОВЕРКА ТЕКСТА</span><h1>Ошибки от<br /><em>читателей.</em></h1><p>В каждом сообщении уже есть книга, глава, страница и выделенный фрагмент.</p></div>
        <button className="admin-secondary" onClick={reload}><Flag size={17} /> Обновить</button>
      </div>
      {loading ? <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем сообщения…</div> : (
        <div className="admin-error-list">
          {reports.length ? reports.map((report) => (
            <article className={report.status === 'resolved' ? 'is-resolved' : ''} key={report.id}>
              <header><span>{ERROR_LABELS[report.category] || ERROR_LABELS.other}</span><time>{formatDate(report.createdAt)}</time></header>
              <blockquote>“{report.selectedText}”</blockquote>
              {report.details ? <p>{report.details}</p> : null}
              <div><small>«{report.bookTitle}» · глава {report.chapterNumber} · страница {report.page + 1}</small><a href={`/books/${report.bookSlug}/chapters/${report.chapterId}?page=${report.page + 1}`} target="_blank" rel="noreferrer">Открыть место <ArrowRight size={14} /></a></div>
              <button className={report.status === 'resolved' ? 'admin-secondary' : 'admin-primary'} onClick={() => toggle(report)}>{report.status === 'resolved' ? <RotateCcw size={16} /> : <Check size={16} />}{report.status === 'resolved' ? 'Вернуть в работу' : 'Исправлено'}</button>
            </article>
          )) : <div className="admin-empty"><Check size={36} /><h3>Новых ошибок нет</h3><p>Все сообщения читателей обработаны.</p></div>}
        </div>
      )}
    </section>
  );
}

export function AdminVoting({ onNotice }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    return api('/api/admin/voting')
      .then((data) => setCandidates(data.candidates || []))
      .catch((error) => onNotice(error.message, 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  const act = async (candidate, action) => {
    try {
      await api('/api/admin/voting', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: candidate.id, action }),
      });
      await reload();
    } catch (error) {
      onNotice(error.message, 'error');
    }
  };

  return (
    <section className="admin-content admin-voting-page">
      <div className="admin-hero-row">
        <div><span className="admin-kicker">БУДУЩИЕ ПЕРЕВОДЫ</span><h1>Предложения<br /><em>и голосование.</em></h1><p>Сначала читатели предлагают книги. Только выбранные командой варианты становятся официальными.</p></div>
      </div>
      {loading ? <div className="admin-loading"><LoaderCircle className="spin" /> Загружаем варианты…</div> : (
        <div className="admin-voting-columns">
          {[
            ['suggested', 'Предложения читателей'],
            ['official', 'Официальное голосование'],
            ['closed', 'Завершённые'],
          ].map(([status, title]) => (
            <section key={status}>
              <header><h2>{title}</h2><span>{candidates.filter((item) => item.status === status).length}</span></header>
              {candidates.filter((item) => item.status === status).map((candidate) => (
                <article key={candidate.id}>
                  <div><small>{candidate.author || 'Автор не указан'}</small><strong>{candidate.title}</strong><span>{candidate.votes} голосов</span></div>
                  <div>
                    {status === 'suggested' ? <button className="admin-primary" onClick={() => act(candidate, 'approve')}><Vote size={15} /> В голосование</button> : null}
                    {status === 'official' ? <button className="admin-secondary" onClick={() => act(candidate, 'close')}><Check size={15} /> Завершить</button> : null}
                    {status === 'closed' ? <button className="admin-secondary" onClick={() => act(candidate, 'approve')}><RotateCcw size={15} /> Вернуть</button> : null}
                    <button className="admin-danger" onClick={() => act(candidate, 'delete')}><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="admin-voting-note">На сайте читатели всегда видят подпись: «Голосование не является обещанием перевода».</p>
    </section>
  );
}

export function AdminRetention({ retention }) {
  const chapters = retention?.chapters || [];
  const weakest = useMemo(() => chapters.slice().sort((left, right) => left.completionRate - right.completionRate || right.started - left.started).slice(0, 12), [chapters]);
  const waitingTotal = (retention?.waiting || []).reduce((sum, item) => sum + item.readers, 0);
  return (
    <section className="admin-retention">
      <div className="admin-library-insights-head">
        <div><span>УДЕРЖАНИЕ</span><h2>Как читатели проходят главы</h2><p>Старт, завершение, возвраты после уведомлений и ожидание продолжения.</p></div>
        <div className="admin-library-summary">
          <article><strong>{retention?.notificationReturnReaders ?? 0}</strong><small>вернулись после уведомления</small></article>
          <article><strong>{waitingTotal}</strong><small>ждут новую главу</small></article>
        </div>
      </div>
      <div className="admin-library-table-wrap">
        <table className="admin-library-table">
          <thead><tr><th>Глава</th><th>Начали</th><th>Закончили</th><th>Перестали</th><th>Дошли</th></tr></thead>
          <tbody>
            {weakest.length ? weakest.map((item) => (
              <tr key={item.chapterId}>
                <td><strong>{item.bookTitle}</strong><small>Глава {item.chapterNumber} · {item.chapterTitle}</small></td>
                <td>{item.started}</td><td>{item.completed}</td><td>{item.stopped}</td><td><b>{item.completionRate}%</b></td>
              </tr>
            )) : <tr><td colSpan="5" className="admin-library-empty">Статистика появится после первых прочитанных глав.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ChapterHistory({ chapterId, onRestored, onNotice }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ versions: [], audit: [] });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!chapterId) return;
    setLoading(true);
    try {
      setData(await api(`/api/admin/chapters/${chapterId}/versions`));
      setOpen(true);
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const restore = async (version) => {
    if (!window.confirm(`Восстановить версию от ${formatDate(version.createdAt)}? Текущий текст тоже сохранится в истории.`)) return;
    try {
      await api(`/api/admin/chapters/${chapterId}/versions/${version.id}/restore`, { method: 'POST' });
      setOpen(false);
      onNotice('Предыдущая версия главы восстановлена.');
      onRestored?.();
    } catch (error) {
      onNotice(error.message, 'error');
    }
  };

  return (
    <>
      <button className="admin-secondary" type="button" onClick={load} disabled={!chapterId || loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <FileClock size={16} />} История версий</button>
      {open ? (
        <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <aside className="admin-history-modal">
            <header><div><small>НАДЁЖНОЕ ВОССТАНОВЛЕНИЕ</small><h2>История главы</h2></div><button onClick={() => setOpen(false)}><X size={22} /></button></header>
            <div className="admin-history-columns">
              <section><h3>Сохранённые версии</h3>{data.versions.length ? data.versions.map((version) => (
                <article key={version.id}><div><strong>{version.title}</strong><small>{formatDate(version.createdAt)} · {version.savedBy || 'команда'}</small><span>{WORKFLOW_LABELS[version.workflowStatus] || version.workflowStatus}</span></div><button onClick={() => restore(version)}><RotateCcw size={15} /> Восстановить</button></article>
              )) : <p>Предыдущих версий пока нет.</p>}</section>
              <section><h3>Кто и когда редактировал</h3>{data.audit.map((event) => (
                <article key={event.id}><Clock3 size={16} /><div><strong>{event.editorEmail || 'Команда'}</strong><small>{formatDate(event.createdAt)}</small><span>{event.action === 'restored' ? 'Восстановила версию' : `${WORKFLOW_LABELS[event.fromStatus] || event.fromStatus || 'Новая'} → ${WORKFLOW_LABELS[event.toStatus] || event.toStatus}`}</span></div></article>
              ))}</section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function PreviewRuns({ runs = [] }) {
  return runs.map((run, index) => {
    let content = run.text;
    if (run.strike) content = <s>{content}</s>;
    if (run.underline) content = <u>{content}</u>;
    if (run.italic) content = <em>{content}</em>;
    if (run.bold) content = <strong>{content}</strong>;
    return <React.Fragment key={index}>{content}</React.Fragment>;
  });
}

export function ChapterPreview({ book, chapter, onClose }) {
  const [device, setDevice] = useState('phone');
  const documentValue = richDocumentFor(chapter.bodyRich, chapter.body);
  return (
    <div className="admin-modal-backdrop">
      <section className="admin-preview-modal">
        <header>
          <div><small>БЕЗ ПУБЛИКАЦИИ</small><h2>Предпросмотр главы</h2></div>
          <div className="admin-preview-devices">
            <button className={device === 'phone' ? 'is-active' : ''} onClick={() => setDevice('phone')}><Smartphone size={18} /> Телефон</button>
            <button className={device === 'tablet' ? 'is-active' : ''} onClick={() => setDevice('tablet')}><Tablet size={18} /> Планшет</button>
            <button className={device === 'desktop' ? 'is-active' : ''} onClick={() => setDevice('desktop')}><Monitor size={18} /> Компьютер</button>
          </div>
          <button onClick={onClose}><X size={22} /></button>
        </header>
        <div className={`admin-preview-stage is-${device}`}>
          <article>
            <small>{book.title}</small>
            <h1>Глава {chapter.chapterNumber}<span>{chapter.title}</span></h1>
            {chapter.pointOfView ? <em>От лица {chapter.pointOfView}</em> : null}
            <div>{documentValue.blocks.map((block, index) => {
              const Tag = block.type === 'heading' ? 'h2' : block.type === 'blockquote' ? 'blockquote' : 'p';
              return <Tag className={block.chatSide ? `preview-chat is-${block.chatSide}` : ''} key={index}>{block.chatSender ? <small>{block.chatSender}</small> : null}<PreviewRuns runs={block.runs} /></Tag>;
            })}</div>
            {chapter.teamNote ? <aside><SparklesPreview /><p>{chapter.teamNote}</p></aside> : null}
          </article>
        </div>
      </section>
    </div>
  );
}

function SparklesPreview() {
  return <span aria-hidden="true">✦</span>;
}
