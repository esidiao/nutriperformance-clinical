/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
  images: { domains: ['dgvrflipjxaclpmudtwt.supabase.co'] },
};

module.exports = withPWA(nextConfig);
