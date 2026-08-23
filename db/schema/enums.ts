import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'customer',
  'admin',
  'sales',
  'inventory_manager',
  'service_technician',
]);

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
