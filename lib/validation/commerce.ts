// lib/validation/commerce.ts
//
// Request shapes for the catalog, cart, review, inventory, offer and settings
// endpoints. Every schema here doubles as an allowlist: fields it doesn't name
// are dropped before the object reaches Drizzle, which is what stops a caller
// from posting `{ ratingAverage: 5 }` at a product or `{ isApproved: true }` at
// their own review.

import { z } from 'zod';
import { idParamSchema, nepaliPhoneSchema } from './schemas';

/**
 * The seven federal provinces, matching `provinceEnum` in the database. Declared
 * here rather than beside the settings schemas because addresses, the store
 * profile and delivery zones all name the same values.
 */
export const PROVINCES = [
  'koshi',
  'madhesh',
  'bagmati',
  'gandaki',
  'lumbini',
  'karnali',
  'sudurpashchim',
] as const;

/**
 * A rupee amount. Accepts a number or a numeric string from the client and
 * always hands Drizzle the string form its `numeric` columns expect, so a price
 * can't arrive as `1e21` or `"1,200"` and be stored verbatim.
 */
const money = z.coerce
  .number()
  .nonnegative('Must be zero or more')
  .max(99_999_999, 'Amount is unrealistically large')
  .transform((n) => n.toFixed(2));

const count = z.coerce.number().int().min(0).max(1_000_000);

/* ------------------------------------------------------------------ reviews */

export const createReviewSchema = z.object({
  // `userId` is deliberately absent: it comes from the session, never the body.
  // Accepting it here is what let a signed-in customer review as somebody else.
  productId: idParamSchema,
  rating: z.coerce.number().int().min(1, 'Rating must be 1-5').max(5, 'Rating must be 1-5'),
  title: z.string().trim().max(150).optional(),
  comment: z.string().trim().max(4000).optional(),
  images: z.array(z.object({ url: z.url().max(500), caption: z.string().max(200).optional() })).max(8).optional(),
  userCity: z.string().trim().max(120).optional(),
  hardwareSetup: z.string().trim().max(300).optional(),
  componentAspect: z.string().trim().max(60).optional(),
  componentRatings: z
    .record(z.string().max(40), z.coerce.number().int().min(1).max(5))
    .optional(),
  pros: z.array(z.string().trim().max(200)).max(10).optional(),
  cons: z.array(z.string().trim().max(200)).max(10).optional(),
});

