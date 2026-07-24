import '@fontsource-variable/onest';
import '../src/styles.css';
import '../src/admin.css';
import '../src/editorial.css';
import '../src/pages.css';
import PwaRegister from '../src/pwa-register.jsx';

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

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
