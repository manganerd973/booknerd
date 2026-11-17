export async function prepareMapImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Для карты подходят JPG, PNG и WEBP.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    // Keep fine map lettering legible; compress in the browser, not on the Worker.
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 3200 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.9, .8, .7]) {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= 1400000) return new File([blob], 'world-map.' + (blob.type === 'image/webp' ? 'webp' : 'png'), { type: blob.type });
    }
    throw new Error('Карта слишком детальная для сжатия до 1,4 МБ. Уменьшите изображение и повторите загрузку.');
  } finally { URL.revokeObjectURL(url); }
}
