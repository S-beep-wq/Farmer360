// Loads checked official information into Supabase: government schemes (docs/SCHEMES.md), crop
// insurance (docs/INSURANCE.md) or crop reference data for planning (docs/CROP_REFERENCES.md).
//
//   node --env-file=.env.local scripts/import-official-data.mjs schemes path/to/schemes.json
//   node --env-file=.env.local scripts/import-official-data.mjs insurance path/to/insurance.json
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. This is a tool for the Kisan 360 team,
// run by hand; the application itself never uses the secret key. Each item is created or updated
// (matched by "slug") in one step by a database function that checks every field.

import { readFile } from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";

const FUNCTIONS = { schemes: "import_scheme", insurance: "import_insurance_product", "crop-references": "import_crop_reference" };

const [kind, file] = process.argv.slice(2);
if (!(kind in FUNCTIONS) || !file) {
  console.error("Usage: node --env-file=.env.local scripts/import-official-data.mjs <schemes|insurance|crop-references> <file.json>");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  process.exit(2);
}

const items = JSON.parse(await readFile(file, "utf8"));
if (!Array.isArray(items)) {
  console.error("The file must contain a JSON array.");
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
for (const item of items) {
  const { error } = await supabase.rpc(FUNCTIONS[kind], { p: item });
  if (error) {
    failed++;
    console.error(`✗ ${item?.slug ?? "(no slug)"}: ${error.message}`);
  } else {
    console.log(`✓ ${item.slug}`);
  }
}
console.log(`${items.length - failed} imported, ${failed} failed.`);
process.exit(failed ? 1 : 0);
