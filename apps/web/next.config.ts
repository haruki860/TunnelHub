import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["shared"],

  typescript: {
    ignoreBuildErrors: true,
  },
};
export default nextConfig;
