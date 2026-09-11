export const MASCOT_SETTINGS_KEY = 'booknerd-mascot-settings-v1';
export const MASCOT_HISTORY_KEY = 'booknerd-mascot-history-v1';
export const MASCOT_RECENT_KEY = 'booknerd-mascot-recent-v1';

export const DEFAULT_MASCOT_SETTINGS = {
  mode: 'normal',
  quietReading: true,
  reducedMotion: false,
  showGreeting: true,
  showChapterEnding: true,
  showRecommendations: true,
};

export const MASCOT_MODE_IDS = new Set(['normal', 'more', 'tips', 'hidden']);

export const MASCOT_MODE_PREVIEWS = {
  normal: {
    id: 'mode-preview-normal',
    category: 'banter',
    pages: [],
    lines: [
      { character: 'till', text: 'Обычный режим включён. Мы будем появляться редко.' },
      { character: 'ivan', text: 'Настолько редко, чтобы Тилл успевал придумать достойную реплику.' },
    ],
  },
  more: {
    id: 'mode-preview-more',
    category: 'banter',
    pages: [],
    lines: [
      { character: 'till', text: 'Теперь нас будет больше. Это правильное решение.' },
      { character: 'ivan', text: 'Смелое заявление человека, который уже занял половину экрана.' },
      { character: 'till', text: 'Я украшаю интерфейс.' },
    ],
  },
  tips: {
    id: 'mode-preview-tips',
    category: 'tip',
    pages: [],
    lines: [
      { character: 'ivan', text: 'Режим подсказок включён. Покажем только полезную информацию без сценок и споров.' },
    ],
  },
};

export const MASCOT_MODES = [
  { id: 'normal', label: 'Обычный режим', description: 'Редкие реплики и полезные подсказки.' },
  { id: 'more', label: 'Больше Ивана и Тилла', description: 'Немного больше сценок и разговоров.' },
  { id: 'tips', label: 'Только полезные подсказки', description: 'Без флирта и дружеских споров.' },
  { id: 'hidden', label: 'Полностью скрыть', description: 'Помощники не будут появляться на сайте.' },
];

export const MASCOT_QUICK_QUESTIONS = [
  'Какие здесь предупреждения?',
  'Кто из персонажей мне уже знаком?',
  'В каком порядке читать серию?',
];

export const BUILTIN_DIALOGUES = [
  {
    id: 'new-reader-welcome',
    category: 'greeting',
    pages: ['home'],
    lines: [
      { character: 'till', text: 'О, новый читатель! Мне сразу показать Вам лучшие книги?' },
      { character: 'ivan', text: 'Сначала позволь человеку осмотреться.' },
      { character: 'till', text: 'Я не мешаю. Я создаю гостеприимную атмосферу.' },
      { character: 'ivan', text: 'Очень громкую гостеприимную атмосферу.' },
    ],
  },
  {
    id: 'welcome',
    category: 'greeting',
    pages: ['home'],
    lines: [
      { character: 'till', text: 'Она вернулась!' },
      { character: 'ivan', text: 'Ты ждал.' },
      { character: 'till', text: 'Я охранял библиотеку.' },
      { character: 'ivan', text: 'Конечно. Особенно страницу её профиля.' },
    ],
  },
  {
    id: 'recommendation',
    category: 'recommendation',
    pages: ['home', 'book'],
    lines: [
      { character: 'till', text: 'Я проверяю рекомендации. Очень внимательно.' },
      { character: 'ivan', text: 'Уже одиннадцатый раз.' },
      { character: 'till', text: 'Это называется ответственность.' },
    ],
  },
  {
    id: 'home-tip',
    category: 'tip',
    pages: ['home'],
    lines: [
      { character: 'ivan', text: 'Продолжить чтение можно с последней сохранённой страницы на главной.' },
    ],
  },
  {
    id: 'book-page',
    category: 'tip',
    pages: ['book'],
    lines: [
      { character: 'ivan', text: 'Откройте предупреждения и тропы перед чтением.' },
      { character: 'till', text: 'И карту отношений. Но только без спойлеров.' },
    ],
  },
  {
    id: 'notifications',
    category: 'new-chapter',
    pages: ['notifications'],
    lines: [
      { character: 'till', text: 'Новая глава! Я уже всё проверил.' },
      { character: 'ivan', text: 'Он прочитал только заголовок.' },
      { character: 'till', text: 'Этого было достаточно.' },
    ],
  },
  {
    id: 'notifications-tip',
    category: 'tip',
    pages: ['notifications'],
    lines: [
      { character: 'ivan', text: 'В уведомлении видно, где Вы остановились и какие новые главы уже опубликованы.' },
    ],
  },
  {
    id: 'library-tip',
    category: 'tip',
    pages: ['library'],
    lines: [
      { character: 'ivan', text: 'Скачанные книги находятся на полке «Офлайн» и открываются без интернета.' },
    ],
  },
  {
    id: 'library-till-tip',
    category: 'tip',
    pages: ['library'],
    lines: [
      { character: 'till', text: 'Офлайн-книги уже ждут на отдельной полке.' },
      { character: 'ivan', text: 'Он проверил. На этот раз действительно отдельной.' },
    ],
  },
  {
    id: 'profile-tip',
    category: 'tip',
    pages: ['profile'],
    lines: [
      { character: 'ivan', text: 'Здесь можно в любой момент изменить режим помощников или полностью скрыть нас.' },
    ],
  },
  {
    id: 'profile-till-tip',
    category: 'tip',
    pages: ['profile'],
    lines: [
      { character: 'till', text: 'Здесь можно решить, как часто мы будем появляться.' },
      { character: 'ivan', text: 'Тилл уже подготовил аргументы в пользу варианта «чаще».' },
    ],
  },
  {
    id: 'offline',
    category: 'offline',
    pages: ['offline'],
    lines: [
      { character: 'till', text: 'Кто выключил библиотеку?' },
      { character: 'ivan', text: 'Интернет. Сохранённые книги всё ещё доступны.' },
    ],
  },
  {
    id: 'offline-ivan',
    category: 'offline',
    pages: ['offline'],
    lines: [
      { character: 'ivan', text: 'Связи нет, но сохранённые книги доступны.' },
      { character: 'till', text: 'Я всё равно выясню, кто выключил библиотеку.' },
    ],
  },
];

