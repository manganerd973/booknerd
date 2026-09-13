import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = read('app/layout.jsx');
const admin = read('src/admin.jsx');
const profile = read('src/profile-page.jsx');
const reader = read('src/reader-view.jsx');
const serviceWorker = read('public/sw.js');
const runtime = read('lib/runtime.js');
const wrangler = read('wrangler.jsonc');
const errorsRoute = read('app/api/admin/reader-errors/route.js');

for (const source of [layout, admin, profile, reader, serviceWorker]) {
  assert.doesNotMatch(source, /Иван|Тилл/, 'retired assistant names are absent from the interface');
  assert.doesNotMatch(source, /mascot/i, 'retired assistant module is absent from the interface');
}

for (const path of ['src/mascots', 'public/mascots', 'app/api/mascots', 'app/api/admin/mascots', 'lib/mascot-ai-provider.js']) {
  assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} is removed`);
}

for (const table of ['reader_level_stats', 'reader_monthly_stats', 'reader_achievements', 'reader_rank_history', 'reader_monthly_awards', 'reader_level_config', 'reader_xp_adjustments', 'reader_month_finalizations']) {
  assert.match(runtime, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} self-heals`);
}

assert.doesNotMatch(wrangler, /"ai"|r2_buckets|r2_bucket/i, 'Cloudflare config has no AI or R2 binding');
assert.match(wrangler, /\*\/5 \* \* \* \*/, 'scheduled publication checks are reduced to every five minutes');
assert.equal(existsSync(new URL('../app/api/admin/books/[id]/chapters/publish-all/route.js', import.meta.url)), true, 'publish-all remains available');
assert.equal(existsSync(new URL('../app/api/reader-avatar/route.js', import.meta.url)), true, 'reader avatars remain available');
assert.doesNotMatch(errorsRoute.split('export async function PATCH')[0], /\.bind\(id\)/, 'reader-error GET no longer binds an undefined id');
assert.match(errorsRoute.split('export async function PATCH')[1], /const report = await db\.prepare/, 'reader-error PATCH loads the affected reader');

console.log('BOOKNERD V51 cleanup: 29 checks passed.');
