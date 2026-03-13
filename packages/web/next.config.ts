import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@calendar-sync/shared"],
  async rewrites() {
    const apiUrl = process.env.API_URL || "http://localhost:4200";
    return [
      {
        source: "/api/oauth/:path*",
        destination: `${apiUrl}/api/oauth/:path*`,
      },
    ];
  },
};

export default nextConfig;
