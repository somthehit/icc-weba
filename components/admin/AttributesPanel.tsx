'use client';

// components/admin/catalog/AttributesPanel.tsx
//
// The spec keys the shop's faceted filters are built from.
//
// Replaces four hardcoded JSX cards. The counts here are real: `usageCount` is how
// many product spec-sheet rows actually carry this attribute's name, so an
// attribute nobody filled in is visible as such rather than looking configured.

import React, { useMemo } from 'react';
import { Edit, Sliders, Trash2 } from 'lucide-react';

import {
  Chip,
  IconAction,
  PanelError,
  PanelPlaceholder,
  PanelShell,
  SlugChip,
} from './primitives';
import type { AdminCategoryRow, AttributeDataType, ProductAttribute } from '@/types';

const DATA_TYPE_CHIP: Record<AttributeDataType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select List',
  boolean: 'Yes / No',
};

export const AttributesPanel: React.FC<{
  attributes: ProductAttribute[];
  categories: AdminCategoryRow[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onEdit: (attribute: ProductAttribute) => void;
  onDelete: (attribute: ProductAttribute) => void;
}> = ({ attributes, categories, isLoading, error, onReload, onAdd, onEdit, onDelete }) => {
  // `categorySlugs` stores slugs; the row shows names. A slug with no matching
  // category is shown as-is rather than hidden, so a category renamed out from
  // under an attribute is visible instead of silently narrowing its scope.
  const categoryNameBySlug = useMemo(
    () => new Map(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const ordered = useMemo(
    () =>
      [...attributes].sort(
        (a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      ),
    [attributes],
  );

  return (
    <PanelShell
      title="Product Specifications & Filter Attributes"
      subtitle="Drives the dynamic faceted shop filters. Attribute values live on each product's spec sheet, matched by name."
      actionLabel="Add Attribute"
      onAction={onAdd}
    >
      {error && <PanelError message={error} onRetry={onReload} />}

      {!error && isLoading && attributes.length === 0 && (
        <PanelPlaceholder>Loading attributes…</PanelPlaceholder>
      )}

      {!error && !isLoading && attributes.length === 0 && (
        <PanelPlaceholder>No attributes yet — add the first one.</PanelPlaceholder>
      )}

      {ordered.length > 0 && (
        <div className="space-y-3">
          {ordered.map((attribute) => {
            const scope =
              attribute.categorySlugs.length === 0
                ? 'All categories'
                : attribute.categorySlugs
                    .map((slug) => categoryNameBySlug.get(slug) ?? slug)
                    .join(', ');

            return (
              <div
                key={attribute.id}
                className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  attribute.isActive
                    ? 'border-gray-200 bg-gray-50/50'
                    : 'border-dashed border-gray-300 bg-white'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-bold text-sm text-gray-900 flex flex-wrap items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#0056b3] shrink-0" />
                    <span className="truncate">{attribute.name}</span>
                    <Chip tone="gray">
                      {DATA_TYPE_CHIP[attribute.dataType]}
                      {/* The unit is what makes "Number" mean something — "Number · GB". */}
                      {attribute.unit ? ` · ${attribute.unit}` : ''}
                    </Chip>
                    {attribute.isRequired && <Chip tone="amber">Required</Chip>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <SlugChip>{attribute.attributeKey}</SlugChip>
                    <span>&bull; {scope}</span>
                    <span>
                      &bull; used on {attribute.usageCount} product
                      {attribute.usageCount === 1 ? '' : 's'}
                    </span>
                    {attribute.dataType === 'select' && attribute.options.length > 0 && (
                      <span>
                        &bull; {attribute.options.length} option
                        {attribute.options.length === 1 ? '' : 's'}: {attribute.options.join(' / ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {attribute.isFilterable ? (
                    <Chip tone="blue">Filterable</Chip>
                  ) : (
                    <Chip tone="gray">Spec only</Chip>
                  )}
                  {!attribute.isActive && <Chip tone="gray">Hidden</Chip>}
                  <IconAction label={`Edit ${attribute.name}`} onClick={() => onEdit(attribute)}>
                    <Edit className="w-4 h-4" />
                  </IconAction>
                  <IconAction
                    label={`Delete ${attribute.name}`}
                    tone="danger"
                    onClick={() => onDelete(attribute)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconAction>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
};
