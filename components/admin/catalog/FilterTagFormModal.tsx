'use client';

// components/admin/catalog/FilterTagFormModal.tsx

import React, { useState } from 'react';

import {
  AdminModal,
  ColorSwatchPicker,
  Field,
  INPUT_CLASS,
  MONO_INPUT_CLASS,
  ToggleSwitch,
  useSlugField,
} from './primitives';
import { BADGE_COLORS, FACET_GROUPS } from '@/lib/catalog/facets';
import type { FilterTagDraft } from '@/hooks/useCatalogAdmin';
import type { FilterTag } from '@/types';

export const FilterTagFormModal: React.FC<{
  editing: FilterTag | null;
  filterTags: FilterTag[];
  onClose: () => void;
  onSave: (draft: FilterTagDraft) => Promise<{ ok: true } | { ok: false; error: string }>;
}> = ({ editing, filterTags, onClose, onSave }) => {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [facetGroup, setFacetGroup] = useState<string>(editing?.facetGroup ?? FACET_GROUPS[1]);
  const [badgeColor, setBadgeColor] = useState(editing?.badgeColor ?? 'blue');
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugField = useSlugField({
    source: label,
    initial: editing?.slug,
    taken: filterTags.filter((tag) => tag.id !== editing?.id).map((tag) => tag.slug),
    maxLength: 100,
  });

  const submit = async () => {
    if (slugField.error) {
      setError(slugField.error);
      return;
    }
    setIsSaving(true);
    setError(null);

    const result = await onSave({
      label: label.trim(),
      slug: slugField.slug,
      facetGroup,
      badgeColor,
      isActive,
    });

    setIsSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <AdminModal
      title={editing ? `Edit Filter Tag — ${editing.label}` : 'Add Filter Tag'}
      submitLabel={editing ? 'Save Filter Tag' : 'Create Filter Tag'}
      onClose={onClose}
      onSubmit={submit}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tag Label" required htmlFor="tag-label">
          <input
            id="tag-label"
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
            maxLength={80}
            placeholder="e.g. Gaming Laptop"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="URL Slug"
          htmlFor="tag-slug"
          error={slugField.error}
          hint={slugField.isEdited ? undefined : 'Follows the label until you type your own.'}
        >
          <input
            id="tag-slug"
            type="text"
            value={slugField.slug}
            onChange={(event) => slugField.setSlug(event.target.value)}
            maxLength={100}
            spellCheck={false}
            placeholder="gaming-laptop"
            className={MONO_INPUT_CLASS}
          />
        </Field>
      </div>

      <Field
        label="Facet Group"
        required
        htmlFor="tag-group"
        hint="Which section of the shop's filter rail the pill sits under."
      >
        <select
          id="tag-group"
          value={facetGroup}
          onChange={(event) => setFacetGroup(event.target.value)}
          className={`${INPUT_CLASS} bg-white`}
        >
          {FACET_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Badge Colour">
        <ColorSwatchPicker colors={BADGE_COLORS} value={badgeColor} onChange={setBadgeColor} />
      </Field>

      <ToggleSwitch
        label="Active"
        hint="Offered as a filter pill in the shop."
        checked={isActive}
        onChange={setIsActive}
      />
    </AdminModal>
  );
};
