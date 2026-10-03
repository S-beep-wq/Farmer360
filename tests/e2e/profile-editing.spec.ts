import { expect, test } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// A farmer changes their profile (name, language, place). Own farmer, fresh each run.

test.describe.configure({ mode: "serial" });

test("a farmer changes their details, and a mistake is explained without losing what was typed", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.e2eProfile, { name: "Geeta Devi", district: "Patna", village: "Bihta" });

  await page.getByRole("link", { name: "My profile and account" }).click();
  await page.getByRole("link", { name: "Change my details" }).click();
  await expect(page.getByRole("heading", { name: "Change my details" })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Geeta Devi");
  await expect(page.getByLabel("Village")).toHaveValue("Bihta");
  await expect(page.getByText("Your mobile number cannot be changed here.", { exact: false })).toBeVisible();

  await page.getByLabel("Your name").fill("Geeta Kumari");
  await page.getByLabel("District").fill("Nalanda");
  await page.getByLabel("Village").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Please fill this in.")).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveValue("Geeta Kumari");
  await expect(page.getByLabel("District")).toHaveValue("Nalanda");

  await page.getByLabel("Village").fill("Rajgir");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
  await expect(page.getByText("Geeta Kumari")).toBeVisible();
  await expect(page.getByText("Nalanda")).toBeVisible();
  await expect(page.getByText("Rajgir")).toBeVisible();
  await expect(page.getByText("+91 99999 00013")).toBeVisible();

  await page.getByRole("link", { name: "My farms" }).click();
  await expect(page.getByText("Namaste, Geeta Kumari")).toBeVisible();
});

test("changing the language in the profile switches the app and is remembered", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.e2eProfile, { name: "Geeta Devi", district: "Patna", village: "Bihta" });
  await page.goto("/profile/edit");
  await page.getByRole("group", { name: "Which language do you prefer?" }).getByText("हिंदी").click();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "मेरी प्रोफ़ाइल" })).toBeVisible();
  await page.getByRole("link", { name: "मेरी जानकारी बदलें" }).click();
  await expect(page.getByRole("radio", { name: "हिंदी" })).toBeChecked();

  // Back to English, for the other tests.
  await page.getByRole("group", { name: "आप कौन सी भाषा पसंद करते हैं?" }).getByText("English").click();
  await page.getByRole("button", { name: "बदलाव सेव करें" }).click();
  await expect(page.getByRole("heading", { name: "My profile" })).toBeVisible();
});
