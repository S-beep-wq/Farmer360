import { expect, test, type Page } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";

import { logIn as logInAs, sendCode, switchToEnglish, tapMap } from "./helpers";

// The first vertical slice: register → profile → farm → plot with location and boundary → view.
// Tests run in order and share one farmer (the e2e test phone), created fresh by global-setup.

test.describe.configure({ mode: "serial" });

async function logIn(page: Page) {
  await logInAs(page, TEST_PHONES.e2e);
}

test("a signed-out visitor is sent to the login page, in Hindi by default", async ({ page }) => {
  await page.goto("/farms");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "अपने मोबाइल नंबर से लॉग इन करें" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
});

test("login rejects an invalid phone number and a wrong code", async ({ page }) => {
  await page.goto("/login");
  await switchToEnglish(page);
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("Enter a 10-digit mobile number.")).toBeVisible();

  await sendCode(page, TEST_PHONES.e2eWrongCode.replace("+91", ""));
  await page.getByLabel("Code from SMS").fill("000000");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("The code is wrong or has expired. Please try again.")).toBeVisible();
});

test("a new farmer registers, creates a farm and a plot with location and boundary, and sees them", async ({ page }) => {
  // 1. Register with phone + OTP.
  await logIn(page);

  // 2. Farmer profile.
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please fill this in.").first()).toBeVisible();
  await page.getByLabel("Your name").fill("Ramesh Kumar");
  await page.getByText("English", { exact: true }).click();
  await expect(page.getByLabel("State")).toHaveValue("Bihar");
  await page.getByLabel("District").fill("Patna");
  await page.getByLabel("Village").fill("Bihta");
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Create a farm.
  await expect(page).toHaveURL(/\/farms$/);
  await expect(page.getByText("Namaste, Ramesh Kumar")).toBeVisible();
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await expect(page.getByLabel("Village")).toHaveValue("Bihta");
  await page.getByLabel("Farm name").fill("Near the house");
  await page.getByLabel(/Total land/).fill("3");
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel(/Source of water/).selectOption("tubewell");
  await page.getByLabel(/Soil type/).selectOption("loam");
  await page.getByRole("button", { name: "Save farm" }).click();

  await expect(page.getByRole("heading", { name: "Near the house" })).toBeVisible();
  await expect(page.getByText("No plots yet.", { exact: false })).toBeVisible();

  // 4. Create a plot.
  await page.getByRole("link", { name: "Add a plot" }).click();
  await expect(page.getByRole("heading", { name: "Add a plot" })).toBeVisible();
  await page.getByLabel("Plot name").fill("Plot 1");

  // Saving without an area or boundary explains what is missing.
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByText("Enter the plot area or mark the boundary on the map.")).toBeVisible();
  await expect(page.getByLabel("Plot name")).toHaveValue("Plot 1");

  // 5. Capture the location from the phone (geolocation is granted for this test).
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toHaveText("Location found (accurate to about 9 m)");

  // 6. Draw the boundary by tapping four corners around the centre of the map.
  await page.getByRole("button", { name: "Mark the field boundary" }).click();
  const map = page.getByTestId("plot-location-map");
  await tapMap(map, [
    [-60, -60],
    [60, -60],
    [60, 60],
    [-60, 60],
  ]);
  await expect(page.getByTestId("boundary-points")).toHaveText("Corners marked: 4");
  await expect(page.getByTestId("boundary-area")).toContainText("Area from map: about");

  // Undo and redo the last corner.
  await page.getByRole("button", { name: "Undo last corner" }).click();
  await expect(page.getByTestId("boundary-points")).toHaveText("Corners marked: 3");
  await tapMap(map, [[-60, 60]]);
  await page.getByRole("button", { name: "Done" }).click();

  // Use the measured area as the plot area.
  await page.getByRole("button", { name: "Use this area" }).click();
  await expect(page.getByLabel(/Plot area/)).not.toHaveValue("");

  // 7. Store the plot.
  await page.getByRole("button", { name: "Save plot" }).click();

  // 8. Display the plot.
  await expect(page.getByRole("heading", { name: "Plot 1" })).toBeVisible();
  await expect(page.getByTestId("plot-map-area")).toContainText("Acre");
  await expect(page.getByText("Phone location")).toBeVisible();
  await expect(page.getByText("Accuracy: about 9 m")).toBeVisible();
  await expect(page.getByTestId("plots-map")).toBeVisible();
  await expect(page.locator(".leaflet-interactive")).toHaveCount(1); // the boundary polygon

  // 9. Display the farm with its plot.
  await page.getByRole("link", { name: "Near the house" }).first().click();
  await expect(page.getByRole("heading", { name: "Near the house" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Plot 1/ })).toBeVisible();
  await expect(page.getByTestId("plots-map")).toBeVisible();

  await page.getByRole("link", { name: "All farms" }).click();
  await expect(page.getByText("Plots: 1")).toBeVisible();
});

test("a plot can be placed with a map pin when location permission is not given", async ({ page, context }) => {
  await context.clearPermissions();
  await logIn(page);
  await expect(page).toHaveURL(/\/farms$/);
  await page.getByRole("link", { name: /Near the house/ }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();

  await page.getByLabel("Plot name").fill("Near the canal");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toHaveText(
    "Location permission was not given. You can tap the map to place the pin.",
  );

  await page.getByTestId("plot-location-map").click();
  await expect(page.getByTestId("location-status")).toHaveText("Pin placed on the map");
  await page.getByLabel(/Plot area/).fill("50");
  await page.getByLabel("Unit").selectOption("decimal");
  await page.getByRole("button", { name: "Save plot" }).click();

  await expect(page.getByRole("heading", { name: "Near the canal" })).toBeVisible();
  await expect(page.getByText("50 Decimal (dismil)")).toBeVisible();
  await expect(page.getByText("Pin on map")).toBeVisible();
});

test("farm pages that do not belong to the farmer are not found, and logging out protects them", async ({ page }) => {
  await logIn(page);
  await expect(page).toHaveURL(/\/farms$/);

  await page.goto("/farms/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "This page was not found." })).toBeVisible();

  await page.goto("/farms");
  await page.getByRole("link", { name: /Near the house/ }).click();
  const farmUrl = page.url();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(farmUrl);
  await expect(page).toHaveURL(/\/login$/);
});
