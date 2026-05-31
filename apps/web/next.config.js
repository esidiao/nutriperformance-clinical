/** @type {import('next').NextConfig} */
// next-pwa was replaced with @ducanh2912/next-pwa (next-pwa@5.6.0 is unmaintained
// and has unpatched vulnerabilities). Run: npm uninstall next-pwa && npm install @ducanh2912/next-pwa
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  // Never expose source maps in production — they reveal full application source code.
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      // Only allow known, specific origins — never use wildcards for Server Actions.
      // Add your production custom domain here when available.
      allowedOrigins: [
        'localhost:3000',
        'web-a1nk9hpuu-sidiao-collabs-projects.vercel.app',
        'web-q114xajg3-sidiao-collabs-projects.vercel.app',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'dgvrflipjxaclpmudtwt.supabase.co' },
    ],
  },
};

module.exports = withPWA(nextConfig);
