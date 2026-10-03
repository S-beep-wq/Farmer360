import Link from "next/link";

import { logoutAction } from "@/features/auth/actions";
import { setLanguageAction } from "@/features/farmer/actions";
import { LOCALES, type Locale, type Messages } from "@/lib/i18n";

/** Top bar: app name, language switch and (when signed in) log out. */
export function AppHeader({ t, locale, signedIn }: { t: Messages; locale: Locale; signedIn: boolean }) {
  const otherLocale: Locale = LOCALES.find((l) => l !== locale) ?? locale;

  return (
    <header className="border-b-2 border-green-800 bg-green-700 text-white">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-4 py-2">
        <Link href="/" className="flex min-h-12 items-center text-2xl font-bold">
          {t.app.name}
        </Link>
        <div className="flex items-center gap-2">
          <form action={setLanguageAction}>
            <input type="hidden" name="locale" value={otherLocale} />
            <button
              type="submit"
              lang={otherLocale}
              aria-label={`${t.common.language}: ${t.languages[otherLocale]}`}
              className="min-h-12 rounded-lg border-2 border-white/70 px-3 text-lg font-semibold hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-white/50"
            >
              {t.languages[otherLocale]}
            </button>
          </form>
          {signedIn ? (
            <form action={logoutAction}>
              <button
                type="submit"
                className="min-h-12 rounded-lg px-3 text-lg font-medium underline-offset-4 hover:underline focus:outline-none focus:ring-4 focus:ring-white/50"
              >
                {t.common.logout}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
