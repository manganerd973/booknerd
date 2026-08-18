import '@fontsource-variable/onest';
import '../src/styles.css';
import '../src/admin.css';
import '../src/editorial.css';
import '../src/pages.css';
import PwaRegister from '../src/pwa-register.jsx';
import AppPreferences from '../src/app-preferences.jsx';

export const metadata = {
  title: 'BOOKNERD — переводы, в которые влюбляются',
  description: 'BOOKNERD — книжная команда переводов. Истории, которые мы хотели прочитать сами.',
  applicationName: 'BOOKNERD',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BOOKNERD',
  },
  icons: {
    icon: [
      { url: '/booknerd-favicon-v2.ico', type: 'image/x-icon' },
      { url: '/booknerd-icon-v2-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/booknerd-icon-v2-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/booknerd-favicon-v2.ico',
    apple: [
      { url: '/booknerd-apple-touch-icon-v2.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#123c35',
};

const recoveryScript = `(() => {
  const key = 'booknerd-shell-recovery-v1';
  let recovering = false;
  const wasRecovered = () => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } };
  const markRecovered = () => { try { sessionStorage.setItem(key, '1'); } catch {} };
  const messageOf = (value) => String(value?.message || value?.reason?.message || value?.reason || value || '');
  const isBrokenAsset = (value) => /ChunkLoadError|Loading (?:CSS )?chunk|dynamically imported module|Importing a module script failed|Failed to fetch dynamically imported module/i.test(messageOf(value));
  const recover = async () => {
    if (recovering || wasRecovered()) return;
    recovering = true;
    markRecovered();
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name.startsWith('booknerd-shell-')).map((name) => caches.delete(name)));
      }
      const registration = await navigator.serviceWorker?.getRegistration?.();
      await registration?.update?.();
    } catch {}
    location.reload();
  };
  addEventListener('error', (event) => {
    const target = event.target;
    if (isBrokenAsset(event) || target?.tagName === 'SCRIPT' || (target?.tagName === 'LINK' && target.rel === 'stylesheet')) recover();
  }, true);
  addEventListener('unhandledrejection', (event) => { if (isBrokenAsset(event)) recover(); });
  setTimeout(() => { try { sessionStorage.removeItem(key); } catch {} }, 12000);
})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head><script dangerouslySetInnerHTML={{ __html: recoveryScript }} /></head>
      <body><PwaRegister /><AppPreferences />{children}</body>
    </html>
  );
}
