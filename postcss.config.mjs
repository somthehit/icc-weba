/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 prefixes via Lightning CSS internally, so `@tailwindcss/postcss`
    // is meant to be the only plugin here. An autoprefixer pass after it is a
    // redundant walk over ~147 KB of `oklch()` / `@property` output per rebuild.
    '@tailwindcss/postcss': {},
  },
};

export default config;
