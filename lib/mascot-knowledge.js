import { getBookBySlug, listPublicBooks } from './books.js';
import { ensureDb, getDb } from './runtime.js';
import { isFutureMascotQuestion, isSensitiveMascotQuestion, needsSpoilerConfirmation, spoilerConfirmationMessages } from './mascot-spoiler-guard.js';

function parseList(value, fallback = []) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeVisitorKey(value) {
  const key = String(value || '').trim().slice(0, 120);
  return /^[a-zA-Z0-9:_-]{8,120}$/.test(key) ? key : '';
}

function usefulValue(value, fallback = 'не указано') {
  const text = String(value || '').trim();
  return text || fallback;
}

function formatSeries(book) {
  const order = book.seriesReadingOrder || [];
  if (order.length) return order.map((item) => `${item.order}. ${item.title}${item.kind === 'extra' ? ' — дополнительная история' : ''}`).join('; ');
  if (book.seriesTitle) return `${book.seriesTitle}${book.seriesNumber ? `, книга ${book.seriesNumber}` : ''}. Полный порядок пока не заполнен редакцией.`;
  return 'Книга не отмечена как часть серии.';
}

function formatSuitability(book) {
  const profile = book.suitabilityProfile || {};
  const parts = [
    profile.romance ? `уровень романтики — ${profile.romance}` : '',
    profile.angst ? `эмоциональная тяжесть — ${profile.angst}` : '',
    profile.pace ? `темп повествования — ${profile.pace}` : '',
    profile.spice ? `степень откровенности — ${profile.spice}` : '',
    profile.triggers ? `тяжесть триггеров — ${profile.triggers}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('; ') : 'Редакция пока не заполнила карточку совместимости.';
}

async function safeProgress(bookId, visitorKey, currentChapter) {
  let progressChapter = Math.max(0, Number(currentChapter || 0));
  const key = normalizeVisitorKey(visitorKey);
  if (!key || !getDb()) return progressChapter;
  try {
    const db = await ensureDb();
    const row = await db.prepare(
      `SELECT c.chapter_number
       FROM reader_library r
       LEFT JOIN chapters c ON c.id = r.last_chapter_id
       WHERE r.visitor_key = ? AND r.book_id = ?
       LIMIT 1`
    ).bind(key, bookId).first();
    progressChapter = Math.max(progressChapter, Number(row?.chapter_number || 0));
  } catch {
    // General book information is still safe when progress cannot be loaded.
  }
  return progressChapter;
}

async function safeCharacters(bookId, progressChapter) {
  if (!getDb() || progressChapter <= 0) return [];
  try {
    const db = await ensureDb();
    const result = await db.prepare(
      `SELECT name, description, reveal_after_chapter
       FROM book_glossary
       WHERE book_id = ? AND category = 'character' AND reveal_after_chapter <= ?
       ORDER BY reveal_after_chapter ASC, sort_order ASC
       LIMIT 12`
    ).bind(bookId, progressChapter).all();
    return result.results || [];
  } catch {
    return [];
  }
}

function chooseMessages(mode, useful, ivanAfter, tillAfter, sensitive = false, firstSpeaker = 'ivan') {
  const first = firstSpeaker === 'till' ? 'till' : 'ivan';
  if (sensitive) return [{ character: mode === 'till' || mode === 'both' && first === 'till' ? 'till' : 'ivan', text: useful }];
  if (mode === 'ivan') return [{ character: 'ivan', text: `${useful}${ivanAfter ? ` ${ivanAfter}` : ''}` }];
  if (mode === 'till') return [{ character: 'till', text: `${useful}${tillAfter ? ` ${tillAfter}` : ''}` }];
  if (first === 'till') {
    return [
      { character: 'till', text: useful },
      { character: 'ivan', text: ivanAfter || 'Информация проверена по материалам BOOKNERD.' },
      ...(tillAfter ? [{ character: 'till', text: tillAfter }] : []),
    ];
  }
  return [
    { character: 'ivan', text: useful },
    { character: 'till', text: tillAfter || 'Я бы всё равно заглянул в карточку книги. Исключительно из ответственности.' },
    ...(ivanAfter ? [{ character: 'ivan', text: ivanAfter }] : []),
  ];
}

export async function answerMascotQuestion({ question, askMode = 'both', bookSlug = '', visitorKey = '', currentChapter = 0, blockedTopics = [], firstSpeaker = 'ivan', allowSpoilers = false }) {
  const query = String(question || '').trim().slice(0, 1000);
  const normalized = query.toLocaleLowerCase('ru-RU');
  const mode = ['both', 'ivan', 'till'].includes(askMode) ? askMode : 'both';
  const speakingFirst = firstSpeaker === 'till' ? 'till' : 'ivan';
  const sensitive = isSensitiveMascotQuestion(query, blockedTopics);
  const reply = (useful, ivanAfter = '', tillAfter = '', forceSensitive = sensitive) => ({
    messages: chooseMessages(mode, useful, ivanAfter, tillAfter, forceSensitive, speakingFirst),
    requiresSpoilerConfirmation: false,
  });
  const book = bookSlug ? await getBookBySlug(bookSlug) : null;

  if (!book) {
    if (/рекоменд|что почитать|книг[ауи]? выбрать/iu.test(normalized)) {
      const books = await listPublicBooks();
      const suggestions = books.slice(0, 3).map((item) => `«${item.title}»`).join(', ');
      return reply(suggestions ? `Сейчас можно начать с ${suggestions}. Перед выбором проверьте тропы и предупреждения.` : 'Список рекомендаций сейчас недоступен.', 'Он впервые дал короткий список. Запомните этот день.', 'Я сократил список только ради удобства.');
    }
    return reply('Откройте страницу нужной книги, и я смогу использовать её аннотацию, тропы, предупреждения и редакционные данные.', 'Так меньше риска перепутать истории.', 'Я и без страницы почти догадался. Почти.');
  }

  const progressChapter = await safeProgress(book.id, visitorKey, currentChapter);
  const publishedChapterCount = Math.max(0, Number(book.publishedChapterCount || book.chapterCount || 0));
  if (needsSpoilerConfirmation({ question: query, progressChapter, publishedChapterCount, allowSpoilers })) {
    return {
      messages: spoilerConfirmationMessages(speakingFirst),
      requiresSpoilerConfirmation: true,
    };
  }
  const knowledgeChapter = allowSpoilers ? publishedChapterCount : progressChapter;

  if (/предупреж|триггер|тяж[её]л|опасн/iu.test(normalized)) {
    const warnings = book.triggerWarnings?.length ? book.triggerWarnings.join(', ') : 'редакция пока не указала предупреждения';
    return reply(`Для книги «${book.title}»: ${warnings}.${book.ageReason ? ` ${book.ageReason}` : ''}`, '', sensitive ? '' : 'Проверить предупреждения — хорошая привычка.', true);
  }

  if (/возраст|\b16\+|\b18\+/iu.test(normalized)) {
    return reply(`Возрастное ограничение: ${usefulValue(book.ageRating)}.${book.ageReason ? ` Причина: ${book.ageReason}` : ''}`, 'Лучше проверить это до первой главы.', 'Я тоже проверил. На этот раз действительно всё.');
  }

  if (/подойд[её]т|романтик|откровен|темп|стекл|эмоцион/iu.test(normalized)) {
    return reply(`Карточка «Подойдёт ли мне эта книга?»: ${formatSuitability(book)}. Тропы: ${book.tropes?.length ? book.tropes.join(', ') : 'не указаны'}.`, 'Выбор всё равно остаётся за Вами.', 'Если там опасный герой и плохие решения, я уже заинтересован.');
  }

  if (/сер(?:ия|ии)|порядок|сначала читать/iu.test(normalized)) {
    return reply(formatSeries(book), 'Редакционный порядок надёжнее случайных списков.', 'Я бы начал с самой драматичной. Но Иван опять требует порядок.');
  }

  if (/кто|персонаж|геро[йи]|имя/iu.test(normalized)) {
    const characters = await safeCharacters(book.id, knowledgeChapter);
    if (!knowledgeChapter) return reply('Ваш прогресс пока неизвестен, поэтому я не буду называть персонажей и раскрывать лишнее. Можно использовать только общую аннотацию.', 'Осторожность здесь полезнее догадок.', 'Я ничего не сказал. Хотя очень хотелось.');
    if (!characters.length) return reply(`До главы ${knowledgeChapter} в редакционном словаре пока нет доступных карточек персонажей. Я не стану выдумывать ответ.`, 'Когда команда заполнит словарь, подсказки появятся автоматически.', 'У меня есть теория. Но теория — не факт.');
    const summary = characters.map((item) => `${item.name} — ${item.description || 'описание пока не добавлено'}; впервые доступен с главы ${item.reveal_after_chapter || 1}`).join(' ');
    return reply(`${allowSpoilers ? `По опубликованным главам до ${knowledgeChapter}` : `Без спойлеров после главы ${knowledgeChapter}`}: ${summary}`, allowSpoilers ? 'Это всё равно только подтверждённые редакционные карточки.' : 'Я показал только то, что уже должно быть Вам известно.', allowSpoilers ? 'Никаких догадок. Только то, что уже опубликовано.' : 'Ни одного будущего секрета. Я проверил дважды.');
  }

  if (allowSpoilers && isFutureMascotQuestion(query)) {
    return reply('В материалах BOOKNERD нет отдельного подтверждённого ответа на этот вопрос. Я не стану придумывать сюжет или финал.', 'Можно проверить опубликованные главы или спросить о персонажах из редакционного словаря.', 'Теория у меня есть. Но теория всё ещё не факт.');
  }

  if (/карт[ауе]|локаци|мир/iu.test(normalized)) {
    return reply(book.worldMap ? 'У книги есть карта мира. В читалке она открывается через кнопку «Карта» и показывает только доступные к текущей главе точки.' : 'Редакция пока не добавила карту мира для этой книги.', 'Спойлерные точки останутся закрыты.', 'Я бы открыл всё сразу, но Иван запретил.');
  }

  if (/статус|сколько глав|продолжени|завершен|завершён/iu.test(normalized)) {
    return reply(`Статус перевода — «${book.status}». Опубликовано глав: ${book.publishedChapterCount || book.chapterCount || 0}${book.plannedChapterCount ? ` из ${book.plannedChapterCount}` : ''}. Готовность — ${book.progress || 0}%.`, 'Это данные самой редакционной BOOKNERD.', 'Значит, я могу официально требовать продолжение.');
  }

  const overview = `«${book.title}» — ${book.author}. ${book.synopsis || 'Аннотация пока не заполнена.'} Жанры: ${book.genres?.length ? book.genres.join(', ') : 'не указаны'}.`;
  return reply(overview, 'Если нужен точный ответ, спросите о тропах, предупреждениях, серии или знакомых персонажах.', 'А ещё можно спросить, подойдёт ли Вам эта книга. Я уже составил мнение.');
}

export function parseMascotDialogues(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    category: row.category || 'tip',
    pages: parseList(row.pages, ['home']),
    lines: parseList(row.lines, []),
  })).filter((item) => item.lines.length);
}
