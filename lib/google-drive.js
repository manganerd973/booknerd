const allowedHosts = new Set(['drive.google.com', 'docs.google.com']);

export function normalizeGoogleDriveUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) return null;
    return url.toString().slice(0, 2000);
  } catch {
    return null;
  }
}
