'use client';

import { ShoppingCart, Eye } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';
import { useLivePrice } from '@/lib/live-prices';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = useLivePrice(product.sku, product.price);
  return (
    <Link
      href={`/producto/${product.slug || product.documentId}`}
      className="group flex flex-col overflow-hidden rounded-lg sm:rounded-xl border border-gray-900 bg-gray-950 hover:border-gray-700 hover:bg-gray-900 transition-colors"
    >
      {/* Imagen */}
      <div className="aspect-square w-full overflow-hidden bg-white relative">
        {product.image?.url ? (
          <Image
            src={product.image.url}
            alt={product.subtitulo || product.title}
            fill
            className="object-contain object-center p-3 sm:p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-gray-300" />
          </div>
        )}
        {product.featured && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-yellow-600 to-orange-600 px-2 py-0.5 text-[10px] font-bold text-white">
              ⭐
            </span>
          </div>
        )}
      </div>

      {/* Contenido — minimalista estilo Shure */}
      <div className="flex flex-col p-3 sm:p-4 gap-1">
        <p className="text-[10px] sm:text-xs font-semibold tracking-wider text-blue-400 capitalize line-clamp-1">
          {product.categoryName}
        </p>
        <h3 className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">
          {product.subtitulo || product.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-gray-500 font-mono line-clamp-1">
          {product.title}
        </p>
        {price > 0 && (
          <p className="mt-1 text-sm sm:text-base font-semibold text-white">
            ${Math.round(price).toLocaleString('es-AR')}
            <span className="ml-1 text-[10px] font-normal text-gray-500">sugerido</span>
          </p>
        )}
      </div>
    </Link>
  );
}
