import '@fontsource-variable/onest';
import '../src/styles.css';
import '../src/admin.css';
import '../src/editorial.css';
import '../src/pages.css';
import '../src/home.css';
import '../src/shelves.css';
import '../src/install.css';
import '../src/visual-fixes.css';
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
      { url: '/booknerd-favicon-v4.ico', type: 'image/x-icon' },
      { url: '/booknerd-icon-v4-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/booknerd-icon-v4-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/booknerd-favicon-v4.ico',
    apple: [
      { url: '/booknerd-apple-touch-icon-v4.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6c4ee0',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body><PwaRegister><AppPreferences />{children}</PwaRegister></body>
    </html>
  );
}
