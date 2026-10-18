"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Application Error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 w-full min-h-[60vh] items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#171717] p-8 shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mt-4 text-xl font-semibold text-white">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-neutral-400">
          We encountered an unexpected error while loading this page.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto rounded-lg bg-[#c5a880] px-5 py-2.5 text-sm font-semibold text-[#171717] transition hover:bg-[#b8996e] active:scale-95"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
