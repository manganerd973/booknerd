import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ranking = read('src/rankings-page.jsx');
const rankingCss = read('src/reader-levels.css');
const reminder = read('src/pwa-install-reminder.jsx');
const reminderCss = read('src/pwa-install-reminder.css');
const layout = read('app/layout.jsx');
const styles = read('src/styles.css');
const worker = read('public/sw.js');

assert.match(ranking, /SiteHeader active="ranking"/, 'ranking navigation is marked active');
assert.match(ranking, /ranking-reader-position/, 'reader position has its own visual zone');
assert.match(ranking, /ranking-reader-score/, 'reader XP and book totals have their own visual zone');
assert.match(ranking, /countLabel/, 'Russian book and chapter counters are formatted correctly');
assert.match(rankingCss, /ranking-tabs[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, 'desktop tabs use a fitted grid');
assert.match(rankingCss, /ranking-tabs button:last-child[^}]*grid-column:1\/-1/, 'phone personal tab occupies a complete row');
assert.match(rankingCss, /ranking-reader-score[^}]*grid-column:2\/4/, 'phone score has a separate readable row');
assert.match(rankingCss, /ranking-reader-row[^}]*overflow:hidden/, 'rank decoration cannot create page overflow');
assert.match(rankingCss, /ranking-reader-row:focus-visible/, 'ranking cards have keyboard focus styling');

assert.match(layout, /PwaInstallReminder/, 'install reminder is mounted globally');
assert.match(layout, /viewportFit:\s*'cover'/, 'iPhone safe areas are enabled');
assert.match(styles, /safe-area-inset-top/, 'installed PWA header respects the status bar');
assert.match(reminder, /beforeinstallprompt/, 'supported Android browsers use the native installation prompt');
assert.match(reminder, /На экран “Домой”/, 'iPhone users receive correct home-screen instructions');
assert.match(reminder, /display-mode: standalone/, 'already installed apps are detected');
assert.match(reminder, /SHOW_COOLDOWN = 7 \* 24/, 'reminder is not shown on every visit');
assert.match(reminder, /DISMISS_COOLDOWN = 14 \* 24/, 'dismissal is remembered for two weeks');
assert.doesNotMatch(reminder, /fetch\(|\/api\//, 'reminder does not write impressions to D1');
assert.match(reminderCss, /safe-area-inset-bottom/, 'reminder stays above phone navigation and safe area');
assert.match(reminderCss, /@media \(min-width:761px\)[^{]*\{[^}]*pwa-install-reminder[^}]*display:none/s, 'reminder is phone-only');
assert.match(reminderCss, /prefers-reduced-motion:reduce/, 'reminder animation respects reduced motion');
assert.match(worker, /booknerd-shell-v55/, 'new client assets invalidate the old PWA shell');

console.log('V54 ranking and PWA reminder contract: 22 checks passed.');
