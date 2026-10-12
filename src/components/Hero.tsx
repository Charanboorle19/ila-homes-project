"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubmitEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "@/services/analytics/tracker";
import {
  fetchProperties,
  formatPrice,
  searchProperties,
  type PropertySearchResult,
} from "@/services/propertiesService";
import { ILA_API_BASE_URL } from "@/lib/ilaApiConfig";

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

  /**
   * Results popup.
   *
   * The hero used to fire an analytics event and scroll to the map, which left
   * the typed query with nowhere to go — `MapSection` holds its own `query`
   * state and nothing handed it over. Submitting now reads the catalogue and
   * shows the response here instead, so the search answers on the page it was
   * typed on.
   */
  const [results, setResults] = useState<PropertySearchResult[] | null>(null);
  const [recommendations, setRecommendations] = useState<
    PropertySearchResult[]
  >([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<{
    total: number;
    searched: string;
  } | null>(null);
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  /** Guards against a slow response landing after the popup was closed. */
  const searchAbortRef = useRef<AbortController | null>(null);

  // The hero section is `overflow-hidden`, which would clip an in-tree dialog.
  // Portalling to <body> makes it a true page-level overlay. A portal needs a
  // real DOM, so hold off until after the client mount.
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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

  const closeResults = () => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    setResults(null);
    setRecommendations([]);
    setSearchMessage(null);
    setResultMeta(null);
    setSearchStatus("idle");
  };

  /**
   * Submitting a search queries the natural language property search endpoint
   * `GET /api/search?q={query}&limit=20` and falls back gracefully to client-side
   * filtered catalogue if the search endpoint is unreachable or query is short.
   */
  const onSearch = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmed = query.trim();

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

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearchStatus("loading");
    setSearchMessage(null);

    if (trimmed.length >= 2) {
      console.log(
        `[hero search] GET ${ILA_API_BASE_URL}/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
        { searched: trimmed },
      );

      searchProperties({
        query: trimmed,
        limit: 20,
        signal: controller.signal,
      })
        .then((resp) => {
          if (controller.signal.aborted) return;
          console.log("[hero search] search response", resp);

          const matches = resp.properties ?? [];
          const recs = resp.recommendations ?? [];
          setResults(matches);
          setRecommendations(recs);
          setSearchMessage(resp.message ?? null);
          setResultMeta({
            total: matches.length + recs.length,
            searched: trimmed,
          });
          setSearchStatus("ready");
        })
        .catch(async (error: unknown) => {
          if (controller.signal.aborted) return;
          console.warn(
            "[hero search] /api/search failed, falling back to catalogue",
            error,
          );

          try {
            const result = await fetchProperties({
              status: "ALL",
              page: 1,
              perPage: 100,
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;

            const q = trimmed.toLowerCase();
            const matched = result.items.filter((item) =>
              [
                item.name,
                item.property_type,
                item.slug,
                item.description,
                item.locality,
                item.city,
              ]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(q)),
            );

            const toSearchResult = (
              item: (typeof result.items)[number],
            ): PropertySearchResult => ({
              type: "property",
              id: item.id,
              title: item.name,
              subtitle:
                [item.property_type, item.locality, item.city]
                  .filter(Boolean)
                  .join(" · ") || "Development",
              href: `/properties/${item.id}`,
              price: item.price,
              bedrooms: null,
              property_type: item.property_type ?? "Development",
              location:
                [item.locality, item.city].filter(Boolean).join(", ") ||
                item.address ||
                null,
              nearby_place: null,
              distance_km: null,
            });

            if (matched.length > 0) {
              setResults(matched.map(toSearchResult));
              setRecommendations([]);
              setSearchMessage(null);
              setResultMeta({
                total: matched.length,
                searched: trimmed,
              });
            } else {
              const recs = result.items.slice(0, 5).map(toSearchResult);
              setResults([]);
              setRecommendations(recs);
              setSearchMessage(
                `No exact matches found for “${trimmed}”. Here are ${recs.length} other developments you might be interested in.`,
              );
              setResultMeta({
                total: recs.length,
                searched: trimmed,
              });
            }
            setSearchStatus("ready");
          } catch (fallbackError) {
            if (controller.signal.aborted) return;
            console.warn("[hero search] fallback failed", fallbackError);
            setResults([]);
            setRecommendations([]);
            setSearchMessage(null);
            setResultMeta(null);
            setSearchStatus("error");
          }
        });
    } else {
      // Query is empty or 1 character: load all published developments
      fetchProperties({
        status: "ALL",
        page: 1,
        perPage: 100,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          const mapped: PropertySearchResult[] = result.items.map((item) => ({
            type: "property",
            id: item.id,
            title: item.name,
            subtitle:
              [item.property_type, item.locality, item.city]
                .filter(Boolean)
                .join(" · ") || "Development",
            href: `/properties/${item.id}`,
            price: item.price,
            bedrooms: null,
            property_type: item.property_type ?? "Development",
            location:
              [item.locality, item.city].filter(Boolean).join(", ") ||
              item.address ||
              null,
            nearby_place: null,
            distance_km: null,
          }));

          setResults(mapped);
          setRecommendations([]);
          setSearchMessage(null);
          setResultMeta({
            total: result.total,
            searched: trimmed,
          });
          setSearchStatus("ready");
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.warn("[hero search] properties list failed", err);
          setResults([]);
          setRecommendations([]);
          setSearchMessage(null);
          setResultMeta(null);
          setSearchStatus("error");
        });
    }
  };

  // The popup is an overlay over a full-height hero, so the page behind it must
  // stop scrolling, and Escape has to close it — otherwise a keyboard visitor
  // can land in a dialog with no way out.
  useEffect(() => {
    if (searchStatus === "idle") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeResults();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [searchStatus]);

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

      {/* Search results dialog.
          Portalled to <body> so the hero's own `overflow-hidden` cannot clip it.
          The backdrop is a click target that closes, and Escape closes from the
          effect above, so the dialog is never a dead end. Results come straight
          from the API response — the query is not sent to the server, so this
          is the whole catalogue the endpoint returned, not a filtered subset. */}
      {portalReady && searchStatus !== "idle"
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Search results"
              onClick={(event) => {
                // Only a click on the backdrop itself closes; clicks that start
                // inside the panel must not bubble out and dismiss it.
                if (event.target === event.currentTarget) closeResults();
              }}
            >
              <div className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-[#ebe6de] shadow-[0_24px_64px_rgba(0,0,0,0.45)] sm:my-8">
                <div className="flex items-start justify-between gap-4 border-b border-black/10 bg-white/60 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[0.22em] text-[#8a6d2f] uppercase">
                      Search results
                    </p>
                    <h2 className="mt-1 truncate text-lg font-bold tracking-tight text-[#0f1114] sm:text-xl">
                      {resultMeta?.searched
                        ? `Results for “${resultMeta.searched}”`
                        : "All developments"}
                    </h2>
                    {resultMeta ? (
                      <p className="mt-0.5 text-xs font-medium text-[#3d434b]">
                        {resultMeta.total} {resultMeta.total === 1 ? "result" : "results"} found
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={closeResults}
                    aria-label="Close search results"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/6 text-[#0f1114] transition hover:bg-black/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6d2f]"
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                  {searchStatus === "loading" ? (
                    <p className="flex items-center justify-center gap-2 px-5 py-14 text-sm font-medium text-[#3d434b]">
                      <span className="ila-loader ila-loader--sm" aria-hidden />
                      Searching developments&hellip;
                    </p>
                  ) : null}

                  {searchStatus === "error" ? (
                    <p className="px-5 py-14 text-center text-sm font-medium text-[#8a5a2b]">
                      Developments could not be loaded. Please try again shortly.
                    </p>
                  ) : null}

                  {searchStatus === "ready" ? (
                    <>
                      {/* Highlighted message before the list of data */}
                      {searchMessage ? (
                        <div className="border-b border-black/8 bg-gradient-to-r from-[#faf7f2] via-[#f5eee3] to-[#faf7f2] px-5 py-3.5">
                          <div className="flex items-start gap-3 rounded-xl border border-[#8a6d2f]/35 bg-white/80 p-3.5 shadow-xs ring-1 ring-[#8a6d2f]/20">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#8a6d2f] text-white">
                              <svg
                                className="h-3 w-3"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#8a6d2f]">
                                Notice
                              </p>
                              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#1e2229] sm:text-sm">
                                {searchMessage}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* No results at all */}
                      {(results?.length ?? 0) === 0 &&
                      recommendations.length === 0 ? (
                        <p className="px-5 py-14 text-center text-sm font-medium text-[#3d434b]">
                          No developments match your search.
                        </p>
                      ) : null}

                      {/* Exact matches list */}
                      {results && results.length > 0 ? (
                        <div>
                          {recommendations.length > 0 ? (
                            <div className="border-b border-black/6 bg-black/[0.02] px-5 py-2 text-[10px] font-bold tracking-[0.18em] uppercase text-[#8a6d2f]">
                              Exact Matches ({results.length})
                            </div>
                          ) : null}
                          <ul>
                            {results.map((item) => {
                              const priceDisplay = formatPrice(item.price);
                              return (
                                <li
                                  key={item.id}
                                  className="border-b border-black/8 transition last:border-b-0 hover:bg-black/[0.02]"
                                >
                                  <Link
                                    href={item.href || `/properties/${item.id}`}
                                    onClick={closeResults}
                                    className="block px-5 py-4"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#8a6d2f]">
                                          {item.property_type ?? "Development"}
                                        </p>
                                        <h3 className="mt-1 text-[15px] font-bold leading-snug wrap-break-word text-[#0f1114]">
                                          {item.title}
                                        </h3>
                                        {item.subtitle &&
                                        item.subtitle !== item.title ? (
                                          <p className="mt-0.5 line-clamp-1 text-xs text-[#5c6470]">
                                            {item.subtitle}
                                          </p>
                                        ) : null}
                                      </div>
                                      {priceDisplay !== "Price on request" ? (
                                        <span className="shrink-0 rounded-full bg-black/6 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#0f1114]">
                                          {priceDisplay}
                                        </span>
                                      ) : null}
                                    </div>

                                    {item.location ? (
                                      <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[#3d434b]">
                                        <PinIcon className="mt-[0.15em] h-3.5 w-3.5 shrink-0 text-[#8a6d2f]" />
                                        <span className="min-w-0 wrap-break-word">
                                          {item.location}
                                        </span>
                                      </p>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {item.bedrooms != null ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f2ec] px-2.5 py-1 text-[11px] font-bold text-[#1f5c45]">
                                          {item.bedrooms} BHK
                                        </span>
                                      ) : null}
                                      {item.nearby_place ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/6 px-2.5 py-1 text-[11px] font-semibold text-[#3d434b]">
                                          <PinIcon className="h-3 w-3 text-[#8a6d2f]" />
                                          {item.distance_km != null
                                            ? `${item.distance_km} km from `
                                            : "Near "}
                                          {item.nearby_place}
                                        </span>
                                      ) : null}
                                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#8a6d2f]">
                                        View property
                                        <ArrowIcon className="h-3 w-3" />
                                      </span>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {/* Recommendations list */}
                      {recommendations.length > 0 ? (
                        <div>
                          <div className="border-b border-black/6 bg-black/[0.02] px-5 py-2 text-[10px] font-bold tracking-[0.18em] uppercase text-[#8a6d2f]">
                            {results && results.length > 0
                              ? `Alternative Recommendations (${recommendations.length})`
                              : `Recommended Properties (${recommendations.length})`}
                          </div>
                          <ul>
                            {recommendations.map((item) => {
                              const priceDisplay = formatPrice(item.price);
                              return (
                                <li
                                  key={item.id}
                                  className="border-b border-black/8 transition last:border-b-0 hover:bg-black/[0.02]"
                                >
                                  <Link
                                    href={item.href || `/properties/${item.id}`}
                                    onClick={closeResults}
                                    className="block px-5 py-4"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#8a6d2f]">
                                            {item.property_type ??
                                              "Development"}
                                          </span>
                                          <span className="rounded-full bg-[#8a6d2f]/10 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-[#8a6d2f]">
                                            Recommended
                                          </span>
                                        </div>
                                        <h3 className="mt-1 text-[15px] font-bold leading-snug wrap-break-word text-[#0f1114]">
                                          {item.title}
                                        </h3>
                                        {item.subtitle &&
                                        item.subtitle !== item.title ? (
                                          <p className="mt-0.5 line-clamp-1 text-xs text-[#5c6470]">
                                            {item.subtitle}
                                          </p>
                                        ) : null}
                                      </div>
                                      {priceDisplay !== "Price on request" ? (
                                        <span className="shrink-0 rounded-full bg-black/6 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-[#0f1114]">
                                          {priceDisplay}
                                        </span>
                                      ) : null}
                                    </div>

                                    {item.location ? (
                                      <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-[#3d434b]">
                                        <PinIcon className="mt-[0.15em] h-3.5 w-3.5 shrink-0 text-[#8a6d2f]" />
                                        <span className="min-w-0 wrap-break-word">
                                          {item.location}
                                        </span>
                                      </p>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {item.bedrooms != null ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f2ec] px-2.5 py-1 text-[11px] font-bold text-[#1f5c45]">
                                          {item.bedrooms} BHK
                                        </span>
                                      ) : null}
                                      {item.nearby_place ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-black/6 px-2.5 py-1 text-[11px] font-semibold text-[#3d434b]">
                                          <PinIcon className="h-3 w-3 text-[#8a6d2f]" />
                                          {item.distance_km != null
                                            ? `${item.distance_km} km from `
                                            : "Near "}
                                          {item.nearby_place}
                                        </span>
                                      ) : null}
                                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#8a6d2f]">
                                        View property
                                        <ArrowIcon className="h-3 w-3" />
                                      </span>
                                    </div>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
