import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-7858aae1-24d0-4301-9fbe-baaaebfb9979.space-z.ai",
  ],
};

export default nextConfig;
