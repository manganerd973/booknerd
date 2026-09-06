const BUILTIN_SENSITIVE = /селфхарм|самоповреж|суицид|насили|изнасил|утрат|травм|дискриминац|религи/iu;
const FUTURE_INTENT = /что\s+будет|что\s+случится|чем\s+(?:всё\s+)?законч|кто\s+(?:умр|погиб|предаст)|будут\s+ли\s+вместе|тайн(?:а|у|ой)|настоящ(?:ая|ее|ий)\s+(?:личность|имя)|финал|ответ\s+со\s+спойлер/iu;

export function isSensitiveMascotQuestion(question, blockedTopics = []) {
  const normalized = String(question || '').trim().toLocaleLowerCase('ru-RU');
  if (BUILTIN_SENSITIVE.test(normalized)) return true;
  return (Array.isArray(blockedTopics) ? blockedTopics : []).some((topic) => {
    const normalizedTopic = String(topic || '').trim().toLocaleLowerCase('ru-RU');
    return normalizedTopic.length >= 3 && normalized.includes(normalizedTopic);
  });
}

export function needsSpoilerConfirmation({ question, progressChapter = 0, publishedChapterCount = 0, allowSpoilers = false }) {
  if (allowSpoilers || !isFutureMascotQuestion(question)) return false;
  const progress = Math.max(0, Number(progressChapter || 0));
  const published = Math.max(0, Number(publishedChapterCount || 0));
  return published > progress;
}

export function isFutureMascotQuestion(question) {
  return FUTURE_INTENT.test(String(question || ''));
}

export function spoilerConfirmationMessages(firstSpeaker = 'ivan') {
  const line = 'Ответ может затронуть непрочитанные главы. Показать информацию из уже опубликованных глав?';
  return [{ character: firstSpeaker === 'till' ? 'till' : 'ivan', text: line }];
}
