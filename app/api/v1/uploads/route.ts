import { NextResponse } from 'next/server';

import { withAuth, STAFF_ROLES, type UserRole } from '@/lib/auth/middleware';
import {
  UPLOAD_RULES,
  formatBytes,
  isUploadPurpose,
  type UploadPurpose,
} from '@/lib/storage/buckets';
import { parseStorageUrl, putObject, removeObject } from '@/lib/storage/upload';

/**
 * Upload endpoint for every image and document in the app.
 *
 * Authorisation lives here rather than in Storage RLS on purpose: this app signs
 * its own JWTs instead of using Supabase Auth, so `auth.uid()` is NULL inside
 * Storage policies and RLS cannot identify the caller. The buckets consequently
 * have no write policy at all — the only write path is this route, which holds
 * the service_role key and checks the session itself.
 *
 * `withAuth` establishes that there *is* a session; the per-purpose role check
 * below is what decides whether this particular caller may write this particular
 * kind of file.
 */

const allowed = (purpose: UploadPurpose, role: UserRole): boolean => {
  const roles = UPLOAD_RULES[purpose].roles;
  // `null` = any signed-in user. Only `avatar` uses it, and that upload is
  // additionally scoped to the caller's own folder below.
  return roles === null ? true : roles.includes(role);
};

export const POST = withAuth(async (request, { user }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Expected a multipart/form-data body.' },
      { status: 400 },
    );
  }

  const purpose = form.get('purpose');
  if (!isUploadPurpose(purpose)) {
    return NextResponse.json(
      { error: `Unknown upload purpose. Expected one of: ${Object.keys(UPLOAD_RULES).join(', ')}.` },
      { status: 400 },
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
  }

  const role = user.role as UserRole;
  if (!allowed(purpose, role)) {
    return NextResponse.json(
      { error: 'Your role cannot upload this kind of file.' },
      { status: 403 },
    );
  }

  // An avatar always lands under the caller's own id, so a signed-in customer
  // cannot aim the write at somebody else's folder.
  const scope = purpose === 'avatar' ? String(user.userId) : undefined;

  const result = await putObject(file, purpose, scope);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, ...result.object }, { status: 201 });
});

/**
 * Removes a previously uploaded object, addressed by the URL that was stored.
 *
 * Staff only. `parseStorageUrl` rejects anything that is not a URL into this
 * project's Storage, so this cannot be pointed at another host, and customers are
 * excluded outright rather than being trusted to only delete their own avatar.
 */
export const DELETE = withAuth(async (request, { user }) => {
  if (!STAFF_ROLES.includes(user.role as UserRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const url = new URL(request.url).searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Provide the object url to remove.' }, { status: 400 });
  }

  const target = parseStorageUrl(url);
  if (!target) {
    return NextResponse.json(
      { error: 'That url does not point at this project\u2019s storage.' },
      { status: 400 },
    );
  }

  const removed = await removeObject(target.bucket, target.path);
  if (!removed) {
    return NextResponse.json({ error: 'Could not remove the file.' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
});

/** Lets the UI show the real limits without duplicating them client-side. */
export const GET = withAuth(async () =>
  NextResponse.json({
    purposes: Object.fromEntries(
      Object.entries(UPLOAD_RULES).map(([key, rule]) => [
        key,
        {
          label: rule.label,
          maxBytes: rule.maxBytes,
          maxLabel: formatBytes(rule.maxBytes),
          mimeTypes: rule.mimeTypes,
          isPublic: rule.isPublic,
        },
      ]),
    ),
  }),
);
