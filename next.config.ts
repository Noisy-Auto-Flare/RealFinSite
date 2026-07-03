import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: ['192.168.0.7'],
};

export default nextConfig;
