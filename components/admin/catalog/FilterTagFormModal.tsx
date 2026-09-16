// components/admin/catalog/FilterTagFormModal.tsx

'use client';

import React, { useState } from 'react';

import { FormField, ToggleRow, inputClass } from '../shared';
import { RegistryModal, SlugInput, SwatchPicker, TAG_TONE, useSlugSync } from './primitives';
import {
  createFilterTag,
  updateFilterTag,
  type AdminFilterTag,
  type FilterTagWriteInput,
} from '@/lib/api/catalog-admin';
import { FILTER_TAG_COLORS, type FilterTagColor } from '@/lib/validation/catalog-admin';

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const FilterTagFormModal: React.FC<{
  editing: AdminFilterTag | null;
  onClose: () => void;
  onSaved: (filterTag: AdminFilterTag) => void;
}> = ({ editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const slugSync = useSlugSync(editing?.slug ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [color, setColor] = useState<FilterTagColor>(editing?.color ?? 'blue');
  const [displayOrder, setDisplayOrder] = useState(String(editing?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({});

  const submit = async () => {
    const errors: { name?: string; slug?: string } = {};
    if (name.trim() === '') errors.name = 'A tag needs a label.';
    if (slugSync.slug.trim() === '') errors.slug = 'A slug is required — it becomes the filter key.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: FilterTagWriteInput = {
      name: name.trim(),
      slug: slugSync.slug.trim(),
      description: orNull(description),
      color,
      displayOrder: Number(displayOrder) || 0,
      isActive,
    };

    setIsSaving(true);
    setError(null);
    const result = editing
      ? await updateFilterTag(editing.id, payload)
      : await createFilterTag(payload);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data.filterTag);
  };

  const tone = TAG_TONE[color] ?? TAG_TONE.blue;

  return (
    <RegistryModal
      title={editing ? `Edit Filter Tag — ${editing.name}` : 'Add Filter Tag'}
      subtitle={
        editing
          ? `${editing.productCount} product(s) carry this tag.`
          : 'A merchandising label the shop applies — not a property of the hardware. "Best Seller", "Student Pick".'
      }
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save Tag' : 'Create Tag'}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Tag Label" htmlFor="tag-name" required error={fieldErrors.name}>
          <input
            id="tag-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              slugSync.onNameChange(event.target.value);
            }}
            placeholder="Best Seller"
            maxLength={80}
            className={inputClass(Boolean(fieldErrors.name))}
          />
        </FormField>

        <FormField
          label="Slug"
          htmlFor="tag-slug"
          required
          error={fieldErrors.slug}
          hint={
            editing
              ? 'This is the filter key in shop URLs — changing it breaks saved links.'
              : 'Fills itself from the label until you type here.'
          }
        >
          <SlugInput
            id="tag-slug"
            value={slugSync.slug}
            onChange={slugSync.onSlugChange}
            placeholder="best-seller"
            error={Boolean(fieldErrors.slug)}
          />
        </FormField>
      </div>

      <FormField
        label="Description"
        htmlFor="tag-description"
        hint="Internal note on when to apply this tag."
      >
        <textarea
          id="tag-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          maxLength={300}
          className={inputClass()}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Badge Colour"
          hint="Picked once here so the tag looks the same on every surface that renders it."
        >
          <div className="flex items-center gap-3 pt-1">
            <SwatchPicker
              colors={FILTER_TAG_COLORS}
              value={color}
              onChange={(next) => setColor(next as FilterTagColor)}
            />
            <span className={`px-2.5 py-1 rounded-lg font-bold ${tone.badge}`}>
              {name.trim() || 'Preview'}
            </span>
          </div>
        </FormField>

        <FormField label="Display Order" htmlFor="tag-order" hint="Lower sorts first.">
          <input
            id="tag-order"
            type="number"
            min={0}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className={inputClass()}
          />
        </FormField>
      </div>

      <ToggleRow
        label="Active"
        description="Shown as a filter on the storefront. Turning this off hides the tag and leaves it attached to the products that carry it."
        checked={isActive}
        onChange={setIsActive}
      />
    </RegistryModal>
  );
};
