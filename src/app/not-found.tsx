import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 w-full min-h-[60vh] items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-white/10 bg-[#171717] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c5a880]">
          404 Not Found
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Page not found
        </h2>
        <p className="mt-3 text-sm text-neutral-400">
          The property, development, or page you were looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="rounded-lg bg-[#c5a880] px-6 py-2.5 text-sm font-semibold text-[#171717] transition hover:bg-[#b8996e] active:scale-95"
          >
            Back to map
          </Link>
        </div>
      </div>
    </div>
  );
}
