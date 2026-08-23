// lib/api/storefront.ts
//
// Typed browser-side calls to the storefront APIs.
//
// Every one of these endpoints already refuses to trust the client: prices come
// from `products`, delivery fees from `delivery_zones`, coupon terms from
// `coupons`, and an address id that isn't yours reads back as "not found". So
// there is deliberately no money arithmetic in this file — it moves requests and
// hands back what the server said.
//
// Errors are returned rather than thrown. A failed coupon or an out-of-stock line
// is a normal outcome the form has to show, not an exception.

import type {
  AddressInput,
  CartQuote,
  DeliveryZoneOption,
  PaymentMethod,
  SavedAddress,
} from '@/types';
import type { DbOrderDetail } from '@/lib/adapters/orders';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The message the API gave, or something honest about the network. */
async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      ...init,
      headers:
        init?.body !== undefined
          ? { 'Content-Type': 'application/json', ...init?.headers }
          : init?.headers,
    });

    // Some failures (a 502 from a proxy, say) aren't JSON at all.
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const details = Array.isArray(payload?.details) ? payload.details.join(' · ') : null;
      return {
        ok: false,
        error: details || payload?.error || `Request failed (${response.status})`,
      };
    }

    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: 'Network error. Please check your connection and try again.' };
  }
}

/* -------------------------------------------------------------------- cart */

/**
 * One `cart_items` row as `GET /api/cart` returns it, joined to its product.
 *
 * `unitPrice` is the product's price *now*; `priceAtAdd` is what it cost when the
 * line was added. The cart shows the current price — and the order is priced from
 * the database again — so a price change between visits can't be exploited in
 * either direction.
 */
export interface ServerCartRow {
  id: number;
  quantity: number;
  productId: number | null;
  variantId: number | null;
  priceAtAdd: string | number;
  productName: string | null;
  productSlug: string | null;
  productImage: string | null;
  unitPrice: string | number | null;
  stockQuantity: number | null;
  variantName: string | null;
  priceAdjustment: string | number | null;
}

export const fetchCart = () =>
  request<{ cart: { id: number } | null; items: ServerCartRow[] }>('/api/cart');

/** Adds to the existing line's quantity rather than replacing it. */
export const addCartLine = (productId: number, quantity = 1, variantId?: number) =>
  request<{ success: true; cartId: number }>('/api/cart', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, variantId }),
  });

/** Quantity 0 removes the line. */
export const setCartLineQuantity = (cartItemId: number, quantity: number) =>
  request<{ success: true }>('/api/cart', {
    method: 'PUT',
    body: JSON.stringify({ cartItemId, quantity }),
  });

export const deleteCartLine = (cartItemId: number) =>
  request<{ success: true }>(`/api/cart?cartItemId=${cartItemId}`, { method: 'DELETE' });

/* ------------------------------------------------------------------- quote */

/** What `POST /api/orders/quote` sends back, before the numbers are parsed. */
interface RawQuote {
  subtotal: string;
  discountAmount: string;
  deliveryFee: string;
  vatAmount: string;
  totalAmount: string;
  currency: string;
  vatRatePercent: string;
  pricesIncludeVat: boolean;
  freeDeliveryApplied: boolean;
  freeDeliveryThreshold: string;
  couponCode: string | null;
  couponDescription: string | null;
  items: Array<{
    productId: number;
    variantId: number | null;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    listUnitPrice: string;
    lineTotal: string;
    onOffer: boolean;
  }>;
}

const money = (v: string | number | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export interface QuoteRequest {
  /** Price the signed-in customer's saved cart. */
  fromCart?: boolean;
  /** Or price an explicit basket, for a guest cart held in the browser. */
  items?: Array<{ productId: number; variantId?: number; quantity: number }>;
  couponCode?: string;
  deliveryZoneId?: number;
}

/**
 * Price a basket without placing it.
 *
 * This is what the cart and checkout summaries display. The order endpoint runs
 * the same module over the same rows, so the figures shown here are the figures
 * that get written — no client-side `subtotal >= 10000 ? 0 : 250`.
 */
export async function fetchQuote(input: QuoteRequest): Promise<ApiResult<CartQuote>> {
  const result = await request<RawQuote>('/api/orders/quote', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!result.ok) return result;
  const raw = result.data;

  return {
    ok: true,
    data: {
      subtotal: money(raw.subtotal),
      discountAmount: money(raw.discountAmount),
      deliveryFee: money(raw.deliveryFee),
      vatAmount: money(raw.vatAmount),
      totalAmount: money(raw.totalAmount),
      currency: raw.currency,
      vatRatePercent: money(raw.vatRatePercent),
      pricesIncludeVat: raw.pricesIncludeVat,
      freeDeliveryApplied: raw.freeDeliveryApplied,
      freeDeliveryThreshold: money(raw.freeDeliveryThreshold),
      couponCode: raw.couponCode,
      couponDescription: raw.couponDescription,
      lines: (raw.items ?? []).map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        sku: line.sku,
        quantity: line.quantity,
        unitPrice: money(line.unitPrice),
        listUnitPrice: money(line.listUnitPrice),
        lineTotal: money(line.lineTotal),
        onOffer: line.onOffer,
      })),
    },
  };
}

