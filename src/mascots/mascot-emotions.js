const IVAN_STATE_IDS = [
  'neutral', 'soft-smile', 'amused', 'quiet-laugh', 'teasing',
  'knowing-look', 'focused', 'reading', 'surprised', 'concerned',
  'sad', 'tender', 'embarrassed', 'proud', 'skeptical',
  'sleepy', 'serious', 'celebrating', 'facepalm', 'protective',
];

const TILL_STATE_IDS = [
  'neutral', 'excited', 'very-excited', 'annoyed', 'angry', 'dramatic-angry', 'sulking',
  'offended', 'flustered', 'shy', 'jealous', 'shocked', 'confused', 'suspicious',
  'proud', 'smug', 'sad', 'teary', 'devastated', 'crying-dramatically', 'pleading',
  'thinking', 'reading', 'celebrating', 'scared', 'determined', 'sleepy', 'caught',
];

const EMOTION_LABELS = {
  neutral: 'Спокойное', 'soft-smile': 'Мягкая улыбка', amused: 'Развеселён',
  'quiet-laugh': 'Тихо смеётся', teasing: 'Мягко поддразнивает',
  'knowing-look': 'Понимающий взгляд', focused: 'Сосредоточен', reading: 'Читает',
  surprised: 'Удивлён', concerned: 'Обеспокоен', sad: 'Грустит', tender: 'Тёплый взгляд',
  embarrassed: 'Смущён', proud: 'Гордится', skeptical: 'Сомневается', sleepy: 'Сонный',
  serious: 'Серьёзный', celebrating: 'Празднует', facepalm: 'Прикрывает лицо', protective: 'Защищает',
  excited: 'Радостный', 'very-excited': 'Очень радостный', annoyed: 'Недоволен', angry: 'Сердится',
  'dramatic-angry': 'Драматично возмущён', sulking: 'Дуется', offended: 'Обижен',
  flustered: 'Сильно смущён', shy: 'Робеет', jealous: 'Ревнует', shocked: 'Потрясён',
  confused: 'Озадачен', suspicious: 'Подозревает', smug: 'Самодоволен', teary: 'Со слезами на глазах',
  devastated: 'Разбит', 'crying-dramatically': 'Драматично плачет', pleading: 'Просит', thinking: 'Задумался',
  scared: 'Испуган', determined: 'Решителен', caught: 'Пойман на слове',
};

function makeState(id) {
  return { id, label: EMOTION_LABELS[id] || id };
}

export const MASCOT_EMOTIONS = {
  ivan: IVAN_STATE_IDS.map(makeState),
  till: TILL_STATE_IDS.map(makeState),
};

export const MASCOT_POSES = [
  { id: 'natural', label: 'Естественная' }, { id: 'leaning', label: 'Наклоняется ближе' },
  { id: 'pointing', label: 'Указывает' }, { id: 'hands-folded', label: 'Лапы сложены' },
  { id: 'reading', label: 'С книгой' }, { id: 'award', label: 'С наградой' },
  { id: 'hiding', label: 'Прячется' },
];

export const MASCOT_GAZES = [
  { id: 'forward', label: 'Перед собой' }, { id: 'at-reader', label: 'На читателя' },
  { id: 'at-other', label: 'На второго персонажа' }, { id: 'aside', label: 'В сторону' },
  { id: 'down', label: 'Вниз' }, { id: 'at-book', label: 'На книгу' },
];

export const MASCOT_PLACEMENTS = [
  { id: 'auto', label: 'Автоматически' }, { id: 'edge-left', label: 'У левого края' },
  { id: 'edge-right', label: 'У правого края' }, { id: 'context-card', label: 'У карточки раздела' },
  { id: 'chat', label: 'В окне помощников' }, { id: 'chapter-ending', label: 'После главы' },
];

export const MASCOT_AFTER_ACTIONS = [
  { id: 'next', label: 'Показать следующую реплику' }, { id: 'hold', label: 'Оставить выражение ненадолго' },
  { id: 'neutral', label: 'Вернуть спокойное лицо' }, { id: 'collapse', label: 'Свернуть сценку' },
];

