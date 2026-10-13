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
   * The raw 0-10 `match_score`, kept alongside the rounded `badge`.
   *
   * The bar under the percentage is a true proportion, so it needs the
   * unrounded figure -- `badge` is a string and has already lost the precision
   * a 0-100 track would need at the top of the range.
   */
  score: number | null;
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
    score: item.match_score,
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

type BentoLayoutType = "wide-both" | "wide-desktop" | "wide-mobile" | "standard";

type BentoConfig = {
  spanClass: string;
  type: BentoLayoutType;
};

/**
 * Bento grid layout helper:
 * Creates an asymmetrical bento rhythm that tiles cleanly across mobile and desktop.
 * - Desktop (3 columns):
 *   Row 1: hero wide tile (2 cols) + standard tile (1 col) = 3
 *   Row 2: standard (1) + standard (1) + standard (1) = 3
 *   Row 3: standard (1) + hero wide tile (2 cols) = 3
 *   Row 4: standard (1) + standard (1) + standard (1) = 3
 * - Mobile (2 columns):
 *   Row 1: hero wide banner (2 cols)
 *   Row 2: standard (1) + standard (1) = 2
 *   Row 3: standard (1) + standard (1) = 2
 *   Row 4: accent wide banner (2 cols)
 *   Row 5: standard (1) + standard (1) = 2
 */
