import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Without this, Next walks up looking for a lockfile and settles on the user's
  // home directory (there is a stray `package-lock.json` and a `.git` up there),
  // which makes the dev watcher and `output: 'standalone'` tracing crawl
  // AppData, OneDrive, npm-cache and every other unrelated tree.
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Remote image hosts allowed through next/image.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
      // Supabase Storage — everything uploaded through /api/v1/uploads is served
      // from here. Scoped to the object paths rather than the whole host so the
      // rest of the project's API surface is not implicitly whitelisted.
      {
        protocol: 'https',
        hostname: 'enqarkwsxzdhskzpllpr.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  /**
   * Storefront view paths, served by the single client route at `/`.
   *
   * The views are hash-routed inside `app/page.tsx`, so `/shop` and
   * `/product/<slug>` had no server route at all — yet `app/sitemap.ts` has been
   * submitting exactly those URLs to Google, and every canonical tag pointed at
   * them. Google was being handed 404s for the entire catalogue. These rewrites
   * make the advertised URLs resolve; `StoreContext` reads the pathname on load
   * and opens the matching view.
   *
   * Deliberately an explicit list rather than a catch-all: a typo'd URL should
   * still 404 instead of silently rendering the homepage under a junk path, which
   * is how duplicate content gets indexed.
   */
  async rewrites() {
    const views = [
      'shop',
      'cart',
      'checkout',
      'track-order',
      'services',
      'brands',
      'about',
      'contact',
      'account',
      'wishlist',
      'compare',
      'faq',
      'customer-login',
      'customer-register',
      'admin',
      'admin-login',
      'driver-tracking',
    ];

    return [
      ...views.map((view) => ({ source: `/${view}`, destination: '/' })),
      { source: '/product/:slug', destination: '/' },
    ];
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
