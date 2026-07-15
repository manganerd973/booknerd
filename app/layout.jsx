import '../src/styles.css';
import '../src/admin.css';
import '../src/editorial.css';

export const metadata = {
  title: 'BOOKNERD — переводы, в которые влюбляются',
  description: 'BOOKNERD — книжная команда переводов. Истории, которые мы хотели прочитать сами.',
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