/* --------------------------------------------------------------- addresses */

export async function fetchAddresses(): Promise<ApiResult<SavedAddress[]>> {
  const result = await request<{ addresses: SavedAddress[] }>('/api/addresses');
  if (!result.ok) return result;
  return { ok: true, data: result.data.addresses ?? [] };
}

export const createAddress = (input: Partial<AddressInput>) =>
  request<{ success: true; address: SavedAddress }>('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAddress = (id: number, changes: Partial<AddressInput>) =>
  request<{ success: true; address: SavedAddress }>('/api/addresses', {
    method: 'PUT',
    body: JSON.stringify({ id, ...changes }),
  });

export const deleteAddress = (id: number) =>
  request<{ success: true }>(`/api/addresses?id=${id}`, { method: 'DELETE' });

/* ----------------------------------------------------------- delivery zones */

interface RawZone {
  id: number;
  name: string;
  provinces: string[];
  flatFee: string | number;
  estimatedDays: number;
}

export async function fetchDeliveryZones(): Promise<ApiResult<DeliveryZoneOption[]>> {
  const result = await request<{ zones: RawZone[] }>('/api/delivery-zones');
  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data.zones ?? []).map((zone) => ({
      id: zone.id,
      name: zone.name,
      provinces: zone.provinces ?? [],
      flatFee: money(zone.flatFee),
      estimatedDays: zone.estimatedDays,
    })),
  };
}

/**
 * The cheapest zone that covers a province, or null if none lists it.
 *
 * Only a suggestion for the form's default — `POST /api/orders` looks the fee up
 * again from whichever zone id it is finally given.
 */
export function suggestZone(
  zones: DeliveryZoneOption[],
  province: string | null | undefined,
): DeliveryZoneOption | null {
  if (!province) return null;
  const covering = zones.filter((zone) => zone.provinces.includes(province));
  if (covering.length === 0) return null;
  return covering.reduce((best, zone) => (zone.flatFee < best.flatFee ? zone : best));
}

/* -------------------------------------------------------- payment methods */

/**
 * Which payment methods the shop has switched on.
 *
 * `POST /api/orders` rejects a method whose `payment_method_settings` row is
 * disabled, so offering all four unconditionally would let a customer fill in the
 * whole form and be refused at the last step. Merchant ids and provider secrets
 * are not in this response — the endpoint withholds them from non-staff.
 */
export async function fetchEnabledPaymentMethods(): Promise<ApiResult<PaymentMethod[]>> {
  const result = await request<{
    payments: Array<{ method: string; isEnabled: boolean }>;
  }>('/api/settings?type=payments');
  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data.payments ?? [])
      .filter((row) => row.isEnabled)
      .map((row) => row.method as PaymentMethod),
  };
}

/* -------------------------------------------------------------------- orders */

export interface PlaceOrderRequest {
  fromCart?: boolean;
  items?: Array<{ productId: number; variantId?: number; quantity: number }>;
  shippingAddressId?: number;
  deliveryZoneId?: number;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  customerNote?: string;
}

/**
 * Place the order.
 *
 * Note what is *not* in the body: no prices, no delivery fee, no discount, no
 * total. The endpoint's schema rejects them outright, and every figure on the
 * resulting invoice is computed from the database inside one transaction with the
 * stock decrement and the coupon claim.
 */
export const placeOrderRequest = (input: PlaceOrderRequest) =>
  request<{ success: true; order: DbOrderDetail; items: DbOrderDetail['items'] }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const fetchOrders = (params: { limit?: number; offset?: number } = {}) => {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  const suffix = query.toString();
  return request<{ orders: DbOrderDetail[]; total: number }>(
    suffix ? `/api/orders?${suffix}` : '/api/orders',
  );
};

/** One order with its lines and status history, by database id. */
export const fetchOrder = (id: number) => request<DbOrderDetail>(`/api/orders?id=${id}`);

/** The same, by the human order number the customer quotes (`ICE-2026-00042`). */
export const fetchOrderByNumber = (orderNumber: string) =>
  request<DbOrderDetail>(`/api/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
