import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// AI crop-health assistance (PRODUCT_SPEC.md section 16, USER_WORKFLOWS.md sections 8 and 18).
// The app talks to a local stand-in for the Anthropic API (tests/support/mock-anthropic.ts); a
// marker in the farmer's note picks its answer.

test.describe.configure({ mode: "serial" });

const PHOTO = path.join(__dirname, "fixtures", "crop-day-20.jpg");

function daysAgo(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eAi, { name: "Manoj Paswan", district: "Vaishali", village: "Bidupur" });
}

async function openCrop(page: Page) {
  await page.getByRole("link", { name: /AI farm/ }).click();
  await page.getByRole("link", { name: /Back plot/ }).click();
  await page.getByRole("link", { name: /^Maize/ }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
}

/** Adds an observation and opens it. */
async function observe(page: Page, note: string, opts: { photo: boolean; status?: string }) {
  await openCrop(page);
  await page.getByRole("link", { name: "Add a crop photo", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add a crop photo" })).toBeVisible();
  if (opts.photo) await page.getByLabel(/Photo of the crop/).setInputFiles(PHOTO);
  await page.getByText(opts.status ?? "Some problem").click();
  await page.getByLabel(/What did you notice/).fill(note);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  await page.getByRole("link", { name: /See all photos and notes/ }).click();
  await page.getByTestId("observation-item").filter({ hasText: note }).click();
  await expect(page.getByRole("heading", { name: "Crop photo and notes" })).toBeVisible();
}

test("setup: maize in the field", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("AI farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Back plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(daysAgo(30));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
});

test("a farmer asks AI about a photo and sees possible causes, uncertainty and a clear warning", async ({ page }) => {
  await signIn(page);
  await observe(page, "Lower leaves turning yellow", { photo: true });

  const section = page.getByTestId("ai-section");
  await expect(section).toContainText("Your name and mobile number are not sent.");
  await section.getByRole("button", { name: "Ask AI to look at the photo" }).click();

  const card = page.getByTestId("ai-analysis");
  await expect(card).toHaveCount(1, { timeout: 20_000 });
  await expect(card.getByTestId("ai-confidence")).toHaveText("AI is not fully sure");
  await expect(card.getByTestId("ai-cause").first()).toContainText("Nitrogen shortage");
  await expect(card.getByTestId("ai-cause").first()).toContainText("(possible)");
  await expect(card).toContainText("What you can check or do");
  await expect(card).toContainText("A close photo of one yellow leaf, both sides.");
  await expect(card.getByTestId("ai-disclaimer")).toContainText("not a diagnosis");
  await expect(card.getByTestId("ai-expert")).toHaveCount(0);

  // The farmer's own observation is unchanged.
  await expect(page.getByTestId("health-status")).toHaveText("Some problem");
  await expect(page.getByText("Lower leaves turning yellow")).toBeVisible();

  await card.getByRole("button", { name: "Yes" }).click();
  await expect(card).toContainText("Thank you. You said: Yes");
});

test("after 3 answers on one photo, the farmer is pointed to an expert instead", async ({ page }) => {
  await signIn(page);
  await openCrop(page);
  await page.getByRole("link", { name: /See all photos and notes/ }).click();
  await page.getByTestId("observation-item").filter({ hasText: "Lower leaves turning yellow" }).click();
  for (const expected of [2, 3]) {
    await page.getByRole("button", { name: "Ask AI again" }).click();
    await expect(page.getByTestId("ai-analysis")).toHaveCount(expected, { timeout: 20_000 });
  }
  await expect(page.getByRole("button", { name: /Ask AI/ })).toHaveCount(0);
  await expect(page.getByText("You have asked about this photo 3 times.", { exact: false })).toBeVisible();
});

test("an unclear photo and a serious problem lead to an expert", async ({ page }) => {
  await signIn(page);
  await observe(page, "Far away photo [blurry]", { photo: true, status: "Serious problem" });
  await page.getByRole("button", { name: "Ask AI to look at the photo" }).click();
  const card = page.getByTestId("ai-analysis");
  await expect(card).toHaveCount(1, { timeout: 20_000 });
  await expect(card.getByTestId("ai-confidence")).toHaveText("AI is not sure");
  await expect(card).toContainText("The AI could not see the crop clearly enough in this photo.");
  await expect(card.getByTestId("ai-cause")).toHaveCount(0);
  await expect(card.getByTestId("ai-expert")).toContainText("Show the crop to an agriculture expert");
});

test("when the AI cannot answer, the farmer is told and nothing is saved", async ({ page }) => {
  await signIn(page);
  await observe(page, "Spots on leaves [fail]", { photo: true });
  await page.getByRole("button", { name: "Ask AI to look at the photo" }).click();
  await expect(page.getByText("AI help is not available right now.", { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("ai-analysis")).toHaveCount(0);
});

test("there is no AI help for an observation without a photo", async ({ page }) => {
  await signIn(page);
  await observe(page, "Plants look short", { photo: false });
  await expect(page.getByTestId("ai-section")).toHaveCount(0);
});
