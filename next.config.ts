import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Crop photos are sent with Server Actions. The browser makes them smaller first (usually
      // well under 1 MB); the server accepts up to 5 MB per photo, plus room for the form fields.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
