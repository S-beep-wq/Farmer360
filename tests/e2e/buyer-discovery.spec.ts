import { expect, test, type Page } from "@playwright/test";

import { todayInIndia } from "../../src/features/crops/dates";
import { TEST_PHONES } from "../support/supabase";

import { logIn, logInWithProfile } from "./helpers";

// Buyer discovery (USER_WORKFLOWS.md section 14): a buyer publishes demand, a farmer finds it,
// calls or says they are interested, and the buyer sees who is interested. Own users, fresh each run.

test.describe.configure({ mode: "serial" });

function daysFromToday(days: number) {
  const d = new Date(`${todayInIndia()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Logs in as the buyer, registering on the first login. */
async function signInBuyer(page: Page) {
  await logIn(page, TEST_PHONES.e2eBuyer);
  await page.waitForURL(/\/(onboarding|buyer)$/);
  if (page.url().endsWith("/onboarding")) {
    await page.getByRole("link", { name: "Not a farmer? Register as a buyer of crops" }).click();
    await expect(page.getByRole("heading", { name: "Register as a buyer" })).toBeVisible();
    await page.getByLabel("Your name").fill("Suresh Prasad");
    await page.getByLabel(/Shop, firm or organisation/).fill("Prasad Grain Traders");
    await page.getByLabel("What kind of buyer are you?").selectOption({ label: "Local trader" });
    await page.getByLabel("District").fill("Patna");
    await page.getByLabel("Town or market where you buy").fill("Bihta mandi");
    await expect(page.getByText("Farmers using Kisan 360 will see your name", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Register as a buyer" }).click();
  }
  await expect(page).toHaveURL(/\/buyer$/);
}

async function signInFarmer(page: Page) {
  await logInWithProfile(page, TEST_PHONES.e2eMarket, { name: "Mohan Singh", district: "Patna", village: "Naubatpur" });
}

test("a buyer registers and publishes demand", async ({ page }) => {
  await signInBuyer(page);
  await expect(page.getByText("Namaste, Suresh Prasad")).toBeVisible();
  await expect(page.getByText("Your account is not verified yet.", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Publish a demand" }).click();
  await page.getByLabel("Which crop do you want to buy?").selectOption({ label: "Wheat" });
  await page.getByLabel("How much?").fill("20");
  await page.getByText("I am interested, not committed").click();
  await page.getByLabel(/Quality needed/).fill("Dry and clean");
  // A date in the past is explained.
  await page.getByLabel("Needed by").fill(daysFromToday(-1));
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("The date cannot be in the past.")).toBeVisible();
  await expect(page.getByLabel("How much?")).toHaveValue("20");

  await page.getByLabel("Needed by").fill(daysFromToday(20));
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel(/Payment terms/).fill("Cash on delivery");
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
  await expect(page.getByTestId("demand-state")).toHaveText("Open");
  await expect(page.getByTestId("demand-type")).toHaveText("Interest only — not a promise to buy");
  await expect(page.getByText("No farmer has responded yet.")).toBeVisible();
});

test("a buyer cannot use the farmer pages", async ({ page }) => {
  await signInBuyer(page);
  await page.goto("/farms");
  await expect(page).toHaveURL(/\/buyer$/);
  await page.goto("/market");
  await expect(page).toHaveURL(/\/buyer$/);
});

test("a farmer finds the buyer with filters and says they are interested", async ({ page }) => {
  await signInFarmer(page);
  await page.getByRole("link", { name: "Find buyers for your crop" }).click();
  await expect(page.getByRole("heading", { name: "Buyers looking for crops" })).toBeVisible();

  const items = page.getByTestId("demand-item");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Wheat");
  await expect(items.first()).toContainText("Interest only — not a promise to buy");
  await expect(items.first()).toContainText("Not verified — check the buyer yourself");

  // Filters: another crop, then too little to sell, then the right search.
  await page.getByLabel("Crop", { exact: true }).selectOption({ label: "Maize" });
  await page.getByRole("button", { name: "Show buyers" }).click();
  await expect(page.getByText("No buyers match.", { exact: false })).toBeVisible();
  await page.getByLabel("Crop", { exact: true }).selectOption({ label: "Wheat" });
  await page.getByLabel("Where").selectOption({ label: "My district (Patna)" });
  await page.getByLabel(/How much do you have to sell/).fill("10");
  await page.getByRole("button", { name: "Show buyers" }).click();
  await expect(page.getByText("Buyers found: 0")).toBeVisible();
  await page.getByLabel(/How much do you have to sell/).fill("25");
  await page.getByRole("button", { name: "Show buyers" }).click();
  await expect(items).toHaveCount(1);

  await items.first().click();
  await expect(page.getByRole("heading", { name: "Wheat" })).toBeVisible();
  await expect(page.getByText("Suresh Prasad (Prasad Grain Traders)")).toBeVisible();
  await expect(page.getByTestId("trust-note")).toContainText("Kisan 360 does not guarantee any sale, price or payment.");
  await expect(page.getByRole("link", { name: /Call the buyer/ })).toHaveAttribute("href", "tel:+919999900016");

  await page.getByLabel(/Message for the buyer/).fill("15 quintal ready next week");
  await page.getByRole("button", { name: "I'm interested" }).click();
  await expect(page.getByText("Tick the box to share your contact details with the buyer.")).toBeVisible();
  await expect(page.getByLabel(/Message for the buyer/)).toHaveValue("15 quintal ready next week");
  await page.getByLabel("Share my name, village and mobile number with this buyer").check();
  await page.getByRole("button", { name: "I'm interested" }).click();
  await expect(page.getByText("You told this buyer you are interested on", { exact: false })).toBeVisible();
  await expect(page.getByText("Your message: 15 quintal ready next week")).toBeVisible();

  await page.getByRole("link", { name: "Buyers looking for crops" }).click();
  await expect(page.getByRole("heading", { name: "Buyers you said you are interested in" })).toBeVisible();
});

test("the buyer sees the interested farmer, calls them and closes the demand", async ({ page }) => {
  await signInBuyer(page);
  const item = page.getByTestId("demand-item");
  await expect(item).toContainText("Farmers interested: 1");
  await item.click();

  const farmer = page.getByTestId("interested-farmer");
  await expect(farmer).toContainText("Mohan Singh");
  await expect(farmer).toContainText("Naubatpur, Patna");
  await expect(farmer).toContainText("15 quintal ready next week");
  await expect(farmer.getByRole("link", { name: /Call Mohan Singh/ })).toHaveAttribute("href", "tel:+919999900017");

  await page.getByRole("button", { name: "I have bought what I needed" }).click();
  await expect(page.getByText("Farmers will no longer see this demand.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Yes, close it" }).click();
  await expect(page.getByTestId("demand-state")).toHaveText("Buyer has bought enough");
  await expect(page.getByRole("button", { name: "Cancel this demand" })).toHaveCount(0);
});

test("the farmer no longer finds closed demand, but sees what happened to it", async ({ page }) => {
  await signInFarmer(page);
  await page.goto("/market");
  await expect(page.getByText("Buyers found: 0")).toBeVisible();
  const responded = page.getByTestId("demand-item");
  await expect(responded).toHaveCount(1);
  await expect(responded).toContainText("Buyer has bought enough");
  await responded.click();
  await expect(page.getByRole("link", { name: /Call the buyer/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "I'm interested" })).toHaveCount(0);
});
