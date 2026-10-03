import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Work done and costs for a crop (USER_WORKFLOWS.md sections 7 and 12). Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

const TODAY = todayInIndia();

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eRecords, { name: "Rita Kumari", district: "Gaya", village: "Bodh Gaya" });
}

async function openCrop(page: Page) {
  await page.getByRole("link", { name: /River farm/ }).click();
  await expect(page.getByRole("heading", { name: "River farm" })).toBeVisible();
  await page.getByRole("link", { name: /North plot/ }).click();
  await expect(page.getByRole("heading", { name: "North plot" })).toBeVisible();
  await page.getByRole("link", { name: /^Maize/ }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
}

test("setup: a farm, a plot and a crop in the field", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("River farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("North plot");
  await page.getByLabel(/Plot area/).fill("2");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Rabi (winter)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(addDays(TODAY, -30));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await expect(page.getByText("No work recorded yet.")).toBeVisible();
  await expect(page.getByText("No costs recorded yet.")).toBeVisible();
  await expect(page.getByTestId("spent-total")).toHaveText("₹0");
});

test("a farmer records work done, with its cost", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Record work" }).click();
  await expect(page.getByRole("heading", { name: "Record work" })).toBeVisible();
  await expect(page.getByLabel("Date")).toHaveValue(TODAY);

  await page.getByRole("button", { name: "Save work" }).click();
  await expect(page.getByText("Please choose one of the options.")).toBeVisible();

  await page.getByText("Labour", { exact: true }).click();
  await page.getByLabel("Date").fill(addDays(TODAY, 1));
  await page.getByLabel(/^Quantity/).fill("3");
  await page.getByLabel(/Cost \(₹\)/).fill("1,200");
  await page.getByRole("button", { name: "Save work" }).click();
  await expect(page.getByText("The date cannot be in the future.")).toBeVisible();
  await expect(page.getByText("Choose a unit for the quantity.")).toBeVisible();

  await page.getByLabel("Date").fill(addDays(TODAY, -2));
  await page.getByLabel("Unit").selectOption("day");
  await page.getByRole("button", { name: "Save work" }).click();

  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await expect(page.getByTestId("activity-item")).toHaveCount(1);
  await expect(page.getByTestId("activity-item")).toContainText("Labour");
  await expect(page.getByTestId("activity-item")).toContainText("3 worker-day · ₹1,200");
  await expect(page.getByTestId("spent-total")).toHaveText("₹1,200");
});

test("a farmer adds a cost and sees the total", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Add a cost" }).click();
  await expect(page.getByText("do not enter it again here", { exact: false })).toBeVisible();

  await page.getByText("Seed", { exact: true }).click();
  await page.getByLabel("Amount (₹)").fill("eight hundred");
  await page.getByRole("button", { name: "Save cost" }).click();
  await expect(page.getByText("Enter an amount in rupees, for example 2500.")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Seed" })).toBeChecked();

  await page.getByLabel("Amount (₹)").fill("850");
  await page.getByLabel(/^Quantity/).fill("10");
  await page.getByLabel("Unit").selectOption("kg");
  await page.getByLabel(/Shop or person paid/).fill("Krishi Kendra");
  await page.getByRole("button", { name: "Save cost" }).click();

  await expect(page.getByTestId("expense-item")).toContainText("Seed");
  await expect(page.getByTestId("expense-item")).toContainText("₹850");
  await expect(page.getByTestId("expense-item")).toContainText("Krishi Kendra");
  await expect(page.getByTestId("spent-total")).toHaveText("₹2,050");
  await expect(page.getByText("Work: ₹1,200 · Costs: ₹850")).toBeVisible();
});

test("a farmer corrects a cost", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByTestId("expense-item").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Change cost" })).toBeVisible();
  await expect(page.getByLabel("Amount (₹)")).toHaveValue("850");
  await expect(page.getByLabel("Unit")).toHaveValue("kg");
  await page.getByLabel("Amount (₹)").fill("900");
  await page.getByRole("button", { name: "Save cost" }).click();

  await expect(page.getByTestId("expense-item")).toContainText("₹900");
  await expect(page.getByTestId("spent-total")).toHaveText("₹2,100");
});

test("a farmer removes an entry made by mistake, after confirming", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByTestId("activity-item").getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Change work entry" })).toBeVisible();

  await page.getByRole("button", { name: "Remove this entry" }).click();
  await page.getByRole("button", { name: "No, keep it" }).click();
  await page.getByRole("button", { name: "Remove this entry" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();

  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await expect(page.getByText("No work recorded yet.")).toBeVisible();
  await expect(page.getByTestId("spent-total")).toHaveText("₹900");
});

test("work and costs are shown in Hindi", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "मेरे खेत" })).toBeVisible();
  await page.getByRole("link", { name: /River farm/ }).click();
  await page.getByRole("link", { name: /North plot/ }).click();
  await page.getByRole("link", { name: /^मक्का/ }).click();
  await expect(page.getByRole("heading", { name: "मक्का" })).toBeVisible();
  await expect(page.getByText("अब तक कुल खर्च")).toBeVisible();
  await expect(page.getByTestId("expense-item")).toContainText("बीज");
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
});

test("record pages for unknown entries are not found", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  const cropUrl = page.url();
  await page.goto(`${cropUrl}/expenses/00000000-0000-4000-8000-000000000000/edit`);
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();
});
