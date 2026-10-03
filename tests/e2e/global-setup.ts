import { deleteTestUsers, TEST_PHONES } from "../support/supabase";

/** Start every run as a brand-new farmer. */
export default async function globalSetup() {
  await deleteTestUsers([TEST_PHONES.e2e, TEST_PHONES.e2eWrongCode, TEST_PHONES.e2eEdit, TEST_PHONES.e2eCrops, TEST_PHONES.e2eRecords, TEST_PHONES.e2eHarvest, TEST_PHONES.e2eSeason, TEST_PHONES.e2eHealth, TEST_PHONES.e2eDelete, TEST_PHONES.e2eProfile]);
}
