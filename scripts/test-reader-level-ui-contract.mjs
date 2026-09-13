import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/reader-levels.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/layout.jsx', import.meta.url), 'utf8');
const profile = readFileSync(new URL('../src/profile-page.jsx', import.meta.url), 'utf8');
const ranking = readFileSync(new URL('../src/rankings-page.jsx', import.meta.url), 'utf8');
const publicProfile = readFileSync(new URL('../src/public-reader-profile.jsx', import.meta.url), 'utf8');
const workerConfig = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

assert.match(css, /@media \(max-width:900px\)/, 'tablet layout exists');
assert.match(css, /@media \(max-width:620px\)/, 'small and large phone layout exists');
assert.match(css, /safe-area-inset-bottom/, 'mobile safe area is respected');
assert.match(css, /reader-master-scroll[^}]*overflow-x:auto/, 'mobile master cards scroll inside their own strip');
assert.match(css, /ranking-reader-row[^}]*grid-template-columns:42px 50px minmax\(0,1fr\)/, 'ranking becomes compact cards on phones');
assert.match(css, /prefers-reduced-motion:reduce/, 'rank motion can be reduced');
assert.match(layout, /ReaderLevelErrorBoundary><ReaderLevelNotice/, 'level notice failure cannot break the site');
assert.match(profile, /Показывать профиль в рейтинге/, 'public profile opt-out exists');
assert.match(profile, /Показывать активность/, 'online visibility control exists');
assert.match(profile, /Показывать текущую книгу/, 'current book visibility control exists');
assert.match(ranking, /Этот месяц/, 'monthly ranking tab exists');
assert.match(ranking, /За всё время/, 'all-time ranking tab exists');
assert.match(ranking, /По рангам/, 'rank grouping tab exists');
assert.match(ranking, /Номинации/, 'nomination tab exists');
assert.match(ranking, /Мои результаты/, 'personal result tab exists');
assert.doesNotMatch(publicProfile, /visitorKey|email|password|IP-адрес/, 'public component does not render private identifiers');
assert.doesNotMatch(workerConfig, /r2_buckets|r2_bucket/i, 'R2 is not configured');
assert.match(serviceWorker, /booknerd-shell-v53/, 'PWA shell cache is updated');
assert.doesNotMatch(serviceWorker, /const PRELOAD_URLS = \[[^\n]*'\/ranking'/, 'rating is cached on demand instead of blocking PWA install');

console.log('Reader level UI contract: 19 checks passed.');
