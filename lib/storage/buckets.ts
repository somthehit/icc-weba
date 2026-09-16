// lib/storage/buckets.ts
//
// The single source of truth for what may be uploaded, where it lands, and who
// is allowed to put it there.
//
// Keeping this as data rather than scattering it through route handlers means the
// API route, the validator and the admin UI all agree on the limits — and adding
// a new upload target is one entry here instead of a new endpoint.

import type { UserRole } from '@/lib/auth/middleware';

export type BucketId = 'media' | 'avatars' | 'documents';

/** What the file is for. Chooses the bucket, the path prefix and the rules. */
export type UploadPurpose =
  | 'product'
  | 'banner'
  | 'branding'
  | 'category'
  | 'brand'
  | 'avatar'
  | 'service-attachment'
  | 'payment-proof'
  | 'review';
  

export interface PurposeRule {
  bucket: BucketId;
  /** Folder inside the bucket. `avatar` appends the user id at upload time. */
  prefix: string;
  maxBytes: number;
  mimeTypes: readonly string[];
  /**
   * Roles permitted to upload. `null` means any signed-in user, which is only
   * used by `avatar` — and that one is additionally pinned to the caller's own
   * folder, so one customer cannot overwrite another's picture.
   */
  roles: readonly UserRole[] | null;
  /** A private object is never public-readable; it is served via a signed URL. */
  isPublic: boolean;
  label: string;
}

const MB = 1024 * 1024;

/**
 * Raster image types accepted everywhere.
 *
 * SVG is deliberately excluded. It is an active-content format — an `<svg>` can
 * carry `<script>` — and nothing in this stack sanitises it. PNG, WebP and ICO
 * cover logos and favicons, so allowing it would add an XSS/phishing vector for
 * no capability gain.
 */
const RASTER = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

const ICON = ['image/png', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'] as const;

const STAFF_CATALOG: readonly UserRole[] = ['admin', 'sales', 'inventory_manager'];

export const UPLOAD_RULES: Record<UploadPurpose, PurposeRule> = {
  product: {
    bucket: 'media',
    prefix: 'products',
    maxBytes: 5 * MB,
    mimeTypes: RASTER,
    roles: STAFF_CATALOG,
    isPublic: true,
    label: 'Product image',
  },
  banner: {
    bucket: 'media',
    prefix: 'banners',
    // Hero art is wide (1920x600), so it gets more headroom than a thumbnail.
    maxBytes: 8 * MB,
    mimeTypes: RASTER,
    roles: ['admin'],
    isPublic: true,
    label: 'Banner image',
  },
  branding: {
    bucket: 'media',
    prefix: 'branding',
    maxBytes: 2 * MB,
    mimeTypes: [...RASTER, ...ICON],
    roles: ['admin'],
    isPublic: true,
    label: 'Logo / favicon / OG image',
  },
  category: {
    bucket: 'media',
    prefix: 'categories',
    maxBytes: 3 * MB,
    mimeTypes: RASTER,
    roles: STAFF_CATALOG,
    isPublic: true,
    label: 'Category image',
  },
  brand: {
    bucket: 'media',
    prefix: 'brands',
    maxBytes: 2 * MB,
    mimeTypes: RASTER,
    roles: STAFF_CATALOG,
    isPublic: true,
    label: 'Brand logo',
  },
  avatar: {
    bucket: 'avatars',
    prefix: '',
    maxBytes: 2 * MB,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    roles: null,
    isPublic: true,
    label: 'Profile picture',
  },
  'service-attachment': {
    bucket: 'documents',
    prefix: 'service',
    maxBytes: 10 * MB,
    mimeTypes: [...RASTER, 'application/pdf'],
    roles: ['admin', 'service_technician', 'sales'],
    isPublic: false,
    label: 'Service attachment',
  },
  'payment-proof': {
    bucket: 'documents',
    prefix: 'payments',
    maxBytes: 5 * MB,
    mimeTypes: [...RASTER, 'application/pdf'],
    roles: ['admin', 'sales'],
    isPublic: false,
    label: 'Payment proof',
  },
  review: {
    bucket: 'media',
    prefix: 'reviews',
    maxBytes: 5 * MB,
    mimeTypes: RASTER,
    roles: null,
    isPublic: true,
    label: 'Review image',
  },
};

export const isUploadPurpose = (value: unknown): value is UploadPurpose =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(UPLOAD_RULES, value);

/** `5 MB`, `800 KB` — for limit messages in the UI. */
export const formatBytes = (bytes: number): string =>
  bytes >= MB ? `${Math.round(bytes / MB)} MB` : `${Math.round(bytes / 1024)} KB`;
