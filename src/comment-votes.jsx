'use client';

import React, { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

const voterStorageKey = 'booknerd-comment-voter';
const votesStorageKey = 'booknerd-comment-votes';
let inMemoryVoterKey = '';

export function getCommentVoterKey() {
  let key = inMemoryVoterKey;
  try { key = localStorage.getItem(voterStorageKey) || key; } catch { /* browser storage is optional */ }
  if (!key) {
    key = typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    inMemoryVoterKey = key;
    try { localStorage.setItem(voterStorageKey, key); } catch { /* browser storage is optional */ }
  }
  return key;
}

function readSavedVote(commentId) {
  try {
    const saved = JSON.parse(localStorage.getItem(votesStorageKey) || '{}');
    return Number(saved[commentId] || 0);
  } catch {
    return 0;
  }
}

function saveVote(commentId, vote) {
  try {
    const saved = JSON.parse(localStorage.getItem(votesStorageKey) || '{}');
    if (vote) saved[commentId] = vote;
    else delete saved[commentId];
    localStorage.setItem(votesStorageKey, JSON.stringify(saved));
  } catch { /* browser storage is optional */ }
}

export default function CommentVotes({ commentId, initialUpVotes = 0, initialDownVotes = 0, compact = false }) {
  const [upVotes, setUpVotes] = useState(Number(initialUpVotes || 0));
  const [downVotes, setDownVotes] = useState(Number(initialDownVotes || 0));
  const [currentVote, setCurrentVote] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setCurrentVote(readSavedVote(commentId)); }, [commentId]);

  const vote = async (value) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voterKey: getCommentVoterKey(), value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Голос не сохранён.');
      setUpVotes(Number(data.upVotes || 0));
      setDownVotes(Number(data.downVotes || 0));
      setCurrentVote(Number(data.vote || 0));
      saveVote(commentId, Number(data.vote || 0));
    } catch (voteError) {
      setError(voteError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`comment-votes ${compact ? 'is-compact' : ''}`} title={error || 'Оценить комментарий'}>
      <button type="button" className={currentVote === 1 ? 'is-active' : ''} onClick={() => vote(1)} disabled={saving} aria-pressed={currentVote === 1} aria-label="Поставить палец вверх">
        <ThumbsUp size={compact ? 14 : 16} /> <span>{upVotes}</span>
      </button>
      <button type="button" className={currentVote === -1 ? 'is-active is-down' : ''} onClick={() => vote(-1)} disabled={saving} aria-pressed={currentVote === -1} aria-label="Поставить палец вниз">
        <ThumbsDown size={compact ? 14 : 16} /> <span>{downVotes}</span>
      </button>
      {error && <span className="comment-vote-error" role="status">!</span>}
    </div>
  );
}
