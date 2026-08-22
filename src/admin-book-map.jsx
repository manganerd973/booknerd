'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, LoaderCircle, MapPinned, Plus, Save, Trash2, UploadCloud, X } from 'lucide-react';

const MAX_MAP_BYTES = 1_400_000;
const blankMap = { name: 'Карта мира', imageUrl: '', markers: [] };

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить карту.')),
    'image/webp',
    quality,
  ));
}

async function prepareWorldMap(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Поддерживаются JPG, PNG и WEBP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Исходная карта должна быть меньше 20 МБ.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Не удалось прочитать изображение карты.'));
      image.src = objectUrl;
    });
    const attempts = [
      { width: 2400, height: 2400, quality: 0.86 },
      { width: 2100, height: 2100, quality: 0.8 },
      { width: 1800, height: 1800, quality: 0.74 },
      { width: 1500, height: 1500, quality: 0.68 },
    ];
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.width / image.naturalWidth, attempt.height / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas, attempt.quality);
      if (blob.size <= MAX_MAP_BYTES) return new File([blob], `booknerd-map-${Date.now()}.webp`, { type: 'image/webp' });
    }
    throw new Error('Не удалось уменьшить карту. Выберите изображение поменьше.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function requestMap(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить карту.');
  return data;
}

export default function AdminBookMap({ bookId, onNotice }) {
  const [worldMap, setWorldMap] = useState(blankMap);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [placing, setPlacing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const imageUrl = previewUrl || worldMap.imageUrl || '';
  const selected = useMemo(() => worldMap.markers.find((marker) => marker.id === selectedId) || null, [worldMap.markers, selectedId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    requestMap(`/api/admin/books/${bookId}/map`)
      .then((data) => {
        if (!active) return;
        setWorldMap(data.worldMap || blankMap);
        setFile(null);
        setPreviewUrl('');
        setSelectedId(null);
      })
      .catch((error) => active && onNotice(error.message, 'error'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookId]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseMap = async (event) => {
    const source = event.target.files?.[0];
    event.target.value = '';
    if (!source) return;
    setPreparing(true);
    try {
      const prepared = await prepareWorldMap(source);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
      setWorldMap((current) => ({ ...current, name: current.name || source.name.replace(/\.[^.]+$/, '') || 'Карта мира' }));
      onNotice('Карта подготовлена. Добавьте точки и нажмите «Сохранить карту».');
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setPreparing(false);
    }
  };

  const placeMarker = (event) => {
    if (!placing || (placing === 'new' && worldMap.markers.length >= 40)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
    if (placing === 'move' && selectedId) {
      updateSelected(point);
      setPlacing(null);
      return;
    }
    const marker = {
      id: crypto.randomUUID(),
      name: `Локация ${worldMap.markers.length + 1}`,
      description: '',
      ...point,
      revealAfterChapter: 0,
    };
    setWorldMap((current) => ({ ...current, markers: [...current.markers, marker] }));
    setSelectedId(marker.id);
    setPlacing(null);
  };

  const updateSelected = (patch) => {
    setWorldMap((current) => ({
      ...current,
      markers: current.markers.map((marker) => marker.id === selectedId ? { ...marker, ...patch } : marker),
    }));
  };

  const deleteMarker = () => {
    setWorldMap((current) => ({ ...current, markers: current.markers.filter((marker) => marker.id !== selectedId) }));
    setSelectedId(null);
  };

  const save = async () => {
    if (!imageUrl) return onNotice('Сначала выберите изображение карты.', 'error');
    if (worldMap.markers.some((marker) => !marker.name.trim())) return onNotice('У каждой точки должно быть название.', 'error');
    setSaving(true);
    try {
      const body = new FormData();
      if (file) body.append('map', file, file.name);
      body.append('name', worldMap.name || 'Карта мира');
      body.append('markers', JSON.stringify(worldMap.markers));
      const data = await requestMap(`/api/admin/books/${bookId}/map`, { method: 'POST', body });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setFile(null);
      setWorldMap(data.worldMap || blankMap);
      onNotice('Карта и точки локаций сохранены.');
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeMap = async () => {
    if (!window.confirm('Удалить карту и все точки локаций этой книги?')) return;
    setSaving(true);
    try {
      await requestMap(`/api/admin/books/${bookId}/map`, { method: 'DELETE' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setFile(null);
      setSelectedId(null);
      setWorldMap(blankMap);
      onNotice('Карта удалена.');
    } catch (error) {
      onNotice(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-book-map-section" id="admin-book-map">
      <div className="admin-list-head">
        <div><span>04 / КАРТА</span><h2>Карта мира книги</h2><p>Загрузите карту и расставьте точки. Пустой раздел никогда не показывается читателям.</p></div>
        <span className="admin-map-count"><MapPinned size={16} /> {worldMap.markers.length} / 40</span>
      </div>
      {loading ? <div className="admin-map-loading"><LoaderCircle className="spin" size={21} /> Открываем карту…</div> : (
        <div className="admin-map-workspace">
          <div className="admin-map-stage-column">
            <div className={`admin-map-stage ${placing ? 'is-placing' : ''}`}>
              {imageUrl ? (
                <div className="admin-map-image" onClick={placeMarker}>
                  <img src={imageUrl} alt={worldMap.name || 'Карта мира книги'} />
                  {worldMap.markers.map((marker, index) => (
                    <button
                      className={selectedId === marker.id ? 'is-active' : ''}
                      type="button"
                      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                      onClick={(event) => { event.stopPropagation(); setSelectedId(marker.id); setPlacing(null); }}
                      aria-label={`Редактировать точку «${marker.name}»`}
                      key={marker.id}
                    ><MapPinned size={15} /><span>{index + 1}</span></button>
                  ))}
                </div>
              ) : <div className="admin-map-empty"><ImagePlus size={42} /><strong>Добавьте карту книги</strong><p>Изображение автоматически уменьшится и не займёт много места.</p></div>}
            </div>
            <div className="admin-map-toolbar">
              <label className="admin-upload-button">{preparing ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />} {preparing ? 'Подготавливаем…' : imageUrl ? 'Заменить карту' : 'Выбрать карту'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseMap} disabled={preparing || saving} /></label>
              <button className={placing === 'new' ? 'admin-primary' : 'admin-secondary'} type="button" onClick={() => setPlacing((value) => value === 'new' ? null : 'new')} disabled={!imageUrl || worldMap.markers.length >= 40}><Plus size={16} /> {placing === 'new' ? 'Нажмите на карту' : 'Добавить точку'}</button>
            </div>
            <label className="admin-map-title"><span>Название карты</span><input value={worldMap.name || ''} onChange={(event) => setWorldMap({ ...worldMap, name: event.target.value })} maxLength={180} placeholder="Например: Королевства Эларии" /></label>
          </div>
          <aside className="admin-map-sidebar">
            <div className="admin-map-location-list">
              {worldMap.markers.length ? worldMap.markers.map((marker, index) => <button className={selectedId === marker.id ? 'is-active' : ''} type="button" onClick={() => setSelectedId(marker.id)} key={marker.id}><span>{index + 1}</span><div><strong>{marker.name || 'Без названия'}</strong><small>{marker.revealAfterChapter ? `После главы ${marker.revealAfterChapter}` : 'Открыта сразу'}</small></div></button>) : <p>Точек пока нет. Нажмите «Добавить точку», а затем выберите место на карте.</p>}
            </div>
            {selected ? (
              <div className="admin-map-marker-editor">
                <header><strong>Точка на карте</strong><button type="button" onClick={() => setSelectedId(null)} aria-label="Закрыть редактор точки"><X size={16} /></button></header>
                <label><span>Название места</span><input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} maxLength={140} placeholder="Например: Северный дворец" /></label>
                <label><span>Описание</span><textarea rows="5" value={selected.description} onChange={(event) => updateSelected({ description: event.target.value })} maxLength={1200} placeholder="Что важно знать читателю об этом месте?" /></label>
                <label><span>Открыть после главы</span><input type="number" min="0" max="100000" value={selected.revealAfterChapter || 0} onChange={(event) => updateSelected({ revealAfterChapter: Math.max(0, Number(event.target.value || 0)) })} /><small>0 — показывать сразу. Закрытые точки защищены от спойлеров.</small></label>
                <button className={placing === 'move' ? 'admin-primary' : 'admin-secondary'} type="button" onClick={() => setPlacing((value) => value === 'move' ? null : 'move')}><MapPinned size={15} /> {placing === 'move' ? 'Нажмите новое место' : 'Переместить точку'}</button>
                <button className="admin-danger" type="button" onClick={deleteMarker}><Trash2 size={15} /> Удалить точку</button>
              </div>
            ) : null}
            <div className="admin-map-actions">
              {worldMap.imageUrl ? <button className="admin-danger" type="button" onClick={removeMap} disabled={saving}><Trash2 size={16} /> Удалить карту</button> : null}
              <button className="admin-primary" type="button" onClick={save} disabled={!imageUrl || saving || preparing}>{saving ? <LoaderCircle className="spin" size={17} /> : file ? <Check size={17} /> : <Save size={17} />} {saving ? 'Сохраняем…' : 'Сохранить карту'}</button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
