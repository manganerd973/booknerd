export const DEFAULT_XP_VALUES = Object.freeze({
  chapter: 5,
  book: 100,
  series: 200,
  review: 20,
  confirmedError: 5,
  threeReadingDays: 15,
  groupRead: 30,
});

export const DEFAULT_LEVEL_CURVE = Object.freeze({ base: 40, growth: 10 });

export const DEFAULT_RANKS = Object.freeze([
  { key: 'newcomer', minLevel: 1, name: 'Новичок библиотеки', icon: '◇', frameColor: '#d5c9b4' },
  { key: 'seeker', minLevel: 5, name: 'Искатель историй', icon: '⌑', frameColor: '#bb9361' },
  { key: 'wanderer', minLevel: 10, name: 'Книжный странник', icon: '❧', frameColor: '#7d9d78' },
  { key: 'keeper', minLevel: 20, name: 'Хранитель страниц', icon: '▣', frameColor: '#bea450' },
  { key: 'archivist', minLevel: 30, name: 'Архивариус', icon: '❦', frameColor: '#d0ac49' },
  { key: 'expert', minLevel: 40, name: 'Знаток историй', icon: '▤', frameColor: '#6d746f' },
  { key: 'master', minLevel: 50, name: 'Мастер BOOKNERD', icon: '✦', frameColor: '#d0ad4e' },
  { key: 'legend', minLevel: 60, name: 'Легенда библиотеки', icon: '✧', frameColor: '#e0bb53' },
]);

export const DEFAULT_NOMINATIONS = Object.freeze([
  { key: 'master-month', name: 'Мастер месяца', metric: 'monthXp', enabled: true },
  { key: 'rising-reader', name: 'Восходящий читатель', metric: 'levelGrowth', enabled: true },
  { key: 'genre-explorer', name: 'Исследователь жанров', metric: 'genreCount', enabled: true },
  { key: 'series-keeper', name: 'Хранитель серии', metric: 'seriesCompleted', enabled: true },
  { key: 'community-voice', name: 'Голос сообщества', metric: 'reviews', enabled: true },
  { key: 'sharp-editor', name: 'Зоркий редактор', metric: 'confirmedErrors', enabled: true },
  { key: 'quote-collector', name: 'Коллекционер цитат', metric: 'quotesSaved', enabled: true },
]);

export const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  { key: 'first-chapter', icon: '📖', name: 'Первая глава', description: 'Прочитана первая глава BOOKNERD.' },
  { key: 'first-book', icon: '♡', name: 'Первая завершённая книга', description: 'Завершена первая книга.' },
  { key: 'first-series', icon: '◫', name: 'Первая завершённая серия', description: 'Завершена первая книжная серия.' },
  { key: 'five-books', icon: 'Ⅴ', name: 'Пять прочитанных книг', description: 'Завершено пять книг.' },
  { key: 'ten-books', icon: 'Ⅹ', name: 'Десять прочитанных книг', description: 'Завершено десять книг.' },
  { key: 'fifty-books', icon: '50', name: 'Пятьдесят прочитанных книг', description: 'Завершено пятьдесят книг.' },
  { key: 'hundred-chapters', icon: '100', name: 'Сто прочитанных глав', description: 'Прочитано сто уникальных глав.' },
  { key: 'thousand-chapters', icon: '1K', name: 'Тысяча прочитанных глав', description: 'Прочитана тысяча уникальных глав.' },
  { key: 'first-review', icon: '✎', name: 'Первый отзыв', description: 'Опубликован первый содержательный отзыв.' },
  { key: 'ten-reviews', icon: '✐', name: 'Десять полезных отзывов', description: 'Опубликовано десять содержательных отзывов.' },
  { key: 'first-quote', icon: '❝', name: 'Первая сохранённая цитата', description: 'Сохранена первая любимая цитата.' },
  { key: 'quote-collector', icon: '❞', name: 'Коллекционер цитат', description: 'Сохранено десять любимых цитат.' },
  { key: 'return-story', icon: '↺', name: 'Возвращение к истории', description: 'Вы вернулись к уже прочитанной главе.' },
  { key: 'night-reader', icon: '☾', name: 'Ночной читатель', description: 'Одна из глав была прочитана ночью.' },
  { key: 'winter-reader', icon: '❄', name: 'Зимний читатель', description: 'Вы читали BOOKNERD зимой.' },
  { key: 'autumn-reader', icon: '🍂', name: 'Осенний книжный сезон', description: 'Вы читали BOOKNERD осенью.' },
  { key: 'one-year', icon: '✦', name: 'С BOOKNERD уже год', description: 'Вашему читательскому профилю исполнился год.' },
  { key: 'genre-explorer', icon: '⌘', name: 'Исследователь жанров', description: 'Прочитаны книги как минимум пяти жанров.' },
  { key: 'series-keeper', icon: '▥', name: 'Хранитель серии', description: 'Завершена книжная серия.' },
  { key: 'sharp-reader', icon: '⌕', name: 'Зоркий читатель', description: 'Подтверждены пять сообщений об ошибках.' },
]);

