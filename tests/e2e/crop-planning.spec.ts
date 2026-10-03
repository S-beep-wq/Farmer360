import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// Crop planning (USER_WORKFLOWS.md section 5): select plot → season → compare crops → create the
// crop. Past seasons are seeded directly (admin, test only) after the farmer creates the plot in
// the browser, since recording whole seasons through the UI is covered by other specs.

test.describe.configure({ mode: "serial" });

let plotPath: string;

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2ePlanning, { name: "Shanti Devi", district: "Muzaffarpur", village: "Kanti" });
}

async function seedClosedSeason(plotId: string, crop: string, sowing: string, money: { cost: number; quintal: number; price: number }) {
  const admin = adminClient();
  const { data: c } = await admin.from("crop_catalog").select("id").eq("name", crop).single().throwOnError();
  const { data: cycle } = await admin
    .from("crop_cycles")
    .insert({ plot_id: plotId, crop_id: c.id, season: "rabi", status: "ACTIVE", actual_sowing_date: sowing })
    .select("id")
    .single()
    .throwOnError();
  await admin.from("expenses").insert({ crop_cycle_id: cycle.id, category: "SEED", amount: money.cost, expense_date: sowing }).throwOnError();
  const harvestDate = `${Number(sowing.slice(0, 4)) + 1}-03-20`;
  const { data: harvest } = await admin
    .from("harvests")
    .insert({ crop_cycle_id: cycle.id, harvest_date: harvestDate, quantity: money.quintal, quantity_unit: "quintal" })
    .select("id")
    .single()
    .throwOnError();
  await admin
    .from("sales")
    .insert({ harvest_id: harvest.id, buyer_type: "MANDI", sale_date: harvestDate, quantity: money.quintal, quantity_unit: "quintal", price_per_unit: money.price, payment_status: "PAID" })
    .throwOnError();
  await admin.from("crop_cycles").update({ status: "HARVESTED", actual_harvest_date: harvestDate }).eq("id", cycle.id).throwOnError();
  await admin.from("crop_cycles").update({ status: "COMPLETED" }).eq("id", cycle.id).throwOnError();
}

test("setup: a 2-acre plot with two closed rabi seasons", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Planning farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Main plot");
  await page.getByLabel(/Plot area/).fill("2");
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Main plot" })).toBeVisible();
  plotPath = new URL(page.url()).pathname;
  const plotId = plotPath.split("/").pop()!;

  // Wheat: spent 10,000, sold 20 q × 2,500 = 50,000 → net 40,000 → ₹20,000 per acre.
  await seedClosedSeason(plotId, "Wheat", "2024-11-10", { cost: 10000, quintal: 20, price: 2500 });
  // Mustard (grown last): spent 8,000, sold 1 q × 6,000 → net −2,000 → −₹1,000 per acre.
  await seedClosedSeason(plotId, "Mustard", "2025-11-05", { cost: 8000, quintal: 1, price: 6000 });
});

test("a farmer compares crops for a season from their own records", async ({ page }) => {
  await signIn(page);
  await page.goto(plotPath);
  await page.getByRole("link", { name: "Plan the next crop" }).click();
  await expect(page.getByRole("heading", { name: "Plan the next crop" })).toBeVisible();
  await expect(page.getByTestId("last-crop")).toHaveText("Last crop here: Mustard · Rabi (winter)");

  await page.getByRole("link", { name: "Rabi (winter)" }).click();
  await expect(page.getByTestId("facts-note")).toContainText("They are not a prediction");
  await expect(page.getByTestId("facts-note")).toContainText("Kisan 360 does not estimate costs, harvests or prices yet.");

  const grown = page.getByTestId("with-history").getByTestId("candidate");
  await expect(grown).toHaveCount(2);
  await expect(grown.nth(0).getByRole("heading")).toHaveText("Wheat");
  await expect(grown.nth(0).getByTestId("net-per-acre")).toHaveText("₹20,000");
  await expect(grown.nth(0)).toContainText("Your closed seasons: 1 (1 on this plot)");
  await expect(grown.nth(0)).toContainText("Harvest per acre");
  await expect(grown.nth(1).getByRole("heading")).toHaveText("Mustard");
  await expect(grown.nth(1).getByTestId("net-per-acre")).toHaveText("-₹1,000");
  await expect(grown.nth(1)).toContainText("Grown on this plot last");

  await expect(page.getByTestId("other-crops").getByRole("heading", { name: "Maize" })).toBeVisible();

  await page.getByRole("link", { name: "Kharif (monsoon)" }).click();
  await expect(page.getByText("You have no closed Kharif (monsoon) seasons yet.", { exact: false })).toBeVisible();
});

test("choosing a crop opens the add-crop form with the crop and season filled in", async ({ page }) => {
  await signIn(page);
  await page.goto(`${plotPath}/plan?season=rabi`);
  await page.getByRole("link", { name: "Plan this crop: Wheat" }).click();
  await expect(page.getByRole("heading", { name: "Add a crop" })).toBeVisible();
  await expect(page.getByLabel("Which crop?").locator("option:checked")).toHaveText("Wheat");
  await expect(page.getByRole("radio", { name: "Rabi (winter)" })).toBeChecked();

  await page.getByText("No", { exact: true }).click();
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  await page.getByLabel("Planned sowing date").fill(d.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
});