export const reviewQuerySchema = z.object({
  productId: idParamSchema.optional(),
  includePending: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/* --------------------------------------------------------------------- cart */

export const addCartItemSchema = z.object({
  // No `userId`/`sessionId`: the cart is looked up from the session, so one
  // customer can no longer read or fill another's basket.
  productId: idParamSchema,
  variantId: idParamSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const updateCartItemSchema = z.object({
  cartItemId: idParamSchema,
  quantity: z.coerce.number().int().min(0).max(99),
});

export const cartItemQuerySchema = z.object({ cartItemId: idParamSchema });

/* ---------------------------------------------------------------- addresses */

/**
 * A delivery address in the Nepali format the schema stores: province, district,
 * municipality and ward are the parts a courier actually needs, so none of them
 * is optional. `userId` is absent by design — the owner comes from the session,
 * which is what stops a caller from filing an address against someone else and
 * then shipping an order to it.
 */
const addressFields = {
  label: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(2, 'Enter the recipient name').max(150),
  phone: nepaliPhoneSchema,
  province: z.enum(PROVINCES),
  district: z.string().trim().min(2, 'District is required').max(100),
  municipality: z.string().trim().min(2, 'Municipality or VDC is required').max(150),
  wardNo: z.string().trim().min(1, 'Ward number is required').max(10),
  streetAddress: z.string().trim().max(255).optional(),
  landmark: z.string().trim().max(255).optional(),
  isDefault: z.boolean(),
};

export const createAddressSchema = z.object(addressFields).extend({
  label: z.string().trim().min(1).max(50).default('Home'),
  isDefault: z.boolean().default(false),
});

export const updateAddressSchema = z
  .object(addressFields)
  .partial()
  .extend({ id: idParamSchema })
  .refine((data) => Object.keys(data).length > 1, {
    message: 'Provide at least one field to update',
  });

export const addressQuerySchema = z.object({ id: idParamSchema });

/* ----------------------------------------------------------------- products */

const PRODUCT_STATUS = ['draft', 'active', 'inactive', 'discontinued'] as const;

const productFields = {
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(220)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens'),
  brandId: idParamSchema.nullable().optional(),
  categoryId: idParamSchema.nullable().optional(),
  description: z.string().max(20_000).optional(),
  shortDescription: z.string().max(500).optional(),
  basePrice: money,
  compareAtPrice: money.optional(),
  costPrice: money.optional(),
  stockQuantity: count,
  lowStockThreshold: count,
  warrantyMonths: z.coerce.number().int().min(0).max(240),
  warrantyType: z.string().trim().max(60).optional(),
  warrantyText: z.string().trim().max(250).optional(),
  subcategory: z.string().trim().max(120).optional(),
  releaseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  tags: z.array(z.string().trim().max(60)).max(30).optional(),
  features: z.array(z.string().trim().max(300)).max(40).optional(),
  whatsInTheBox: z.array(z.string().trim().max(200)).max(40).optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(500).optional(),
  status: z.enum(PRODUCT_STATUS),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isDealOfDay: z.boolean(),
  isNewArrival: z.boolean(),
  isBestSeller: z.boolean(),
  isTrending: z.boolean(),
};

const productObject = z.object(productFields);

/**
 * The admin form knows brands and categories by slug, because that is what the
 * `/api/brands` and `/api/categories` payloads expose as their id (see
 * `mapDbBrandToBrand`). Accept either: a slug is resolved to its row id by the
 * route, an explicit `brandId`/`categoryId` still works for API callers.
 */
const slugRef = z
  .string()
  .trim()
  .min(1)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens');

/**
 * Spec-sheet rows sent alongside the product. Writing these is all-or-nothing:
 * the route replaces the product's existing rows with whatever the form sends,
 * so an omitted `specs` key means "leave them alone" and `[]` means "clear them".
 */
const specRows = z
  .array(
    z.object({
      specKey: z.string().trim().min(1, 'Spec name is required').max(60),
      specValue: z.string().trim().min(1, 'Spec value is required').max(200),
      displayOrder: z.coerce.number().int().min(0).max(500).optional(),
    }),
  )
  .max(60, 'A product can carry at most 60 spec rows');

const imageRows = z
  .array(
    z.object({
      url: z.string().trim().url('Each image needs a valid URL').max(500),
      altText: z.string().trim().max(200).optional(),
      displayOrder: z.coerce.number().int().min(0).max(500).optional(),
      isPrimary: z.boolean().optional(),
    }),
  )
  .max(20, 'A product can carry at most 20 images');

const productRelations = {
  brandSlug: slugRef.optional(),
  categorySlug: slugRef.optional(),
  specs: specRows.optional(),
  images: imageRows.optional(),
};

/**
 * Creating a product: identity and price are required, everything else falls
 * back to the column default.
 */
export const createProductSchema = productObject.extend({
  ...productRelations,
  stockQuantity: count.default(0),
  lowStockThreshold: count.default(5),
  warrantyMonths: z.coerce.number().int().min(0).max(240).default(0),
  status: z.enum(PRODUCT_STATUS).default('draft'),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isDealOfDay: z.boolean().default(false),
  isNewArrival: z.boolean().default(true),
  isBestSeller: z.boolean().default(false),
  isTrending: z.boolean().default(false),
  // The admin form still calls these `seoTitle`/`seoDescription`; accept both
  // spellings rather than silently dropping what the UI sends.
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(500).optional(),
});

/**
 * Updating a product: every field optional, but only these fields. `id`,
 * `createdAt`, `ratingAverage`, `reviewCount` and `reservedQuantity` are
 * computed or immutable and so are not accepted from a request body.
 */
export const updateProductSchema = productObject
  .partial()
  .extend({
    ...productRelations,
    seoTitle: z.string().trim().max(200).optional(),
    seoDescription: z.string().trim().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });


/* ---------------------------------------------------------------- inventory */

export const inventoryQuerySchema = z.object({
  productId: idParamSchema.optional(),
  warehouseId: idParamSchema.optional(),
});

export const createInventorySchema = z.object({
  productId: idParamSchema,
  warehouseId: idParamSchema,
  quantityOnHand: count.default(0),
  quantityReserved: count.default(0),
  lowStockThreshold: count.default(5),
  reorderPoint: count.default(10),
});

export const updateInventorySchema = z
  .object({
    id: idParamSchema,
    quantityOnHand: count.optional(),
    quantityReserved: count.optional(),
    lowStockThreshold: count.optional(),
    reorderPoint: count.optional(),
  })
  .refine(
    (data) =>
      data.quantityOnHand !== undefined ||
      data.quantityReserved !== undefined ||
      data.lowStockThreshold !== undefined ||
      data.reorderPoint !== undefined,
    { message: 'Provide at least one quantity to update' },
  );

/* ------------------------------------------------------------------- offers */

export const applyOfferSchema = z
  .object({
    productId: idParamSchema,
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive('Discount must be greater than zero'),
    days: z.coerce.number().int().min(1).max(365).default(7),
    name: z.string().trim().max(150).optional(),
  })
  .refine((data) => data.discountType !== 'percentage' || data.discountValue <= 100, {
    message: 'A percentage discount cannot exceed 100',
    path: ['discountValue'],
  });

export const effectivePriceQuerySchema = z.object({
  productId: idParamSchema,
  sellingPrice: z.coerce.number().nonnegative(),
});

/* ------------------------------------------------------------------- orders */

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'dispatched',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
] as const;

export const PAYMENT_METHODS = ['cod', 'esewa', 'khalti', 'bank_transfer'] as const;

export const orderListQuerySchema = z.object({
  id: idParamSchema.optional(),
  orderNumber: z.string().trim().max(30).optional(),
  // Honoured for staff only; a customer's list is always scoped to their own id.
  userId: idParamSchema.optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** One basket line. Quantity only — the price is the server's business. */
const orderLineSchema = z.object({
  productId: idParamSchema,
  variantId: idParamSchema.optional(),
  quantity: z.coerce.number().int().min(1).max(99),
});

/**
 * What a checkout may state about an order.
 *
 * Note what is missing: `unitPrice`, `subtotal`, `vatAmount`, `deliveryFee`,
 * `discountAmount`, `totalAmount` and `couponId`. The old handler read every one
 * of those from the body, so a caller could name their own price, waive delivery,
 * or attach a coupon id that was never checked. A coupon is now named by `code`
 * and looked up; everything else is computed from the database.
 */
const orderRequestBase = z.object({
  items: z.array(orderLineSchema).min(1, 'Add at least one item').max(50).optional(),
  /** Price the customer's saved cart instead of an inline `items` array. */
  fromCart: z.boolean().default(false),
  shippingAddressId: idParamSchema.optional(),
  deliveryZoneId: idParamSchema.optional(),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

const hasSomethingToPrice = (data: { fromCart: boolean; items?: unknown[] }) =>
  data.fromCart || (data.items?.length ?? 0) > 0;

const NOTHING_TO_PRICE = {
  message: 'Send items, or set fromCart to use the saved cart',
  path: ['items'],
};

/** Checkout summary: the same inputs, priced but not committed. */
export const orderQuoteSchema = orderRequestBase.refine(hasSomethingToPrice, NOTHING_TO_PRICE);

export const createOrderSchema = orderRequestBase
  .extend({
    paymentMethod: z.enum(PAYMENT_METHODS),
    customerNote: z.string().trim().max(1000).optional(),
  })
  .refine(hasSomethingToPrice, NOTHING_TO_PRICE)
  .refine((data) => data.deliveryZoneId === undefined || data.shippingAddressId !== undefined, {
    message: 'Choose a delivery address for that zone',
    path: ['shippingAddressId'],
  });

export const updateOrderSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((data) => data.status !== undefined || data.paymentStatus !== undefined, {
    message: 'Provide a status or paymentStatus to change',
  });

/* ---------------------------------------------------------------- deliveries */

export const DELIVERY_STATUSES = [
  'assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
] as const;

export const deliveryQuerySchema = z.object({
  // Honoured for an owner dispatching work; a technician always sees their own.
  driverId: idParamSchema.optional(),
  status: z.enum(DELIVERY_STATUSES).optional(),
});

export const createDeliveryRouteSchema = z.object({
  orderId: idParamSchema,
  driverId: idParamSchema,
  deliveryPartnerId: idParamSchema.optional(),
  estimatedArrival: z.coerce.date().optional(),
  distanceKm: z.coerce
    .number()
    .min(0)
    .max(10_000)
    .transform((n) => n.toFixed(2))
    .optional(),
  stopSequence: z.coerce.number().int().min(0).max(999).optional(),
});

export const updateDeliveryStatusSchema = z.object({
  routeId: idParamSchema,
  status: z.enum(DELIVERY_STATUSES),
  notes: z.string().trim().max(500).optional(),
  proofOfDelivery: z.record(z.string().max(60), z.unknown()).optional(),
  failureReason: z.string().trim().max(300).optional(),
});

/** A GPS ping. `driverId` comes from the session, not the body. */
export const driverLocationSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90)
    .max(90)
    .transform((n) => n.toFixed(7)),
  longitude: z.coerce
    .number()
    .min(-180)
    .max(180)
    .transform((n) => n.toFixed(7)),
  accuracy: z.coerce
    .number()
    .min(0)
    .max(100_000)
    .transform((n) => n.toFixed(2))
    .optional(),
  speed: z.coerce
    .number()
    .min(0)
    .max(1_000)
    .transform((n) => n.toFixed(2))
    .optional(),
  heading: z.coerce
    .number()
    .min(0)
    .max(360)
    .transform((n) => n.toFixed(2))
    .optional(),
});

/* ----------------------------------------------------------------- settings */

const NOTIFICATION_EVENTS = [
  'low_stock',
  'new_order',
  'service_ticket',
  'weekly_summary',
] as const;

/**
 * An image reference the browser can actually resolve.
 *
 * These were plain `z.string().max(500)`, which accepted anything — and the
 * Settings "Choose file" control used to store `file.name`, so `logo_url` ended up
 * holding `"Intel Logo.jpeg"`. The browser resolved that relative to the current
 * page, 404'd, and the header silently fell back to initials.
 *
 * Accepted: an absolute http(s) URL, a root-relative path, a data URI, or empty
 * (meaning "unset"). Rejected: a bare filename, which is never loadable.
 */
const assetUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) =>
      value === '' ||
      /^https?:\/\//i.test(value) ||
      value.startsWith('/') ||
      value.startsWith('data:image/'),
    { message: 'Upload the image, or paste a full URL starting with https:// or /' },
  );

const storeProfileSchema = z
  .object({
    storeName: z.string().trim().min(2).max(150).optional(),
    tagline: z.string().trim().max(300).optional(),
    legalName: z.string().trim().max(200).optional(),
    panVatNumber: z.string().trim().regex(/^\d{9}$/, 'PAN/VAT number must contain 9 digits').optional(),
    contactEmail: z.email().max(200).optional(),
    contactPhone: z.string().trim().max(15).optional(),
    logoUrl: assetUrlSchema.optional(),
    darkLogoUrl: assetUrlSchema.optional(),
    faviconUrl: assetUrlSchema.optional(),
    invoiceLogoUrl: assetUrlSchema.optional(),
    address: z.string().trim().max(500).optional(),
    openingHours: z.string().trim().max(200).optional(),
    announcementText: z.string().trim().max(300).optional(),
    announcementEnabled: z.boolean().optional(),
    province: z.enum(PROVINCES).optional(),
    district: z.string().trim().max(100).optional(),
    municipality: z.string().trim().max(150).optional(),
    wardNo: z.string().trim().max(10).optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    vatRatePercent: z.coerce.number().min(0).max(100).transform((n) => n.toFixed(2)).optional(),
    pricesIncludeVat: z.boolean().optional(),
    multiCurrencyEnabled: z.boolean().optional(),
    calendar: z.enum(['AD', 'BS']).optional(),
    guestCheckoutEnabled: z.boolean().optional(),
    minimumOrderAmount: money.optional(),
    stockLockMinutes: z.coerce.number().int().min(1).max(1440).transform(String).optional(),
    unpaidOrderCancelMinutes: z.coerce.number().int().min(1).max(10080).transform(String).optional(),
    configuration: z.record(z.string().max(60), z.unknown()).optional(),
    freeDeliveryThreshold: money.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one setting to update',
  });

const paymentSettingSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  isEnabled: z.boolean().optional(),
  merchantId: z.string().trim().max(150).optional(),
  config: z.record(z.string().max(60), z.unknown()).optional(),
  // `secretKeyEncrypted` is intentionally not accepted: the column stores
  // ciphertext, and taking it from a JSON body would mean storing whatever
  // plaintext the caller typed under a name that claims otherwise.
});

const notificationSettingSchema = z.object({
  eventType: z.enum(NOTIFICATION_EVENTS),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

/**
 * The settings endpoint takes `{ type, data }`; a discriminated union means the
 * shape of `data` is checked against the type the caller declared instead of
 * being spread into whichever table the branch happens to pick.
 */
export const settingsPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('profile'), data: storeProfileSchema }),
  z.object({ type: z.literal('payment'), data: paymentSettingSchema }),
  z.object({ type: z.literal('notification'), data: notificationSettingSchema }),
]);

export const settingsTypeQuerySchema = z.object({
  type: z.enum(['profile', 'payments', 'notifications']).default('profile'),
});
