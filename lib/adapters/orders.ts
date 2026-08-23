// lib/adapters/orders.ts
//
// Database order rows → the `Order` contract in types/index.ts.
//
// Two vocabularies have to meet here. The database uses `order_status`
// (`pending`, `dispatched`, `returned`, `refunded`); the dashboard and the
// customer's tracking timeline were written against their own set (`placed`,
// `packed`, `shipped`). Neither is a subset of the other, so the mapping is
// explicit in both directions rather than a cast.
//
// Money arrives as strings from `numeric` columns and is converted once, here.

import type { Order, OrderItem, OrderStatus, PaymentMethod, ShippingAddress } from '@/types';
import { provinceLabel } from '@/lib/nepal/provinces';

/** `order_status` in the database. */
export type DbOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

/**
 * Database status → the status the UI draws.
 *
 * `returned` and `refunded` both land on `cancelled`: the customer-facing
 * timeline has no state for them, and showing a returned order as `delivered`
 * would be worse than showing it as closed. The raw value is kept on the order as
 * `dbStatus` so the admin console can still tell them apart.
 */
const UI_STATUS: Record<DbOrderStatus, OrderStatus> = {
  pending: 'placed',
  confirmed: 'confirmed',
  processing: 'processing',
  dispatched: 'shipped',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
  returned: 'cancelled',
  refunded: 'cancelled',
};

/**
 * UI status → the value `PUT /api/orders/[id]` will accept.
 *
 * `packed` has no column value of its own — the shop packs during `processing` —
 * so it maps back to that rather than inventing an enum member.
 */
export const DB_STATUS: Record<OrderStatus, DbOrderStatus> = {
  placed: 'pending',
  confirmed: 'confirmed',
  processing: 'processing',
  packed: 'processing',
  shipped: 'dispatched',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/** Human titles for the tracking timeline, keyed by database status. */
const STATUS_TITLES: Record<DbOrderStatus, string> = {
  pending: 'Order Placed',
  confirmed: 'Order Confirmed',
  processing: 'Processing Order',
  dispatched: 'Dispatched to Courier',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Order Cancelled',
  returned: 'Order Returned',
  refunded: 'Order Refunded',
};

/** `payment_status` in the database, narrowed to what the UI type allows. */
const UI_PAYMENT_STATUS: Record<string, 'pending' | 'paid' | 'verified'> = {
  pending: 'pending',
  paid: 'paid',
  failed: 'pending',
  refunded: 'pending',
  partially_refunded: 'pending',
};

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const iso = (v: Date | string | null | undefined): string =>
  v instanceof Date ? v.toISOString() : (v ?? '');

const stamp = (v: Date | string | null | undefined): string => {
  const value = iso(v);
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export interface DbAddressSnapshot {
  label?: string | null;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  wardNo: string;
  streetAddress?: string | null;
  landmark?: string | null;
}

export interface DbOrderRow {
  id: number;
  orderNumber: string;
  userId?: number | null;
  status: string;
  subtotal: string | number;
  vatAmount?: string | number | null;
  deliveryFee?: string | number | null;
  discountAmount?: string | number | null;
  totalAmount: string | number;
  paymentMethod: string;
  paymentStatus: string;
  customerNote?: string | null;
  shippingAddressId?: number | null;
  shippingAddressSnapshot?: DbAddressSnapshot | null;
  deliveryZoneId?: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  /** Present on the staff list, which joins the customer. */
  userName?: string | null;
  userEmail?: string | null;
}

export interface DbOrderItemRow {
  id?: number;
  productId?: number | null;
  variantId?: number | null;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string | number;
  lineTotal?: string | number | null;
}

export interface DbOrderHistoryRow {
  id?: number;
  status: string;
  note?: string | null;
  createdAt?: Date | string | null;
}

/** Everything `GET /api/orders?id=` returns for one order. */
export interface DbOrderDetail extends DbOrderRow {
  items?: DbOrderItemRow[];
  history?: DbOrderHistoryRow[];
}

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: '',
  phone: '',
  province: '',
  district: '',
  municipality: '',
  ward: '',
  addressLine: '',
};

function toShippingAddress(snapshot: DbAddressSnapshot | null | undefined): ShippingAddress {
  if (!snapshot) return EMPTY_ADDRESS;
  return {
    fullName: snapshot.fullName,
    phone: snapshot.phone,
    province: provinceLabel(snapshot.province),
    district: snapshot.district,
    municipality: snapshot.municipality,
    ward: snapshot.wardNo,
    addressLine: snapshot.streetAddress ?? '',
    landmark: snapshot.landmark ?? undefined,
  };
}

function toOrderItem(row: DbOrderItemRow, imageBySlugOrId?: Map<string, string>): OrderItem {
  const productId = row.productId != null ? String(row.productId) : '';
  return {
    productId,
    productName: row.productNameSnapshot,
    // The snapshot deliberately doesn't hold an image URL — a product photo is
    // presentation, not a term of the sale — so the caller may supply the current
    // one from the catalogue it already has loaded.
    productImage: imageBySlugOrId?.get(productId) ?? '',
    price: num(row.unitPrice),
    quantity: row.quantity,
    sku: row.skuSnapshot,
  };
}

/**
 * A database order as the storefront and dashboard expect it.
 *
 * `imagesByProductId` is optional: pass the catalogue's primary images to get
 * thumbnails on the order lines, omit it and the lines render text-only.
 */
export function toUiOrder(
  row: DbOrderDetail,
  options: { imagesByProductId?: Map<string, string>; customerName?: string } = {},
): Order {
  const dbStatus = (row.status as DbOrderStatus) ?? 'pending';
  const items = (row.items ?? []).map((item) => toOrderItem(item, options.imagesByProductId));
  const address = toShippingAddress(row.shippingAddressSnapshot);

  // Newest-first from the API; the timeline reads oldest-first. A freshly placed
  // order comes back without its history rows, so the current status stands in —
  // derived from the order itself, not invented.
  const rawHistory = row.history?.length
    ? [...row.history].reverse()
    : [{ status: dbStatus, note: 'Order placed', createdAt: row.createdAt }];

  return {
    id: row.orderNumber,
    createdAt: iso(row.createdAt),
    customerName: options.customerName ?? row.userName ?? address.fullName,
    customerPhone: address.phone,
    customerEmail: row.userEmail ?? undefined,
    shippingAddress: address,
    paymentMethod: row.paymentMethod as PaymentMethod,
    paymentStatus: UI_PAYMENT_STATUS[row.paymentStatus] ?? 'pending',
    status: UI_STATUS[dbStatus] ?? 'placed',
    items,
    subtotal: num(row.subtotal),
    discountAmount: num(row.discountAmount),
    shippingFee: num(row.deliveryFee),
    taxAmount: num(row.vatAmount),
    totalAmount: num(row.totalAmount),
    trackingHistory: rawHistory.map((entry) => {
      const entryStatus = (entry.status as DbOrderStatus) ?? dbStatus;
      return {
        status: UI_STATUS[entryStatus] ?? 'placed',
        title: STATUS_TITLES[entryStatus] ?? 'Order Updated',
        description: entry.note ?? '',
        timestamp: stamp(entry.createdAt),
      };
    }),
    notes: row.customerNote ?? undefined,
  };
}

/**
 * The numeric row id behind an order, for the endpoints that take one.
 *
 * `Order.id` carries the human order number (`ICE-2026-00042`) because that is
 * what the customer quotes, so the database id is tracked alongside it.
 */
export function orderRowIds(rows: DbOrderRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.orderNumber, row.id]));
}
