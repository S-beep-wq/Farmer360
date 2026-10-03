// Loads checked government scheme information into Supabase (docs/SCHEMES.md).
//
//   node --env-file=.env.local scripts/import-schemes.mjs path/to/schemes.json
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. This is a tool for the Kisan 360 team,
// run by hand; the application itself never uses the secret key. Each scheme is created or
// updated (matched by "slug") in one step by public.import_scheme(), which checks every field.

import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const [file] = process.argv.slice(2);
if (!file) {
  console.error("Usage: node --env-file=.env.local scripts/import-schemes.mjs <schemes.json>");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  process.exit(2);
}

const schemes = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(schemes)) {
  console.error("The file must contain a JSON array of schemes.");
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
for (const scheme of schemes) {
  const { error } = await supabase.rpc("import_scheme", { p: scheme });
  if (error) {
    failed++;
    console.error(`✗ ${scheme?.slug ?? "(no slug)"}: ${error.message}`);
  } else {
    console.log(`✓ ${scheme.slug}`);
  }
}
console.log(`${schemes.length - failed} imported, ${failed} failed.`);
process.exit(failed ? 1 : 0);