const EMOTION_IDS = {
  ivan: new Set(IVAN_STATE_IDS),
  till: new Set(TILL_STATE_IDS),
};
const POSE_IDS = new Set(MASCOT_POSES.map((item) => item.id));
const GAZE_IDS = new Set(MASCOT_GAZES.map((item) => item.id));
const PLACEMENT_IDS = new Set(MASCOT_PLACEMENTS.map((item) => item.id));
const AFTER_ACTION_IDS = new Set(MASCOT_AFTER_ACTIONS.map((item) => item.id));

const CATEGORY_EMOTIONS = {
  greeting: { ivan: 'soft-smile', till: 'excited' }, returning: { ivan: 'knowing-look', till: 'very-excited' },
  recommendation: { ivan: 'focused', till: 'determined' }, 'new-chapter': { ivan: 'amused', till: 'very-excited' },
  'chapter-ending': { ivan: 'surprised', till: 'shocked' }, search: { ivan: 'skeptical', till: 'confused' },
  empty: { ivan: 'soft-smile', till: 'confused' }, offline: { ivan: 'focused', till: 'annoyed' },
  error: { ivan: 'facepalm', till: 'caught' }, achievement: { ivan: 'proud', till: 'celebrating' },
  seasonal: { ivan: 'soft-smile', till: 'excited' }, banter: { ivan: 'teasing', till: 'dramatic-angry' },
  flirt: { ivan: 'tender', till: 'flustered' }, tip: { ivan: 'focused', till: 'thinking' },
};

const SENSITIVE_PATTERN = /селфхарм|суицид|насили|утрат|травм|дискриминац|религи|смерт|предупрежден|триггер/iu;

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function emotionOptions(character) {
  return MASCOT_EMOTIONS[character === 'till' ? 'till' : 'ivan'];
}

export function isApprovedEmotion(character, emotion) {
  return EMOTION_IDS[character === 'till' ? 'till' : 'ivan'].has(emotion);
}

export function defaultEmotion(character, category = 'tip', text = '', sensitive = false) {
  const mascot = character === 'till' ? 'till' : 'ivan';
  if (sensitive || SENSITIVE_PATTERN.test(String(text || ''))) return mascot === 'ivan' ? 'serious' : 'sad';
  const normalized = String(text || '').toLocaleLowerCase('ru-RU');
  if (/не был готов|тяж[её]л|разбил|разбита/iu.test(normalized)) return mascot === 'ivan' ? 'concerned' : 'devastated';
  if (/следующ(ая|ую) глав|требую/iu.test(normalized)) return mascot === 'ivan' ? 'amused' : 'pleading';
  if (/ошиб|не удалось|пропала/iu.test(normalized)) return mascot === 'ivan' ? 'facepalm' : 'caught';
  if (/поздрав|уровень|ранг|награ|достижен/iu.test(normalized)) return mascot === 'ivan' ? 'proud' : 'celebrating';
  if (/спокойн|точн|провер|информац|порядок/iu.test(normalized)) return mascot === 'ivan' ? 'focused' : 'thinking';
  return CATEGORY_EMOTIONS[category]?.[mascot] || 'neutral';
}

export function defaultListenerReaction(character, expression, sensitive = false) {
  const listener = character === 'till' ? 'ivan' : 'till';
  if (sensitive) return listener === 'ivan' ? 'concerned' : 'sad';
  if (character === 'till') {
    if (['sad', 'teary', 'devastated', 'crying-dramatically', 'scared'].includes(expression)) return 'protective';
    if (['dramatic-angry', 'angry', 'annoyed', 'sulking', 'jealous'].includes(expression)) return 'amused';
    if (['flustered', 'shy', 'caught'].includes(expression)) return 'knowing-look';
    return 'soft-smile';
  }
  if (['teasing', 'amused', 'quiet-laugh', 'knowing-look'].includes(expression)) return 'caught';
  if (['tender', 'protective'].includes(expression)) return 'shy';
  if (['serious', 'concerned', 'sad'].includes(expression)) return 'sad';
  return 'neutral';
}

