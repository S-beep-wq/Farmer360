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
  const sendButton = page.getByRole("button", { name: "Send code" });
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await codeLabel.isVisible()) return;
    // Wait for the Server Action's response, then for the form to finish updating (the button reads
    // "Sending…" until then), so an earlier error message is not mistaken for the result.
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/login")),
      sendButton.click(),
    ]);
    await expect(codeLabel.or(sendButton)).toBeVisible();
    if (await codeLabel.isVisible()) return;
    await expect(rateLimited).toBeVisible();
    await page.waitForTimeout(2000);
  }
  throw new Error("Could not request a login code");
}

/** Ticks the box on the data-use consent screen and agrees. */
export async function acceptNotice(page: Page) {
  await expect(page).toHaveURL(/\/consent$/);
  await page.getByLabel("I have read this and I agree to Kisan 360 using my data in this way").check();
  await page.getByRole("button", { name: "Agree and continue" }).click();
  // Server Action redirects are client-side navigations (no "load" event), so assert on the URL.
  await expect(page).not.toHaveURL(/\/consent$/);
}

/**
 * Logs in through the real phone + OTP flow, in English. The first time a test user logs in, the
 * app asks them to accept the data-use notice; this accepts it unless `acceptNotice` is false.
 */
export async function logIn(page: Page, phone: string, { acceptNotice: accept = true } = {}) {
  await page.goto("/login");
  await switchToEnglish(page);
  await sendCode(page, localNumber(phone));
  await expect(page.getByText(/^We sent a 6-digit code to \+91 \d{5} \d{5}$/)).toBeVisible();
  await page.getByLabel("Code from SMS").fill(TEST_OTP);
  await page.getByRole("button", { name: "Log in" }).click();
  // Wait for the next page's heading: the URL can show an in-between page (e.g. /onboarding) before
  // the server's redirect to /consent arrives, but only the final page is ever rendered.
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).not.toHaveText("Log in with your mobile number");
  if (accept && (await heading.textContent()) === "Before you start") {
    await acceptNotice(page);
  }
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
