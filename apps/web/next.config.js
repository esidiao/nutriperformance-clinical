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
      allowedOrigins: [
        'localhost:3000',
        'web-a1nk9hpuu-sidiao-collabs-projects.vercel.app',
        '*.vercel.app',
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
