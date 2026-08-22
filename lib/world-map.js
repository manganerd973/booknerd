const MAX_MARKERS = 40;

function markerId(value, index) {
  const normalized = String(value || '').trim().slice(0, 100);
  return normalized || `location-${index + 1}`;
}

export function normalizeWorldMapMarkers(value) {
  let source = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source || '[]'); } catch { source = []; }
  }
  if (!Array.isArray(source)) return [];
  return source.slice(0, MAX_MARKERS).map((item, index) => ({
    id: markerId(item?.id, index),
    name: String(item?.name || '').trim().slice(0, 140),
    description: String(item?.description || '').trim().slice(0, 1200),
    x: Math.max(0, Math.min(100, Number(item?.x || 0))),
    y: Math.max(0, Math.min(100, Number(item?.y || 0))),
    revealAfterChapter: Math.max(0, Math.min(100000, Math.floor(Number(item?.revealAfterChapter || 0)))),
  })).filter((item) => item.name);
}

export function worldMapImageUrl(key) {
  return key ? `/api/covers/${String(key).split('/').map(encodeURIComponent).join('/')}` : null;
}

export function mapWorldMap(row) {
  if (!row?.world_map_key) return null;
  return {
    key: row.world_map_key,
    imageUrl: worldMapImageUrl(row.world_map_key),
    name: row.world_map_name || 'Карта мира',
    contentType: row.world_map_content_type || 'image/webp',
    sizeBytes: Number(row.world_map_size_bytes || 0),
    markers: normalizeWorldMapMarkers(row.world_map_markers),
  };
}
