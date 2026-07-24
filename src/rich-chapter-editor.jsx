'use client';

import React, { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Search,
  Smile,
  Smartphone,
  Underline,
  Undo2,
  X,
} from 'lucide-react';
import {
  normalizeRichDocument,
  richDocumentToEditorHtml,
  richDocumentToPlainText,
  serializeRichDocument,
} from '../lib/rich-document.js';

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI']);
const ALLOWED_PASTE_TAGS = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'SPAN', 'FONT']);
const CHAT_EMOJI_CATEGORIES = [
  {
    id: 'faces',
    name: 'Эмоции',
    sample: '😊',
    emojis: ['😀', '😃', '😄', '😁', '😊', '🥰', '😍', '😘', '☺️', '🥹', '😂', '🤣', '😅', '😌', '😉', '🙃', '😇', '🤭', '🫢', '🫣', '🤫', '🤔', '🫠', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '😱', '😳', '🫶'],
  },
  {
    id: 'hearts',
    name: 'Сердца',
    sample: '🩷',
    emojis: ['❤️', '🩷', '🧡', '💛', '💚', '🩵', '💙', '💜', '🤎', '🖤', '🩶', '🤍', '♥️', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💌', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '💋', '🌹', '🌷', '✨'],
  },
  {
    id: 'gestures',
    name: 'Жесты',
    sample: '🫶',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '🤝', '🙏'],
  },
  {
    id: 'objects',
    name: 'Разное',
    sample: '✨',
    emojis: ['✨', '⭐', '🌙', '☀️', '🔥', '💫', '🌸', '🍃', '🦋', '🐈', '🦉', '☕', '🫖', '🍰', '🍓', '🎀', '🎁', '📚', '📖', '✒️', '📱', '💬', '💭', '🎵', '🎧', '📸', '✅', '❌', '⚠️', '❓', '‼️', '💯'],
  },
];

function sameMarks(left, right) {
  return left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.strike === right.strike
    && left.fontFamily === right.fontFamily;
}

function appendRun(runs, text, marks) {
  if (!text) return;
  const value = text.replaceAll('\u00a0', ' ');
  const run = { text: value, ...marks };
  const previous = runs[runs.length - 1];
  if (previous && sameMarks(previous, run)) previous.text += value;
  else runs.push(run);
}

