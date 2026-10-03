// Public configuration. Only NEXT_PUBLIC_* values belong here: they are bundled into the browser.
// Next.js inlines these at build time, so each one must be read with a literal property access.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  mapTileUrl:
    process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  mapTileAttribution:
    process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || "&copy; OpenStreetMap contributors",
};
