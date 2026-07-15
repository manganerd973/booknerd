import '../src/styles.css';
import '../src/admin.css';
import '../src/editorial.css';
import '../src/pages.css';

export const metadata = {
  title: 'BOOKNERD — переводы, в которые влюбляются',
  description: 'BOOKNERD — книжная команда переводов. Истории, которые мы хотели прочитать сами.',
  icons: {
    icon: '/booknerd-icon.svg',
    shortcut: '/booknerd-icon.svg',
    apple: '/booknerd-icon.svg',
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
      <body>{children}</body>
    </html>
  );
}
