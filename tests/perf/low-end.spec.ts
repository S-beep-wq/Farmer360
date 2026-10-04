import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { TEST_PHONES } from "../support/supabase";
import { logInWithProfile } from "../e2e/helpers";

// A low-end phone on a slow network: Lighthouse's "slow 3G" (400 Kbps, 400 ms round trip) and a
// CPU 4× slower than this machine. Measures what each main screen downloads and how long it takes,
// and checks it against budgets. Numbers are printed so they can be compared over time.

test.describe.configure({ mode: "serial" });

const KBPS = 400;
const BUDGET = {
  /** Compressed JavaScript per screen (first visit). */
  scriptKb: 350,
  /** Everything downloaded per screen (first visit, excluding map tiles and photos). */
  totalKb: 600,
  /** Until the page's main content is shown (DOMContentLoaded), first visit on slow 3G. */
  contentSeconds: 10,
};

type Measure = { name: string; scriptKb: number; totalKb: number; requests: number; domContentLoadedS: number; loadS: number; lcpS: number | null };

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (KBPS * 1024) / 8,
    uploadThroughput: (KBPS * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  return cdp;
}

async function measure(page: Page, cdp: CDPSession, name: string, url: string): Promise<Measure> {
  const types = new Map<string, string>();
  const sizes = new Map<string, number>();
  const onResponse = (e: { requestId: string; type?: string; response: { url: string } }) => {
    const u = e.response.url;
    if (u.includes("tile.openstreetmap") || u.includes("/storage/v1/")) return; // tiles and photos vary
    types.set(e.requestId, e.type ?? "Other");
  };
  const onFinished = (e: { requestId: string; encodedDataLength: number }) => {
    if (types.has(e.requestId)) sizes.set(e.requestId, e.encodedDataLength);
  };
  cdp.on("Network.responseReceived", onResponse);
  cdp.on("Network.loadingFinished", onFinished);
  await page.goto(url, { waitUntil: "load", timeout: 120_000 });
  await page.waitForTimeout(1500);
  cdp.off("Network.responseReceived", onResponse);
  cdp.off("Network.loadingFinished", onFinished);

  const timing = await page.evaluate(
    () =>
      new Promise<{ dcl: number; load: number; lcp: number | null }>((resolve) => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        let lcp: number | null = null;
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcp = entries[entries.length - 1]?.startTime ?? null;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve({ dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, lcp }), 100);
      }),
  );
  let script = 0;
  let total = 0;
  for (const [id, bytes] of sizes) {
    total += bytes;
    if (types.get(id) === "Script") script += bytes;
  }
  const kb = (b: number) => Math.round(b / 1024);
  return {
    name,
    scriptKb: kb(script),
    totalKb: kb(total),
    requests: sizes.size,
    domContentLoadedS: Math.round(timing.dcl / 100) / 10,
    loadS: Math.round(timing.load / 100) / 10,
    lcpS: timing.lcp === null ? null : Math.round(timing.lcp / 100) / 10,
  };
}

let paths: Record<string, string> = {};

test("setup: a farmer with a mapped plot and a crop", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.perfFarmer, { name: "Perf Farmer", district: "Patna", village: "Bihta" });
  await page.getByRole("link", { name: "Add your first farm" }).click();
  await page.getByLabel("Farm name").fill("Perf farm");
  await page.getByRole("button", { name: "Save farm" }).click();
  await expect(page.getByRole("heading", { name: "Perf farm" })).toBeVisible();
  const farm = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Add a plot" }).click();
  await page.getByLabel("Plot name").fill("Perf plot");
  await page.getByLabel(/Plot area/).fill("1");
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByTestId("location-status")).toHaveText(/Location found/);
  await page.getByRole("button", { name: "Save plot" }).click();
  await expect(page.getByRole("heading", { name: "Perf plot" })).toBeVisible();
  const plot = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Add a crop" }).click();
  await page.getByLabel("Which crop?").selectOption({ label: "Maize" });
  await page.getByText("Kharif (monsoon)").click();
  // In the field, so every crop screen (including adding a photo) can be opened.
  await page.getByText("Yes", { exact: true }).click();
  await page.getByLabel("Sowing date").fill(new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Save crop" }).click();
  await expect(page.getByRole("heading", { name: "Maize" })).toBeVisible();
  paths = { farm, plot, crop: new URL(page.url()).pathname };
});

test("main screens on a low-end phone and slow network stay within budget", async ({ page }) => {
  await logInWithProfile(page, TEST_PHONES.perfFarmer, { name: "Perf Farmer", district: "Patna", village: "Bihta" });
  const cdp = await throttle(page);
  const results: Measure[] = [];
  for (const [name, url] of [
    ["My farms", "/farms"],
    ["Farm (map)", paths.farm],
    ["Plot (map, weather)", paths.plot],
    ["Add a plot (map picker)", `${paths.farm}/plots/new`],
    ["Crop", paths.crop],
    ["Add a crop photo", `${paths.crop}/observations/new`],
    ["Crop planning", `${paths.plot}/plan?season=kharif`],
    ["Farm assistant", "/assistant"],
    ["Market", "/market"],
  ] as const) {
    results.push(await measure(page, cdp, name, url));
  }
  console.log("\nLow-end phone, slow 3G (400 Kbps, 400 ms), CPU ×4 — first visit, no cache");
  console.table(results);
  // A screen that redirected or did not load is a failed measurement, not a fast page.
  const over = results.filter(
    (r) => r.domContentLoadedS <= 0 || r.scriptKb > BUDGET.scriptKb || r.totalKb > BUDGET.totalKb || r.domContentLoadedS > BUDGET.contentSeconds,
  );
  expect(over, JSON.stringify(over, null, 1)).toEqual([]);
});
