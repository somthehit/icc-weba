// db/seed.ts
//
// Seeds the Postgres database from the same dataset the storefront used to read
// out of localStorage (lib/data/initial-data.ts), so the DB-backed app renders
// the exact demo catalogue, reviews, orders and settings.
//
// Idempotent: every run TRUNCATEs the seeded tables (RESTART IDENTITY CASCADE)
// and re-inserts, so integer PKs are deterministic (products 1..N in file order).
//
// Run with:  npm run db:seed   (tsx loads .env via `dotenv/config`)

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  brands,
  categories,
  products,
  productImages,
  productSpecs,
  users,
  addresses,
  warehouses,
  inventory,
  coupons,
  deliveryZones,
  deliveryPartners,
  orders,
  orderItems,
  orderStatusHistory,
  reviews,
  storeProfile,
  paymentMethodSettings,
  announcementBar,
  suppliers,
  expenseCategories,
  expenses,
  purchaseBills,
  purchaseBillItems,
  serviceTickets,
  attributes,
  attributeOptions,
  attributeCategories,
  productAttributeValues,
  filterTags,
  productFilterTags,
  seoSettings,
  seoPageMeta,
} from '@/db/schema';
import {
  INITIAL_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_PRODUCTS,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  SAMPLE_REVIEWS,
} from '@/lib/data/initial-data';
import { SUDURPASHCHIM_CONFIG } from '@/config/regional';
import { DEFAULT_PAGE_META, DEFAULT_SEO_SETTINGS } from '@/lib/seo/defaults';
import { SEED_ATTRIBUTES, SEED_FILTER_TAGS } from './seed-facets';
import type { Product } from '@/types';

// Shared demo password for every login-capable seeded account.
const DEMO_PASSWORD = 'Password123!';

// --- helpers ---------------------------------------------------------------

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const trunc = (s: string | null | undefined, n: number): string | null =>
  s == null ? null : s.length > n ? s.slice(0, n) : s;

/** "2 Years ..." -> 24, "6 Months" -> 6, "Lifetime ..." -> 0 */
const warrantyToMonths = (w?: string): number => {
  if (!w) return 0;
  const y = w.match(/(\d+)\s*Year/i);
  if (y) return parseInt(y[1], 10) * 12;
  const m = w.match(/(\d+)\s*Month/i);
  if (m) return parseInt(m[1], 10);
  return 0;
};

type ProvinceEnum =
  | 'koshi'
  | 'madhesh'
  | 'bagmati'
  | 'gandaki'
  | 'lumbini'
  | 'karnali'
  | 'sudurpashchim';

const provinceToEnum = (s: string): ProvinceEnum => {
  const key = s.toLowerCase().replace(/province/gi, '').trim();
  const map: Record<string, ProvinceEnum> = {
    koshi: 'koshi',
    madhesh: 'madhesh',
    bagmati: 'bagmati',
    gandaki: 'gandaki',
    lumbini: 'lumbini',
    karnali: 'karnali',
    sudurpashchim: 'sudurpashchim',
  };
  return map[key] ?? 'bagmati';
};

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
const stockStatusFor = (qty: number, threshold: number): StockStatus => {
  if (qty <= 0) return 'out_of_stock';
  if (qty <= (threshold ?? 5)) return 'low_stock';
  return 'in_stock';
};

// frontend tracking status -> order_status enum (no 'shipped' in the enum)
const trackingToStatus: Record<string, string> = {
  placed: 'pending',
  confirmed: 'confirmed',
  packed: 'processing',
  shipped: 'dispatched',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
};
const orderStatusFor = (s: string): string => trackingToStatus[s] ?? 'pending';

const reviewerEmail = (name: string): string => `${slugify(name)}@example.com`;

// ---------------------------------------------------------------------------
// Demo cost prices.
//
// `initial-data.ts` carries a selling price and an MRP but no purchase cost, and
// without a cost there is no COGS, so gross profit is not computable and the P&L
// report has nothing to show. These are *demo* figures, derived rather than
// recorded — the real ones get typed in through the console.
//
// The bands are the gross margins the trade actually runs at, which matters for
// testing: a flat margin across the catalogue makes "top products by margin" a
// meaningless ranking. Laptops and prebuilt PCs are thin, accessories are fat.
const COST_MARGIN_BY_CATEGORY: Record<string, number> = {
  'computers-laptops': 0.1,
  'pc-components': 0.14,
  'printers-scanners': 0.16,
  'electronics-appliances': 0.15,
  networking: 0.22,
  'cctv-security': 0.26,
  'peripherals-accessories': 0.34,
};
const DEFAULT_COST_MARGIN = 0.18;

/** Stable per-slug value in [0,1), so re-seeding does not shuffle the margins. */
const slugJitter = (slug: string): number => {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
};

/** Selling price less a category margin, nudged +/-3 points per product. */
const seedCostPrice = (p: { category: string; slug: string; sellingPrice: number }): string => {
  const band = COST_MARGIN_BY_CATEGORY[p.category] ?? DEFAULT_COST_MARGIN;
  const margin = band + (slugJitter(p.slug) - 0.5) * 0.06;
  return String(Math.round(p.sellingPrice * (1 - margin)));
};

/** The months the demo books cover — January to August 2026, matching the orders. */
const BOOK_MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08'] as const;

/** Day 0 of the next month is the last day of this one — February included. */
const monthEnd = (mm: string): string =>
  String(new Date(2026, Number(mm), 0).getDate()).padStart(2, '0');

/**
 * The 13% Nepal VAT contained *within* an amount, not added on top.
 *
 * `expenses.vat_amount` records the reclaimable part of what was actually paid,
 * so `amount` stays the total that left the till and the P&L cannot double-count.
 */
const vatWithin = (amount: number): string => String(Math.round((amount * 13) / 113));

/** Order.customerEmail is optional in the frontend type; users.email is not. */
const customerEmailFor = (o: { customerEmail?: string; customerName: string }): string =>
  o.customerEmail ?? `${slugify(o.customerName)}@customers.icecomputers.com.np`;

/** Product.specifications is either an ordered list or a plain key/value map. */
const specEntries = (
  specs: Product['specifications'],
): Array<{ key: string; value: string }> => {
  if (!specs) return [];
  if (Array.isArray(specs)) return specs;
  return Object.entries(specs).map(([key, value]) => ({ key, value: String(value) }));
};

// --- seed ------------------------------------------------------------------

