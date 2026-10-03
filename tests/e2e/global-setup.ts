import { startMockAnthropic } from "../support/mock-anthropic";
import { deleteTestUsers, TEST_PHONES } from "../support/supabase";

/** Start every run as a brand-new farmer, with the stand-in AI API running. */
export default async function globalSetup() {
  const mock = await startMockAnthropic(4010); // ANTHROPIC_BASE_URL in playwright.config.ts
  await deleteTestUsers([TEST_PHONES.e2e, TEST_PHONES.e2eWrongCode, TEST_PHONES.e2eEdit, TEST_PHONES.e2eCrops, TEST_PHONES.e2eRecords, TEST_PHONES.e2eHarvest, TEST_PHONES.e2eSeason, TEST_PHONES.e2eHealth, TEST_PHONES.e2eDelete, TEST_PHONES.e2eProfile, TEST_PHONES.e2eBuyer, TEST_PHONES.e2eMarket, TEST_PHONES.e2eSchemes, TEST_PHONES.e2eInsurance, TEST_PHONES.e2ePlanning, TEST_PHONES.e2eAi]);
  return () => new Promise<void>((resolve) => mock.server.close(() => resolve()));
}
