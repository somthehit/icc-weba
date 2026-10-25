/**
 * lib/pos/indexedDbCatalog.ts
 *
 * Client-side high performance IndexedDB catalog cache with Stale-While-Revalidate.
 * Enables instantaneous POS load (<50ms) and full offline sales capability.
 */

const DB_NAME = 'icc_pos_catalog_db';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_products';
const META_STORE = 'catalog_meta';

export interface CatalogProduct {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  slug?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number | null;
  stockQuantity: number;
  stockStatus: string;
  inStock: boolean;
  lowStockThreshold?: number;
  isLowStock?: boolean;
  isSerialized?: boolean;
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyText?: string;
  brandName?: string;
  categoryName?: string;
  categorySlug?: string;
  categoryId?: number;
  imageUrl?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('barcode', 'barcode', { unique: false });
        store.createIndex('sku', 'sku', { unique: true });
        store.createIndex('categorySlug', 'categorySlug', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const posIndexedDb = {
  async getAll(): Promise<CatalogProduct[]> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },

  async putAll(items: CatalogProduct[]): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const item of items) {
        store.put(item);
      }
      const metaStore = tx.objectStore(META_STORE);
      metaStore.put({ key: 'last_sync', value: Date.now() });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('Could not save catalog to IndexedDB:', e);
    }
  },

  async getByBarcode(barcode: string): Promise<CatalogProduct | null> {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const idx = store.index('barcode');
        const req = idx.get(barcode);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await openDB();
      const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.objectStore(META_STORE).clear();
    } catch {
      // Ignored
    }
  },
};
