'use client';

import { useEffect, useState } from 'react';

// Precios en vivo publicados por la PC (Heaven) al VPS, SIN necesidad de deploy.
// El JSON se sirve con CORS '*' desde Caddy (assets.109-199-96-54.nip.io).
// Forma: { "<sku>": <precio>, ... }
const PRICES_URL = 'https://assets.109-199-96-54.nip.io/prices.json';

let cache: Record<string, number> | null = null;
let inflight: Promise<Record<string, number>> | null = null;

// Un solo fetch compartido por toda la página (la primera tarjeta/ficha lo dispara,
// el resto reusa el cache en memoria). Si falla, devuelve {} y todo cae al valor horneado.
async function loadLivePrices(): Promise<Record<string, number>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(PRICES_URL, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        cache = (d && typeof d === 'object' ? d : {}) as Record<string, number>;
        return cache;
      })
      .catch(() => ({} as Record<string, number>));
  }
  return inflight;
}

// Devuelve el precio en vivo del SKU si existe; si no (JSON caído, SKU ausente,
// valor inválido) mantiene el `fallback` horneado en el build. Nunca rompe la UI.
export function useLivePrice(sku: string | undefined, fallback: number): number {
  const [price, setPrice] = useState(fallback);
  useEffect(() => {
    if (!sku) return;
    let on = true;
    loadLivePrices().then((m) => {
      const live = m[sku];
      if (on && typeof live === 'number' && live > 0 && live !== price) setPrice(live);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sku, fallback]);
  return price;
}
