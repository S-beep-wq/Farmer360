import { expect, test, type Page } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Weather for a plot (SYSTEM_ARCHITECTURE.md section 13). Forecasts come from a local stand-in
// shaped like Open-Meteo (tests/support/mock-anthropic.ts): day 2 heavy rain, day 3 very hot, and
// 16.7 mm of estimated rain on 2 rainy days in the past week. IMD's district warnings come from the
// same stand-in: Patna is orange today, red tomorrow.

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

test("the plot shows the estimated rain of the past week, marked as an estimate", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Mapped plot/ }).click();
  const recent = page.getByTestId("recent-rain");
  await expect(recent.getByRole("heading", { name: "Rain in the last 7 days (estimate)" })).toBeVisible();
  await expect(recent).toContainText("About 16.7 mm of rain in all, on 2 rainy days (2.5 mm or more).");
  await expect(recent.getByRole("listitem")).toHaveCount(2);
  await expect(recent.getByRole("listitem").first()).toContainText("12.4 mm");
  await expect(recent).toContainText("not measured by a rain gauge");
  await expect(page.getByRole("heading", { name: "Next 7 days (forecast)" })).toBeVisible();
});

test("IMD's official district warnings come first, with the colour written out, and IMD is linked", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Mapped plot/ }).click();
  const imd = page.getByTestId("imd-warnings");
  await expect(imd.getByRole("heading", { name: "IMD warnings for Patna district" })).toBeVisible();
  const days = imd.getByTestId("imd-day");
  await expect(days).toHaveCount(5);
  await expect(days.nth(0)).toContainText("Today · Orange: be prepared");
  await expect(days.nth(0)).toContainText("Heavy rain, Thunderstorm and lightning");
  await expect(days.nth(1)).toContainText("Red: take action");
  await expect(days.nth(1)).toContainText("Very heavy rain");
  await expect(days.nth(2)).toContainText("Green: no warning");
  await expect(days.nth(2)).toContainText("No warning");
  await expect(imd).toContainText("Official warnings from the India Meteorological Department (IMD), issued");
  const box = await imd.boundingBox();
  const forecastBox = await page.getByTestId("weather").boundingBox();
  expect(box!.y).toBeLessThan(forecastBox!.y);

  const link = page.getByTestId("imd-link");
  await expect(link).toContainText("Mausam and Meghdoot");
  await expect(link.getByRole("link", { name: "Open the IMD website" })).toHaveAttribute("href", "https://mausam.imd.gov.in/");
});

test("a plot without a location asks for one instead", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Unmapped plot/ }).click();
  await expect(page.getByText("Add the plot's location (a pin or the boundary) to see its weather.")).toBeVisible();
  await expect(page.getByTestId("weather")).toHaveCount(0);
  // District warnings and the IMD link do not need the plot's location.
  await expect(page.getByTestId("imd-day")).toHaveCount(5);
  await expect(page.getByTestId("imd-link")).toBeVisible();
});

test("the forecast is shown in Hindi too", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Weather farm/ }).click();
  await page.getByRole("link", { name: /Mapped plot/ }).click();
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "इस प्लॉट का मौसम" })).toBeVisible();
  await expect(page.getByTestId("weather-day").nth(1).getByTestId("weather-warning")).toHaveText("भारी बारिश की संभावना");
  await expect(page.getByRole("heading", { name: "पिछले 7 दिनों की बारिश (अनुमान)" })).toBeVisible();
  await expect(page.getByTestId("imd-day").nth(0)).toContainText("नारंगी: तैयार रहें");
  await expect(page.getByTestId("imd-day").nth(1)).toContainText("बहुत भारी बारिश");
  await page.getByRole("button", { name: /English/ }).click();
});
