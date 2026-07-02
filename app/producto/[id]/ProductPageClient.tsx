'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';
import { fetchProduct, fetchProducts, Product } from '@/lib/api';
import { useLivePrice } from '@/lib/live-prices';
import Image from 'next/image';
import {
  ShoppingCart,
  Shield,
  Star,
  ChevronRight,
  Share2,
  Heart,
  ArrowLeft,
  Loader2,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { PRODUCT_VIDEOS } from '@/lib/product-videos';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';


interface ProductPageProps {
  id: string;
}

// Sanitización básica para descripciones SEO generadas por LLM.
// Solo permitimos tags seguros y eliminamos scripts/handlers inline.
function sanitizeSeoHtml(html: string): string {
  if (!html) return '';
  let s = html;
  // strip script/style blocks
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  // strip on* event handlers
  s = s.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  // strip javascript: hrefs
  s = s.replace(/javascript:/gi, '');
  // remove inline style attributes
  s = s.replace(/\sstyle\s*=\s*"[^"]*"/gi, '');
  s = s.replace(/\sstyle\s*=\s*'[^']*'/gi, '');
  return s;
}

export default function ProductPageClient({ id }: ProductPageProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Precio en vivo desde el VPS (sin deploy); cae al horneado si no hay dato.
  const livePrice = useLivePrice(product?.sku, product?.price ?? 0);

  const galleryImages = product?.images?.length
    ? product.images
    : (product?.image ? [product.image] : []);
  const activeIndex = Math.max(0, galleryImages.findIndex(img => img.url === activeImage));

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
    async function loadData() {
      try {
        setLoading(true);
        const productData = await fetchProduct(id);
        setProduct(productData);
        setActiveImage(productData.image?.url || '');

        const productsResponse = await fetchProducts({ category: productData.categoryName });
        const related = productsResponse.data
          .filter((p) => p.id !== productData.id)
          .slice(0, 4);
        setRelatedProducts(related);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!product) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Breadcrumb */}
      <div className="border-b border-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-4 lg:px-8">
          <nav className="flex items-center text-sm text-gray-400 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="h-4 w-4 mx-2" />
            <Link href="/catalogo" className="hover:text-white">
              Catálogo
            </Link>
            <ChevronRight className="h-4 w-4 mx-2" />
            <Link href={`/catalogo/${(product.categoryName || '').toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-white capitalize">
              {product.categoryName}
            </Link>
            <ChevronRight className="h-4 w-4 mx-2" />
            <span className="text-white truncate max-w-xs">{product.title}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Galería de imágenes */}
          <div>
            {PRODUCT_VIDEOS[product.documentId] && (
              <div className="rounded-2xl overflow-hidden border border-gray-800 bg-black mb-4 relative max-w-xs mx-auto">
                <video
                  src={PRODUCT_VIDEOS[product.documentId].src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="block w-full h-auto"
                />
              </div>
            )}
            <div
              className="rounded-2xl overflow-hidden border border-gray-800 bg-white aspect-square mb-4 relative cursor-zoom-in"
              onClick={() => activeImage && setLightboxOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && activeImage) {
                  e.preventDefault();
                  setLightboxOpen(true);
                }
              }}
            >
              {activeImage ? (
                <Image
                  src={activeImage}
                  alt={product.title}
                  fill
                  className="object-contain p-6 transition-all duration-500"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <div className="text-center">
                    <ShoppingCart className="h-20 w-20 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500">Imagen no disponible</p>
                  </div>
                </div>
              )}
            </div>
            <Lightbox
              open={lightboxOpen}
              close={() => setLightboxOpen(false)}
              slides={galleryImages.map((img) => ({ src: img.url, alt: product.title }))}
              index={activeIndex}
              on={{ view: ({ index }) => {
                const img = galleryImages[index];
                if (img) setActiveImage(img.url);
              }}}
              controller={{ closeOnBackdropClick: true }}
            />
            
            {/* Miniaturas */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-4">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(img.url)}
                    className={`aspect-square rounded-lg border overflow-hidden bg-white transition-all relative ${
                      activeImage === img.url ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <Image src={img.url} alt={`${product.title} ${i + 1}`} fill className="object-contain p-2" sizes="100px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Información del producto */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {product.subtitulo && (
                  <p className="text-sm font-semibold tracking-wider text-blue-400 uppercase">
                    {product.title}
                  </p>
                )}
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mt-1">
                  {product.subtitulo || product.title}
                </h1>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="p-2 rounded-lg border border-gray-800 text-gray-400 hover:text-white transition-colors">
                  <Share2 className="h-5 w-5" />
                </button>
                <button className="p-2 rounded-lg border border-gray-800 text-gray-400 hover:text-white transition-colors">
                  <Heart className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* SKU y Categoría */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              <div className="text-gray-400 shrink-0">
                SKU: <span className="text-white font-mono text-xs">{product.sku}</span>
              </div>
              <div className="text-gray-400 shrink-0">
                Categoría: <span className="text-white capitalize">{product.categoryName}</span>
              </div>
            </div>

            {/* Precio sugerido */}
            {livePrice > 0 && (
              <div className="mt-6">
                <p className="text-3xl sm:text-4xl font-bold text-white">
                  ${Math.round(livePrice).toLocaleString('es-AR')}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Precio sugerido al público — IVA incluido. Consultá disponibilidad con tu distribuidor.
                </p>
              </div>
            )}

            {/* Descripción a lo ancho */}
            {product.description && (
              <p className="mt-4 text-gray-300 leading-relaxed">{product.description}</p>
            )}

            {/* Acciones */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href={`https://wa.me/5491176402148?text=Hola! Estoy interesado en el producto: ${encodeURIComponent(product.title)} (SKU: ${product.sku})`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  import('@/lib/gtag').then(({ trackWhatsAppConsult }) =>
                    trackWhatsAppConsult({
                      productName: product.title,
                      sku: product.sku,
                      category: product.categoryName,
                    })
                  );
                }}
                className="flex-1 rounded-lg border border-green-600/50 bg-green-900/10 text-green-500 px-8 py-4 text-lg font-semibold hover:bg-green-900/20 flex items-center justify-center gap-2 transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                Consultar por WhatsApp
              </a>
            </div>

            {/* Beneficios */}
            <div className="mt-8 flex gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-800">
                <Shield className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-white">Garantía oficial</p>
                  <p className="text-xs text-gray-400">6 meses</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Descripción SEO extendida */}
        {product.seoDescription && product.seoDescription.length > 80 && (
          <section className="mt-16 border-t border-gray-900 pt-12">
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold text-white mb-6">Descripción del producto</h2>
              <div
                className="seo-description text-gray-300 leading-relaxed space-y-4"
                dangerouslySetInnerHTML={{ __html: sanitizeSeoHtml(product.seoDescription) }}
              />
            </div>
          </section>
        )}

        {/* Productos relacionados */}
        {relatedProducts.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Productos Relacionados</h2>
              <Link
                href={`/catalogo/${(product.categoryName || '').toLowerCase().replace(/\s+/g, '-')}`}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm font-semibold"
              >
                Ver todos <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        {/* Volver al catálogo */}
        <div className="mt-12 pt-8 border-t border-gray-900">
          <Link
            href="/catalogo"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
