import { Heart } from 'lucide-react';

export default function BookLoading() {
  return (
    <main className="book-loading-screen" role="status" aria-live="polite">
      <div className="book-loading-heart" aria-hidden="true"><Heart size={34} fill="currentColor" /></div>
      <strong>Загружаем книгу…</strong>
      <span>Ещё мгновение — и история откроется</span>
    </main>
  );
}