export const CHAPTER_ENDING_DIALOGUES = {
  till: [
    { character: 'till', text: 'Я требую следующую главу.' },
    { character: 'ivan', text: 'Эта закончилась три секунды назад.' },
    { character: 'till', text: 'И что?' },
  ],
  ivan: [
    { character: 'ivan', text: 'Глава закончилась. Можно спокойно выдохнуть.' },
    { character: 'till', text: 'Спокойно? После такого финала?' },
    { character: 'ivan', text: 'Хорошо. Выдохнуть драматично.' },
  ],
};

export const CHAPTER_ENDING_DIALOGUE = CHAPTER_ENDING_DIALOGUES.till;

export const OFFLINE_DIALOGUE = [
  { character: 'till', text: 'Кажется, связь пропала.' },
  { character: 'ivan', text: 'Но сохранённые книги всё ещё с нами.' },
];

export function normalizeMascotSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    mode: MASCOT_MODE_IDS.has(source.mode) ? source.mode : DEFAULT_MASCOT_SETTINGS.mode,
    quietReading: source.quietReading !== false,
    reducedMotion: source.reducedMotion === true,
    showGreeting: source.showGreeting !== false,
    showChapterEnding: source.showChapterEnding !== false,
    showRecommendations: source.showRecommendations !== false,
  };
}

export function loadMascotSettings() {
  if (typeof window === 'undefined') return DEFAULT_MASCOT_SETTINGS;
  try {
    const saved = JSON.parse(localStorage.getItem(MASCOT_SETTINGS_KEY) || '{}');
    return normalizeMascotSettings(saved);
  } catch {
    return DEFAULT_MASCOT_SETTINGS;
  }
}

export function hasStoredMascotSettings() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(localStorage.getItem(MASCOT_SETTINGS_KEY));
  } catch {
    return false;
  }
}

export function saveMascotSettings(settings) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeMascotSettings(settings);
  try {
    localStorage.setItem(MASCOT_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Preferences remain active until the current page closes.
  }
  window.dispatchEvent(new CustomEvent('booknerd:mascot-settings', { detail: normalized }));
}

export function mascotPageContext(pathname = '') {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/books/') && pathname.includes('/chapters/')) return 'reader';
  if (pathname.startsWith('/books/')) return 'book';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/library/offline') || (pathname.startsWith('/library') && /[?&]tab=offline(?:&|$)/.test(pathname))) return 'offline';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/admin') || pathname.startsWith('/reader-access')) return 'hidden';
  return 'other';
}

export function mascotBookSlug(pathname = '') {
  const match = pathname.match(/^\/books\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
