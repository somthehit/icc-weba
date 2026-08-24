'use client';

// components/admin/catalog/BrandDirectoryPanel.tsx
//
// The vendor directory. Rows rather than the old three-column card grid, because a
// brand now carries a slug, a website, a featured flag and a lifecycle flag — four
// things a card had nowhere to put.

import React, { useMemo } from 'react';
import { Edit, ExternalLink, Trash2 } from 'lucide-react';

import {
  Chip,
  IconAction,
  PanelError,
  PanelPlaceholder,
  PanelShell,
  SlugChip,
} from './primitives';
import type { AdminBrandRow } from '@/types';

/**
 * The three-letter tile the mock shows in place of a logo.
 *
 * Used even when `logoUrl` is set: vendor logos are wide wordmarks on transparent
 * backgrounds, and squashing one into a 40px square renders an unreadable smudge.
 * The initials are legible at that size, and the real logo is what the storefront
 * shows.
 */
const LogoTile: React.FC<{ name: string }> = ({ name }) => (
  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0056b3]/10 text-[#0056b3] flex items-center justify-center font-black text-[11px] tracking-wide uppercase">
    {name.replace(/[^a-z0-9]/gi, '').slice(0, 3) || '—'}
  </div>
);

export const BrandDirectoryPanel: React.FC<{
  brands: AdminBrandRow[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onEdit: (brand: AdminBrandRow) => void;
  onRetire: (brand: AdminBrandRow) => void;
}> = ({ brands, isLoading, error, onReload, onAdd, onEdit, onRetire }) => {
  // Featured first, then alphabetical — the same order the Brands page merchandises
  // them in, so this table reads like what the customer sees.
  const ordered = useMemo(
    () =>
      [...brands].sort(
        (a, b) => Number(b.isPartner) - Number(a.isPartner) || a.name.localeCompare(b.name),
      ),
    [brands],
  );

  return (
    <PanelShell
      title="Official Brand Partners Directory"
      subtitle="Feeds the storefront brand filter and the Brands page. Product counts come from the catalogue, not from a stored figure."
      actionLabel="Add Brand"
      onAction={onAdd}
    >
      {error && <PanelError message={error} onRetry={onReload} />}

      {!error && isLoading && brands.length === 0 && (
        <PanelPlaceholder>Loading brands…</PanelPlaceholder>
      )}

      {!error && !isLoading && brands.length === 0 && (
        <PanelPlaceholder>No brands yet — add the first one.</PanelPlaceholder>
      )}

      {ordered.length > 0 && (
        <div className="space-y-3">
          {ordered.map((brand) => (
            <div
              key={brand.id}
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                brand.isActive ? 'border-gray-200 bg-gray-50/50' : 'border-dashed border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <LogoTile name={brand.name} />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <span className="truncate">{brand.name}</span>
                    {brand.isPartner && <Chip tone="violet">Featured</Chip>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <SlugChip>{brand.slug}</SlugChip>
                    <span>
                      &bull; {brand.productCount} product{brand.productCount === 1 ? '' : 's'} in
                      catalog
                    </span>
                    {brand.websiteUrl && (
                      <a
                        href={brand.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#0056b3] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Website</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {brand.isActive ? <Chip tone="emerald">Active</Chip> : <Chip tone="gray">Retired</Chip>}
                <IconAction label={`Edit ${brand.name}`} onClick={() => onEdit(brand)}>
                  <Edit className="w-4 h-4" />
                </IconAction>
                <IconAction
                  label={brand.isActive ? `Retire ${brand.name}` : 'Already retired'}
                  tone="danger"
                  disabled={!brand.isActive}
                  onClick={() => onRetire(brand)}
                >
                  <Trash2 className="w-4 h-4" />
                </IconAction>
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
};
