/** @type {import('next').NextConfig} */
// PWA desativado temporariamente — next-pwa@5.6 era unmaintained (CVEs),
// @ducanh2912/next-pwa@10 tem conflito de peer com Next.js 15.
// Reintegrar via @serwist/next quando estabilizar suporte ao Next 15.

const nextConfig = {
  // Never expose source maps in production — they reveal full application source code.
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      // Only allow known, specific origins — never use wildcards for Server Actions.
      allowedOrigins: [
        'localhost:3000',
        'web-a1nk9hpuu-sidiao-collabs-projects.vercel.app',
        'web-q114xajg3-sidiao-collabs-projects.vercel.app',
        'web-oz5iownu3-sidiao-collabs-projects.vercel.app',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dgvrflipjxaclpmudtwt.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
