/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '1338',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'venetian.com.ar',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'www.venetian.com.ar',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'strapi-backend-production-35d0.up.railway.app',
        pathname: '/uploads/**',
      },
    ],
  },
};

module.exports = nextConfig;
