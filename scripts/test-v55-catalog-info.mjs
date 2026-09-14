import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const catalog = read('src/translations-page.jsx');
const catalogCss = read('src/catalog-v55.css');
const calendar = read('src/calendar-page.jsx');
const infoCss = read('src/information-pages.css');
const legal = read('src/legal-page.jsx');
const terms = read('app/terms/page.jsx');
const privacy = read('app/privacy/page.jsx');
const layout = read('app/layout.jsx');
const chrome = read('src/page-chrome.jsx');
const access = read('app/reader-access/page.jsx');
const worker = read('public/sw.js');
const workerConfig = read('wrangler.jsonc');

assert.match(catalog, /translation-cover-status/, 'tile displays the real translation status');
assert.match(catalog, /publishedChapterCount/, 'tile displays the real published chapter count');
assert.match(catalog, /translation-cover-meta/, 'genre and progress overlay exists');
assert.match(catalog, /SORT_OPTIONS/, 'catalog sorting exists');
assert.match(catalog, /STATUS_OPTIONS/, 'catalog status filters exist');
assert.match(catalog, /AGE_OPTIONS/, 'catalog age filters exist');
assert.match(catalog, /role="dialog" aria-modal="true"/, 'sort and filter sheet is accessible');
assert.doesNotMatch(catalog, /fetch\(|\/api\//, 'sorting and filters do not add D1 requests');
assert.match(catalogCss, /@media \(max-width:620px\)[\s\S]*translations-grid\.is-grid[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, 'phone tile mode uses three columns');
assert.match(catalogCss, /catalog-panel[^}]*max-height:min\(78dvh/, 'phone sheet stays inside the viewport');
assert.match(catalogCss, /safe-area-inset-bottom/, 'phone sheet respects the safe area');

assert.match(calendar, /releaseDays/, 'schedule reuses existing editorial release days');
assert.match(calendar, /selectedDay/, 'reader can browse days');
assert.match(calendar, /Как выходим/, 'complete release plan exists');
assert.doesNotMatch(calendar, /fetch\(|\/api\//, 'schedule does not create extra D1 requests');
assert.match(infoCss, /schedule-day-picker/, 'schedule has a responsive day picker');
assert.match(infoCss, /@media \(max-width:620px\)/, 'information pages have a phone layout');

assert.match(terms, /LegalPage type="terms"/, 'user agreement route exists');
assert.match(privacy, /LegalPage type="privacy"/, 'privacy route exists');
assert.doesNotMatch(terms + privacy, /requireReaderAccess/, 'legal pages stay readable before login');
assert.match(legal, /BOOKNERD — некоммерческий читательский проект/, 'agreement is written for BOOKNERD');
assert.match(legal, /Cloudflare D1/, 'privacy page describes the actual storage architecture');
assert.match(legal, /cloudflare\.com\/policies\/privacy/, 'Cloudflare privacy policy is linked');
assert.match(chrome, /href="\/terms"/, 'agreement is linked in the site footer');
assert.match(chrome, /href="\/privacy"/, 'privacy is linked in the site footer');
assert.match(access, /reader-access-legal/, 'legal pages are linked before reader login');
assert.match(layout, /catalog-v55\.css/, 'catalog styles are loaded');
assert.match(layout, /information-pages\.css/, 'information page styles are loaded');
assert.match(worker, /booknerd-shell-v56/, 'PWA shell is refreshed after the catalog release');
assert.doesNotMatch(workerConfig, /r2_buckets|r2_bucket/i, 'R2 remains disabled');
assert.deepEqual(readdirSync(new URL('../.openai/drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort().at(-1), '0027_app_schema_marker.sql', 'no D1 migration was added');

console.log('V55 catalog and information pages: 31 checks passed.');
