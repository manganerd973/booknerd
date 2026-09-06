const CHARACTER_IDS = new Set(['ivan', 'till']);

export function dialogueFirstSpeaker(dialogue) {
  const character = dialogue?.lines?.find((line) => CHARACTER_IDS.has(line?.character))?.character;
  return CHARACTER_IDS.has(character) ? character : '';
}

export function resolveFirstSpeaker(preference = 'site', editorialDefault = 'ivan', now = Date.now()) {
  const chosen = preference === 'site' ? editorialDefault : preference;
  if (chosen === 'ivan' || chosen === 'till') return chosen;
  return Math.floor(Number(now || 0) / (2 * 60 * 1000)) % 2 === 0 ? 'ivan' : 'till';
}

export function selectDialogueByFirstSpeaker(candidates = [], firstSpeaker = '', now = Date.now()) {
  const source = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (!source.length) return null;
  const matching = CHARACTER_IDS.has(firstSpeaker)
    ? source.filter((dialogue) => dialogueFirstSpeaker(dialogue) === firstSpeaker)
    : source;
  const pool = matching.length ? matching : source;
  return pool[Math.floor(Number(now || 0) / 60000) % pool.length] || null;
}

export function openingDialogue(firstSpeaker = 'ivan') {
  if (firstSpeaker === 'till') {
    return [
      { character: 'till', text: 'Вы открыли нас. Значит, вопрос действительно важный.' },
      { character: 'ivan', text: 'Или Вам просто понравилась кнопка. Оба варианта разумны.' },
    ];
  }
  return [
    { character: 'ivan', text: 'Мы здесь. Спросите о книге, серии или порядке чтения.' },
    { character: 'till', text: 'Я тоже здесь. И моя рекомендация уже почти готова.' },
  ];
}
