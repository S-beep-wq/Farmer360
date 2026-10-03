import { redirect } from "next/navigation";

import { Page, PageTitle } from "@/components/ui/layout";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const [{ t }, { deleted }] = await Promise.all([getServerMessages(), searchParams]);

  return (
    <Page>
      {deleted === "1" ? (
        <p role="status" className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-lg text-green-900">
          {t.account.deleted}
        </p>
      ) : null}
      <p className="text-xl text-green-800">{t.app.tagline}</p>
      <PageTitle>{t.login.title}</PageTitle>
      <LoginForm t={t} />
    </Page>
  );
}
