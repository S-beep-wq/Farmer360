"use client";

// Shown when a page fails unexpectedly. Kept bilingual because the locale is not available here.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-bold">
        <span lang="hi">कुछ गड़बड़ हो गई।</span> <span lang="en">Something went wrong.</span>
      </h1>
      <button
        type="button"
        onClick={reset}
        className="min-h-14 w-full rounded-xl bg-green-700 px-6 text-xl font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-4 focus:ring-green-300"
      >
        <span lang="hi">फिर से कोशिश करें</span> / <span lang="en">Try again</span>
      </button>
    </main>
  );
}
