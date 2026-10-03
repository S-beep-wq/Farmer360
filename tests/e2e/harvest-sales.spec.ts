import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Harvests, sales and the crop's result (USER_WORKFLOWS.md sections 13 and 15). Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

const TODAY = todayInIndia();

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eHarvest, { name: "Arun Singh", district: "Bhojpur", village: "Arrah" });
}

async function openCrop(page: Page) {
  await page.getByRole("link", { name: /Canal farm/ }).click();
  await expect(page.getByRole("heading", { name: "Canal farm" })).toBeVisible();
  await page.getByRole("link", { name: /Big plot/ }).click();
  await expect(page.getByRole("heading", { name: "Big plot" })).toBeVisible();
  await page.getByRole("link", { name: /^Rice/ }).click();
  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();
}

test("setup: a crop in the field with a cost", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Canal farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Big plot");
  await page.getByLabel(/Plot area/).fill("3");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Rice (paddy)" });
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(addDays(TODAY, -100));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();

  await page.getByRole("link", { name: "Add a cost" }).click();
  await page.getByText("Fertiliser", { exact: true }).click();
  await page.getByLabel("Amount (₹)").fill("5,000");
  await page.getByRole("button", { name: "Save cost" }).click();
  await expect(page.getByTestId("spent-total")).toHaveText("₹5,000");
  await expect(page.getByText("No harvest recorded yet.")).toBeVisible();
});

test("a farmer records a harvest", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Record a harvest" }).click();
  await expect(page.getByRole("heading", { name: "Record a harvest" })).toBeVisible();

  await page.getByRole("button", { name: "Save harvest" }).click();
  await expect(page.getByText("Please fill this in.")).toBeVisible();

  await page.getByLabel(/How much was harvested/).fill("12");
  await page.getByRole("button", { name: "Save harvest" }).click();
  await expect(page.getByText("Choose a unit for the quantity.")).toBeVisible();

  await page.getByLabel("Harvest date").fill(addDays(TODAY, -101));
  await page.getByLabel("Unit", { exact: true }).selectOption("quintal");
  await page.getByRole("button", { name: "Save harvest" }).click();
  await expect(page.getByText("The harvest date must be after the sowing date.")).toBeVisible();

  await page.getByLabel("Harvest date").fill(addDays(TODAY, -5));
  await page.getByText("Good", { exact: true }).click();
  await page.getByRole("button", { name: "Save harvest" }).click();

  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();
  await expect(page.getByTestId("harvest-item")).toContainText("12 quintal");
  await expect(page.getByTestId("harvest-sold")).toHaveText("Sold: 0 quintal · Not sold yet: 12 quintal");
});

test("a farmer records a sale and sees the result", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Record a sale" }).click();
  await expect(page.getByRole("heading", { name: "Record a sale" })).toBeVisible();
  await expect(page.getByText("Not sold yet from this harvest: 12 quintal.")).toBeVisible();
  await expect(page.getByLabel("Unit", { exact: true })).toHaveValue("quintal");

  await page.getByText("Mandi", { exact: true }).click();
  await page.getByLabel(/How much was sold/).fill("15");
  await page.getByLabel("Price per unit (₹)").fill("2,300");
  await page.getByLabel(/Transport cost/).fill("500");
  await page.getByText("Partly paid").click();
  await page.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByText("This is more than is left unsold from this harvest.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Mandi" })).toBeChecked();

  await page.getByLabel(/How much was sold/).fill("10");
  await page.getByRole("button", { name: "Save sale" }).click();

  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();
  await expect(page.getByTestId("sale-item")).toContainText("Mandi");
  await expect(page.getByTestId("sale-item")).toContainText("10 quintal × ₹2,300 per quintal = ₹23,000");
  await expect(page.getByTestId("harvest-sold")).toHaveText("Sold: 10 quintal · Not sold yet: 2 quintal");

  // ₹23,000 − ₹5,000 spent − ₹500 transport.
  await expect(page.getByTestId("result-revenue")).toHaveText("₹23,000");
  await expect(page.getByTestId("result-net")).toHaveText("₹17,500");
  await expect(page.getByText("Net result (Profit)")).toBeVisible();
  await expect(page.getByText("Some buyers have not paid in full yet.")).toBeVisible();
});

test("a farmer updates a sale when paid", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByTestId("sale-item").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Change sale" })).toBeVisible();
  await expect(page.getByLabel("Price per unit (₹)")).toHaveValue("2300");
  await expect(page.getByText("Not sold yet from this harvest: 12 quintal.")).toBeVisible();
  await page.getByText("Paid in full").click();
  await page.getByRole("button", { name: "Save sale" }).click();

  await expect(page.getByTestId("sale-item")).toContainText("Paid in full");
  await expect(page.getByText("Some buyers have not paid in full yet.")).toHaveCount(0);
});

test("a harvest cannot be made smaller than its sales or removed while it has sales", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Change harvest" }).click();
  await expect(page.getByRole("heading", { name: "Change harvest" })).toBeVisible();

  await page.getByLabel(/How much was harvested/).fill("9");
  await page.getByRole("button", { name: "Save harvest" }).click();
  await expect(page.getByText("This is less than what you have already sold from this harvest.")).toBeVisible();

  await page.getByRole("button", { name: "Remove this entry" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();
  await expect(page.getByText("This harvest has sales. Remove its sales first.")).toBeVisible();
});

test("selling the rest leaves nothing to sell", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Record a sale" }).click();
  await page.getByText("Local trader").click();
  await page.getByLabel(/Buyer's name/).fill("Ramu");
  await page.getByLabel(/How much was sold/).fill("200");
  await page.getByLabel("Unit", { exact: true }).selectOption("kg");
  await page.getByLabel("Price per unit (₹)").fill("22");
  await page.getByText("Paid in full").click();
  await page.getByRole("button", { name: "Save sale" }).click();

  await expect(page.getByTestId("sale-item")).toHaveCount(2);
  await expect(page.getByTestId("harvest-sold")).toHaveText("Sold: 12 quintal · Not sold yet: 0 quintal");
  await expect(page.getByRole("link", { name: "Record a sale" })).toHaveCount(0);
  // ₹23,000 + ₹4,400 − ₹5,000 − ₹500.
  await expect(page.getByTestId("result-net")).toHaveText("₹21,900");
});

test("the result is shown in Hindi", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "मेरे खेत" })).toBeVisible();
  await page.getByRole("link", { name: /Canal farm/ }).click();
  await page.getByRole("link", { name: /Big plot/ }).click();
  await page.getByRole("link", { name: /^धान/ }).click();
  await expect(page.getByRole("heading", { name: "अब तक का नतीजा" })).toBeVisible();
  await expect(page.getByText("शुद्ध नतीजा (मुनाफ़ा)")).toBeVisible();
  await expect(page.getByTestId("sale-item").first()).toContainText("मंडी");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByRole("heading", { name: "Rice (paddy)" })).toBeVisible();
});
