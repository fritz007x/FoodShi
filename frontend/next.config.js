/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: 'ipfs.io' },
      { hostname: 'gateway.pinata.cloud' },
      { hostname: 'avatars.githubusercontent.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
  turbopack: {}
};

module.exports = nextConfig;
