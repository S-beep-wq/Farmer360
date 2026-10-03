import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logInWithProfile } from "./helpers";

// The AI farm assistant (USER_WORKFLOWS.md section 17). The app talks to a local stand-in for the
// Anthropic API (tests/support/mock-anthropic.ts); a marker in the question picks its answer.

test.describe.configure({ mode: "serial" });

function daysAgo(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eAssistant, { name: "Rekha Devi", district: "Vaishali", village: "Mahua" });
}

test("setup: maize in the field", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Home farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Back plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Save plot" }).click();
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Kharif (monsoon)").click();
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(daysAgo(30));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
});

test("a farmer asks what to do today and sees a grounded, cautious answer", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Ask a question about your farm" }).click();
  await expect(page.getByRole("heading", { name: "Ask about your farm" })).toBeVisible();
  await expect(page.getByText("Your name, village and mobile number are not sent.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("About which crop?").locator("option:checked")).toHaveText("My whole farm");

  await page.getByRole("button", { name: "What should I do today?" }).click();
  await expect(page.getByLabel("Your question")).toHaveValue("What should I do today?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  const answer = page.getByTestId("assistant-answer");
  await expect(answer).toBeVisible({ timeout: 20_000 });
  await expect(answer.getByTestId("assistant-confidence")).toHaveText("AI is not fully sure");
  await expect(answer).toContainText("Check the field for weeds");
  await expect(answer.getByTestId("assistant-based-on")).toContainText("Maize sown 30 days ago on Back plot");
  await expect(answer.getByTestId("assistant-disclaimer")).toContainText("does not know the weather");
  await expect(answer.getByTestId("assistant-expert")).toHaveCount(0);

  await answer.getByRole("button", { name: "Yes" }).click();
  await expect(answer).toContainText("Thank you. You said: Yes");
});

test("asking about one crop: an empty question is explained, and missing facts are asked back", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: /Home farm/ }).click();
  await page.getByRole("link", { name: /Back plot/ }).click();
  await page.getByRole("link", { name: /^Maize/ }).click();
  await page.getByRole("link", { name: "Ask a question about this Maize" }).click();
  await expect(page.getByLabel("About which crop?").locator("option:checked")).toHaveText(/^Maize · Kharif \(monsoon\) · Back plot$/);

  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("Please fill this in.")).toBeVisible();

  await page.getByLabel("Your question").fill("When should I harvest? [missing]");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.getByTestId("assistant-answer");
  await expect(answer).toBeVisible({ timeout: 20_000 });
  await expect(answer.getByTestId("assistant-confidence")).toHaveText("AI is not sure");
  await expect(answer.getByTestId("assistant-missing")).toContainText("Which maize variety did you sow?");
  await expect(page.getByLabel("About which crop?").locator("option:checked")).toHaveText(/^Maize/);
});

test("an unsure answer sends the farmer to an expert, and a failure is explained", async ({ page }) => {
  await signIn(page);
  await page.goto("/assistant");
  await page.getByLabel("Your question").fill("Is my crop fine? [unsure]");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answer = page.getByTestId("assistant-answer");
  await expect(answer.getByTestId("assistant-expert")).toContainText("Show the crop to an agriculture expert", { timeout: 20_000 });
  await expect(answer).toContainText("This answer does not use any of your records.");

  await page.getByLabel("Your question").fill("Anything else? [fail]");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("AI help is not available right now.", { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Your question")).toHaveValue("Anything else? [fail]");
});
