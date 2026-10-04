// Exports every interface text, English next to Hindi, as a CSV for a native Hindi speaker to
// review (docs/FIELD_READINESS.md). Usage: node scripts/export-translations.mjs > translations.csv
// Reviewers add their suggestion in the last column; changes are then made in
// src/lib/i18n/messages/hi.ts.

import { en } from "../src/lib/i18n/messages/en.ts";
import { hi } from "../src/lib/i18n/messages/hi.ts";

function flatten(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  );
}

const csv = (s) => `"${String(s).replaceAll('"', '""')}"`;
const hindi = new Map(flatten(hi));
console.log(["key", "english", "hindi", "suggested_hindi", "reviewer_note"].map(csv).join(","));
for (const [key, english] of flatten(en)) {
  console.log([key, english, hindi.get(key) ?? "", "", ""].map(csv).join(","));
}
