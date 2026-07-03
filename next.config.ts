import type { NextConfig } from "next";
import skuRewrites from './public/sku-rewrites.json';

// Slugs reales de categorías (lib/products-dump.json -> categorias). Si agregás categorías nuevas,
// agregalas acá. Hardcodeado para evitar lectura async dentro de next.config.ts.
// Lista chequeada al 2026-05-11 (35 categorías visibles).
const CATEGORY_SLUGS = [
  'adaptador-audio','amplificador','antipop','auricular','bafle','cabezal','cable-midi',
  'cable-speakon','cable-trs','caja-directa','consola-de-audio','consola-dmx','efecto-de-luces',
  'ficha-ethercon','ficha-plug','ficha-rca','ficha-speakon','ficha-xlr','lampara','laser',
  'maquina-de-burbujas','maquina-de-espuma','maquina-de-humo','maquina-de-humo-bajo',
  'maquina-de-niebla','maquina-de-nieve','maquina-de-papeles','microfono','microfono-inalambrico',
  'morsa',
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Comportamiento heredado del next.config.js viejo (que tenía prioridad sobre este
    // archivo hasta 2026-07-03): servir imágenes sin el optimizador de Vercel.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1338',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'strapi-backend-production-35d0.up.railway.app',
        pathname: '/**',
      },
    ],
  },
  async redirects() {
    // 1) Redirects de productos (documentId / sku / legacySlug -> /producto/{seoSlug})
    const productRedirects = (skuRewrites as Array<{ source: string; destination: string }>).map(
      (r) => ({ source: r.source, destination: r.destination, permanent: true })
    );

    // 2) Redirects de /catalogo?categoria={slug} -> /catalogo/{slug} (path-based, SEO friendly).
    //    Solo redirige slugs conocidos para no romper la búsqueda libre del catálogo.
    const categoryRedirects = CATEGORY_SLUGS.map((slug) => ({
      source: '/catalogo',
      has: [{ type: 'query' as const, key: 'categoria', value: slug }],
      destination: `/catalogo/${slug}`,
      permanent: true,
    }));

    // 3) Fallback genérico para cualquier valor de categoria (incluye los casos con espacios
    //    sin codificar que reporta GSC, ej. "cable midi"). Next decodifica el valor y arma la URL
    //    destino, que el browser luego codifica al seguir la 301.
    const categoryFallback = {
      source: '/catalogo',
      has: [{ type: 'query' as const, key: 'categoria' }],
      destination: '/catalogo/:categoria',
      permanent: true,
    };

    return [...productRedirects, ...categoryRedirects, categoryFallback];
  },
};

export default nextConfig;
