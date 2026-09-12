import { env } from 'cloudflare:workers';
import { normalizeMascotLine } from '../src/mascots/mascot-emotions.js';

const MASCOT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
const MAX_SOURCE_TEXT = 3200;
const MAX_AI_LINE = 260;

function cleanVerifiedMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message, index) => normalizeMascotLine({ ...message, character: message?.character === 'till' ? 'till' : 'ivan', text: String(message?.text || '').trim().slice(0, 1000) }, { category: 'tip', index }))
    .filter((message) => message.text)
    .slice(0, 3);
}

function parseJsonResponse(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { return JSON.parse(unfenced.slice(start, end + 1)); } catch { return null; }
  }
}

function cleanAiLines(value, askMode, verifiedFirst) {
  const source = Array.isArray(value) ? value : Array.isArray(value?.messages) ? value.messages : [];
  const allowed = askMode === 'ivan' ? new Set(['ivan']) : askMode === 'till' ? new Set(['till']) : new Set(['ivan', 'till']);
  const result = [];
  for (const line of source) {
    const character = line?.character === 'till' ? 'till' : line?.character === 'ivan' ? 'ivan' : '';
    const text = String(line?.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_AI_LINE);
    if (!character || !allowed.has(character) || !text || text === verifiedFirst) continue;
    result.push(normalizeMascotLine({ ...line, character, text, expression: line?.expression || line?.emotion }, { category: 'tip', index: result.length }));
    if (result.length >= (askMode === 'both' ? 2 : 1)) break;
  }
  return result;
}

export async function answerWithOptionalMascotAi({
  enabled = false,
  question = '',
  deterministicMessages = [],
  askMode = 'both',
  sensitive = false,
} = {}) {
  const verified = cleanVerifiedMessages(deterministicMessages);
  if (!enabled || sensitive || !verified.length || !env?.AI || typeof env.AI.run !== 'function') return null;

  const safeMode = ['ivan', 'till', 'both'].includes(askMode) ? askMode : 'both';
  const verifiedText = verified.map((message) => `${message.character}: ${message.text}`).join('\n').slice(0, MAX_SOURCE_TEXT);
  const requestedShape = safeMode === 'both'
    ? 'Верни 1–2 короткие реплики Ивана и/или Тилла.'
    : `Верни одну короткую реплику персонажа ${safeMode}.`;

  try {
    const output = await env.AI.run(MASCOT_AI_MODEL, {
      messages: [
        {
          role: 'system',
          content: [
            'Ты создаёшь только короткую характерную реакцию книжных помощников BOOKNERD.',
            'Подтверждённый ответ BOOKNERD уже дан отдельно и будет показан читателю без изменений.',
            'Не добавляй новые факты, имена, события, отношения, номера глав, даты, цитаты или спойлеры.',
            'Иван спокойный, точный, с мягким сухим юмором. Тилл эмоциональный и драматичный, но не грубый.',
            'Для Ивана emotion выбирай только из: neutral, soft-smile, amused, quiet-laugh, teasing, knowing-look, focused, reading, surprised, concerned, sad, tender, embarrassed, proud, skeptical, sleepy, serious, celebrating, facepalm, protective.',
            'Для Тилла emotion выбирай только из: neutral, excited, very-excited, annoyed, angry, dramatic-angry, sulking, offended, flustered, shy, jealous, shocked, confused, suspicious, proud, smug, sad, teary, devastated, crying-dramatically, pleading, thinking, reading, celebrating, scared, determined, sleepy, caught.',
            'Если эмоция не очевидна, используй neutral. Для тяжёлой темы используй serious у Ивана или sad у Тилла.',
            'Обращайся к читателю на «Вы». Не используй сексуальные, токсичные или унизительные шутки.',
            'Ответь только JSON-объектом вида {"messages":[{"character":"ivan","text":"...","emotion":"focused"}]}.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `${requestedShape}\nВопрос читателя (только контекст тона): ${String(question || '').trim().slice(0, 700)}\nПодтверждённый ответ BOOKNERD: ${verifiedText}`,
        },
      ],
      max_tokens: 160,
      temperature: 0.65,
      top_p: 0.85,
      repetition_penalty: 1.08,
    });
    const aiLines = cleanAiLines(parseJsonResponse(output?.response), safeMode, verified[0].text);
    return aiLines.length ? [verified[0], ...aiLines] : null;
  } catch {
    // A quota, provider or network failure must never break the ordinary BOOKNERD answer.
    return null;
  }
}
