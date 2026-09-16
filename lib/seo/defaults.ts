// lib/seo/defaults.ts
//
// What the storefront renders before anyone touches the admin console, and what
// it falls back to if `seo_settings` is empty or the request fails.
//
// Every string here is derived from `config/regional.ts` and `STORE_INFO`, so the
// defaults cannot contradict the delivery footprint the way the previous
// hardcoded ones did (Dhangadhi coordinates, Bagmati keywords, "all 77
// districts" on a Dhangadhi-only warehouse).

import {
  SUDURPASHCHIM_CONFIG,
  SUDURPASHCHIM_DISTRICTS,
  SAME_DAY_HUBS,
  isNationwideActive,
} from '@/config/regional';
import { STORE_INFO } from '@/lib/data/initial-data';
import type { ScopeColumn, SeoPageMeta, SeoSettings } from './types';
import { joinKeywords } from './types';

export const DEFAULT_BASE_URL = `https://${STORE_INFO.domain}`;

/** The code-level scope, as the enum value the column stores. */
export const CODE_SCOPE: ScopeColumn = isNationwideActive()
  ? 'nepal_nationwide'
  : 'region_exclusive';

const DISTRICT_COUNT = SUDURPASHCHIM_DISTRICTS.length;

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  siteName: STORE_INFO.name,
  canonicalBaseUrl: DEFAULT_BASE_URL,
  titleSuffix: SUDURPASHCHIM_CONFIG.seoDefaultSuffix,
  defaultMetaTitle: `Best Laptop & Tech Store in ${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.headquartersDistrict} | ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} Express`,
  defaultMetaDescription: `Buy genuine laptops, computer parts, CCTV kits and printers in ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}. Fast COD delivery in ${SAME_DAY_HUBS.join(', ')} and all ${DISTRICT_COUNT} districts.`,
  defaultKeywords: joinKeywords([...SUDURPASHCHIM_CONFIG.seoBaseKeywords]),
  ogImageUrl: 'https://picsum.photos/seed/intel-computer-store/1200/630',
  twitterHandle: '',
  ogLocale: 'en_NP',

  activeScope: CODE_SCOPE,
  regionBannerMessage: SUDURPASHCHIM_CONFIG.bannerMessage,
  regionBannerEnabled: true,
  extraAreasServed: '',

  structuredDataEnabled: true,
  localBusinessType: 'ComputerStore',
  priceRange: 'NPR 500 - NPR 500,000',
  geoLatitude: SUDURPASHCHIM_CONFIG.geo.latitude,
  geoLongitude: SUDURPASHCHIM_CONFIG.geo.longitude,

  robotsIndexingEnabled: true,
  robotsExtraDisallow: '',
  sitemapIncludeProducts: true,
  sitemapIncludeCategories: true,
  sitemapIncludePages: true,
  sitemapDefaultFrequency: 'daily',

  googleSiteVerification: '',
  bingSiteVerification: '',
  googleAnalyticsId: '',
  facebookPixelId: '',
};

/**
 * Every route the console can edit.
 *
 * `pageKey` is the value `StoreContext.currentPage` holds, so the storefront can
 * find its own row with one lookup instead of matching paths. Routes that must
 * never be indexed (cart, checkout, account, admin) ship with `noIndex` already
 * set — leaving that to the operator is how checkout pages end up in Google.
 */
