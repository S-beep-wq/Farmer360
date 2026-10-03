import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Government scheme information (USER_WORKFLOWS.md section 10). The schemes here are test data
// loaded the way the team loads real ones (import_scheme), and removed afterwards.

test.describe.configure({ mode: "serial" });

const PREFIX = "e2e-scheme-";

function daysFromToday(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function scheme(slug: string, name: string, fields: Record<string, unknown> = {}) {
  const text = (lang: string) => ({
    name: lang === "en" ? name : `${name} (हिंदी)`,
    summary: `Summary of ${name}.`,
    eligibility: "Farmers who own or cultivate land in the district.\nCheck the official rules.",
    benefit: "Seed at half price.",
    required_documents: ["Aadhaar card", "Land record (LPC)"],
    how_to_apply: "Apply online or at the block agriculture office.",
  });
  return {
    slug: `${PREFIX}${slug}`,
    department: "Department of Agriculture, Bihar",
    state: "Bihar",
    districts: [],
    crops: [],
    seasons: [],
    application_deadline: null,
    official_url: "https://example.gov.in/apply",
    source_name: "Test official portal",
    source_url: "https://example.gov.in/scheme",
    last_verified_at: daysFromToday(-10),
    texts: { hi: text("hi"), en: text("en") },
    ...fields,
  };
}

async function cleanUp() {
  const { error } = await adminClient().from("government_schemes").delete().like("slug", `${PREFIX}%`);
  if (error) throw error;
}

test.beforeAll(async () => {
  await cleanUp();
  const schemes = [
    scheme("wheat-seed", "Wheat seed help", { districts: ["Vaishali"], crops: ["Wheat"], seasons: ["rabi"], application_deadline: daysFromToday(30) }),
    scheme("all-india", "All India farmer support", { state: null, last_verified_at: daysFromToday(-300) }),
    scheme("maize", "Maize drying help", { crops: ["Maize"] }),
    scheme("closed", "Old pump scheme", { application_deadline: daysFromToday(-5) }),
    scheme("up-only", "Uttar Pradesh scheme", { state: "Uttar Pradesh" }),
    scheme("archived", "Archived scheme", { status: "ARCHIVED" }),
  ];
  for (const s of schemes) {
    const { error } = await adminClient().rpc("import_scheme", { p: s });
    if (error) throw error;
  }
});

test.afterAll(cleanUp);

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eSchemes, { name: "Kavita Devi", district: "Vaishali", village: "Hajipur" });
}

test("setup: a wheat crop for the coming rabi season", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Home farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Big plot");
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

test("a farmer sees the schemes that may be relevant, and why", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Government schemes" }).click();
  await expect(page.getByRole("heading", { name: "Government schemes", level: 1 })).toBeVisible();
  await expect(page.getByTestId("eligibility-note")).toContainText("Kisan 360 cannot tell you whether you are eligible.");

  const relevant = page.locator("section", { has: page.getByRole("heading", { name: "May be relevant for you" }) }).getByTestId("scheme-item");
  await expect(relevant).toHaveCount(2);
  await expect(relevant.nth(0)).toContainText("Wheat seed help");
  await expect(relevant.nth(0)).toContainText("For farmers in Vaishali district");
  await expect(relevant.nth(0)).toContainText("Your crops: Wheat · Rabi (winter)");
  await expect(relevant.nth(0)).toContainText("Apply by");
  await expect(relevant.nth(1)).toContainText("All India farmer support");
  await expect(relevant.nth(1)).toContainText("Applies across India");

  const other = page.getByTestId("other-schemes").getByTestId("scheme-item");
  await expect(other).toHaveCount(2);
  await expect(page.getByTestId("other-schemes")).toContainText("Old pump scheme");
  await expect(page.getByTestId("other-schemes")).toContainText("Deadline passed");
  await expect(page.getByTestId("other-schemes")).toContainText("Maize drying help");

  await expect(page.getByText("Uttar Pradesh scheme")).toHaveCount(0);
  await expect(page.getByText("Archived scheme")).toHaveCount(0);
});

test("a scheme's details show the rules, documents, official route and source", async ({ page }) => {
  await signIn(page);
  await page.goto("/schemes");
  await page.getByRole("link", { name: /Wheat seed help/ }).click();
  await expect(page.getByRole("heading", { name: "Wheat seed help" })).toBeVisible();
  await expect(page.getByText("Department: Department of Agriculture, Bihar")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who can apply (official rules)" })).toBeVisible();
  await expect(page.getByText("Farmers who own or cultivate land in the district.", { exact: false })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Land record (LPC)" })).toBeVisible();
  await expect(page.getByTestId("eligibility-note")).toBeVisible();
  await expect(page.getByTestId("stale-note")).toHaveCount(0);

  const official = page.getByRole("link", { name: /Open the official website/ });
  await expect(official).toHaveAttribute("href", "https://example.gov.in/apply");
  await expect(official).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("scheme-source")).toContainText("Source: Test official portal");
  await expect(page.getByTestId("scheme-source")).toContainText("Information checked on");
});

test("old information is flagged, and the Hindi text is shown in Hindi", async ({ page }) => {
  await signIn(page);
  await page.goto("/schemes");
  await page.getByRole("link", { name: /All India farmer support/ }).click();
  await expect(page.getByTestId("stale-note")).toContainText("checked more than 6 months ago");

  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "All India farmer support (हिंदी)" })).toBeVisible();
  await expect(page.getByTestId("eligibility-note")).toContainText("किसान 360 यह नहीं बता सकता");
  await page.getByRole("button", { name: /English/ }).click();
});

test("an unknown scheme address shows not found", async ({ page }) => {
  await signIn(page);
  const response = await page.goto("/schemes/not-a-scheme");
  expect(response?.status()).toBe(404);
});
