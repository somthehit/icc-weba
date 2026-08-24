'use client';

// components/admin/catalog/primitives.tsx
//
// The pieces the four catalogue taxonomy editors share.
//
// These reproduce the layout and interactions of the supplied catalogue mock —
// modal shell with overlay/Escape dismissal, pill toggles, chip multi-select,
// colour swatch picker, repeatable option rows, slug-that-tracks-the-name — but
// styled in the admin console's own language (`bg-[#0056b3]`, `rounded-xl`,
// `rounded-3xl` panels, `text-xs font-bold`) rather than the mock's palette, so
// Catalog looks like the other ten modules beside it.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';

import { SLUG_MAX_LENGTH, slugify, uniqueSlug, validateSlug } from '@/lib/catalog/slug';

/* ------------------------------------------------------------------- panels */

/**
 * The white card every sub-tab sits in, with its heading and primary action.
 * Extracted because all four panels had it copied, and a fifth copy is where the
 * headings start drifting apart.
 */
export const PanelShell: React.FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, actionLabel, onAction, children }) => (
  <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 shadow-sm">
    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-3">
      <div>
        <h3 className="font-extrabold text-base text-[#1a1a1a]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-[#0056b3] hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 self-start sm:self-auto transition-transform active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
    {children}
  </div>
);

/** A small status pill. `tone` maps to a static class set — Tailwind can't build one. */
export const Chip: React.FC<{
  tone: 'emerald' | 'blue' | 'violet' | 'gray' | 'amber';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const tones = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    violet: 'text-violet-700 bg-violet-50 border-violet-200',
    gray: 'text-gray-600 bg-gray-100 border-gray-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
  } as const;
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

/** The slug/key chip shown under a row name. */
export const SlugChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
    {children}
  </code>
);

