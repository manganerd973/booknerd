'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  ImagePlus,
  List,
  ListOrdered,
  LoaderCircle,
  Pilcrow,
  Pin,
  Quote,
  Redo2,
  Search,
  Smile,
  Smartphone,
  Trash2,
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

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'BLOCKQUOTE', 'LI', 'FIGURE']);
const ALLOWED_PASTE_TAGS = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'SPAN', 'FONT']);
const CHAPTER_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const CHAPTER_IMAGE_MAX_UPLOAD_BYTES = 300 * 1024;
const CHAPTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_CHAPTER_IMAGES = 24;
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
const MAX_PINNED_CHAT_SENDERS = 24;

function normalizeChatSenderName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function normalizePinnedChatSenders(value) {
  if (!Array.isArray(value)) return [];
  const names = new Set();
  return value.reduce((result, item) => {
    const name = normalizeChatSenderName(typeof item === 'string' ? item : item?.name);
    const normalizedName = name.toLocaleLowerCase('ru-RU');
    if (!name || names.has(normalizedName) || result.length >= MAX_PINNED_CHAT_SENDERS) return result;
    names.add(normalizedName);
    result.push({
      name,
      side: typeof item === 'object' && item?.side === 'outgoing' ? 'outgoing' : 'incoming',
    });
    return result;
  }, []);
}

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

function imageBlockFromElement(element) {
  return {
    type: 'image',
    src: element.dataset?.imageSrc || element.querySelector('img')?.getAttribute('src') || '',
    alt: element.dataset?.imageAlt || element.querySelector('img')?.getAttribute('alt') || '',
    size: element.dataset?.imageSize || 'small',
    align: element.dataset?.imageAlign || 'center',
    width: Number(element.dataset?.imageWidth || element.querySelector('img')?.getAttribute('width') || 0),
    height: Number(element.dataset?.imageHeight || element.querySelector('img')?.getAttribute('height') || 0),
    runs: [],
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
    if (tag === 'FIGURE' && node.dataset?.chapterImage === 'true') {
      flushLooseRuns();
      blocks.push(imageBlockFromElement(node));
      return;
    }
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
  return normalizeRichDocument({ version: 2, blocks });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить фото.')), type, quality);
  });
}

