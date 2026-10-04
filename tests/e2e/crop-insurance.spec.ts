import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Crop insurance information on a crop (USER_WORKFLOWS.md section 11). The products are test data
// loaded the way the team loads real ones (import_insurance_product), and removed afterwards.

test.describe.configure({ mode: "serial" });

const PREFIX = "e2e-insurance-";

function daysFromToday(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function product(slug: string, name: string, fields: Record<string, unknown> = {}) {
  const text = (lang: string) => ({
    name: lang === "en" ? name : `${name} (हिंदी)`,
    summary: `Summary of ${name}.`,
    eligibility: "Farmers growing notified crops in notified areas.",
    coverage: "Losses from natural calamities, pests and diseases.",
    premium: "A small share of the sum insured.",
    important_dates: "Enrolment usually closes before sowing ends.",
    claim_process: "Report crop damage to the insurance company or your bank quickly.\nKeep photos of the damage.",
  });
  return {
    slug: `${PREFIX}${slug}`,
    provider: "Test insurance programme",
    state: "Bihar",
    districts: [],
    crops: ["Wheat"],
    seasons: ["rabi"],
    enrollment_deadline: null,
    official_url: "https://example.gov.in/enrol",
    source_name: "Test official portal",
    source_url: "https://example.gov.in/insurance",
    last_verified_at: daysFromToday(-10),
    texts: { hi: text("hi"), en: text("en") },
    ...fields,
  };
}

async function cleanUp() {
  const { error } = await adminClient().from("insurance_products").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

test.beforeAll(async () => {
  await cleanUp();
  const products = [
    product("wheat-rabi", "Rabi wheat cover", { enrollment_deadline: daysFromToday(40) }),
    product("wheat-old", "Last year's wheat cover", { enrollment_deadline: daysFromToday(-30) }),
    product("wheat-kharif", "Kharif cover", { seasons: ["kharif"] }),
    product("maize", "Maize cover", { crops: ["Maize"] }),
    product("up", "Uttar Pradesh wheat cover", { state: "Uttar Pradesh" }),
  ];
  for (const p of products) {
    const { error } = await adminClient().rpc("import_insurance_product", { p });
    if (error) throw error;
  }
});

test.afterAll(cleanUp);

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eInsurance, { name: "Rajesh Kumar", district: "Vaishali", village: "Lalganj" });
}

async function openCrop(page: Page) {
  await page.getByRole("link", { name: /River farm/ }).click();
  await page.getByRole("link", { name: /Front plot/ }).click();
  await page.getByRole("link", { name: /^Wheat/ }).click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
}

test("setup: a planned rabi wheat crop", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("River farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Front plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Wheat" });
  await page.getByText("Rabi (winter)").click();
  await page.getByText("No", { exact: true }).click();
  await page.getByLabel("Planned sowing date").fill(daysFromToday(20));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
});

test("a farmer sees the insurance that covers this crop, season and place", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Crop insurance for this crop" }).click();
  await expect(page.getByRole("heading", { name: "Crop insurance" })).toBeVisible();
  await expect(page.getByText("Insurance information that covers Wheat in Rabi (winter)", { exact: false })).toBeVisible();
  await expect(page.getByTestId("eligibility-note")).toContainText("cannot promise that any claim will be paid");

  const items = page.getByTestId("insurance-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Rabi wheat cover");
  await expect(items.nth(0)).toContainText("Enrol by");
  await expect(items.nth(1)).toContainText("Last year's wheat cover");
  await expect(items.nth(1)).toContainText("Enrolment closed");
  await expect(page.getByText("Kharif cover")).toHaveCount(0);
  await expect(page.getByText("Maize cover")).toHaveCount(0);
  await expect(page.getByText("Uttar Pradesh wheat cover")).toHaveCount(0);
});

test("the details show coverage, premium, dates, how to claim and the source", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Crop insurance for this crop" }).click();
  await page.getByTestId("insurance-item").first().click();
  await expect(page.getByRole("heading", { name: "Rabi wheat cover" })).toBeVisible();
  await expect(page.getByText("Provided by: Test insurance programme")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What is covered" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Premium (what you pay)" })).toBeVisible();
  await expect(page.getByText("Enrolment usually closes before sowing ends.")).toBeVisible();
  await expect(page.getByTestId("claim-process")).toContainText("If your crop is damaged: how to report a claim");
  await expect(page.getByTestId("claim-process")).toContainText("Keep photos of the damage.");
  await expect(page.getByRole("link", { name: /Open the official website/ })).toHaveAttribute("href", "https://example.gov.in/enrol");
  await expect(page.getByTestId("scheme-source")).toContainText("Source: Test official portal");
});

test("insurance for another crop cannot be opened from this crop", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  const { data } = await adminClient().from("insurance_products").select("id").eq("slug", `${PREFIX}maize`).single();
  // Pages stream behind the loading screen, so a missing item shows the not-found screen with a
  // 200 status and a noindex tag (Next.js loading.tsx "Status Codes"); check what the farmer sees.
  await page.goto(`${page.url()}/insurance/${(data as { id: string }).id}`);
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();
  await expect(page.getByText("Maize cover")).toHaveCount(0);
});
