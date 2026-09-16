// components/admin/catalog/primitives.tsx
//
// The pieces the four registry modals share: the modal shell, the slug field that
// tracks the name until someone edits it, and the three specialised controls
// (category chips, colour swatches, option rows).
//
// All module-scope, for the same reason `shared.tsx` gives: a component declared
// inside a render body is a new type on every keystroke, which remounts the input
// under it and loses the caret.

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, Loader2, AlertCircle } from 'lucide-react';

import { inputClass, slugify } from '../shared';

/* ---------------------------------------------------------------- modal shell */

/**
 * Overlay + panel, matching ProductFormModal's shell at a narrower width.
 *
 * Escape closes and a click on the backdrop closes, but a click *inside* does not —
 * `onMouseDown` on the overlay compares the target to the element itself, because a
 * text selection that starts inside the panel and ends on the backdrop fires a
 * `click` on the overlay and would otherwise discard the form mid-edit.
 */
export const RegistryModal: React.FC<{
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  isSaving?: boolean;
  error?: string | null;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, onSubmit, submitLabel, isSaving, error, children }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // The page behind a modal scrolling under the cursor is disorienting, and on
    // mobile it hides the footer buttons entirely.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start md:items-center justify-center p-3 md:p-6 z-50 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="bg-white rounded-3xl w-full max-w-2xl my-4 shadow-2xl border border-gray-200 flex flex-col max-h-[94vh] text-xs"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base text-gray-900 truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -m-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-px" />
              <span className="font-bold leading-snug">{error}</span>
            </div>
          )}
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50/60 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold text-gray-600 border border-gray-200 bg-white hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl font-bold text-white bg-[#0056b3] hover:bg-[#004a99] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isSaving ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------ slug behaviour */

export interface SlugSync {
  slug: string;
  /** Call from the name field; fills the slug only while it is untouched. */
  onNameChange: (name: string) => void;
  /** Call from the slug field; marks it hand-edited from here on. */
  onSlugChange: (slug: string) => void;
}

/**
 * Slug that follows the name until someone types in it.
 *
 * `initialSlug` non-empty means we are editing an existing row, so the field starts
 * dirty: a saved slug is a live URL and a public facet key, and silently rewriting
 * it because the display name was tidied would 404 every link to it.
 */
export function useSlugSync(initialSlug = ''): SlugSync {
  const [slug, setSlug] = useState(initialSlug);
  const dirty = useRef(initialSlug !== '');

  const onNameChange = useCallback((name: string) => {
    if (!dirty.current) setSlug(slugify(name));
  }, []);

  const onSlugChange = useCallback((next: string) => {
    dirty.current = true;
    setSlug(next);
  }, []);

  return { slug, onNameChange, onSlugChange };
}

/** The slug input itself — monospace, because it is a URL fragment, not prose. */
export const SlugInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
}> = ({ id, value, onChange, placeholder, error }) => (
  <input
    id={id}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    placeholder={placeholder}
    className={`${inputClass(error)} font-mono text-[11px]`}
  />
);

/* ------------------------------------------------------------- category chips */

export interface ChipOption {
  id: number | string;
  label: string;
}

/**
 * Multi-select as toggle chips.
 *
 * A chip row instead of a `<select multiple>` because the latter needs Ctrl-click
 * to deselect, which nobody discovers, and shows about four rows before scrolling.
 */
export const ChipSelect: React.FC<{
  options: ChipOption[];
  selected: Array<number | string>;
  onToggle: (id: number | string) => void;
  emptyLabel?: string;
}> = ({ options, selected, onToggle, emptyLabel = 'Nothing to choose from yet.' }) => {
  if (options.length === 0) {
    return <p className="text-[11px] text-gray-500 italic">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isOn = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isOn}
            onClick={() => onToggle(option.id)}
            className={`px-3 py-1.5 rounded-full border font-bold transition-colors ${
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

/* ------------------------------------------------------------------ swatches */

/**
 * The six badge tones, as the Tailwind class pairs the storefront renders.
 *
 * Keyed by the same strings `FILTER_TAG_COLORS` allows, so what is picked here is
 * exactly what the column stores — no mapping table to drift.
 */
export const TAG_TONE: Record<string, { dot: string; badge: string; label: string }> = {
  blue: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800', label: 'Blue' },
  emerald: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800', label: 'Emerald' },
  amber: { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800', label: 'Amber' },
  rose: { dot: 'bg-rose-500', badge: 'bg-rose-100 text-rose-800', label: 'Rose' },
  violet: { dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800', label: 'Violet' },
  slate: { dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700', label: 'Slate' },
};

export const SwatchPicker: React.FC<{
  colors: readonly string[];
  value: string;
  onChange: (color: string) => void;
}> = ({ colors, value, onChange }) => (
  <div className="flex items-center gap-2">
    {colors.map((color) => {
      const tone = TAG_TONE[color] ?? TAG_TONE.blue;
      const isOn = value === color;
      return (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={isOn}
          aria-label={tone.label}
          title={tone.label}
          onClick={() => onChange(color)}
          className={`w-7 h-7 rounded-full ${tone.dot} transition-shadow ${
            isOn ? 'ring-2 ring-offset-2 ring-gray-800' : 'hover:ring-2 hover:ring-gray-300'
          }`}
        />
      );
    })}
  </div>
);

/* --------------------------------------------------------------- option rows */

/**
 * A draft option in the attribute form.
 *
 * `id` is carried through the round trip when it exists — that is what turns a
 * rename into an UPDATE of the existing row rather than a delete-and-insert, which
 * would clear the value off every product that had chosen it.
 */
export interface DraftOption {
  key: string;
  id?: number;
  value: string;
}

export const OptionRows: React.FC<{
  options: DraftOption[];
  onChange: (options: DraftOption[]) => void;
  makeKey: () => string;
}> = ({ options, onChange, makeKey }) => (
  <div className="space-y-2">
    {options.map((option, index) => (
      <div key={option.key} className="flex items-center gap-2">
        <input
          value={option.value}
          onChange={(event) => {
            const next = [...options];
            next[index] = { ...option, value: event.target.value };
            onChange(next);
          }}
          placeholder={`Option ${index + 1}`}
          className={inputClass()}
        />
        <button
          type="button"
          aria-label={`Remove option ${index + 1}`}
          onClick={() => onChange(options.filter((_, i) => i !== index))}
          className="p-2.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}

    <button
      type="button"
      onClick={() => onChange([...options, { key: makeKey(), value: '' }])}
      className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 font-bold hover:border-[#0056b3] hover:text-[#0056b3] transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
      Add Option
    </button>
  </div>
);
