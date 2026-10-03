import { expect, test, type Page } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";

import { logIn, tapMap } from "./helpers";

// Editing a farm and a plot (location, boundary and details). Uses its own farmer, created
// fresh by global-setup, so it does not depend on the other spec files.

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await logIn(page, TEST_PHONES.e2eEdit);
  // First login of this farmer: complete the profile.
  await page.waitForURL(/\/(onboarding|farms)$/);
  if (page.url().endsWith("/onboarding")) {
    await page.getByLabel("Your name").fill("Sita Devi");
    await page.getByText("English", { exact: true }).click();
    await page.getByLabel("District").fill("Nalanda");
    await page.getByLabel("Village").fill("Rajgir");
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page).toHaveURL(/\/farms$/);
}

test("setup: a farm with a plot that has a phone location and a boundary", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Old name");
  await page.getByLabel(/Total land/).fill("2");
  await page.getByText("No", { exact: true }).click();
  await page.getByRole("button", { name: "Save farm" }).click();
  await expect(page.getByRole("heading", { name: "Old name" })).toBeVisible();

  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Plot A");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toContainText("Location found");
  await page.getByRole("button", { name: "Mark the field boundary" }).click();
  await tapMap(page.getByTestId("plot-location-map"), [
    [-60, -60],
    [60, -60],
    [60, 60],
    [-60, 60],
  ]);
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Plot A" })).toBeVisible();
});

test("a farmer changes their farm's details", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Old name/ }).click();
  await expect(page.getByRole("heading", { name: "Old name" })).toBeVisible();
  await page.getByRole("link", { name: "Change details" }).click();

  await expect(page.getByRole("heading", { name: "Change farm details" })).toBeVisible();
  await expect(page.getByLabel("Farm name")).toHaveValue("Old name");
  await expect(page.getByLabel("Village")).toHaveValue("Rajgir");
  await expect(page.getByLabel(/Total land/)).toHaveValue("2");
  await expect(page.getByRole("radio", { name: "No", exact: true })).toBeChecked();

  await page.getByLabel("Farm name").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Please fill this in.")).toBeVisible();

  await page.getByLabel("Farm name").fill("Farm by the road");
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel(/Source of water/).selectOption("canal");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Farm by the road" })).toBeVisible();
  await page.getByRole("link", { name: "Change details" }).click();
  await expect(page.getByRole("heading", { name: "Change farm details" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Yes", exact: true })).toBeChecked();
  await expect(page.getByLabel(/Source of water/)).toHaveValue("canal");
});

test("a farmer renames a plot and redraws its boundary", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Farm by the road/ }).click();
  await page.getByRole("link", { name: /Plot A/ }).click();
  await expect(page.getByRole("heading", { name: "Plot A" })).toBeVisible();
  const areaBefore = await page.getByTestId("plot-map-area").textContent();

  await page.getByRole("link", { name: "Change details" }).click();
  await expect(page.getByRole("heading", { name: "Change plot details" })).toBeVisible();
  await expect(page.getByLabel("Plot name")).toHaveValue("Plot A");
  // The saved boundary is loaded, so its area is shown straight away.
  await expect(page.getByTestId("boundary-area")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove pin" })).toBeVisible();

  await page.getByLabel("Plot name").fill("Plot B");
  await page.getByRole("button", { name: "Change boundary" }).click();
  await expect(page.getByTestId("boundary-points")).toHaveText("Corners marked: 4");
  await page.getByRole("button", { name: "Clear boundary" }).click();
  await tapMap(page.getByTestId("plot-location-map"), [
    [-80, -80],
    [80, -80],
    [0, 80],
  ]);
  await expect(page.getByTestId("boundary-points")).toHaveText("Corners marked: 3");
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Plot B" })).toBeVisible();
  await expect(page.getByTestId("plot-map-area")).not.toHaveText(areaBefore ?? "");
  // The phone location was kept.
  await expect(page.getByText("Phone location")).toBeVisible();
});

test("removing the pin and boundary needs an area instead", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Farm by the road/ }).click();
  await page.getByRole("link", { name: /Plot B/ }).click();
  await expect(page.getByRole("heading", { name: "Plot B" })).toBeVisible();
  await page.getByRole("link", { name: "Change details" }).click();
  await expect(page.getByRole("heading", { name: "Change plot details" })).toBeVisible();

  await page.getByRole("button", { name: "Remove pin" }).click();
  await expect(page.getByRole("button", { name: "Remove pin" })).toHaveCount(0);
  await page.getByRole("button", { name: "Change boundary" }).click();
  await page.getByRole("button", { name: "Clear boundary" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Enter the plot area or mark the boundary on the map.")).toBeVisible();

  await page.getByLabel(/Plot area/).fill("40");
  await page.getByLabel("Unit").selectOption("decimal");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "Plot B" })).toBeVisible();
  await expect(page.getByText("40 Decimal (dismil)")).toBeVisible();
  await expect(page.getByText("No location saved for this plot.")).toBeVisible();
});

test("edit pages for farms and plots the farmer does not own are not found", async ({ page }) => {
  await signIn(page);
  const unknown = "00000000-0000-4000-8000-000000000000";
  await page.goto(`/farms/${unknown}/edit`);
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();
  await page.goto(`/farms/${unknown}/plots/${unknown}/edit`);
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();
});
