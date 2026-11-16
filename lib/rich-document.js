const BLOCK_TYPES = new Set(['paragraph', 'heading', 'subheading', 'blockquote', 'list-item']);
const ALIGNMENTS = new Set(['left', 'center', 'right', 'justify']);
const LIST_TYPES = new Set(['bullet', 'number']);
const CHAT_SIDES = new Set(['incoming', 'outgoing']);

function cleanLength(value) {
  const input = String(value || '').trim().toLowerCase();
  const match = input.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)$/);
  if (!match) return '';
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < -12 || amount > 240) return '';
  return `${amount}${match[2]}`;
}

function parseDocument(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function sameMarks(left, right) {
  return Boolean(left.bold) === Boolean(right.bold)
    && Boolean(left.italic) === Boolean(right.italic)
    && Boolean(left.underline) === Boolean(right.underline)
    && Boolean(left.strike) === Boolean(right.strike)
    && String(left.fontFamily || '') === String(right.fontFamily || '');
}

function cleanFontFamily(value) {
  const input = String(value || '').trim();
  if (!input || input.length > 180 || /[;{}<>]|url\s*\(|expression\s*\(/i.test(input)) return '';
  return /^[\p{L}\p{N}\s,'"._-]+$/u.test(input) ? input : '';
}

function cleanChatSender(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 80);
}

export function normalizeRichDocument(value, maxCharacters = 300000) {
  const source = parseDocument(value);
  const inputBlocks = Array.isArray(source?.blocks) ? source.blocks : Array.isArray(source) ? source : [];
  const blocks = [];
  let remaining = Math.max(0, Number(maxCharacters) || 300000);

  for (const inputBlock of inputBlocks.slice(0, 10000)) {
    if (!inputBlock || remaining <= 0) break;
    const runs = [];
    const inputRuns = Array.isArray(inputBlock.runs)
      ? inputBlock.runs
      : [{ text: String(inputBlock.text || '') }];

    for (const inputRun of inputRuns.slice(0, 20000)) {
      if (remaining <= 0) break;
      const text = String(inputRun?.text || '').replace(/\r\n?/g, '\n').slice(0, remaining);
      remaining -= text.length;
      if (!text) continue;
      const run = {
        text,
        bold: Boolean(inputRun?.bold),
        italic: Boolean(inputRun?.italic),
        underline: Boolean(inputRun?.underline),
        strike: Boolean(inputRun?.strike),
        fontFamily: cleanFontFamily(inputRun?.fontFamily),
      };
      const previous = runs[runs.length - 1];
      if (previous && sameMarks(previous, run)) previous.text += run.text;
      else runs.push(run);
    }

    const type = BLOCK_TYPES.has(inputBlock.type) ? inputBlock.type : 'paragraph';
    const listType = type === 'list-item' && LIST_TYPES.has(inputBlock.listType) ? inputBlock.listType : '';
    const chatSide = CHAT_SIDES.has(inputBlock.chatSide) ? inputBlock.chatSide : '';
    const chatSender = chatSide ? cleanChatSender(inputBlock.chatSender) : '';
    const text = runs.map((run) => run.text).join('');
    if (!text.trim()) continue;
    blocks.push({
      type: chatSide ? 'paragraph' : type,
      align: ALIGNMENTS.has(inputBlock.align) ? inputBlock.align : '',
      textIndent: cleanLength(inputBlock.textIndent),
      marginLeft: cleanLength(inputBlock.marginLeft),
      listType,
      listIndex: listType === 'number' ? Math.max(1, Math.min(9999, Math.floor(Number(inputBlock.listIndex) || 1))) : 0,
      chatSide,
      chatSender,
      runs,
    });
  }

  return { version: 1, blocks };
}

export function legacyTextToRichDocument(value) {
  const paragraphs = String(value || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return normalizeRichDocument({
    version: 1,
    blocks: paragraphs.map((text) => ({ type: 'paragraph', runs: [{ text }] })),
  });
}

export function richDocumentFor(value, fallbackText = '') {
  const normalized = normalizeRichDocument(value);
  return normalized.blocks.length ? normalized : legacyTextToRichDocument(fallbackText);
}

export function serializeRichDocument(value) {
  return JSON.stringify(normalizeRichDocument(value));
}

export function richDocumentToPlainText(value) {
  return normalizeRichDocument(value).blocks
    .map((block) => block.runs.map((run) => run.text).join(''))
    .join('\n\n')
    .trim();
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function runToHtml(run) {
  let content = escapeHtml(run.text).replaceAll('\n', '<br>');
  if (run.strike) content = `<s>${content}</s>`;
  if (run.underline) content = `<u>${content}</u>`;
  if (run.italic) content = `<em>${content}</em>`;
  if (run.bold) content = `<strong>${content}</strong>`;
  if (run.fontFamily) content = `<span style="font-family:${escapeHtml(run.fontFamily)}">${content}</span>`;
  return content;
}

function blockStyle(block) {
  const styles = [];
  if (block.align) styles.push(`text-align:${block.align}`);
  if (block.textIndent) styles.push(`text-indent:${block.textIndent}`);
  if (block.marginLeft) styles.push(`margin-left:${block.marginLeft}`);
  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function blockChatAttributes(block, context) {
  if (!block.chatSide) return '';
  const className = context === 'editor'
    ? `admin-chat-message is-${block.chatSide}`
    : `reader-chat-message is-${block.chatSide}`;
  return ` class="${className}" data-chat-side="${block.chatSide}" data-chat-sender="${escapeHtml(block.chatSender || 'Сообщение')}"`;
}

export function richDocumentToEditorHtml(value, fallbackText = '') {
  const { blocks } = richDocumentFor(value, fallbackText);
  let html = '';
  let openList = '';
  const closeList = () => {
    if (openList) html += `</${openList}>`;
    openList = '';
  };

  blocks.forEach((block) => {
    const content = block.runs.map(runToHtml).join('') || '<br>';
    if (block.type === 'list-item') {
      const listTag = block.listType === 'number' ? 'ol' : 'ul';
      if (openList !== listTag) {
        closeList();
        html += `<${listTag}>`;
        openList = listTag;
      }
      html += `<li${blockStyle(block)}>${content}</li>`;
      return;
    }
    closeList();
    const tag = block.type === 'heading' ? 'h2' : block.type === 'subheading' ? 'h3' : block.type === 'blockquote' ? 'blockquote' : 'p';
    html += `<${tag}${blockChatAttributes(block, 'editor')}${blockStyle(block)}>${content}</${tag}>`;
  });
  closeList();
  return html;
}
