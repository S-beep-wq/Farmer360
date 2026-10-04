import { expect, test, type Page } from "@playwright/test";

import { NOTICE_VERSION } from "../../src/features/consent/constants";
import { adminClient, TEST_PHONES } from "../support/supabase";

import { logIn } from "./helpers";

// Data-use notice and consent: everyone must agree to the current notice before using the app,
// can read the full notice before logging in, and can leave (log out or delete) without agreeing.
// The admin client is used only to check from outside what was recorded.

test.describe.configure({ mode: "serial" });

async function userIdFor(phone: string) {
  const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.phone === phone.replace(/^\+/, ""))?.id ?? null;
}

async function consentsOf(phone: string) {
  const userId = await userIdFor(phone);
  const { data, error } = await adminClient().from("user_consents").select("notice_version, locale").eq("user_id", userId!).order("accepted_at");
  if (error) throw error;
  return data;
}

const pageButton = (page: Page, name: string) => page.getByRole("main").getByRole("button", { name });

test("the full notice can be read from the login screen without logging in", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "हम आपकी जानकारी का इस्तेमाल कैसे करते हैं" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "किसान 360 आपकी जानकारी का इस्तेमाल कैसे करता है", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "इसे कौन देख सकता है" })).toBeVisible();

  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByRole("heading", { name: "How Kisan 360 uses your data", level: 1 })).toBeVisible();
  await expect(page.getByText(`Version of ${NOTICE_VERSION}`)).toBeVisible();
  await expect(page.getByText(/AI help \(Anthropic\): only when you press an AI button/)).toBeVisible();
  await expect(page.getByTestId("privacy-contact")).not.toBeEmpty();
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("a new person must agree before using the app, and can log out instead", async ({ page }) => {
  await logIn(page, TEST_PHONES.e2eConsent, { acceptNotice: false });
  await expect(page).toHaveURL(/\/consent$/);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(page.getByText("How we use your data has changed.", { exact: false })).toHaveCount(0);

  for (const path of ["/", "/onboarding", "/onboarding/buyer", "/farms", "/buyer", "/market", "/assistant", "/profile"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/consent$/);
  }

  await page.getByRole("link", { name: "Read the full notice" }).click();
  await expect(page.getByRole("heading", { name: "How Kisan 360 uses your data", level: 1 })).toBeVisible();
  await page.goBack();

  await pageButton(page, "Agree and continue").click();
  await expect(page.getByText("Tick the box to agree.")).toBeVisible();
  await expect(page).toHaveURL(/\/consent$/);

  await pageButton(page, "Log out").click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await consentsOf(TEST_PHONES.e2eConsent)).toEqual([]);
});

test("agreeing in Hindi is recorded once, and the app opens", async ({ page }) => {
  await logIn(page, TEST_PHONES.e2eConsent, { acceptNotice: false });
  await expect(page).toHaveURL(/\/consent$/);
  await page.getByRole("button", { name: /हिंदी/ }).click();
  await expect(page.getByRole("heading", { name: "शुरू करने से पहले" })).toBeVisible();
  await page.getByLabel("मैंने यह पढ़ लिया है और मैं सहमत हूँ कि किसान 360 मेरी जानकारी का इस्तेमाल इस तरह करे").check();
  await pageButton(page, "सहमत हूँ, आगे बढ़ें").click();
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(await consentsOf(TEST_PHONES.e2eConsent)).toEqual([{ notice_version: NOTICE_VERSION, locale: "hi" }]);

  // Already agreed: the consent screen sends them on, and the next login does not ask again.
  await page.goto("/consent");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: /English/ }).click();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await logIn(page, TEST_PHONES.e2eConsent, { acceptNotice: false });
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("when the notice changes, the person is asked to agree again", async ({ page }) => {
  // Make their acceptance look like it was for an earlier version.
  const userId = await userIdFor(TEST_PHONES.e2eConsent);
  await adminClient().from("user_consents").update({ notice_version: "2000-01-01" }).eq("user_id", userId!).throwOnError();

  await logIn(page, TEST_PHONES.e2eConsent, { acceptNotice: false });
  await expect(page).toHaveURL(/\/consent$/);
  await expect(page.getByText("How we use your data has changed. Please read it and agree again to continue.")).toBeVisible();
  await page.getByLabel("I have read this and I agree to Kisan 360 using my data in this way").check();
  await pageButton(page, "Agree and continue").click();
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(await consentsOf(TEST_PHONES.e2eConsent)).toEqual([
    { notice_version: "2000-01-01", locale: "hi" },
    { notice_version: NOTICE_VERSION, locale: "en" },
  ]);
});

test("someone who does not agree can delete their account from the consent screen", async ({ page }) => {
  await logIn(page, TEST_PHONES.e2eConsentDelete, { acceptNotice: false });
  await expect(page).toHaveURL(/\/consent$/);
  await page.getByRole("link", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/profile\/delete$/);
  await page.getByLabel("I understand that all my data will be deleted for ever").check();
  await page.getByRole("button", { name: "Delete my account and all data" }).click();
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
  expect(await userIdFor(TEST_PHONES.e2eConsentDelete)).toBeNull();
});
