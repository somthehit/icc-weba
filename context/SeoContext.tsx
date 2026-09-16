'use client';

// context/SeoContext.tsx
//
// Two jobs: hold the admin-managed SEO bundle for the whole storefront, and let
// any view push an override for its own metadata.
//
// The bundle is fetched once per mount from `GET /api/v1/seo` (public, cached) and
// falls back to `lib/seo/defaults.ts` if that fails — a network blip must not
// leave the page with no title. The regional banner copy is exposed here too so
// the header reads the same string the SEO engine publishes rather than keeping
// its own.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEFAULT_SEO_BUNDLE } from '@/lib/seo/defaults';
import { regionBanner } from '@/lib/seo/resolve';
import type { SeoBundle, SeoConfig } from '@/lib/seo/types';

export type { SeoConfig };

export interface SeoContextType {
  /** A view's override for the current page, or null. */
  seoMeta: SeoConfig | null;
  setSeoMeta: React.Dispatch<React.SetStateAction<SeoConfig | null>>;
  updateSeoMeta: (partial: Partial<SeoConfig>) => void;
  resetSeoMeta: () => void;
  /** Admin-managed settings + per-route metadata. */
  bundle: SeoBundle;
  /** False until the first fetch settles; the defaults are in use until then. */
  bundleLoaded: boolean;
  /** The delivery banner to show, or null when the operator has switched it off. */
  deliveryBanner: string | null;
}

const SeoContext = createContext<SeoContextType | undefined>(undefined);

export interface SeoProviderProps {
  children: React.ReactNode;
  defaultConfig?: SeoConfig;
}

export const SeoProvider: React.FC<SeoProviderProps> = ({ children, defaultConfig }) => {
  const [seoMeta, setSeoMeta] = useState<SeoConfig | null>(defaultConfig || null);
  const [bundle, setBundle] = useState<SeoBundle>(DEFAULT_SEO_BUNDLE);
  const [bundleLoaded, setBundleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/v1/seo');
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as Partial<SeoBundle>;
        if (cancelled || !data?.settings) return;
        setBundle({
          // Merged rather than replaced: the public branch of the endpoint omits
          // the operational fields, and a missing key must not become undefined
          // halfway through building a title.
          settings: { ...DEFAULT_SEO_BUNDLE.settings, ...data.settings },
          pages: data.pages?.length ? data.pages : DEFAULT_SEO_BUNDLE.pages,
          persisted: Boolean(data.persisted),
        });
      } catch {
        // Defaults are already in state — nothing to do but keep them.
      } finally {
        if (!cancelled) setBundleLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateSeoMeta = useCallback((partial: Partial<SeoConfig>) => {
    setSeoMeta((prev) => ({ ...(prev || {}), ...partial }));
  }, []);

  const resetSeoMeta = useCallback(() => setSeoMeta(null), []);

  const deliveryBanner = useMemo(() => regionBanner(bundle.settings), [bundle.settings]);

  const value = useMemo(
    () => ({
      seoMeta,
      setSeoMeta,
      updateSeoMeta,
      resetSeoMeta,
      bundle,
      bundleLoaded,
      deliveryBanner,
    }),
    [seoMeta, updateSeoMeta, resetSeoMeta, bundle, bundleLoaded, deliveryBanner],
  );

  return <SeoContext.Provider value={value}>{children}</SeoContext.Provider>;
};

export const useSeo = (): SeoContextType => {
  const context = useContext(SeoContext);
  if (!context) {
    throw new Error('useSeo must be used within a SeoProvider');
  }
  return context;
};

/**
 * Optional variant for components that render both inside and outside the
 * provider — the header is mounted by `app/page.tsx` under it, but the admin
 * console reuses pieces that are not.
 */
export const useSeoOptional = (): SeoContextType | null => useContext(SeoContext) ?? null;

/**
 * Push SEO metadata from a deep-nested component, restoring on unmount.
 */
export const usePushSeo = (config: SeoConfig | null, deps: React.DependencyList = []) => {
  const { setSeoMeta, resetSeoMeta } = useSeo();

  useEffect(() => {
    if (config) {
      setSeoMeta((prev) => ({ ...(prev || {}), ...config }));
    }
    return () => {
      resetSeoMeta();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export interface SeoHeadProps extends SeoConfig {
  children?: React.ReactNode;
}

/**
 * Declarative override for a single view.
 *
 * Example:
 *   <SeoHead title="Dell Vostro 15 Price in Dhangadhi | Intel Computer Center" />
 */
export const SeoHead: React.FC<SeoHeadProps> = (props) => {
  const { setSeoMeta } = useSeo();

  const keywordsString = props.keywords ? JSON.stringify(props.keywords) : '';
  const jsonLdString = props.jsonLd ? JSON.stringify(props.jsonLd) : '';

  useEffect(() => {
    const { children, ...seoConfig } = props;
    setSeoMeta(seoConfig);

    return () => {
      setSeoMeta(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.title,
    props.description,
    props.canonicalUrl,
    props.ogImage,
    props.ogType,
    props.noIndex,
    keywordsString,
    jsonLdString,
  ]);

  return null;
};
