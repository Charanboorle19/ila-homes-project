export default function WhoWeAre() {
  return (
    <section data-section="who_we_are"
      id="about"
      className="relative w-full overflow-hidden border-t border-white/10 bg-[#0c0c0c]"
      aria-labelledby="who-we-are-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(198,164,108,0.12),transparent_55%),linear-gradient(180deg,#111_0%,#0c0c0c_100%)]"
        aria-hidden
      />

      <div className="relative flex w-full flex-col gap-6 px-6 py-10 sm:gap-7 sm:px-8 sm:py-12 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-accent uppercase">
            Who We Are
          </p>
          <h2
            id="who-we-are-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            Since 2019, we&apos;ve been doing this differently.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-[15px]">
            ILA Homes is a Hyderabad-based land developer focused on HMDA-approved
            plots in the city&apos;s fastest-growing corridors. Every property we
            list is legally verified, physically visited, and ready for you to
            build on — no shortcuts, no surprises.
          </p>
        </div>

        <dl className="flex flex-wrap items-end gap-8 border-t border-white/10 pt-5 sm:gap-12">
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.18em] text-white/45 uppercase">
              Established
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
              2019
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.18em] text-white/45 uppercase">
              Plots Delivered
            </dt>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
              47
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
