// components/admin/catalog/AttributeFormModal.tsx

'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { FormField, ToggleRow, genAdminId, inputClass } from '../shared';
import {
  ChipSelect,
  OptionRows,
  RegistryModal,
  SlugInput,
  useSlugSync,
  type DraftOption,
} from './primitives';
import {
  createAttribute,
  updateAttribute,
  type AdminAttribute,
  type AdminCategory,
  type AttributeWriteInput,
} from '@/lib/api/catalog-admin';
import {
  ATTRIBUTE_DATA_TYPES,
  type AttributeDataType,
} from '@/lib/validation/catalog-admin';

const TYPE_LABEL: Record<AttributeDataType, string> = {
  text: 'Text — free-form, e.g. "Backlit chiclet"',
  number: 'Number — comparable, e.g. 16 with unit GB',
  boolean: 'Yes / No',
  select: 'Select list — a fixed set of choices',
};

const TYPE_HINT: Record<AttributeDataType, string> = {
  text: 'Stored as typed. Fine for a spec nobody browses by; it cannot become a tidy facet.',
  number: 'Give it a unit so 16 GB and 16 inches never compare against each other.',
  boolean: 'Renders as a single checkbox facet — "Backlit Keyboard", "Touchscreen".',
  select:
    'The only type that makes a clean facet: products pick from your list, so a typo cannot invent a phantom filter.',
};

const orNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export const AttributeFormModal: React.FC<{
  categories: AdminCategory[];
  editing: AdminAttribute | null;
  onClose: () => void;
  onSaved: (attribute: AdminAttribute) => void;
}> = ({ categories, editing, onClose, onSaved }) => {
  const [name, setName] = useState(editing?.name ?? '');
  const slugSync = useSlugSync(editing?.slug ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [dataType, setDataType] = useState<AttributeDataType>(editing?.dataType ?? 'text');
  const [unit, setUnit] = useState(editing?.unit ?? '');
  const [categoryIds, setCategoryIds] = useState<number[]>(editing?.categoryIds ?? []);
  const [options, setOptions] = useState<DraftOption[]>(() =>
    (editing?.options ?? []).map((option) => ({
      key: genAdminId('opt'),
      id: option.id,
      value: option.value,
    })),
  );
  const [isFilterable, setIsFilterable] = useState(editing?.isFilterable ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(editing?.displayOrder ?? 0));
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    slug?: string;
    options?: string;
  }>({});

  const chips = useMemo(
    () => categories.map((category) => ({ id: category.id, label: category.name })),
    [categories],
  );

  /**
   * Switching an in-use select attribute to another type throws its option list
   * away, and `product_attribute_values.option_id` cascades — so every product's
   * answer goes with it. Say so before the save, not after.
   */
  const losesOptions =
    editing !== null &&
    editing.dataType === 'select' &&
    dataType !== 'select' &&
    editing.options.length > 0;

  const submit = async () => {
    const errors: { name?: string; slug?: string; options?: string } = {};
    if (name.trim() === '') errors.name = 'An attribute needs a name.';
    if (slugSync.slug.trim() === '') errors.slug = 'A key is required — facets are addressed by it.';

    const cleanedOptions = options
      .map((option) => ({ ...option, value: option.value.trim() }))
      .filter((option) => option.value !== '');

    if (dataType === 'select' && cleanedOptions.length === 0) {
      errors.options = 'A select attribute needs at least one option, or nothing can be chosen.';
    }

    const lowered = cleanedOptions.map((option) => option.value.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      errors.options = 'Option values must be unique — two identical facets would filter apart.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: AttributeWriteInput = {
      name: name.trim(),
      slug: slugSync.slug.trim(),
      description: orNull(description),
      dataType,
      // A unit on anything but a number is noise — "GB" beside a Yes/No answer.
      unit: dataType === 'number' ? orNull(unit) : null,
      isFilterable,
      displayOrder: Number(displayOrder) || 0,
      isActive,
      categoryIds,
    };

    // Sent only for `select`: the endpoint refuses a non-empty option list on any
    // other type, and clears the stored list itself when the type moves away.
    if (dataType === 'select') {
      payload.options = cleanedOptions.map((option, index) => ({
        id: option.id,
        value: option.value,
        displayOrder: index,
      }));
    }

    setIsSaving(true);
    setError(null);
    const result = editing
      ? await updateAttribute(editing.id, payload)
      : await createAttribute(payload);
    setIsSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.data.attribute);
  };

  return (
    <RegistryModal
      title={editing ? `Edit Attribute — ${editing.name}` : 'Add Attribute'}
      subtitle={
        editing
          ? `${editing.valueCount} product(s) have answered this attribute.`
          : 'Define a spec once here, then every product picks its value — that is what makes faceted filtering possible.'
      }
      onClose={onClose}
      onSubmit={submit}
      submitLabel={editing ? 'Save Attribute' : 'Create Attribute'}
      isSaving={isSaving}
      error={error}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Attribute Name" htmlFor="attr-name" required error={fieldErrors.name}>
          <input
            id="attr-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              slugSync.onNameChange(event.target.value);
            }}
            placeholder="System RAM"
            className={inputClass(Boolean(fieldErrors.name))}
          />
        </FormField>

        <FormField
          label="Attribute Key"
          htmlFor="attr-slug"
          required
          error={fieldErrors.slug}
          hint={
            editing
              ? 'This is the facet key in shop URLs — changing it breaks saved filter links.'
              : 'Fills itself from the name until you type here.'
          }
        >
          <SlugInput
            id="attr-slug"
            value={slugSync.slug}
            onChange={slugSync.onSlugChange}
            placeholder="system-ram"
            error={Boolean(fieldErrors.slug)}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Data Type" htmlFor="attr-type" required hint={TYPE_HINT[dataType]}>
          <select
            id="attr-type"
            value={dataType}
            onChange={(event) => setDataType(event.target.value as AttributeDataType)}
            className={inputClass()}
          >
            {ATTRIBUTE_DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </FormField>

        {dataType === 'number' && (
          <FormField
            label="Unit"
            htmlFor="attr-unit"
            hint="Kept out of the value so a numeric filter can compare figures."
          >
            <input
              id="attr-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              placeholder="GB"
              maxLength={20}
              className={inputClass()}
            />
          </FormField>
        )}
      </div>

      {losesOptions && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-px" />
          <span className="font-bold leading-snug">
            Changing the type away from Select discards all {editing?.options.length} option(s) —
            and with them the answer on every one of the {editing?.valueCount} product(s) that
            chose one.
          </span>
        </div>
      )}

      {dataType === 'select' && (
        <FormField
          label="Options"
          required
          error={fieldErrors.options}
          hint="These become the checkboxes in the shop sidebar. Renaming one here updates every product that chose it."
        >
          <OptionRows options={options} onChange={setOptions} makeKey={() => genAdminId('opt')} />
        </FormField>
      )}

      <FormField
        label="Description"
        htmlFor="attr-description"
        hint="Internal note for whoever fills this in on a product."
      >
        <textarea
          id="attr-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          maxLength={300}
          className={inputClass()}
        />
      </FormField>

      <FormField
        label="Applicable Categories"
        hint="Only these categories offer this attribute on the product form. Select none to apply it everywhere — right for something like Warranty Type."
      >
        <ChipSelect
          options={chips}
          selected={categoryIds}
          onToggle={(id) =>
            setCategoryIds((current) =>
              current.includes(Number(id))
                ? current.filter((categoryId) => categoryId !== Number(id))
                : [...current, Number(id)],
            )
          }
          emptyLabel="Add a category first, or leave this empty to apply the attribute everywhere."
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          label="Display Order"
          htmlFor="attr-order"
          className="md:col-span-1"
          hint="Lower sorts first in the sidebar."
        >
          <input
            id="attr-order"
            type="number"
            min={0}
            value={displayOrder}
            onChange={(event) => setDisplayOrder(event.target.value)}
            className={inputClass()}
          />
        </FormField>
      </div>

      <div className="space-y-2">
        <ToggleRow
          label="Filterable"
          description="Shown as a facet in the storefront shop sidebar. Turn off for a spec nobody browses by, like Box Contents."
          checked={isFilterable}
          onChange={setIsFilterable}
        />
        <ToggleRow
          label="Active"
          description="Turning this off removes the attribute from the product form and the sidebar, and leaves existing product values untouched."
          checked={isActive}
          onChange={setIsActive}
        />
      </div>
    </RegistryModal>
  );
};
