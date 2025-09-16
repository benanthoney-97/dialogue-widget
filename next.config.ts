import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  webpack: (config: Configuration) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = { ...(config.resolve.fallback || {}), canvas: false };
    return config;
  },
};

export default nextConfig;