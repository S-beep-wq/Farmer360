import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { acceptNotice, logIn, logInWithProfile } from "./helpers";

// Field-readiness: an automated accessibility check (axe-core, WCAG 2.1 A and AA, plus 2.2 AA such as target size) of every main
// screen, for a farmer with real-looking data and for a buyer, in English and in Hindi.
// Automated checks find only part of the problems; testing with farmers is still needed.

test.describe.configure({ mode: "serial" });

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const pages: Record<string, string> = {};

function daysAgo(n: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

type Finding = { page: string; id: string; impact: string | null | undefined; help: string; nodes: string[] };

async function audit(page: Page, name: string): Promise<Finding[]> {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Map tiles come from an external tile server that tests cannot reach.
    .exclude(".leaflet-tile-pane")
    .analyze();
  return results.violations.map((v) => ({ page: name, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
}

async function auditAll(page: Page, entries: [string, string][]) {
  const findings: Finding[] = [];
  for (const [name, url] of entries) {
    await page.goto(url);
    findings.push(...(await audit(page, name)));
  }
  return findings;
}

function report(findings: Finding[]) {
  return findings.map((f) => `${f.page}: [${f.impact}] ${f.id} — ${f.help} — ${f.nodes.join(" | ")}`).join("\n");
}

test("signed-out and onboarding screens", async ({ page }) => {
  await page.goto("/login");
  const findings = await audit(page, "login");
  await page.goto("/privacy");
  findings.push(...(await audit(page, "privacy notice")));
  await logIn(page, TEST_PHONES.e2eA11yFarmer, { acceptNotice: false });
  await page.waitForURL(/\/consent$/);
  findings.push(...(await audit(page, "consent")));
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.getByText("Tick the box to agree.")).toBeVisible();
  findings.push(...(await audit(page, "consent (error)")));
  await acceptNotice(page);
  await page.waitForURL(/\/onboarding$/);
  findings.push(...(await audit(page, "onboarding")));
  await page.goto("/onboarding/buyer");
  findings.push(...(await audit(page, "buyer onboarding")));
  expect(findings, report(findings)).toEqual([]);
});

test("setup: a farmer with a farm, a mapped plot, a crop with records and a photo", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.e2eA11yFarmer, { name: "Asha Devi", district: "Patna", village: "Bihta" });
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Audit farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await expect(page.getByRole("heading", { name: "Audit farm" })).toBeVisible();
  pages.farm = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Add a plot" }).click();
  await expect(page.getByRole("heading", { name: "Add a plot" })).toBeVisible();
  pages.newPlot = new URL(page.url()).pathname;
  await page.getByLabel("Plot name").fill("Audit plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toHaveText(/Location found/);
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Audit plot" })).toBeVisible();
  pages.plot = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Add a crop" }).click();
  await expect(page.getByRole("heading", { name: "Add a crop" })).toBeVisible();
  pages.newCrop = new URL(page.url()).pathname;
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(daysAgo(40));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  pages.crop = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Add a crop photo" }).click();
  await page.getByLabel(/Photo of the crop/).setInputFiles(path.join(__dirname, "fixtures", "crop-day-20.jpg"));
  await page.getByText("Some problem").click();
  await page.getByLabel(/What did you notice/).fill("Yellow lower leaves");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await page.getByRole("link", { name: /See all photos and notes/ }).click();
  await page.getByTestId("observation-item").first().click();
  pages.observation = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Ask AI to look at the photo" }).click();
  await expect(page.getByTestId("ai-analysis")).toHaveCount(1, { timeout: 20_000 });
});

test("farmer screens (English)", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.e2eA11yFarmer, { name: "Asha Devi", district: "Patna", village: "Bihta" });
  const crop = pages.crop;
  const findings = await auditAll(page, [
    ["farms", "/farms"],
    ["new farm", "/farms/new"],
    ["farm", pages.farm],
    ["farm edit", `${pages.farm}/edit`],
    ["new plot", pages.newPlot],
    ["plot", pages.plot],
    ["plot edit", `${pages.plot}/edit`],
    ["plan", `${pages.plot}/plan?season=kharif`],
    ["new crop", pages.newCrop],
    ["crop", crop],
    ["crop edit", `${crop}/edit`],
    ["harvest finished", `${crop}/harvest`],
    ["cancel crop", `${crop}/cancel`],
    ["new activity", `${crop}/activities/new`],
    ["new expense", `${crop}/expenses/new`],
    ["new harvest", `${crop}/harvests/new`],
    ["observations", `${crop}/observations`],
    ["new observation", `${crop}/observations/new`],
    ["observation with AI answer", pages.observation],
    ["insurance", `${crop}/insurance`],
    ["market", "/market"],
    ["schemes", "/schemes"],
    ["assistant", "/assistant"],
    ["profile", "/profile"],
    ["profile edit", "/profile/edit"],
    ["delete account", "/profile/delete"],
  ]);
  // A form with its errors showing.
  await page.goto("/farms/new");
  await page.getByRole("button", { name: "Save farm" }).click();
  await expect(page.getByText("Please fill this in.").first()).toBeVisible();
  findings.push(...(await audit(page, "new farm with errors")));
  expect(findings, report(findings)).toEqual([]);
});

test("farmer screens (Hindi)", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.e2eA11yFarmer, { name: "Asha Devi", district: "Patna", village: "Bihta" });
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "मेरे खेत" })).toBeVisible();
  const findings = await auditAll(page, [
    ["farms (hi)", "/farms"],
    ["plot (hi)", pages.plot],
    ["crop (hi)", pages.crop],
    ["observation (hi)", pages.observation],
    ["assistant (hi)", "/assistant"],
    ["privacy notice (hi)", "/privacy"],
  ]);
  await page.getByRole("button", { name: /English/ }).click();
  expect(findings, report(findings)).toEqual([]);
});

test("buyer screens", async ({ page }) => {
  await logIn(page, TEST_PHONES.e2eA11yBuyer);
  await page.waitForURL(/\/onboarding$/);
  await page.goto("/onboarding/buyer");
  await page.getByLabel("Your name").fill("Audit Buyer");
  await page.getByLabel("What kind of buyer are you?").selectOption({ label: "Local trader" });
  await page.getByLabel("District").fill("Patna");
  await page.getByLabel("Town or market where you buy").fill("Bihta");
  await page.getByRole("button", { name: "Register as a buyer" }).click();
  await expect(page).toHaveURL(/\/buyer$/);
  const findings = await auditAll(page, [
    ["buyer home", "/buyer"],
    ["new demand", "/buyer/demands/new"],
    ["buyer profile", "/buyer/profile"],
    ["buyer profile edit", "/buyer/profile/edit"],
  ]);
  expect(findings, report(findings)).toEqual([]);
});
