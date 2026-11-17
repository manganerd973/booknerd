// Application budget, not a Cloudflare plan limit. Leave room for books and comments.
const IMAGE_BUDGET_BYTES = 64 * 1024 * 1024;
export async function checkImageStorageBudget(db, incomingBytes) {
  const covers = await db.prepare('SELECT COALESCE(SUM(length(data)), 0) AS bytes FROM book_covers').first();
  let avatarBytes = 0;
  try {
    const avatars = await db.prepare('SELECT COALESCE(SUM(length(image)), 0) AS bytes FROM reader_avatar_images').first();
    avatarBytes = Number(avatars?.bytes || 0);
  } catch (error) {
    if (!/no such table/i.test(String(error?.message || error))) throw error;
  }
  if (Number(covers?.bytes || 0) + avatarBytes + Number(incomingBytes || 0) > IMAGE_BUDGET_BYTES) {
    throw new Error('Достигнут безопасный объём изображений (64 МБ). Новая загрузка остановлена. Существующие файлы сохранены. Обратитесь к администратору.');
  }
}