export const IconAction: React.FC<{
  label: string;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, tone = 'neutral', disabled, onClick, children }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`p-1.5 rounded-lg border border-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      tone === 'danger'
        ? 'text-rose-600 hover:bg-rose-50 hover:border-rose-200'
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

/** Shown in place of the row list while the first fetch is in flight or empty. */
export const PanelPlaceholder: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="py-10 text-center text-xs font-bold text-gray-400">{children}</div>
);

/** A failed fetch or mutation, stated rather than swallowed. */
export const PanelError: React.FC<{ message: string; onRetry?: () => void }> = ({
  message,
  onRetry,
}) => (
  <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
    <span>{message}</span>
    {onRetry && (
      <button onClick={onRetry} className="underline whitespace-nowrap">
        Try again
      </button>
    )}
  </div>
);

/* -------------------------------------------------------------------- modal */

/**
 * The add/edit dialog shell.
 *
 * Mirrors the product modal already in AdminView (same overlay, radius, footer)
 * and adds the mock's two dismissal routes: clicking the backdrop and pressing
 * Escape. The backdrop handler checks the event target so a click that started
 * inside the card doesn't close it.
 */
export const AdminModal: React.FC<{
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
  error?: string | null;
  children: React.ReactNode;
}> = ({ title, submitLabel, onClose, onSubmit, isSaving, error, children }) => {
  const headingId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="bg-white rounded-3xl p-6 max-w-2xl w-full my-8 space-y-4 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto text-xs"
      >
        <div className="flex justify-between items-center border-b pb-3">
          <h3 id={headingId} className="font-extrabold text-base text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-gray-400 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}

          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 font-bold text-rose-700">
              {error}
            </p>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border rounded-xl font-bold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#0056b3] text-white font-bold rounded-xl shadow-md hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------- fields */

export const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, error, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block font-bold mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1 font-bold text-rose-600">{error}</p>
    ) : (
      hint && <p className="mt-1 text-gray-500">{hint}</p>
    )}
  </div>
);

export const INPUT_CLASS = 'w-full p-2.5 border rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#0056b3]';
export const MONO_INPUT_CLASS = `${INPUT_CLASS} font-mono text-[11px]`;

/** A labelled pill switch, as in the mock's "Active Menu Item" / "Featured" rows. */
export const ToggleSwitch: React.FC<{
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, hint, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50/60 px-4 py-3">
    <div>
      <div className="font-bold text-gray-900">{label}</div>
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-[#0056b3]' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  </div>
);

/** Toggleable chips — the mock's "Applicable Categories" picker. */
export const ChipMultiSelect: React.FC<{
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  emptyLabel?: string;
}> = ({ options, selected, onChange, emptyLabel = 'No categories available yet.' }) => {
  if (options.length === 0) {
    return <p className="text-gray-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isOn}
            onClick={() =>
              onChange(
                isOn ? selected.filter((v) => v !== option.value) : [...selected, option.value],
              )
            }
            className={`px-3 py-1.5 rounded-xl border font-bold transition-colors ${
              isOn
                ? 'bg-[#0056b3] text-white border-[#0056b3]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Static class sets per badge colour.
 *
 * Written out rather than interpolated (`bg-${color}-500`): Tailwind scans source
 * for literal class names, so a computed one is simply never generated and the
 * swatch renders colourless.
 */
export const BADGE_COLOR_CLASSES: Record<string, { solid: string; chip: string }> = {
  blue: { solid: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  indigo: { solid: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  violet: { solid: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  emerald: { solid: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amber: { solid: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  rose: { solid: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/** Falls back to blue so an unknown colour still renders a visible dot. */
export const badgeClasses = (color: string) => BADGE_COLOR_CLASSES[color] ?? BADGE_COLOR_CLASSES.blue;

export const ColorSwatchPicker: React.FC<{
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}> = ({ colors, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {colors.map((color) => (
      <button
        key={color}
        type="button"
        aria-label={color}
        aria-pressed={color === value}
        onClick={() => onChange(color)}
        className={`w-8 h-8 rounded-full ${badgeClasses(color).solid} transition-transform ${
          color === value
            ? 'ring-2 ring-offset-2 ring-[#0056b3] scale-105'
            : 'hover:scale-105 opacity-80 hover:opacity-100'
        }`}
      />
    ))}
  </div>
);

/** Repeatable text rows — the mock's option list for a `select` attribute. */
export const OptionListEditor: React.FC<{
  options: string[];
  onChange: (options: string[]) => void;
}> = ({ options, onChange }) => (
  <div className="space-y-2">
    {options.map((option, index) => (
      <div key={index} className="flex items-center gap-2">
        <input
          type="text"
          value={option}
          onChange={(event) => {
            const next = [...options];
            next[index] = event.target.value;
            onChange(next);
          }}
          placeholder={`Option ${index + 1}`}
          className={INPUT_CLASS}
        />
        <IconAction
          label={`Remove option ${index + 1}`}
          tone="danger"
          onClick={() => onChange(options.filter((_, i) => i !== index))}
        >
          <Trash2 className="w-4 h-4" />
        </IconAction>
      </div>
    ))}
    <button
      type="button"
      onClick={() => onChange([...options, ''])}
      className="flex items-center gap-1 font-bold text-[#0056b3] hover:underline"
    >
      <Plus className="w-3.5 h-3.5" />
      <span>Add option</span>
    </button>
  </div>
);

/* --------------------------------------------------------------- slug field */

/**
 * A slug that tracks the name until somebody types their own.
 *
 * The same rule the SKU field follows in AdminView, for the same reason: a slug
 * already indexed by Google must not silently change because a typo in the title
 * was fixed. So the suggestion is only offered while creating (`initial` empty)
 * and stops the instant the field is touched.
 */
export function useSlugField(options: {
  source: string;
  initial?: string;
  taken: Iterable<string>;
  maxLength?: number;
}): {
  slug: string;
  setSlug: (value: string) => void;
  isEdited: boolean;
  error: string | null;
} {
  const { source, initial = '', taken, maxLength = SLUG_MAX_LENGTH } = options;
  const [typed, setTyped] = useState(initial);
  const [isEdited, setIsEdited] = useState(Boolean(initial));

  const takenList = useMemo(() => Array.from(taken), [taken]);

  const suggestion = useMemo(() => {
    if (isEdited) return '';
    const base = slugify(source).slice(0, maxLength);
    return base ? uniqueSlug(base, takenList, maxLength) : '';
  }, [isEdited, source, takenList, maxLength]);

  const slug = isEdited ? typed : suggestion;

  return {
    slug,
    setSlug: (value: string) => {
      setIsEdited(true);
      setTyped(value);
    },
    isEdited,
    // Only complain about a value somebody actually chose; an empty suggestion on
    // an untouched form is just a name that hasn't been typed yet.
    error: slug ? validateSlug(slug, takenList, maxLength) : null,
  };
}
