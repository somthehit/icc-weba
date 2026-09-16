// lib/seo/jsonld.ts
//
// schema.org structured data, built from the regional config rather than typed out.
//
// The previous version lived inline in `useSeoMeta` and had the shop at
// 27.7028N/85.3123E — Dhangadhi, roughly 500 km from the Dhangadhi showroom — with
// `areaServed: 'Kailali Valley, Nepal'`. Wrong geo on a LocalBusiness node is
// worse than none: it feeds Google a service area the store cannot serve.
//
// Every builder is pure and takes its inputs, so the admin console can render the
// exact JSON the storefront will emit.

import {
  SUDURPASHCHIM_CONFIG,
  SUDURPASHCHIM_DISTRICTS,
  SUDURPASHCHIM_HUBS,
  isNationwideActive,
} from '@/config/regional';
import { STORE_INFO } from '@/lib/data/initial-data';
import type { SeoSettings } from './types';
import { splitKeywords } from './types';

export type JsonLd = Record<string, unknown>;

/**
 * `areaServed` for the LocalBusiness node.
 *
 * Under the region-exclusive scope this is the nine districts plus their hub
 * towns — the specific place names people actually search ("laptop shop
 * Mahendranagar"). Nationwide adds Nepal as an AdministrativeArea so the node
 * stops implying a service area the store has outgrown.
 */
export function areaServed(settings: SeoSettings): string[] {
  const extra = splitKeywords(settings.extraAreasServed);
  const scopeNationwide = settings.activeScope === 'nepal_nationwide' || isNationwideActive();

  const base = scopeNationwide
    ? ['Nepal', SUDURPASHCHIM_CONFIG.primaryProvinceShort, ...SUDURPASHCHIM_HUBS]
    : [
      SUDURPASHCHIM_CONFIG.primaryProvinceShort,
      ...SUDURPASHCHIM_DISTRICTS,
      ...SUDURPASHCHIM_HUBS,
    ];

  return Array.from(new Set([...base, ...extra]));
}

/** PostalAddress for the Dhangadhi head office. */
export function postalAddress(): JsonLd {
  return {
    '@type': 'PostalAddress',
    streetAddress: STORE_INFO.address.street,
    addressLocality: SUDURPASHCHIM_CONFIG.headquartersCity,
    addressRegion: SUDURPASHCHIM_CONFIG.primaryProvinceShort,
    postalCode: SUDURPASHCHIM_CONFIG.postalCode,
    addressCountry: SUDURPASHCHIM_CONFIG.countryCode,
  };
}

/**
 * The LocalBusiness / ComputerStore node every page carries.
 *
 * `origin` is passed in rather than read from `window` so the same function runs
 * in the admin preview, in `generateMetadata`, and in the browser.
 */
export function buildLocalBusinessJsonLd(settings: SeoSettings, origin: string): JsonLd {
  const lat = settings.geoLatitude ?? SUDURPASHCHIM_CONFIG.geo.latitude;
  const lng = settings.geoLongitude ?? SUDURPASHCHIM_CONFIG.geo.longitude;

  return {
    '@context': 'https://schema.org',
    '@type': settings.localBusinessType || 'ComputerStore',
    name: settings.siteName || STORE_INFO.name,
    alternateName: STORE_INFO.shortName,
    url: origin,
    logo: `${origin}/logo.png`,
    image: settings.ogImageUrl || `${origin}/logo.png`,
    description: settings.defaultMetaDescription,
    telephone: STORE_INFO.phonePrimary,
    email: STORE_INFO.email,
    priceRange: settings.priceRange,
    currenciesAccepted: 'NPR',
    paymentAccepted: 'Cash on Delivery, eSewa, Khalti, Fonepay, Bank Transfer, Visa, MasterCard',
    address: postalAddress(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: lat,
      longitude: lng,
    },
    areaServed: areaServed(settings).map((name) => ({ '@type': 'Place', name })),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '09:30',
        closes: '19:00',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Computers, Laptops & Electronics',
      itemListElement: [
        { '@type': 'OfferCatalog', name: 'Laptops & Workstations' },
        { '@type': 'OfferCatalog', name: 'Graphics Cards & PC Components' },
        { '@type': 'OfferCatalog', name: 'CCTV & Security Surveillance' },
        { '@type': 'OfferCatalog', name: 'Printers & Toners' },
      ],
    },
  };
}

/**
 * The compact LocalBusiness node the admin console previews.
 *
 * Same address and area data as the full node, trimmed to what fits a readable
 * code block — the operator is checking the region is right, not auditing every
 * property.
 */
export function buildLocalBusinessPreview(settings: SeoSettings): JsonLd {
  const lat = settings.geoLatitude ?? SUDURPASHCHIM_CONFIG.geo.latitude;
  const lng = settings.geoLongitude ?? SUDURPASHCHIM_CONFIG.geo.longitude;

  return {
    '@context': 'https://schema.org',
    '@type': settings.localBusinessType || 'ComputerStore',
    name: settings.siteName || STORE_INFO.name,
    image: settings.ogImageUrl,
    telephone: STORE_INFO.phonePrimary,
    address: postalAddress(),
    geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng },
    areaServed: areaServed(settings).slice(0, 8),
    priceRange: settings.priceRange,
  };
}

export function buildServiceJsonLd(settings: SeoSettings, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Computer Repair, CCTV Installation and IT Servicing',
    provider: {
      '@type': 'LocalBusiness',
      name: settings.siteName || STORE_INFO.name,
      address: postalAddress(),
      telephone: STORE_INFO.phonePrimary,
    },
    areaServed: areaServed(settings).map((name) => ({ '@type': 'Place', name })),
    description,
  };
}

export interface ProductJsonLdInput {
  name: string;
  images: string[];
  description: string;
  sku: string;
  brand: string;
  category: string;
  price: number;
  inStock: boolean;
  canonicalUrl: string;
  rating?: number;
  reviewCount?: number;
  sellerName: string;
}

export function buildProductJsonLd(input: ProductJsonLdInput): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    image: input.images,
    description: input.description,
    sku: input.sku,
    mpn: input.sku,
    brand: { '@type': 'Brand', name: input.brand },
    category: input.category,
    offers: {
      '@type': 'Offer',
      url: input.canonicalUrl,
      priceCurrency: 'NPR',
      price: input.price,
      itemCondition: 'https://schema.org/NewCondition',
      availability: input.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: input.sellerName },
      // Delivery promise, stated where a shopping surface can read it.
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: SUDURPASHCHIM_CONFIG.countryCode,
          addressRegion: SUDURPASHCHIM_CONFIG.primaryProvinceShort,
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4, unitCode: 'DAY' },
        },
      },
    },
    ...(input.rating
      ? {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: input.rating,
          reviewCount: input.reviewCount || 1,
          bestRating: '5',
          worstRating: '1',
        },
      }
      : {}),
  };
}

export function buildBreadcrumbJsonLd(
  trail: Array<{ name: string; url: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFaqJsonLd(
  entries: Array<{ question: string; answer: string }>,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };
}

export function buildWebsiteJsonLd(settings: SeoSettings, origin: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: settings.siteName || STORE_INFO.name,
    url: origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${origin}/shop?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}
