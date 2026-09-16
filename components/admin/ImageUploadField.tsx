'use client';

// components/admin/ImageUploadField.tsx
//
// Drop-in replacement for the URL text inputs the admin forms used.
//
// It still *stores a URL* — the value handed back to the parent is the public
// Storage URL — so nothing about the database columns or the API payloads has to
// change. What changes is how that URL comes into existence: the user picks or
// drops a file, it goes to `/api/v1/uploads`, and the returned URL is set.
//
// Pasting a URL is still supported. Some images legitimately live elsewhere
// (a supplier's CDN), and removing that ability would be a regression.

import React, { useCallback, useRef, useState } from 'react';

import { formatBytes, UPLOAD_RULES, type UploadPurpose } from '@/lib/storage/buckets';

import { AlertTriangle, Link2, Loader2, Trash2, Upload, X } from 'lucide-react';

export interface ImageUploadFieldProps {
  label: string;
  value: string | undefined;
  onChange: (url: string) => void;
  purpose: UploadPurpose;
  /** Shown under the field — e.g. the expected pixel dimensions. */
  hint?: string;
  /** Deletes the old object from Storage when the value is replaced or cleared. */
  deleteOnReplace?: boolean;
  className?: string;
}

export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label,
  value,
  onChange,
  purpose,
  hint,
  deleteOnReplace = false,
  className = '',
}) => {
  const rule = UPLOAD_RULES[purpose];
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  /** Preview failures are tracked so a dead URL shows a placeholder, not a broken icon. */
  const [previewBroken, setPreviewBroken] = useState(false);

  const accept = rule.mimeTypes.join(',');

  /**
   * Best-effort cleanup of the object being replaced.
   *
   * Deliberately not awaited into the happy path: if the delete fails the new
   * image is still saved, and an orphaned object is a much smaller problem than
   * blocking the edit. Only ever fires for URLs in our own Storage — the endpoint
   * rejects anything else.
   */
  const discard = useCallback((url: string) => {
    if (!deleteOnReplace || !url) return;
    void fetch(`/api/v1/uploads?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).catch(
      () => {},
    );
  }, [deleteOnReplace]);

  const upload = useCallback(
    async (file: File) => {
      setError('');

      // Checked here as well as server-side purely for a faster message; the
      // server repeats it (and sniffs the bytes), so this is convenience only.
      if (file.size > rule.maxBytes) {
        setError(`Too large. Maximum is ${formatBytes(rule.maxBytes)}.`);
        return;
      }

      setBusy(true);
      const previous = value;

      try {
        const body = new FormData();
        body.append('file', file);
        body.append('purpose', purpose);

        const response = await fetch('/api/v1/uploads', { method: 'POST', body });
        const raw = await response.text();
        let payload: { url?: string; error?: string } = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          payload = {};
        }

        if (!response.ok || !payload.url) {
          setError(payload.error || `Upload failed (${response.status}).`);
          return;
        }

        setPreviewBroken(false);
        onChange(payload.url);
        if (previous && previous !== payload.url) discard(previous);
      } catch {
        setError('Could not reach the upload service.');
      } finally {
        setBusy(false);
      }
    },
    [discard, onChange, purpose, rule.maxBytes, value],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const clear = () => {
    if (value) discard(value);
    onChange('');
    setPreviewBroken(false);
    setError('');
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <button
          type="button"
          onClick={() => setShowUrlInput((v) => !v)}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
          title="Paste an external URL instead of uploading"
        >
          <Link2 className="h-3 w-3" />
          {showUrlInput ? 'Hide URL' : 'Use URL'}
        </button>
      </div>

      {/* Filled state — preview with replace/remove */}
      {value && !previewBroken ? (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote
              hosts are allowed here (pasted supplier URLs), which next/image would
              reject unless every host were whitelisted in next.config. */}
          <img
            src={value}
            alt={label}
            onError={() => setPreviewBroken(true)}
            className="h-32 w-full bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] object-contain"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
            <span className="truncate text-[10px] font-medium text-white/80">
              {value.split('/').pop()}
            </span>
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-bold text-slate-900 hover:bg-white disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clear}
                className="rounded-lg bg-rose-600/90 p-1 text-white hover:bg-rose-600"
                title="Remove"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            </div>
          )}
        </div>
      ) : (
        /* Empty state — dropzone */
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition-colors ${
            dragging
              ? 'border-slate-900 bg-slate-100'
              : 'border-slate-200 bg-slate-50 hover:border-slate-400'
          } disabled:opacity-60`}
        >
          {busy ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-[11px] font-bold text-slate-500">Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-600">
                Click or drop an image
              </span>
              <span className="text-[10px] text-slate-400">
                {formatBytes(rule.maxBytes)} max
                {previewBroken && value ? ' · previous image did not load' : ''}
              </span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          // Reset so picking the same file twice still fires a change event.
          e.target.value = '';
        }}
      />

      {showUrlInput && (
        <div className="relative">
          <input
            type="url"
            value={value ?? ''}
            onChange={(e) => {
              setPreviewBroken(false);
              onChange(e.target.value);
            }}
            placeholder="https://example.com/image.jpg"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs outline-none focus:border-slate-900"
          />
          {value && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {hint && !error && <p className="text-[10px] text-slate-400">{hint}</p>}

      {error && (
        <p className="flex items-start gap-1 text-[10px] font-bold text-rose-600">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
};

export interface UploadButtonProps {
  purpose: UploadPurpose;
  /** Receives one URL per selected file, in the order they were picked. */
  onUploaded: (urls: string[]) => void;
  multiple?: boolean;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Compact upload trigger for places that already have their own layout — the
 * product gallery repeater, which owns alt text, ordering and the primary flag,
 * so `ImageUploadField`'s preview card would fight with it.
 *
 * Reports failures inline via `title` and a red ring rather than rendering its own
 * error paragraph, since it is meant to sit inside a row.
 */
export const UploadButton: React.FC<UploadButtonProps> = ({
  purpose,
  onUploaded,
  multiple = false,
  title,
  children,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');

  const rule = UPLOAD_RULES[purpose];

  const send = async (files: File[]) => {
    setBusy(true);
    setFailed('');
    const urls: string[] = [];
    const problems: string[] = [];

    // Sequential rather than parallel: a bulk gallery drop of ten files would
    // otherwise open ten concurrent uploads and the ordering of the resulting
    // rows would be nondeterministic.
    for (const file of files) {
      try {
        const body = new FormData();
        body.append('file', file);
        body.append('purpose', purpose);
        const response = await fetch('/api/v1/uploads', { method: 'POST', body });
        const raw = await response.text();
        let payload: { url?: string; error?: string } = {};
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          payload = {};
        }
        if (response.ok && payload.url) urls.push(payload.url);
        else problems.push(`${file.name}: ${payload.error || response.status}`);
      } catch {
        problems.push(`${file.name}: network error`);
      }
    }

    setBusy(false);
    if (urls.length) onUploaded(urls);
    if (problems.length) setFailed(problems.join(' · '));
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title={failed || title || `Upload (${formatBytes(rule.maxBytes)} max)`}
        className={`${className} ${failed ? 'ring-1 ring-rose-400' : ''} disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          children ?? <Upload className="h-3.5 w-3.5" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={rule.mimeTypes.join(',')}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void send(files);
          e.target.value = '';
        }}
      />
    </>
  );
};
