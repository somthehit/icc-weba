'use client';

// components/admin/catalog/BrandFormModal.tsx

import React, { useState } from 'react';

import {
  AdminModal,
  Field,
  INPUT_CLASS,
  MONO_INPUT_CLASS,
  ToggleSwitch,
  useSlugField,
} from './primitives';
import type { BrandDraft } from '@/hooks/useCatalogAdmin';
import type { AdminBrandRow } from '@/types';

export const BrandFormModal: React.FC<{
  editing: AdminBrandRow | null;
  brands: AdminBrandRow[];
  onClose: () => void;
  onSave: (draft: BrandDraft) => Promise<{ ok: true } | { ok: false; error: string }>;
}> = ({ editing, brands, onClose, onSave }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(editing?.websiteUrl ?? '');
  const [logoUrl, setLogoUrl] = useState(editing?.logoUrl ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [isPartner, setIsPartner] = useState(editing?.isPartner ?? false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugField = useSlugField({
    source: name,
    initial: editing?.slug,
    taken: brands.filter((b) => b.id !== editing?.id).map((b) => b.slug),
  });

  const submit = async () => {
    if (slugField.error) {
      setError(slugField.error);
      return;
    }
    setIsSaving(true);
    setError(null);

    // Empty strings are sent deliberately, not stripped: the API reads `''` as
    // "clear this column", which is how a logo gets removed rather than kept.
    const result = await onSave({
      name: name.trim(),
      slug: slugField.slug,
      websiteUrl: websiteUrl.trim(),
      logoUrl: logoUrl.trim(),
      description: description.trim(),
      isPartner,
      isActive,
    });

    setIsSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <AdminModal
      title={editing ? `Edit Brand — ${editing.name}` : 'Add Brand'}
      submitLabel={editing ? 'Save Brand' : 'Create Brand'}
      onClose={onClose}
      onSubmit={submit}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Brand Name" required htmlFor="brand-name">
          <input
            id="brand-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            placeholder="e.g. Lenovo"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="URL Slug"
          htmlFor="brand-slug"
          error={slugField.error}
          hint={slugField.isEdited ? undefined : 'Follows the name until you type your own.'}
        >
          <input
            id="brand-slug"
            type="text"
            value={slugField.slug}
            onChange={(event) => slugField.setSlug(event.target.value)}
            maxLength={140}
            spellCheck={false}
            placeholder="lenovo"
            className={MONO_INPUT_CLASS}
          />
        </Field>
      </div>

      <Field label="Website URL" htmlFor="brand-site" hint="Leave empty if the vendor has no site.">
        <input
          id="brand-site"
          type="url"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          maxLength={500}
          placeholder="https://www.lenovo.com"
          className={MONO_INPUT_CLASS}
        />
      </Field>

      <Field label="Logo URL" htmlFor="brand-logo">
        <input
          id="brand-logo"
          type="url"
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          maxLength={500}
          placeholder="https://…/lenovo-logo.png"
          className={MONO_INPUT_CLASS}
        />
      </Field>

      <Field label="Description" htmlFor="brand-desc">
        <textarea
          id="brand-desc"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Official Nepal distributor coverage, warranty terms, service centres…"
          className={`${INPUT_CLASS} font-medium`}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ToggleSwitch
          label="Featured Brand"
          hint="Merchandised on the Brands page."
          checked={isPartner}
          onChange={setIsPartner}
        />
        <ToggleSwitch
          label="Active"
          hint="Offered in the storefront brand filter."
          checked={isActive}
          onChange={setIsActive}
        />
      </div>
    </AdminModal>
  );
};
