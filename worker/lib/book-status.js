export const BOOK_TRANSLATION_STATUSES = [
  'Черновик',
  'На редактуре',
  'Онгоинг',
  'Завершено',
  'Анонс',
  'На вычитке',
  'Переводится',
];

const LEGACY_BOOK_STATUS = new Map([
  ['готово', 'Завершено'],
  ['завершено', 'Завершено'],
  ['в работе', 'Онгоинг'],
  ['онгоинг', 'Онгоинг'],
  ['демо-читалка', 'Онгоинг'],
  ['новый перевод', 'Переводится'],
  ['переводится', 'Переводится'],
  ['на редактуре', 'На редактуре'],
  ['на проверке', 'На вычитке'],
  ['на вычитке', 'На вычитке'],
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
