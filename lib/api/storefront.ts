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
  Product,
  SavedAddress,
} from '@/types';
import type { DbOrderDetail } from '@/lib/adapters/orders';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * The message the API gave, or something honest about the network.
 *
 * Exported so the admin helpers in ./catalog-admin.ts share this one
 * implementation — two copies of the error-shaping would drift, and the shape it
 * unwraps (`details` from Zod, then `error`) is the contract every route returns.
 */
export async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
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
  districts?: string[];
  municipalities?: string[];
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
        districts: zone.districts ?? [],
        municipalities: zone.municipalities ?? [],
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

/* -------------------------------------------------------- notifications */

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type?: string;
}

export const fetchNotifications = () =>
  request<{ notifications: NotificationItem[] }>('/api/notifications');

export const markNotificationRead = (id: string) =>
  request<{ success: true }>('/api/notifications', {
    method: 'PUT',
    body: JSON.stringify({ id }),
  });

export const markAllNotificationsRead = () =>
  request<{ success: true }>('/api/notifications', {
    method: 'PUT',
    body: JSON.stringify({ markAll: true }),
  });

/* --------------------------------------------------------- profile / OTP */

export const updateProfile = (input: { name?: string; phone?: string }) =>
  request<{ success: true; user: { id: number; name: string; email: string; phone: string | null } }>('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

export const sendOtp = (phone: string) =>
  request<{ success: true; message: string }>('/api/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });

export const verifyOtp = (phone: string, code: string) =>
  request<{ success: true; message: string }>('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });

/* --------------------------------------------------------- catalog (admin) */

/**
 * What the admin product form sends.
 *
 * Brand and category travel as slugs because that is what `/api/brands` and
 * `/api/categories` publish as their id — the numeric keys never reach the
 * browser. The route resolves them and reports an unknown slug as a 400.
 *
 * `specs` and `images` are replace-in-full: sending them overwrites the
 * product's rows, omitting them leaves those tables untouched.
 */
export interface ProductWriteInput {
  sku: string;
  name: string;
  slug: string;
  brandSlug?: string;
  categorySlug?: string;
  subcategory?: string;
  description?: string;
  shortDescription?: string;
  basePrice: number;
  compareAtPrice?: number;
  costPrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  warrantyMonths?: number;
  warrantyType?: string;
  warrantyText?: string;
  tags?: string[];
  features?: string[];
  whatsInTheBox?: string[];
  metaTitle?: string;
  metaDescription?: string;
  isPhysicalProduct?: boolean;
  requiresShipping?: boolean;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  isFreeShipping?: boolean;
  fixedShippingFee?: number | null;
  status?: 'draft' | 'active' | 'inactive' | 'discontinued';
  isActive?: boolean;
  isFeatured?: boolean;
  isDealOfDay?: boolean;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  specs?: Array<{ specKey: string; specValue: string; displayOrder?: number }>;
  images?: Array<{ url: string; altText?: string; displayOrder?: number; isPrimary?: boolean }>;
}

/**
 * Create a catalog product. Returns the product mapped to the frontend contract,
 * so the caller can drop it straight into state without re-fetching.
 */
export const createProductRequest = (input: ProductWriteInput) =>
  request<{ success: true; product: Product }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });

/** Update a catalog product. Every field is optional — send only what changed. */
export const updateProductRequest = (id: number, input: Partial<ProductWriteInput>) =>
  request<{ success: true; product: Product }>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });

/**
 * Retire a product.
 *
 * The endpoint sets `status = 'discontinued'` rather than deleting the row: a
 * hard delete would cascade into `order_items` and rewrite the history of orders
 * that have already been paid for.
 */
export const archiveProductRequest = (id: number) =>
  request<{ success: true; product: { id: number; status: string } }>(`/api/products/${id}`, {
    method: 'DELETE',
  });

/**
 * The full `products` row plus its gallery and spec sheet, as the admin form
 * needs it.
 *
 * The mapped `Product` the storefront works with deliberately drops a lot of
 * this — cost price, meta tags, the draft/paused distinction, per-image alt text
 * — so an edit form built only from it would blank out every field it could not
 * see. Staff-only, since `costPrice` is what the shop paid its supplier.
 */
export interface AdminProductRow {
  id: number;
  sku: string;
  name: string;
  slug: string;
  brandSlug: string | null;
  categorySlug: string | null;
  subcategory: string | null;
  description: string | null;
  shortDescription: string | null;
  basePrice: string | number;
  compareAtPrice: string | number | null;
  costPrice: string | number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: string;
  warrantyMonths: number | null;
  warrantyType: string | null;
  warrantyText: string | null;
  tags: string[] | null;
  features: string[] | null;
  whatsInTheBox: string[] | null;
  metaTitle: string | null;
  metaDescription: string | null;
  status: 'draft' | 'active' | 'inactive' | 'discontinued';
  isActive: boolean;
  isFeatured: boolean;
  isDealOfDay: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  isPhysicalProduct?: boolean;
  requiresShipping?: boolean;
  weightKg?: string | number | null;
  lengthCm?: string | number | null;
  widthCm?: string | number | null;
  heightCm?: string | number | null;
  isFreeShipping?: boolean;
  fixedShippingFee?: string | number | null;
  images: Array<{
    id: number;
    url: string;
    altText: string | null;
    displayOrder: number;
    isPrimary: boolean;
  }>;
  specs: Array<{ id: number; specKey: string; specValue: string; displayOrder: number }>;
}

export const fetchProductRow = (id: number) =>
  request<AdminProductRow>(`/api/products/${id}`);
