import { Media } from '../types';
import dump from './products-dump.json';
import imageManifest from './product-images.json';

const IMAGE_MANIFEST = imageManifest as Record<string, string[]>;

// minúsculas + sin diacríticos → búsqueda acento-insensible ("laser" ≡ "láser").
function normalizeText(s: string): string {
  return (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface DumpProduct {
  id: string;
  documentId: string;
  title: string;
  subtitulo?: string;
  slug: string;            // legacy SKU-style (ut-47con, agc0610) — se mantiene por compat
  legacySlug?: string;     // alias explícito del slug viejo
  seoSlug?: string;        // nuevo slug SEO descriptivo
  description: string;
  price: number;
  sku: string;
  modelo: string;
  categoryName: string;
  featured: boolean;
  seoDescription?: string;
  seoDescriptionLen?: number;
  seoDescriptionSource?: string;
}

interface DumpCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
}

const PRODUCTOS = (dump.productos as DumpProduct[]) || [];
const CATEGORIAS = (dump.categorias as DumpCategory[]) || [];

export interface Product {
  id: string;
  documentId: string;
  title: string;
  subtitulo?: string;
  slug?: string;          // slug canónico expuesto al frontend = seoSlug (o legacy fallback)
  legacySlug?: string;
  seoSlug?: string;
  description: string;
  price: number;
  categoryName: string;
  sku: string;
  rating?: number;
  specifications?: Record<string, string>;
  featured?: boolean;
  image?: Media;
  images?: Media[];
  seoDescription?: string;
  seoDescriptionSource?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

// Normalizar: minúsculas + SIN acentos, para que "laser" matchee "Láser"
// y "microfono" matchee "Micrófono" (el usuario casi nunca escribe tildes).
// Todas las palabras deben estar presentes (orden libre): "maquina humo" → "Máquina de humo".
function matchesSearch(p: DumpProduct, search: string): boolean {
  const tokens = normalizeText(search).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const blob = normalizeText(
    [p.title, p.subtitulo, p.description, p.sku, p.modelo, p.categoryName]
      .filter(Boolean).join(' ')
  );
  return tokens.every(t => blob.includes(t));
}

function categoryMatchesSlug(p: DumpProduct, slug: string): boolean {
  return p.categoryName?.toLowerCase() === slug.replace(/-/g, ' ').toLowerCase();
}

function imagesFor(sku: string): Media[] {
  const paths = IMAGE_MANIFEST[sku];
  if (!paths || !paths.length) return [];
  return paths.map((p, i) => ({
    id: `${sku}-${i}`,
    name: p.split('/').pop() || '',
    url: p,
  }));
}

function toProduct(p: DumpProduct): Product {
  const imgs = imagesFor(p.sku);
  // El slug expuesto al frontend prefiere el seoSlug (descriptivo) sobre el legacy.
  const canonicalSlug = p.seoSlug || p.slug;
  return {
    id: p.id,
    documentId: p.documentId,
    title: p.title,
    subtitulo: p.subtitulo,
    slug: canonicalSlug,
    legacySlug: p.legacySlug || p.slug,
    seoSlug: p.seoSlug,
    description: p.description,
    price: p.price,
    categoryName: p.categoryName,
    sku: p.sku,
    rating: 4.5,
    image: imgs[0],
    images: imgs,
    specifications: {},
    featured: p.featured,
    seoDescription: p.seoDescription,
    seoDescriptionSource: p.seoDescriptionSource,
  };
}

export async function fetchProducts(params?: {
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
  minPrice?: number;
  maxPrice?: number;
}): Promise<{ data: Product[]; meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } } }> {
  let list = PRODUCTOS.slice();

  if (params?.category) {
    list = list.filter(p => categoryMatchesSlug(p, params.category!));
  }
  if (params?.search) {
    list = list.filter(p => matchesSearch(p, params.search!));
  }
  if (params?.featured !== undefined) {
    list = list.filter(p => p.featured === params.featured);
  }
  if (params?.minPrice !== undefined) list = list.filter(p => p.price >= params.minPrice!);
  if (params?.maxPrice !== undefined) list = list.filter(p => p.price <= params.maxPrice!);

  if (params?.sort === 'price_asc') list.sort((a, b) => a.price - b.price);
  else if (params?.sort === 'price_desc') list.sort((a, b) => b.price - a.price);
  else if (params?.sort === 'name_asc') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (params?.sort === 'name_desc') list.sort((a, b) => b.title.localeCompare(a.title));

  const page = params?.page || 1;
  const pageSize = params?.pageSize || 12;
  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const slice = list.slice(start, start + pageSize);

  return {
    data: slice.map(toProduct),
    meta: { pagination: { page, pageSize, pageCount, total } },
  };
}

export async function fetchProduct(identifier: string): Promise<Product> {
  const raw = decodeURIComponent(identifier || '').toLowerCase();
  const found = PRODUCTOS.find(p =>
    p.seoSlug?.toLowerCase() === raw ||
    p.slug?.toLowerCase() === raw ||
    p.legacySlug?.toLowerCase() === raw ||
    p.sku?.toLowerCase() === raw ||
    p.documentId?.toLowerCase() === raw
  );
  if (!found) throw new Error(`Producto "${identifier}" no encontrado`);
  return toProduct(found);
}

// Sin search: categorías con su total. Con search: los counts pasan a ser
// "cuántos resultados de esta búsqueda hay en cada categoría" (facetas), incluyendo
// las que quedan en 0 — el caller decide si las oculta o las muestra apagadas.
export async function fetchCategories(search?: string): Promise<Category[]> {
  const base = CATEGORIAS.filter(c => c.productCount > 0);
  const withCounts = (search && search.trim())
    ? base.map(c => ({
        ...c,
        productCount: PRODUCTOS.filter(p => categoryMatchesSlug(p, c.slug) && matchesSearch(p, search)).length,
      }))
    : base;
  return withCounts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchFeaturedProducts(count: number = 6): Promise<Product[]> {
  return PRODUCTOS.filter(p => p.featured).slice(0, count).map(toProduct);
}
