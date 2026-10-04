import { startMockAnthropic } from "../support/mock-anthropic";
import { deleteTestUsers, TEST_PHONES } from "../support/supabase";

export default async function globalSetup() {
  const mock = await startMockAnthropic(4011); // ANTHROPIC_BASE_URL / WEATHER_API_URL in playwright.perf.config.ts
  await deleteTestUsers([TEST_PHONES.perfFarmer]);
  return () => new Promise<void>((resolve) => mock.server.close(() => resolve()));
}
