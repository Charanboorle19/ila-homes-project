"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchActiveFeatures,
  featureApiErrorMessage,
  findPropertiesByFeatures,
  type PropertyFeature,
  type PropertyMatch,
} from "@/services/featuresService";
import {
  fetchFavorites,
  removeFavorite,
  saveFavorite,
} from "@/services/favoritesService";

const MOBILE_SHEET_QUERY = "(max-width: 980px)";

/** Live results panel states. `empty` is a real outcome, not a failure. */
type ResultStatus = "idle" | "loading" | "ready" | "empty" | "error";

/**
 * What one result card renders.
 *
 * There is a single data source now — `POST /api/match-properties` — so this is
 * a view model built once from a `PropertyMatch`, not a reconciliation layer
 * between two sources.
 *
 * Every field the endpoint does not return is simply absent from the card. No
 * placeholder image, no invented price, no fabricated location: an earlier
 * version substituted a shared hero image for every result, which made an
 * unpopulated card look populated.
 */
type CardMatch = {
  id: string;
  label: string;
  /** Percentage pill, from a 0-10 `match_score`. Null when unscored. */
  badge: string | null;
  /** Per-feature score breakdown, e.g. "Family Friendly 9/10". */
  reason: string;
  href: string;
};

/**
 * Adapts a `POST /api/match-properties` item.
 *
 * `match_score` is a mean of 0-10 feature scores, so it is scaled by 10 before
 * being shown as a percentage.
 *
 * `feature_scores[].feature_name` holds the feature *key* on this endpoint, so
 * display names are resolved through `featureNames`, falling back to the key.
 * The score breakdown doubles as the reason line: it is the only explanation the
 * response supports, and it is factual.
 */
function featureCard(
  item: PropertyMatch,
  featureNames: Map<string, string>,
  selectedKeys: string[],
): CardMatch {
  const returned = item.feature_scores ?? [];

  // Only the features the visitor actually picked explain why this property
  // appeared. The endpoint is documented to return the requested ones, but
  // filtering keeps a card honest if it ever returns more.
  const requested = returned.filter((entry) =>
    selectedKeys.includes(entry.feature_key),
  );

  // Fall back to everything if nothing lines up, so the card never loses its
  // explanation entirely.
  const scores = (requested.length > 0 ? requested : returned)
    .slice()
    .sort((a, b) => b.score - a.score);

  const reason =
    scores.length === 0
      ? "Matched against your selected features."
      : scores
          .map((entry) => {
            const label = featureNames.get(entry.feature_key) ?? entry.feature_key;
            return `${label} ${entry.score}/10`;
          })
          .join(" · ");

  return {
    id: item.property_id,
    label: item.property_name,
    badge:
      item.match_score == null ? null : `${Math.round(item.match_score * 10)}%`,
    reason,
    // The endpoint returns ACTIVE properties with real UUIDs, which is what
    // /properties/[propertyId] requires.
    href: `/properties/${item.property_id}`,
  };
}

/** Rows of tiles visible at once. */
const BENTO_ROWS = 3;

/**
 * Bento span for one tile, in grid columns.
 *
 * The old layout was a fixed two-row strip scrolled horizontally, which only
 * worked because the ten hard-coded labels happened to be short and roughly
 * uniform. The labels now come from the tenant and their length is unknown, so
 * the width is derived from the content instead of being fixed:
 *
 * - A long name gets a double-width tile so it never wraps awkwardly or clips.
 * - The first tile leads wide regardless, so the grid reads as bento even when
 *   every label is short and nothing would otherwise differ.
 *
 * This returns a number rather than a class string because pagination has to
 * reason about spans as well as the markup does. Both read from here so the
 * layout and the page size can never disagree.
 */
function tileSpan(feature: PropertyFeature, index: number): 1 | 2 {
  return index === 0 || feature.name.length > 16 ? 2 : 1;
}

/** A tile paired with its index in the full, unpaginated list. */
type Tile = { feature: PropertyFeature; index: number };

/**
 * Splits the features into pages of exactly `BENTO_ROWS` rows.
 *
 * Counting items per page would be wrong: a double-width tile consumes two
 * columns, so nine tiles can occupy four rows rather than three. Instead this
 * walks the list accumulating each tile's span and cuts a page once it has
 * consumed `columns * BENTO_ROWS` column-units. A tile is never split across
 * pages, and the leftover unit stays inside the budget, so every page is
 * exactly three rows tall.
 *
 * The global index is carried through because the span rule is stated in terms
 * of it, and because the "showing 1-9 of 24" range needs it.
 */