async function seed() {
  console.log('🌱 Seeding ICE Computers database…');

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Tables we own, in an order that RESTART IDENTITY resets cleanly. CASCADE
  // also clears any dependent demo rows (cart, wishlist, payments, etc.).
  const truncateList = [
    'reviews',
    'inventory_movements',
    'order_status_history',
    'order_items',
    'orders',
    'inventory',
    'product_specs',
    'product_images',
    'product_variants',
    // Catalog facet data. The value/link tables reference products, attributes,
    // options, categories and tags, so all four dependents go ahead of the two
    // definition tables, and every one of them ahead of products/categories below.
    'product_attribute_values',
    'product_filter_tags',
    'attribute_options',
    'attribute_categories',
    'attributes',
    'filter_tags',
    // Bill lines and expenses reference products and users, so they go before both.
    'purchase_bill_items',
    'purchase_bills',
    'expenses',
    'expense_categories',
    'suppliers',
    // Tickets reference products (product_id) and users twice (customer_id,
    // assigned_to), so they truncate ahead of both.
    'service_tickets',
    'products',
    'addresses',
    'users',
    'brands',
    'categories',
    'warehouses',
    'coupons',
    'delivery_zones',
    'delivery_partners',
    'store_profile',
    'payment_method_settings',
    'announcement_bar',
    // SEO engine. Both are standalone (nothing references them), so they can sit
    // at the end; they must be listed at all, or a re-seed hits the unique index
    // on seo_page_meta.page_key.
    'seo_settings',
    'seo_page_meta',
  ]
    .map((t) => `"${t}"`)
    .join(', ');

  await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE;`),
    );

    // ---- users (staff + demo customer + order customers + reviewers) ------
    const staff = [
      { name: 'Admin (System Owner)', email: 'admin@icecomputers.com.np', role: 'admin' as const },
      { name: 'Sales Manager', email: 'sales@icecomputers.com.np', role: 'sales' as const },
      { name: 'Inventory Manager', email: 'inventory@icecomputers.com.np', role: 'inventory_manager' as const },
      { name: 'Service Lead Technician', email: 'service@icecomputers.com.np', role: 'service_technician' as const },
      { name: 'Demo Customer', email: 'customer@icecomputers.com.np', role: 'customer' as const, phone: '9800000000' },
    ];

    // Unique order customers keyed by email.
    const orderCustomers = new Map<string, { name: string; phone: string }>();
    for (const o of INITIAL_ORDERS) {
      const email = customerEmailFor(o);
      if (!orderCustomers.has(email)) {
        orderCustomers.set(email, { name: o.customerName, phone: o.customerPhone });
      }
    }

    // Unique reviewers keyed by synthetic email.
    const reviewers = new Map<string, { name: string }>();
    for (const r of SAMPLE_REVIEWS) {
      const email = reviewerEmail(r.userName);
      if (!reviewers.has(email) && !orderCustomers.has(email)) {
        reviewers.set(email, { name: r.userName });
      }
    }

    const userValues = [
      ...staff.map((s) => ({
        name: s.name,
        email: s.email,
        phone: (s as { phone?: string }).phone ?? null,
        passwordHash: demoHash,
        role: s.role,
      })),
      ...[...orderCustomers.entries()].map(([email, c]) => ({
        name: c.name,
        email,
        phone: c.phone,
        passwordHash: demoHash, // can log in to view their orders
        role: 'customer' as const,
      })),
      ...[...reviewers.entries()].map(([email, r]) => ({
        name: r.name,
        email,
        phone: null,
        passwordHash: null, // review-only accounts never log in
        role: 'customer' as const,
      })),
    ];

    const insertedUsers = await tx
      .insert(users)
      .values(userValues)
      .returning({ id: users.id, email: users.email });
    const userIdByEmail = new Map(insertedUsers.map((u) => [u.email, u.id]));

    // ---- addresses (one per order customer, from the order's shippingAddress)
    const addressIdByEmail = new Map<string, number>();
    for (const o of INITIAL_ORDERS) {
      const email = customerEmailFor(o);
      if (addressIdByEmail.has(email)) continue;
      const a = o.shippingAddress;
      const userId = userIdByEmail.get(email)!;
      const [addr] = await tx
        .insert(addresses)
        .values({
          userId,
          label: 'Home',
          fullName: a.fullName,
          phone: a.phone,
          province: provinceToEnum(a.province),
          district: a.district,
          municipality: a.municipality,
          wardNo: a.ward,
          streetAddress: trunc(a.addressLine, 255),
          landmark: trunc(a.landmark, 255),
          isDefault: true,
        })
        .returning({ id: addresses.id });
      addressIdByEmail.set(email, addr.id);
    }

    // ---- brands (INITIAL_BRANDS + every brand referenced by a product) ----
    // INITIAL_BRANDS are the curated partner brands (logo + blurb, merchandised on
    // the Brands page). Brands that only appear on a product row get a bare entry
    // with isPartner=false so the shop's brand filter can still offer them.
    const brandNames = new Map<
      string,
      { logoUrl?: string; description?: string; isPartner?: boolean; categorySlugs?: string[] }
    >();
    for (const b of INITIAL_BRANDS) {
      brandNames.set(b.name, {
        logoUrl: b.logo,
        description: b.description,
        isPartner: b.isPartner ?? true,
        categorySlugs: b.categories,
      });
    }
    for (const p of INITIAL_PRODUCTS) {
      if (!brandNames.has(p.brand)) brandNames.set(p.brand, {});
    }
    const brandValues = [...brandNames.entries()].map(([name, meta]) => ({
      name,
      slug: slugify(name),
      logoUrl: meta.logoUrl ?? null,
      description: meta.description ?? null,
      isPartner: meta.isPartner ?? false,
      categorySlugs: meta.categorySlugs ?? null,
    }));
    const insertedBrands = await tx
      .insert(brands)
      .values(brandValues)
      .returning({ id: brands.id, name: brands.name });
    const brandIdByName = new Map(insertedBrands.map((b) => [b.name, b.id]));

    // ---- categories -------------------------------------------------------
    const categoryValues = INITIAL_CATEGORIES.map((c, i) => ({
      name: c.name,
      slug: c.id, // frontend category id === slug
      description: c.description ?? null,
      iconName: trunc(c.iconName, 60),
      subcategories: c.subcategories ?? null,
      imageUrl: trunc(c.image, 500),
      displayOrder: i,
    }));
    const insertedCategories = await tx
      .insert(categories)
      .values(categoryValues)
      .returning({ id: categories.id, slug: categories.slug });
    const categoryIdBySlug = new Map(insertedCategories.map((c) => [c.slug, c.id]));

    // ---- products ---------------------------------------------------------
    const productValues = INITIAL_PRODUCTS.map((p) => {
      const brandId = brandIdByName.get(p.brand);
      const categoryId = categoryIdBySlug.get(p.category);
      if (!brandId) throw new Error(`No brand for product ${p.id} (brand="${p.brand}")`);
      if (!categoryId) throw new Error(`No category for product ${p.id} (category="${p.category}")`);
      const offer = p.offer;
      return {
        sku: p.sku ?? p.slug.toUpperCase().slice(0, 60),
        name: trunc(p.name, 200)!,
        slug: p.slug,
        brandId,
        categoryId,
        description: p.longDescription ?? null,
        shortDescription: trunc(p.shortDescription, 500),
        basePrice: String(p.sellingPrice),
        compareAtPrice: p.mrp != null ? String(p.mrp) : null,
        costPrice: seedCostPrice(p),
        warrantyMonths: warrantyToMonths(p.warranty),
        warrantyText: trunc(p.warranty, 250),
        subcategory: trunc(p.subcategory, 120),
        releaseDate: p.releaseDate ?? null,
        tags: p.tags ?? [],
        features: p.features ?? null,
        whatsInTheBox: p.whatsInTheBox ?? null,
        ratingAverage: String(p.rating ?? 0),
        reviewCount: p.reviewCount ?? 0,
        isDealOfDay: p.isDealOfDay ?? false,
        isFeatured: p.isFeatured ?? false,
        isActive: p.inStock ?? true,
        status: 'active' as const,
        isNewArrival: p.isNewArrival ?? false,
        isBestSeller: p.isBestSeller ?? false,
        isTrending: p.isTrending ?? false,
        stockQuantity: p.stockQuantity ?? 0,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        stockStatus: stockStatusFor(p.stockQuantity ?? 0, p.lowStockThreshold ?? 5),
        offerEnabled: offer?.enabled ?? false,
        offerDiscountType: offer ? (offer.discountType as 'percentage' | 'fixed') : null,
        offerDiscountValue: offer ? String(offer.discountValue) : null,
        offerStartsAt: offer?.startsAt ? new Date(offer.startsAt) : null,
        offerEndsAt: offer?.endsAt ? new Date(offer.endsAt) : null,
        offerIsFlashSale: offer?.isFlashSale ?? false,
        offerStackable: offer?.isStackableWithCoupons ?? false,
        metaTitle: trunc(p.name, 200),
        metaDescription: trunc(p.shortDescription, 500),
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      };
    });
    const insertedProducts = await tx
      .insert(products)
      .values(productValues)
      .returning({ id: products.id, slug: products.slug });
    const productIdBySlug = new Map(insertedProducts.map((p) => [p.slug, p.id]));
    const frontendIdToSlug = new Map(INITIAL_PRODUCTS.map((p) => [p.id, p.slug]));
    const dbProductId = (frontendId: string): number | undefined =>
      productIdBySlug.get(frontendIdToSlug.get(frontendId) ?? '');
    // Cost keyed by the DB id, for the order-item snapshots below. Seeded orders
    // predate the snapshot column, so without this the P&L is empty by
    // construction — every sold line would read as "cost missing".
    const costPriceByDbId = new Map(
      INITIAL_PRODUCTS.map((p) => [productIdBySlug.get(p.slug)!, seedCostPrice(p)]),
    );

    // ---- product images + specs ------------------------------------------
    const imageValues = INITIAL_PRODUCTS.flatMap((p) => {
      const pid = productIdBySlug.get(p.slug)!;
      return (p.images ?? []).map((url, i) => ({
        productId: pid,
        url: trunc(url, 500)!,
        altText: trunc(p.name, 200),
        displayOrder: i,
        isPrimary: i === 0,
      }));
    });
    if (imageValues.length) await tx.insert(productImages).values(imageValues);

    const specValues = INITIAL_PRODUCTS.flatMap((p) => {
      const pid = productIdBySlug.get(p.slug)!;
      return specEntries(p.specifications).map((s, i) => ({
        productId: pid,
        specKey: trunc(s.key, 60)!,
        specValue: trunc(s.value, 200)!,
        displayOrder: i,
      }));
    });
    if (specValues.length) await tx.insert(productSpecs).values(specValues);

    // ---- catalog facets: attributes, options, per-product values ------------
    //
    // The definitions and the rules that read a value off a product live in
    // db/seed-facets.ts. Nothing here is invented: a laptop's RAM facet comes from
    // its own `RAM` spec line, its warranty facet from its own warranty text. A
    // product the rule cannot read gets no row — so a low count on a facet means
    // the catalogue genuinely has little to say about it (only 6 of the 30 seeded
    // products are laptops), not that the wiring is missing.
    let attributeValueCount = 0;
    let attributeOptionCount = 0;
    for (const [index, definition] of SEED_ATTRIBUTES.entries()) {
      const [attribute] = await tx
        .insert(attributes)
        .values({
          name: definition.name,
          slug: definition.slug,
          description: trunc(definition.description, 300),
          dataType: definition.dataType,
          unit: definition.unit,
          isFilterable: definition.isFilterable,
          displayOrder: index,
        })
        .returning({ id: attributes.id });

      // Options exist for `select` only — the endpoints reject them on any other
      // type, because a free-text value has no list to pick from.
      const optionIdByValue = new Map<string, number>();
      if (definition.dataType === 'select' && definition.options.length > 0) {
        const insertedOptions = await tx
          .insert(attributeOptions)
          .values(
            definition.options.map((value, order) => ({
              attributeId: attribute.id,
              value,
              slug: slugify(value),
              displayOrder: order,
            })),
          )
          .returning({ id: attributeOptions.id, value: attributeOptions.value });
        for (const option of insertedOptions) optionIdByValue.set(option.value, option.id);
        attributeOptionCount += insertedOptions.length;
      }

      // No category rows means "applies everywhere", which is what Warranty Period
      // wants — every product has one.
      const categoryLinks = definition.categorySlugs.map((slug) => {
        const categoryId = categoryIdBySlug.get(slug);
        if (!categoryId) {
          throw new Error(
            `Attribute "${definition.slug}" names category "${slug}", which is not in INITIAL_CATEGORIES`,
          );
        }
        return { attributeId: attribute.id, categoryId };
      });
      if (categoryLinks.length) await tx.insert(attributeCategories).values(categoryLinks);

      const valueRows: Array<{
        productId: number;
        attributeId: number;
        optionId: number | null;
        valueText: string | null;
      }> = [];
      for (const p of INITIAL_PRODUCTS) {
        // An attribute scoped to some categories is only asked of those products.
        if (
          definition.categorySlugs.length > 0 &&
          !definition.categorySlugs.includes(p.category)
        ) {
          continue;
        }
        const derived = definition.derive(p);
        if (derived === null) continue;
        const productId = productIdBySlug.get(p.slug)!;

        if (definition.dataType === 'select') {
          const optionId = optionIdByValue.get(derived);
          // Exact match or nothing. Auto-creating an option for a near-miss is how
          // a catalogue ends up with "512GB" and "512 GB" filtering apart.
          if (optionId === undefined) continue;
          valueRows.push({ productId, attributeId: attribute.id, optionId, valueText: null });
        } else {
          // The CHECK constraint allows exactly one of the two columns.
          valueRows.push({
            productId,
            attributeId: attribute.id,
            optionId: null,
            valueText: trunc(derived, 200),
          });
        }
      }
      if (valueRows.length) await tx.insert(productAttributeValues).values(valueRows);
      attributeValueCount += valueRows.length;
    }

    // ---- filter tags -------------------------------------------------------
    // Each tag mirrors a boolean the product already carries, so the counts the
    // admin registry shows match the rails the storefront already renders.
    let filterTagLinkCount = 0;
    for (const [index, tag] of SEED_FILTER_TAGS.entries()) {
      const [inserted] = await tx
        .insert(filterTags)
        .values({
          name: tag.name,
          slug: tag.slug,
          description: trunc(tag.description, 300),
          color: tag.color,
          displayOrder: index,
        })
        .returning({ id: filterTags.id });

      const links = INITIAL_PRODUCTS.filter((p) => tag.applies(p)).map((p) => ({
        productId: productIdBySlug.get(p.slug)!,
        filterTagId: inserted.id,
      }));
      if (links.length) await tx.insert(productFilterTags).values(links);
      filterTagLinkCount += links.length;
    }

    // ---- warehouse + inventory (single-warehouse denormalization) ---------
    const [warehouse] = await tx
      .insert(warehouses)
      .values({ name: 'Dhangadhi Main Warehouse', province: 'sudurpashchim', district: 'Kailali' })
      .returning({ id: warehouses.id });

    const inventoryValues = INITIAL_PRODUCTS.map((p) => ({
      productId: productIdBySlug.get(p.slug)!,
      warehouseId: warehouse.id,
      quantityOnHand: p.stockQuantity ?? 0,
      quantityReserved: 0,
      lowStockThreshold: p.lowStockThreshold ?? 3,
      reorderPoint: 10,
    }));
    await tx.insert(inventory).values(inventoryValues);

    // ---- coupons ----------------------------------------------------------
    const couponValues = INITIAL_COUPONS.map((c) => ({
      code: c.code,
      discountType: c.discountType as 'percentage' | 'fixed',
      discountValue: String(c.discountValue),
      minOrderValue: c.minSpend != null ? String(c.minSpend) : '0',
      maxDiscountAmount: c.maxDiscount != null ? String(c.maxDiscount) : null,
      expiresAt: c.expiryDate ? new Date(`${c.expiryDate}T23:59:59Z`) : null,
      isActive: c.isActive ?? true,
    }));
    await tx.insert(coupons).values(couponValues);

    // ---- delivery zones ---------------------------------------------------
    // Derived from `config/regional.ts` via INITIAL_DELIVERY_ZONES, so the seeded
    // rows are the nine Sudurpashchim districts rather than the Dhangadhi /
    // Dhangadhi / Butwal / Biratnagar set this used to hardcode. `districts` and
    // `municipalities` are populated too — `zoneCoversAddress` narrows on them,
    // and a zone with only a province matched every address in the province.
    const zoneValues = SUDURPASHCHIM_CONFIG.keyDistricts.map((district) => ({
      name: `${district.name} — ${district.hubs[0]}`,
      provinces: SUDURPASHCHIM_CONFIG.primaryProvinceCode,
      districts: district.name,
      municipalities: district.hubs.join(','),
      flatFee: String(district.flatFee),
      estimatedDays: district.estimatedDays,
    }));
    const zoneRows = await tx
      .insert(deliveryZones)
      .values(zoneValues)
      .returning({ id: deliveryZones.id, flatFee: deliveryZones.flatFee });

    // ---- delivery partners ------------------------------------------------
    // The table existed but was never populated, so the console's rider dropdown
    // read from a hardcoded array. `in_house` first: it is the default for
    // Dhangadhi-local orders, which is most of them.
    const partnerValues = [
      { name: 'ICE In-house Riders', type: 'in_house' as const, contactPhone: '9801234567' },
      { name: 'Pathao Courier', type: 'courier' as const, contactPhone: '9801112233' },
      { name: 'Aramex Nepal', type: 'courier' as const, contactPhone: '9802223344' },
      { name: 'NCM Express', type: 'courier' as const, contactPhone: '9803334455' },
    ];
    await tx.insert(deliveryPartners).values(partnerValues);

    // ---- orders + items + status history ----------------------------------
    for (const o of INITIAL_ORDERS) {
      const customerEmail = customerEmailFor(o);
      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber: o.id,
          userId: userIdByEmail.get(customerEmail) ?? null,
          status: orderStatusFor(o.status) as never,
          subtotal: String(o.subtotal),
          vatAmount: String(o.taxAmount ?? 0),
          deliveryFee: String(o.shippingFee ?? 0),
          discountAmount: String(o.discountAmount ?? 0),
          totalAmount: String(o.totalAmount),
          shippingAddressId: addressIdByEmail.get(customerEmail) ?? null,
          paymentMethod: o.paymentMethod as never,
          paymentStatus: o.paymentStatus as never,
          customerNote: o.notes ?? null,
          createdAt: new Date(o.createdAt),
        })
        .returning({ id: orders.id });

      const itemValues = o.items.map((it) => {
        const pid = dbProductId(it.productId) ?? null;
        return {
          orderId: order.id,
          productId: pid,
          productNameSnapshot: trunc(it.productName, 200)!,
          skuSnapshot: trunc(it.sku, 60)!,
          quantity: it.quantity,
          unitPrice: String(it.price),
          lineTotal: String(it.price * it.quantity),
          // null for a line whose product is no longer in the catalogue — the
          // reports count those instead of assuming a zero cost.
          unitCostSnapshot: pid === null ? null : costPriceByDbId.get(pid) ?? null,
        };
      });
      await tx.insert(orderItems).values(itemValues);

      const base = new Date(o.createdAt).getTime();
      const historyValues = (o.trackingHistory ?? []).map((h, i) => ({
        orderId: order.id,
        status: orderStatusFor(h.status) as never,
        note: trunc(`${h.title} — ${h.description}`, 300),
        createdAt: new Date(base + i * 3600_000),
      }));
      if (historyValues.length) await tx.insert(orderStatusHistory).values(historyValues);
    }

    // ---- demo trading history ---------------------------------------------
    // INITIAL_ORDERS holds exactly two orders, both from August 2026. That is
    // enough to render an orders table and nothing else: a monthly P&L, a sales
    // trend or a top-products-by-margin ranking computed over one month of two
    // orders is arithmetically correct and completely unreadable, so there is no
    // way to tell a working report from a broken one.
    //
    // These fill in January to August so the reports have a series to plot. Same
    // arithmetic as `quoteOrder`/`quoteTotals` — VAT carved out of an inclusive
    // price, delivery waived above the free-delivery threshold — so a figure in a
    // report reconciles the same way whether the order came from here or from a
    // real checkout.
    const historyCustomers = [...userIdByEmail.entries()].filter(
      ([email]) => email.endsWith('@example.com') || email === 'customer@icecomputers.com.np',
    );

    // Deterministic LCG rather than Math.random, so re-seeding produces the same
    // books and a figure quoted in a bug report still matches after a re-seed.
    let rngState = 20260824;
    const rnd = (): number => {
      rngState = (rngState * 1103515245 + 12345) % 2147483648;
      return rngState / 2147483648;
    };
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
    const between = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));

    const sellable = INITIAL_PRODUCTS.map((p) => ({
      dbId: productIdBySlug.get(p.slug)!,
      name: trunc(p.name, 200)!,
      sku: (p.sku ?? p.slug.toUpperCase()).slice(0, 60),
      price: p.sellingPrice,
      cost: seedCostPrice(p),
    }));

    // Weighted so most of the history is completed business, with a realistic
    // tail of cancellations and returns — the reports must exclude those from
    // revenue, and with none seeded that exclusion would go untested.
    const outcomes = [
      ...Array<string>(22).fill('delivered'),
      'out_for_delivery',
      'dispatched',
      'processing',
      'confirmed',
      'cancelled',
      'returned',
      'refunded',
    ];
    const paymentStatusFor = (status: string): string => {
      if (status === 'delivered') return 'paid';
      if (status === 'refunded' || status === 'returned') return 'refunded';
      return 'pending';
    };

    const vatRate = 0.13;
    const freeDeliveryThreshold = 50000;
    // A growing shop, ~1-2 orders a day. Volume matters for more than realism: the
    // seeded fixed costs run to roughly NPR 300k a month, and at 5-9 orders a
    // month the gross margin cannot cover them, so every month of the demo P&L
    // comes out negative and a net-profit card can only ever be tested against a
    // loss. This is the order book a shop with those overheads would need.
    const ordersPerMonth = [34, 31, 38, 42, 40, 47, 52, 38];

    // Built in memory and inserted in three statements rather than three per
    // order: at this volume the round trips, not the rows, are the cost.
    type PlannedOrder = {
      values: typeof orders.$inferInsert;
      lines: { item: (typeof sellable)[number]; quantity: number }[];
      status: string;
      createdAt: Date;
    };
    const planned: PlannedOrder[] = [];

    for (const [mi, mm] of BOOK_MONTHS.entries()) {
      const lastDay = Number(monthEnd(mm));
      for (let n = 0; n < ordersPerMonth[mi]; n += 1) {
        // August is the current month (today is the 24th), so keep those orders in
        // the past rather than dating them into next week.
        const day = mm === '08' ? between(1, 20) : between(1, lastDay);
        const createdAt = new Date(
          Date.UTC(2026, Number(mm) - 1, day, between(9, 19), between(0, 59)),
        );

        const lineCount = between(1, 3);
        const chosen = new Map<number, { item: (typeof sellable)[number]; quantity: number }>();
        for (let l = 0; l < lineCount; l += 1) {
          const item = pick(sellable);
          const existing = chosen.get(item.dbId);
          const quantity = item.price > 60000 ? 1 : between(1, 3);
          if (existing) existing.quantity += quantity;
          else chosen.set(item.dbId, { item, quantity });
        }

        const lines = [...chosen.values()];
        const subtotal = lines.reduce((sum, l) => sum + l.item.price * l.quantity, 0);
        const zone = pick(zoneRows);
        const zoneFee = Number(zone.flatFee);
        const deliveryFee = subtotal >= freeDeliveryThreshold ? 0 : zoneFee;
        // Inclusive pricing: VAT is the part of the price above net, not 13% on top.
        const vatAmount = subtotal - Math.round(subtotal / (1 + vatRate));
        const status = pick(outcomes);
        const [customerEmail, customerUserId] = pick(historyCustomers);

        planned.push({
          status,
          createdAt,
          lines,
          values: {
            // 4-digit block below the ICE-2026-88xx pair in INITIAL_ORDERS, so the
            // unique index cannot collide with them.
            orderNumber: `ICE-2026-${String(1000 + planned.length).padStart(4, '0')}`,
            userId: customerUserId,
            status: status as never,
            subtotal: String(subtotal),
            vatAmount: String(vatAmount),
            deliveryFee: String(deliveryFee),
            discountAmount: '0',
            totalAmount: String(subtotal + deliveryFee),
            shippingAddressId: addressIdByEmail.get(customerEmail) ?? null,
            deliveryZoneId: zone.id,
            paymentMethod: (rnd() < 0.72 ? 'cod' : 'bank_transfer') as never,
            paymentStatus: paymentStatusFor(status) as never,
            createdAt,
          },
        });
      }
    }

    const generatedOrderRows = await tx
      .insert(orders)
      .values(planned.map((p) => p.values))
      .returning({ id: orders.id });

    await tx.insert(orderItems).values(
      planned.flatMap((p, i) =>
        p.lines.map((l) => ({
          orderId: generatedOrderRows[i].id,
          productId: l.item.dbId,
          productNameSnapshot: l.item.name,
          skuSnapshot: l.item.sku,
          quantity: l.quantity,
          unitPrice: String(l.item.price),
          lineTotal: String(l.item.price * l.quantity),
          unitCostSnapshot: l.item.cost,
        })),
      ),
    );

    await tx.insert(orderStatusHistory).values(
      planned.map((p, i) => ({
        orderId: generatedOrderRows[i].id,
        status: p.status as never,
        note: 'Seeded demo history',
        createdAt: p.createdAt,
      })),
    );

    const generatedOrders = planned.length;
    const generatedItems = planned.reduce((sum, p) => sum + p.lines.length, 0);

    // ---- reviews ----------------------------------------------------------
    const reviewValues = SAMPLE_REVIEWS.map((r) => {
      const productId = dbProductId(r.productId);
      const userId =
        userIdByEmail.get(reviewerEmail(r.userName)) ??
        userIdByEmail.get('customer@icecomputers.com.np')!;
      if (!productId) return null;
      return {
        productId,
        userId,
        rating: Math.round(r.rating),
        title: trunc(r.title, 150),
        comment: r.comment ?? null,
        userCity: trunc(r.userCity, 120),
        hardwareSetup: trunc(r.hardwareSetup, 300),
        componentAspect: trunc(r.componentAspect, 60),
        componentRatings: r.componentRatings ?? null,
        pros: r.pros ?? null,
        cons: r.cons ?? null,
        isApproved: true,
        isVerifiedPurchase: r.verifiedPurchase ?? false,
        helpfulCount: r.helpfulCount ?? 0,
        createdAt: r.date ? new Date(r.date) : new Date(),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null);
    if (reviewValues.length) await tx.insert(reviews).values(reviewValues);

    // products.rating_average / review_count are denormalised for cheap sorting
    // and card rendering, but they must never be invented: recompute them from
    // the rows we just inserted so a product with no reviews reads as 0/0
    // instead of inheriting a marketing figure from initial-data.ts.
    await tx.execute(sql`
      update products p set
        rating_average = coalesce(agg.avg_rating, 0),
        review_count   = coalesce(agg.n, 0)
      from (
        select pr.id as product_id,
               round(avg(r.rating) filter (where r.is_approved), 2) as avg_rating,
               count(r.id) filter (where r.is_approved)             as n
        from products pr
        left join reviews r on r.product_id = pr.id
        group by pr.id
      ) agg
      where agg.product_id = p.id
    `);

    // ---- shop books: suppliers, expenses, purchase bills -------------------
    // Demo figures, but arithmetically consistent ones: the P&L, the VAT summary
    // and the payables ageing all read from these rows, so they need real dates
    // spanning the same months as the seeded orders (2026-01 .. 2026-08) rather
    // than a single lump that makes every month but one look profitless.
    const adminUserId = userIdByEmail.get('admin@icecomputers.com.np') ?? null;

    const insertedSuppliers = await tx
      .insert(suppliers)
      .values([
        {
          name: 'Neoteric Nepal Pvt. Ltd.',
          contactPerson: 'Rajesh Shrestha',
          phone: '9851012345',
          email: 'sales@neoteric.com.np',
          address: 'Teku, Kailali',
          vatPanNo: '301234567',
        },
        {
          name: 'CG Electronics Distribution',
          contactPerson: 'Anita Karki',
          phone: '9851023456',
          email: 'orders@cgelectronics.com.np',
          address: 'Naxal, Kailali',
          vatPanNo: '302345678',
        },
        {
          name: 'Him Electronics Pvt. Ltd.',
          contactPerson: 'Bikash Thapa',
          phone: '9851034567',
          email: 'trade@himelectronics.com',
          address: 'Kalimati, Kailali',
          vatPanNo: '303456789',
        },
        {
          name: 'Kailali Stationery & Packaging',
          contactPerson: 'Suresh Joshi',
          phone: '9858012345',
          address: 'Main Road, Dhangadhi',
          vatPanNo: '304567890',
        },
      ])
      .returning({ id: suppliers.id, name: suppliers.name });
    const supplierIdByName = new Map(insertedSuppliers.map((s) => [s.name, s.id]));

    const insertedExpenseCategories = await tx
      .insert(expenseCategories)
      .values([
        { name: 'Shop Rent', description: 'Monthly rent for the Dhangadhi showroom and workshop' },
        { name: 'Staff Salaries', description: 'Sales, technician and support staff wages' },
        { name: 'Electricity & Water', description: 'Utility bills including generator fuel' },
        { name: 'Internet & Phone', description: 'Broadband, landline and staff mobile top-ups' },
        { name: 'Marketing & Advertising', description: 'Facebook ads, hoardings, local FM spots' },
        { name: 'Transport & Freight', description: 'Inbound freight from Kailali suppliers' },
        { name: 'Repairs & Maintenance', description: 'Shop fittings, tools, workshop equipment' },
        { name: 'Office Supplies', description: 'Stationery, packaging, consumables' },
        { name: 'Bank Charges & Fees', description: 'Transaction fees, cheque charges, QR settlement' },
      ])
      .returning({ id: expenseCategories.id, name: expenseCategories.name });
    const expenseCategoryIdByName = new Map(
      insertedExpenseCategories.map((c) => [c.name, c.id]),
    );

    // Months the seeded orders span, so every month with revenue also has costs.
    const expenseValues: (typeof expenses.$inferInsert)[] = [];
    for (const [i, mm] of BOOK_MONTHS.entries()) {
      const cat = (name: string) => expenseCategoryIdByName.get(name)!;
      // Rent from an individual landlord: no VAT bill, so nothing to reclaim.
      expenseValues.push({
        categoryId: cat('Shop Rent'),
        description: `Showroom rent — 2026-${mm}`,
        amount: '45000',
        vatAmount: '0',
        expenseDate: `2026-${mm}-05`,
        paymentMethod: 'bank_transfer',
        referenceNo: `RENT-2026${mm}`,
        recordedBy: adminUserId,
      });
      expenseValues.push({
        categoryId: cat('Staff Salaries'),
        description: `Staff salaries — 2026-${mm}`,
        amount: String(186000 + i * 4000),
        vatAmount: '0',
        expenseDate: `2026-${mm}-28`,
        paymentMethod: 'bank_transfer',
        referenceNo: `SAL-2026${mm}`,
        recordedBy: adminUserId,
      });
      const power = 14200 + ((i * 1700) % 5200);
      expenseValues.push({
        categoryId: cat('Electricity & Water'),
        description: `NEA bill and water charges — 2026-${mm}`,
        amount: String(power),
        vatAmount: vatWithin(power),
        expenseDate: `2026-${mm}-12`,
        paymentMethod: 'cash',
        recordedBy: adminUserId,
      });
      expenseValues.push({
        categoryId: cat('Internet & Phone'),
        description: `Broadband and staff mobile — 2026-${mm}`,
        amount: '7900',
        vatAmount: vatWithin(7900),
        expenseDate: `2026-${mm}-08`,
        paymentMethod: 'bank_transfer',
        recordedBy: adminUserId,
      });
      const ads = 9000 + ((i * 5500) % 22000);
      expenseValues.push({
        categoryId: cat('Marketing & Advertising'),
        description: `Facebook and local FM promotion — 2026-${mm}`,
        amount: String(ads),
        vatAmount: vatWithin(ads),
        expenseDate: `2026-${mm}-18`,
        paymentMethod: 'digital_wallet',
        recordedBy: adminUserId,
      });
      const freight = 6500 + ((i * 2300) % 9000);
      expenseValues.push({
        categoryId: cat('Transport & Freight'),
        description: `Inbound freight from Kailali — 2026-${mm}`,
        amount: String(freight),
        vatAmount: vatWithin(freight),
        expenseDate: `2026-${mm}-22`,
        paymentMethod: 'cash',
        supplierId: supplierIdByName.get('Neoteric Nepal Pvt. Ltd.') ?? null,
        recordedBy: adminUserId,
      });
      expenseValues.push({
        categoryId: cat('Bank Charges & Fees'),
        description: `Fonepay settlement and cheque charges — 2026-${mm}`,
        amount: String(1200 + ((i * 310) % 900)),
        vatAmount: '0',
        expenseDate: `2026-${mm}-${monthEnd(mm)}`,
        paymentMethod: 'bank_transfer',
        recordedBy: adminUserId,
      });
    }
    // Irregular, so the monthly expense line is not a flat staircase.
    expenseValues.push(
      {
        categoryId: expenseCategoryIdByName.get('Repairs & Maintenance')!,
        description: 'Workshop bench rebuild and new soldering station',
        amount: '38500',
        vatAmount: vatWithin(38500),
        expenseDate: '2026-03-14',
        paymentMethod: 'cash',
        recordedBy: adminUserId,
      },
      {
        categoryId: expenseCategoryIdByName.get('Office Supplies')!,
        description: 'Packaging cartons, bubble wrap, invoice books (quarterly)',
        amount: '11800',
        vatAmount: vatWithin(11800),
        expenseDate: '2026-04-02',
        paymentMethod: 'cash',
        supplierId: supplierIdByName.get('Kailali Stationery & Packaging') ?? null,
        recordedBy: adminUserId,
      },
      {
        categoryId: expenseCategoryIdByName.get('Marketing & Advertising')!,
        description: 'Dashain–Tihar hoarding board, Ratopul junction',
        amount: '65000',
        vatAmount: vatWithin(65000),
        expenseDate: '2026-06-20',
        paymentMethod: 'bank_transfer',
        recordedBy: adminUserId,
      },
      {
        categoryId: expenseCategoryIdByName.get('Repairs & Maintenance')!,
        description: 'Showroom AC servicing and CCTV re-cabling',
        amount: '22400',
        vatAmount: vatWithin(22400),
        expenseDate: '2026-07-09',
        paymentMethod: 'cash',
        recordedBy: adminUserId,
      },
      {
        categoryId: expenseCategoryIdByName.get('Office Supplies')!,
        description: 'Packaging and consumables restock',
        amount: '13600',
        vatAmount: vatWithin(13600),
        expenseDate: '2026-08-04',
        paymentMethod: 'cash',
        supplierId: supplierIdByName.get('Kailali Stationery & Packaging') ?? null,
        recordedBy: adminUserId,
      },
    );
    await tx.insert(expenses).values(expenseValues);

    // Purchase bills — mixed settlement states so accounts payable has something
    // in every ageing bucket, including one already overdue against today.
    const billSpecs = [
      {
        supplier: 'Neoteric Nepal Pvt. Ltd.',
        billNumber: 'NEO/2026/0418',
        billDate: '2026-05-18',
        dueDate: '2026-06-17',
        status: 'paid' as const,
        paidRatio: 1,
        lines: [
          { description: 'Lenovo LOQ 15 gaming laptops', quantity: 4, unitCost: 118000 },
          { description: 'Kingston Fury 16GB DDR5 kits', quantity: 12, unitCost: 8900 },
        ],
      },
      {
        supplier: 'CG Electronics Distribution',
        billNumber: 'CGE-2026-1102',
        billDate: '2026-06-26',
        dueDate: '2026-07-26',
        status: 'paid' as const,
        paidRatio: 1,
        lines: [
          { description: 'Samsung 27" QHD monitors', quantity: 8, unitCost: 27500 },
          { description: 'HDMI 2.1 cables (bulk)', quantity: 40, unitCost: 620 },
        ],
      },
      {
        supplier: 'Him Electronics Pvt. Ltd.',
        billNumber: 'HIM/PO/2026/0731',
        billDate: '2026-07-31',
        dueDate: '2026-08-15',
        // Due date has passed and it is not settled — this is the row that puts
        // something in the overdue bucket of the payables report.
        status: 'partial' as const,
        paidRatio: 0.4,
        lines: [
          { description: 'Hikvision 4-channel NVR kits', quantity: 6, unitCost: 21500 },
          { description: 'Hikvision ColorVu bullet cameras', quantity: 24, unitCost: 5400 },
        ],
      },
      {
        supplier: 'Neoteric Nepal Pvt. Ltd.',
        billNumber: 'NEO/2026/0812',
        billDate: '2026-08-12',
        dueDate: '2026-09-11',
        status: 'unpaid' as const,
        paidRatio: 0,
        lines: [
          { description: 'WD Blue SN580 1TB NVMe SSDs', quantity: 20, unitCost: 9100 },
          { description: 'ASUS TUF B650 motherboards', quantity: 5, unitCost: 24800 },
          { description: 'TP-Link Archer AX55 routers', quantity: 15, unitCost: 6300 },
        ],
      },
    ];

    let billItemCount = 0;
    for (const spec of billSpecs) {
      const subtotal = spec.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
      // Trade bills quote net and add VAT on top, unlike the retail prices in this
      // app which include it. That is why this is a multiply, not an extraction.
      const vat = Math.round(subtotal * 0.13);
      const total = subtotal + vat;
      const [bill] = await tx
        .insert(purchaseBills)
        .values({
          supplierId: supplierIdByName.get(spec.supplier)!,
          billNumber: spec.billNumber,
          billDate: spec.billDate,
          dueDate: spec.dueDate,
          subtotal: String(subtotal),
          vatAmount: String(vat),
          totalAmount: String(total),
          amountPaid: String(Math.round(total * spec.paidRatio)),
          status: spec.status,
          recordedBy: adminUserId,
        })
        .returning({ id: purchaseBills.id });

      await tx.insert(purchaseBillItems).values(
        spec.lines.map((l) => ({
          billId: bill.id,
          description: l.description,
          quantity: l.quantity,
          unitCost: String(l.unitCost),
          lineTotal: String(l.quantity * l.unitCost),
        })),
      );
      billItemCount += spec.lines.length;
    }

    // ---- service tickets ----------------------------------------------------
    //
    // The repairs bench is a real revenue stream for this shop and the console
    // showed it as a flat `NPR 18,500` — against a table that had no money column
    // at all until migration 0006 added `charged_amount`. These rows are what make
    // that figure computable.
    //
    // Deliberately mixed: paid jobs, free warranty claims (charge left null), and
    // tickets still open. A report that only ever sees billed-and-closed work
    // never exercises the "resolved but unbilled" caption, which is the number the
    // service lead actually needs to chase.
    const technicianId = userIdByEmail.get('service@icecomputers.com.np') ?? null;

    const jobs = [
      { type: 'repair' as const, subject: 'Laptop will not power on after load-shedding surge', lo: 2500, hi: 6500 },
      { type: 'repair' as const, subject: 'Overheating and shutdown under load — thermal repaste', lo: 1800, hi: 3500 },
      { type: 'repair' as const, subject: 'Cracked laptop screen replacement', lo: 7500, hi: 16000 },
      { type: 'repair' as const, subject: 'Windows reinstall and data recovery', lo: 2000, hi: 4500 },
      { type: 'repair' as const, subject: 'Printer paper-feed jam and roller replacement', lo: 1500, hi: 3800 },
      { type: 'installation' as const, subject: 'Office workstation setup and network configuration', lo: 4500, hi: 12000 },
      { type: 'installation' as const, subject: 'CCTV 4-camera installation with NVR mounting', lo: 8500, hi: 22000 },
      { type: 'installation' as const, subject: 'Router and mesh access point installation', lo: 2500, hi: 6000 },
      { type: 'cctv_survey' as const, subject: 'Site survey for shop-front camera coverage', lo: 1500, hi: 4000 },
      { type: 'cctv_survey' as const, subject: 'Warehouse coverage survey and cabling estimate', lo: 2500, hi: 5500 },
      // Warranty work bills nothing. `charged_amount` stays null rather than 0 so
      // the average-ticket figure is not dragged down by jobs that were never
      // priced — an average over free work reports a price the shop never charged.
      { type: 'warranty_claim' as const, subject: 'In-warranty SSD failure — replacement under RMA', lo: 0, hi: 0 },
      { type: 'warranty_claim' as const, subject: 'Monitor dead pixels within warranty window', lo: 0, hi: 0 },
      { type: 'other' as const, subject: 'Bulk data migration for office handover', lo: 3500, hi: 9000 },
    ];

    const ticketValues: Array<typeof serviceTickets.$inferInsert> = [];
    let ticketSeq = 200;

    // Today, so no ticket is opened or resolved into the future. A job the report
    // counts as done before it was logged is not a rounding quibble — it is a lie.
    const today = new Date(2026, 7, 24, 18, 0);

    for (const mm of BOOK_MONTHS) {
      // Four or five jobs a month, which is the order of magnitude a two-person
      // bench in Dhangadhi actually turns over.
      for (let n = 0; n < between(4, 5); n += 1) {
        const job = pick(jobs);
        // Leave room before month-end for the resolve to land in the same window;
        // August stops well short of the 24th so opened+resolve stays in the past.
        const lastOpenDay = mm === '08' ? 13 : Number(monthEnd(mm)) - 10;
        const day = between(2, Math.max(2, lastOpenDay));
        const opened = new Date(2026, Number(mm) - 1, day, between(9, 17), between(0, 59));
        // Most jobs close within the week; a few run on. Never past today.
        const resolvedAt = new Date(opened);
        resolvedAt.setDate(resolvedAt.getDate() + between(1, 9));
        if (resolvedAt > today) resolvedAt.setTime(today.getTime());

        const stillOpen = rnd() < 0.12;
        const billable = job.hi > 0;
        const product = pick(sellable);
        const [, customerId] = pick(historyCustomers);

        ticketSeq += 1;
        ticketValues.push({
          ticketNumber: `SVC-2026-${String(ticketSeq).padStart(4, '0')}`,
          customerId,
          type: job.type,
          subject: job.subject,
          description: `${job.subject}. Logged at the Dhangadhi service counter.`,
          productId: product.dbId,
          status: stillOpen ? pick(['open', 'assigned', 'in_progress'] as const) : 'resolved',
          priority: pick(['low', 'normal', 'normal', 'high'] as const),
          assignedTo: technicianId,
          // Open tickets carry neither a charge nor a resolved date: the job is not
          // finished, so there is nothing to bill and nothing for the revenue
          // report to count. Anything else would book income the shop has not earned.
          chargedAmount: stillOpen || !billable ? null : String(between(job.lo, job.hi)),
          resolvedAt: stillOpen ? null : resolvedAt,
          createdAt: opened,
          updatedAt: stillOpen ? opened : resolvedAt,
        });
      }
    }

    await tx.insert(serviceTickets).values(ticketValues);

    // ---- store settings ---------------------------------------------------
    await tx.insert(storeProfile).values({
      storeName: 'Intel Computer Center',
      contactEmail: INITIAL_SITE_SETTINGS.email,
      contactPhone: trunc(INITIAL_SITE_SETTINGS.phone, 15),
      logoUrl: INITIAL_SITE_SETTINGS.logoUrl,
      province: 'sudurpashchim',
      district: 'Kailali',
      municipality: 'Dhangadhi Sub-Metropolitan City',
      currency: 'NPR',
      vatRatePercent: '13.00',
      pricesIncludeVat: true,
      freeDeliveryThreshold: '50000.00',
    });

    await tx.insert(paymentMethodSettings).values([
      { method: 'cod', isEnabled: true },
      { method: 'bank_transfer', isEnabled: true },
      { method: 'esewa', isEnabled: false },
      { method: 'khalti', isEnabled: false },
    ]);

    await tx.insert(announcementBar).values({
      text: trunc(INITIAL_SITE_SETTINGS.announcementText, 300)!,
      isEnabled: INITIAL_SITE_SETTINGS.announcementEnabled ?? true,
    });

    // ---- SEO engine -------------------------------------------------------
    // Seeded from `lib/seo/defaults.ts` so a fresh database renders the same head
    // tags a migrated one does, and the console has a row to edit rather than an
    // "unsaved defaults" state on first open.
    await tx.insert(seoSettings).values({
      siteName: DEFAULT_SEO_SETTINGS.siteName,
      canonicalBaseUrl: DEFAULT_SEO_SETTINGS.canonicalBaseUrl,
      titleSuffix: DEFAULT_SEO_SETTINGS.titleSuffix,
      defaultMetaTitle: DEFAULT_SEO_SETTINGS.defaultMetaTitle,
      defaultMetaDescription: trunc(DEFAULT_SEO_SETTINGS.defaultMetaDescription, 500),
      defaultKeywords: DEFAULT_SEO_SETTINGS.defaultKeywords,
      ogImageUrl: DEFAULT_SEO_SETTINGS.ogImageUrl,
      ogLocale: DEFAULT_SEO_SETTINGS.ogLocale,
      activeScope: DEFAULT_SEO_SETTINGS.activeScope,
      regionBannerMessage: trunc(DEFAULT_SEO_SETTINGS.regionBannerMessage, 300),
      localBusinessType: DEFAULT_SEO_SETTINGS.localBusinessType,
      priceRange: DEFAULT_SEO_SETTINGS.priceRange,
      geoLatitude: String(SUDURPASHCHIM_CONFIG.geo.latitude),
      geoLongitude: String(SUDURPASHCHIM_CONFIG.geo.longitude),
      sitemapDefaultFrequency: DEFAULT_SEO_SETTINGS.sitemapDefaultFrequency,
    });

    await tx.insert(seoPageMeta).values(
      DEFAULT_PAGE_META.map((page) => ({
        pageKey: page.pageKey,
        label: page.label,
        path: page.path,
        metaTitle: trunc(page.metaTitle, 200),
        metaDescription: trunc(page.metaDescription, 500),
        keywords: page.keywords || null,
        noIndex: page.noIndex,
        includeInSitemap: page.includeInSitemap,
        sitemapPriority: String(page.sitemapPriority),
        sitemapFrequency: page.sitemapFrequency,
        displayOrder: page.displayOrder,
      })),
    );

    console.log('   ✓ users:', insertedUsers.length);
    console.log('   ✓ brands:', insertedBrands.length);
    console.log('   ✓ categories:', insertedCategories.length);
    console.log('   ✓ products:', insertedProducts.length);
    console.log('   ✓ images:', imageValues.length, '| specs:', specValues.length);
    console.log(
      '   ✓ attributes:', SEED_ATTRIBUTES.length,
      '| options:', attributeOptionCount,
      '| product values:', attributeValueCount,
    );
    console.log(
      '   ✓ filter tags:', SEED_FILTER_TAGS.length,
      '| product links:', filterTagLinkCount,
    );
    console.log('   ✓ inventory rows:', inventoryValues.length);
    console.log('   ✓ coupons:', couponValues.length, '| delivery zones:', zoneValues.length);
    console.log('   ✓ delivery partners:', partnerValues.length);
    console.log('   ✓ orders:', INITIAL_ORDERS.length + generatedOrders,
      `(${INITIAL_ORDERS.length} from initial-data + ${generatedOrders} generated history,`,
      `${generatedItems} generated items)`, '| reviews:', reviewValues.length);
    console.log(
      '   ✓ suppliers:', insertedSuppliers.length,
      '| expense categories:', insertedExpenseCategories.length,
      '| expenses:', expenseValues.length,
    );
    console.log('   ✓ purchase bills:', billSpecs.length, '| bill items:', billItemCount);
    console.log(
      '   ✓ service tickets:', ticketValues.length,
      `(${ticketValues.filter((t) => t.chargedAmount != null).length} billed,`,
      `${ticketValues.filter((t) => t.resolvedAt != null && t.chargedAmount == null).length} resolved unbilled,`,
      `${ticketValues.filter((t) => t.resolvedAt == null).length} still open)`,
    );
  });

  console.log(`✅ Seed complete. Demo login password for all seeded accounts: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
