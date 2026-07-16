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
      { url: '/booknerd-icon.svg', type: 'image/svg+xml' },
      { url: '/booknerd-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/booknerd-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/booknerd-icon.svg',
    apple: '/booknerd-apple-touch-icon.png',
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
