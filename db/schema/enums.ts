import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'admin',
  'sales',
  'inventory_manager',
  'service_technician',
  'delivery_driver',
]);

export const staffRoleEnum = pgEnum('staff_role', [
  'SUPER_ADMIN',
  'STORE_MANAGER',
  'SALES_AGENT',
  'SERVICE_TECHNICIAN',
  'DELIVERY_DRIVER',
]);

export const shiftStatusEnum = pgEnum('shift_status', ['ON_DUTY', 'ON_TRANSIT', 'OFF_DUTY']);

export const provinceEnum = pgEnum('province', [
  'koshi',
  'madhesh',
  'bagmati',
  'gandaki',
  'lumbini',
  'karnali',
  'sudurpashchim',
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'cod',
  'esewa',
  'khalti',
  'bank_transfer',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
]);

export const ticketTypeEnum = pgEnum('ticket_type', [
  'repair',
  'cctv_survey',
  'installation',
  'warranty_claim',
  'other',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
]);

export const ticketPriorityEnum = pgEnum('ticket_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);

export const productStatusEnum = pgEnum('product_status', [
  'draft',
  'active',
  'inactive',
  'discontinued',
]);

export const stockStatusEnum = pgEnum('stock_status', [
  'in_stock',
  'low_stock',
  'out_of_stock',
  'pre_order',
  'discontinued',
]);

// Why a stock figure changed. Direction is the sign of `quantity_delta`, not a
// separate column — an "IN" movement with a negative quantity is a contradiction the
// schema should not be able to express.
//
// The first two and the last are written only by code: `sale` / `sale_cancelled` by
// lib/orders/stock.ts at checkout and cancellation, `initial_stock` by the seed and
// by migration 0008's opening-balance backfill. lib/validation/inventory.ts rejects
// all three on the request path, so a member of staff cannot disguise shrinkage as a
// sale.
export const inventoryMovementReasonEnum = pgEnum('inventory_movement_reason', [
  'sale',
  'sale_cancelled',
  'supplier_restock',
  'customer_return',
  'damaged',
  'stolen',
  'expired',
  'internal_use',
  'audit_correction',
  'initial_stock',
]);

// The kind of value a catalog attribute holds. `select` is the one that drives a
// clean facet — its values come from a fixed option list rather than free text.
export const attributeDataTypeEnum = pgEnum('attribute_data_type', [
  'text',
  'number',
  'boolean',
  'select',
]);

export const contentStatusEnum = pgEnum('content_status', ['draft', 'published']);

export const deliveryPartnerTypeEnum = pgEnum('delivery_partner_type', [
  'in_house',
  'courier',
]);

export const notificationEventEnum = pgEnum('notification_event', [
  'low_stock',
  'new_order',
  'service_ticket',
  'weekly_summary',
]);

// How wide the store currently claims to deliver. `region_exclusive` is
// Sudurpashchim's nine districts — the footprint the warehouse in Dhangadhi can
// actually service; `nepal_nationwide` is the phase-2 rollout. The SEO engine and
// the coverage copy both branch on this rather than on hardcoded strings.
export const regionalScopeEnum = pgEnum('regional_scope', [
  'region_exclusive',
  'nepal_nationwide',
]);

// `<changefreq>` values allowed by the sitemap protocol.
export const sitemapFrequencyEnum = pgEnum('sitemap_frequency', [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
]);
