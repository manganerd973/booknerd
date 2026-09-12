import { requireReaderAccess } from '../../../lib/reader-access.js';
import PublicReaderProfile from '../../../src/public-reader-profile.jsx';

export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const { publicId } = await params;
  await requireReaderAccess(`/readers/${publicId}`);
  return <PublicReaderProfile publicId={publicId} />;
}
