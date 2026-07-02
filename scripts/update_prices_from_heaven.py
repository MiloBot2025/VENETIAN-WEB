"""
Actualiza los precios de lib/products-dump.json desde Heaven,
lista de precios 7 (Precio LOCAL - ML), y deploya a Vercel via git push.

Match: products-dump.json productos[].sku == Precios.IDC_Articulo (Id_ListaDePrecio=7, ARS).
Solo commitea/pushea lib/products-dump.json — no toca otros archivos del repo.

Dos caminos:
  1) EN VIVO (sin deploy): publica prices.json al VPS (Caddy CORS '*'); la web lo
     lee y pisa el precio horneado en minutos. Corre en TODAS las invocaciones.
  2) HORNEADO (fallback/SEO): con --apply reescribe products-dump.json + commit +
     push + deploy a Vercel. Solo necesario para el precio server-side/JSON-LD.

Usage:
    python update_prices_from_heaven.py               # dry-run + publica JSON en vivo
    python update_prices_from_heaven.py --json-only   # SOLO publica JSON en vivo (sin deploy)
    python update_prices_from_heaven.py --apply       # JSON en vivo + dump + commit + push + deploy

Programado: --json-only cada 1h (rápido, sin deploy) + --apply diario (fallback).
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, r"C:\Users\User\milobot\scripts")
from heaven_stock_uploader import db_connect, log

REPO = Path(r"C:\Users\User\milobot\web-marca")
DUMP = REPO / "lib" / "products-dump.json"
LISTA_LOCAL_ML = 7
ID_MONEDA_ARS = 32

# --- Precio en vivo SIN deploy ---------------------------------------------
# La web lee este JSON desde el VPS (Caddy, CORS '*') y pisa el precio horneado.
# Cambiar un precio en Heaven + correr esto = web actualizada en minutos, sin build.
SSH_KEY = r"C:\Users\User\.ssh\contabo_vps"
VPS_DEST = "root@109.199.96.54:/var/www/dmx-assets/prices.json"
JSON_TMP = REPO / "lib" / "prices.live.json"

# Web sku -> IDC de Heaven del que tomar el precio (cuando difieren).
# Los CBL se venden por rollo en la web pero lista 7 tiene precio por metro.
SKU_OVERRIDES = {
    "1911051554442830": "2406261309197795",  # CBL03 -> rollo 100m
    "1911051554518417": "2402081102375903",  # CBL13-1 -> rollo 100m
}


def fetch_prices() -> dict[str, float]:
    """Precio LOCAL-ML: tabla Precios (lista 7) con fallback a Articulos.PrecioAlternativo1
    (Heaven guarda en uno u otro lado según cómo se cargó el precio)."""
    conn = db_connect()
    try:
        cur = conn.cursor()
        # Fallback: tabla Precios lista 7 (suele estar desactualizada / con duplicados)
        cur.execute(
            "SELECT IDC_Articulo, Precio FROM Precios "
            "WHERE Id_ListaDePrecio = %s AND Id_Moneda = %s AND Precio > 0",
            (LISTA_LOCAL_ML, ID_MONEDA_ARS),
        )
        prices = {str(idc).strip(): float(p) for idc, p in cur.fetchall()}
        # Fuente autoritativa: Articulos.PrecioAlternativo1 (lo que muestra Heaven)
        cur.execute(
            "SELECT IDC, PrecioAlternativo1 FROM Articulos WHERE PrecioAlternativo1 > 0"
        )
        for idc, p in cur.fetchall():
            prices[str(idc).strip()] = float(p)

        # Paquetes sin precio propio: SUM(componentes × cantidad)
        cur.execute("SELECT IDC_Paquete, IDC_Componente, Cantidad FROM ArticulosPaquete")
        paquetes: dict[str, list[tuple[str, float]]] = {}
        for paq, comp, cant in cur.fetchall():
            paquetes.setdefault(str(paq).strip(), []).append((str(comp).strip(), float(cant)))
        for paq, comps in paquetes.items():
            if paq in prices:
                continue
            if all(c in prices for c, _ in comps):
                prices[paq] = round(sum(prices[c] * q for c, q in comps), 2)
        return prices
    finally:
        conn.close()


def build_live_map(prices: dict[str, float], productos: list) -> dict[str, float]:
    """{sku_web: precio} para los SKUs de la web que tienen precio en Heoven."""
    out: dict[str, float] = {}
    for p in productos:
        sku = str(p.get("sku") or "").strip()
        val = prices.get(SKU_OVERRIDES.get(sku, sku))
        if sku and val is not None and val > 0:
            out[sku] = round(float(val), 2)
    return out


def publish_live_json(mapping: dict[str, float]) -> bool:
    """Escribe prices.json y lo sube al VPS por scp. La web lo lee sin deploy."""
    JSON_TMP.write_text(json.dumps(mapping, ensure_ascii=False), encoding="utf-8")
    r = subprocess.run(
        ["scp", "-i", SSH_KEY, "-o", "StrictHostKeyChecking=no", str(JSON_TMP), VPS_DEST],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        log(f"[web-prices] ERROR scp prices.json: {r.stderr.strip()}")
        return False
    log(f"[web-prices] prices.json publicado al VPS ({len(mapping)} precios, sin deploy)")
    return True


def main() -> int:
    apply = "--apply" in sys.argv
    json_only = "--json-only" in sys.argv

    prices = fetch_prices()
    log(f"[web-prices] lista 7 (LOCAL-ML): {len(prices)} precios en Heaven")

    data = json.loads(DUMP.read_text(encoding="utf-8"))
    productos = data["productos"]

    # Camino SIN deploy: publicar el JSON en vivo al VPS en toda corrida.
    live = build_live_map(prices, productos)
    ok = publish_live_json(live)
    if json_only:
        return 0 if ok else 1

    changed, missing = 0, 0
    for p in productos:
        sku = str(p.get("sku") or "").strip()
        nuevo = prices.get(SKU_OVERRIDES.get(sku, sku))
        if nuevo is None:
            missing += 1
            continue
        nuevo = round(nuevo, 2)
        if abs(float(p.get("price") or 0) - nuevo) >= 0.01:
            log(f"[web-prices]   {p.get('modelo')} ({sku}): {p.get('price')} -> {nuevo}")
            p["price"] = nuevo
            changed += 1

    log(f"[web-prices] {changed} cambios, {missing}/{len(productos)} sin precio en lista 7")

    if not apply:
        log("[web-prices] dry-run (usar --apply para escribir + deployar)")
        return 0
    if changed == 0:
        log("[web-prices] sin cambios, no se deploya")
        return 0

    data["pricesUpdatedAt"] = datetime.now().isoformat(timespec="seconds")
    tmp = DUMP.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(DUMP)

    # commit + push SOLO el dump
    def git(*args: str) -> None:
        subprocess.run(["git", *args], cwd=REPO, check=True, capture_output=True, text=True)

    git("add", "lib/products-dump.json")
    git("commit", "-m", f"chore: precios LOCAL-ML desde Heaven ({changed} cambios)")
    git("push", "origin", "master")
    # El proyecto Vercel no está conectado a GitHub: deploy manual via CLI
    subprocess.run(
        "npx vercel deploy --prod --yes",
        cwd=REPO, check=True, capture_output=True, text=True, shell=True,
    )
    log(f"[web-prices] pusheado + deployado a Vercel ({changed} precios)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        log(f"[web-prices] ERROR: {e}")
        sys.exit(1)
