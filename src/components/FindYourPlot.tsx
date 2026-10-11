"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchActiveFeatures,
  featureApiErrorMessage,
  findPropertiesByFeatures,
  type PropertyFeature,
  type PropertyMatch,
} from "@/services/featuresService";
import {
  fetchProperties,
  formatPrice,
  type PropertyListItem,
} from "@/services/propertiesService";
import { fetchLocations } from "@/services/locationsService";
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
 * `POST /api/match-properties` returns summary data only — id, name, slug,
 * `match_score`, `feature_scores`. A thumbnail, a price and a locality have to
 * come from `GET /api/properties` and `GET /api/locations`, joined in by
 * `property_id` and `location_id`; see `propertyIndex` and `localityNames` in the
 * component below.
 *
 * Fields neither source supplies are omitted rather than filled in. An earlier
 * version substituted a shared hero image for every result, which made an
 * unpopulated card look populated.
 */
type CardMatch = {
  id: string;
  label: string;
  /** Headline match percentage, from a 0-10 `match_score`. Null when unscored. */
  badge: string | null;
  /**
   * Per-criterion scores, highest first.
   *
   * Empty when the visitor picked a single criterion: with one criterion the
   * overall match *is* that criterion, so listing it again just printed the
   * same number twice.
   */
  breakdown: { label: string; score: number }[];
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

  // One criterion means the overall match and that criterion's score are the
  // same figure, so a breakdown would just restate the headline.
  const breakdown =
    selectedKeys.length > 1
      ? scores.map((entry) => ({
          label: featureNames.get(entry.feature_key) ?? entry.feature_key,
          score: entry.score,
        }))
      : [];

  return {
    id: item.property_id,
    label: item.property_name,
    badge:
      item.match_score == null ? null : `${Math.round(item.match_score * 10)}%`,
    breakdown,
    // The endpoint returns ACTIVE properties with real UUIDs, which is what
    // /properties/[propertyId] requires.
    //
    // **Plural, not singular.** `/property/[trackingToken]/view` is the share
    // landing route and takes a tracking token, not a property id;
    // `/property/{id}` has no page and answers 404. Verified against the dev
    // server. Every other component links here the same way -- GrowthCorridors,
    // MapSection, PropertiesList, CompareProperties, SimilarProperties.
    href: `/properties/${item.property_id}`,
  };
}

/**
 * The tile grid is a fixed 2x2 at every viewport, so a page is four tiles.
 *
 * This used to be derived: `useBentoColumns` read the live column count from two
 * media queries and `buildPages` cut `columns * BENTO_ROWS` tiles, giving 6, 9 or
 * 12 depending on width. A fixed 2x2 makes the page size something the visitor
 * can predict, and it makes every tile the same size rather than only the same
 * width.
 */
const TILES_PER_PAGE = 4;

/** A tile paired with its index in the full, unpaginated list. */
type Tile = { feature: PropertyFeature; index: number };

/**
 * Splits the features into fixed pages of `TILES_PER_PAGE`.
 *
 * The global index is carried through because the "showing 1-4 of 24" range has
 * to come from the position in the full list, not from the visible slice's own
 * indices.
 */
function buildPages(features: PropertyFeature[]): Tile[][] {
  const pages: Tile[][] = [];

  features.forEach((feature, index) => {
    const page = Math.floor(index / TILES_PER_PAGE);
    pages[page] = pages[page] ?? [];
    pages[page].push({ feature, index });
  });

  // Always one page, so the caller never has to special-case an empty list.
  return pages.length > 0 ? pages : [[]];
}

/**
 * Option glyphs.
 *
 * The tiles are scannable by shape before they are read: a family, a tree, a
 * shield and a rising arrow give four otherwise identical dark rectangles
 * distinct silhouettes, which is faster than parsing four label lengths.
 *
 * Stroke weight matches the chevron and close glyphs already in this file so
 * they read as one set at 16px.
 */
function FamilyIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 5.3a3 3 0 0 1 0 5.4M18 14.2A4.5 4.5 0 0 1 20.5 18.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5 6.5 9.5h11L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 7 5 16h14L12 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 16v5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5 4.5 5.8v5.6c0 4.5 3.1 8.2 7.5 10.1 4.4-1.9 7.5-5.6 7.5-10.1V5.8L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowthIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 16.5 9 11l3.5 3.5L20.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 6.5h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Picks an option glyph from the feature key.
 *
 * The keys are tenant-supplied and the endpoint returns whatever the tenant
 * configured, so this matches substrings instead of an exact list and returns
 * null for anything it does not recognise. A confidently wrong glyph on a card
 * is worse than no glyph: the label still carries the meaning on its own.
 *
 * Patterns are deliberately broad. `gated`, `cctv`, `boundary` and `safe` all
 * describe security; `lake`, `garden` and `open` all describe greenery. Widen
 * the groups rather than adding one-off keys as real data arrives.
 */
function featureIcon(key: string): ReactNode {
  const k = key.toLowerCase();

  if (/famil|child|kid|play/.test(k)) {
    return <FamilyIcon className="h-4 w-4" />;
  }
  if (/tree|green|park|nature|lake|garden|palm/.test(k)) {
    return <TreeIcon className="h-4 w-4" />;
  }
  if (/shiel|secur|safe|gated|cctv|guard|boundary/.test(k)) {
    return <ShieldIcon className="h-4 w-4" />;
  }
  if (/growth|grow|appreciat|return|invest|yield|profit|future/.test(k)) {
    return <GrowthIcon className="h-4 w-4" />;
  }
  return null;
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

/**
 * Fallback mark for the thumbnail slot.
 *
 * A 1px line icon rather than a solid glyph: it has to sit at low contrast
 * behind a label that starts 88px to its right, and anything heavier competes
 * with the property name.
 */
function BuildingIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 20.5h17M5.5 20.5V5.5A1.5 1.5 0 0 1 7 4h6a1.5 1.5 0 0 1 1.5 1.5v15M14.5 11H17a1.5 1.5 0 0 1 1.5 1.5v8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h3.5M8 11.5h3.5M8 15h3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon({
  filled = false,
  className = "",
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      aria-hidden
    >
      <path
        d="M12 20.3 4.9 13.4a4.4 4.4 0 0 1 6.2-6.2l.9.9.9-.9a4.4 4.4 0 0 1 6.2 6.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
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

/**
 * One result card, used unchanged by the desktop aside and the mobile sheet.
 *
 * There is no `tone` prop. The desktop panel used to be an opaque cream slab
 * while the sheet was dark, so the same result looked like two different things
 * on two viewports. Both are the same glass surface now, which is also why this
 * component has no branching at all.
 */
function MatchCard({
  match,
  index,
  isSaved,
  isSaving,
  onFavoriteToggle,
  property,
  localityName,
}: {
  match: CardMatch;
  index: number;
  isSaved: boolean;
  isSaving: boolean;
  onFavoriteToggle: (propertyId: string) => void;
  /** Joined from `GET /api/properties`. Null until loaded, or if not listed. */
  property: PropertyListItem | null;
  /** Resolved from `location_id` via `GET /api/locations`. */
  localityName: string | null;
}) {
  const label = String(index + 1).padStart(2, "0");

  const price = property ? formatPrice(property.price) : null;

  return (
    <article className="group relative overflow-hidden rounded-xl border border-[rgba(242,240,234,0.12)] bg-[rgba(242,240,234,0.1)] backdrop-blur-md">
      {/* Stretched link: the whole card is the "view" target.

          A <Link> wrapping the card would put the favourite button inside an
          anchor, which is invalid and makes screen readers announce one
          control.

          `pointer-events-none` on the content wrapper below is what makes this
          actually work. The wrapper is a *positioned* element that paints after
          this link in tree order, and hit testing follows paint order — so it
          sat on top and swallowed every click on the card. The link was
          reachable only in theory; tapping a result did nothing at all. */}
      <Link href={match.href} className="absolute inset-0 z-0 rounded-xl">
        <span className="sr-only">View {match.label}</span>
      </Link>

      <div className="pointer-events-none relative flex gap-3 p-3 sm:gap-3.5 sm:p-4">
        {/* The thumbnail slot is ALWAYS rendered, at a fixed 80px, whether or not
            there is an image.

            Two things were wrong when it was conditional. A property with no
            `cover_url` lost the slot entirely, so its text started 88px to the
            left of every other row and the row came out shorter. And a
            `cover_url` that failed to load — a presigned URL past its expiry
            answers 403 — rendered the browser's broken-image glyph on the dark
            card instead of disappearing.

            The fallback mark sits underneath the image, so hiding the failed
            `<img>` in `onError` reveals it rather than a hole. */}
            <span
              aria-hidden
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[rgba(242,240,234,0.06)]"
            >
              <span className="absolute inset-0 flex items-center justify-center text-[rgba(242,240,234,0.28)]">
                <BuildingIcon className="h-6 w-6" />
              </span>
              {property?.cover_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={property.cover_url}
                  alt=""
                  loading="lazy"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
            </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            {/* The rank number is only meaningful because `cards` is sorted by
                match score -- see the sort in the component below. */}
            <span
              aria-hidden
              className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-[#6b655c]"
            >
              {label}
            </span>

            <h3 className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-[#f2f0ea]">
              {match.label}
            </h3>

            {/* Gold, 12px, dark ink. It was a 9px pill on `bg-black/40`, which
                was a black chip with white text -- the least prominent thing on
                a card it is supposed to lead with. */}
            {match.badge ? (
              <span className="shrink-0 rounded-full bg-[#c6a46c] px-2.5 py-1 text-xs font-bold text-[#1c1f24] tabular-nums">
                {match.badge} match
              </span>
            ) : null}
          </div>

          {/* Both fields are always rendered, so every row starts and ends its text in
              the same place.

              `localityName` is null when the property has no `location_id`, or
              when its locality falls outside the 100 rows fetched. `formatPrice`
              already answers "Price on request" for a null or zero price, so
              the price side is never empty once the property record has loaded.
              Before it loads both read as unavailable rather than the whole
              line disappearing, which is what shifted the rows around. */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="text-[#c4beb3]">
              {localityName ?? <span className="text-[#6b655c]">Location unavailable</span>}
            </span>
            <span aria-hidden className="text-[#6b655c]">
              ·
            </span>
            <span className="font-semibold text-[#c4beb3]">
              {price ?? "Price on request"}
            </span>
          </p>

          {/* Only rendered when more than one criterion was picked; with one,
              the headline already is that criterion's score. */}
          {match.breakdown.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-snug text-[#9a9388]">
              {match.breakdown.map((entry) => (
                <li key={entry.label} className="truncate">
                  {entry.label}{" "}
                  <span className="font-semibold tabular-nums">
                    {entry.score}/10
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* The only control on the card, and 44px on its longest axis.
            `pointer-events-auto` takes clicks back from the wrapper above;
            `relative z-10` keeps it above the stretched link visually. */}
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={isSaved ? `Remove ${match.label} from saved` : `Save ${match.label}`}
          disabled={isSaving}
          onClick={() => onFavoriteToggle(match.id)}
          className={`pointer-events-auto relative z-10 flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full border transition disabled:cursor-default disabled:opacity-70 ${
            isSaved
              ? "border-[#c6a46c] bg-[#c6a46c] text-[#1c1f24]"
              : "border-[rgba(242,240,234,0.2)] text-[#c4beb3] hover:border-[#c6a46c] hover:text-[#c6a46c]"
          }`}
        >
          <HeartIcon filled={isSaved} className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

function ResultsPanel({
  status,
  matches,
  criteria,
  loadingLabel,
  error,
  savedIds,
  savingIds,
  favoriteError,
  onFavoriteToggle,
  propertyIndex,
  localityNames,
}: {
  status: ResultStatus;
  matches: CardMatch[];
  /** Names of the selected features, for the header chips. */
  criteria: string[];
  loadingLabel: string;
  error?: string | null;
  savedIds: Set<string>;
  savingIds: Set<string>;
  favoriteError?: string | null;
  onFavoriteToggle: (propertyId: string) => void;
  propertyIndex: Record<string, PropertyListItem>;
  localityNames: Record<string, string>;
}) {
  /**
 * Left-aligned from the top, like the rest of the section.
 *
 * These states used to be a centred block -- `items-center justify-center
 * px-6 text-center` -- which put the one thing a visitor reads in the middle of
 * a panel whose real content is flush left, and made the panel jump between a
 * centred blob and a left-aligned header the moment a card arrived.
 *
 * `items-start justify-start text-left` with no extra horizontal padding, so
 * every state starts on the same left edge as the results header, and `min-h-64`
 * gives all four a floor so none of them collapses the panel.
 */
  if (status === "idle") {
    return (
      <div className="flex h-full min-h-64 flex-col items-start justify-start text-left">
        <IdleGlowIcon className="h-9 w-9" />
        <p className="mt-3 text-base font-semibold text-[#f2f0ea]">
          Select an option to see matching properties
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#9a9388]">
          Pick one or more criteria and we&apos;ll find the plots that score on
          all of them.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="flex h-full min-h-64 flex-col items-start justify-start text-left"
        aria-busy="true"
      >
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10">
          <div className="ila-fyp-progress h-full w-1/2 rounded-full bg-[#c6a46c]" />
        </div>
        <p className="mt-4 text-base font-semibold text-[#f2f0ea]">
          Finding your match
        </p>
        <p className="mt-1.5 text-sm text-[#9a9388]">
          Searching properties for {loadingLabel}…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex h-full min-h-64 flex-col items-start justify-start text-left"
        role="alert"
      >
        <p className="text-base font-semibold text-[#e8a49e]">
          We couldn&apos;t load matches
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#9a9388]">
          {error || "Please try again."}
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex h-full min-h-64 flex-col items-start justify-start text-left">
        <p className="text-base font-semibold text-[#f2f0ea]">
          No exact match yet
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#9a9388]">
          A property has to score on every feature you pick. Remove one to widen
          the search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-0.5" aria-live="polite">
      {favoriteError ? (
        /* `#e8a49e`, not the `#a3352b` this carried while the panel was light.
           On the dark glass that red is about 2.4:1 -- effectively invisible for
           an alert, which is the one message here that must not be missed. */
        <p className="text-xs text-[#e8a49e]" role="alert">
          {favoriteError}
        </p>
      ) : null}

      {/* The header is the answer to the section's question, so it is stated as
          a sentence at heading size. It was a 10px uppercase gold label, which
          read as a caption on a list rather than as a result. */}
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-balance text-[#f2f0ea]">
          {matches.length} {matches.length === 1 ? "property" : "properties"}{" "}
          match
        </h3>

        {/* Read-only. They restate the criteria behind the scores so the
            percentages have something to be a percentage *of*; making them
            removable from here would be a further change. */}
        {criteria.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {criteria.map((name) => (
              <li
                key={name}
                className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-medium text-[#c4beb3]"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid gap-2">
        {matches.map((match, index) => {
          const property = propertyIndex[match.id] ?? null;
          return (
            <MatchCard
              key={`${match.id}-${index}`}
              match={match}
              index={index}
              isSaved={savedIds.has(match.id)}
              isSaving={savingIds.has(match.id)}
              onFavoriteToggle={onFavoriteToggle}
              property={property}
              localityName={
                property?.location_id
                  ? (localityNames[property.location_id] ?? null)
                  : null
              }
            />
          );
        })}
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

  /**
   * Property and locality records for the result cards.
   *
   * `POST /api/match-properties` returns summary data only, so a card cannot show
   * a thumbnail, a price or a locality from it. Rather than one request per
   * result card, both supporting lists are fetched once and joined in memory by
   * `property_id` and `location_id`. That is two requests for any number of
   * matches, and both endpoints are public and already used elsewhere on the
   * homepage.
   *
   * `detailsRequested` keeps it to those two: the effect runs when the first
   * match arrives and never again, even as the selection changes.
   */
  const [propertyIndex, setPropertyIndex] = useState<
    Record<string, PropertyListItem>
  >({});
  const [localityNames, setLocalityNames] = useState<Record<string, string>>({});
  /** Active-property count from `GET /api/properties`, for the panel's CTA. */
  const [propertyTotal, setPropertyTotal] = useState(0);
  const detailsRequested = useRef(false);

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
   * Loads the supporting property and locality lists, once, when the first match
   * arrives.
   *
   * Deliberately not awaited by the search itself: results render immediately and
   * the thumbnail, price and locality fill in when they land. A failure here
   * leaves the cards with their name and score, which is what they used to show
   * in full, so it is logged rather than surfaced as an error the visitor can do
   * nothing about.
   */
  useEffect(() => {
    if (apiMatches.length === 0 || detailsRequested.current) return;
    detailsRequested.current = true;

    const controller = new AbortController();

    Promise.all([
      fetchProperties({
        status: "ALL",
        page: 1,
        perPage: 100,
        signal: controller.signal,
      }),
      fetchLocations({ page: 1, perPage: 100, signal: controller.signal }),
    ])
      .then(([properties, locations]) => {
        if (controller.signal.aborted) return;
        setPropertyIndex(
          Object.fromEntries(properties.items.map((item) => [item.id, item])),
        );
        setLocalityNames(
          Object.fromEntries(locations.items.map((item) => [item.id, item.name])),
        );
        // The response's own `total`, not `items.length`: the panel's pinned
        // button promises the whole catalogue, and the list is capped at 100.
        setPropertyTotal(properties.total);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn(
          "[find-your-plot] property details could not be loaded",
          error,
        );
      });

    return () => controller.abort();
  }, [apiMatches.length]);

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

    // The sheet is deliberately NOT opened here. Opening it on the first tap
    // meant a visitor who selected one criterion was immediately looking at
    // results instead of at the tiles, which is the opposite of what a
    // multi-select should do. The bottom bar carries the count and opens it.

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

  /**
   * Result cards, highest match first.
   *
   * The endpoint returns featured-then-newest, which is not a ranking — it put a
   * 90% match below an 85% one. Sorting here is what makes the `01`-`04` numbers
   * on the cards mean anything.
   *
   * A null `match_score` sorts last rather than being read as zero, so an
   * unscored property cannot outrank a scored one. `Array.prototype.sort` is
   * stable, so properties sharing a score keep the endpoint's order among
   * themselves.
   */
  const cards = useMemo<CardMatch[]>(
    () =>
      apiMatches
        .slice()
        .sort((a, b) => {
          if (a.match_score == null && b.match_score == null) return 0;
          if (a.match_score == null) return 1;
          if (b.match_score == null) return -1;
          return b.match_score - a.match_score;
        })
        .map((item) => featureCard(item, featureNames, selectedKeys)),
    [apiMatches, featureNames, selectedKeys],
  );

  const loadingLabel =
    selectedKeys
      .map((key) => features.find((feature) => feature.key === key)?.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || "your preferences";

  /**
   * Left-hand text on the mobile results bar.
   *
   * The count is only meaningful once a search has returned, so the other three
   * states say what is happening rather than showing a number that is about to
   * change. Rapid chip taps pass through `loading` on every selection, which is
   * why it is a single word rather than a sentence.
   */
  const resultsBarLabel =
    apiStatus === "ready"
      ? `${cards.length} ${cards.length === 1 ? "match" : "matches"}`
      : apiStatus === "loading"
        ? "Searching"
        : apiStatus === "empty"
          ? "No matches"
          : "Could not load";

  /**
   * Display names of the selected criteria, for the results header chips.
   *
   * `loadingLabel` already builds this, but truncated to the first two names for
   * the progress sentence, so it cannot be reused here. A key with no loaded
   * feature falls back to the key rather than rendering a blank chip.
   */
  const criteriaLabels = selectedKeys.map(
    (key) => features.find((feature) => feature.key === key)?.name ?? key,
  );

  /**
   * The page size is fixed, so `pages` only rebuilds when the feature list does.
   * `safePage` clamps rather than resets: the list can shrink underneath the
   * visitor — a feature is deactivated, or a reload returns fewer rows — and it
   * should land on the nearest page that exists rather than snap back to page 1.
   */
  const pages = useMemo(() => buildPages(features), [features]);
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
      {/* Decorative blueprint tile. See `.find-your-plot-bg` in globals.css, where
          the opacity lives so it fades this layer only and never the heading,
          tiles, buttons or result cards. */}
      <div aria-hidden="true" className="find-your-plot-bg pointer-events-none absolute inset-0 z-0" />

      {/* Outer padding matches `GrowthCorridors` exactly: `px-6 sm:px-10` for the
          side gutter, `py-16 sm:py-24` above and below. This was `py-10
          sm:py-12` with no `sm` side step, which is why the section read as
          tighter than the one above it. The two sections are adjacent on the
          homepage, so a 24px difference in padding at every breakpoint is
          visible as a seam rather than as variation.

          The container is full width and has **no `mx-auto`**.
          GrowthCorridors caps its content at 1280px and lets the leftover space
          fall on the right, so its content starts at the left edge of the
          viewport. Centring this block instead pushed the whole section away
          from the left margin on a wide display.

          Only the left column is held still, at the 1280px mark and no wider
          (see the track definition below). The results panel is not capped by
          it -- it is a sibling column in a full-width grid, so it grows into
          the space left over on the right. */}
      <div className="content-slot relative w-full min-w-0 px-6 py-16 sm:px-10 sm:py-24">
        {/* The two columns are siblings from the very top of the section, so
            the results panel can start level with the eyebrow and run to level
            with the pager. Previously the header sat above both columns and
            the panel began under it, level with the label row -- which lined
            its top edge up with neither the heading nor the first row of tiles.
            The empty top-right corner is now the panel.

            Below 1280px the split stays proportional, which is what it always
            was. From 1280px the left track pins to 42rem — 672px, exactly the
            width it already had inside the old 1280px cap — so the heading and
            the tile grid do not move by a pixel and the whole of the extra
            width goes to the panel. The `1.15fr / 0.85fr` tracks are kept for
            the narrower range rather than replaced outright, because pinning
            the left track at 981px would leave the panel about 200px wide. */}
        <div className="grid min-w-0 gap-8 min-[981px]:grid-cols-[1.15fr_0.85fr] min-[981px]:items-stretch min-[1280px]:grid-cols-[42rem_minmax(0,1fr)]">
          <div className="min-w-0">
            <header className="max-w-2xl">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[#c6a46c] uppercase">
                Find your plot
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2f0ea] sm:text-3xl">
                What matters to you?
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9a9388] sm:text-[15px]">
                Pick what you care about. We&apos;ll show you properties that
                score on every one of them.
              </p>
            </header>

            {/* `mt-6` puts the options block 24px below the header paragraph,
                the same gap it uses to its own tile grid below, so the whole
                left column steps on one value. It was `mt-8` (32px) against that
                grid's `mt-3` (12px), which read as a large break into a tight
                one.

                `min-[981px]:gap-10` is dropped: 40px is off the 8/12/16/24/32
                scale, and the `gap-8` already in place covers the split to the
                results panel at every width. */}
            <div className="mt-6 min-w-0 space-y-4">
              <div className="min-w-0">
              {featuresStatus === "loading" ? (
                <p
                  className="inline-flex items-center gap-2 text-sm text-[#9a9388]"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="ila-loader ila-loader--sm ila-loader--light"
                    aria-hidden
                  />
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
                  {/* The small label above the grid used to repeat the heading verbatim, which
                      said nothing the line above it had not. It is an
                      instruction now instead: the heading asks the question,
                      this answers it, and it is the only place that tells the
                      visitor the tiles are multi-select. The `N selected`
                      counter stays balanced against it on the right. */}
                  {/* The counter is always rendered, including at zero. It used
                      to appear only once something was selected, so paging away
                      from a selection and back looked identical to never having
                      selected anything -- and with pages of four there are
                      usually selections on another page. At zero it reads as a
                      starting state rather than as missing information. */}
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-[#c4beb3] uppercase">
                      Choose one or more
                    </p>
                    <p className="shrink-0 text-[10px] font-semibold tracking-[0.18em] text-[#c6a46c] uppercase tabular-nums">
                      {selectedKeys.length} selected
                    </p>
                  </div>

                  {/* A fixed 2x2 at every viewport, four tiles per page.

                      `grid-rows-[repeat(2,minmax(auto,1fr))]` gives the grid
                      exactly two equal rows, so all four tiles end up the same
                      *size* rather than only the same width. `auto` as the row
                      minimum is what makes that safe: Tailwind's own
                      `grid-rows-2` is `minmax(0, 1fr)`, and a zero row minimum
                      lets a long description overflow its row and overlap the
                      one below it.

                      `min-h-[14rem]` reserves the height of two full tiles, so
                      a last page holding one or two tiles still occupies the
                      same box. Without it the grid shrinks with its content and
                      the Previous / Next row jumps upward on the last page.

                      `gap-2` (8px) at every width, from the 8/12/16/24/32 scale. */}
                  <div
                    className="mt-6 grid min-h-[14rem] grid-cols-2 grid-rows-[repeat(2,minmax(auto,1fr))] gap-2"
                    role="group"
                    aria-label="What matters to you"
                  >
                    {visible.map(({ feature, index }) => {
                      const isOn = selectedKeys.includes(feature.key);
                      const icon = featureIcon(feature.key);
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
                          className={`group relative flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left backdrop-blur-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c] sm:p-4 ${
                          isOn
                            ? // Gold border plus a faint gold wash rather than a
                              // solid gold fill. A solid fill inverted the whole
                              // card's typography and left the gold selection dot
                              // invisible against it; a wash keeps the label and
                              // description legible and still reads as selected.
                              "border-[#c6a46c] bg-[#c6a46c]/10 text-[#f2f0ea]"
                            : // Translucent rather than the solid `#23262b` it
                              // replaced. The blueprint tile behind the section is
                              // a real element, so `backdrop-blur` has something
                              // to blur; the tile's border and `#f2f0ea` ink both
                              // hold their contrast over the blurred result, which
                              // an opaque fill would have hidden entirely.
                              "border-[rgba(242,240,234,0.14)] bg-[rgba(242,240,234,0.06)] text-[#f2f0ea] hover:border-[rgba(242,240,234,0.32)] hover:bg-[rgba(242,240,234,0.12)]"
                        }`}
                      >
                          {/* Selection control. Always rendered, so the tile reads as
                              a checkbox before it is tapped; only its fill
                              changes. Hidden from assistive tech because the
                              button's own `aria-pressed` already carries that
                              state and announcing both would double it. */}
                          <span
                            aria-hidden
                            className={`absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full sm:top-3.5 sm:right-3.5 ${
                              isOn
                                ? "bg-[#c6a46c] text-[#1c1f24]"
                                : "border border-[rgba(242,240,234,0.32)]"
                            }`}
                          >
                            {isOn ? <CheckIcon className="h-3 w-3" /> : null}
                          </span>

                          {/* In the flow rather than pinned to a corner: an
                              absolutely positioned glyph would need matching
                              padding on the label, which shifts whenever the
                              icon set changes. */}
                          {icon ? <span className="text-[#c6a46c]">{icon}</span> : null}

                          {/* The right cap keeps the label clear of the selection
                              circle, which is now always present. */}
                          <span className="pr-6 text-sm font-semibold leading-snug sm:text-[15px]">
                            {feature.name}
                          </span>

                          {/* Never clamped, but always two full lines tall.

                              The descriptions are tenant-supplied, so they
                              cannot be shortened here, and `line-clamp-2` was
                              cutting them mid-sentence with an ellipsis —
                              "landscaped areas,…". A tile in a 2x2 whose
                              neighbour has a one-line description also has to
                              stay the same size, so the box is reserved rather
                              than left to the text.

                              `min-h-[2.75em]` is two lines at this element's
                              own `leading-snug` (12px x 1.375 x 2), written in
                              `em` so it tracks the font size instead of
                              hard-coding 33px. Anything longer than two lines
                              grows the tile rather than being cut. */}
                          {feature.description ? (
                            <span className="min-h-[2.75em] text-xs leading-snug text-[#f2f0ea]/70">
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
                      {/* `text-[#9a9388]` rather than the old `#6b655c`. On
                          the `#1c1f24` section background `#6b655c` measured
                          2.9:1, which is below the 4.5:1 AA threshold for the
                          12px text this is, so the disabled state was
                          effectively invisible. `#9a9388` is the section's
                          existing secondary-text value and measures 5.4:1 --
                          still plainly not the enabled `#f2f0ea`, but
                          readable. The faded border and `cursor-not-allowed`
                          carry most of the "disabled" signal. */}
                      <button
                        type="button"
                        onClick={() => setPage(safePage - 1)}
                        disabled={safePage === 0}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wide transition ${
                          safePage === 0
                            ? "cursor-not-allowed border-[rgba(242,240,234,0.08)] text-[#9a9388]"
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
                            ? "cursor-not-allowed border-[rgba(242,240,234,0.08)] text-[#9a9388]"
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
            </div>
          </div>

          {/* The results panel, desktop.

              This was an opaque cream slab --
              `radial-gradient(ellipse at 50% 28%, #ffffff 0%, #f4f0e8 55%, #ebe4d8 100%)`
              -- which read as pasted onto a dark section, matched neither the
              page's cool-grey light sections nor the dark mobile sheet showing
              the identical results.

              It is now the same glass as everything else: 5% white over the
              section, a 10% white hairline, blurred so the blueprint tile reads
              through it. The result rows sit at 10% white on top, which
              composites to roughly 15% against the section -- one step lighter
              than the panel behind them, without a second hard-coded colour.

              `flex-1` rather than `sticky top-24 min-h-112`: the panel spans
              from the eyebrow to the pager, so it is as tall as the left column
              by definition and has nothing left to stick through. The `<aside>`
              is the flex container so this needs no percentage height to
              resolve against.

              `max-height` from `.find-your-plot-panel` (globals.css) keeps it
              from running off the bottom of the screen, and the `height` on the
              same class lets it grow past the left column rather than matching
              it -- without `align-self: start` the grid row's stretch wins and
              the panel stays locked to the height of the heading plus the 2x2
              tiles. That matters now the panel is also much wider.

              Inside: a scrolling list and a pinned footer. The button is a
              sibling of the scroll region, not inside it, so it stays put while
              the list scrolls. */}
            <aside className="find-your-plot-panel hidden min-[981px]:flex">
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[rgba(242,240,234,0.1)] bg-[rgba(242,240,234,0.05)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-md">
                <div className="ila-scroll-dark min-h-0 flex-1 overflow-y-auto">
                  <ResultsPanel
                    status={apiStatus}
                    matches={cards}
                    criteria={criteriaLabels}
                    loadingLabel={loadingLabel}
                    error={apiError}
                    savedIds={savedIds}
                    savingIds={savingIds}
                    favoriteError={favoriteError}
                    onFavoriteToggle={handleFavoriteToggle}
                    propertyIndex={propertyIndex}
                    localityNames={localityNames}
                  />
                </div>

                {/* Pinned below the scroll region rather than inside it.

                    `N` is the catalogue total from the `/api/properties`
                    response, not the match count -- the matches are already all
                    on screen above, so a button promising "all of them" would
                    point at the page it is on. It renders only once there are
                    matches to act on. */}
                {apiStatus === "ready" && propertyTotal > 0 ? (
                  <div className="shrink-0 border-t border-[rgba(242,240,234,0.12)] pt-4">
                    <Link
                      href="/properties"
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c6a46c] px-5 text-sm font-semibold tracking-wide text-[#1c1f24] transition hover:bg-[#d4b57e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c]"
                    >
                      View all {propertyTotal} properties
                    </Link>
                  </div>
                ) : null}
              </div>
            </aside>
        </div>
      </div>

      {/* Results bar, mobile only.

          This replaces the inline "View matches" button and, more importantly,
          changes when the sheet opens: a tap on a tile now only selects or
          deselects it. Opening the sheet on the first tap meant the visitor was
          looking at results before they could add a second criterion, which is
          the one thing a multi-select must not do.

          Fixed to the bottom so it stays reachable after a long scroll through
          the tiles. `h-20` above it reserves the same height inside the section
          so the bar never covers its own content; it appears and disappears
          with the bar, which moves the sections below by that amount the first
          time a search runs. Reserving it permanently would leave a 80px hole
          above an untouched section, which is the worse of the two.

          Below `min-[981px]` the results are already in the aside, so the bar is
          hidden there rather than duplicating it. */}
      {isMobileSheet && !sheetOpen && apiStatus !== "idle" ? (
        <>
          <div aria-hidden className="h-20 min-[981px]:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 min-[981px]:hidden">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-full bg-[#c6a46c] px-5 text-sm font-semibold tracking-wide text-[#1c1f24] transition hover:bg-[#d4b57e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c]"
            >
              <span>{resultsBarLabel}</span>
              <span className="flex items-center gap-1.5">
                View
                <ChevronIcon direction="right" className="h-4 w-4" />
              </span>
            </button>
          </div>
        </>
      ) : null}

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
            className="animate-sheet-up ila-scroll-dark absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[rgba(242,240,234,0.12)] bg-[#1c1f24] px-4 pt-3 pb-6 shadow-[0_-16px_40px_rgba(0,0,0,0.35)]"
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
              criteria={criteriaLabels}
              loadingLabel={loadingLabel}
              error={apiError}
              savedIds={savedIds}
              savingIds={savingIds}
              favoriteError={favoriteError}
              onFavoriteToggle={handleFavoriteToggle}
              propertyIndex={propertyIndex}
              localityNames={localityNames}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}