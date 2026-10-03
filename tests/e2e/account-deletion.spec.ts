import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logIn, logInWithProfile } from "./helpers";

// A farmer deletes their account, and their crop photos are removed from storage too.
// Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

const PHONE = TEST_PHONES.e2eDelete;

function daysAgo(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, PHONE, { name: "Ramesh Yadav", district: "Vaishali", village: "Hajipur" });
}

/** Every file in the crop-photos bucket under this farmer's folder, seen from outside (admin). */
async function photoFiles(farmerId: string): Promise<string[]> {
  const bucket = adminClient().storage.from("crop-photos");
  const walk = async (prefix: string): Promise<string[]> => {
    const { data, error } = await bucket.list(prefix);
    if (error) throw error;
    const found = await Promise.all(data.map((item) => (item.id ? [`${prefix}/${item.name}`] : walk(`${prefix}/${item.name}`))));
    return found.flat();
  };
  return walk(farmerId);
}

async function farmerIdFor(phone: string) {
  const { data } = await adminClient().from("farmers").select("id").eq("phone", phone).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

test("setup: a crop with a photo", async ({ page }) => {
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
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(daysAgo(30));
  await page.getByRole("button", { name: "Save crop" }).click();
  await page.getByRole("link", { name: "Add a crop photo" }).click();
  await page.getByLabel(/Photo of the crop/).setInputFiles(path.join(__dirname, "fixtures", "crop-day-20.jpg"));
  await page.getByText("Looks healthy").click();
  await page.getByLabel("Date").fill(daysAgo(10));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("observation-photo")).toHaveCount(1);

  const farmerId = (await farmerIdFor(PHONE))!;
  expect(await photoFiles(farmerId)).toHaveLength(1);
});

test("a farmer sees their profile and can change their mind about deleting", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "My profile and account" }).click();
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(page.getByText("Ramesh Yadav")).toBeVisible();
  await expect(page.getByText("+91 99999 00012")).toBeVisible();
  await expect(page.getByText("Hajipur")).toBeVisible();

  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Delete my account" })).toBeVisible();
  await expect(page.getByText("This cannot be undone.", { exact: false })).toBeVisible();

  // Not confirmed: nothing happens.
  await page.getByRole("button", { name: "Delete my account and all data" }).click();
  await expect(page.getByText("Tick the box to confirm.")).toBeVisible();

  await page.getByRole("link", { name: "Keep my account" }).click();
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await page.getByRole("link", { name: "My farms" }).click();
  await expect(page.getByRole("link", { name: /River farm/ })).toBeVisible();
});

test("a farmer deletes their account, with all their photos", async ({ page }) => {
  await signIn(page);
  const farmerId = (await farmerIdFor(PHONE))!;
  await page.goto("/profile/delete");
  await page.getByLabel("I understand that all my data will be deleted for ever").check();
  await page.getByRole("button", { name: "Delete my account and all data" }).click();

  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  await expect(page.getByText("Your account and all its data have been deleted.")).toBeVisible();
  expect(await photoFiles(farmerId)).toEqual([]);
  expect(await farmerIdFor(PHONE)).toBeNull();

  // Signed out: the app is closed.
  await page.goto("/farms");
  await expect(page).toHaveURL(/\/login$/);

  // The same number starts again as a new farmer.
  await logIn(page, PHONE);
  await expect(page).toHaveURL(/\/onboarding$/);
});