async function prepareChapterImage(file) {
  if (!CHAPTER_IMAGE_TYPES.has(file.type)) throw new Error('Поддерживаются JPG, PNG и WEBP.');
  if (!file.size || file.size > CHAPTER_IMAGE_MAX_SOURCE_BYTES) throw new Error('Исходное фото должно быть меньше 12 МБ.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Не удалось прочитать фото.'));
      image.src = objectUrl;
    });
    const attempts = [
      { width: 1600, height: 1400, quality: .84 },
      { width: 1350, height: 1200, quality: .74 },
      { width: 1100, height: 1000, quality: .64 },
      { width: 900, height: 850, quality: .56 },
    ];
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.width / image.naturalWidth, attempt.height / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Браузер не смог подготовить фото.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, 'image/webp', attempt.quality);
      if (blob.size <= CHAPTER_IMAGE_MAX_UPLOAD_BYTES) {
        return {
          file: new File([blob], `booknerd-chapter-image-${Date.now()}.webp`, { type: 'image/webp' }),
          width: canvas.width,
          height: canvas.height,
        };
      }
    }
    throw new Error('Фото не удалось сделать достаточно лёгким. Выберите изображение попроще.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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

const RichChapterEditor = forwardRef(function RichChapterEditor({ value, fallbackText, onChange, onTextSelect, bookKey }, forwardedRef) {
  const editorRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPosition, setSearchPosition] = useState({ current: 0, total: 0 });
  const [chatComposerOpen, setChatComposerOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState({ sender: '', side: 'incoming' });
  const [chatTargetCount, setChatTargetCount] = useState(0);
  const [pinnedChatSenders, setPinnedChatSenders] = useState([]);
  const [chatEmojiOpen, setChatEmojiOpen] = useState(false);
  const [chatEmojiCategory, setChatEmojiCategory] = useState(CHAT_EMOJI_CATEGORIES[0].id);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageNotice, setImageNotice] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const activeMatchRef = useRef(-1);
  const imageInputRef = useRef(null);
  const imageAnchorRef = useRef(null);
  const selectedImageElementRef = useRef(null);
  const savedChatRangeRef = useRef(null);
  const savedChatBlocksRef = useRef([]);
  const chatScrollSnapshotRef = useRef(null);
  const chatEmojiAppendedRef = useRef(false);
  useImperativeHandle(forwardedRef, () => editorRef.current);
  const initialHtml = useMemo(() => richDocumentToEditorHtml(value, fallbackText), []); // Remounted when another chapter opens.
  const chatSendersStorageKey = useMemo(() => {
    const normalizedBookKey = String(bookKey || '').trim();
    return normalizedBookKey ? `booknerd:chat-senders:${normalizedBookKey}` : '';
  }, [bookKey]);
  const legacyChatSenderStorageKey = useMemo(() => {
    const normalizedBookKey = String(bookKey || '').trim();
    return normalizedBookKey ? `booknerd:chat-sender:${normalizedBookKey}` : '';
  }, [bookKey]);

  useEffect(() => {
    let savedSenders = [];
    if (chatSendersStorageKey) {
      try {
        const stored = window.localStorage.getItem(chatSendersStorageKey);
        savedSenders = normalizePinnedChatSenders(stored ? JSON.parse(stored) : []);
        if (!savedSenders.length && legacyChatSenderStorageKey) {
          const legacyName = normalizeChatSenderName(window.localStorage.getItem(legacyChatSenderStorageKey));
          if (legacyName) {
            savedSenders = [{ name: legacyName, side: 'incoming' }];
            window.localStorage.setItem(chatSendersStorageKey, JSON.stringify(savedSenders));
            window.localStorage.removeItem(legacyChatSenderStorageKey);
          }
        }
      } catch {
        savedSenders = [];
      }
    }
    setPinnedChatSenders(savedSenders);
    setChatDraft({
      sender: savedSenders[0]?.name || '',
      side: savedSenders[0]?.side || 'incoming',
    });
  }, [chatSendersStorageKey, legacyChatSenderStorageKey]);

  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
    savedChatRangeRef.current = null;
    savedChatBlocksRef.current = [];
    selectedImageElementRef.current = null;
    setSelectedImage(null);
    onTextSelect?.('');
  }, [initialHtml]);

  const reportSelection = () => {
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const ancestor = range?.commonAncestorContainer;
    const ancestorElement = ancestor?.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor?.parentElement;
    const inside = Boolean(range && ancestorElement && editorRef.current?.contains(ancestorElement));
    if (inside) {
      savedChatRangeRef.current = range.cloneRange();
      const blocks = blocksForRange(range);
      savedChatBlocksRef.current = blocks;
      if (chatComposerOpen) {
        setChatTargetCount(blocks.length);
        rememberChatScroll();
      }
    }
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

  const topLevelEditorBlock = (element) => {
    const root = editorRef.current;
    let current = element;
    while (current?.parentElement && current.parentElement !== root) current = current.parentElement;
    return current?.parentElement === root ? current : null;
  };

  const rememberImageAnchor = () => {
    const selection = window.getSelection?.();
    const node = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;
    const block = node?.closest?.('p,div,h1,h2,h3,blockquote,li,figure[data-chapter-image="true"]');
    imageAnchorRef.current = block && editorRef.current?.contains(block) ? topLevelEditorBlock(block) : null;
  };

  const createImageFigure = ({ src, alt = '', size = 'small', align = 'center', width = 0, height = 0 }) => {
    const figure = document.createElement('figure');
    figure.className = `admin-chapter-image is-${size} align-${align}`;
    figure.dataset.chapterImage = 'true';
    figure.dataset.imageSrc = src;
    figure.dataset.imageAlt = alt;
    figure.dataset.imageSize = size;
    figure.dataset.imageAlign = align;
    figure.dataset.imageWidth = String(width || 0);
    figure.dataset.imageHeight = String(height || 0);
    figure.contentEditable = 'false';
    figure.tabIndex = 0;
    const image = document.createElement('img');
    image.src = src;
    image.alt = alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (width) image.width = width;
    if (height) image.height = height;
    const caption = document.createElement('figcaption');
    caption.textContent = 'Фото в тексте · маленькое';
    figure.append(image, caption);
    return figure;
  };

  const selectImageFigure = (figure) => {
    if (!figure?.isConnected) {
      selectedImageElementRef.current = null;
      setSelectedImage(null);
      return;
    }
    selectedImageElementRef.current = figure;
    setSelectedImage({
      src: figure.dataset.imageSrc || '',
      alt: figure.dataset.imageAlt || '',
      size: figure.dataset.imageSize || 'small',
      align: figure.dataset.imageAlign || 'center',
    });
  };

  const insertImageFigure = (imageData) => {
    const root = editorRef.current;
    if (!root) return;
    const figure = createImageFigure(imageData);
    const anchor = imageAnchorRef.current;
    if (anchor?.isConnected && root.contains(anchor)) anchor.insertAdjacentElement('afterend', figure);
    else root.append(figure);
    const paragraph = document.createElement('p');
    paragraph.append(document.createElement('br'));
    figure.insertAdjacentElement('afterend', paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    range.collapse(true);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    imageAnchorRef.current = null;
    selectImageFigure(figure);
    emitChange();
    figure.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const openImagePicker = () => {
    if (imageUploading) return;
    if ((editorRef.current?.querySelectorAll('figure[data-chapter-image="true"]').length || 0) >= MAX_CHAPTER_IMAGES) {
      setImageNotice('В одной главе можно разместить не больше 24 изображений.');
      return;
    }
    rememberImageAnchor();
    setImageNotice('');
    imageInputRef.current?.click();
  };

  const uploadChapterImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageUploading(true);
    setImageNotice('Подготавливаем маленькое фото…');
    try {
      const prepared = await prepareChapterImage(file);
      const formData = new FormData();
      formData.append('image', prepared.file, prepared.file.name);
      const response = await fetch('/api/admin/chapter-images', { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить фото.');
      insertImageFigure({ src: data.imageUrl, width: prepared.width, height: prepared.height });
      setImageNotice('Фото добавлено после выбранного абзаца. Теперь сохраните главу.');
    } catch (error) {
      setImageNotice(error.message || 'Не удалось добавить фото.');
    } finally {
      setImageUploading(false);
    }
  };

  const updateSelectedImage = (patch) => {
    const figure = selectedImageElementRef.current;
    if (!figure?.isConnected) return selectImageFigure(null);
    const next = { ...selectedImage, ...patch };
    figure.dataset.imageAlt = next.alt || '';
    figure.dataset.imageSize = next.size;
    figure.dataset.imageAlign = next.align;
    figure.className = `admin-chapter-image is-${next.size} align-${next.align}`;
    const image = figure.querySelector('img');
    if (image) image.alt = next.alt || '';
    const caption = figure.querySelector('figcaption');
    if (caption) caption.textContent = `Фото в тексте · ${next.size === 'small' ? 'маленькое' : next.size === 'medium' ? 'среднее' : 'по ширине'}`;
    setSelectedImage(next);
    emitChange();
  };

  const removeSelectedImage = () => {
    const figure = selectedImageElementRef.current;
    if (!figure?.isConnected) return selectImageFigure(null);
    const next = figure.nextElementSibling || figure.previousElementSibling;
    figure.remove();
    selectedImageElementRef.current = null;
    setSelectedImage(null);
    emitChange();
    next?.scrollIntoView?.({ block: 'center' });
    editorRef.current?.focus();
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

  const savedChatBlocks = () => {
    const root = editorRef.current;
    if (!root) return [];
    const connectedBlocks = savedChatBlocksRef.current.filter((block) => block?.isConnected && root.contains(block));
    if (connectedBlocks.length) return connectedBlocks;
    const range = restoreChatSelection();
    const blocks = range ? blocksForRange(range) : [selectedBlock()].filter(Boolean);
    savedChatBlocksRef.current = blocks;
    return blocks;
  };

  const rememberChatScroll = () => {
    chatScrollSnapshotRef.current = {
      editorTop: editorRef.current?.scrollTop || 0,
      windowX: window.scrollX,
      windowY: window.scrollY,
    };
  };

  const restoreChatScroll = ({ focusEditor = false } = {}) => {
    const snapshot = chatScrollSnapshotRef.current;
    if (!snapshot) return;
    const restore = () => {
      if (editorRef.current) editorRef.current.scrollTop = snapshot.editorTop;
      window.scrollTo(snapshot.windowX, snapshot.windowY);
      if (focusEditor) editorRef.current?.focus?.({ preventScroll: true });
    };
    restore();
    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
  };

  const closeChatComposer = () => {
    setChatComposerOpen(false);
    restoreChatScroll();
  };

  const openChatComposer = () => {
    rememberChatScroll();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const inside = range && editorRef.current?.contains(range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement);
    if (inside) {
      savedChatRangeRef.current = range;
      savedChatBlocksRef.current = blocksForRange(range);
    }
    const targetBlocks = savedChatBlocks();
    const block = targetBlocks[0];
    setChatTargetCount(targetBlocks.length);
    const defaultSender = pinnedChatSenders[0];
    setChatDraft({
      sender: block?.dataset?.chatSender || defaultSender?.name || '',
      side: block?.dataset?.chatSide === 'outgoing'
        ? 'outgoing'
        : block?.dataset?.chatSide === 'incoming'
          ? 'incoming'
          : defaultSender?.side || 'incoming',
    });
    setChatEmojiOpen(false);
    chatEmojiAppendedRef.current = false;
    setChatComposerOpen(true);
    restoreChatScroll();
  };

  const persistPinnedChatSenders = (value) => {
    const nextSenders = normalizePinnedChatSenders(value);
    if (chatSendersStorageKey) {
      try {
        if (nextSenders.length) window.localStorage.setItem(chatSendersStorageKey, JSON.stringify(nextSenders));
        else window.localStorage.removeItem(chatSendersStorageKey);
      } catch {
        // The names still stay available until the editor is closed when browser storage is unavailable.
      }
    }
    setPinnedChatSenders(nextSenders);
    return nextSenders;
  };

  const selectPinnedChatSender = (sender) => {
    setChatDraft({ sender: sender.name, side: sender.side });
  };

  const pinChatSender = () => {
    const name = normalizeChatSenderName(chatDraft.sender);
    if (!name || !chatSendersStorageKey) return;
    const normalizedName = name.toLocaleLowerCase('ru-RU');
    const existingIndex = pinnedChatSenders.findIndex((sender) => sender.name.toLocaleLowerCase('ru-RU') === normalizedName);
    const nextSenders = [...pinnedChatSenders];
    if (existingIndex >= 0) nextSenders[existingIndex] = { name, side: chatDraft.side };
    else nextSenders.push({ name, side: chatDraft.side });
    persistPinnedChatSenders(nextSenders);
    setChatDraft({ sender: name, side: chatDraft.side });
  };

  const unpinChatSender = (name) => {
    const normalizedName = normalizeChatSenderName(name).toLocaleLowerCase('ru-RU');
    const nextSenders = persistPinnedChatSenders(
      pinnedChatSenders.filter((sender) => sender.name.toLocaleLowerCase('ru-RU') !== normalizedName),
    );
    if (normalizeChatSenderName(chatDraft.sender).toLocaleLowerCase('ru-RU') === normalizedName) {
      setChatDraft({
        sender: nextSenders[0]?.name || '',
        side: nextSenders[0]?.side || 'incoming',
      });
    }
  };

  const appendChatEmoji = (emoji) => {
    const blocks = savedChatBlocks();
    const block = blocks[0];
    if (!block) return;
    const currentText = block.textContent || '';
    const prefix = !chatEmojiAppendedRef.current && currentText && !/\s$/.test(currentText) ? ' ' : '';
    block.appendChild(document.createTextNode(`${prefix}${emoji}`));
    const nextRange = document.createRange();
    nextRange.selectNodeContents(block);
    nextRange.collapse(false);
    savedChatRangeRef.current = nextRange.cloneRange();
    savedChatBlocksRef.current = [block];
    chatEmojiAppendedRef.current = true;
    emitChange();
  };

  const applyChatStyle = () => {
    const sender = normalizeChatSenderName(chatDraft.sender);
    if (!sender) return;
    const blocks = savedChatBlocks();
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
    emitChange();
    savedChatRangeRef.current = null;
    savedChatBlocksRef.current = [];
    setChatTargetCount(0);
    restoreChatScroll();
  };

  const removeChatStyle = () => {
    const blocks = savedChatBlocks();
    blocks.forEach((block) => {
      delete block.dataset.chatSide;
      delete block.dataset.chatSender;
      block.classList.remove('admin-chat-message', 'is-incoming', 'is-outgoing');
    });
    if (!blocks.length) return;
    emitChange();
    savedChatRangeRef.current = null;
    savedChatBlocksRef.current = [];
    setChatTargetCount(0);
    restoreChatScroll();
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
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        action();
      }}
      onKeyDown={(event) => {
        if (event.repeat || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        action();
      }}
    >
      {icon}
    </button>
  );
  const normalizedChatDraftSender = normalizeChatSenderName(chatDraft.sender);
  const selectedPinnedChatSender = pinnedChatSenders.find(
    (sender) => sender.name.toLocaleLowerCase('ru-RU') === normalizedChatDraftSender.toLocaleLowerCase('ru-RU'),
  );
  const chatSenderAlreadySaved = selectedPinnedChatSender?.side === chatDraft.side;

  return (
    <div className="admin-rich-editor">
      <div className="admin-rich-toolbar" aria-label="Оформление текста">
        <div>{toolbarButton('Отменить последнее изменение — Ctrl+Z', <><Undo2 size={16} /><span>Отменить</span></>, () => command('undo'))}{toolbarButton('Вернуть отменённое изменение — Ctrl+Y', <><Redo2 size={16} /><span>Вернуть</span></>, () => command('redo'))}</div>
        <div>{toolbarButton('Жирный текст', <Bold size={17} />, () => command('bold'))}{toolbarButton('Курсив', <Italic size={17} />, () => command('italic'))}{toolbarButton('Подчёркивание', <Underline size={17} />, () => command('underline'))}</div>
        <div>{toolbarButton('Оформить сообщение из переписки', <><Smartphone size={16} /><span>Переписка</span></>, openChatComposer)}</div>
        <div>{toolbarButton('Добавить маленькое фото после выбранного абзаца', <>{imageUploading ? <LoaderCircle className="spin" size={16} /> : <ImagePlus size={16} />}<span>{imageUploading ? 'Загрузка' : 'Фото'}</span></>, openImagePicker)}</div>
        <div>{toolbarButton('По левому краю', <AlignLeft size={17} />, () => command('justifyLeft'))}{toolbarButton('По центру', <AlignCenter size={17} />, () => command('justifyCenter'))}{toolbarButton('По правому краю', <AlignRight size={17} />, () => command('justifyRight'))}{toolbarButton('По ширине', <AlignJustify size={17} />, () => command('justifyFull'))}</div>
        <div>{toolbarButton('Маркированный список', <List size={17} />, () => command('insertUnorderedList'))}{toolbarButton('Нумерованный список', <ListOrdered size={17} />, () => command('insertOrderedList'))}{toolbarButton('Цитата', <Quote size={17} />, () => command('formatBlock', 'blockquote'))}</div>
        <div>{toolbarButton('Отступ первой строки', <><Pilcrow size={16} /><span>Красная строка</span></>, toggleFirstLine)}{toolbarButton('Уменьшить отступ абзаца', <IndentDecrease size={17} />, () => changeBlockIndent(-1))}{toolbarButton('Увеличить отступ абзаца', <IndentIncrease size={17} />, () => changeBlockIndent(1))}{toolbarButton('Очистить оформление', <Eraser size={17} />, () => command('removeFormat'))}</div>
        <input ref={imageInputRef} className="admin-rich-image-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadChapterImage} tabIndex="-1" aria-hidden="true" />
      </div>
      {imageNotice ? <p className="admin-rich-image-notice" role="status">{imageNotice}</p> : null}
      {selectedImage ? (
        <section className="admin-rich-image-settings" aria-label="Настройки фото в тексте">
          <div>
            <strong>Фото в тексте</strong>
            <small>Настройки применяются только к выбранному фото.</small>
          </div>
          <label>
            <span>Описание для доступности</span>
            <input value={selectedImage.alt} onChange={(event) => updateSelectedImage({ alt: event.target.value })} maxLength="240" placeholder="Оставьте пустым, если это декоративная картинка" />
          </label>
          <div className="admin-rich-image-options">
            <span>Размер</span>
            {[
              ['small', 'Маленькое'],
              ['medium', 'Среднее'],
              ['wide', 'По ширине'],
            ].map(([value, label]) => <button type="button" className={selectedImage.size === value ? 'is-active' : ''} onClick={() => updateSelectedImage({ size: value })} aria-pressed={selectedImage.size === value} key={value}>{label}</button>)}
          </div>
          <div className="admin-rich-image-options">
            <span>Положение</span>
            {[
              ['left', 'Слева'],
              ['center', 'По центру'],
              ['right', 'Справа'],
            ].map(([value, label]) => <button type="button" className={selectedImage.align === value ? 'is-active' : ''} onClick={() => updateSelectedImage({ align: value })} aria-pressed={selectedImage.align === value} key={value}>{label}</button>)}
          </div>
          <button type="button" className="admin-rich-image-remove" onClick={removeSelectedImage}><Trash2 size={15} /> Удалить из текста</button>
        </section>
      ) : null}
      {chatComposerOpen ? (
        <div className="admin-chat-composer" role="dialog" aria-label="Оформление сообщения">
          <div className="admin-chat-composer-head">
            <div>
              <strong>Сообщение в переписке</strong>
              <small className={chatTargetCount ? 'admin-chat-target-ready' : 'admin-chat-target-missing'}>
                {chatTargetCount
                  ? chatTargetCount === 1
                    ? 'Сообщение выбрано — укажите имя и сторону.'
                    : `Выбрано сообщений: ${chatTargetCount}. Оформление применится ко всем.`
                  : 'Сначала выделите сообщение в тексте, затем нажмите «Переписка».'}
              </small>
            </div>
            <button type="button" onClick={closeChatComposer} aria-label="Закрыть оформление переписки"><X size={17} /></button>
          </div>
          <label>
            <span>Имя отправителя</span>
            <input
              value={chatDraft.sender}
              onChange={(event) => setChatDraft((current) => ({ ...current, sender: event.target.value }))}
              placeholder="Например, Ализэ"
              maxLength={80}
            />
          </label>
          <div className={`admin-chat-pinned-senders ${pinnedChatSenders.length ? 'is-pinned' : ''}`}>
            <header>
              <Pin size={16} />
              <div>
                <strong>Герои этой книги</strong>
                <small>{pinnedChatSenders.length ? `Закреплено имён: ${pinnedChatSenders.length}` : 'Имён пока нет'}</small>
              </div>
            </header>
            {pinnedChatSenders.length ? (
              <div className="admin-chat-sender-list" aria-label="Закреплённые имена героев">
                {pinnedChatSenders.map((sender) => {
                  const isSelected = sender.name.toLocaleLowerCase('ru-RU') === normalizedChatDraftSender.toLocaleLowerCase('ru-RU');
                  return (
                    <div className={isSelected ? 'is-selected' : ''} key={sender.name.toLocaleLowerCase('ru-RU')}>
                      <button type="button" onClick={() => selectPinnedChatSender(sender)} aria-pressed={isSelected}>
                        <strong>{sender.name}</strong>
                        <small>{sender.side === 'outgoing' ? 'справа' : 'слева'}</small>
                      </button>
                      <button type="button" className="is-unpin" onClick={() => unpinChatSender(sender.name)} aria-label={`Открепить имя ${sender.name}`}>
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>Введите первое имя, выберите его обычную сторону и закрепите.</p>
            )}
            <div className="admin-chat-sender-actions">
              <button
                type="button"
                onClick={pinChatSender}
                disabled={!normalizedChatDraftSender || !chatSendersStorageKey || chatSenderAlreadySaved}
              >
                <Pin size={14} />
                {selectedPinnedChatSender
                  ? 'Сохранить сторону героя'
                  : pinnedChatSenders.length
                    ? 'Закрепить ещё одно имя'
                    : 'Закрепить имя'}
              </button>
            </div>
            <small>Нажмите на закреплённое имя, чтобы быстро выбрать героя. У каждого имени запоминается своя обычная сторона, но её можно менять для любого сообщения.</small>
          </div>
          <div className="admin-chat-side-picker" role="radiogroup" aria-label="Расположение сообщения">
            <button type="button" className={chatDraft.side === 'incoming' ? 'is-active' : ''} onClick={() => setChatDraft((current) => ({ ...current, side: 'incoming' }))} role="radio" aria-checked={chatDraft.side === 'incoming'}>
              <span className="admin-chat-side-preview is-incoming">Слева</span>
              <small>сообщение выбранного героя</small>
            </button>
            <button type="button" className={chatDraft.side === 'outgoing' ? 'is-active' : ''} onClick={() => setChatDraft((current) => ({ ...current, side: 'outgoing' }))} role="radio" aria-checked={chatDraft.side === 'outgoing'}>
              <span className="admin-chat-side-preview is-outgoing">Справа</span>
              <small>сообщение выбранного героя</small>
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
            <button type="button" className="admin-secondary" onClick={removeChatStyle} disabled={!chatTargetCount}>Убрать пузырёк</button>
            <button type="button" className="admin-primary" onClick={applyChatStyle} disabled={!chatDraft.sender.trim() || !chatTargetCount}>Применить</button>
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
        onPointerUp={reportSelection}
        onTouchEnd={reportSelection}
        onSelect={reportSelection}
        onKeyUp={reportSelection}
        onClick={(event) => {
          const figure = event.target.closest?.('figure[data-chapter-image="true"]');
          if (figure && editorRef.current?.contains(figure)) selectImageFigure(figure);
          else if (selectedImageElementRef.current) selectImageFigure(null);
        }}
        onKeyDown={(event) => {
          const figure = event.target.closest?.('figure[data-chapter-image="true"]');
          if (figure && ['Backspace', 'Delete'].includes(event.key)) {
            event.preventDefault();
            selectImageFigure(figure);
            window.requestAnimationFrame(removeSelectedImage);
            return;
          }
          handleEditorShortcut(event);
        }}
        onPaste={(event) => {
          const html = event.clipboardData.getData('text/html');
          if (!html) return;
          event.preventDefault();
          document.execCommand('insertHTML', false, sanitizePastedHtml(html));
          emitChange();
        }}
      />
      <p className="admin-rich-hint"><strong>Фото:</strong> поставьте курсор в нужный абзац и нажмите «Фото» — изображение появится сразу после него. Можно выбрать маленький, средний размер или ширину текста. Фото автоматически сжимается и не записывается внутрь текста главы. <strong>Переписка:</strong> выделите сообщение и настройте его через кнопку «Переписка». <strong>Случайно изменили текст?</strong> Нажмите «Отменить» или Ctrl+Z.</p>
    </div>
  );
});

export default RichChapterEditor;
