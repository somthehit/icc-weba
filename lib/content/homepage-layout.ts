export const HOMEPAGE_BLOCK_KEYS = [
  'hero_slider',
  'featured_categories',
  'flash_sales',
  'trending_laptops',
  'brand_showcase',
  'custom_promo',
  'latest_blogs',
] as const;

export type HomepageBlockKey = (typeof HOMEPAGE_BLOCK_KEYS)[number];

export interface HomepageBlock {
  id?: number;
  sectionType: HomepageBlockKey;
  title: string;
  configuration: Record<string, unknown>;
  displayOrder: number;
  isEnabled: boolean;
}

export const DEFAULT_HOMEPAGE_BLOCKS: HomepageBlock[] = [
  { sectionType: 'hero_slider', title: 'Main Hero Carousel', configuration: { type: 'BANNER' }, displayOrder: 1, isEnabled: true },
  { sectionType: 'featured_categories', title: 'Featured Categories Grid', configuration: { type: 'CATEGORY_GRID' }, displayOrder: 2, isEnabled: true },
  { sectionType: 'flash_sales', title: 'Flash Sale / Hot Deals', configuration: { type: 'PRODUCT_GRID' }, displayOrder: 3, isEnabled: true },
  { sectionType: 'trending_laptops', title: 'Featured Product Grid', configuration: { type: 'PRODUCT_GRID' }, displayOrder: 4, isEnabled: true },
  { sectionType: 'brand_showcase', title: 'Partner Brands', configuration: { type: 'BRAND_WALL' }, displayOrder: 5, isEnabled: true },
  { sectionType: 'custom_promo', title: 'Service & Repair Promotion', configuration: { type: 'PROMO_BANNER' }, displayOrder: 6, isEnabled: true },
  { sectionType: 'latest_blogs', title: 'Tech News & Buying Guides', configuration: { type: 'ARTICLE_GRID' }, displayOrder: 7, isEnabled: false },
];
