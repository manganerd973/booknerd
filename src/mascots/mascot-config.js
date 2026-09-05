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

export const MASCOT_MODES = [
  { id: 'normal', label: 'Обычный режим', description: 'Редкие реплики и полезные подсказки.' },
  { id: 'more', label: 'Больше Ивана и Тилла', description: 'Немного больше сценок и разговоров.' },
  { id: 'tips', label: 'Только полезные подсказки', description: 'Без флирта и дружеских споров.' },
  { id: 'hidden', label: 'Полностью скрыть', description: 'Помощники не будут появляться на сайте.' },
];

export const MASCOT_QUICK_QUESTIONS = [
  'Подойдёт ли мне эта книга?',
  'Какие здесь предупреждения?',
  'Кто из персонажей мне уже знаком?',
  'В каком порядке читать серию?',
];

export const BUILTIN_DIALOGUES = [
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
    id: 'offline',
    category: 'offline',
    pages: ['offline'],
    lines: [
      { character: 'till', text: 'Кто выключил библиотеку?' },
      { character: 'ivan', text: 'Интернет. Сохранённые книги всё ещё доступны.' },
    ],
  },
];

export const CHAPTER_ENDING_DIALOGUE = [
  { character: 'till', text: 'Я требую следующую главу.' },
  { character: 'ivan', text: 'Эта закончилась три секунды назад.' },
  { character: 'till', text: 'И что?' },
];

export const OFFLINE_DIALOGUE = [
  { character: 'till', text: 'Кажется, связь пропала.' },
  { character: 'ivan', text: 'Но сохранённые книги всё ещё с нами.' },
];

export function loadMascotSettings() {
  if (typeof window === 'undefined') return DEFAULT_MASCOT_SETTINGS;
  try {
    const saved = JSON.parse(localStorage.getItem(MASCOT_SETTINGS_KEY) || '{}');
    return { ...DEFAULT_MASCOT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_MASCOT_SETTINGS;
  }
}

export function saveMascotSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MASCOT_SETTINGS_KEY, JSON.stringify({ ...DEFAULT_MASCOT_SETTINGS, ...settings }));
    window.dispatchEvent(new CustomEvent('booknerd:mascot-settings', { detail: settings }));
  } catch {
    // Preferences remain active until the current page closes.
  }
}

export function mascotPageContext(pathname = '') {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/books/') && pathname.includes('/chapters/')) return 'reader';
  if (pathname.startsWith('/books/')) return 'book';
  if (pathname.startsWith('/notifications')) return 'notifications';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/admin') || pathname.startsWith('/reader-access')) return 'hidden';
  return 'other';
}

export function mascotBookSlug(pathname = '') {
  const match = pathname.match(/^\/books\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}
