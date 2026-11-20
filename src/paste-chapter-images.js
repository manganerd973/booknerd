const IMAGE_SIZES = {
  small: { edge: 800, bytes: 100 * 1024 },
  medium: { edge: 1200, bytes: 200 * 1024 },
  large: { edge: 1600, bytes: 300 * 1024 },
};

export async function compressChapterImage(blob, size = 'medium') {
  const preset = IMAGE_SIZES[size] || IMAGE_SIZES.medium;
  if (blob.size > 20 * 1024 * 1024) throw Error('Изображение слишком большое (более 20 МБ).');
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, preset.edge / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  let compressed;
  for (const quality of [.85,.7,.55,.4]) {
    compressed = await new Promise(resolve => canvas.toBlob(resolve,'image/webp',quality));
    if (compressed && compressed.size <= preset.bytes) break;
  }
  if (!compressed || compressed.size > preset.bytes) throw Error(`Не удалось сжать изображение до ${preset.bytes / 1024} КБ. Выберите больший размер или уменьшите исходное фото.`);
  return compressed;
}

async function uploadImage(blob, size) {
  const compressed = await compressChapterImage(blob, size);
  const form = new FormData(); form.append('image',compressed,'chapter.webp');
  const response = await fetch('/api/admin/chapter-images',{method:'POST',body:form});
  const data = await response.json(); if (!response.ok) throw Error(data.error || 'Не удалось сохранить изображение.');
  return data.imageUrl;
}
export async function prepareChapterPaste(html, files, size = 'medium') {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const images = [...doc.querySelectorAll('img')];
  let warning = '';
  if (images.length > 30 || files.length > 30) throw Error('Вставляйте не более 30 изображений за один раз.');
  const uploaded = new Map();
  for (const img of images) {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('/api/covers/')) continue;
    if (uploaded.has(src)) { img.src = uploaded.get(src); continue; }
    try {
      let blob;
      if (files.length === 1 && images.length === 1) blob = files[0];
      else if (/^data:image\/(png|jpeg|webp);base64,/i.test(src) || /^blob:/.test(src)) blob = await (await fetch(src)).blob();
      else if (/^https:\/\//.test(src)) {
        const response = await fetch(src, { credentials: 'omit', signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw Error(); blob = await response.blob();
      } else if (files.length === 1 && images.length === 1) blob = files[0];
      else throw Error();
      const url = await uploadImage(blob, size); uploaded.set(src,url); img.src = url;
    } catch (error) {
      if (/^https:\/\//.test(src)) warning = 'Часть фото осталась внешними ссылками: источник не разрешил копирование. Для надёжного хранения вставьте эти фото отдельно.';
      else throw Error(error.message || 'Фото недоступно в буфере. Скопируйте само изображение и вставьте отдельно.');
    }
  }
  if (!images.length) for (const file of files) { const img = doc.createElement('img'); img.src = await uploadImage(file, size); doc.body.append(img); }
  return { html: doc.body.innerHTML, warning };
}
