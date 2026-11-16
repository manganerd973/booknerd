import { ensureDb, getDb } from './runtime.js';

export async function getSupportCard() {
  if (!getDb()) return '';
  const db = await ensureDb();
  const row = await db.prepare('SELECT card_number FROM chapter_support WHERE id = 1').first();
  return row?.card_number || '';
}
