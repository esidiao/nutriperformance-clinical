/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
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
