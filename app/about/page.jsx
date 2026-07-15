import { ArrowRight, BookHeart, Languages, SearchCheck, Sparkles } from 'lucide-react';
import { requireReaderAccess } from '../../lib/reader-access.js';
import { SiteFooter, SiteHeader } from '../../src/page-chrome.jsx';

export const metadata = { title: 'О проекте — BOOKNERD' };

export default async function AboutPage() {
  await requireReaderAccess('/about');
  return (
    <div className="site-shell inner-site-shell">
      <SiteHeader active="about" />
      <main>
        <section className="inner-hero about-hero">
          <span className="section-number">02 / О ПРОЕКТЕ</span>
          <div><h1>Переводим не слова.<br /><em>Переводим ощущение.</em></h1><p>BOOKNERD — независимая книжная редакционная, где каждая история проходит перевод, редактуру и бережную проверку.</p></div>
        </section>
        <section className="about-manifesto">
          <div className="about-quote"><Sparkles size={34} /><blockquote>Хотим, чтобы читатель забыл, что перед ним перевод, и просто оказался внутри истории.</blockquote></div>
          <div className="about-copy"><span>НАША ИДЕЯ</span><h2>Книги должны звучать живо.</h2><p>Мы сохраняем характеры, юмор, ритм и культурные детали. Спорим о точном слове, перечитываем диалоги вслух и публикуем главу только тогда, когда она звучит естественно.</p><a href="/translations">Перейти к переводам <ArrowRight size={18} /></a></div>
        </section>
        <section className="process-section">
          <div className="process-heading"><span className="section-number">КАК МЫ РАБОТАЕМ</span><h2>Три внимательных этапа</h2></div>
          <div className="process-grid">
            <article><span>01</span><Languages /><h3>Перевод</h3><p>Сохраняем голос автора, интонацию и атмосферу оригинала.</p></article>
            <article><span>02</span><BookHeart /><h3>Редактура</h3><p>Проверяем логику, характеры и то, насколько естественно звучит текст.</p></article>
            <article><span>03</span><SearchCheck /><h3>Корректура</h3><p>Убираем ошибки и готовим чистую главу для онлайн-читалки.</p></article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
