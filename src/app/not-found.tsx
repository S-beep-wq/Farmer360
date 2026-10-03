import { LinkButton, Page, PageTitle } from "@/components/ui/layout";
import { getServerMessages } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getServerMessages();
  return (
    <Page>
      <PageTitle>{t.errors.notFound}</PageTitle>
      <LinkButton href="/">{t.farms.title}</LinkButton>
    </Page>
  );
}
