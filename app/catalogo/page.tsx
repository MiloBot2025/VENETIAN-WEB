import type { Metadata } from 'next';
import CatalogoClient from './CatalogoClient';

const SITE_URL = 'https://venetian.com.ar';

export const metadata: Metadata = {
  title: 'Catálogo Venetian — Audio, Iluminación y Efectos Profesionales',
  description:
    'Catálogo completo Venetian: micrófonos, consolas, bafles, máquinas de humo, niebla y efectos, cables y conectores. Envíos a toda Argentina.',
  alternates: { canonical: `${SITE_URL}/catalogo` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/catalogo`,
    title: 'Catálogo Venetian',
    description: 'Audio, iluminación y efectos para profesionales.',
    siteName: 'Venetian',
  },
};

// El redirect /catalogo?categoria=X → /catalogo/X vive en next.config.ts (redirects,
// resuelto en el edge). No leer searchParams acá: mantiene la página ESTÁTICA (CDN),
// que es lo que hace instantánea la navegación de la búsqueda del header.
export default function CatalogoPage() {
  return <CatalogoClient />;
}
