import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Reference estimates in crop planning (USER_WORKFLOWS.md section 5). The references are test
// data loaded the way the team loads real ones (import_crop_reference), and removed afterwards.

test.describe.configure({ mode: "serial" });

const PREFIX = "e2e-ref-";
let plotPath: string;

function daysAgo(n: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function reference(slug: string, crop: string, fields: Record<string, unknown> = {}) {
  const text = (lang: string) => ({ input_needs: `Good seed and compost (${lang})`, production_risks: `Late sowing lowers the harvest (${lang})`, market_notes: null });
  return {
    slug: `${PREFIX}${slug}`,
    crop,
    season: "rabi",
    state: "Bihar",
    districts: [],
    duration_days_min: 110,
    duration_days_max: 130,
    water_need: "MEDIUM",
    labour_days_per_acre_min: 20,
    labour_days_per_acre_max: 30,
    cost_per_acre_min: 15000,
    cost_per_acre_max: 20000,
    yield_kg_per_acre_min: 1200,
    yield_kg_per_acre_max: 1600,
    price_per_quintal_min: 2000,
    price_per_quintal_max: 2400,
    source_name: "Test agri source",
    source_url: "https://example.gov.in/costs",
    last_verified_at: daysAgo(10),
    texts: { hi: text("hi"), en: text("en") },
    ...fields,
  };
}

async function cleanUp() {
  const { error } = await adminClient().from("crop_references").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

test.beforeAll(async () => {
  await cleanUp();
  for (const r of [
    reference("wheat", "Wheat"),
    reference("mustard-old", "Mustard", { last_verified_at: daysAgo(300), cost_per_acre_min: null, cost_per_acre_max: null }),
    reference("wheat-up", "Wheat", { state: "Uttar Pradesh", source_name: "Other state source" }),
  ]) {
    const { error } = await adminClient().rpc("import_crop_reference", { p: r });
    if (error) throw error;
  }
});

test.afterAll(cleanUp);

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eReferences, { name: "Pooja Kumari", district: "Gaya", village: "Bodh Gaya" });
}

test("setup: a plot", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Reference farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Field one");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Field one" })).toBeVisible();
  plotPath = new URL(page.url()).pathname;
});

test("planning shows reference estimates apart from the farmer's records, with their source", async ({ page }) => {
  await signIn(page);
  await page.goto(`${plotPath}/plan?season=rabi`);
  await expect(page.getByTestId("facts-note")).toContainText("reference estimates are typical ranges from the named source");

  const others = page.getByTestId("other-crops").getByTestId("candidate");
  // Crops usually grown in rabi come first among the others (in catalog order).
  await expect(others.nth(0).getByRole("heading", { level: 3 })).toHaveText("Mustard");
  await expect(others.nth(1).getByRole("heading", { level: 3 })).toHaveText("Wheat");

  const wheat = others.nth(1);
  await expect(wheat).toContainText("Usually grown in this season");
  const box = wheat.getByTestId("reference");
  await expect(box).toContainText("Reference estimates (not your records)");
  await expect(box).toContainText("110 days to 130 days");
  await expect(box).toContainText("20 to 30 person-days per acre");
  await expect(box).toContainText("₹15,000 to ₹20,000");
  await expect(box).toContainText("12 quintal to 16 quintal");
  await expect(box.getByTestId("reference-margin")).toHaveText("₹4,000 to ₹23,400");
  await expect(box).toContainText("Late sowing lowers the harvest (en)");
  await expect(box.getByTestId("reference-source")).toContainText("Source: Test agri source");
  await expect(box.getByTestId("stale-note")).toHaveCount(0);
  await expect(page.getByText("Other state source")).toHaveCount(0);

  const mustard = others.nth(0).getByTestId("reference");
  await expect(mustard.getByTestId("stale-note")).toBeVisible();
  await expect(mustard.getByTestId("reference-margin")).toHaveCount(0);

  const maize = page.getByTestId("candidate").filter({ has: page.getByRole("heading", { name: "Maize", level: 3 }) });
  await expect(maize.getByTestId("reference")).toHaveCount(0);
});

test("a season without reference data says that there are no estimates", async ({ page }) => {
  await signIn(page);
  await page.goto(`${plotPath}/plan?season=kharif`);
  await expect(page.getByTestId("facts-note")).toContainText("Kisan 360 does not estimate costs, harvests or prices yet.");
  await expect(page.getByTestId("reference")).toHaveCount(0);
});
