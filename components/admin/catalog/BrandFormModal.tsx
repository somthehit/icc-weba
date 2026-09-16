// components/admin/catalog/BrandFormModal.tsx

'use client';

import React, { useMemo, useState } from 'react';

import { FormField, ToggleRow, inputClass } from '../shared';
import { ChipSelect, RegistryModal, SlugInput, useSlugSync } from './primitives';
import {
  createBrand,
  updateBrand,
  type AdminBrand,
  type AdminCategory,
  type BrandWriteInput,
} from '@/lib/api/catalog-admin';

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const BrandFormModal: React.FC<{
  categories: AdminCategory[];
  editing: AdminBrand | null;
  onClose: () => void;
  onSaved: (brand: AdminBrand) => void;
}> = ({ categories, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const slugSync = useSlugSync(editing?.slug ?? '');
  const [logoUrl, setLogoUrl] = useState(editing?.logoUrl ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [categorySlugs, setCategorySlugs] = useState<string[]>(editing?.categorySlugs ?? []);
  const [isPartner, setIsPartner] = useState(editing?.isPartner ?? false);
  const [isFeatured, setIsFeatured] = useState(editing?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; slug?: string }>({});

  const chips = useMemo(
    () => categories.map((category) => ({ id: category.slug, label: category.name })),
    [categories],
  );

  const submit = async () => {
    const errors: { name?: string; slug?: string } = {};
    if (name.trim() === '') errors.name = 'A brand needs a name.';
    if (slugSync.slug.trim() === '') errors.slug = 'A slug is required — it becomes the brand URL.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: BrandWriteInput = {
      name: name.trim(),
      slug: slugSync.slug.trim(),
      description: orNull(description),
      logoUrl: orNull(logoUrl),
      isPartner,
      isFeatured,
      categorySlugs,
      isActive,
    };

    setIsSaving(true);
    setError(null);
    const result = editing ? await updateBrand(editing.id, payload) : await createBrand(payload);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data.brand);
  };

  return (
    <RegistryModal
      title={editing ? `Edit Brand — ${editing.name}` : 'Add Brand'}
      subtitle={
        editing
          ? `${editing.productCount} product(s) are stocked under this brand.`
          : 'Brands are what the storefront brand pages and the brand filter are built from.'
      }
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save Brand' : 'Create Brand'}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Brand Name" htmlFor="brand-name" required error={fieldErrors.name}>
          <input
            id="brand-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              slugSync.onNameChange(event.target.value);
            }}
            placeholder="ASUS"
            className={inputClass(Boolean(fieldErrors.name))}
          />
        </FormField>

        <FormField
          label="Slug"
          htmlFor="brand-slug"
          required
          error={fieldErrors.slug}
          hint={
            editing
              ? 'Changing this changes the brand URL — existing links will 404.'
              : 'Fills itself from the name until you type here.'
          }
        >
          <SlugInput
            id="brand-slug"
            value={slugSync.slug}
            onChange={slugSync.onSlugChange}
            placeholder="asus"
            error={Boolean(fieldErrors.slug)}
          />
        </FormField>
      </div>

      <FormField
        label="Logo URL"
        htmlFor="brand-logo"
        hint="Shown on the brand tile and the brand's storefront page."
      >
        <input
          id="brand-logo"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://…"
          className={inputClass()}
        />
      </FormField>

      <FormField
        label="Description"
        htmlFor="brand-description"
        hint="Shown on the brand's storefront page."
      >
        <textarea
          id="brand-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className={inputClass()}
        />
      </FormField>

      <FormField
        label="Categories Carried"
        hint="Which departments this brand appears under. Leave empty if it spans everything."
      >
        <ChipSelect
          options={chips}
          selected={categorySlugs}
          onToggle={(id) =>
            setCategorySlugs((current) =>
              current.includes(String(id))
                ? current.filter((slug) => slug !== String(id))
                : [...current, String(id)],
            )
          }
          emptyLabel="Add a category first — brands are scoped to the departments they are carried in."
        />
      </FormField>

      <div className="space-y-2">
        {/* Two separate claims, deliberately. `isPartner` asserts an authorized
            dealership — a commercial fact with warranty consequences. `isFeatured`
            is only a decision about the homepage strip. */}
        <ToggleRow
          label="Authorized Partner"
          description="Assert an official dealership. Only set this where the paperwork exists — the storefront prints it as a warranty claim."
          checked={isPartner}
          onChange={setIsPartner}
        />
        <ToggleRow
          label="Featured Brand"
          description="Shown prominently on the Brands landing page."
          checked={isFeatured}
          onChange={setIsFeatured}
        />
        <ToggleRow
          label="Active"
          description="Visible on the storefront. Turning this off hides the brand page and filter without touching its products."
          checked={isActive}
          onChange={setIsActive}
        />
      </div>
    </RegistryModal>
  );
};
