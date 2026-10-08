import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the site from a LAN IP (e.g. phone testing)
  allowedDevOrigins: ["192.168.29.7", "192.168.*.*"],
};

export default nextConfig;
