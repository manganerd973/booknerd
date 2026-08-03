export const metadata = {
  title: 'Редакционная — BOOKNERD',
  description: 'Мобильная панель владелицы BOOKNERD для книг, обложек, глав и публикаций.',
  applicationName: 'BOOKNERD Редакционная',
  manifest: '/admin-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BOOKNERD Admin',
  },
};

export default function AdminLayout({ children }) {
  return children;
}
