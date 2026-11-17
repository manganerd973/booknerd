export const BOOK_TRANSLATION_STATUSES = [
  'Переводится', 'На проверке', 'Анонс', 'Завершено', 'Черновик',
];

const LEGACY_BOOK_STATUS = new Map([
  ['готово', 'Завершено'],
  ['завершено', 'Завершено'],
  ['в работе', 'Переводится'],
  ['онгоинг', 'Переводится'],
  ['демо-читалка', 'Переводится'],
  ['новый перевод', 'Переводится'],
  ['переводится', 'Переводится'],
  ['на редактуре', 'На проверке'],
  ['на проверке', 'На проверке'],
  ['на вычитке', 'На проверке'],
  ['скоро', 'Анонс'],
  ['черновик', 'Черновик'],
  ['выбор команды', 'Анонс'],
  ['на паузе', 'Анонс'],
  ['анонс', 'Анонс'],
]);

export function normalizeBookStatus(value) {
  const status = String(value || '').trim();
  if (BOOK_TRANSLATION_STATUSES.includes(status)) return status;
  return LEGACY_BOOK_STATUS.get(status.toLocaleLowerCase('ru-RU')) || 'Анонс';
}

export const BOOK_TYPES = ['Роман', 'Новелла', 'Веб-новелла', 'Ранобэ', 'Другое'];
export const BOOK_AGE_RATINGS = [0, 6, 12, 16, 18];
