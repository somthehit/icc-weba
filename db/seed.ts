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
  orders,
  orderItems,
  orderStatusHistory,
  reviews,
  storeProfile,
  paymentMethodSettings,
  announcementBar,
} from '@/db/schema';
import {
  INITIAL_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_BRANDS,
  INITIAL_PRODUCTS,
  INITIAL_COUPONS,
  INITIAL_ORDERS,
  INITIAL_DELIVERY_ZONES,
  SAMPLE_REVIEWS,
} from '@/lib/data/initial-data';
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
    'order_status_history',
    'order_items',
    'orders',
    'inventory',
    'product_specs',
    'product_images',
    'product_variants',
    'products',
    'addresses',
    'users',
    'brands',
    'categories',
    'warehouses',
    'coupons',
    'delivery_zones',
    'store_profile',
    'payment_method_settings',
    'announcement_bar',
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
    const zoneMeta: Record<string, { name: string; days: number }> = {
      'dz-1': { name: 'Kathmandu Valley', days: 1 },
      'dz-2': { name: 'Pokhara Valley', days: 3 },
      'dz-3': { name: 'Butwal / Bhairahawa', days: 3 },
      'dz-4': { name: 'Biratnagar / Itahari', days: 4 },
      'dz-5': { name: 'Dhangadhi Main City', days: 2 },
    };
    const zoneValues = INITIAL_DELIVERY_ZONES.map((z) => ({
      name: zoneMeta[z.id]?.name ?? z.municipality,
      provinces: provinceToEnum(z.province),
      flatFee: String(z.fee),
      estimatedDays: zoneMeta[z.id]?.days ?? 2,
    }));
    await tx.insert(deliveryZones).values(zoneValues);

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

      const itemValues = o.items.map((it) => ({
        orderId: order.id,
        productId: dbProductId(it.productId) ?? null,
        productNameSnapshot: trunc(it.productName, 200)!,
        skuSnapshot: trunc(it.sku, 60)!,
        quantity: it.quantity,
        unitPrice: String(it.price),
        lineTotal: String(it.price * it.quantity),
      }));
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

    // ---- store settings ---------------------------------------------------
    await tx.insert(storeProfile).values({
      storeName: 'ICE Computers & Electronics',
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

    console.log('   ✓ users:', insertedUsers.length);
    console.log('   ✓ brands:', insertedBrands.length);
    console.log('   ✓ categories:', insertedCategories.length);
    console.log('   ✓ products:', insertedProducts.length);
    console.log('   ✓ images:', imageValues.length, '| specs:', specValues.length);
    console.log('   ✓ inventory rows:', inventoryValues.length);
    console.log('   ✓ coupons:', couponValues.length, '| delivery zones:', zoneValues.length);
    console.log('   ✓ orders:', INITIAL_ORDERS.length, '| reviews:', reviewValues.length);
  });

  console.log(`✅ Seed complete. Demo login password for all seeded accounts: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
