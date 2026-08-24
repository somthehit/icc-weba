'use client';

// components/admin/catalog/CategoryFormModal.tsx

import React, { useState } from 'react';

import {
  AdminModal,
  Field,
  INPUT_CLASS,
  MONO_INPUT_CLASS,
  ToggleSwitch,
  useSlugField,
} from './primitives';
import type { CategoryDraft } from '@/hooks/useCatalogAdmin';
import type { AdminCategoryRow } from '@/types';

/**
 * Splits the mock's single "Icon / Image URL" field into the two columns that
 * actually back it.
 *
 * `categories` carries both `icon_name` (a lucide component name the storefront
 * tiles render) and `image_url`. The mock offers one input for both, so the value
 * is routed by shape: anything that looks like a URL is the image, a bare word is
 * the icon name. Getting this wrong would put "Laptop" in an `<img src>`.
 */
function splitIconOrImage(value: string): { iconName: string | null; imageUrl: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { iconName: null, imageUrl: null };
  const looksLikeUrl = /^(https?:\/\/|\/)/i.test(trimmed);
  return looksLikeUrl ? { iconName: null, imageUrl: trimmed } : { iconName: trimmed, imageUrl: null };
}

export const CategoryFormModal: React.FC<{
  editing: AdminCategoryRow | null;
  categories: AdminCategoryRow[];
  onClose: () => void;
  onSave: (draft: CategoryDraft) => Promise<{ ok: true } | { ok: false; error: string }>;
}> = ({ editing, categories, onClose, onSave }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [iconOrImage, setIconOrImage] = useState(editing?.imageUrl || editing?.iconName || '');
  const [parentId, setParentId] = useState<number | null>(editing?.parentId ?? null);
  const [displayOrder, setDisplayOrder] = useState(String(editing?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugField = useSlugField({
    source: name,
    initial: editing?.slug,
    taken: categories.filter((c) => c.id !== editing?.id).map((c) => c.slug),
  });

  // A category cannot parent itself, and offering its own descendants would build
  // a cycle the tree can never render.
  const descendantIds = new Set<number>();
  if (editing) {
    descendantIds.add(editing.id);
    let grew = true;
    while (grew) {
      grew = false;
      for (const candidate of categories) {
        if (
          candidate.parentId !== null &&
          descendantIds.has(candidate.parentId) &&
          !descendantIds.has(candidate.id)
        ) {
          descendantIds.add(candidate.id);
          grew = true;
        }
      }
    }
  }

  const submit = async () => {
    if (slugField.error) {
      setError(slugField.error);
      return;
    }
    setIsSaving(true);
    setError(null);

    const result = await onSave({
      name: name.trim(),
      slug: slugField.slug,
      ...splitIconOrImage(iconOrImage),
      parentId,
      displayOrder: Number.parseInt(displayOrder, 10) || 0,
      isActive,
    });

    setIsSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <AdminModal
      title={editing ? `Edit Category — ${editing.name}` : 'Add Category'}
      submitLabel={editing ? 'Save Category' : 'Create Category'}
      onClose={onClose}
      onSubmit={submit}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Category Name" required htmlFor="cat-name">
          <input
            id="cat-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Gaming Laptops"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="URL Slug"
          htmlFor="cat-slug"
          error={slugField.error}
          hint={slugField.isEdited ? undefined : 'Follows the name until you type your own.'}
        >
          <input
            id="cat-slug"
            type="text"
            value={slugField.slug}
            onChange={(event) => slugField.setSlug(event.target.value)}
            maxLength={140}
            spellCheck={false}
            placeholder="gaming-laptops"
            className={MONO_INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Parent Category" htmlFor="cat-parent">
          <select
            id="cat-parent"
            value={parentId ?? ''}
            onChange={(event) =>
              setParentId(event.target.value ? Number(event.target.value) : null)
            }
            className={`${INPUT_CLASS} bg-white`}
          >
            <option value="">None — top level</option>
            {categories
              .filter((c) => !descendantIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isActive ? '' : ' (retired)'}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Display Order" htmlFor="cat-order" hint="Lower numbers sort first.">
          <input
            id="cat-order"
            type="number"
            min={0}
            max={9999}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className={`${INPUT_CLASS} font-mono`}
          />
        </Field>
      </div>

      <Field
        label="Icon Name or Image URL"
        htmlFor="cat-icon"
        hint="A lucide icon name (Laptop, Printer) or a full image URL."
      >
        <input
          id="cat-icon"
          type="text"
          value={iconOrImage}
          onChange={(event) => setIconOrImage(event.target.value)}
          maxLength={500}
          placeholder="Laptop  ·  https://…/category.jpg"
          className={MONO_INPUT_CLASS}
        />
      </Field>

      <ToggleSwitch
        label="Active Menu Item"
        hint="Shown in the storefront navigation and category grid."
        checked={isActive}
        onChange={setIsActive}
      />
    </AdminModal>
  );
};
