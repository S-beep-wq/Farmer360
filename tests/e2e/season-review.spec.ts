import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Season review (USER_WORKFLOWS.md section 16): review a harvested crop, close it, and look back.
// Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

const TODAY = todayInIndia();

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eSeason, { name: "Kiran Devi", district: "Muzaffarpur", village: "Kanti" });
}

async function openPlot(page: Page) {
  await page.getByRole("link", { name: /Pond farm/ }).click();
  await expect(page.getByRole("heading", { name: "Pond farm" })).toBeVisible();
  await page.getByRole("link", { name: /South plot/ }).click();
  await expect(page.getByRole("heading", { name: "South plot" })).toBeVisible();
}

async function openCrop(page: Page) {
  await openPlot(page);
  await page.getByRole("link", { name: /^Wheat/ }).click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
}

test("setup: a crop with costs, a harvest and a sale, whose harvest is finished", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Pond farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("South plot");
  await page.getByLabel(/Plot area/).fill("2");
  await page.getByRole("button", { name: "Save plot" }).click();

  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Wheat" });
  await page.getByText("Rabi (winter)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(addDays(TODAY, -120));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();

  await page.getByRole("link", { name: "Record work" }).click();
  await page.getByText("Labour", { exact: true }).click();
  await page.getByLabel(/Cost \(₹\)/).fill("1000");
  await page.getByRole("button", { name: "Save work" }).click();
  await page.getByRole("link", { name: "Add a cost" }).click();
  await page.getByText("Seed", { exact: true }).click();
  await page.getByLabel("Amount (₹)").fill("5000");
  await page.getByRole("button", { name: "Save cost" }).click();
  await expect(page.getByTestId("spent-total")).toHaveText("₹6,000");

  await page.getByRole("link", { name: "Record a harvest" }).click();
  await page.getByLabel("Harvest date").fill(addDays(TODAY, -5));
  await page.getByLabel(/How much was harvested/).fill("12");
  await page.getByLabel("Unit", { exact: true }).selectOption("quintal");
  await page.getByRole("button", { name: "Save harvest" }).click();
  await page.getByRole("link", { name: "Record a sale" }).click();
  await page.getByText("Mandi", { exact: true }).click();
  await page.getByLabel(/How much was sold/).fill("10");
  await page.getByLabel("Price per unit (₹)").fill("2300");
  await page.getByLabel(/Transport cost/).fill("500");
  await page.getByText("Partly paid").click();
  await page.getByRole("button", { name: "Save sale" }).click();

  await page.getByRole("link", { name: "Harvest finished" }).click();
  await page.getByRole("button", { name: "Harvest finished" }).click();
  await expect(page.getByTestId("crop-status")).toHaveText("Harvested");
});

test("a farmer reviews the season and closes the crop", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Review and close the season" }).click();

  await expect(page.getByRole("heading", { name: "Season review" })).toBeVisible();
  await expect(page.getByText("120 days in the field", { exact: false })).toBeVisible();
  await expect(page.getByTestId("review-total-cost")).toHaveText("₹6,000");
  await expect(page.getByTestId("review-harvested")).toHaveText("12 quintal");
  await expect(page.getByTestId("review-per-acre")).toHaveText("6 quintal");
  // ₹23,000 − ₹6,000 − ₹500.
  await expect(page.getByTestId("review-net")).toHaveText("₹16,500");
  await expect(page.getByText("Net result (Profit)")).toBeVisible();
  await expect(page.getByTestId("review-work")).toHaveText("Labour ×1");
  await expect(page.getByTestId("review-reminders")).toContainText("Not sold yet: 2 quintal.");
  await expect(page.getByTestId("review-reminders")).toContainText("Sales not fully paid: 1.");

  await page.getByLabel(/Notes for next season/).fill("Sow two weeks earlier. Try the FPO next time.");
  await page.getByRole("button", { name: "Save season and close crop" }).click();

  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
  await expect(page.getByTestId("crop-status")).toHaveText("Completed");
  await expect(page.getByText("Season closed on", { exact: false })).toBeVisible();
  // Closed: no more changes to the crop or its records.
  for (const name of ["Change details", "Record work", "Add a cost", "Record a harvest", "Change harvest", "Review and close the season"]) {
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  }
});

test("a farmer marks a sale as paid after the season is closed", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByTestId("sale-item").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Payment for this sale" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Partly paid" })).toBeChecked();
  await page.getByText("Paid in full").click();
  await page.getByRole("button", { name: "Save payment" }).click();

  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
  await expect(page.getByTestId("sale-item")).toContainText("Paid in full");
});

test("the closed season can be looked at again, and its result is shown on the plot", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "View season review" }).click();
  await expect(page.getByTestId("review-notes")).toHaveText("Sow two weeks earlier. Try the FPO next time.");
  await expect(page.getByRole("button", { name: "Save season and close crop" })).toHaveCount(0);
  await expect(page.getByTestId("review-reminders")).toHaveCount(0);

  await page.getByRole("link", { name: "Wheat" }).first().click();
  await page.getByRole("link", { name: "South plot" }).first().click();
  await expect(page.getByTestId("past-result")).toHaveText("Profit: ₹16,500");
});

test("the season review is only for harvested or closed crops", async ({ page }) => {
  await signIn(page);
  await openPlot(page);
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Zaid (summer)").click();
  await page.getByText("No", { exact: true }).click();
  await page.getByLabel("Planned sowing date").fill(addDays(TODAY, 30));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  const cropUrl = page.url();

  await page.goto(`${cropUrl}/review`);
  await expect(page).toHaveURL(cropUrl);
});
