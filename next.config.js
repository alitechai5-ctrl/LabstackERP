/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    config.cache = false;
    config.parallelism = 1;
    if (isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },
};

module.exports = nextConfig;
