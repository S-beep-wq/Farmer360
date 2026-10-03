import { expect, test, type Page } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Weather for a plot (SYSTEM_ARCHITECTURE.md section 13). Forecasts come from a local stand-in
// shaped like Open-Meteo (tests/support/mock-anthropic.ts): day 2 heavy rain, day 3 very hot.

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eWeather, { name: "Sanjay Mahto", district: "Patna", village: "Phulwari" });
}

test("setup: one plot with its location and one without", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Weather farm");
  await page.getByRole("button", { name: "Save farm" }).click();

  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Mapped plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toHaveText(/Location found/);
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Mapped plot" })).toBeVisible();

  await page.getByRole("link", { name: "Weather farm" }).first().click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Unmapped plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Unmapped plot" })).toBeVisible();
});

test("a plot with a location shows a 7-day forecast, clearly marked, with warnings", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Mapped plot/ }).click();
  await expect(page.getByRole("heading", { name: "Weather for this plot" })).toBeVisible();

  await expect(page.getByTestId("weather-now")).toHaveText("Now (estimate): 31.2°C · Partly cloudy");
  const days = page.getByTestId("weather-day");
  await expect(days).toHaveCount(7);
  await expect(days.nth(0)).toContainText("Today");
  await expect(days.nth(0)).toContainText("24.2°C – 33.1°C");
  await expect(days.nth(1)).toContainText("Heavy rain (Rain 80.4 mm)");
  await expect(days.nth(1)).toContainText("90% chance");
  await expect(days.nth(1).getByTestId("weather-warning")).toHaveText("Heavy rain expected");
  await expect(days.nth(2).getByTestId("weather-warning")).toHaveText("Very hot day");
  await expect(days.nth(3).getByTestId("weather-warning")).toHaveCount(0);
  await expect(page.getByTestId("weather-note")).toContainText("Forecasts can be wrong");
  await expect(page.getByRole("link", { name: "Weather data by Open-Meteo.com" })).toHaveAttribute("href", "https://open-meteo.com/");
});

test("a plot without a location asks for one instead", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Unmapped plot/ }).click();
  await expect(page.getByText("Add the plot's location (a pin or the boundary) to see its weather.")).toBeVisible();
  await expect(page.getByTestId("weather")).toHaveCount(0);
});

test("the forecast is shown in Hindi too", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Mapped plot/ }).click();
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "इस प्लॉट का मौसम" })).toBeVisible();
  await expect(page.getByTestId("weather-day").nth(1).getByTestId("weather-warning")).toHaveText("भारी बारिश की संभावना");
  await page.getByRole("button", { name: /English/ }).click();
});
