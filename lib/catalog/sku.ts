// lib/catalog/sku.ts
//
// SKU derivation for the catalogue admin.
//
// `products.sku` is `varchar(60) NOT NULL` behind a unique index
// (`products_sku_idx`), so a product cannot be written without one and two
// products cannot share one. The add-product form therefore needs a default that
// is always present, always unique, and readable enough that a staff member can
// call it out over the phone — which is what this file produces.
//
// It is only a *suggestion*. The field stays editable, because a shop that
// already has its own SKU scheme should be able to type it in.

/** The DB column is varchar(60). */
export const SKU_MAX_LENGTH = 60;

/**
 * Words that carry no identifying information, so they are dropped rather than
 * eating into the length budget. Deliberately short — "Pro", "Gen", "Max" and
 * the like are kept, because for hardware they are part of the model name.
 */
const NOISE = new Set(['THE', 'AND', 'WITH', 'FOR', 'OF', 'IN', 'ON', 'A', 'AN', 'BY']);

/** Uppercase alphanumeric tokens, in order, noise removed. */
function tokenise(value: string): string[] {
  return value
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((token) => token.length > 0 && !NOISE.has(token));
}

/**
 * A SKU built from the brand and the product title, e.g.
 * `Lenovo` + `Legion Pro 5 Gen 9 — 14th Gen i9` → `LEN-LEGION-PRO-5-GEN`.
 *
 * Brand first so the catalogue sorts by vendor, then the first few title tokens.
 * Returns `''` for an empty brand and title, which the caller should treat as
 * "nothing to suggest yet" rather than as a value.
 */
export function buildSku(brand: string, title: string): string {
  const brandCode = tokenise(brand).join('').slice(0, 3);

  const titleCode = tokenise(title)
    .slice(0, 4)
    .map((token) => token.slice(0, 6))
    .join('-');

  const joined = [brandCode, titleCode].filter(Boolean).join('-');
  return joined.slice(0, SKU_MAX_LENGTH).replace(/-+$/, '');
}

/**
 * `base`, or `base-2`/`base-3`/… if the catalogue already holds it.
 *
 * The comparison is case-insensitive even though the unique index is not: two
 * SKUs differing only in case would be a picking error waiting to happen, so
 * they are treated as the same one.
 *
 * The counter is appended within the 60-character budget, trimming `base` if it
 * has to, so the result is always a legal column value.
 */
export function uniqueSku(base: string, taken: Iterable<string>): string {
  const used = new Set<string>();
  for (const value of taken) {
    if (value) used.add(value.trim().toUpperCase());
  }

  if (!base) return base;
  if (!used.has(base.toUpperCase())) return base;

  // Bounded rather than `while (true)`: 999 collisions on one brand+title means
  // something is wrong upstream, and a runaway loop would freeze the form.
  for (let n = 2; n <= 999; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SKU_MAX_LENGTH - suffix.length)}${suffix}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }

  return base;
}

/**
 * What is wrong with a typed SKU, or null if it is usable.
 *
 * `existing` is every SKU already in the catalogue *except* the one being
 * edited — an edit that leaves the SKU alone must not report it as a duplicate
 * of itself.
 */
export function validateSku(value: string, existing: Iterable<string>): string | null {
  const sku = value.trim();

  if (!sku) return 'A SKU is required — every product needs one to be stocked or sold.';
  if (sku.length > SKU_MAX_LENGTH) return `A SKU can be at most ${SKU_MAX_LENGTH} characters.`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(sku)) {
    return 'A SKU may use letters, numbers, dot, underscore, slash and dash, and must start with a letter or number.';
  }

  const upper = sku.toUpperCase();
  for (const other of existing) {
    if (other && other.trim().toUpperCase() === upper) {
      return `SKU "${sku}" is already used by another product — SKUs must be unique.`;
    }
  }

  return null;
}