function buildPages(features: PropertyFeature[], columns: number): Tile[][] {
  const budget = columns * BENTO_ROWS;
  const pages: Tile[][] = [];
  let current: Tile[] = [];
  let used = 0;

  features.forEach((feature, index) => {
    const span = tileSpan(feature, index);
    if (current.length > 0 && used + span > budget) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push({ feature, index });
    used += span;
  });

  if (current.length > 0) pages.push(current);

  // Always one page, so the caller never has to special-case an empty list.
  return pages.length > 0 ? pages : [[]];
}

/**
 * Reads the grid's live column count so pagination matches the layout.
 *
 * The breakpoints mirror the grid's Tailwind classes exactly. Without this the
 * page size would have to be guessed, and a wrong guess is visible: too large
 * and a page spills into a fourth row, too small and the grid looks half empty.
 */
function useBentoColumns(): number {
  const [columns, setColumns] = useState(3);

  useEffect(() => {
    // Default `sm` breakpoint is 640px, so two columns below that and four from
    // 1400px, with three in between.
    const narrow = window.matchMedia("(max-width: 639px)");
    const wide = window.matchMedia("(min-width: 1400px)");

    const sync = () => setColumns(narrow.matches ? 2 : wide.matches ? 4 : 3);
    sync();

    narrow.addEventListener("change", sync);
    wide.addEventListener("change", sync);
    return () => {
      narrow.removeEventListener("change", sync);
      wide.removeEventListener("change", sync);
    };
  }, []);

  return columns;
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({
  direction,
  className = "",
}: {
  direction: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IdleGlowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="url(#fyp-idle-glow)" opacity="0.9" />
      <circle cx="24" cy="24" r="10" fill="#c6a46c" opacity="0.35" />
      <circle cx="24" cy="24" r="4.5" fill="#c6a46c" />
      <defs>
        <radialGradient id="fyp-idle-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c6a46c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c6a46c" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function MatchCard({
  match,
  index,
  isSaved,
  isSaving,
  onFavoriteToggle,
  tone = "dark",
}: {
  match: CardMatch;
  index: number;
  isSaved: boolean;
  isSaving: boolean;
  onFavoriteToggle: (propertyId: string) => void;
  tone?: "dark" | "light";
}) {
  const label = String(index + 1).padStart(2, "0");
  const isLight = tone === "light";

  return (
    <article
      className={`flex items-start gap-3 overflow-hidden rounded-xl border p-3 sm:gap-3.5 sm:p-4 ${
        isLight
          ? "border-black/8 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
          : "border-[rgba(242,240,234,0.12)] bg-[#23262b]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          isLight ? "bg-[#1c1f24]/8 text-[#1c1f24]" : "bg-black/40 text-[#f2f0ea]"
        }`}
      >
        {label}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`min-w-0 text-sm font-semibold tracking-tight ${
              isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
            }`}
          >
            {match.label}
          </h3>
          {match.badge ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
                isLight
                  ? "bg-[#1c1f24]/8 text-[#1c1f24]"
                  : "bg-black/40 text-[#f2f0ea]"
              }`}
            >
              {match.badge}
            </span>
          ) : null}
        </div>

        <p
          className={`text-xs leading-snug ${
            isLight ? "text-[#4a463f]" : "text-[#c4beb3]"
          }`}
        >
          {match.reason}
        </p>

        <div
          className={`border-t pt-2 ${
            isLight ? "border-black/8" : "border-[rgba(242,240,234,0.1)]"
          }`}
        >
          <Link
            href={match.href}
            className="inline-block rounded-full bg-[#c6a46c] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#1c1f24] uppercase transition hover:bg-[#d4b57e]"
          >
            View
          </Link>
          <button
            type="button"
            aria-pressed={isSaved}
            disabled={isSaving}
            onClick={() => onFavoriteToggle(match.id)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase transition disabled:cursor-default disabled:opacity-70 ${
              isSaved
                ? isLight
                  ? "bg-[#1c1f24] text-[#f2f0ea]"
                  : "bg-[#c6a46c] text-[#1c1f24]"
                : isLight
                  ? "bg-[#1c1f24]/8 text-[#5c5852] hover:bg-[#c6a46c] hover:text-[#1c1f24]"
                  : "bg-black/40 text-[#f2f0ea] hover:bg-[#c6a46c] hover:text-[#1c1f24]"
            }`}
          >
            {isSaving
              ? isSaved
                ? "Removing…"
                : "Saving…"
              : isSaved
                ? "Saved as favourite"
                : "Save as favourite"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultsPanel({
  status,
  matches,
  loadingLabel,
  error,
  savedIds,
  savingIds,
  favoriteError,
  onFavoriteToggle,
  tone = "dark",
}: {
  status: ResultStatus;
  matches: CardMatch[];
  loadingLabel: string;
  error?: string | null;
  savedIds: Set<string>;
  savingIds: Set<string>;
  favoriteError?: string | null;
  onFavoriteToggle: (propertyId: string) => void;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";

  if (status === "idle") {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
        <IdleGlowIcon className="h-14 w-14" />
        <p
          className={`mt-4 text-base font-semibold ${
            isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
          }`}
        >
          Your matches will appear here
        </p>
        <p
          className={`mt-2 max-w-xs text-sm leading-relaxed ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          Pick what matters to you and we&apos;ll find properties that score on
          all of it.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="flex h-full min-h-64 flex-col items-center justify-center px-6 py-8 text-center"
        aria-busy="true"
      >
        <div
          className={`h-1 w-40 overflow-hidden rounded-full ${
            isLight ? "bg-black/10" : "bg-white/10"
          }`}
        >
          <div className="ila-fyp-progress h-full w-1/2 rounded-full bg-[#c6a46c]" />
        </div>
        <p
          className={`mt-4 text-base font-semibold ${
            isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
          }`}
        >
          Finding your match
        </p>
        <p
          className={`mt-1.5 text-sm ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          Searching properties for {loadingLabel}…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center"
        role="alert"
      >
        <p
          className={`text-base font-semibold ${
            isLight ? "text-[#a3352b]" : "text-[#e8a49e]"
          }`}
        >
          We couldn&apos;t load matches
        </p>
        <p
          className={`mt-2 max-w-xs text-sm leading-relaxed ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          {error || "Please try again."}
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
        <p
          className={`text-base font-semibold ${
            isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
          }`}
        >
          No exact match yet
        </p>
        <p
          className={`mt-2 max-w-xs text-sm leading-relaxed ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          A property has to score on every feature you pick. Remove one to widen
          the search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-0.5" aria-live="polite">
      {favoriteError ? (
        <p className="text-xs text-[#a3352b]" role="alert">
          {favoriteError}
        </p>
      ) : null}
      <p
        className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${
          isLight ? "text-[#8a6b3a]" : "text-[#c6a46c]"
        }`}
      >
        {matches.length} match{matches.length === 1 ? "" : "es"}
      </p>
      <div className="grid gap-2">
        {matches.map((match, index) => (
          <MatchCard
            key={`${match.id}-${index}`}
            match={match}
            index={index}
            isSaved={savedIds.has(match.id)}
            isSaving={savingIds.has(match.id)}
            onFavoriteToggle={onFavoriteToggle}
            tone={tone}
          />
        ))}
      </div>
    </div>
  );
}

export default function FindYourPlot() {
  // Feature chips, from GET /api/features.
  const [features, setFeatures] = useState<PropertyFeature[]>([]);
  const [featuresStatus, setFeaturesStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [featuresError, setFeaturesError] = useState<string | null>(null);

  // Selected feature keys and their results, from POST /api/match-properties.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [apiMatches, setApiMatches] = useState<PropertyMatch[]>([]);
  const [apiStatus, setApiStatus] = useState<ResultStatus>("idle");
  const [apiError, setApiError] = useState<string | null>(null);
  const matchAbort = useRef<AbortController | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const [favoriteError, setFavoriteError] = useState<string | null>(null);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_SHEET_QUERY);
    const sync = () => setIsMobileSheet(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchFavorites(controller.signal)
      .then((favorites) => {
        if (controller.signal.aborted) return;
        setSavedIds(new Set(favorites.map((favorite) => favorite.property_id)));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[find-your-plot] favorites could not be loaded", error);
        setFavoriteError("Could not load saved properties.");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      matchAbort.current?.abort();
    };
  }, []);

  /**
   * Loads the feature chips once on mount.
   *
   * This is the section's only input now. There is no local fallback list: a
   * failed load has to be reported, because there is nothing to fall back to
   * and an empty row would read as "no features configured" rather than as a
   * network problem.
   */
  useEffect(() => {
    const controller = new AbortController();

    fetchActiveFeatures(controller.signal)
      .then((list) => {
        setFeatures(list);
        setFeaturesStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFeaturesStatus("error");
        setFeaturesError(featureApiErrorMessage(error));
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isMobileSheet || !sheetOpen) {
      document.body.style.overflow = "";
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileSheet, sheetOpen]);

  /**
   * Runs a feature search, cancelling any request still in flight.
   *
   * Aborting the previous request rather than merely ignoring its response is
   * what keeps rapid chip clicks correct: without it, a slow early request can
   * settle after a fast later one and render results for the wrong selection.
   */
  const runFeatureSearch = async (keys: string[]) => {
    matchAbort.current?.abort();
    const controller = new AbortController();
    matchAbort.current = controller;

    setApiStatus("loading");
    setApiError(null);
    if (isMobileSheet) setSheetOpen(true);

    try {
      const result = await findPropertiesByFeatures(keys, controller.signal);
      if (controller.signal.aborted) return;
      setApiMatches(result.items);
      // `total: 0` is a valid answer, not a failure: matching is AND, so a
      // narrow selection legitimately matches nothing.
      setApiStatus(result.items.length === 0 ? "empty" : "ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setApiMatches([]);
      setApiStatus("error");
      setApiError(featureApiErrorMessage(error));
    }
  };

  const toggleFeature = (key: string) => {
    const next = selectedKeys.includes(key)
      ? selectedKeys.filter((item) => item !== key)
      : [...selectedKeys, key];

    setSelectedKeys(next);

    if (next.length === 0) {
      // Removing the last chip returns the section to idle rather than
      // searching for nothing. `findPropertiesByFeatures` would answer an empty
      // selection with no matches, which is not what "nothing selected" means.
      matchAbort.current?.abort();
      setApiMatches([]);
      setApiStatus("idle");
      setApiError(null);
      setSheetOpen(false);
      return;
    }

    void runFeatureSearch(next);
  };

  const handleFavoriteToggle = async (propertyId: string) => {
    const isSaved = savedIds.has(propertyId);
    if (savingIds.has(propertyId)) return;

    setFavoriteError(null);
    setSavingIds((current) => new Set(current).add(propertyId));

    try {
      if (isSaved) {
        await removeFavorite(propertyId);
        setSavedIds((current) => {
          const next = new Set(current);
          next.delete(propertyId);
          return next;
        });
      } else {
        await saveFavorite(propertyId);
        setSavedIds((current) => new Set(current).add(propertyId));
      }
    } catch (error: unknown) {
      console.warn("[find-your-plot] favorite toggle failed", error);
      setFavoriteError(
        isSaved
          ? "Could not remove this property. Please try again."
          : "Could not save this property. Please try again.",
      );
    } finally {
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(propertyId);
        return next;
      });
    }
  };

  /** Feature key -> display name, for the score breakdown on each card. */
  const featureNames = useMemo(
    () => new Map(features.map((feature) => [feature.key, feature.name])),
    [features],
  );

  const cards = useMemo<CardMatch[]>(
    () =>
      apiMatches.map((item) =>
        featureCard(item, featureNames, selectedKeys),
      ),
    [apiMatches, featureNames, selectedKeys],
  );

  const loadingLabel =
    selectedKeys
      .map((key) => features.find((feature) => feature.key === key)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || "your preferences";

  const columns = useBentoColumns();

  /**
   * Pages are rebuilt when the column count changes, so the page size always
   * matches the layout. `safePage` clamps rather than resets: resizing the
   * window should not throw the visitor back to the first page if they were
   * already further in, it should just land on the nearest page that exists.
   */
  const pages = useMemo(
    () => buildPages(features, columns),
    [features, columns],
  );
  const pageCount = pages.length;
  const safePage = Math.min(page, pageCount - 1);
  const visible = pages[safePage] ?? [];

  const firstTile = visible[0]?.index ?? 0;
  const lastTile = visible[visible.length - 1]?.index ?? 0;

  return (
    <section
      data-section="land_roadmap"
      id="contact"
      className="find-your-plot relative w-full max-w-full overflow-x-clip border-t border-white/5 bg-[#1c1f24]"
      aria-label="Find your plot"
    >
      <div className="relative mx-auto w-full max-w-full min-w-0 px-4 py-10 sm:px-8 sm:py-12 lg:px-12">
        <header className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#c6a46c] uppercase">
            Find your plot
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2f0ea] sm:text-3xl">
            What matters to you?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9a9388] sm:text-[15px]">
            Pick what you care about. We&apos;ll show you properties that score
            on every one of it.
          </p>
        </header>

        <div className="mt-8 grid min-w-0 gap-8 min-[981px]:grid-cols-[1.15fr_0.85fr] min-[981px]:items-start min-[981px]:gap-10">
          <div className="min-w-0 space-y-4">
            <div className="min-w-0">
              {featuresStatus === "loading" ? (
                <p
                  className="text-sm text-[#9a9388]"
                  role="status"
                  aria-live="polite"
                >
                  Loading options…
                </p>
              ) : null}

              {featuresStatus === "error" ? (
                <p className="text-sm text-[#e8a49e]" role="alert">
                  {featuresError ?? "Could not load options."}
                </p>
              ) : null}

              {featuresStatus === "ready" && features.length === 0 ? (
                <p className="text-sm text-[#9a9388]">
                  No options are available right now. Please check back soon.
                </p>
              ) : null}

              {features.length > 0 ? (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#c4beb3] uppercase">
                      What matters to you
                    </p>
                    {selectedKeys.length > 0 ? (
                      <p className="shrink-0 text-[10px] font-semibold tracking-[0.18em] text-[#c6a46c] uppercase tabular-nums">
                        {selectedKeys.length} selected
                      </p>
                    ) : null}
                  </div>

                  {/* Bento grid.

                      Two things are tuned to the width this block actually gets
                      rather than to the viewport. Above 981px the section
                      splits into 1.15fr / 0.85fr, so the left block is only
                      about 500px even on a wide screen — a fourth column there
                      would leave ~118px tiles and wrap every label, so the
                      fourth column waits until 1400px where it is earned.

                      `grid-auto-flow-dense` backfills the row a double-width
                      tile opens instead of leaving a hole. The trade is that
                      visual order can then differ from DOM order, so tab
                      sequence may not read strictly left-to-right. That is
                      accepted here because each tile carries its own label and
                      announces its own pressed state, so it remains unambiguous
                      when focused out of visual sequence. Drop `dense` if
                      strict visual/tab order matters more than an even grid. */}
                  <div
                    className="mt-3 grid grid-flow-row-dense grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 min-[1400px]:grid-cols-4"
                    role="group"
                    aria-label="What matters to you"
                  >
                    {visible.map(({ feature, index }) => {
                      const isOn = selectedKeys.includes(feature.key);
                      return (
                        <button
                          key={feature.key}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggleFeature(feature.key)}
                          data-track="PREFERENCE_TAG_SELECT"
                          // Serialized rather than interpolated: `key` comes
                          // from the tenant, so a quote or backslash in it
                          // would produce malformed JSON.
                          data-track-meta={JSON.stringify({
                            tag_id: feature.key,
                            selected: !isOn,
                          })}
                          className={`group relative flex min-h-28 flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c] sm:min-h-32 sm:p-4 ${
                            tileSpan(feature, index) === 2 ? "col-span-2" : ""
                          } ${
                            isOn
                              ? "border-[#c6a46c] bg-[#c6a46c] text-[#1c1f24] shadow-[0_0_0_1px_rgba(198,164,108,0.45)]"
                              : "border-[rgba(242,240,234,0.14)] bg-[#23262b] text-[#f2f0ea] hover:border-[rgba(242,240,234,0.3)] hover:bg-[#272a30]"
                          }`}
                        >
                          {isOn ? (
                            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#1c1f24]/15 text-[#1c1f24] sm:top-3.5 sm:right-3.5">
                              <CheckIcon className="h-3 w-3" />
                            </span>
                          ) : null}

                          {/* The width cap exists only to keep the label clear of the
                              check badge, so it is applied only when the badge
                              is actually rendered. */}
                          <span
                            className={`text-sm font-semibold leading-snug sm:text-[15px] ${
                              isOn ? "max-w-[85%] pr-1" : ""
                            }`}
                          >
                            {feature.name}
                          </span>

                          {/* The guide allows displaying the description, and
                              the tiles are now large enough to carry it
                              properly instead of hiding it in a title
                              attribute. Clamped so a long description cannot
                              stretch one tile out of the grid. */}
                          {feature.description ? (
                            <span
                              className={`line-clamp-2 text-xs leading-snug ${
                                isOn ? "text-[#1c1f24]/70" : "text-[#9a9388]"
                              }`}
                            >
                              {feature.description}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  {/* AND matching is the single most surprising thing about
                      this API, so it is stated rather than left to be
                      discovered via an empty result. */}
                  <p className="mt-3 text-xs text-[#9a9388]">
                    A property has to score on every option you pick, so adding
                    more narrows the search.
                  </p>

                  {/* Paging. Only three rows are rendered at a time, so a
                      long feature list cannot push the results panel out of
                      reach. The controls are omitted entirely when everything
                      already fits, rather than being shown disabled. */}
                  {pageCount > 1 ? (
                    <nav
                      className="mt-4 flex items-center justify-between gap-3"
                      aria-label="Feature pages"
                    >
                      <button
                        type="button"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 0}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition ${
                          safePage === 0
                            ? "cursor-not-allowed border-[rgba(242,240,234,0.08)] text-[#6b655c]"
                            : "border-[rgba(242,240,234,0.2)] text-[#f2f0ea] hover:border-[#c6a46c]"
                        }`}
                      >
                        <ChevronIcon direction="left" className="h-3.5 w-3.5" />
                        Previous
                      </button>

                      <p className="text-xs tabular-nums text-[#9a9388]">
                        {firstTile + 1}
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">to</span>
                        {lastTile + 1} of {features.length}
                      </p>

                      <button
                        type="button"
                        onClick={() => setPage(safePage + 1)}
                        disabled={safePage >= pageCount - 1}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition ${
                          safePage >= pageCount - 1
                            ? "cursor-not-allowed border-[rgba(242,240,234,0.08)] text-[#6b655c]"
                            : "border-[rgba(242,240,234,0.2)] text-[#f2f0ea] hover:border-[#c6a46c]"
                        }`}
                      >
                        Next
                        <ChevronIcon direction="right" className="h-3.5 w-3.5" />
                      </button>
                    </nav>
                  ) : null}
                </>
              ) : null}
            </div>

            {isMobileSheet && apiStatus !== "idle" && !sheetOpen ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-[#c6a46c] px-4 py-2.5 text-xs font-semibold tracking-wide text-[#1c1f24] uppercase transition hover:bg-[#d4b57e] min-[981px]:hidden"
              >
                View matches
              </button>
            ) : null}
          </div>

          <aside className="hidden min-[981px]:block">
            <div className="sticky top-24 min-h-112 overflow-hidden rounded-[22px] bg-[radial-gradient(ellipse_at_50%_28%,#ffffff_0%,#f4f0e8_55%,#ebe4d8_100%)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
              <div className="max-h-[min(70vh,40rem)] overflow-y-auto">
                <ResultsPanel
                  status={apiStatus}
                  matches={cards}
                  loadingLabel={loadingLabel}
                  error={apiError}
                  savedIds={savedIds}
                  savingIds={savingIds}
                  favoriteError={favoriteError}
                  onFavoriteToggle={handleFavoriteToggle}
                  tone="light"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isMobileSheet && sheetOpen ? (
        <div className="fixed inset-0 z-50 min-[981px]:hidden">
          <button
            type="button"
            aria-label="Close matches"
            className="absolute inset-0 bg-black/55"
            onClick={() => setSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your plot matches"
            className="animate-sheet-up absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[rgba(242,240,234,0.12)] bg-[#1c1f24] px-4 pt-3 pb-6 shadow-[0_-16px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="relative mb-3 flex items-center justify-center">
              <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
              <button
                type="button"
                aria-label="Close matches sheet"
                onClick={() => setSheetOpen(false)}
                className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2d32] text-[#f2f0ea]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <ResultsPanel
              status={apiStatus}
              matches={cards}
              loadingLabel={loadingLabel}
              error={apiError}
              savedIds={savedIds}
              savingIds={savingIds}
              favoriteError={favoriteError}
              onFavoriteToggle={handleFavoriteToggle}
              tone="dark"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}