export function normalizeMascotLine(line = {}, { category = 'tip', index = 0, sensitive = false } = {}) {
  const character = line.character === 'till' ? 'till' : 'ivan';
  const text = String(line.text || '').replace(/\s+/g, ' ').trim().slice(0, 800);
  const forcedSensitive = sensitive || SENSITIVE_PATTERN.test(text);
  const expression = !forcedSensitive && isApprovedEmotion(character, line.expression)
    ? line.expression : defaultEmotion(character, category, text, forcedSensitive);
  const listener = character === 'till' ? 'ivan' : 'till';
  const listenerReaction = !forcedSensitive && isApprovedEmotion(listener, line.listenerReaction)
    ? line.listenerReaction : defaultListenerReaction(character, expression, forcedSensitive);
  return {
    id: String(line.id || '').trim().slice(0, 80) || `line-${index + 1}`,
    character, text, expression,
    pose: POSE_IDS.has(line.pose) ? line.pose : 'natural',
    gaze: GAZE_IDS.has(line.gaze) ? line.gaze : character === 'ivan' ? 'at-other' : 'forward',
    listenerReaction,
    delayMs: clampInteger(line.delayMs, index === 0 ? 500 : 350, 0, 10000),
    durationMs: clampInteger(line.durationMs, 2600, 900, 15000),
    placement: PLACEMENT_IDS.has(line.placement) ? line.placement : 'auto',
    afterAction: AFTER_ACTION_IDS.has(line.afterAction) ? line.afterAction : 'next',
  };
}

export function normalizeMascotLines(lines = [], options = {}) {
  return (Array.isArray(lines) ? lines : []).map((line, index) => normalizeMascotLine(line, { ...options, index }))
    .filter((line) => line.text).slice(0, 12);
}

export function newMascotLine(character = 'till', category = 'tip', index = 0) {
  const mascot = character === 'ivan' ? 'ivan' : 'till';
  const expression = defaultEmotion(mascot, category);
  return normalizeMascotLine({
    id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    character: mascot, text: '', expression, listenerReaction: defaultListenerReaction(mascot, expression),
  }, { category, index });
}

const VISUAL_PRESETS = {
  ivan: {
    neutral: ['half','tiny','none','none'], 'soft-smile': ['soft','smile','soft','none'], amused: ['closed','grin','soft','none'],
    'quiet-laugh': ['closed','smile','soft','paw'], teasing: ['skeptic','smirk','soft','none'], 'knowing-look': ['side','smirk','soft','none'],
    focused: ['focused','flat','none','none'], reading: ['down','tiny','none','book'], surprised: ['wide','o','none','spark'],
    concerned: ['sad','flat','none','none'], sad: ['sad','frown','none','tear'], tender: ['soft','smile','soft','heart'],
    embarrassed: ['aside','tiny','strong','none'], proud: ['closed','smile','soft','spark'], skeptical: ['skeptic','flat','none','none'],
    sleepy: ['sleepy','tiny','none','zzz'], serious: ['focused','flat','none','none'], celebrating: ['happy','smile','soft','award'],
    facepalm: ['closed','flat','none','paw'], protective: ['soft','flat','none','heart'],
  },
  till: {
    neutral: ['open','tiny','none','none'], excited: ['happy','smile','soft','spark'], 'very-excited': ['happy','open','soft','spark'],
    annoyed: ['angry','flat','none','none'], angry: ['angry','frown','none','anger'], 'dramatic-angry': ['angry','open','none','anger'],
    sulking: ['aside','pout','soft','none'], offended: ['sad','pout','soft','none'], flustered: ['wide','o','strong','heart'],
    shy: ['aside','tiny','strong','heart'], jealous: ['side','flat','soft','none'], shocked: ['wide','open','none','spark'],
    confused: ['uneven','o','none','question'], suspicious: ['skeptic','flat','none','none'], proud: ['happy','smile','soft','spark'],
    smug: ['half','smirk','soft','none'], sad: ['sad','frown','none','none'], teary: ['sad','frown','none','tear'],
    devastated: ['closed','frown','none','tear'], 'crying-dramatically': ['closed','open','none','cry'], pleading: ['wide','tiny','soft','tear'],
    thinking: ['side','tiny','none','question'], reading: ['down','smile','none','book'], celebrating: ['happy','open','soft','award'],
    scared: ['wide','o','none','sweat'], determined: ['angry','smile','none','spark'], sleepy: ['sleepy','open','none','zzz'],
    caught: ['wide','o','strong','sweat'],
  },
};

export function emotionVisual(character, emotion) {
  const mascot = character === 'till' ? 'till' : 'ivan';
  const [eyes, mouth, blush, mark] = VISUAL_PRESETS[mascot][emotion] || VISUAL_PRESETS[mascot].neutral;
  return { eyes, mouth, blush, mark };
}
