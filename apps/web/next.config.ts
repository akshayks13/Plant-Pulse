import type { NextConfig } from "next";

// Allow images served from the backend (/uploads/**). Reads the same URL the app uses for API calls.
const api = new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: api.protocol.replace(":", "") as "http" | "https",
        hostname: api.hostname,
        port: api.port,
        pathname: "/uploads/**",
      },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
