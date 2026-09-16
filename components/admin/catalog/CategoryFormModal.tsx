// components/admin/catalog/CategoryFormModal.tsx

'use client';

import React, { useMemo, useState } from 'react';

import { FormField, ToggleRow, inputClass } from '../shared';
import { RegistryModal, SlugInput, useSlugSync } from './primitives';
import {
  createCategory,
  updateCategory,
  type AdminCategory,
  type CategoryWriteInput,
} from '@/lib/api/catalog-admin';

/**
 * Every category that may legally be this one's parent.
 *
 * Excludes itself and its own descendants. The API rejects a cycle too — it has to,
 * since it is the only layer that can be trusted — but offering "Laptops" as a
 * parent of its own child only to refuse the save is a worse form than not offering
 * it.
 */
function eligibleParents(all: AdminCategory[], selfId: number | null): AdminCategory[] {
  if (selfId === null) return all;

  const banned = new Set<number>([selfId]);
  // Repeat until the set stops growing: the list is in no particular order, so one
  // pass could miss a grandchild that appears before its parent.
  let grew = true;
  while (grew) {
    grew = false;
    for (const category of all) {
      if (category.parentId !== null && banned.has(category.parentId) && !banned.has(category.id)) {
        banned.add(category.id);
        grew = true;
      }
    }
  }

  return all.filter((category) => !banned.has(category.id));
}

/** `''` clears the column; the API's `.url()` check would refuse an empty string. */
const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const CategoryFormModal: React.FC<{
  categories: AdminCategory[];
  editing: AdminCategory | null;
  onClose: () => void;
  onSaved: (category: AdminCategory) => void;
}> = ({ categories, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const slugSync = useSlugSync(editing?.slug ?? '');
  const [parentId, setParentId] = useState<string>(
    editing?.parentId != null ? String(editing.parentId) : '',
  );
  const [description, setDescription] = useState(editing?.description ?? '');
  const [iconName, setIconName] = useState(editing?.iconName ?? '');
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? '');
  const [subcategories, setSubcategories] = useState((editing?.subcategories ?? []).join(', '));
  const [displayOrder, setDisplayOrder] = useState(String(editing?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({});

  const parents = useMemo(
    () => eligibleParents(categories, editing?.id ?? null),
    [categories, editing?.id],
  );

  const submit = async () => {
    const errors: { name?: string; slug?: string } = {};
    if (name.trim() === '') errors.name = 'A category needs a name.';
    if (slugSync.slug.trim() === '') errors.slug = 'A slug is required — it becomes the shop URL.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: CategoryWriteInput = {
      name: name.trim(),
      slug: slugSync.slug.trim(),
      description: orNull(description),
      iconName: orNull(iconName),
      imageUrl: orNull(imageUrl),
      subcategories: subcategories
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
      parentId: parentId === '' ? null : Number(parentId),
      displayOrder: Number(displayOrder) || 0,
      isActive,
    };

    setIsSaving(true);
    setError(null);
    const result = editing
      ? await updateCategory(editing.id, payload)
      : await createCategory(payload);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data.category);
  };

  return (
    <RegistryModal
      title={editing ? `Edit Category — ${editing.name}` : 'Add Category'}
      subtitle={
        editing
          ? `${editing.productCount} product(s) currently sit in this category.`
          : 'Categories are what products, filters and the storefront menu are grouped by.'
      }
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save Category' : 'Create Category'}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Category Name" htmlFor="cat-name" required error={fieldErrors.name}>
          <input
            id="cat-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              slugSync.onNameChange(event.target.value);
            }}
            placeholder="Gaming Laptops"
            className={inputClass(Boolean(fieldErrors.name))}
          />
        </FormField>

        <FormField
          label="Slug"
          htmlFor="cat-slug"
          required
          error={fieldErrors.slug}
          hint={
            editing
              ? 'Changing this changes the category URL — existing links will 404.'
              : 'Fills itself from the name until you type here.'
          }
        >
          <SlugInput
            id="cat-slug"
            value={slugSync.slug}
            onChange={slugSync.onSlugChange}
            placeholder="gaming-laptops"
            error={Boolean(fieldErrors.slug)}
          />
        </FormField>
      </div>

      <FormField
        label="Parent Category"
        htmlFor="cat-parent"
        hint="Leave as top level for a main menu entry. A category cannot be nested under itself or its own children."
      >
        <select
          id="cat-parent"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
          className={inputClass()}
        >
          <option value="">— None (top level) —</option>
          {parents.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.isActive ? '' : ' (inactive)'}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Description"
        htmlFor="cat-description"
        hint="Shown at the top of the category listing page."
      >
        <textarea
          id="cat-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className={inputClass()}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label="Icon Name"
          htmlFor="cat-icon"
          hint="A lucide-react icon name, e.g. Laptop, Cpu, Printer."
        >
          <input
            id="cat-icon"
            value={iconName}
            onChange={(event) => setIconName(event.target.value)}
            placeholder="Laptop"
            className={inputClass()}
          />
        </FormField>

        <FormField label="Image URL" htmlFor="cat-image" hint="Optional banner or tile image.">
          <input
            id="cat-image"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            placeholder="https://…"
            className={inputClass()}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          label="Drilldown Labels"
          htmlFor="cat-subs"
          className="md:col-span-2"
          hint="Comma separated. Display-only labels the listing page offers — not category rows."
        >
          <input
            id="cat-subs"
            value={subcategories}
            onChange={(event) => setSubcategories(event.target.value)}
            placeholder="Gaming, Business, Ultrabook"
            className={inputClass()}
          />
        </FormField>

        <FormField label="Display Order" htmlFor="cat-order" hint="Lower sorts first.">
          <input
            id="cat-order"
            type="number"
            min={0}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className={inputClass()}
          />
        </FormField>
      </div>

      <ToggleRow
        label="Active Menu Item"
        description="Shown in storefront navigation and filters. Turning this off hides the category without touching the products in it."
        checked={isActive}
        onChange={setIsActive}
      />
    </RegistryModal>
  );
};
