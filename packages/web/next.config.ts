import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@calendar-sync/shared"],
};

export default nextConfig;
