import { newMascotLine, normalizeMascotLines } from './mascot-emotions.js';

export function orderedDraftLines(draft = {}) {
  return normalizeMascotLines(draft.lines, { category: draft.category || 'tip' });
}

export function moveDraftLine(lines = [], from, to) {
  const source = [...lines];
  if (from < 0 || from >= source.length || to < 0 || to >= source.length || from === to) return source;
  const [line] = source.splice(from, 1);
  source.splice(to, 0, line);
  return source;
}

export function duplicateDraftLine(lines = [], index, category = 'tip') {
  const source = [...lines];
  const current = source[index];
  if (!current || source.length >= 12) return source;
  source.splice(index + 1, 0, {
    ...newMascotLine(current.character, category, index + 1), ...current,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  });
  return source;
}
