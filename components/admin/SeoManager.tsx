'use client';

import React from 'react';
import { useSeo } from '@/context/SeoContext';
import { useStore } from '@/context/StoreContext';
import { useSeoMeta, SeoConfig } from '@/hooks/useSeoMeta';

interface SeoManagerProps {
  overrideConfig?: SeoConfig;
}

/**
 * SeoManager Component
 * Consumes SeoContext and active view state to dynamically inject meta tags (title, description, canonical, OG, Twitter, JSON-LD)
 * into document head based on the currently active view instead of static definitions.
 */
export const SeoManager: React.FC<SeoManagerProps> = ({ overrideConfig }) => {
  const { seoMeta } = useSeo();
  const { currentPage } = useStore();

  // Combine SeoContext state with any direct prop override
  const activeConfig: SeoConfig | undefined = overrideConfig || seoMeta || undefined;

  // Dynamically update head meta tags based on active view and SeoContext
  useSeoMeta(activeConfig);

  return null; // Invisible manager component
};
