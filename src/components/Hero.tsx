"use client";

import { useRouter } from "next/navigation";
import { SubmitEvent, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/services/analytics/tracker";

const SEARCH_WORDS = ["location", "area", "properties"] as const;

/**
 * Anchor for the property map. `MapSection` renders `id="projects"`, so this
 * is the section immediately below the hero and the search submit targets it.
 */
const PROJECTS_ANCHOR_ID = "projects";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M16.5 16.5 20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 6.8C10.5 5.3 8.5 4.8 5 5.1v13.4c3.5-.3 5.5.2 7 1.7 1.5-1.5 3.5-2 7-1.7V5.1c-3.5-.3-5.5.2-7 1.7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 6.8v13.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export default function Hero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [wordVisible, setWordVisible] = useState(true);
  const [inputFocused, setInputFocused] = useState(false);

  // Lock hero height once on mobile so browser chrome show/hide
  // doesn't reflow object-cover and make the image appear to "jump".
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const lockHeight = () => {
      if (window.matchMedia("(max-width: 767px)").matches) {
        section.style.height = `${Math.round(window.innerHeight - section.offsetTop)}px`;
      } else {
        section.style.height = "";
      }
    };

    lockHeight();
    window.addEventListener("orientationchange", lockHeight);
    return () => window.removeEventListener("orientationchange", lockHeight);
  }, []);

  // Cycle placeholder words one by one
  useEffect(() => {
    if (query || inputFocused) return;

    const hold = window.setTimeout(() => {
      setWordVisible(false);
    }, 2400);

    return () => window.clearTimeout(hold);
  }, [wordIndex, query, inputFocused]);

  useEffect(() => {
    if (query || inputFocused || wordVisible) return;

    const swap = window.setTimeout(() => {
      setWordIndex((prev) => (prev + 1) % SEARCH_WORDS.length);
      setWordVisible(true);
    }, 420);

    return () => window.clearTimeout(swap);
  }, [wordVisible, query, inputFocused]);

  /** Scrolls to the property map. Returns false when the anchor is absent, so
      the caller can fall back to a route change. */
  const scrollToProjects = () => {
    const el = document.getElementById(PROJECTS_ANCHOR_ID);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  };

  /** CTA on the poster: opens the live property catalogue. */
  const onExploreProperties = () => {
    router.push("/properties");
  };

  /** CTA on the poster: scrolls to the property map. Reuses `MAP_MARKER_CLICK`
      — the only map event type the backend accepts — tagged with the surface. */
  const onViewMap = () => {
    trackEvent({
      event_type: "MAP_MARKER_CLICK",
      metadata: {
        section_type: "hero",
        surface: "hero_view_map",
        page_url: window.location.pathname,
      },
    });

    if (scrollToProjects()) return;
    router.push(`/#${PROJECTS_ANCHOR_ID}`);
  };

  const onSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();

    // Only a real typed query counts as a search; the animated placeholder
    // cycles through words and must not register as user intent.
    if (trimmed.length > 0) {
      trackEvent({
        event_type: "PROPERTY_SEARCH",
        metadata: {
          query: trimmed,
          location: null,
          result_count: null,
          page_url: window.location.pathname,
        },
      });
    }

    if (scrollToProjects()) return;
    router.push(`/#${PROJECTS_ANCHOR_ID}`);
  };

  const showAnimatedPlaceholder = !query && !inputFocused;

  return (
    <section data-section="hero_map"
      ref={sectionRef}
      className="relative h-[calc(100svh-var(--nav-h))] w-full overflow-hidden bg-[#ebe6de] pb-4 md:h-[calc(100dvh-var(--nav-h))] md:bg-neutral-200"
      aria-label="ILA Homes hero"
    >
      {/* Backdrop. Full-bleed with `object-cover` and no frame, border, or corner
          rounding, mirroring the previous poster layout.
          Search and CTAs sit in an overlay on top: search pinned to the top,
          CTAs to the bottom, both spanning the section rather than the poster.
          Served from `public/assets/presenter-video.mp4` and referenced by URL:
          `next/image` cannot render video, and static video imports are not
          typed here (only `*.geojson` is declared), so a `public/` path is the
          supported route. Autoplay requires `muted` + `playsInline`. */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        src="/assets/presenter-video-2.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        tabIndex={-1}
      />

      {/* Search and CTAs over the artwork. The CTA scrim bleeds to the section
          edges with negative margins so it is not inset like the search bar. */}
      <div className="absolute inset-0 z-10 flex animate-hero-rise flex-col justify-between p-4 sm:p-6 lg:p-10">
        {/* Search and heading share one top block so the heading stays directly
            below the search bar instead of drifting to the vertical middle.
            `justify-between` on the parent still pins the CTAs to the bottom. */}
        <div className="w-full">
        <form
          onSubmit={onSearch}
          className="w-full max-w-3xl"
          role="search"
          aria-label="Property search"
        >
              {/* Search field. Padding lives on the bar itself so the input and
                  the Search button share one optical inset. */}
              <div className="flex items-center gap-2 rounded-full border border-accent bg-black/85 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition focus-within:shadow-[0_14px_40px_rgba(0,0,0,0.6),0_0_0_4px_rgba(198,164,108,0.18)] sm:gap-3 sm:p-2">
            <span className="ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/70 text-accent ring-1 ring-accent/50 sm:h-10 sm:w-10">
              <SearchIcon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </span>

            <div className="relative min-w-0 flex-1 py-2 sm:py-2.5">
              {showAnimatedPlaceholder ? (
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm font-medium tracking-wide text-white/70 sm:text-base"
                  aria-hidden
                >
                      <span>Search&nbsp;</span>
                      <span className="hero-search-word-slot">
                        {/* Reserve width of longest word to avoid layout jump */}
                        <span className="invisible whitespace-nowrap">
                          properties
                        </span>
                        <span
                          key={SEARCH_WORDS[wordIndex]}
                          className={`hero-search-word whitespace-nowrap ${
                            wordVisible
                              ? "hero-search-word--in"
                              : "hero-search-word--out"
                          }`}
                        >
                          {SEARCH_WORDS[wordIndex]}
                        </span>
                      </span>
                    </span>
                  ) : null}
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder=""
                    aria-label="Search location, area or properties"
                    className="relative z-10 min-w-0 w-full bg-transparent text-sm font-medium tracking-wide text-white outline-none sm:text-base"
                  />
                </div>

                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-xs font-bold tracking-[0.12em] text-black uppercase transition hover:bg-accent-bright sm:px-7 sm:text-sm"
                >
                  Search
                </button>
              </div>
            </form>

          {/* Heading. Left-aligned and two-tone, per the reference: dark text with a
              single gold word, underlined by a short gold rule. The artwork's
              upper half is bright, so the heading is dark-on-light rather than
              white with a shadow. `font-sans` maps to `--font-montserrat`, the
              same stack as the rest of the page, so the heading matches the
              body text instead of standing apart in a serif. */}
          <div className="mt-8 max-w-3xl sm:mt-10">
            <h1 className="font-sans text-[2.25rem] leading-[1.05] font-bold tracking-tight text-[#0f1114] sm:text-5xl lg:text-6xl">
              Find Your Place{" "}
              <span className="text-[#8a6d2f]">in Hyderabad.</span>
            </h1>
            <span
              aria-hidden
              className="mt-3 block h-1 w-14 rounded-full bg-[#8a6d2f]"
            />
            <p className="mt-3.5 max-w-md text-sm leading-relaxed font-medium text-[#3d434b] sm:text-base">
              Discover land, properties and homes built around your future.
            </p>
          </div>
        </div>

            {/* CTAs, bottom-left per the reference, and always side by side.
                `flex-nowrap` + `shrink-0`/`whitespace-nowrap` stop the pills from
                dropping onto separate lines or their labels breaking mid-phrase.
                Each is a pill with a circular icon badge on the leading edge and an
                arrow on the trailing edge.
                The scrim is much lighter than the previous version — the
                reference keeps the artwork bright under the buttons. */}
            <div className="-mx-4 -mb-4 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.22)_55%,rgba(0,0,0,0.42)_100%)] px-4 pb-4 pt-16 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6 lg:-mx-10 lg:-mb-10 lg:px-10 lg:pb-10">
              <div className="flex max-w-3xl flex-nowrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={onExploreProperties}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent py-1.5 pr-3 pl-1.5 text-[11px] font-bold tracking-[0.06em] text-black uppercase transition hover:bg-accent-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:gap-2.5 sm:py-2 sm:pr-5 sm:pl-2 sm:text-sm sm:tracking-[0.08em]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/85 text-accent sm:h-8 sm:w-8">
                    <BookIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  Explore properties
                  <ArrowIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>

                <button
                  type="button"
                  onClick={onViewMap}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0f1114] py-1.5 pr-3 pl-1.5 text-[11px] font-bold tracking-[0.06em] text-white uppercase transition hover:bg-[#2a2e38] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1114] sm:gap-2.5 sm:py-2 sm:pr-5 sm:pl-2 sm:text-sm sm:tracking-[0.08em]"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#0f1114] sm:h-8 sm:w-8">
                    <PinIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  View map
                  <ArrowIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
      </div>
    </section>
  );
}
