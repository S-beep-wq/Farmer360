import type { NextConfig } from "next";

// Basic protection for every page. The camera and location are used only by the app itself
// (crop photos, plot location). A full Content-Security-Policy is still to do (docs/FIELD_READINESS.md).
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    serverActions: {
      // Crop photos are sent with Server Actions. The browser makes them smaller first (usually
      // well under 1 MB); the server accepts up to 5 MB per photo, plus room for the form fields.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
