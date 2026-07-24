'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Highlighter,
  Languages,
  MoreHorizontal,
  Search,
  Share2,
  SmilePlus,
  StickyNote,
  X,
} from 'lucide-react';

export const HIGHLIGHT_COLORS = [
  { id: 'sun', name: 'Солнечный', value: '#ffe066' },
  { id: 'leaf', name: 'Зелёный', value: '#9be28a' },
  { id: 'sky', name: 'Голубой', value: '#91b7ff' },
  { id: 'rose', name: 'Розовый', value: '#ff9fbd' },
  { id: 'lilac', name: 'Сиреневый', value: '#c4a2ff' },
  { id: 'peach', name: 'Персиковый', value: '#ffc58f' },
];

// The supplied sticker sheet is an exact 5 × 8 grid. Keeping the sheet as a
// sprite makes the reader fast and avoids loading dozens of separate files.
export const READER_STICKERS = [
  { id: 'love', name: 'Влюблённость', column: 0, row: 0 },
  { id: 'delight', name: 'Восторг', column: 1, row: 0 },
  { id: 'happy', name: 'Радость', column: 2, row: 0 },
  { id: 'hooray', name: 'Ура!', column: 3, row: 0 },
  { id: 'tender', name: 'Нежность', column: 4, row: 0 },
  { id: 'sparkly-tears', name: 'Слёзы счастья', column: 0, row: 1 },
  { id: 'adore', name: 'Обожание', column: 1, row: 1 },
  { id: 'idea', name: 'Идея', column: 2, row: 1 },
  { id: 'applause', name: 'Овации', column: 3, row: 1 },
  { id: 'heart-eyes', name: 'Сердечки', column: 4, row: 1 },
  { id: 'kiss', name: 'Воздушный поцелуй', column: 0, row: 2 },
  { id: 'proud', name: 'Горжусь', column: 1, row: 2 },
  { id: 'giggle', name: 'Хихикаю', column: 2, row: 2 },
  { id: 'bashful', name: 'Смущение', column: 3, row: 2 },
  { id: 'snack', name: 'Перекус', column: 4, row: 2 },
  { id: 'dreamy', name: 'Мечтаю', column: 0, row: 3 },
  { id: 'inspired', name: 'Вдохновение', column: 1, row: 3 },
  { id: 'cheeky', name: 'Озорство', column: 2, row: 3 },
  { id: 'music', name: 'Музыка', column: 3, row: 3 },
  { id: 'party', name: 'Праздник', column: 4, row: 3 },
  { id: 'wow', name: 'Вот это да!', column: 0, row: 4 },
  { id: 'shocked', name: 'Потрясение', column: 1, row: 4 },
  { id: 'dizzy', name: 'Голова кругом', column: 2, row: 4 },
  { id: 'hopeful', name: 'Надеюсь', column: 3, row: 4 },
  { id: 'question', name: 'Что происходит?', column: 4, row: 4 },
  { id: 'awkward', name: 'Неловко', column: 0, row: 5 },
  { id: 'confused', name: 'Растерянность', column: 1, row: 5 },
  { id: 'speechless', name: 'Нет слов', column: 2, row: 5 },
  { id: 'laughing', name: 'Смеюсь', column: 3, row: 5 },
  { id: 'nervous', name: 'Нервничаю', column: 4, row: 5 },
  { id: 'sweating', name: 'Тревога', column: 0, row: 6 },
  { id: 'panic', name: 'Паника', column: 1, row: 6 },
  { id: 'sad', name: 'Грусть', column: 2, row: 6 },
  { id: 'please', name: 'Пожалуйста', column: 3, row: 6 },
  { id: 'angry', name: 'Злюсь', column: 4, row: 6 },
  { id: 'freezing', name: 'В ужасе', column: 0, row: 7 },
  { id: 'empty', name: 'Опустошение', column: 1, row: 7 },
  { id: 'crying', name: 'Плачу', column: 2, row: 7 },
  { id: 'sleepy', name: 'Хочу спать', column: 3, row: 7 },
  { id: 'exhausted', name: 'Усталость', column: 4, row: 7 },
  { id: 'doodle-laugh', name: 'Смеюсь до слёз', sheet: 'doodles', columns: 4, rows: 5, column: 0, row: 0 },
  { id: 'doodle-suspicious', name: 'Подозреваю', sheet: 'doodles', columns: 4, rows: 5, column: 1, row: 0 },
  { id: 'doodle-delighted', name: 'В полном восторге', sheet: 'doodles', columns: 4, rows: 5, column: 2, row: 0 },
  { id: 'doodle-surprise', name: 'Неожиданно!', sheet: 'doodles', columns: 4, rows: 5, column: 3, row: 0 },
  { id: 'doodle-stunned', name: 'Ошеломление', sheet: 'doodles', columns: 4, rows: 5, column: 0, row: 1 },
  { id: 'doodle-side-eye', name: 'Косой взгляд', sheet: 'doodles', columns: 4, rows: 5, column: 1, row: 1 },
  { id: 'doodle-silly', name: 'Дурачусь', sheet: 'doodles', columns: 4, rows: 5, column: 2, row: 1 },
  { id: 'doodle-dizzy', name: 'Закружилась голова', sheet: 'doodles', columns: 4, rows: 5, column: 3, row: 1 },
  { id: 'doodle-shy', name: 'Очень смущаюсь', sheet: 'doodles', columns: 4, rows: 5, column: 0, row: 2 },
  { id: 'doodle-unimpressed', name: 'Не впечатлена', sheet: 'doodles', columns: 4, rows: 5, column: 1, row: 2 },
  { id: 'doodle-calm', name: 'Спокойствие', sheet: 'doodles', columns: 4, rows: 5, column: 2, row: 2 },
  { id: 'doodle-grin', name: 'Хитрая улыбка', sheet: 'doodles', columns: 4, rows: 5, column: 3, row: 2 },
  { id: 'doodle-grumpy', name: 'Недовольство', sheet: 'doodles', columns: 4, rows: 5, column: 0, row: 3 },
  { id: 'doodle-furious', name: 'В ярости', sheet: 'doodles', columns: 4, rows: 5, column: 1, row: 3 },
  { id: 'doodle-worried', name: 'Переживаю', sheet: 'doodles', columns: 4, rows: 5, column: 2, row: 3 },
  { id: 'doodle-sobbing', name: 'Рыдаю', sheet: 'doodles', columns: 4, rows: 5, column: 3, row: 3 },
  { id: 'doodle-tasty', name: 'Как вкусно!', sheet: 'doodles', columns: 4, rows: 5, column: 0, row: 4 },
  { id: 'doodle-lol', name: 'Очень смешно', sheet: 'doodles', columns: 4, rows: 5, column: 1, row: 4 },
  { id: 'doodle-uneasy', name: 'Мне тревожно', sheet: 'doodles', columns: 4, rows: 5, column: 2, row: 4 },
  { id: 'doodle-upset', name: 'Расстроилась', sheet: 'doodles', columns: 4, rows: 5, column: 3, row: 4 },
];