export const DEFAULT_PAGE_META: SeoPageMeta[] = [
  {
    pageKey: 'home',
    label: 'Homepage',
    path: '/',
    metaTitle: `${STORE_INFO.name} | Laptops, CCTV & Tech Store in ${SUDURPASHCHIM_CONFIG.headquartersCity}`,
    metaDescription: `Shop genuine laptops, gaming PCs, GPUs, monitors, CCTV cameras and printers in ${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.headquartersDistrict}. Official warranty, COD and express delivery across all ${DISTRICT_COUNT} districts of ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`,
    keywords: 'computer shop dhangadhi, laptop price dhangadhi, electronics store sudurpashchim',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 1.0,
    sitemapFrequency: 'daily',
    displayOrder: 1,
  },
  {
    pageKey: 'shop',
    label: 'Shop / Catalogue',
    path: '/shop',
    metaTitle: `Shop Computers, Laptops & Tech Gear | ${SUDURPASHCHIM_CONFIG.headquartersCity}, ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}`,
    metaDescription: `Browse Dell, Lenovo, ASUS and HP laptops, GPUs, monitors, Hikvision CCTV kits, Canon printers and networking gear with delivery across Kailali, Kanchanpur and Dadeldhura.`,
    keywords: 'laptop shop kailali, gpu price nepal, cctv kit dhangadhi',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.9,
    sitemapFrequency: 'daily',
    displayOrder: 2,
  },
  {
    pageKey: 'services',
    label: 'Repair & Services',
    path: '/services',
    metaTitle: `Laptop Repair, CCTV Installation & IT Servicing in ${SUDURPASHCHIM_CONFIG.headquartersCity}`,
    metaDescription: `Chip-level laptop repair, desktop maintenance, CCTV surveillance installation and network setup across ${SAME_DAY_HUBS.join(', ')} and the wider ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} Province.`,
    keywords: 'laptop repair dhangadhi, cctv installation kailali, printer repair mahendranagar',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.8,
    sitemapFrequency: 'weekly',
    displayOrder: 3,
  },
  {
    pageKey: 'brands',
    label: 'Brands',
    path: '/brands',
    metaTitle: `Official Authorized Tech Brands in ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} | ${STORE_INFO.shortName}`,
    metaDescription: `Genuine products with manufacturer warranty from Dell, Lenovo, ASUS, Hikvision, Canon, Brother, MSI and HP — stocked in ${SUDURPASHCHIM_CONFIG.headquartersCity}.`,
    keywords: 'dell dealer dhangadhi, hikvision dealer sudurpashchim',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.7,
    sitemapFrequency: 'weekly',
    displayOrder: 4,
  },
  {
    pageKey: 'about',
    label: 'About & Contact',
    path: '/about',
    metaTitle: `About Us & Store Location in ${SUDURPASHCHIM_CONFIG.headquartersCity} | ${STORE_INFO.name}`,
    metaDescription: `Visit our showroom at ${STORE_INFO.address.street}, ${SUDURPASHCHIM_CONFIG.headquartersCity}. Call ${STORE_INFO.phonePrimary} for sales, service and corporate IT procurement across ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`,
    keywords: 'computer store near me dhangadhi, intel computer center contact',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.7,
    sitemapFrequency: 'monthly',
    displayOrder: 5,
  },
  {
    pageKey: 'faq',
    label: 'FAQ & Support',
    path: '/faq',
    metaTitle: `Delivery, Warranty & Payment FAQs | ${STORE_INFO.shortName}`,
    metaDescription: `Answers on ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} delivery times, Cash on Delivery districts, warranty claims, eSewa/Khalti payment and repair turnaround.`,
    keywords: 'cod delivery sudurpashchim, warranty claim dhangadhi',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.6,
    sitemapFrequency: 'monthly',
    displayOrder: 6,
  },
  {
    pageKey: 'track-order',
    label: 'Order Tracking',
    path: '/track-order',
    metaTitle: `Track Your Order | ${STORE_INFO.shortName}`,
    metaDescription: `Enter your order number or phone to see live rider status for deliveries across Kailali, Kanchanpur and the wider ${SUDURPASHCHIM_CONFIG.primaryProvinceShort} Province.`,
    keywords: 'track order dhangadhi',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.5,
    sitemapFrequency: 'weekly',
    displayOrder: 7,
  },
  {
    pageKey: 'compare',
    label: 'Product Comparison',
    path: '/compare',
    metaTitle: `Compare Laptop & Component Specs and Prices | ${SUDURPASHCHIM_CONFIG.headquartersCity}`,
    metaDescription: `Side-by-side technical specification and price comparison for laptops, GPUs, monitors and electronics available in ${SUDURPASHCHIM_CONFIG.primaryProvinceShort}.`,
    keywords: 'laptop comparison nepal',
    ogImageUrl: '',
    noIndex: false,
    includeInSitemap: true,
    sitemapPriority: 0.5,
    sitemapFrequency: 'weekly',
    displayOrder: 8,
  },
  {
    pageKey: 'cart',
    label: 'Cart',
    path: '/cart',
    metaTitle: `Your Shopping Cart | ${STORE_INFO.shortName}`,
    metaDescription: 'Review your cart, check the free-delivery threshold for your district, and continue to checkout.',
    keywords: '',
    ogImageUrl: '',
    noIndex: true,
    includeInSitemap: false,
    sitemapPriority: 0.1,
    sitemapFrequency: 'never',
    displayOrder: 9,
  },
  {
    pageKey: 'checkout',
    label: 'Checkout',
    path: '/checkout',
    metaTitle: `Secure Checkout | ${STORE_INFO.shortName}`,
    metaDescription: 'Pay with Cash on Delivery, eSewa, Khalti, Fonepay or bank transfer.',
    keywords: '',
    ogImageUrl: '',
    noIndex: true,
    includeInSitemap: false,
    sitemapPriority: 0.1,
    sitemapFrequency: 'never',
    displayOrder: 10,
  },
  {
    pageKey: 'account',
    label: 'Customer Account',
    path: '/account',
    metaTitle: `Your Account & Orders | ${STORE_INFO.shortName}`,
    metaDescription: 'Manage your profile, orders, invoices and warranty claims.',
    keywords: '',
    ogImageUrl: '',
    noIndex: true,
    includeInSitemap: false,
    sitemapPriority: 0.1,
    sitemapFrequency: 'never',
    displayOrder: 11,
  },
  {
    pageKey: 'wishlist',
    label: 'Wishlist',
    path: '/wishlist',
    metaTitle: `Your Wishlist | ${STORE_INFO.shortName}`,
    metaDescription: 'Saved products, ready when you are.',
    keywords: '',
    ogImageUrl: '',
    noIndex: true,
    includeInSitemap: false,
    sitemapPriority: 0.1,
    sitemapFrequency: 'never',
    displayOrder: 12,
  },
  {
    pageKey: 'admin',
    label: 'Admin Console',
    path: '/admin',
    metaTitle: `Admin Console | ${STORE_INFO.shortName}`,
    metaDescription: 'Internal store operations panel.',
    keywords: '',
    ogImageUrl: '',
    noIndex: true,
    includeInSitemap: false,
    sitemapPriority: 0.1,
    sitemapFrequency: 'never',
    displayOrder: 13,
  },
];

/** Routes that must stay out of the index whatever the database says. */
export const ALWAYS_NOINDEX_KEYS = new Set([
  'cart',
  'checkout',
  'account',
  'wishlist',
  'admin',
  'admin-login',
  'customer-login',
  'customer-register',
  'driver-tracking',
]);

export const DEFAULT_SEO_BUNDLE = {
  settings: DEFAULT_SEO_SETTINGS,
  pages: DEFAULT_PAGE_META,
  persisted: false,
};
