import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, getMessages, isLocale, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getServerMessages() {
  const locale = await getLocale();
  return { locale, t: getMessages(locale) };
}

export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
}