function safeFontFamily(value) {
  const input = String(value || '').trim();
  if (!input || input.length > 180 || /[;{}<>]|url\s*\(|expression\s*\(/i.test(input)) return '';
  return /^[\p{L}\p{N}\s,'"._-]+$/u.test(input) ? input : '';
}

function marksFor(element, inherited) {
  const tag = element.tagName;
  const weight = String(element.style?.fontWeight || '').toLowerCase();
  const decoration = String(element.style?.textDecorationLine || element.style?.textDecoration || '').toLowerCase();
  return {
    bold: inherited.bold || tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number.parseInt(weight, 10) >= 600,
    italic: inherited.italic || tag === 'I' || tag === 'EM' || String(element.style?.fontStyle || '').toLowerCase() === 'italic',
    underline: inherited.underline || tag === 'U' || decoration.includes('underline'),
    strike: inherited.strike || tag === 'S' || tag === 'STRIKE' || decoration.includes('line-through'),
    fontFamily: safeFontFamily(element.style?.fontFamily || element.getAttribute?.('face')) || inherited.fontFamily || '',
  };
}

function collectRuns(node, inherited = { bold: false, italic: false, underline: false, strike: false, fontFamily: '' }, runs = []) {
  if (node.nodeType === Node.TEXT_NODE) {
    appendRun(runs, node.nodeValue || '', inherited);
    return runs;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return runs;
  if (node.tagName === 'BR') {
    appendRun(runs, '\n', inherited);
    return runs;
  }
  const marks = marksFor(node, inherited);
  node.childNodes.forEach((child) => collectRuns(child, marks, runs));
  return runs;
}

function safeCssLength(value) {
  const input = String(value || '').trim().toLowerCase();
  return /^-?\d+(?:\.\d+)?(px|pt|em|rem|%)$/.test(input) ? input : '';
}

function blockFromElement(element, listType = '', listIndex = 0) {
  const tag = element.tagName;
  const runs = collectRuns(element).filter((run) => run.text);
  const chatSide = ['incoming', 'outgoing'].includes(element.dataset?.chatSide) ? element.dataset.chatSide : '';
  const chatSender = chatSide
    ? String(element.dataset?.chatSender || '').replace(/\s+/g, ' ').trim().slice(0, 80)
    : '';
  const align = ['left', 'center', 'right', 'justify'].includes(element.style?.textAlign)
    ? element.style.textAlign
    : ['left', 'center', 'right', 'justify'].includes(element.getAttribute('align')) ? element.getAttribute('align') : '';
  return {
    type: chatSide ? 'paragraph' : tag === 'LI' ? 'list-item' : ['H1', 'H2'].includes(tag) ? 'heading' : tag === 'H3' ? 'subheading' : tag === 'BLOCKQUOTE' ? 'blockquote' : 'paragraph',
    align,
    textIndent: safeCssLength(element.style?.textIndent),
    marginLeft: safeCssLength(element.style?.marginLeft || element.style?.paddingLeft),
    listType: tag === 'LI' ? listType || 'bullet' : '',
    listIndex: tag === 'LI' && listType === 'number' ? listIndex : 0,
    chatSide,
    chatSender,
    runs,
  };
}

function hasDirectBlockChild(element) {
  return [...element.children].some((child) => BLOCK_TAGS.has(child.tagName) || child.tagName === 'UL' || child.tagName === 'OL');
}

function extractBlocks(root) {
  const blocks = [];
  let looseRuns = [];
  const flushLooseRuns = () => {
    const text = looseRuns.map((run) => run.text).join('');
    if (text.trim()) blocks.push({ type: 'paragraph', runs: looseRuns });
    looseRuns = [];
  };

  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendRun(looseRuns, node.nodeValue || '', { bold: false, italic: false, underline: false, strike: false, fontFamily: '' });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === 'UL' || tag === 'OL') {
      flushLooseRuns();
      let index = Math.max(1, Number(node.getAttribute('start')) || 1);
      [...node.children].filter((child) => child.tagName === 'LI').forEach((item) => {
        blocks.push(blockFromElement(item, tag === 'OL' ? 'number' : 'bullet', index));
        index += 1;
      });
      return;
    }
    if (BLOCK_TAGS.has(tag)) {
      flushLooseRuns();
      if ((tag === 'DIV' || tag === 'P') && hasDirectBlockChild(node)) node.childNodes.forEach(visit);
      else blocks.push(blockFromElement(node));
      return;
    }
    collectRuns(node, { bold: false, italic: false, underline: false, strike: false, fontFamily: '' }, looseRuns);
  };

  root.childNodes.forEach(visit);
  flushLooseRuns();
  return normalizeRichDocument({ version: 1, blocks });
}

function sanitizePastedHtml(html) {
  const documentNode = new DOMParser().parseFromString(`<div id="booknerd-paste">${html}</div>`, 'text/html');
  const root = documentNode.getElementById('booknerd-paste');
  const clean = (element) => {
    [...element.children].forEach(clean);
    if (!ALLOWED_PASTE_TAGS.has(element.tagName) && element !== root) {
      element.replaceWith(...element.childNodes);
      return;
    }
    if (element === root) return;
    const style = element.style;
    const kept = {
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      fontFamily: safeFontFamily(style.fontFamily || element.getAttribute('face')),
      textDecoration: style.textDecorationLine || style.textDecoration,
      textAlign: style.textAlign,
      textIndent: safeCssLength(style.textIndent),
      marginLeft: safeCssLength(style.marginLeft),
      paddingLeft: safeCssLength(style.paddingLeft),
    };
    [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));
    if (kept.fontWeight) element.style.fontWeight = kept.fontWeight;
    if (kept.fontStyle) element.style.fontStyle = kept.fontStyle;
    if (kept.fontFamily) element.style.fontFamily = kept.fontFamily;
    if (kept.textDecoration) element.style.textDecoration = kept.textDecoration;
    if (kept.textAlign) element.style.textAlign = kept.textAlign;
    if (kept.textIndent) element.style.textIndent = kept.textIndent;
    if (kept.marginLeft) element.style.marginLeft = kept.marginLeft;
    if (kept.paddingLeft) element.style.paddingLeft = kept.paddingLeft;
  };
  clean(root);
  return root.innerHTML;
}

const RichChapterEditor = forwardRef(function RichChapterEditor({ value, fallbackText, onChange, onTextSelect }, forwardedRef) {
  const editorRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPosition, setSearchPosition] = useState({ current: 0, total: 0 });
  const [chatComposerOpen, setChatComposerOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState({ sender: '', side: 'incoming' });
  const [chatEmojiOpen, setChatEmojiOpen] = useState(false);
  const [chatEmojiCategory, setChatEmojiCategory] = useState(CHAT_EMOJI_CATEGORIES[0].id);
  const activeMatchRef = useRef(-1);
  const savedChatRangeRef = useRef(null);
  const chatEmojiAppendedRef = useRef(false);
  useImperativeHandle(forwardedRef, () => editorRef.current);
  const initialHtml = useMemo(() => richDocumentToEditorHtml(value, fallbackText), []); // Remounted when another chapter opens.
  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    onTextSelect?.('');
  }, [initialHtml]);

  const reportSelection = () => {
    const selection = window.getSelection?.();
    const anchor = selection?.anchorNode;
    const inside = anchor && editorRef.current?.contains(anchor.nodeType === 1 ? anchor : anchor.parentElement);
    onTextSelect?.(inside ? selection.toString().trim() : '');
  };

  const emitChange = () => {
    if (!editorRef.current) return;
    const documentValue = extractBlocks(editorRef.current);
    onChange({
      bodyRich: serializeRichDocument(documentValue),
      body: richDocumentToPlainText(documentValue),
    });
    if (searchQuery.trim()) {
      const text = editorRef.current.textContent || '';
      const needle = searchQuery.trim().toLocaleLowerCase('ru-RU');
      const total = needle ? text.toLocaleLowerCase('ru-RU').split(needle).length - 1 : 0;
      activeMatchRef.current = -1;
      setSearchPosition({ current: 0, total });
    }
  };

  const textMatches = () => {
    const root = editorRef.current;
    const needle = searchQuery.trim();
    if (!root || !needle) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let fullText = '';
    let node = walker.nextNode();
    while (node) {
      const start = fullText.length;
      fullText += node.nodeValue || '';
      nodes.push({ node, start, end: fullText.length });
      node = walker.nextNode();
    }
    const haystack = fullText.toLocaleLowerCase('ru-RU');
    const normalizedNeedle = needle.toLocaleLowerCase('ru-RU');
    const matches = [];
    let offset = 0;
    while (offset <= haystack.length - normalizedNeedle.length) {
      const start = haystack.indexOf(normalizedNeedle, offset);
      if (start < 0) break;
      matches.push({ start, end: start + normalizedNeedle.length, nodes });
      offset = start + Math.max(1, normalizedNeedle.length);
    }
    return matches;
  };

  const selectMatch = (direction) => {
    const matches = textMatches();
    if (!matches.length) {
      activeMatchRef.current = -1;
      setSearchPosition({ current: 0, total: 0 });
      return;
    }
    const nextIndex = direction < 0
      ? (activeMatchRef.current <= 0 ? matches.length - 1 : activeMatchRef.current - 1)
      : (activeMatchRef.current + 1) % matches.length;
    activeMatchRef.current = nextIndex;
    const match = matches[nextIndex];
    const startEntry = match.nodes.find((entry) => match.start >= entry.start && match.start < entry.end);
    const endEntry = [...match.nodes].reverse().find((entry) => match.end > entry.start && match.end <= entry.end);
    if (!startEntry || !endEntry) return;
    const range = document.createRange();
    range.setStart(startEntry.node, match.start - startEntry.start);
    range.setEnd(endEntry.node, match.end - endEntry.start);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    startEntry.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setSearchPosition({ current: nextIndex + 1, total: matches.length });
    onTextSelect?.(selection.toString().trim());
  };

  const updateSearch = (nextQuery) => {
    setSearchQuery(nextQuery);
    activeMatchRef.current = -1;
    const needle = nextQuery.trim().toLocaleLowerCase('ru-RU');
    const haystack = editorRef.current?.textContent?.toLocaleLowerCase('ru-RU') || '';
    setSearchPosition({ current: 0, total: needle ? haystack.split(needle).length - 1 : 0 });
  };

  const clearSearch = () => {
    updateSearch('');
    window.getSelection()?.removeAllRanges();
    editorRef.current?.focus();
  };

  const command = (name, commandValue = null) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    emitChange();
  };

  const handleEditorShortcut = (event) => {
    const commandKey = event.ctrlKey || event.metaKey;
    if (!commandKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault();
      command(event.shiftKey ? 'redo' : 'undo');
    } else if (key === 'y') {
      event.preventDefault();
      command('redo');
    }
  };

  const selectedBlock = () => {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection?.anchorNode?.parentElement;
    const block = anchor?.closest?.('p,div,h1,h2,h3,blockquote,li');
    return block && editorRef.current?.contains(block) ? block : null;
  };

  const blocksForRange = (range) => {
    const root = editorRef.current;
    if (!root || !range) return [];
    const candidates = [...root.querySelectorAll('p,div,h1,h2,h3,blockquote,li')]
      .filter((element) => {
        try {
          return range.intersectsNode(element);
        } catch {
          return false;
        }
      });
    const leafBlocks = candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
    if (leafBlocks.length) return leafBlocks;
    const node = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range.startContainer.parentElement;
    const block = node?.closest?.('p,div,h1,h2,h3,blockquote,li');
    return block && root.contains(block) ? [block] : [];
  };

  const restoreChatSelection = () => {
    const range = savedChatRangeRef.current;
    if (!range || !editorRef.current?.contains(range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)) return null;
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return range;
  };

  const openChatComposer = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const inside = range && editorRef.current?.contains(range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement);
    savedChatRangeRef.current = inside ? range : null;
    const block = inside ? blocksForRange(range)[0] : selectedBlock();
    setChatDraft({
      sender: block?.dataset?.chatSender || '',
      side: block?.dataset?.chatSide === 'outgoing' ? 'outgoing' : 'incoming',
    });
    setChatEmojiOpen(false);
    chatEmojiAppendedRef.current = false;
    setChatComposerOpen(true);
  };

  const appendChatEmoji = (emoji) => {
    const range = restoreChatSelection();
    const blocks = range ? blocksForRange(range) : [selectedBlock()].filter(Boolean);
    const block = blocks[0];
    if (!block) return;
    const currentText = block.textContent || '';
    const prefix = !chatEmojiAppendedRef.current && currentText && !/\s$/.test(currentText) ? ' ' : '';
    block.appendChild(document.createTextNode(`${prefix}${emoji}`));
    const nextRange = document.createRange();
    nextRange.selectNodeContents(block);
    nextRange.collapse(false);
    savedChatRangeRef.current = nextRange.cloneRange();
    chatEmojiAppendedRef.current = true;
    emitChange();
  };

  const applyChatStyle = () => {
    const sender = chatDraft.sender.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!sender) return;
    const range = restoreChatSelection();
    const blocks = range ? blocksForRange(range) : [selectedBlock()].filter(Boolean);
    blocks.forEach((block) => {
      block.dataset.chatSide = chatDraft.side;
      block.dataset.chatSender = sender;
      block.classList.remove('is-incoming', 'is-outgoing');
      block.classList.add('admin-chat-message', `is-${chatDraft.side}`);
      block.style.textIndent = '';
      block.style.marginLeft = '';
      block.style.paddingLeft = '';
      block.style.textAlign = '';
    });
    if (!blocks.length) return;
    setChatComposerOpen(false);
    emitChange();
    editorRef.current?.focus();
  };

  const removeChatStyle = () => {
    const range = restoreChatSelection();
    const blocks = range ? blocksForRange(range) : [selectedBlock()].filter(Boolean);
    blocks.forEach((block) => {
      delete block.dataset.chatSide;
      delete block.dataset.chatSender;
      block.classList.remove('admin-chat-message', 'is-incoming', 'is-outgoing');
    });
    if (!blocks.length) return;
    setChatComposerOpen(false);
    emitChange();
    editorRef.current?.focus();
  };

  const toggleFirstLine = () => {
    editorRef.current?.focus();
    let block = selectedBlock();
    if (!block) {
      document.execCommand('formatBlock', false, 'p');
      block = selectedBlock();
    }
    if (block) block.style.textIndent = block.style.textIndent ? '' : '2em';
    emitChange();
  };

  const changeBlockIndent = (direction) => {
    editorRef.current?.focus();
    const block = selectedBlock();
    if (!block) return;
    const current = block.style.marginLeft.endsWith('em') ? Number.parseFloat(block.style.marginLeft) : 0;
    const next = Math.max(0, Math.min(12, current + direction * 2));
    block.style.marginLeft = next ? `${next}em` : '';
    emitChange();
  };

  const toolbarButton = (label, icon, action) => (
    <button type="button" title={label} aria-label={label} onMouseDown={(event) => { event.preventDefault(); action(); }}>{icon}</button>
  );

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-toolbar" aria-label="Оформление текста">
        <div>{toolbarButton('Отменить последнее изменение — Ctrl+Z', <><Undo2 size={16} /><span>Отменить</span></>, () => command('undo'))}{toolbarButton('Вернуть отменённое изменение — Ctrl+Y', <><Redo2 size={16} /><span>Вернуть</span></>, () => command('redo'))}</div>
        <div>{toolbarButton('Жирный текст', <Bold size={17} />, () => command('bold'))}{toolbarButton('Курсив', <Italic size={17} />, () => command('italic'))}{toolbarButton('Подчёркивание', <Underline size={17} />, () => command('underline'))}</div>
        <div>{toolbarButton('Оформить сообщение из переписки', <><Smartphone size={16} /><span>Переписка</span></>, openChatComposer)}</div>
        <div>{toolbarButton('По левому краю', <AlignLeft size={17} />, () => command('justifyLeft'))}{toolbarButton('По центру', <AlignCenter size={17} />, () => command('justifyCenter'))}{toolbarButton('По правому краю', <AlignRight size={17} />, () => command('justifyRight'))}{toolbarButton('По ширине', <AlignJustify size={17} />, () => command('justifyFull'))}</div>
        <div>{toolbarButton('Маркированный список', <List size={17} />, () => command('insertUnorderedList'))}{toolbarButton('Нумерованный список', <ListOrdered size={17} />, () => command('insertOrderedList'))}{toolbarButton('Цитата', <Quote size={17} />, () => command('formatBlock', 'blockquote'))}</div>
        <div>{toolbarButton('Отступ первой строки', <><Pilcrow size={16} /><span>Красная строка</span></>, toggleFirstLine)}{toolbarButton('Уменьшить отступ абзаца', <IndentDecrease size={17} />, () => changeBlockIndent(-1))}{toolbarButton('Увеличить отступ абзаца', <IndentIncrease size={17} />, () => changeBlockIndent(1))}{toolbarButton('Очистить оформление', <Eraser size={17} />, () => command('removeFormat'))}</div>
      </div>
      {chatComposerOpen ? (
        <div className="admin-chat-composer" role="dialog" aria-label="Оформление сообщения">
          <div className="admin-chat-composer-head">
            <div>
              <strong>Сообщение в переписке</strong>
              <small>Выделяйте по одному сообщению, чтобы имя и сторона были правильными.</small>
            </div>
            <button type="button" onClick={() => setChatComposerOpen(false)} aria-label="Закрыть оформление переписки"><X size={17} /></button>
          </div>
          <label>
            <span>Имя отправителя</span>
            <input
              value={chatDraft.sender}
              onChange={(event) => setChatDraft((current) => ({ ...current, sender: event.target.value }))}
              placeholder="Например, Ализэ"
              maxLength={80}
              autoFocus
            />
          </label>
          <div className="admin-chat-side-picker" role="radiogroup" aria-label="Расположение сообщения">
            <button type="button" className={chatDraft.side === 'incoming' ? 'is-active' : ''} onClick={() => setChatDraft((current) => ({ ...current, side: 'incoming' }))} role="radio" aria-checked={chatDraft.side === 'incoming'}>
              <span className="admin-chat-side-preview is-incoming">Слева</span>
              <small>сообщение собеседника</small>
            </button>
            <button type="button" className={chatDraft.side === 'outgoing' ? 'is-active' : ''} onClick={() => setChatDraft((current) => ({ ...current, side: 'outgoing' }))} role="radio" aria-checked={chatDraft.side === 'outgoing'}>
              <span className="admin-chat-side-preview is-outgoing">Справа</span>
              <small>ответ второго героя</small>
            </button>
          </div>
          <section className="admin-chat-emoji">
            <header>
              <div>
                <strong>Эмодзи для сообщения</strong>
                <small>На iPhone отображаются в оригинальном стиле Apple.</small>
              </div>
              <button type="button" onClick={() => setChatEmojiOpen((current) => !current)} aria-expanded={chatEmojiOpen}>
                <Smile size={17} />
                {chatEmojiOpen ? 'Скрыть' : 'Добавить эмодзи'}
              </button>
            </header>
            {chatEmojiOpen ? (
              <div className="admin-chat-emoji-browser">
                <nav aria-label="Категории эмодзи">
                  {CHAT_EMOJI_CATEGORIES.map((category) => (
                    <button
                      type="button"
                      className={chatEmojiCategory === category.id ? 'is-active' : ''}
                      onClick={() => setChatEmojiCategory(category.id)}
                      aria-pressed={chatEmojiCategory === category.id}
                      key={category.id}
                    >
                      <span>{category.sample}</span>
                      {category.name}
                    </button>
                  ))}
                </nav>
                <div className="admin-chat-emoji-grid" aria-label="Выберите эмодзи">
                  {(CHAT_EMOJI_CATEGORIES.find((category) => category.id === chatEmojiCategory) || CHAT_EMOJI_CATEGORIES[0]).emojis.map((emoji) => (
                    <button type="button" onClick={() => appendChatEmoji(emoji)} title={`Добавить ${emoji}`} aria-label={`Добавить эмодзи ${emoji}`} key={emoji}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <small>Эмодзи добавится в конец выделенного сообщения. При необходимости его можно переставить в тексте.</small>
              </div>
            ) : null}
          </section>
          <div className="admin-chat-composer-actions">
            <button type="button" className="admin-secondary" onClick={removeChatStyle}>Убрать пузырёк</button>
            <button type="button" className="admin-primary" onClick={applyChatStyle} disabled={!chatDraft.sender.trim()}>Применить</button>
          </div>
        </div>
      ) : null}
      <div className="admin-rich-search" role="search">
        <label>
          <Search size={17} />
          <input
            value={searchQuery}
            onChange={(event) => updateSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              selectMatch(event.shiftKey ? -1 : 1);
            }}
            placeholder="Найти слово или фразу в тексте главы"
            aria-label="Поиск в тексте главы"
          />
        </label>
        <span>{searchQuery.trim() ? (searchPosition.total ? `${searchPosition.current || '—'} из ${searchPosition.total}` : 'Совпадений нет') : 'Поиск по главе'}</span>
        <div className="admin-rich-search-actions">
          <button type="button" onClick={() => selectMatch(-1)} disabled={!searchPosition.total} title="Предыдущее совпадение" aria-label="Предыдущее совпадение"><ChevronUp size={16} /></button>
          <button type="button" onClick={() => selectMatch(1)} disabled={!searchPosition.total} title="Следующее совпадение" aria-label="Следующее совпадение"><ChevronDown size={16} /></button>
          <button type="button" onClick={clearSearch} disabled={!searchQuery} title="Очистить поиск" aria-label="Очистить поиск"><X size={16} /></button>
        </div>
      </div>
      <div
        ref={editorRef}
        className="admin-rich-content"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder="Вставьте сюда текст переведённой главы…"
        onInput={emitChange}
        onBlur={emitChange}
        onMouseUp={reportSelection}
        onKeyUp={reportSelection}
        onKeyDown={handleEditorShortcut}
        onPaste={(event) => {
          const html = event.clipboardData.getData('text/html');
          if (!html) return;
          event.preventDefault();
          document.execCommand('insertHTML', false, sanitizePastedHtml(html));
          emitChange();
        }}
      />
      <p className="admin-rich-hint"><strong>Переписка:</strong> выделите одно сообщение, нажмите «Переписка», укажите имя, сторону пузырька и при желании добавьте эмодзи. На iPhone эмодзи отображаются в стиле Apple. <strong>Случайно изменили текст?</strong> Нажмите «Отменить» или Ctrl+Z.</p>
    </div>
  );
});

export default RichChapterEditor;
