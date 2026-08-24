'use client';

// components/admin/catalog/AttributeFormModal.tsx

import React, { useState } from 'react';

import {
  AdminModal,
  ChipMultiSelect,
  Field,
  INPUT_CLASS,
  MONO_INPUT_CLASS,
  OptionListEditor,
  ToggleSwitch,
  useSlugField,
} from './primitives';
import type { AttributeDraft } from '@/hooks/useCatalogAdmin';
import type { AdminCategoryRow, AttributeDataType, ProductAttribute } from '@/types';

const DATA_TYPE_LABELS: Array<{ value: AttributeDataType; label: string; hint: string }> = [
  { value: 'text', label: 'Text', hint: 'Free text, shown on the spec sheet.' },
  { value: 'number', label: 'Number', hint: 'A numeric value with an optional unit.' },
  { value: 'select', label: 'Select List', hint: 'One of a fixed set of options.' },
  { value: 'boolean', label: 'Yes / No', hint: 'Present or absent.' },
];

export const AttributeFormModal: React.FC<{
  editing: ProductAttribute | null;
  attributes: ProductAttribute[];
  categories: AdminCategoryRow[];
  onClose: () => void;
  onSave: (draft: AttributeDraft) => Promise<{ ok: true } | { ok: false; error: string }>;
}> = ({ editing, attributes, categories, onClose, onSave }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const [dataType, setDataType] = useState<AttributeDataType>(editing?.dataType ?? 'text');
  const [unit, setUnit] = useState(editing?.unit ?? '');
  const [options, setOptions] = useState<string[]>(editing?.options?.length ? editing.options : ['']);
  const [categorySlugs, setCategorySlugs] = useState<string[]>(editing?.categorySlugs ?? []);
  const [isFilterable, setIsFilterable] = useState(editing?.isFilterable ?? true);
  const [isRequired, setIsRequired] = useState(editing?.isRequired ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `attribute_key` obeys the same rules as a slug and sits behind the same kind of
  // unique index, so it uses the same suggest-until-typed field.
  const keyField = useSlugField({
    source: name,
    initial: editing?.attributeKey,
    taken: attributes.filter((a) => a.id !== editing?.id).map((a) => a.attributeKey),
    maxLength: 80,
  });

  const submit = async () => {
    if (keyField.error) {
      setError(keyField.error);
      return;
    }

    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);
    // The same rule the server enforces, checked here so the operator sees it on
    // the field rather than as a rejected save.
    if (dataType === 'select' && cleanOptions.length === 0) {
      setError('A select attribute needs at least one option.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await onSave({
      name: name.trim(),
      attributeKey: keyField.slug,
      dataType,
      // Sent regardless of type; the API normalises whatever the chosen type has no
      // use for, so switching select → text cannot leave a stale option list behind.
      unit: unit.trim(),
      options: cleanOptions,
      categorySlugs,
      isFilterable,
      isRequired,
    });

    setIsSaving(false);
    if (result.ok) onClose();
    else setError(result.error);
  };

  return (
    <AdminModal
      title={editing ? `Edit Attribute — ${editing.name}` : 'Add Attribute'}
      submitLabel={editing ? 'Save Attribute' : 'Create Attribute'}
      onClose={onClose}
      onSubmit={submit}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Attribute Name" required htmlFor="attr-name">
          <input
            id="attr-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            placeholder="e.g. RAM"
            className={INPUT_CLASS}
          />
        </Field>

        <Field
          label="Attribute Key"
          htmlFor="attr-key"
          error={keyField.error}
          hint={keyField.isEdited ? 'Used in filter query strings.' : 'Follows the name until you type your own.'}
        >
          <input
            id="attr-key"
            type="text"
            value={keyField.slug}
            onChange={(event) => keyField.setSlug(event.target.value)}
            maxLength={80}
            spellCheck={false}
            placeholder="ram"
            className={MONO_INPUT_CLASS}
          />
        </Field>
      </div>

      <Field
        label="Data Type"
        required
        htmlFor="attr-type"
        hint={DATA_TYPE_LABELS.find((t) => t.value === dataType)?.hint}
      >
        <select
          id="attr-type"
          value={dataType}
          onChange={(event) => setDataType(event.target.value as AttributeDataType)}
          className={`${INPUT_CLASS} bg-white`}
        >
          {DATA_TYPE_LABELS.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Unit belongs to a number, an option list to a select — offering either
          elsewhere would produce a value the attribute can never hold. */}
      {dataType === 'number' && (
        <Field label="Unit" htmlFor="attr-unit" hint="Shown after the value, e.g. GB, MP, ppm.">
          <input
            id="attr-unit"
            type="text"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            maxLength={24}
            placeholder="GB"
            className={INPUT_CLASS}
          />
        </Field>
      )}

      {dataType === 'select' && (
        <Field label="Options" required hint="The choices offered in the shop's filter rail.">
          <OptionListEditor options={options} onChange={setOptions} />
        </Field>
      )}

      <Field
        label="Applicable Categories"
        hint="Leave all unselected to apply the attribute everywhere."
      >
        <ChipMultiSelect
          options={categories
            .filter((category) => category.isActive)
            .map((category) => ({ value: category.slug, label: category.name }))}
          selected={categorySlugs}
          onChange={setCategorySlugs}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ToggleSwitch
          label="Filterable"
          hint="Offered as a facet in the shop."
          checked={isFilterable}
          onChange={setIsFilterable}
        />
        <ToggleSwitch
          label="Required"
          hint="Flagged as missing on a product without it."
          checked={isRequired}
          onChange={setIsRequired}
        />
      </div>
    </AdminModal>
  );
};
