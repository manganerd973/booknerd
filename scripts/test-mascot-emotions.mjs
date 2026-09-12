import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MASCOT_EMOTIONS, defaultEmotion, defaultListenerReaction, emotionVisual,
  isApprovedEmotion, newMascotLine, normalizeMascotLine, normalizeMascotLines,
} from '../src/mascots/mascot-emotions.js';
import { duplicateDraftLine, moveDraftLine, orderedDraftLines } from '../src/mascots/admin-dialogue-order.js';

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }

assert.equal(MASCOT_EMOTIONS.ivan.length, 20); checks += 1;
assert.equal(MASCOT_EMOTIONS.till.length, 28); checks += 1;
for (const character of ['ivan', 'till']) {
  const ids = MASCOT_EMOTIONS[character].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length); checks += 1;
  for (const id of ids) {
    check(isApprovedEmotion(character, id), `${character}/${id} must be approved`);
    const visual = emotionVisual(character, id);
    check(Boolean(visual.eyes && visual.mouth), `${character}/${id} needs a visual preset`);
  }
}

assert.equal(defaultEmotion('ivan', 'greeting'), 'soft-smile'); checks += 1;
assert.equal(defaultEmotion('till', 'greeting'), 'excited'); checks += 1;
assert.equal(defaultEmotion('ivan', 'tip', 'Вопрос о селфхарме'), 'serious'); checks += 1;
assert.equal(defaultEmotion('till', 'tip', 'Вопрос о суициде'), 'sad'); checks += 1;
assert.equal(defaultListenerReaction('till', 'devastated'), 'protective'); checks += 1;
assert.equal(defaultListenerReaction('ivan', 'teasing'), 'caught'); checks += 1;

const invalid = normalizeMascotLine({ character: 'till', text: 'Тест', expression: 'invented', listenerReaction: 'invented', delayMs: -5, durationMs: 90000 });
assert.equal(invalid.expression, 'thinking'); checks += 1;
assert.equal(invalid.delayMs, 0); checks += 1;
assert.equal(invalid.durationMs, 15000); checks += 1;

const sensitive = normalizeMascotLine({ character: 'ivan', text: 'Тяжёлая тема: насилие', expression: 'celebrating', listenerReaction: 'excited' });
assert.equal(sensitive.expression, 'serious'); checks += 1;
assert.equal(sensitive.listenerReaction, 'sad'); checks += 1;

const lines = normalizeMascotLines([
  { character: 'till', text: 'Первая', expression: 'excited' },
  { character: 'ivan', text: 'Вторая', expression: 'teasing' },
  { character: 'till', text: 'Третья', expression: 'caught' },
], { category: 'banter' });
assert.deepEqual(lines.map((line) => line.character), ['till', 'ivan', 'till']); checks += 1;
assert.deepEqual(orderedDraftLines({ category: 'banter', lines }).map((line) => line.text), ['Первая', 'Вторая', 'Третья']); checks += 1;
assert.deepEqual(moveDraftLine(lines, 2, 0).map((line) => line.text), ['Третья', 'Первая', 'Вторая']); checks += 1;
assert.equal(duplicateDraftLine(lines, 1, 'banter').length, 4); checks += 1;
check(newMascotLine('ivan', 'flirt').character === 'ivan', 'new line keeps selected speaker');

const root = path.resolve(new URL('..', import.meta.url).pathname);
const adminSource = fs.readFileSync(path.join(root, 'src/mascots/admin-mascots.jsx'), 'utf8');
check(!adminSource.includes('Первым говорит'), 'there is no global first-speaker selector');
check(adminSource.includes('Предпросмотр всей сценки'), 'full scene preview exists');
check(adminSource.includes('draggable'), 'lines are draggable');
check(adminSource.includes('listenerReaction'), 'listener reaction is editable');
const routeSource = fs.readFileSync(path.join(root, 'app/api/admin/mascots/route.js'), 'utf8');
check(routeSource.includes('normalizeMascotLines'), 'server validates scene metadata');
check(routeSource.includes('18000'), 'server limits scene JSON size');
const runtimeSource = fs.readFileSync(path.join(root, 'src/mascots/mascot-system.jsx'), 'utf8');
check(runtimeSource.includes('edgeLine?.listenerReaction'), 'listener reacts at runtime');
check(runtimeSource.includes("edgeSettled ? 'neutral'"), 'scene returns to neutral');
const spriteSource = fs.readFileSync(path.join(root, 'src/mascots/mascot-sprite.jsx'), 'utf8');
check(spriteSource.includes('mascot-expression-overlay'), 'state sprite overlay exists');
check(spriteSource.includes("safeExpression = isApprovedEmotion"), 'missing state falls back safely');
const swSource = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
check(swSource.includes('booknerd-shell-v50'), 'offline cache version updated');
const schemaSource = fs.readFileSync(path.join(root, 'lib/runtime.js'), 'utf8');
const mascotTables = [...schemaSource.matchAll(/CREATE TABLE IF NOT EXISTS mascot_/g)].length;
assert.equal(mascotTables, 2); checks += 1;

console.log(`Mascot emotion checks passed: ${checks}`);
