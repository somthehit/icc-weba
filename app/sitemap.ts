import { MetadataRoute } from 'next';
import { INITIAL_PRODUCTS, STORE_INFO } from '@/lib/data/initial-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = `https://${STORE_INFO.domain}`;

  const staticRoutes = [
    '',
    '/shop',
    '/services',
    '/brands',
    '/about',
    '/contact',
    '/track-order',
    '/faq',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  const productRoutes = INITIAL_PRODUCTS.map((product) => ({
    url: `${baseUrl}/#product/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  return [...staticRoutes, ...productRoutes];
}
