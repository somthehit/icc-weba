'use client';

// components/admin/catalog/FilterTagsPanel.tsx
//
// The cross-cutting merchandising pills — "Gaming Laptop", "Under NPR 50K" — that
// group products regardless of category.
//
// Replaces a hardcoded array of nine strings that had no Add button at all. Rows
// are grouped by facet group because that is how they appear in the shop's filter
// rail, so the table shows the same shape the customer gets.

import React, { useMemo } from 'react';
import { Edit, Trash2 } from 'lucide-react';

import {
  Chip,
  IconAction,
  PanelError,
  PanelPlaceholder,
  PanelShell,
  SlugChip,
  badgeClasses,
} from './primitives';
import type { FilterTag } from '@/types';

export const FilterTagsPanel: React.FC<{
  filterTags: FilterTag[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onEdit: (tag: FilterTag) => void;
  onDelete: (tag: FilterTag) => void;
}> = ({ filterTags, isLoading, error, onReload, onAdd, onEdit, onDelete }) => {
  const groups = useMemo(() => {
    const byGroup = new Map<string, FilterTag[]>();
    for (const tag of filterTags) {
      const bucket = byGroup.get(tag.facetGroup);
      if (bucket) bucket.push(tag);
      else byGroup.set(tag.facetGroup, [tag]);
    }
    for (const bucket of byGroup.values()) {
      bucket.sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label));
    }
    return [...byGroup.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filterTags]);

  return (
    <PanelShell
      title="Cross-Cutting Faceted Filter Tags"
      subtitle="A tag applies to a product when its label appears in that product's tag list, so the counts below are live."
      actionLabel="Add Filter Tag"
      onAction={onAdd}
    >
      {error && <PanelError message={error} onRetry={onReload} />}

      {!error && isLoading && filterTags.length === 0 && (
        <PanelPlaceholder>Loading filter tags…</PanelPlaceholder>
      )}

      {!error && !isLoading && filterTags.length === 0 && (
        <PanelPlaceholder>No filter tags yet — add the first one.</PanelPlaceholder>
      )}

      {groups.map(([facetGroup, tags]) => (
        <div key={facetGroup} className="space-y-2">
          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
            {facetGroup}
          </h4>

          {tags.map((tag) => (
            <div
              key={tag.id}
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                tag.isActive ? 'border-gray-200 bg-gray-50/50' : 'border-dashed border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden="true"
                  className={`w-3 h-3 rounded-full shrink-0 ${badgeClasses(tag.badgeColor).solid}`}
                />
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{tag.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <SlugChip>{tag.slug}</SlugChip>
                    <span>
                      &bull; {tag.productCount} product{tag.productCount === 1 ? '' : 's'} tagged
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Shows the swatch as the shop would render the pill, which is the
                    only way to tell "violet" from "indigo" before publishing. */}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border whitespace-nowrap ${
                    badgeClasses(tag.badgeColor).chip
                  }`}
                >
                  {tag.label}
                </span>
                {tag.isActive ? <Chip tone="emerald">Active</Chip> : <Chip tone="gray">Hidden</Chip>}
                <IconAction label={`Edit ${tag.label}`} onClick={() => onEdit(tag)}>
                  <Edit className="w-4 h-4" />
                </IconAction>
                <IconAction label={`Delete ${tag.label}`} tone="danger" onClick={() => onDelete(tag)}>
                  <Trash2 className="w-4 h-4" />
                </IconAction>
              </div>
            </div>
          ))}
        </div>
      ))}
    </PanelShell>
  );
};
