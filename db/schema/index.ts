// ICE Computers & Electronics — full Drizzle ORM schema (PostgreSQL)
//
// Usage: import { products, orders, ... } from './drizzle-schema'
// (or from wherever you place this folder, e.g. src/db/schema)
//
// Domains:
//   enums        shared pg enums
//   users        customers + staff, addresses (Nepal Province/District/Municipality/Ward)
//   catalog      brands, categories, products, spec sheet, variants, images
//   inventory    multi-warehouse stock with reservation + low-stock threshold
//   promotions   coupons
//   cart         cart, cart items, wishlist
//   delivery     delivery zones, delivery partners
//   orders       orders, order items, status history, shipments, payments
//   services     repair / CCTV survey / installation / warranty tickets
//   reviews      product reviews (verified-purchase linkable)
//   content      hero slides, pages, nav menu, announcement bar (Site & Content module)
//   settings     store profile, VAT/currency, payment method config, notification prefs
//   audit        audit_logs for accountability across the console

export * from './enums';
export * from './users';
export * from './catalog';
export * from './inventory';
export * from './promotions';
export * from './cart';
export * from './delivery';
export * from './orders';
export * from './services';
export * from './reviews';
export * from './content';
export * from './settings';
export * from './audit';
export * from './driver-tracking';
