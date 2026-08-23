// lib/validation/parse.ts
//
// One place to turn an untrusted JSON body into a typed value, so route handlers
// never reach into `body.whatever` and hope. Anything a schema does not mention
// is dropped rather than forwarded to Drizzle — that is what stopped
// `PUT /api/users/:id` from accepting `{ role: 'admin' }`.

import { NextResponse } from 'next/server';
import type { z } from 'zod';

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Flattens Zod issues into `field: message` strings the UI can show as-is. */
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: formatIssues(parsed.error) },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/** Same contract for query strings, which arrive as strings and need coercion. */
export function parseQuery<S extends z.ZodType>(
  url: string,
  schema: S,
): ParseResult<z.infer<S>> {
  const params = Object.fromEntries(new URL(url).searchParams.entries());
  const parsed = schema.safeParse(params);

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid query parameters', details: formatIssues(parsed.error) },
        { status: 400 },
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
