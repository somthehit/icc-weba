// lib/db/errors.ts
//
// Turning Postgres constraint violations into the right HTTP status. Without
// this a duplicate SKU or a bad foreign key surfaces as a 500, which reads as
// "the server is broken" when the caller simply sent something that clashes.

/** https://www.postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Drizzle wraps driver errors, so the pg error code can sit one or two `cause`
 * levels down rather than on the error itself.
 */
function pgErrorCode(error: unknown, depth = 0): string | null {
  if (!error || typeof error !== 'object' || depth > 3) return null;

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code;

  return pgErrorCode((error as { cause?: unknown }).cause, depth + 1);
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === FOREIGN_KEY_VIOLATION;
}
