-- 0003_storage_buckets.sql
--
-- Creates the three Storage buckets the admin console uploads into.
--
-- IMPORTANT — why there are no INSERT/UPDATE/DELETE policies here:
-- this application does not use Supabase Auth. Sessions are its own JWT
-- (`lib/auth/utils.ts`, signed with JWT_SECRET, carried in an httpOnly cookie),
-- so inside Storage RLS `auth.uid()` and `auth.role()` are NULL for every real
-- user of this app. Policies keyed on them cannot authorise anything.
--
-- Therefore writes are deliberately impossible with the anon key: no write policy
-- exists, so RLS denies them. All writes go through Next route handlers that use
-- the service_role key (which bypasses RLS) and enforce authorisation with the
-- app's own `withRole([...])` middleware. Adding a permissive write policy here
-- would let anyone holding the public anon key upload to your buckets.
--
-- Reads: `media` and `avatars` are public, so objects are served straight from
-- the Storage CDN with no policy needed. `documents` is private and is only ever
-- read through a short-lived signed URL minted server-side.

-- 10 MB / 2 MB.
-- SVG is intentionally absent from every allowlist: it is an active-content
-- format (it can carry <script>) and there is no sanitiser in this stack. PNG,
-- WebP and ICO cover logos and favicons.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'media', 'media', true, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/avif','image/gif','image/x-icon','image/vnd.microsoft.icon']
  ),
  (
    'avatars', 'avatars', true, 2097152,
    ARRAY['image/jpeg','image/png','image/webp','image/avif']
  ),
  (
    'documents', 'documents', false, 10485760,
    ARRAY['image/jpeg','image/png','image/webp','image/avif','application/pdf']
  )
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
