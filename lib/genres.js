export const FEATURED_GENRES = [
  'ROMANCE',
  'FANTASY',
  'YOUNG ADULT',
  'ROMANTASY',
  'DARK ROMANCE',
  'NEW ADULT',
  'CONTEMPORARY',
  'MYSTERY',
  'THRILLER',
  'SCIENCE FICTION',
  'PARANORMAL',
  'HISTORICAL',
  'DYSTOPIA',
  'HORROR',
  'ADVENTURE',
  'DRAMA',
  'COMEDY',
];

const FEATURED_BY_KEY = new Map(FEATURED_GENRES.map((genre) => [genreKey(genre), genre]));

export function genreKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ru-RU');
}

export function canonicalGenre(value) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return FEATURED_BY_KEY.get(genreKey(clean)) || clean;
}

export function normalizeGenres(value, limit = 20) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/);
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const genre = canonicalGenre(item);
    const key = genreKey(genre);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(genre);
    if (result.length >= limit) break;
  }
  return result;
}

export function uniqueGenres(values) {
  return normalizeGenres(values, Number.MAX_SAFE_INTEGER);
}
