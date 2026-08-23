'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSeoMeta, SeoConfig } from '@/hooks/useSeoMeta';

export interface SeoContextType {
  seoMeta: SeoConfig | null;
  setSeoMeta: React.Dispatch<React.SetStateAction<SeoConfig | null>>;
  updateSeoMeta: (partial: Partial<SeoConfig>) => void;
  resetSeoMeta: () => void;
}

const SeoContext = createContext<SeoContextType | undefined>(undefined);

export interface SeoProviderProps {
  children: React.ReactNode;
  defaultConfig?: SeoConfig;
}

/**
 * SeoProvider
 * Dedicated React context provider for managing and pushing dynamic SEO metadata
 * from anywhere in the component hierarchy up to the document head.
 */
export const SeoProvider: React.FC<SeoProviderProps> = ({ children, defaultConfig }) => {
  const [seoMeta, setSeoMeta] = useState<SeoConfig | null>(defaultConfig || null);

  const updateSeoMeta = useCallback((partial: Partial<SeoConfig>) => {
    setSeoMeta((prev) => ({
      ...(prev || {}),
      ...partial,
    }));
  }, []);

  const resetSeoMeta = useCallback(() => {
    setSeoMeta(null);
  }, []);

  return (
    <SeoContext.Provider value={{ seoMeta, setSeoMeta, updateSeoMeta, resetSeoMeta }}>
      {children}
    </SeoContext.Provider>
  );
};

/**
 * Hook to access the SEO Context
 */
export const useSeo = (): SeoContextType => {
  const context = useContext(SeoContext);
  if (!context) {
    throw new Error('useSeo must be used within a SeoProvider');
  }
  return context;
};

/**
 * Custom hook to allow deep-nested components to push SEO metadata.
 * Automatically restores previous or default metadata upon component unmount.
 */
export const usePushSeo = (config: SeoConfig | null, deps: React.DependencyList = []) => {
  const { setSeoMeta, resetSeoMeta } = useSeo();

  useEffect(() => {
    if (config) {
      setSeoMeta((prev) => ({
        ...(prev || {}),
        ...config,
      }));
    }

    return () => {
      // Optional cleanup on unmount
      resetSeoMeta();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export interface SeoHeadProps extends SeoConfig {
  children?: React.ReactNode;
}

/**
 * Declarative component for pushing SEO Metadata from deep-nested component trees.
 * Example Usage:
 * <SeoHead
 *    title="Dell Vostro 15 i5 Price in Nepal | Intel Computer"
 *    description="Official Dell Vostro 15 in Kathmandu with brand warranty."
 *    ogImage="https://example.com/product.jpg"
 * />
 */
export const SeoHead: React.FC<SeoHeadProps> = (props) => {
  const { setSeoMeta } = useSeo();

  const keywordsString = props.keywords ? JSON.stringify(props.keywords) : '';
  const jsonLdString = props.jsonLd ? JSON.stringify(props.jsonLd) : '';

  useEffect(() => {
    const { children, ...seoConfig } = props;
    setSeoMeta(seoConfig);

    return () => {
      // Clean up metadata when this declarative SeoHead unmounts
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