export const DEFAULT_READER_LEVEL_CONFIG = Object.freeze({
  xp: DEFAULT_XP_VALUES,
  levelCurve: DEFAULT_LEVEL_CURVE,
  ranks: DEFAULT_RANKS,
  nominations: DEFAULT_NOMINATIONS,
  homeCardCount: 5,
});

function integer(value, fallback, min, max) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function sanitizeReaderLevelConfig(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const xpSource = source.xp && typeof source.xp === 'object' ? source.xp : {};
  const curveSource = source.levelCurve && typeof source.levelCurve === 'object' ? source.levelCurve : {};
  const ranksSource = Array.isArray(source.ranks) ? source.ranks : [];
  const nominationsSource = Array.isArray(source.nominations) ? source.nominations : [];
  const ranks = DEFAULT_RANKS.map((rank) => {
    const custom = ranksSource.find((item) => item?.key === rank.key) || {};
    return {
      ...rank,
      name: String(custom.name || rank.name).trim().slice(0, 60) || rank.name,
      minLevel: integer(custom.minLevel, rank.minLevel, 1, 999),
      frameColor: /^#[0-9a-fA-F]{6}$/.test(String(custom.frameColor || '')) ? custom.frameColor : rank.frameColor,
    };
  }).sort((left, right) => left.minLevel - right.minLevel);
  const nominations = DEFAULT_NOMINATIONS.map((nomination) => {
    const custom = nominationsSource.find((item) => item?.key === nomination.key) || {};
    return { ...nomination, enabled: custom.enabled !== false };
  });
  return {
    xp: {
      chapter: integer(xpSource.chapter, DEFAULT_XP_VALUES.chapter, 0, 1000),
      book: integer(xpSource.book, DEFAULT_XP_VALUES.book, 0, 5000),
      series: integer(xpSource.series, DEFAULT_XP_VALUES.series, 0, 10000),
      review: integer(xpSource.review, DEFAULT_XP_VALUES.review, 0, 1000),
      confirmedError: integer(xpSource.confirmedError, DEFAULT_XP_VALUES.confirmedError, 0, 1000),
      threeReadingDays: integer(xpSource.threeReadingDays, DEFAULT_XP_VALUES.threeReadingDays, 0, 1000),
      groupRead: integer(xpSource.groupRead, DEFAULT_XP_VALUES.groupRead, 0, 5000),
    },
    levelCurve: {
      base: integer(curveSource.base, DEFAULT_LEVEL_CURVE.base, 10, 1000),
      growth: integer(curveSource.growth, DEFAULT_LEVEL_CURVE.growth, 1, 200),
    },
    ranks,
    nominations,
    homeCardCount: integer(source.homeCardCount, 5, 1, 5),
  };
}

export function xpForLevel(level, curve = DEFAULT_LEVEL_CURVE) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const step = safeLevel - 1;
  return Math.round(Number(curve.growth || 10) * step * step + Number(curve.base || 40) * step);
}

export function levelForXp(xp, curve = DEFAULT_LEVEL_CURVE) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (level < 999 && xpForLevel(level + 1, curve) <= safeXp) level += 1;
  return level;
}

export function rankForLevel(level, ranks = DEFAULT_RANKS) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return [...ranks].sort((left, right) => left.minLevel - right.minLevel)
    .filter((rank) => safeLevel >= rank.minLevel).at(-1) || ranks[0] || DEFAULT_RANKS[0];
}

export function levelProgress(totalXp, level, config = DEFAULT_READER_LEVEL_CONFIG) {
  const current = Math.max(1, Number(level) || levelForXp(totalXp, config.levelCurve));
  const floor = xpForLevel(current, config.levelCurve);
  const ceiling = xpForLevel(current + 1, config.levelCurve);
  const safeXp = Math.max(floor, Number(totalXp) || 0);
  return {
    currentXp: safeXp,
    levelStartXp: floor,
    nextLevelXp: ceiling,
    remainingXp: Math.max(0, ceiling - safeXp),
    percent: Math.max(0, Math.min(100, Math.round(((safeXp - floor) / Math.max(1, ceiling - floor)) * 100))),
  };
}
