import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { products } from './catalog';
import { contentStatusEnum } from './enums';

export const heroSlides = pgTable('hero_slides', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  eyebrowText: varchar('eyebrow_text', { length: 120 }),
  subtitle: varchar('subtitle', { length: 400 }),
  ctaLabel: varchar('cta_label', { length: 60 }).default('Shop Now'),
  ctaUrl: varchar('cta_url', { length: 300 }),
  desktopImageUrl: varchar('desktop_image_url', { length: 500 }),
  mobileImageUrl: varchar('mobile_image_url', { length: 500 }),
  badgeText: varchar('badge_text', { length: 30 }), // e.g. "-7% OFF"
  featuredProductId: integer('featured_product_id').references(() => products.id, {
    onDelete: 'set null',
  }),
  status: contentStatusEnum('status').notNull().default('draft'),
  displayOrder: integer('display_order').notNull().default(0),
  publishedAt: timestamp('published_at'),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const pages = pgTable(
  'pages',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 220 }).notNull(),
    content: jsonb('content'), // block-based page builder content
    status: contentStatusEnum('status').notNull().default('draft'),
    metaTitle: varchar('meta_title', { length: 200 }),
    metaDescription: varchar('meta_description', { length: 500 }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    slugIdx: index('pages_slug_idx').on(t.slug),
  }),
);

export const navigationMenuItems = pgTable('navigation_menu_items', {
  id: serial('id').primaryKey(),
  label: varchar('label', { length: 80 }).notNull(),
  url: varchar('url', { length: 300 }),
  pageId: integer('page_id').references(() => pages.id, { onDelete: 'set null' }),
  parentId: integer('parent_id').references(
    (): AnyPgColumn => navigationMenuItems.id,
    { onDelete: 'set null' },
  ),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const announcementBar = pgTable('announcement_bar', {
  id: serial('id').primaryKey(),
  text: varchar('text', { length: 300 }).notNull(),
  backgroundColor: varchar('background_color', { length: 20 }).default('#1B3A8C'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
});

export const homepageSections = pgTable('homepage_sections', {
  id: serial('id').primaryKey(),
  sectionType: varchar('section_type', { length: 40 }).notNull(),
  title: varchar('title', { length: 150 }),
  configuration: jsonb('configuration').$type<Record<string, unknown>>().notNull().default({}),
  displayOrder: integer('display_order').notNull().default(0),
  isEnabled: boolean('is_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ orderIdx: index('homepage_sections_order_idx').on(t.displayOrder) }));

export const siteContentSettings = pgTable('site_content_settings', {
  id: serial('id').primaryKey(),
  socialLinks: jsonb('social_links').$type<Record<string, string>>().notNull().default({}),
  footerColumns: jsonb('footer_columns').$type<Array<{ title: string; links: Array<{ label: string; url: string }> }>>().notNull().default([]),
  copyrightText: varchar('copyright_text', { length: 300 }),
  metaTitle: varchar('meta_title', { length: 200 }),
  metaDescription: varchar('meta_description', { length: 500 }),
  openGraphImageUrl: varchar('open_graph_image_url', { length: 500 }),
  googleAnalyticsId: varchar('google_analytics_id', { length: 100 }),
  facebookPixelId: varchar('facebook_pixel_id', { length: 100 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const heroSlidesRelations = relations(heroSlides, ({ one }) => ({
  featuredProduct: one(products, {
    fields: [heroSlides.featuredProductId],
    references: [products.id],
  }),
}));

export const navigationMenuItemsRelations = relations(navigationMenuItems, ({ one }) => ({
  page: one(pages, { fields: [navigationMenuItems.pageId], references: [pages.id] }),
  parent: one(navigationMenuItems, {
    fields: [navigationMenuItems.parentId],
    references: [navigationMenuItems.id],
  }),
}));
