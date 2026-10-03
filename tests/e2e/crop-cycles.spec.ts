import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile, switchToEnglish } from "./helpers";

// Adding crops to a plot (USER_WORKFLOWS.md section 6). Uses its own farmer, created fresh by global-setup.

test.describe.configure({ mode: "serial" });

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = todayInIndia();

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eCrops, { name: "Mohan Yadav", district: "Vaishali", village: "Hajipur" });
}

async function openPlot(page: Page) {
  await page.getByRole("link", { name: /Home farm/ }).click();
  await expect(page.getByRole("heading", { name: "Home farm" })).toBeVisible();
  await page.getByRole("link", { name: /East plot/ }).click();
  await expect(page.getByRole("heading", { name: "East plot" })).toBeVisible();
}

test("setup: a farm with a plot", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Home farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await expect(page.getByRole("heading", { name: "Home farm" })).toBeVisible();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("East plot");
  await page.getByLabel(/Plot area/).fill("1.5");
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "East plot" })).toBeVisible();
});

test("a farmer plans a crop that is not sown yet", async ({ page }) => {
  await signIn(page);
  await openPlot(page);
  await expect(page.getByText("No crops recorded for this plot yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add a crop" }).click();

  await expect(page.getByRole("heading", { name: "Add a crop" })).toBeVisible();
  // The plot is confirmed before the crop is created.
  await expect(page.getByText("East plot · Home farm")).toBeVisible();

  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByText("Please choose one of the options.")).toHaveCount(3);

  await page.getByLabel("Which crop?").selectOption({ label: "Wheat" });
  await page.getByText("Rabi (winter)").click();
  await page.getByText("No", { exact: true }).click();
  await page.getByLabel("Planned sowing date").fill(addDays(TODAY, 20));
  await page.getByLabel(/Expected harvest date/).fill(addDays(TODAY, 10));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByText("The harvest date must be after the sowing date.")).toBeVisible();

  await page.getByLabel(/Expected harvest date/).fill(addDays(TODAY, 150));
  await page.getByRole("button", { name: "Save crop" }).click();

  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
  await expect(page.getByTestId("crop-status")).toHaveText("Planned");
  await expect(page.getByText("Sowing planned for")).toBeVisible();
  await expect(page.getByText("Rabi (winter)")).toBeVisible();
});

test("a farmer records a crop that is already in the field", async ({ page }) => {
  await signIn(page);
  await openPlot(page);
  await page.getByRole("link", { name: "Add a crop" }).click();

  await page.getByLabel("Which crop?").selectOption({ label: "Rice (paddy)" });
  await page.getByLabel(/Variety/).fill("Rajendra Mahsuri");
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(addDays(TODAY, 5));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByText("The sowing date cannot be in the future.", { exact: false })).toBeVisible();

  await page.getByLabel("Sowing date").fill(addDays(TODAY, -60));
  await page.getByRole("button", { name: "Save crop" }).click();

  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();
  await expect(page.getByTestId("crop-status")).toHaveText("In the field");
  await expect(page.getByText("Rajendra Mahsuri")).toBeVisible();
  await expect(page.getByText("Sown on")).toBeVisible();
});

test("the plot and farm pages show the plot's crops", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Home farm/ }).click();
  await expect(page.getByText("Now: Wheat, Rice (paddy)")).toBeVisible();

  await page.getByRole("link", { name: /East plot/ }).click();
  await expect(page.getByRole("heading", { name: "East plot" })).toBeVisible();
  const crops = page.getByRole("link", { name: /Wheat|Rice/ });
  await expect(crops).toHaveCount(2);
  await expect(page.getByTestId("crop-status")).toHaveText(["In the field", "Planned"]);
});

test("crops are shown in Hindi", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await page.getByRole("link", { name: /Home farm/ }).click();
  await expect(page.getByText("अभी: गेहूँ, धान")).toBeVisible();
  await page.getByRole("link", { name: /East plot/ }).click();
  await expect(page.getByRole("heading", { name: "फ़सलें" })).toBeVisible();
  await expect(page.getByText("खेत में लगी है")).toBeVisible();
  await switchToEnglish(page);
});

test("crop pages for unknown ids are not found", async ({ page }) => {
  await signIn(page);
  await openPlot(page);
  const plotUrl = page.url();
  await page.goto(`${plotUrl}/crops/00000000-0000-4000-8000-000000000000`);
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();
});
