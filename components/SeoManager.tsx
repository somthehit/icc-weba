'use client';

// components/SeoManager.tsx
//
// Invisible component that keeps `document.head` in sync with the active view.
//
// It is the single place where the admin-managed bundle, the view's override and
// the current route meet — which is why nothing else calls `useSeoMeta` directly.

import React from 'react';

import { useSeo } from '@/context/SeoContext';
import { useSeoMeta } from '@/hooks/useSeoMeta';
import type { SeoConfig } from '@/lib/seo/types';

export interface SeoManagerProps {
  overrideConfig?: SeoConfig;
}

export const SeoManager: React.FC<SeoManagerProps> = ({ overrideConfig }) => {
  const { seoMeta, bundle } = useSeo();

  // A prop override beats a context push, which beats the resolved defaults.
  const activeConfig: SeoConfig | undefined = overrideConfig || seoMeta || undefined;

  useSeoMeta(activeConfig, bundle);

  return null;
};
