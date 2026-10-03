import Link from "next/link";
import type { ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>;
}

export function PageTitle({ children, backHref, backLabel }: { children: ReactNode; backHref?: string; backLabel?: string }) {
  return (
    <div className="flex flex-col gap-3">
      {backHref && backLabel ? (
        <Link
          href={backHref}
          className="inline-flex min-h-12 w-fit items-center gap-2 rounded-lg px-1 text-lg font-medium text-green-800 underline-offset-4 hover:underline"
        >
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
      ) : null}
      <h1 className="text-3xl font-bold text-stone-900">{children}</h1>
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-green-700 text-white hover:bg-green-800"
      : "border-2 border-green-700 bg-white text-green-800 hover:bg-green-50";
  return (
    <Link
      href={href}
      className={`flex min-h-14 w-full items-center justify-center rounded-xl px-6 text-xl font-semibold shadow-sm focus:outline-none focus:ring-4 focus:ring-green-300 ${styles}`}
    >
      {children}
    </Link>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl border-2 border-stone-200 bg-white p-5 shadow-sm">{children}</section>;
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-stone-100 py-3 last:border-b-0">
      <dt className="text-base text-stone-600">{label}</dt>
      <dd className="text-lg font-medium text-stone-900">{value}</dd>
    </div>
  );
}
