import { MetadataRoute } from 'next';
import { STORE_INFO } from '@/lib/data/initial-data';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/checkout/'],
    },
    sitemap: `https://${STORE_INFO.domain}/sitemap.xml`,
  };
}
