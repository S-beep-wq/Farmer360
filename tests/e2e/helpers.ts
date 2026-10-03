import { expect, type Locator, type Page } from "@playwright/test";

import { TEST_OTP } from "../support/supabase";

export function localNumber(e164: string) {
  return e164.replace("+91", "");
}

export async function switchToEnglish(page: Page) {
  const englishButton = page.getByRole("button", { name: /English/ });
  if (await englishButton.isVisible()) {
    await englishButton.click();
    await expect(page.getByRole("button", { name: /हिंदी/ })).toBeVisible();
  }
}

/** Requests a code, waiting out the auth server's per-phone resend limit (5 s locally). */
export async function sendCode(page: Page, localPhone: string) {
  await page.getByLabel("Mobile number").fill(localPhone);
  const codeLabel = page.getByLabel("Code from SMS");
  const rateLimited = page.getByText("Too many attempts. Please wait a few minutes and try again.");
  for (let attempt = 0; attempt < 4; attempt++) {
    // Wait for the Server Action's response, so an earlier error message is not mistaken for the result.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/login")),
      page.getByRole("button", { name: "Send code" }).click(),
    ]);
    await expect(codeLabel.or(rateLimited)).toBeVisible();
    if (await codeLabel.isVisible()) return;
    await page.waitForTimeout(2000);
  }
  throw new Error("Could not request a login code");
}

/** Logs in through the real phone + OTP flow, in English. */
export async function logIn(page: Page, phone: string) {
  await page.goto("/login");
  await switchToEnglish(page);
  await sendCode(page, localNumber(phone));
  await expect(page.getByText(/^We sent a 6-digit code to \+91 \d{5} \d{5}$/)).toBeVisible();
  await page.getByLabel("Code from SMS").fill(TEST_OTP);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** Taps points on a Leaflet map, as offsets in pixels from its centre. */
export async function tapMap(map: Locator, offsets: [number, number][]) {
  const box = (await map.boundingBox())!;
  for (const [dx, dy] of offsets) {
    await map.click({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
  }
}

/** Logs in and, on a farmer's first login, completes the profile (in English). */
export async function logInWithProfile(page: Page, phone: string, profile: { name: string; district: string; village: string }) {
  await logIn(page, phone);
  await page.waitForURL(/\/(onboarding|farms)$/);
  if (page.url().endsWith("/onboarding")) {
    await page.getByLabel("Your name").fill(profile.name);
    await page.getByText("English", { exact: true }).click();
    await page.getByLabel("District").fill(profile.district);
    await page.getByLabel("Village").fill(profile.village);
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page).toHaveURL(/\/farms$/);
}