function getBentoSpan(index: number): BentoConfig {
  const mod = index % 10;
  if (mod === 0) {
    return {
      spanClass: "col-span-2 sm:col-span-2",
      type: "wide-both",
    };
  }
  if (mod === 5) {
    return {
      spanClass: "col-span-2 sm:col-span-1",
      type: "wide-mobile",
    };
  }
  if (mod === 6) {
    return {
      spanClass: "col-span-1 sm:col-span-2",
      type: "wide-desktop",
    };
  }
  return {
    spanClass: "col-span-1 sm:col-span-1",
    type: "standard",
  };
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
function featureIcon(key: string, className = "h-4 w-4"): ReactNode {
  const k = key.toLowerCase();

  if (/famil|child|kid|play/.test(k)) {
    return <FamilyIcon className={className} />;
  }
  if (/tree|green|park|nature|lake|garden|palm/.test(k)) {
    return <TreeIcon className={className} />;
  }
  if (/shiel|secur|safe|gated|cctv|guard|boundary/.test(k)) {
    return <ShieldIcon className={className} />;
  }
  if (/growth|grow|appreciat|return|invest|yield|profit|future/.test(k)) {
    return <GrowthIcon className={className} />;
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
 * One result row, in the table language of `CompareProperties`' right column:
 * a hairline-separated row sitting directly on the panel surface, a micro-label
 * above the name, and the score on the right as a figure over a proportion bar.
 *
 * **Nothing here is translucent any more.** The rows were
 * `bg-[rgba(242,240,234,0.1)]` cards on a `rgba(242,240,234,0.05)` glass panel,
 * and two translucencies compositing over the same dark section left the rows
 * only marginally lighter than the panel behind them — a stack of chips rather
 * than a list. Rows are now separated by a `border-b` hairline on the solid
 * surface, which is what the compare table does and why it reads as a table.
 *
 * There is no `tone` prop and there is still one set of colours: the desktop
 * aside and the mobile sheet render the identical component, so a result cannot
 * look like two different things on two viewports.
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

  /**
   * `cards` is sorted by `match_score`, so the first row is the top match.
   *
   * Guarded on `match.badge` rather than on `index === 0` alone: a first row
   * with a null `match_score` sorts first only because nothing scored above it,
   * and promoting an unscored property as the "top match" would be a claim the
   * data does not support. That is the same rule the compare table's
   * `best_property_id` label follows.
   */
  const isTop = index === 0 && match.badge !== null;

  /** A true proportion — `match_score` is bounded 0–10, so this is not a guess. */
  const percent =
    match.score === null ? 0 : Math.max(0, Math.min(100, match.score * 10));

  return (
    <article className="group relative flex border-b border-[rgba(242,240,234,0.08)] transition-colors hover:bg-white/[0.03]">
      {/* Stretched link: the whole row is the "view" target.

          A <Link> wrapping the row would put the favourite button inside an
          anchor, which is invalid and makes screen readers announce one
          control.

          `pointer-events-none` on the content wrapper below is what makes this
          actually work. The wrapper is a *positioned* element that paints after
          this link in tree order, and hit testing follows paint order — so it
          sat on top and swallowed every click on the row. The link was
          reachable only in theory; tapping a result did nothing at all. */}
      <Link href={match.href} className="absolute inset-0 z-0">
        <span className="sr-only">View {match.label}</span>
      </Link>

      <div className="pointer-events-none relative flex flex-1 items-center gap-4 px-5 py-3">
        {/* The thumbnail slot is ALWAYS rendered, at a fixed 56px, whether or not
            there is an image.

            Two things were wrong when it was conditional. A property with no
            `cover_url` lost the slot entirely, so its text started to the left
            of every other row and the row came out shorter. And a `cover_url`
            that failed to load — a presigned URL past its expiry answers 403 —
            rendered the browser's broken-image glyph on the dark row instead of
            disappearing.

            The fallback mark sits underneath the image, so hiding the failed
            `<img>` in `onError` reveals it rather than a hole. */}
        <span
          aria-hidden
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/6"
        >
          <span className="absolute inset-0 flex items-center justify-center text-[rgba(242,240,234,0.28)]">
            <BuildingIcon className="h-5 w-5" />
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
          {/* The micro-label pair carries both the rank and the state, so the
              gold alone is never the claim — the same rule the compare table's
              "Best match" / "Pinned" labels follow. */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#6b7280] tabular-nums uppercase">
              {label}
            </span>
            {isTop ? (
              <span className="text-[10px] font-bold tracking-[0.14em] text-[#c6a46c] uppercase">
                Top match
              </span>
            ) : null}
          </div>

          <h3 className="mt-0.5 truncate text-[15px] font-bold tracking-tight text-[#f2f0ea]">
            {match.label}
          </h3>

          {/* Both fields are always rendered, so every row starts and ends its
              text in the same place.

              `localityName` is null when the property has no `location_id`, or
              when its locality falls outside the 100 rows fetched. `formatPrice`
              already answers "Price on request" for a null or zero price, so
              the price side is never empty once the property record has loaded.
              Before it loads both read as unavailable rather than the whole
              line disappearing, which is what shifted the rows around. */}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
            <span className="text-[#8a909e]">
              {localityName ?? (
                <span className="text-[#6b7280]">Location unavailable</span>
              )}
            </span>
            <span aria-hidden className="text-[#6b7280]">
              ·
            </span>
            <span className="font-semibold text-[#8a909e]">
              {price ?? "Price on request"}
            </span>
          </p>

          {/* Only rendered when more than one criterion was picked; with one,
              the headline already is that criterion's score. */}
          {match.breakdown.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-x-3 text-[11px] leading-snug text-[#6b7280]">
              {match.breakdown.map((entry) => (
                <li key={entry.label} className="truncate">
                  {entry.label}{" "}
                  <span className="font-semibold tabular-nums text-[#8a909e]">
                    {entry.score}/10
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* The score, right-aligned over its own proportion bar. Gold on the top
            match and neutral grey on the rest, matching the compare table's
            score bars.

            The bar is `aria-hidden`: the figure above it is the accessible
            value, and a second announcement of the same number helps nobody. */}
        <div className="flex w-24 shrink-0 flex-col items-end">
          {match.badge ? (
            <>
              <span
                className={`text-[15px] font-bold tabular-nums ${
                  isTop ? "text-[#c6a46c]" : "text-[#e8e6e1]"
                }`}
              >
                {match.badge}
              </span>
              <span className="text-[11px] text-[#8a909e]">match</span>
            </>
          ) : (
            <span className="text-[12px] text-[#6b7280]">Unscored</span>
          )}

          <div
            aria-hidden="true"
            className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/10"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isTop ? "bg-[#c6a46c]" : "bg-[#8a8f98]"
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* The only control on the row, and 44px on its longest axis.
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
              : "border-[rgba(242,240,234,0.15)] bg-white/5 text-[#8a909e] hover:border-[#c6a46c] hover:text-[#c6a46c]"
          }`}
        >
          <HeartIcon filled={isSaved} className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

/**
 * The header band: title, the count line, and the criteria pills.
 *
 * Shared by the desktop aside and the mobile sheet, so the two cannot drift —
 * and so the ready-state heading is not inside the scroll region, which is what
 * lets it stay put while the results scroll under it. Both are siblings of the
 * scrollport rather than children of it, which is the arrangement
 * `CompareProperties`' right column uses for the same reason.
 */
function ResultsHeader({
  status,
  matches,
  criteria,
}: {
  status: ResultStatus;
  matches: CardMatch[];
  /** Names of the selected features. */
  criteria: string[];
}) {
  /**
   * The top match, only where a score exists to justify the claim.
   *
   * `matches[0]` only because `cards` is sorted by `match_score`; a null score
   * on that first row is not a win, so it is not labelled as one.
   */
  const first = matches[0];
  const topMatch =
    status === "ready" && first && first.badge !== null ? first : null;

  /**
   * One sentence per state, so the band never reads as a stale heading over a
   * panel that has moved on. `ready` is the only one that carries a count.
   */
  const summary =
    status === "ready" ? null : (
      <>
        {status === "loading" ? "Searching properties…" : null}
        {status === "empty"
          ? "No properties scored on every option"
          : null}
        {status === "error" ? "Search could not be completed" : null}
        {status === "idle" ? "Nothing selected yet" : null}
      </>
    );

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[rgba(242,240,234,0.08)] px-5 py-4">
      <div className="min-w-0">
        <h3 className="text-[15px] font-bold tracking-tight text-[#f2f0ea]">
          Your matches
        </h3>

        {summary ? (
          <p className="text-[12px] text-[#8a909e]">{summary}</p>
        ) : (
          <p className="text-[12px] text-[#8a909e]">
            <strong className="text-[#e8e6e1]">{matches.length}</strong>{" "}
            {matches.length === 1 ? "property scores" : "properties score"} on
            every option you picked
            {topMatch ? (
              <>
                {" "}
                · Top match:{" "}
                <strong className="text-[#c6a46c]">{topMatch.label}</strong>
              </>
            ) : null}
          </p>
        )}
      </div>

      {/* Read-only. They restate the criteria behind the scores so the
          percentages have something to be a percentage *of*; making them
          removable from here would be a further change.

          Every pill is the gold "active" state from the compare table's category
          row, because every criterion here is by definition selected. The row
          scrolls rather than wrapping, and `-mx-5 px-5` bleeds it to the band's
          edges so a long criterion list never detaches from it. */}
      {criteria.length > 0 ? (
        <div className="-mx-5 flex w-full items-center gap-1.5 overflow-x-auto px-5 pt-1 scrollbar-none">
          <span className="mr-1 shrink-0 text-[10px] font-bold tracking-[0.16em] text-[#6b7280] uppercase">
            Criteria
          </span>
          {criteria.map((name) => (
            <span
              key={name}
              className="shrink-0 rounded-full bg-[#c6a46c] px-3 py-1 text-[11px] font-semibold whitespace-nowrap text-[#0f1114]"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
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
  propertyIndex,
  localityNames,
}: {
  status: ResultStatus;
  matches: CardMatch[];
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
 * The four non-ready states, in the composition `CompareProperties` uses for
 * its own status cards: an icon tile, an eyebrow, a heading at 22px, one
 * supporting paragraph, and nothing else.
 *
 * These were left-aligned from the top, which is right for a paragraph inside a
 * list and wrong for a panel with nothing in it. With nothing selected there is
 * no left edge for the text to align to — it hung off the gutter, a few lines of
 * copy stranded in the top-left of a tall empty column, which is what read as a
 * broken layout rather than as an instruction. Centring it under a tile is what
 * makes the empty panel say what it is for.
 *
 * **`justify-start`, not `justify-center`.** The panel is tall —
 * `.find-your-plot-panel` sets its height from the viewport rather than from its
 * content — so centring stranded the tile and its four lines of copy in the
 * middle of that height, a long way below the header band that already states
 * what the panel is showing. The content now sits just under the band, so the
 * eye reads band → tile → heading → paragraph as one stack. `pt-14` is what puts
 * it there without tucking it against the band's own hairline; `px-8 pb-10` keep
 * the measure and the floor.
 *
 * `min-h-[280px]` rather than the `360px` this had while centred: that floor
 * existed to give a centred block room to sit in the middle of. Top-aligned, the
 * content needs only its own height plus `pt-14`, and the lower floor stops a
 * short viewport from squeezing the tile and the heading together.
 */
  if (status === "idle") {
    return (
      <div className="flex min-h-[280px] flex-1 flex-col items-center justify-start px-8 pt-14 pb-10 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c6a46c]/15 text-[#c6a46c]">
          <IdleGlowIcon className="h-7 w-7" />
        </span>
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#c6a46c] uppercase">
          Nothing selected yet
        </p>
        <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#f2f0ea]">
          Your matches appear here
        </h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#9a9388]">
          Pick one or more options and we&apos;ll show the plots that score on
          every one of them.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="flex min-h-[280px] flex-1 flex-col items-center justify-start px-8 pt-14 pb-10 text-center"
        aria-busy="true"
      >
        {/* `[--ila-loader-color:…]` rather than a `text-[…]` utility: the loader
            paints from its own custom property, not from `color`, so a text
            colour leaves it at the near-black default. `CompareProperties` uses
            a `text-` utility here, which does not reach the loader either.

            `ila-fyp-progress`, the gold bar this replaced, is still defined in
            globals.css. This component no longer references it. */}
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c6a46c]/15">
          <span
            className="ila-loader ila-loader--sm [--ila-loader-color:#c6a46c]"
            aria-hidden
          />
        </span>
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#c6a46c] uppercase">
          Searching
        </p>
        <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#f2f0ea]">
          Finding your match
        </h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#9a9388]">
          Searching properties for {loadingLabel}…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="flex min-h-[280px] flex-1 flex-col items-center justify-start px-8 pt-14 pb-10 text-center"
        role="alert"
      >
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8a49e]/15 text-[#e8a49e]">
          <CloseIcon className="h-6 w-6" />
        </span>
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#e8a49e] uppercase">
          Search error
        </p>
        <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#f2f0ea]">
          We couldn&apos;t load matches
        </h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#9a9388]">
          {error || "Please try again."}
        </p>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex min-h-[280px] flex-1 flex-col items-center justify-start px-8 pt-14 pb-10 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c6a46c]/15 text-[#c6a46c]">
          <BuildingIcon className="h-7 w-7" />
        </span>
        <p className="text-[11px] font-bold tracking-[0.18em] text-[#c6a46c] uppercase">
          No exact match
        </p>
        <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#f2f0ea]">
          Nothing scores on all of them
        </h3>
        <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#9a9388]">
          A property has to score on every option you pick. Remove one to widen
          the search.
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      {favoriteError ? (
        /* `#e8a49e`, not the `#a3352b` this carried while the panel was light.
           On the dark surface that red is about 2.4:1 -- effectively invisible for
           an alert, which is the one message here that must not be missed. It is
           a full-width band rather than a floating line, so a row scrolling past
           it cannot push it out of view. */
        <p
          className="border-b border-[rgba(242,240,234,0.08)] px-5 py-3 text-[12px] text-[#e8a49e]"
          role="alert"
        >
          {favoriteError}
        </p>
      ) : null}

      {/* No heading here: the count and the criteria pills moved into
          `ResultsHeader`, which is a sibling of the scroll region so they stay
          put while the rows move under them. The band is the only place the
          "N properties match" answer appears, which is what stops the count
          scrolling out of view above a list it is describing. */}
      <div className="flex flex-col">
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

                  {/* Bento Grid containing all features with headings only (no subheadings).
                      Asymmetrical bento layout with larger, prominent typography and balanced proportions. */}
                  <div
                    className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3"
                    role="group"
                    aria-label="What matters to you"
                  >
                    {features.map((feature, index) => {
                      const isOn = selectedKeys.includes(feature.key);
                      const bento = getBentoSpan(index);
                      return (
                        <button
                          key={feature.key}
                          type="button"
                          aria-pressed={isOn}
                          onClick={() => toggleFeature(feature.key)}
                          data-track="PREFERENCE_TAG_SELECT"
                          data-track-meta={JSON.stringify({
                            tag_id: feature.key,
                            selected: !isOn,
                          })}
                          className={`group relative flex min-h-[5.25rem] rounded-2xl border text-left backdrop-blur-md transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c] p-3.5 sm:min-h-[5.75rem] sm:p-4 ${
                            bento.spanClass
                          } ${
                            isOn
                              ? "border-[#c6a46c] bg-[#c6a46c]/15 text-[#f2f0ea] shadow-[0_4px_22px_rgba(198,164,108,0.22)]"
                              : "border-[rgba(242,240,234,0.13)] bg-[rgba(242,240,234,0.06)] text-[#f2f0ea] hover:-translate-y-0.5 hover:border-[rgba(242,240,234,0.3)] hover:bg-[rgba(242,240,234,0.11)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.25)]"
                          }`}
                        >
                          {bento.type === "wide-both" ? (
                            /* Hero Wide Banner on both mobile & desktop */
                            <div className="flex h-full w-full items-center justify-between gap-3 sm:gap-4">
                              <div className="flex min-w-0 items-center gap-3 sm:gap-3.5">
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-11 sm:w-11 ${
                                    isOn
                                      ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                      : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                  }`}
                                >
                                  {featureIcon(feature.key, "h-5 w-5") ?? (
                                    <CheckIcon className="h-4.5 w-4.5" />
                                  )}
                                </span>
                                <span className="text-[15px] font-bold tracking-tight text-[#f2f0ea] sm:text-lg">
                                  {feature.name}
                                </span>
                              </div>
                              <span
                                aria-hidden
                                className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full transition-all sm:h-6 sm:w-6 ${
                                  isOn
                                    ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                    : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                }`}
                              >
                                {isOn ? (
                                  <CheckIcon className="h-3 w-3 stroke-[2.8] sm:h-3.5 sm:w-3.5" />
                                ) : null}
                              </span>
                            </div>
                          ) : bento.type === "wide-desktop" ? (
                            /* Desktop Wide Accent (2 cols on desktop, 1 col on mobile) */
                            <>
                              {/* Mobile view (1 col): stacked vertical */}
                              <div className="flex h-full w-full flex-col justify-between gap-2.5 sm:hidden">
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span
                                    className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                      isOn
                                        ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                        : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                    }`}
                                  >
                                    {featureIcon(feature.key, "h-4.5 w-4.5") ?? (
                                      <CheckIcon className="h-4 w-4" />
                                    )}
                                  </span>
                                  <span
                                    aria-hidden
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${
                                      isOn
                                        ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                        : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                    }`}
                                  >
                                    {isOn ? <CheckIcon className="h-3 w-3 stroke-[2.8]" /> : null}
                                  </span>
                                </div>
                                <span className="text-[14px] font-semibold leading-snug tracking-tight text-[#f2f0ea] line-clamp-2">
                                  {feature.name}
                                </span>
                              </div>

                              {/* Desktop view (2 cols): horizontal layout */}
                              <div className="hidden h-full w-full items-center justify-between gap-4 sm:flex">
                                <div className="flex min-w-0 items-center gap-3.5">
                                  <span
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                      isOn
                                        ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                        : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                    }`}
                                  >
                                    {featureIcon(feature.key, "h-5 w-5") ?? (
                                      <CheckIcon className="h-4.5 w-4.5" />
                                    )}
                                  </span>
                                  <span className="text-lg font-bold tracking-tight text-[#f2f0ea]">
                                    {feature.name}
                                  </span>
                                </div>
                                <span
                                  aria-hidden
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all ${
                                    isOn
                                      ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                      : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                  }`}
                                >
                                  {isOn ? <CheckIcon className="h-3.5 w-3.5 stroke-[2.8]" /> : null}
                                </span>
                              </div>
                            </>
                          ) : bento.type === "wide-mobile" ? (
                            /* Mobile Wide Banner (2 cols on mobile, 1 col on desktop) */
                            <>
                              {/* Mobile view (2 cols): horizontal banner */}
                              <div className="flex h-full w-full items-center justify-between gap-3 sm:hidden">
                                <div className="flex min-w-0 items-center gap-3">
                                  <span
                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                      isOn
                                        ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                        : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                    }`}
                                  >
                                    {featureIcon(feature.key, "h-5 w-5") ?? (
                                      <CheckIcon className="h-4.5 w-4.5" />
                                    )}
                                  </span>
                                  <span className="text-[15px] font-bold tracking-tight text-[#f2f0ea]">
                                    {feature.name}
                                  </span>
                                </div>
                                <span
                                  aria-hidden
                                  className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full transition-all ${
                                    isOn
                                      ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                      : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                  }`}
                                >
                                  {isOn ? <CheckIcon className="h-3 w-3 stroke-[2.8]" /> : null}
                                </span>
                              </div>

                              {/* Desktop view (1 col): stacked vertical */}
                              <div className="hidden h-full w-full flex-col justify-between gap-2.5 sm:flex">
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span
                                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                                      isOn
                                        ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                        : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                    }`}
                                  >
                                    {featureIcon(feature.key, "h-4.5 w-4.5") ?? (
                                      <CheckIcon className="h-4 w-4" />
                                    )}
                                  </span>
                                  <span
                                    aria-hidden
                                    className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full transition-all ${
                                      isOn
                                        ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                        : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                    }`}
                                  >
                                    {isOn ? <CheckIcon className="h-3 w-3 stroke-[2.8]" /> : null}
                                  </span>
                                </div>
                                <span className="text-[15px] font-semibold leading-snug tracking-tight text-[#f2f0ea] line-clamp-2">
                                  {feature.name}
                                </span>
                              </div>
                            </>
                          ) : (
                            /* Standard 1-col Card on both mobile & desktop */
                            <div className="flex h-full w-full flex-col justify-between gap-2.5">
                              <div className="flex w-full items-center justify-between gap-2">
                                <span
                                  className={`flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl transition-colors sm:h-9 sm:w-9 ${
                                    isOn
                                      ? "bg-[#c6a46c]/25 text-[#f2f0ea] ring-1 ring-[#c6a46c]/50"
                                      : "bg-[rgba(242,240,234,0.08)] text-[#c6a46c] ring-1 ring-[rgba(242,240,234,0.14)] group-hover:bg-[#c6a46c]/20"
                                  }`}
                                >
                                  {featureIcon(feature.key, "h-4.5 w-4.5") ?? (
                                    <CheckIcon className="h-4 w-4" />
                                  )}
                                </span>
                                <span
                                  aria-hidden
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all sm:h-5.5 sm:w-5.5 ${
                                    isOn
                                      ? "bg-[#c6a46c] text-[#1c1f24] shadow-xs scale-105"
                                      : "border border-[rgba(242,240,234,0.3)] group-hover:border-[rgba(242,240,234,0.5)]"
                                  }`}
                                >
                                  {isOn ? <CheckIcon className="h-3 w-3 stroke-[2.8]" /> : null}
                                </span>
                              </div>
                              <span className="text-[14px] font-semibold leading-snug tracking-tight text-[#f2f0ea] sm:text-[15px] line-clamp-2">
                                {feature.name}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* AND matching hint */}
                  <p className="mt-3.5 text-xs text-[#9a9388]">
                    A property has to score on every option you pick, so adding
                    more narrows the search.
                  </p>
                </>
              ) : null}
            </div>
            </div>
          </div>

          {/* The results panel, desktop.

              Its **layout** now matches the right-hand column of
              `CompareProperties` exactly: square flush surface, a header band
              that does not scroll, hairline-separated rows, and a pinned gold
              footer CTA. Its **colour** does not, deliberately -- this section
              is dark and that one is light, so a `#eceef2` preview panel here
              would be a light rectangle punched into a dark section rather than
              a seamless continuation of it. Everything that is about structure
              and typography is shared; the surface stays `#141519`.

              `.find-your-plot-panel` in globals.css still owns two things:
              `max-height`, which keeps the panel from running off the bottom of
              the screen, and `height` + `align-self: start`, which let it grow
              past the left column rather than matching it -- without that the
              grid row's `stretch` wins and the panel stays locked to the height
              of the heading plus the bento grid.

              `flex-1` rather than `sticky`: the panel spans from the eyebrow to
              the pager, so it is as tall as the left column by definition and has
              nothing left to stick through. The `<aside>` is the flex container
              so this needs no percentage height to resolve against. */}
            <aside className="find-your-plot-panel hidden min-[981px]:flex">
              {/* Square, flush, solid `#141519` -- no radius, no border, no shadow,
                  no `backdrop-blur`. This is the treatment `CompareProperties`
                  gives its right column, and it is a change of kind rather than
                  of taste: the panel was `rgba(242,240,234,0.05)` glass with a
                  22px radius, a hairline and a deep drop shadow, which read as a
                  translucent card floating *over* a dark section. `#141519` is a
                  step below the section's own `#1c1f24`, so the panel is a
                  surface in its own right rather than a tint on someone else's.

                  Nothing is rounded because the panel no longer needs to be
                  separated from its surroundings by a border and a shadow -- the
                  darker fill does that on its own.

                  Three layers, matching the compare column exactly: a header band
                  that does not scroll, the rows, and a pinned CTA that is a
                  sibling of the scrollport rather than a child of it.
                  `overflow-x-clip`, never `overflow-hidden`: nothing inside is
                  sticky against this element, and `clip` does not create a
                  scrollport. */}
              <div className="flex min-w-0 flex-1 flex-col overflow-x-clip bg-[#141519]">
                <ResultsHeader
                  status={apiStatus}
                  matches={cards}
                  criteria={criteriaLabels}
                />

                <div className="ila-scroll-dark flex min-h-0 flex-1 flex-col overflow-y-auto">
                  <ResultsPanel
                    status={apiStatus}
                    matches={cards}
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
                    matches to act on.

                    `rounded-xl` and `min-h-11` rather than the old
                    `rounded-full min-h-12`: the compare column's pinned CTAs are
                    `rounded-xl` at 44px, and this is the same kind of control --
                    a footer action on a dark card, not the page's primary
                    gold pill. */}
                {apiStatus === "ready" && propertyTotal > 0 ? (
                  <div className="shrink-0 border-t border-[rgba(242,240,234,0.08)] px-5 py-4">
                    <Link
                      href="/properties"
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#c6a46c] px-4 text-[13px] font-semibold text-[#0f1114] transition hover:bg-[#d4b57e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c]"
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
            {/* Same band as the desktop aside, minus its own background: the
                sheet is already `#1c1f24` and its own border. Sharing the
                component is what keeps the two viewports describing the same
                results in the same words. */}
            <ResultsHeader
              status={apiStatus}
              matches={cards}
              criteria={criteriaLabels}
            />
            <ResultsPanel
              status={apiStatus}
              matches={cards}
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