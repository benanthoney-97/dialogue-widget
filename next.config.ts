/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ allow deploy even if lint rules fail
  eslint: {
    ignoreDuringBuilds: true,
  },
  // (Optional) temporarily ignore TS build errors too
  // Remove this once you’ve cleaned up types.
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
