import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const { t } = await getServerMessages();

  return (
    <Page>
      <p className="text-xl text-green-800">{t.app.tagline}</p>
      <PageTitle>{t.login.title}</PageTitle>
      <LoginForm t={t} />
    </Page>
  );
}
