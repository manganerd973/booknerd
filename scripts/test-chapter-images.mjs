import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeRichDocument,
  richDocumentToEditorHtml,
  richDocumentToPlainText,
  serializeRichDocument,
} from '../lib/rich-document.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const validImage = {
  type: 'image',
  src: '/api/covers/chapter-images/123e4567-e89b-12d3-a456-426614174000.webp',
  alt: 'Наушники и линия',
  size: 'wide',
  align: 'center',
  width: 1161,
  height: 146,
};

const normalized = normalizeRichDocument({
  version: 2,
  blocks: [
    { type: 'paragraph', runs: [{ text: 'До изображения' }] },
    validImage,
    { type: 'paragraph', runs: [{ text: 'После изображения' }] },
  ],
});

assert.equal(normalized.version, 2, 'rich document schema is versioned for images');
assert.equal(normalized.blocks.length, 3, 'image remains between text blocks');
assert.deepEqual(normalized.blocks[1], { ...validImage, runs: [] }, 'safe image metadata is preserved');
assert.equal(richDocumentToPlainText(normalized), 'До изображения\n\nПосле изображения', 'legacy plain text does not contain image data');
assert.match(serializeRichDocument(normalized), /"type":"image"/, 'image serializes in body_rich');

const html = richDocumentToEditorHtml(normalized);
assert.match(html, /data-chapter-image="true"/, 'editor HTML identifies the image block');
assert.match(html, /contenteditable="false"/, 'image block cannot be accidentally typed into');
assert.match(html, /width="1161" height="146"/, 'intrinsic dimensions prevent layout shift');
assert.match(html, /loading="lazy"/, 'editor image uses lazy loading');

const unsafe = normalizeRichDocument({ blocks: [
  { type: 'image', src: 'https://tracking.example/image.png' },
  { type: 'image', src: 'javascript:alert(1)' },
] });
assert.equal(unsafe.blocks.length, 0, 'external and executable image URLs are rejected');

const defaults = normalizeRichDocument({ blocks: [{ ...validImage, size: 'giant', align: 'float', width: 90000, height: -4 }] });
assert.equal(defaults.blocks[0].size, 'small', 'unknown image size falls back safely');
assert.equal(defaults.blocks[0].align, 'center', 'unknown alignment falls back safely');
assert.equal(defaults.blocks[0].width, 0, 'oversized intrinsic width is rejected');
assert.equal(defaults.blocks[0].height, 0, 'invalid intrinsic height is rejected');

const capped = normalizeRichDocument({ blocks: Array.from({ length: 40 }, () => validImage) });
assert.equal(capped.blocks.length, 24, 'a chapter cannot retain an unbounded number of images');

const endpoint = read('app/api/admin/chapter-images/route.js');
const coverEndpoint = read('app/api/covers/[...key]/route.js');
const editor = read('src/rich-chapter-editor.jsx');
const reader = read('src/reader-view.jsx');
const preview = read('src/admin-platform-features.jsx');
const offline = read('src/offline-book-button.jsx');
const adminCss = read('src/admin.css');
const readerCss = read('src/editorial.css');
const wrangler = read('wrangler.jsonc');

assert.match(endpoint, /authorizeAdminRequest/, 'chapter image upload requires editorial authorization');
assert.match(endpoint, /300 \* 1024/, 'server enforces the compact image limit');
assert.match(endpoint, /hasExpectedSignature/, 'server validates image signatures');
assert.match(endpoint, /chapter-images\//, 'chapter images have an isolated storage prefix');
assert.match(endpoint, /INSERT INTO book_covers/, 'existing storage is reused without a new table');
assert.match(coverEndpoint, /caches\?\.default/, 'edge cache protects D1 from repeated image reads');
assert.match(editor, /Добавить маленькое фото после выбранного абзаца/, 'editor exposes an insertion action');
assert.match(editor, /prepareChapterImage/, 'editor compresses photos before upload');
assert.match(editor, /Описание для доступности/, 'editor supports accessible alternative text');
assert.match(reader, /reader-chapter-image/, 'reader renders chapter images');
assert.match(reader, /loading="lazy"/, 'reader lazy-loads chapter images');
assert.match(preview, /preview-chapter-image/, 'editorial preview renders chapter images');
assert.match(offline, /chapterImageUrls/, 'offline download explicitly includes chapter images');
assert.match(adminCss, /admin-chapter-image\.is-wide/, 'editor supports full text width');
assert.match(readerCss, /reader-chapter-image\.is-medium/, 'reader supports compact size presets');
assert.doesNotMatch(wrangler, /r2_buckets|r2_bucket/i, 'R2 remains disabled');

console.log('Inline chapter images: 31 checks passed.');
