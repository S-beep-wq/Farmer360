import type { Metadata, Viewport } from "next";

import { AppHeader } from "@/components/AppHeader";
import { getCurrentUser } from "@/lib/auth";
import { getServerMessages } from "@/lib/i18n/server";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerMessages();
  return { title: t.app.name, description: t.app.tagline };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale, t }, user] = await Promise.all([getServerMessages(), getCurrentUser()]);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900">
        <AppHeader t={t} locale={locale} signedIn={Boolean(user)} />
        {children}
      </body>
    </html>
  );
}