export function stickerById(id) {
  return READER_STICKERS.find((sticker) => sticker.id === id) || null;
}

export function ReaderSticker({ stickerId, size = 42, title, className = '' }) {
  const sticker = stickerById(stickerId);
  if (!sticker) return null;
  const columns = sticker.columns || 5;
  const rows = sticker.rows || 8;
  const cellAspectRatio = sticker.sheet === 'doodles'
    ? (735 / columns) / (762 / rows)
    : 1;
  const x = sticker.column * (100 / Math.max(1, columns - 1));
  const y = sticker.row * (100 / Math.max(1, rows - 1));
  const sheetStyle = sticker.sheet === 'doodles'
    ? { backgroundImage: "url('/reader-stickers-doodles.jpg')" }
    : {};
  return (
    <span
      className={`reader-sticker-art ${className}`.trim()}
      role="img"
      aria-label={title || sticker.name}
      title={title || sticker.name}
      data-sticker-sheet={sticker.sheet || 'roundies'}
      style={{
        width: size,
        height: Math.round(size / cellAspectRatio),
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`,
        ...sheetStyle,
      }}
    />
  );
}

export function StickerPicker({ value = '', onSelect }) {
  const selectedSticker = stickerById(value);
  const [group, setGroup] = useState(() => (
    selectedSticker?.sheet === 'doodles' ? 'doodles' : 'roundies'
  ));
  const visibleStickers = READER_STICKERS.filter((sticker) => (
    group === 'doodles' ? sticker.sheet === 'doodles' : sticker.sheet !== 'doodles'
  ));

  return (
    <div className="reader-sticker-browser">
      <div className="reader-sticker-tabs" role="tablist" aria-label="Наборы стикеров">
        <button
          type="button"
          className={group === 'roundies' ? 'is-active' : ''}
          onClick={() => setGroup('roundies')}
          role="tab"
          aria-selected={group === 'roundies'}
        >
          Милые эмоции
          <small>40</small>
        </button>
        <button
          type="button"
          className={group === 'doodles' ? 'is-active' : ''}
          onClick={() => setGroup('doodles')}
          role="tab"
          aria-selected={group === 'doodles'}
        >
          Яркие лица
          <small>20</small>
        </button>
      </div>
      <p className="reader-sticker-hint">Нажмите на эмоцию — стикер добавится к выделенному отрывку.</p>
      <div className="reader-sticker-picker" role="listbox" aria-label="Стикеры эмоций">
        {visibleStickers.map((sticker) => (
          <button
            type="button"
            className={value === sticker.id ? 'is-active' : ''}
            onClick={() => onSelect(sticker.id)}
            aria-label={sticker.name}
            aria-selected={value === sticker.id}
            role="option"
            title={sticker.name}
            key={sticker.id}
          >
            <ReaderSticker stickerId={sticker.id} size={64} />
            <span className="reader-sticker-name">{sticker.name}</span>
            {value === sticker.id ? <Check size={15} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function validAnnotations(text, annotations) {
  return (annotations || [])
    .map((annotation) => {
      let start = Number(annotation.start);
      let end = Number(annotation.end);
      if (text.slice(start, end) !== annotation.text) {
        const found = text.indexOf(annotation.text || '');
        if (found >= 0) {
          start = found;
          end = found + annotation.text.length;
        }
      }
      return { ...annotation, start, end };
    })
    .filter((annotation) => annotation.start >= 0 && annotation.end > annotation.start && annotation.end <= text.length)
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .filter((annotation, index, list) => index === 0 || annotation.start >= list[index - 1].end);
}

function validFootnotes(text, footnotes) {
  const haystack = text.toLocaleLowerCase('ru-RU');
  const matches = [];
  (footnotes || []).forEach((footnote, index) => {
    const term = String(footnote?.term || '').trim();
    const needle = term.toLocaleLowerCase('ru-RU');
    if (!needle) return;
    let cursor = 0;
    while (cursor < haystack.length) {
      const start = haystack.indexOf(needle, cursor);
      if (start < 0) break;
      const end = start + needle.length;
      const termStartsWithWord = /[\p{L}\p{N}_]/u.test(term[0] || '');
      const termEndsWithWord = /[\p{L}\p{N}_]/u.test(term[term.length - 1] || '');
      const beforeIsWord = start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1]);
      const afterIsWord = end < text.length && /[\p{L}\p{N}_]/u.test(text[end]);
      if ((!termStartsWithWord || !beforeIsWord) && (!termEndsWithWord || !afterIsWord)) {
        matches.push({ ...footnote, start, end, number: index + 1 });
      }
      cursor = Math.max(end, start + 1);
    }
  });
  return matches
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .filter((footnote, index, list) => index === 0 || footnote.start >= list[index - 1].end);
}

function formattingRuns(text, runs) {
  const normalized = [];
  let cursor = 0;
  (runs || []).forEach((run) => {
    const value = String(run?.text || '');
    if (!value) return;
    normalized.push({
      start: cursor,
      end: cursor + value.length,
      bold: Boolean(run.bold),
      italic: Boolean(run.italic),
      underline: Boolean(run.underline),
      strike: Boolean(run.strike),
      fontFamily: String(run.fontFamily || ''),
    });
    cursor += value.length;
  });
  if (cursor !== text.length) return [{ start: 0, end: text.length, bold: false, italic: false, underline: false, strike: false, fontFamily: '' }];
  return normalized;
}

export function AnnotatedParagraph({ text, runs = [], as: Element = 'p', className = '', style, listMarker, chatSender = '', chatSide = '', paragraphIndex, chapterId, annotations = [], footnotes = [], onOpenAnnotation, onOpenFootnote, onSelectionEnd }) {
  const pieces = useMemo(() => {
    const activeAnnotations = validAnnotations(text, annotations);
    const activeFootnotes = validFootnotes(text, footnotes);
    const activeRuns = formattingRuns(text, runs);
    const boundaries = new Set([0, text.length]);
    activeAnnotations.forEach((annotation) => { boundaries.add(annotation.start); boundaries.add(annotation.end); });
    activeFootnotes.forEach((footnote) => { boundaries.add(footnote.start); boundaries.add(footnote.end); });
    activeRuns.forEach((run) => { boundaries.add(run.start); boundaries.add(run.end); });
    const points = [...boundaries].sort((left, right) => left - right);
    return points.slice(0, -1).map((start, index) => {
      const end = points[index + 1];
      return {
        value: text.slice(start, end),
        formatting: activeRuns.find((item) => item.start <= start && item.end >= end) || null,
        annotation: activeAnnotations.find((item) => item.start <= start && item.end >= end) || null,
        footnote: activeFootnotes.find((item) => item.start <= start && item.end >= end) || null,
        key: `${start}-${end}`,
      };
    }).filter((piece) => piece.value);
  }, [annotations, footnotes, runs, text]);

  return (
    <Element
      className={className}
      style={style}
      data-list-marker={listMarker || undefined}
      data-chat-sender={chatSide ? chatSender || 'Сообщение' : undefined}
      data-chat-side={chatSide || undefined}
      data-reader-paragraph="true"
      data-paragraph-index={paragraphIndex}
      data-chapter-id={chapterId}
      onPointerUp={onSelectionEnd}
    >
      {pieces.map((piece) => {
        let formatted = piece.value;
        if (piece.formatting?.strike) formatted = <s>{formatted}</s>;
        if (piece.formatting?.underline) formatted = <u>{formatted}</u>;
        if (piece.formatting?.italic) formatted = <em>{formatted}</em>;
        if (piece.formatting?.bold) formatted = <strong>{formatted}</strong>;
        if (piece.formatting?.fontFamily) formatted = <span style={{ fontFamily: `${piece.formatting.fontFamily}, Georgia, serif` }}>{formatted}</span>;
        const content = piece.footnote ? (
          <span
            className="reader-footnote-term"
            role="button"
            tabIndex={0}
            aria-label={`Сноска ${piece.footnote.number}: ${piece.footnote.term}`}
            onClick={(event) => {
              if (!window.getSelection()?.toString()) {
                event.stopPropagation();
                onOpenFootnote?.(piece.footnote);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation();
                onOpenFootnote?.(piece.footnote);
              }
            }}
          >
            {formatted}<sup aria-hidden="true" data-footnote-number={piece.footnote.number} />
          </span>
        ) : formatted;
        return piece.annotation ? (
          <mark
            className={`reader-annotation-mark ${piece.annotation.note ? 'has-note' : ''} ${piece.annotation.sticker ? 'has-sticker' : ''}`}
            style={{ '--annotation-color': piece.annotation.color || '#ffe066' }}
            data-annotation-id={piece.annotation.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!window.getSelection()?.toString()) onOpenAnnotation?.(piece.annotation.id);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onOpenAnnotation?.(piece.annotation.id);
            }}
            key={piece.key}
          >
            {content}
            {piece.annotation.note ? <span className="reader-note-pin" aria-label="Есть заметка"><StickyNote size={12} /></span> : null}
            {piece.annotation.sticker ? <ReaderSticker stickerId={piece.annotation.sticker} size={43} className="reader-inline-sticker" /> : null}
          </mark>
        ) : <React.Fragment key={piece.key}>{content}</React.Fragment>;
      })}
    </Element>
  );
}

export function SelectionAnnotationBar({ selection, onHighlight, onNote, onSticker, onTranslate, onSearch, onCopy, onShare, onClose }) {
  const [view, setView] = useState('actions');
  if (!selection) return null;

  return (
    <div className="reader-selection-bar" role="dialog" aria-label="Действия с выделенным текстом">
      <div className="reader-selection-preview">“{selection.text.slice(0, 90)}{selection.text.length > 90 ? '…' : ''}”</div>
      {view === 'actions' ? (
        <div className="reader-selection-actions">
          <button type="button" onClick={() => setView('colors')}><Highlighter size={19} /><span>Выделить</span></button>
          <button type="button" onClick={onNote}><StickyNote size={19} /><span>Заметка</span></button>
          <button type="button" onClick={() => setView('stickers')}><SmilePlus size={19} /><span>Стикер</span></button>
          <button type="button" onClick={onTranslate}><Languages size={19} /><span>Перевести</span></button>
          <button type="button" onClick={() => setView('more')}><MoreHorizontal size={20} /><span>Ещё</span></button>
        </div>
      ) : null}

      {view === 'colors' ? (
        <div className="reader-selection-colors">
          <button className="reader-selection-back" type="button" onClick={() => setView('actions')}>Назад</button>
          {HIGHLIGHT_COLORS.map((color) => (
            <button type="button" style={{ '--swatch': color.value }} onClick={() => onHighlight(color.value)} aria-label={color.name} title={color.name} key={color.id} />
          ))}
        </div>
      ) : null}

      {view === 'stickers' ? (
        <div className="reader-selection-stickers">
          <button className="reader-selection-back" type="button" onClick={() => setView('actions')}>Назад</button>
          <StickerPicker onSelect={onSticker} />
        </div>
      ) : null}

      {view === 'more' ? (
        <div className="reader-selection-actions reader-selection-more">
          <button type="button" onClick={onCopy}><Copy size={19} /><span>Копировать</span></button>
          <button type="button" onClick={onSearch}><Search size={19} /><span>Поиск</span></button>
          <button type="button" onClick={onShare}><Share2 size={19} /><span>Поделиться</span></button>
          <button type="button" onClick={() => setView('actions')}><MoreHorizontal size={19} /><span>Назад</span></button>
        </div>
      ) : null}

      <button className="reader-selection-close" type="button" onClick={onClose} aria-label="Закрыть меню"><X size={18} /></button>
    </div>
  );
}
