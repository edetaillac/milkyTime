import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Disable lint during `next build` to avoid blocking compilation
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
