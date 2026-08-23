'use client';

import { useEffect } from 'react';
import { useStore } from '@/context/StoreContext';
import { STORE_INFO } from '@/lib/data/initial-data';

export interface SeoConfig {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  keywords?: string[];
  noIndex?: boolean;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
}

const DEFAULT_BASE_URL = `https://${STORE_INFO.domain}`;

/**
 * Helper to update or insert meta tag into document head
 */
function updateMetaTag(attrName: 'name' | 'property', attrValue: string, content: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Helper to update or insert link tag (e.g., canonical)
 */
function updateLinkTag(rel: string, href: string) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

/**
 * Helper to update or insert structured JSON-LD script tag
 */
function updateJsonLd(scriptId: string, data: Record<string, any> | Array<Record<string, any>> | null) {
  if (typeof document === 'undefined') return;
  let element = document.head.querySelector(`script#${scriptId}`) as HTMLScriptElement | null;

  if (!data) {
    if (element) {
      element.remove();
    }
    return;
  }

  if (!element) {
    element = document.createElement('script');
    element.id = scriptId;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data, null, 2);
}

/**
 * Custom hook to dynamically inject SEO meta tags, canonical URL, Open Graph & JSON-LD
 * based on current page context or custom configuration.
 */
export function useSeoMeta(overrideConfig?: SeoConfig) {
  const store = useStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPage = store?.currentPage || 'home';
    const selectedProductSlug = store?.selectedProductSlug || null;
    const searchQuery = store?.searchQuery || '';
    const products = store?.products || [];

    let title = `${STORE_INFO.name} | ${STORE_INFO.tagline}`;
    let description = `${STORE_INFO.name} is Nepal's trusted store for laptops, computers, CCTV systems, printers, and tech components with local repair services & official warranty.`;
    let canonicalUrl = `${DEFAULT_BASE_URL}/`;
    let ogImage = 'https://picsum.photos/seed/intel-computer-store/1200/630';
    let ogType: 'website' | 'article' | 'product' = 'website';
    let keywords = [
      'Intel Computer Nepal',
      'Laptops Kathmandu',
      'Computer Shop Nepal',
      'GPU Price Nepal',
      'CCTV Camera Kathmandu',
      'Printer Repair Nepal',
      'Bagmati Tech Store',
    ];
    let noIndex = false;
    let jsonLd: Record<string, any> | Array<Record<string, any>> | null = null;

    // Determine current URL path
    const currentOrigin = window.location.origin.includes('localhost') || window.location.origin.includes('run.app')
      ? DEFAULT_BASE_URL
      : window.location.origin;

    // Route-specific defaults
    switch (currentPage) {
      case 'home': {
        title = `${STORE_INFO.name} | Premier Tech & Electronics Store Kathmandu Nepal`;
        description = `Shop genuine laptops, gaming PCs, GPUs, monitors, CCTV cameras, and printers in Kathmandu, Nepal. Enjoy official warranty, free valley delivery & expert service.`;
        canonicalUrl = `${currentOrigin}/`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'ComputerStore',
          'name': STORE_INFO.name,
          'alternateName': STORE_INFO.shortName,
          'url': currentOrigin,
          'logo': `${currentOrigin}/icon.png`,
          'image': ogImage,
          'description': description,
          'telephone': STORE_INFO.phonePrimary,
          'email': STORE_INFO.email,
          'priceRange': 'NPR 500 - NPR 500,000',
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': STORE_INFO.address.street,
            'addressLocality': STORE_INFO.address.city,
            'addressRegion': STORE_INFO.address.province,
            'addressCountry': 'NP',
          },
          'geo': {
            '@type': 'GeoCoordinates',
            'latitude': 27.7028,
            'longitude': 85.3123,
          },
          'openingHoursSpecification': {
            '@type': 'OpeningHoursSpecification',
            'dayOfWeek': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            'opens': '10:00',
            'closes': '19:30',
          },
          'paymentAccepted': 'Cash, eSewa, Khalti, Fonepay, Bank Transfer, Visa, MasterCard',
          'hasOfferCatalog': {
            '@type': 'OfferCatalog',
            'name': 'Computers, Laptops & Electronics',
            'itemListElement': [
              { '@type': 'OfferCatalog', 'name': 'Laptops & Workstations' },
              { '@type': 'OfferCatalog', 'name': 'Graphics Cards & PC Components' },
              { '@type': 'OfferCatalog', 'name': 'CCTV & Security Surveillance' },
              { '@type': 'OfferCatalog', 'name': 'Printers & Toners' },
            ],
          },
        };
        break;
      }

      case 'shop': {
        if (searchQuery.trim()) {
          title = `Search: "${searchQuery}" | ${STORE_INFO.shortName} Nepal`;
          description = `Find the best deals and price in Nepal for "${searchQuery}" at ${STORE_INFO.name}. Official warranty & fast Kathmandu delivery.`;
          canonicalUrl = `${currentOrigin}/shop?search=${encodeURIComponent(searchQuery)}`;
          keywords.push(searchQuery, `${searchQuery} price in Nepal`);
        } else {
          title = `Shop Computers, Laptops & Tech Gear | ${STORE_INFO.shortName} Nepal`;
          description = `Explore Nepal's best collection of Dell, Lenovo, ASUS, HP laptops, GPUs, monitors, Hikvision CCTV kits, Canon printers & networking accessories.`;
          canonicalUrl = `${currentOrigin}/shop`;
        }
        break;
      }

      case 'product-detail': {
        const product = products.find((p) => p.slug === selectedProductSlug);
        if (product) {
          const mainImage = product.images?.[0] || ogImage;
          const prodDesc = product.shortDescription || product.longDescription || '';
          
          title = `${product.name} - Price in Nepal (NPR ${product.sellingPrice.toLocaleString()}) | ${STORE_INFO.shortName}`;
          description = `${prodDesc.slice(0, 155)}... Buy ${product.name} in Nepal with official manufacturer warranty & local support at ${STORE_INFO.name}.`;
          canonicalUrl = `${currentOrigin}/product/${product.slug}`;
          ogImage = mainImage;
          ogType = 'product';
          keywords = [
            product.name,
            `${product.name} price in Nepal`,
            `Buy ${product.name} Kathmandu`,
            product.brand,
            product.category,
            'Genuine Electronics Nepal',
          ];

          // Structured Data for Product
          jsonLd = [
            {
              '@context': 'https://schema.org',
              '@type': 'Product',
              'name': product.name,
              'image': product.images && product.images.length > 0 ? product.images : [mainImage],
              'description': prodDesc,
              'sku': product.sku || product.id,
              'mpn': product.sku || product.id,
              'brand': {
                '@type': 'Brand',
                'name': product.brand,
              },
              'category': product.category,
              'offers': {
                '@type': 'Offer',
                'url': canonicalUrl,
                'priceCurrency': 'NPR',
                'price': product.sellingPrice,
                'priceValidUntil': '2027-12-31',
                'itemCondition': 'https://schema.org/NewCondition',
                'availability': product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                'seller': {
                  '@type': 'Organization',
                  'name': STORE_INFO.name,
                },
              },
              ...(product.rating
                ? {
                    'aggregateRating': {
                      '@type': 'AggregateRating',
                      'ratingValue': product.rating,
                      'reviewCount': product.reviewCount || 12,
                      'bestRating': '5',
                      'worstRating': '1',
                    },
                  }
                : {}),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              'itemListElement': [
                {
                  '@type': 'ListItem',
                  'position': 1,
                  'name': 'Home',
                  'item': `${currentOrigin}/`,
                },
                {
                  '@type': 'ListItem',
                  'position': 2,
                  'name': 'Shop',
                  'item': `${currentOrigin}/shop`,
                },
                {
                  '@type': 'ListItem',
                  'position': 3,
                  'name': product.name,
                  'item': canonicalUrl,
                },
              ],
            },
          ];
        } else {
          title = `Product Details | ${STORE_INFO.shortName}`;
          canonicalUrl = `${currentOrigin}/shop`;
        }
        break;
      }

      case 'cart': {
        title = `Your Shopping Cart | ${STORE_INFO.shortName}`;
        description = `View items in your cart, calculate free Kathmandu Valley delivery thresholds, and proceed to checkout.`;
        canonicalUrl = `${currentOrigin}/cart`;
        break;
      }

      case 'checkout': {
        title = `Secure Checkout | ${STORE_INFO.shortName} Nepal`;
        description = `Complete your computer order securely with Cash on Delivery, eSewa, Khalti, or Bank Transfer in Nepal.`;
        canonicalUrl = `${currentOrigin}/checkout`;
        noIndex = true; // Avoid indexing checkout page
        break;
      }

      case 'track-order': {
        title = `Track Your Order | ${STORE_INFO.shortName} Nepal`;
        description = `Enter your order ID or phone number to get live rider delivery updates and status tracking in Kathmandu and across Nepal.`;
        canonicalUrl = `${currentOrigin}/track-order`;
        break;
      }

      case 'services': {
        title = `Computer Repair, CCTV Installation & IT Servicing | ${STORE_INFO.shortName}`;
        description = `Professional chip-level laptop repair, desktop maintenance, CCTV surveillance installation, and networking setup in Kathmandu Valley, Nepal.`;
        canonicalUrl = `${currentOrigin}/services`;
        keywords.push(
          'Laptop Repair Kathmandu',
          'CCTV System Installation Nepal',
          'Computer Hardware Servicing',
          'Printer Repair Kathmandu',
          'Network Setup Services'
        );
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Service',
          'serviceType': 'Computer Repair and Tech Servicing',
          'provider': {
            '@type': 'LocalBusiness',
            'name': STORE_INFO.name,
            'address': STORE_INFO.address.street + ', ' + STORE_INFO.address.city,
            'telephone': STORE_INFO.phonePrimary,
          },
          'areaServed': 'Kathmandu Valley, Nepal',
          'description': description,
        };
        break;
      }

      case 'brands': {
        title = `Official Authorized Tech Brands | ${STORE_INFO.shortName} Nepal`;
        description = `Explore 100% genuine products with manufacturer warranty from Dell, Lenovo, ASUS, Hikvision, Canon, Brother, MSI & HP in Nepal.`;
        canonicalUrl = `${currentOrigin}/brands`;
        break;
      }

      case 'about':
      case 'contact': {
        title = `About Us & Store Location | ${STORE_INFO.name} Kathmandu`;
        description = `Visit our main showroom at New Road Plaza, Kathmandu. Contact +977-1-4261890 for sales, support, and corporate IT bulk procurement.`;
        canonicalUrl = `${currentOrigin}/about`;
        break;
      }

      case 'account': {
        title = `Customer Account Hub & Orders | ${STORE_INFO.shortName}`;
        description = `Manage your profile, active order status, tax invoices, and warranty claims at ${STORE_INFO.name}.`;
        canonicalUrl = `${currentOrigin}/account`;
        noIndex = true;
        break;
      }

      case 'admin': {
        title = `Admin Operations Dashboard | ${STORE_INFO.shortName}`;
        description = `Internal store management panel for order dispatch, inventory stock audit, and service ticketing.`;
        canonicalUrl = `${currentOrigin}/admin`;
        noIndex = true;
        break;
      }

      case 'compare': {
        title = `Compare Specifications & Prices | ${STORE_INFO.shortName} Nepal`;
        description = `Side-by-side technical specs and price comparison for laptops, GPUs, monitors, and electronics in Nepal.`;
        canonicalUrl = `${currentOrigin}/compare`;
        break;
      }

      case 'faq': {
        title = `Frequently Asked Questions & Support | ${STORE_INFO.shortName}`;
        description = `Find quick answers regarding warranty policies, payment options, delivery timelines, and computer repair services in Nepal.`;
        canonicalUrl = `${currentOrigin}/faq`;
        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          'mainEntity': [
            {
              '@type': 'Question',
              'name': 'Do you offer free delivery in Kathmandu Valley?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Yes! We provide free door-to-door delivery inside Kathmandu, Lalitpur, and Bhaktapur on all orders above NPR 10,000.',
              },
            },
            {
              '@type': 'Question',
              'name': 'Are all products sold at Intel Computer genuine with warranty?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': '100% yes. All items are brand new, genuine, and backed by official manufacturer warranty and local technical support in Kathmandu.',
              },
            },
            {
              '@type': 'Question',
              'name': 'What payment methods do you accept?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'We accept Cash on Delivery, eSewa, Khalti, Fonepay QR, Direct Bank Transfer, and Visa/MasterCard.',
              },
            },
          ],
        };
        break;
      }

      default:
        break;
    }

    // Apply manual override if provided
    if (overrideConfig) {
      if (overrideConfig.title) title = overrideConfig.title;
      if (overrideConfig.description) description = overrideConfig.description;
      if (overrideConfig.canonicalUrl) canonicalUrl = overrideConfig.canonicalUrl;
      if (overrideConfig.ogImage) ogImage = overrideConfig.ogImage;
      if (overrideConfig.ogType) ogType = overrideConfig.ogType;
      if (overrideConfig.keywords) keywords = overrideConfig.keywords;
      if (overrideConfig.noIndex !== undefined) noIndex = overrideConfig.noIndex;
      if (overrideConfig.jsonLd !== undefined) jsonLd = overrideConfig.jsonLd;
    }

    // 1. Title
    document.title = title;

    // 2. Standard Meta Tags
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords.join(', '));
    updateMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    // 3. Canonical Link Tag
    updateLinkTag('canonical', canonicalUrl);

    // 4. Open Graph Meta Tags
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:url', canonicalUrl);
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('property', 'og:type', ogType);
    updateMetaTag('property', 'og:site_name', STORE_INFO.name);
    updateMetaTag('property', 'og:locale', 'en_US');

    // 5. Twitter Card Meta Tags
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', ogImage);

    // 6. JSON-LD Structured Data
    updateJsonLd('seo-json-ld', jsonLd);

  }, [store?.currentPage, store?.selectedProductSlug, store?.searchQuery, store?.products, overrideConfig]);
}
