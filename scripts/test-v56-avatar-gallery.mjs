import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const profile = read('src/profile-page.jsx');
const css = read('src/pages.css');
const visitor = read('src/site-analytics.js');
const avatarApi = read('app/api/reader-avatar/route.js');
const workerConfig = read('wrangler.jsonc');
const worker = read('public/sw.js');

assert.match(profile, /Выбрать из галереи/, 'the action clearly opens the gallery');
assert.match(profile, /accept="image\/\*,\.jpg,\.jpeg,\.png,\.webp,\.heic,\.heif,\.avif"/, 'the picker accepts common phone image formats');
assert.doesNotMatch(profile, /\bcapture=/, 'the picker is not forced into camera-only mode');
assert.match(profile, /image\/heic/, 'HEIC sources are accepted');
assert.match(profile, /image\/heif/, 'HEIF sources are accepted');
assert.match(profile, /image\/avif/, 'AVIF sources are accepted');
assert.match(profile, /25 \* 1024 \* 1024/, 'modern phone photos up to 25 MB are accepted before compression');
assert.match(profile, /MAX_AVATAR_UPLOAD_BYTES = 180 \* 1024/, 'only a compact avatar is sent to the server');
assert.doesNotMatch(css, /\.profile-avatar-upload input\s*\{\s*display:\s*none/, 'the native file input is not display-none');
assert.match(css, /\.profile-avatar-upload input[^}]*position:\s*absolute[^}]*opacity:\s*0/, 'the native picker receives the mobile tap directly');
assert.match(css, /\.profile-avatar-upload[^}]*touch-action:\s*manipulation/, 'the gallery control is touch friendly');
assert.match(visitor, /if \(!key\) key = readVisitorCookie\(\)/, 'cookie restores the reader id when localStorage is unavailable');
assert.match(visitor, /validVisitorKey/, 'restored visitor ids are validated');
const previousStorage = globalThis.localStorage;
const previousDocument = globalThis.document;
globalThis.localStorage = { getItem() { throw new Error('storage disabled'); }, setItem() { throw new Error('storage disabled'); } };
globalThis.document = { cookie: 'booknerd_visitor=reader-cookie-123' };
const { getVisitorKey } = await import('../src/site-analytics.js?avatar-cookie-test=1');
assert.equal(getVisitorKey(), 'reader-cookie-123', 'the same reader id survives when localStorage is blocked');
if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
assert.match(avatarApi, /MAX_AVATAR_BYTES = 200 \* 1024/, 'the server keeps the compact avatar limit');
assert.match(avatarApi, /DELETE FROM book_covers WHERE key = \?/, 'replaced avatars remove the old blob');
assert.doesNotMatch(workerConfig, /r2_buckets|r2_bucket/i, 'the avatar fix does not connect R2');
assert.deepEqual(readdirSync(new URL('../.openai/drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort().at(-1), '0027_app_schema_marker.sql', 'the avatar fix adds no D1 migration');
assert.match(worker, /booknerd-shell-v56/, 'PWA users receive the fixed avatar picker');

console.log('V56 mobile avatar gallery: 19 checks passed.');
