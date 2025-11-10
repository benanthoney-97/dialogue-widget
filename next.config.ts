import type { NextConfig } from "next";
import path from "path";
import type { Configuration } from "webpack";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true, // ← enables prod sourcemaps
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: "./stubs/canvas.js",
    },
  },
  webpack: (config: Configuration) => {
    config.resolve = config.resolve || {};
    config.resolve.fallback = { ...(config.resolve.fallback || {}), canvas: false };
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: path.resolve(__dirname, "stubs/canvas.js"),
    };
    return config;
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
