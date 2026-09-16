// lib/storage/upload.ts
//
// Validation and the actual put/delete/sign calls. Server-only.

import 'server-only';

import { randomUUID } from 'node:crypto';

import { storageAdmin } from './admin';
import { UPLOAD_RULES, formatBytes, type PurposeRule, type UploadPurpose } from './buckets';

export interface StoredObject {
  bucket: string;
  path: string;
  /** Public CDN URL, or a signed URL for a private bucket. */
  url: string;
  mimeType: string;
  size: number;
}

export type UploadResult =
  | { ok: true; object: StoredObject }
  | { ok: false; error: string; status: number };

/**
 * Canonical extension per accepted type.
 *
 * Derived from the *sniffed* type, never from the uploaded filename — a name like
 * `photo.php.jpg` or `../../evil.svg` must not be able to influence the stored
 * path or its extension.
 */
const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'application/pdf': 'pdf',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const asciiAt = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

/**
 * Identifies a file from its leading bytes.
 *
 * The browser-supplied `file.type` is attacker-controlled: anyone can POST a
 * multipart part claiming `image/png` while the body is HTML or a script. Since
 * `media` and `avatars` are public buckets served straight off the CDN, trusting
 * that header would let someone host arbitrary content on your domain. The
 * content is checked instead, and a file whose real type disagrees is rejected.
 *
 * Returns null when the bytes match nothing known.
 */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (asciiAt(bytes, 0, 4) === 'GIF8') return 'image/gif';
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return 'image/x-icon';
  if (asciiAt(bytes, 0, 4) === '%PDF') return 'application/pdf';

  // RIFF container: bytes 0-3 "RIFF", 8-11 the form type.
  if (asciiAt(bytes, 0, 4) === 'RIFF' && asciiAt(bytes, 8, 4) === 'WEBP') return 'image/webp';

  // ISO-BMFF: 4-7 is "ftyp", 8-11 the major brand.
  if (asciiAt(bytes, 4, 4) === 'ftyp') {
    const brand = asciiAt(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  return null;
}

/** ICO has two MIME spellings; treat them as one so the allowlist check is stable. */
const canonical = (mime: string): string =>
  mime === 'image/vnd.microsoft.icon' ? 'image/x-icon' : mime;

const matches = (sniffed: string, allowed: readonly string[]): boolean =>
  allowed.some((type) => canonical(type) === canonical(sniffed));

/**
 * Validates and stores one file.
 *
 * `scope` is appended to the folder — used to pin an avatar to its owner's id, so
 * the path cannot be steered at another user's object.
 */
export async function putObject(
  file: File,
  purpose: UploadPurpose,
  scope?: string,
): Promise<UploadResult> {
  const rule: PurposeRule = UPLOAD_RULES[purpose];

  if (file.size === 0) {
    return { ok: false, error: 'The file is empty.', status: 400 };
  }

  if (file.size > rule.maxBytes) {
    return {
      ok: false,
      error: `${rule.label} must be ${formatBytes(rule.maxBytes)} or smaller.`,
      status: 413,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMimeType(bytes);

  if (!sniffed) {
    return {
      ok: false,
      error: 'Unrecognised file type. Upload a JPEG, PNG, WebP, AVIF, GIF or PDF.',
      status: 415,
    };
  }

  if (!matches(sniffed, rule.mimeTypes)) {
    return {
      ok: false,
      error: `${rule.label} does not accept ${sniffed} files.`,
      status: 415,
    };
  }

  // A random name means an upload can never overwrite an unrelated object, and
  // nothing the client sent ends up in the path.
  const extension = EXTENSION[canonical(sniffed)] ?? 'bin';
  const folder = [rule.prefix, scope].filter(Boolean).join('/');
  const path = `${folder ? `${folder}/` : ''}${randomUUID()}.${extension}`;

  const { error } = await storageAdmin()
    .storage.from(rule.bucket)
    .upload(path, bytes, {
      // The sniffed type, not the client's claim — this header is what the CDN
      // serves the object with.
      contentType: canonical(sniffed),
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    console.error('Storage upload failed:', error);
    return { ok: false, error: 'Could not store the file. Please try again.', status: 502 };
  }

  const url = rule.isPublic
    ? storageAdmin().storage.from(rule.bucket).getPublicUrl(path).data.publicUrl
    : ((await signObjectUrl(rule.bucket, path)) ?? '');

  return {
    ok: true,
    object: { bucket: rule.bucket, path, url, mimeType: canonical(sniffed), size: file.size },
  };
}

/** Time-limited read URL for an object in the private `documents` bucket. */
export async function signObjectUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await storageAdmin()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error('Could not sign storage URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function removeObject(bucket: string, path: string): Promise<boolean> {
  const { error } = await storageAdmin().storage.from(bucket).remove([path]);
  if (error) {
    console.error('Storage delete failed:', error);
    return false;
  }
  return true;
}

/**
 * Recovers the bucket and path from a stored public URL.
 *
 * Needed because the database columns hold a URL, not a bucket/path pair, so
 * deleting a replaced image means parsing it back out. Returns null for anything
 * that is not a URL into this project's Storage — which is also what stops a
 * caller from using the delete endpoint against an arbitrary host.
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;

  let parsed: URL;
  let expected: URL;
  try {
    parsed = new URL(url);
    expected = new URL(base);
  } catch {
    return null;
  }

  if (parsed.host !== expected.host) return null;

  // /storage/v1/object/public/<bucket>/<path...>
  // /storage/v1/object/sign/<bucket>/<path...>
  const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
  if (!match) return null;

  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}
