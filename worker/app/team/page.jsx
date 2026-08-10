import { ArrowRight, BookOpen, Languages, PenLine, ShieldCheck } from 'lucide-react';
import { requireReaderAccess } from '../../lib/reader-access.js';
import { SiteFooter, SiteHeader } from '../../src/page-chrome.jsx';

export const metadata = { title: 'Команда — BOOKNERD' };

export default async function TeamPage() {
  await requireReaderAccess('/team');
  return (
    <div className="site-shell inner-site-shell">
      <SiteHeader active="team" />
      <main>
        <section className="inner-hero team-hero">
          <span className="section-number">03 / КОМАНДА</span>
          <div><h1>Люди, которые<br /><em>слышат историю.</em></h1><p>Небольшая редакционная команда с большой любовью к книгам и вниманием к каждой интонации.</p></div>
        </section>
        <section className="team-roles">
          <article><span>01</span><Languages size={28} /><h2>Перевод</h2><p>Передаёт голос автора, юмор и культурный контекст.</p></article>
          <article><span>02</span><PenLine size={28} /><h2>Редактура</h2><p>Следит за стилем, логикой и цельностью всей истории.</p></article>
          <article><span>03</span><BookOpen size={28} /><h2>Корректура</h2><p>Проверяет финальный текст перед появлением в читалке.</p></article>
          <article><span>04</span><ShieldCheck size={28} /><h2>Владелица</h2><p>Управляет книгами, главами, публикацией и доступом команды.</p></article>
        </section>
        <section className="team-cta">
          <div><span>ДЛЯ УЧАСТНИКОВ</span><h2>Закрытая редакционная</h2><p>Владелица имеет полный доступ. Выбранные участники входят по email и командному паролю.</p></div>
          <a href="/admin">Войти в редакционную <ArrowRight size={18} /></a>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
