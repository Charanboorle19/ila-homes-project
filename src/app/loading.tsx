export default function Loading() {
  return (
    <div
      className="flex flex-1 w-full min-h-[50vh] items-center justify-center p-8"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="ila-loader ila-loader--light" aria-hidden="true" />
        <p className="text-sm font-medium tracking-wide text-white/70">
          Loading…
        </p>
      </div>
    </div>
  );
}
