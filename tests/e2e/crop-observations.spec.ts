import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Crop observations with photos and the crop health timeline (USER_WORKFLOWS.md sections 8–9).
// Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

const TODAY = todayInIndia();
const FIXTURES = path.join(__dirname, "fixtures");

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eHealth, { name: "Sunita Kumari", district: "Samastipur", village: "Pusa" });
}

async function openCrop(page: Page) {
  await page.getByRole("link", { name: /Mango farm/ }).click();
  await expect(page.getByRole("heading", { name: "Mango farm" })).toBeVisible();
  await page.getByRole("link", { name: /West plot/ }).click();
  await expect(page.getByRole("heading", { name: "West plot" })).toBeVisible();
  await page.getByRole("link", { name: /^Maize/ }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
}

/** The photos shown on the page have loaded, and were made smaller before upload. */
async function expectPhotosLoaded(page: Page, count: number) {
  const photos = page.getByTestId("observation-photo");
  await expect(photos).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await expect
      .poll(() => photos.nth(i).evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)))
      .toBeGreaterThan(0);
    expect(await photos.nth(i).evaluate((img: HTMLImageElement) => Math.max(img.naturalWidth, img.naturalHeight))).toBeLessThanOrEqual(1600);
  }
}

test("setup: a crop in the field", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Mango farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("West plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(addDays(TODAY, -40));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Crop health" })).toBeVisible();
  await expect(page.getByText("No photos or notes yet.", { exact: false })).toBeVisible();
});

test("a farmer adds a crop photo, and keeps it after a form error", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Add a crop photo" }).click();
  await expect(page.getByRole("heading", { name: "Add a crop photo" })).toBeVisible();

  // Nothing to save yet.
  await page.getByText("Looks healthy").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Add a photo or write what you noticed.")).toBeVisible();

  // Choose a photo, then make a mistake elsewhere: the photo must still be there.
  await page.getByLabel(/Photo of the crop/).setInputFiles(path.join(FIXTURES, "crop-day-20.jpg"));
  await expect(page.getByTestId("photo-preview")).toBeVisible();
  await page.getByLabel("Date").fill(addDays(TODAY, -41));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("The date cannot be before the sowing date.")).toBeVisible();
  await expect(page.getByTestId("photo-preview")).toBeVisible();

  await page.getByLabel("Date").fill(addDays(TODAY, -20));
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await expect(page.getByTestId("observation-item")).toContainText("Day 20");
  await expect(page.getByTestId("health-status")).toHaveText("Looks healthy");
  await expectPhotosLoaded(page, 1);
});

test("a file that is not a photo is refused", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Add a crop photo" }).click();
  await page.getByLabel(/Photo of the crop/).setInputFiles(path.join(FIXTURES, "not-a-photo.jpg"));
  await page.getByText("Not sure").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Please choose a photo (JPEG, PNG or WebP).")).toBeVisible();
});

test("a serious problem suggests an expert, and the timeline shows the crop over time", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Add a crop photo" }).click();
  await page.getByLabel(/Photo of the crop/).setInputFiles(path.join(FIXTURES, "crop-day-27.jpg"));
  await page.getByText("Serious problem").click();
  await expect(page.getByText("show the crop to an agriculture expert", { exact: false })).toBeVisible();
  await page.getByLabel(/What did you notice/).fill("Yellow leaves on many plants");
  await page.getByLabel("Date").fill(addDays(TODAY, -13));
  await page.getByRole("button", { name: "Save" }).click();

  // The crop page shows the latest observation.
  await expect(page.getByTestId("observation-item")).toContainText("Day 27");
  await expect(page.getByTestId("observation-item")).toContainText("Yellow leaves on many plants");

  await page.getByRole("link", { name: /See all photos and notes/ }).click();
  await expect(page.getByRole("heading", { name: "Crop health timeline" })).toBeVisible();
  const items = page.getByTestId("observation-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Day 20");
  await expect(items.nth(1)).toContainText("Day 27");
  await expect(items.nth(1)).toContainText("Serious problem");
  await expectPhotosLoaded(page, 2);
});

test("a farmer removes an observation made by mistake", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: /See all photos and notes/ }).click();
  await page.getByTestId("observation-item").nth(1).click();
  await expect(page.getByRole("heading", { name: "Crop photo and notes" })).toBeVisible();
  await page.getByRole("button", { name: "Remove this entry" }).click();
  await page.getByRole("button", { name: "Yes, remove it" }).click();

  await expect(page.getByRole("heading", { name: "Crop health timeline" })).toBeVisible();
  await expect(page.getByTestId("observation-item")).toHaveCount(1);
});

test("the crop health history is part of the season review", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: "Harvest finished" }).click();
  await page.getByRole("button", { name: "Harvest finished" }).click();
  await expect(page.getByTestId("crop-status")).toHaveText("Harvested");
  // A harvested crop no longer takes new observations.
  await expect(page.getByRole("link", { name: "Add a crop photo" })).toHaveCount(0);

  await page.getByRole("link", { name: "Review and close the season" }).click();
  await expect(page.getByTestId("health-history")).toContainText("Day 20");
  await expect(page.getByTestId("health-history")).toContainText("Looks healthy");
});
