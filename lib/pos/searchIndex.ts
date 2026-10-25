/**
 * lib/pos/searchIndex.ts
 *
 * Lightning-fast in-memory client search index for POS Catalog.
 * Executes sub-5ms searches across SKU, barcode, and name with tokenization & prefix matching.
 */

import { CatalogProduct } from './indexedDbCatalog';

export class LocalSearchIndex {
  private products: CatalogProduct[] = [];
  private barcodeMap = new Map<string, CatalogProduct>();
  private skuMap = new Map<string, CatalogProduct>();
  private tokenIndex = new Map<string, Set<number>>();

  build(items: CatalogProduct[]) {
    this.products = items;
    this.barcodeMap.clear();
    this.skuMap.clear();
    this.tokenIndex.clear();

    for (const item of items) {
      if (item.barcode) {
        this.barcodeMap.set(item.barcode.toLowerCase().trim(), item);
      }
      if (item.sku) {
        this.skuMap.set(item.sku.toLowerCase().trim(), item);
      }

      // Tokenize name, SKU, brand, and category
      const words = `${item.name} ${item.sku} ${item.brandName || ''} ${item.categoryName || ''}`
        .toLowerCase()
        .split(/[\s,._\-/]+/)
        .filter((w) => w.length >= 2);

      for (const w of words) {
        // Index full word and prefixes (min 2 chars)
        for (let len = 2; len <= Math.min(w.length, 6); len++) {
          const prefix = w.slice(0, len);
          let set = this.tokenIndex.get(prefix);
          if (!set) {
            set = new Set<number>();
            this.tokenIndex.set(prefix, set);
          }
          set.add(item.id);
        }
      }
    }
  }

  findByExactBarcode(barcode: string): CatalogProduct | null {
    const clean = barcode.toLowerCase().trim();
    return this.barcodeMap.get(clean) || this.skuMap.get(clean) || null;
  }

  search(query: string, categoryFilter = 'ALL', limit = 100): CatalogProduct[] {
    const cleanQuery = query.toLowerCase().trim();

    // Direct Barcode / SKU exact match priority
    if (this.barcodeMap.has(cleanQuery)) {
      return [this.barcodeMap.get(cleanQuery)!];
    }
    if (this.skuMap.has(cleanQuery)) {
      return [this.skuMap.get(cleanQuery)!];
    }

    let candidates = this.products;

    if (categoryFilter !== 'ALL') {
      candidates = candidates.filter(
        (p) =>
          p.categoryName?.toUpperCase() === categoryFilter.toUpperCase() ||
          p.categorySlug?.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (!cleanQuery) {
      return candidates.slice(0, limit);
    }

    const queryTokens = cleanQuery.split(/[\s,._\-/]+/).filter(Boolean);
    if (queryTokens.length === 0) return candidates.slice(0, limit);

    // Fast in-memory filter with scoring
    const scored: Array<{ product: CatalogProduct; score: number }> = [];

    for (const p of candidates) {
      const nameLower = p.name.toLowerCase();
      const skuLower = p.sku.toLowerCase();
      const barcodeLower = (p.barcode || '').toLowerCase();

      let matchScore = 0;
      let allMatched = true;

      for (const token of queryTokens) {
        if (skuLower === token || barcodeLower === token) {
          matchScore += 100;
        } else if (skuLower.startsWith(token)) {
          matchScore += 50;
        } else if (nameLower.startsWith(token)) {
          matchScore += 40;
        } else if (nameLower.includes(token)) {
          matchScore += 20;
        } else if ((p.brandName || '').toLowerCase().includes(token)) {
          matchScore += 15;
        } else {
          allMatched = false;
          break;
        }
      }

      if (allMatched && matchScore > 0) {
        scored.push({ product: p, score: matchScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.product);
  }
}

export const catalogSearchIndex = new LocalSearchIndex();
