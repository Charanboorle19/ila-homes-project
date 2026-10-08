"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import heroMobile from "@/app/assets/hero-image-mobile.png";
import { trackEvent } from "@/services/analytics/tracker";

const FILTERS = ["All", "Land", "Plots", "Villas"] as const;
const SEARCH_WORDS = ["location", "area", "properties"] as const;

type Filter = (typeof FILTERS)[number];

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

export default function Hero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
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

  const onSearch = (event: FormEvent) => {
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

    const el = document.getElementById("projects");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/#projects");
  };

  const showAnimatedPlaceholder = !query && !inputFocused;

  return (
    <section data-section="hero_map"
      ref={sectionRef}
      className="relative h-[calc(100svh-var(--nav-h))] w-full overflow-hidden bg-black md:h-[calc(100dvh-var(--nav-h))]"
      aria-label="ILA Homes hero"
    >
      <Image
        src={heroMobile}
        alt="ILA Homes — land to living across Hyderabad"
        fill
        priority
        sizes="(max-width: 767px) 100vw, 1px"
        className="pointer-events-none object-cover object-[center_18%] md:hidden animate-hero-zoom"
      />
      <Image
        src="/hero-image.png"
        alt="ILA Homes — land to living across Hyderabad"
        fill
        priority
        sizes="(min-width: 768px) 100vw, 1px"
        className="pointer-events-none hidden object-cover object-center md:block animate-hero-zoom"
      />

      {/* Cinematic dark wash — top on mobile (search), bottom on desktop */}
      <div
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.18)_28%,rgba(0,0,0,0.12)_55%,rgba(0,0,0,0.35)_100%)] md:bg-[linear-gradient(180deg,rgba(0,0,0,0.28)_0%,rgba(0,0,0,0.12)_38%,rgba(0,0,0,0.45)_68%,rgba(0,0,0,0.82)_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 top-0 h-[34%] bg-[linear-gradient(180deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.35)_55%,transparent_100%)] md:hidden"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 hidden h-[42%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.55)_55%,rgba(0,0,0,0.88)_100%)] md:block"
        aria-hidden
      />

      {/* Floating search — top on mobile, bottom on desktop */}
      <div className="absolute inset-x-0 top-4 z-10 flex justify-center px-4 sm:top-5 md:top-auto md:bottom-9 md:px-6 lg:bottom-12 animate-hero-rise">
        <form
          onSubmit={onSearch}
          className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl"
          role="search"
          aria-label="Property search"
        >
          <div className="flex items-stretch overflow-hidden rounded-xl border border-accent/70 bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.65),0_0_0_1px_rgba(198,164,108,0.25)] backdrop-blur-md transition focus-within:border-accent focus-within:shadow-[0_20px_60px_rgba(0,0,0,0.7),0_0_24px_rgba(198,164,108,0.2)]">
            <div className="relative flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-accent sm:h-6 sm:w-6" />
              <div className="relative min-w-0 flex-1">
                {showAnimatedPlaceholder ? (
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-base font-medium tracking-wide text-white/60 sm:text-lg"
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
                  className="relative z-10 min-w-0 w-full bg-transparent text-base font-medium tracking-wide text-white outline-none sm:text-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="shrink-0 bg-accent px-5 text-xs font-bold tracking-[0.14em] text-black uppercase transition hover:bg-accent-bright sm:px-7 sm:text-sm"
            >
              Search
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:mt-3.5 sm:gap-2.5">
            {FILTERS.map((item) => {
              const active = filter === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  data-track="PROPERTY_FILTER"
                  data-track-meta={`{"filters":{"property_type":"${item}"}}`}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.12em] uppercase transition sm:px-5 sm:py-2.5 sm:text-sm ${
                    active
                      ? "bg-accent text-black"
                      : "border border-white/25 bg-black/55 text-white backdrop-blur-sm hover:border-accent/50 hover:bg-black/70"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </form>
      </div>
    </section>
  );
}
