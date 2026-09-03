import { hasReaderAccess } from '../../../lib/reader-access.js';
import { getNextQuoteChangeAt, getQuoteOfDay } from '../../../lib/reader-notes.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await hasReaderAccess(request))) {
    return Response.json({ error: 'Сначала введите пароль читателя.' }, { status: 401 });
  }
  try {
    const now = new Date();
    const quote = await getQuoteOfDay(now);
    return Response.json(
      { quote, nextChangeAt: getNextQuoteChangeAt(now) },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    return Response.json({ error: error.message || 'Не удалось обновить цитату.' }, { status: 500 });
  }
}
