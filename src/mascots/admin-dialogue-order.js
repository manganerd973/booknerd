export function secondSpeaker(firstSpeaker) {
  return firstSpeaker === 'ivan' ? 'till' : 'ivan';
}

function textLines(value) {
  return String(value || '').split('\n').map((text) => text.trim()).filter(Boolean);
}

export function orderedDraftLines(draft = {}) {
  const byCharacter = {
    ivan: textLines(draft.ivanText),
    till: textLines(draft.tillText),
  };
  const order = draft.firstSpeaker === 'ivan' ? ['ivan', 'till'] : ['till', 'ivan'];
  const result = [];
  const length = Math.max(byCharacter.ivan.length, byCharacter.till.length);
  for (let index = 0; index < length; index += 1) {
    for (const character of order) {
      const text = byCharacter[character][index];
      if (text) result.push({ character, text });
    }
  }
  return result;
}
