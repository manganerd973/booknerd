export function selectDialogue(candidates = [], now = Date.now()) {
  const source = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!source.length) return null;
  return source[Math.floor(Number(now || 0) / 60000) % source.length] || null;
}

export function openingDialogue() {
  return [
    {
      character: 'ivan', text: 'Мы здесь. Спросите о книге, серии или порядке чтения.',
      expression: 'soft-smile', listenerReaction: 'excited', gaze: 'at-reader',
    },
    {
      character: 'till', text: 'Я тоже здесь. И моя рекомендация уже почти готова.',
      expression: 'determined', listenerReaction: 'amused', gaze: 'at-reader',
    },
  ];
}
