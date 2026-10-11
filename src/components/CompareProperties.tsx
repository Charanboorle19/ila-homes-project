"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPARE_MAX_IDS,
  COMPARE_MIN_IDS,
  canCompare,
  compareProperties,
  normalizeCompareIds,
  type ComparisonMetricRow,
  type ComparisonProperty,
  type ComparisonResult,
} from "@/services/compareService";
import { trackEvent } from "@/services/analytics/tracker";
import {
  fetchProperties,
  formatPrice,
  isPropertyUuid,
  type PropertyListItem,
} from "@/services/propertiesService";
import { fetchLocations } from "@/services/locationsService";

const GOLD = "#c9a84c";

/**
 * Human labels and formatting for the metric keys the backend returns.
 *
 * The backend is the source of truth for *which* metrics exist, so this map is
 * only a presentation layer: any key missing here still renders, using its raw
 * key as the label. That keeps a backend-added metric from disappearing.
 */
type MetricSpec = {
  label: string;
  format?: (value: number | string | boolean | null) => string;
  group: "overview" | "location" | "inventory" | "growth";
};

const METRIC_SPECS: Record<string, MetricSpec> = {
  price: { label: "Price", format: (v) => (typeof v === "number" ? formatPrice(v) : ""), group: "overview" },
  price_per_sqft: {
    label: "Price / sq.ft",
    format: (v) => (typeof v === "number" ? formatPrice(v) : ""),
    group: "overview",
  },
  property_type: { label: "Property type", group: "overview" },
  bedrooms: { label: "Bedrooms", group: "overview" },
  bathrooms: { label: "Bathrooms", group: "overview" },
  area: { label: "Plot area", group: "overview" },
  area_sqft: { label: "Area (sq.ft)", group: "overview" },

  location: { label: "Locality", group: "location" },
  connectivity_score: { label: "Connectivity score", group: "location" },
  schools_nearby: { label: "Schools nearby", group: "location" },
  hospitals_nearby: { label: "Hospitals nearby", group: "location" },
  parks_nearby: { label: "Parks nearby", group: "location" },
  metro_distance_km: {
    label: "Metro distance",
    format: (v) => (typeof v === "number" ? `${v} km` : ""),
    group: "location",
  },

  available_inventory: { label: "Available inventory", group: "inventory" },
  approval_status: { label: "Approval", group: "inventory" },
  possession: {
    label: "Possession",
    format: (v) => (typeof v === "string" ? formatDate(v) : ""),
    group: "inventory",
  },
  amenities_count: { label: "Amenities", group: "inventory" },
  builder: { label: "Builder", group: "inventory" },

  estimated_appreciation: {
    label: "Est. appreciation",
    format: (v) => (typeof v === "number" ? `${v}%` : ""),
    group: "growth",
  },
  maintenance_cost: {
    label: "Maintenance",
    format: (v) => (typeof v === "number" ? `${formatPrice(v)}/mo` : ""),
    group: "growth",
  },
};

/** Life-stage rows arrive flattened as `life_stage_fit.<persona>`. */
const PERSONA_LABELS: Record<string, string> = {
  starting_a_family: "Fit · Starting a family",
  upgraders: "Fit · Upgraders",
  professionals: "Fit · Professionals",
  investors: "Fit · Investors",
  retirees: "Fit · Retirees",
  FAMILY: "Fit · Family",
  PROFESSIONAL: "Fit · Professional",
  INVESTOR: "Fit · Investor",
};

const GROUP_LABELS: Record<MetricSpec["group"], string> = {
  overview: "Overview",
  location: "Location & connectivity",
  inventory: "Inventory & approvals",
  growth: "Growth & running cost",
};

type Status = "idle" | "loading" | "ready" | "error";

/** Null means "not available" and must never be shown as a zero. */
const NOT_AVAILABLE = "Not available";

/**
 * Metrics rendered as a 0-100 score with a bar under the number.
 *
 * Only these two are bounded and already expressed out of 100, so the bar is a
 * true proportion rather than a guess at a maximum. Every other metric would
 * need a scale invented for it, which is the kind of decoration that
 * misrepresents data.
 */
const SCORE_METRICS = new Set(["connectivity_score", "estimated_appreciation"]);

function formatValue(
  value: number | string | boolean | null,
  spec?: MetricSpec,
): string {
  if (value === null || value === undefined || value === "") return NOT_AVAILABLE;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (spec?.format) return spec.format(value) || NOT_AVAILABLE;
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

function formatDate(value: string): string {
  // ISO date in, readable date out. Anything unparseable is passed through
  // unchanged rather than rendered as "Invalid Date".
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
  });
}

/** Turns a raw metric key into a label plus its optional formatter. */
function describeKey(key: string): MetricSpec {
  if (PERSONA_LABELS[key]) {
    return { label: PERSONA_LABELS[key], group: "growth" };
  }

  const known = METRIC_SPECS[key];
  if (known) return known;

  // Dotted life-stage rows for a persona we have no label for.
  if (key.startsWith("life_stage_fit.")) {
    const persona = key.slice("life_stage_fit.".length);
    return {
      label: `Fit · ${persona.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
      format: (v) => (typeof v === "number" ? `${v}%` : ""),
      group: "growth",
    };
  }

  return {
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    group: "overview",
  };
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

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CompareProperties() {
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [listStatus, setListStatus] = useState<Status>("loading");
  /** `location_id` -> locality name, for the card's location line. */
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  /** Selection order is the comparison order, and the backend preserves it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [compareStatus, setCompareStatus] = useState<Status>("idle");
  const [compareError, setCompareError] = useState<string | null>(null);
  const compareAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    // Localities, alongside the property list rather than after it.
    //
    // `GET /api/properties` returns a trimmed row — id, location_id, name,
    // price, cover_url and little else. There is no `location_name` on
    // `PropertyListItem`, so a card cannot say where a development is without
    // this join. One extra request, loaded once, keyed by `location_id`.
    //
    // A failure here is logged rather than surfaced: the cards are still
    // selectable and comparable without a locality line.
    fetchLocations({ page: 1, perPage: 100, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setLocationNames(
          Object.fromEntries(response.items.map((item) => [item.id, item.name])),
        );
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[compare] localities list failed", error);
      });

    fetchProperties({
      status: "ALL",
      page: 1,
      perPage: 50,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) return;
        // The compare route parses ids as UUIDs, so a non-UUID row could only
        // ever produce a 422. Filter them out of the picker entirely.
        setProperties(response.items.filter((item) => isPropertyUuid(item.id)));
        setListStatus("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setListStatus("error");
        console.warn("[compare] properties list failed", error);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    return () => {
      compareAbort.current?.abort();
    };
  }, []);

  /**
   * The status row plus the Compare button, pinned to the bottom of the
   * viewport on mobile once something is selected.
   *
   * It appears and disappears with the selection, which is why the background is
   * opaque: cards scroll underneath it and would otherwise show through. The
   * colour matches the card it sits in — `#f7f8fa` on mobile, `white/80` from
   * `sm`, where the card gains its own background.
   *
   * `pb-[env(safe-area-inset-bottom)]` keeps the button clear of a gesture bar.
   * Without it the bottom 20-30px of the viewport is the home indicator and the
   * button sits underneath it. Reset at `sm`, where the row is no longer pinned
   * to anything.
   */
  const actionRowClass =
    selectedIds.length > 0
      ? "sticky bottom-0 z-20 bg-[#f7f8fa] pb-[env(safe-area-inset-bottom)] sm:static sm:z-auto sm:bg-white/80 sm:pb-0"
      : "";

  const toggleProperty = useCallback(
    (propertyId: string, name: string) => {
      setSelectedIds((current) => {
        if (current.includes(propertyId)) {
          trackEvent({
            event_type: "COMPARE_REMOVE",
            property_id: propertyId,
            metadata: { property_id: propertyId, property_name: name },
          });
          return current.filter((id) => id !== propertyId);
        }

        if (current.length >= COMPARE_MAX_IDS) return current;

        trackEvent({
          event_type: "COMPARE_ADD",
          property_id: propertyId,
          metadata: {
            property_id: propertyId,
            property_name: name,
            comparison_count: current.length + 1,
          },
        });
        return [...current, propertyId];
      });
    },
    [],
  );

  const clearSelection = useCallback(() => {
    compareAbort.current?.abort();
    setSelectedIds([]);
    setResult(null);
    setCompareStatus("idle");
    setCompareError(null);
  }, []);

  const runComparison = useCallback(async () => {
    const ids = normalizeCompareIds(selectedIds);
    if (!canCompare(ids)) return;

    // Supersede any in-flight comparison rather than racing it.
    compareAbort.current?.abort();
    const controller = new AbortController();
    compareAbort.current = controller;

    setCompareStatus("loading");
    setCompareError(null);

    try {
      const comparison = await compareProperties(ids, controller.signal);
      if (controller.signal.aborted) return;
      setResult(comparison);
      setCompareStatus("ready");

      trackEvent({
        event_type: "PROPERTY_COMPARE",
        metadata: {
          property_ids: ids,
          comparison_count: ids.length,
          section_type: "compare_plots",
        },
      });
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      setCompareStatus("error");
      setCompareError(
        error instanceof Error
          ? error.message
          : "Comparison is unavailable right now. Please try again shortly.",
      );
      console.warn("[compare] comparison failed", error);
    }
  }, [selectedIds]);

  /** Metric rows grouped for rendering, preserving backend order per group. */
  const groupedMetrics = useMemo(() => {
    if (!result) return [];

    const groups = new Map<
      MetricSpec["group"],
      { row: ComparisonMetricRow; spec: MetricSpec }[]
    >();

    for (const row of result.metrics) {
      const spec = describeKey(row.key);
      const bucket = groups.get(spec.group);
      if (bucket) bucket.push({ row, spec });
      else groups.set(spec.group, [{ row, spec }]);
    }

    return (["overview", "location", "inventory", "growth"] as const)
      .filter((group) => groups.has(group))
      .map((group) => ({ group, rows: groups.get(group) ?? [] }));
  }, [result]);

  const compared = result?.properties ?? [];
  /**
   * The property that wins the most rows, labelled "Best match" in the header.
   *
   * Derived by tallying `best_property_id` across every row rather than by
   * comparing a price or a score, so the label describes what the table itself
   * highlights rather than a metric chosen separately. A property that wins
   * nothing simply reads "Pinned".
   */
  const bestMatchId = useMemo(() => {
    const tally = new Map<string, number>();
    for (const { rows } of groupedMetrics) {
      for (const { row } of rows) {
        if (!row.best_property_id) continue;
        tally.set(row.best_property_id, (tally.get(row.best_property_id) ?? 0) + 1);
      }
    }
    let top: string | null = null;
    let topCount = 0;
    for (const [id, count] of tally) {
      if (count > topCount) {
        top = id;
        topCount = count;
      }
    }
    return top;
  }, [groupedMetrics]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atMax = selectedIds.length >= COMPARE_MAX_IDS;
  const canRun = canCompare(selectedIds) && compareStatus !== "loading";

  /**
   * Width of one property cell, as a share of the scrollport.
   *
   * **One property per screen.** The previous `w-[46%]` fitted two columns
   * inside the scrollport, and that makes horizontal snapping geometrically
   * impossible: `snap-start` reaches the last column only when cell width is at
   * least the scrollport width, because the last snap sits at `(n-1) * w` while
   * the maximum scroll position is `n * w - scrollport`.
   *
   * Measured at 46% on a 390px screen: cells 178px, column starts 0 / 178 /
   * 357, total scroll range 147px. Every snap point past the first sat beyond
   * the end of the scroll, so no swipe could ever land on a column, and with
   * two properties the columns came to 356px inside a 388px scrollport - no
   * overflow at all, so no scroll whatsoever.
   *
   * 88% keeps a 12% sliver of the next property on screen as the scroll hint
   * while giving a full column per swipe. It is still short of the exact-snap
   * threshold, so the final column settles ~46px proud of flush; that is the
   * price of the sliver, and it is the better trade on a table.
   *
   * Applied to the cells rather than to a shared grid template. Every row is
   * its own flex container, so a percentage resolves against the scrollport on
   * each one and a single swipe moves all of them together.
   */
  const CELL_WIDTH = "w-[88%]";

  // The section uses `overflow-x-clip`, not `overflow-hidden`.
  //
  // It still clips horizontally -- the carousel's `-mr-5` and the results table
  // both run to the section edge -- but `clip` does not create a scroll
  // container and `overflow: hidden` does. A sticky descendant resolves against
  // its nearest scrollport, so under `overflow: hidden` the Compare button's
  // sticky row would have had a scrollport that never scrolls and would have
  // stayed exactly where it was. Same fix `FindYourPlot`'s section uses.
  return (
    <section
        data-section="compare_plots"
        aria-label="Compare properties"
        className="relative w-full overflow-x-clip bg-[#eceef2]"
        style={{ ["--cmp-gold" as string]: GOLD }}
      >
      {/* `px-5` is the section's one left gutter on mobile: 20px. The heading, the
          property cards, the "N of 5 selected" row, the Compare button and the
          results table's sticky label column all start here.

          They did not before. The heading sat at `px-6` (24px) while the card
          block sat at `px-4` (16px), and the full-bleed card meant nothing was
          anchoring the two together. `sm` and `lg` keep their own values; this
          is the mobile pass only.

          Vertical rhythm, measured on mobile:
            - `pt-12` is 48px above the eyebrow
            - `pb-6` is 24px from the intro paragraph down to the card block
            - the block below adds `pb-4`, and the card's own `py-4` contributes
              16px below the Compare button, for 32px before the next section
                */}
      {/* Decorative dot grid. See `.compare-plots-bg` in globals.css, where
          the opacity lives so it fades this layer only and never the heading,
          cards or the compare action. */}
      <div
        aria-hidden="true"
        className="compare-plots-bg pointer-events-none absolute inset-0 z-0"
      />

      {/* `content-slot` stacks the content above that layer. */}
      <div className="content-slot w-full px-5 pt-12 pb-6 sm:px-8 sm:pt-12 sm:pb-12 lg:px-12">
        {/* Type scale for the heading block: 12 / 28 / 16, with a 12px gap between
            each and a 1.2 / 1.5 line height. `leading-relaxed` was 1.625 and
            `text-2xl` was 24px, so the block read loose and slightly undersized
            against the card beneath it. `sm` and `lg` keep their own steps —
            this is the mobile pass. */}
        <header className="max-w-2xl">
          <p className="text-[12px] font-bold tracking-[0.2em] text-[#7a5c28] uppercase">
            Side by side
          </p>
          <h2 className="mt-3 text-[28px] leading-[1.2] font-bold tracking-tight text-[#0f1114] sm:text-3xl lg:text-[2rem] lg:leading-tight">
            Compare up to five properties at once
          </h2>
          <p className="mt-3 text-[16px] leading-[1.5] font-medium text-[#3d4450]">
            Pick {COMPARE_MIN_IDS} to {COMPARE_MAX_IDS} developments. We line
            them up on price, connectivity, inventory and growth, and mark the
            better value in each row.
          </p>
        </header>
      </div>

      {/* One unified block: the properties sit on top and the compare action
            lives in the same block, so selection and action are never split.
            Full-bleed and square-edged on mobile; inset and rounded from sm up.

            `pb-4` on mobile is the gap below the Compare button. The card's own
            `py-4` supplies 16px of it and this supplies the other 16, for 32px
            before the next section starts. There was no mobile bottom padding
            on this wrapper at all before, which is why the next section
            followed the button almost immediately. */}
      <div className="content-slot w-full px-5 pb-4 sm:px-8 sm:pb-12 lg:px-12">
        {/* The card is full-bleed and square-edged on mobile - that is the
            design, not an oversight - so it carries the gutter itself rather
            than sitting inside one. Its content therefore lands on the same
            20px as the heading above it. */}
        <div className="w-full bg-[#f7f8fa] py-4 sm:rounded-2xl sm:border sm:border-black/10 sm:bg-white/80 sm:px-5 sm:py-5">
          {/* Properties first, at the top of the block. */}
          {listStatus === "loading" ? (
            <p className="inline-flex items-center gap-2 text-sm text-[#5b6270]">
              <span className="ila-loader ila-loader--sm" aria-hidden />
              Loading properties…
            </p>
          ) : null}

          {listStatus === "error" ? (
            <p className="text-sm text-[#5b6270]">
              Properties are unavailable right now. Please try again shortly.
            </p>
          ) : null}

          {listStatus === "ready" && properties.length === 0 ? (
            <p className="text-sm text-[#5b6270]">No properties published yet.</p>
          ) : null}

          {/* Carousel gutters, mobile only.

                The strip's box starts on the card's content edge — the 20px
                gutter — and runs out to the screen's right edge via `-mr-5`,
                so tiles scroll off the right and never off the left. It used
                to be `-mx-5 px-5`, which pulled the box to x = 0 as well: two
                bleed edges, and the strip looked detached from the card.

                `pr-5` keeps the last tile off the screen edge at the end of
                the scroll.

                No `scroll-pl-5` here, and deliberately: the container's left
                edge *is* the 20px gutter now, so `snap-start` already parks
                each tile on it. Adding scroll padding on top would push the
                snap to 40px — a gutter of double the intended width, visible
                every time the strip settles. */}
          {listStatus === "ready" && properties.length > 0 ? (
            <ul className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 pt-3 pb-2 scrollbar-none sm:mr-0 sm:gap-3.5 sm:overflow-x-visible sm:pr-0 sm:pt-0 lg:grid lg:grid-cols-4">
              {properties.map((property) => {
                const selected = selectedSet.has(property.id);
                const blocked = !selected && atMax;
                const order = selectedIds.indexOf(property.id);

                return (
                  <li
                    key={property.id}
                    className="w-[76vw] max-w-[290px] shrink-0 snap-start sm:w-[42vw] sm:max-w-none lg:w-auto lg:shrink"
                  >
                    <button
                      type="button"
                      onClick={() => toggleProperty(property.id, property.name)}
                      disabled={blocked}
                      aria-pressed={selected}
                      aria-label={
                        selected
                          ? `Remove ${property.name} from comparison`
                          : `Add ${property.name} to comparison`
                      }
                      className={`group relative flex h-full min-h-[11rem] w-full flex-col rounded-2xl border p-4 text-left transition-colors ${
                        selected
                          ? "border-[#c9a84c] bg-[#241f14]"
                          : "border-black/20 bg-[#1b1d22]"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      {/* Cover image, clipped in its own wrapper rather than by
                          `overflow-hidden` on the button, which would clip the
                          selection circle. A property without a `cover_url`
                          simply has no image and falls back to its own dark
                          surface. */}
                      {property.cover_url ? (
                        <div
                          aria-hidden
                          className="absolute inset-0 z-0 overflow-hidden rounded-2xl"
                        >
                          <Image
                            src={property.cover_url}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 42vw, 290px"
                            // Presigned cover URLs expire, so they are loaded
                            // directly rather than through the optimizer cache.
                            unoptimized
                            // A presigned URL past its expiry answers 403.
                            // Hiding the failed image falls back to the card's
                            // own dark surface, same as a null cover_url.
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                            className="object-cover"
                          />
                          {/* Dark scrim rather than a light one. It lets the
                              photo read as an actual image while keeping the
                              lightest copy above 4.5:1 contrast on any
                              image, at every breakpoint. */}
                          </div>
                      ) : null}

                      {/* Scrim, rendered whether or not there is an image.

                          It used to live inside the `cover_url` branch, so a
                          card with no photo had no gradient — the guarantee
                          that white text stays above 4.5:1 held only while
                          every property happened to have a cover. Over the
                          card's own `#1b1d22` it is invisible, so making it
                          unconditional costs nothing and means a photo can be
                          added later without touching this. */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-linear-to-t from-black/90 via-black/62 to-black/45"
                      />

                      <div className="relative z-10 flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-white uppercase">
                            {property.property_type ?? "Development"}
                          </span>

                          {/* Selection state and order in one control.

                              The order badge used to overhang the card at
                              `-top-2 -left-2`, where it was clipped by the
                              carousel's own edges on the first and last
                              cards. It now lives here: a `+` while
                              unselected, the selection number once chosen,
                              filled gold.

                              Decorative — `aria-hidden`. The button's
                              `aria-pressed` and its `aria-label` carry the
                              state, and this is the whole card's tap target
                              anyway, not a separate 24px hit area. */}
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums transition-colors ${
                              selected
                                ? "border-[#c9a84c] bg-[#c9a84c] text-[#0f1114]"
                                : "border-white/45 text-white/85 group-hover:border-[#c9a84c] group-hover:text-[#c9a84c]"
                            }`}
                            aria-hidden
                          >
                            {selected ? order + 1 : <PlusIcon className="h-3.5 w-3.5" />}
                          </span>
                        </div>

                        <h3 className="mt-3 line-clamp-2 text-[16px] font-semibold tracking-tight text-white">
                          {property.name}
                        </h3>

                        {/* Location, so two cards are distinguishable by more
                            than their name and price. `location_id` is all
                            the list endpoint returns, so this is the locality
                            name joined in from `GET /api/locations`. */}
                        {locationNames[property.location_id ?? ""] ? (
                          <p className="mt-1 truncate text-[12px] text-white/70">
                            {locationNames[property.location_id ?? ""]}
                          </p>
                        ) : null}

                        {/* Anchored to the bottom so the taller mobile card reads
                            as intentional rather than padded out. */}
                        <p className="mt-auto pt-3 text-[14px] font-semibold text-white/85">
                          {property.price_label ?? formatPrice(property.price)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Selection count, clear, and the compare action — all in this same
              block, directly under the properties.

              The wrapper is what sticks, not the status row. They read as one
              unit and the button is the thing a visitor scrolls back for;
              sticky-ing only the status line would leave the action stranded
              at the end of the card. */}
          <div className={actionRowClass}>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
              {/* Says what to do next, not just what is true. "0 of 5
                  selected" with a dead button under it left the visitor with
                  nothing to act on; at 1 the remaining step is named; from 2
                  the comparison can run, so the count is the useful fact. */}
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#5b6270] uppercase">
                {selectedIds.length === 0
                  ? `Select at least ${COMPARE_MIN_IDS} to compare`
                  : selectedIds.length === 1
                    ? "Select 1 more to compare"
                    : `${selectedIds.length} of ${COMPARE_MAX_IDS} selected`}
              </p>

              {selectedIds.length > 0 ? (
                /* `min-h-11` is the 44px tap target; the label stays at 11px.
                    `-mr-2 px-2` extends the hit area without moving the text
                    away from the right edge of the row. */
                <button
                  type="button"
                  onClick={clearSelection}
                  className="-mr-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[11px] font-semibold tracking-[0.1em] text-[#4a5060] uppercase transition hover:text-[#0f1114]"
                >
                  <CloseIcon className="h-3 w-3" />
                  Clear all
                </button>
              ) : null}
            </div>

          {/* `disabled:bg-[#e4e7ec] disabled:text-[#5b6270]` is 4.9:1.
                The old `black/8` on `#8a909e` sat near 1.9:1 over the card's
                own `#f7f8fa` — grey on grey, effectively unreadable — while
                still looking enabled, since the gold hover and shadow were
                already gone. The flat grey now reads as disabled and the label
                is still legible. */}
            <button
              type="button"
              onClick={() => void runComparison()}
              disabled={!canRun}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a84c] px-5 py-3 text-[10px] font-bold tracking-[0.14em] text-[#0f1114] uppercase shadow-[0_6px_18px_rgba(201,168,76,0.35)] transition hover:bg-[#d4b57e] disabled:cursor-not-allowed disabled:bg-[#e4e7ec] disabled:text-[#5b6270] disabled:shadow-none"
            >
              {compareStatus === "loading" ? "Comparing…" : "Compare now"}
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* The error line sits at the same 20px as everything else. It was at the
            wrapper's edge, x = 0, because the block below it is full-bleed and
            had been carrying the gutter on its behalf. */}
        {compareError ? (
          <p className="mt-6 text-sm text-[#5b6270]">{compareError}</p>
        ) : null}

        {/* Results.

            On the section's own palette: a white card on `#eceef2`, hairline
            `border-black/10` rules, and gold reserved for the value that wins
            a row, the best-match label and the CTA.

            One property per screen at `CELL_WIDTH`. Two columns fitted inside
            the scrollport before, which made the table read as immovable --
            see the note on `CELL_WIDTH` for the measurements.

            Values are left-aligned, not centred. At 88% a centred number sits
            alone in a 340px row and the eye has to travel back to the left
            edge to read the next one down; ragged centred text down a column
            of numbers is the one arrangement that cannot be scanned.

            `overflow-x-clip` on the wrapper, for the pinned captions:
            `overflow: hidden` creates a scroll container and they would resolve
            against a scrollport that never scrolls. */}
        {compareStatus === "ready" && compared.length > 0 ? (
          <div className="mt-6 overflow-x-clip rounded-2xl border border-black/10 bg-white">
            <div className="snap-x snap-mandatory overflow-x-auto">
              {/* Property headers.

                  Deliberately NOT `sticky top-[var(--nav-h)]`. `overflow-x:
                  auto` computes `overflow-y` to `auto` as well, so this element
                  is already a vertical scroll container, and a sticky child
                  resolves against *it* rather than the page. A container whose
                  height is `auto` never scrolls vertically, so the declaration
                  was inert -- and in a capture it painted the header over the
                  first caption, which read as a missing field name. */}
              <div className="relative z-10 flex bg-white">
                {compared.map((property) => {
                  const isTop = bestMatchId === property.property_id;
                  const locality =
                    property.metrics.locality ?? property.metrics.location;

                  return (
                    <div
                      key={property.property_id}
                      className={`${CELL_WIDTH} shrink-0 snap-start border-r border-black/10 px-5 py-4 ${
                        isTop ? "bg-[#fdf6e3]" : ""
                      }`}
                    >
                      <p
                        className={`text-[10px] font-bold tracking-[0.14em] uppercase ${
                          isTop ? "text-[#8a6a12]" : "text-[#6b7280]"
                        }`}
                      >
                        {isTop ? "Best match" : "Pinned"}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-[16px] leading-tight font-bold tracking-tight text-[#0f1114]">
                        {property.name}
                      </p>
                      {locality ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#5b6270]">
                          {locality}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {groupedMetrics.map(({ group, rows }) => (
                <section key={group}>
                  {/* Group band. `#fbf1da` on white is barely a contrast step,
                      which is what makes it read as a band across the card
                      rather than as a rule between rows. */}
                  <h3 className="sticky left-0 z-20 bg-[#fbf1da] px-5 py-2.5 text-[11px] font-bold tracking-[0.16em] text-[#7a5c28] uppercase">
                    {GROUP_LABELS[group]}
                  </h3>

                  {rows.map(({ row, spec }) => (
                    <div key={row.key}>
                      {/* The metric name, pinned to the left edge of the scroll
                          area so it names the numbers at every column. 13px
                          semibold on `#faf9f6` -- this is a label for the row,
                          not a footnote, and at 12px grey it read as absent. */}
                      <p className="sticky left-0 z-10 bg-[#faf9f6] px-5 py-2 text-[13px] font-semibold text-[#3d4450]">
                        {spec.label}
                      </p>

                      <div className="flex">
                        {compared.map((property) => {
                          // Values are keyed by id, never read by column index.
                          const raw = row.values?.[property.property_id] ?? null;
                          const isBest =
                            row.best_property_id === property.property_id;
                          const missing =
                            raw === null || raw === undefined || raw === "";

                          // Only a genuine 0-100 metric gets a bar; anything
                          // else would need a scale invented for it.
                          const score =
                            !missing &&
                            SCORE_METRICS.has(row.key) &&
                            typeof raw === "number"
                              ? raw
                              : null;

                          // A tick is a claim about registration, so it is drawn
                          // only where the value actually says RERA.
                          const verified =
                            !missing &&
                            row.key === "approval_status" &&
                            typeof raw === "string" &&
                            /rera/i.test(raw);

                          return (
                            <div
                              key={property.property_id}
                              className={`flex min-h-[56px] ${CELL_WIDTH} shrink-0 snap-start flex-col items-start justify-center gap-1.5 border-r border-b border-black/10 px-5 py-3 ${
                                isBest && !missing ? "bg-[#fbf3dc]" : "bg-white"
                              }`}
                            >
                              <span
                                className={`text-[15px] leading-snug tabular-nums ${
                                  missing
                                    ? "text-[12px] text-[#6b7280]"
                                    : isBest
                                      ? "font-bold text-[#0f1114]"
                                      : "font-semibold text-[#3d4450]"
                                }`}
                              >
                                {formatValue(raw, spec)}
                              </span>

                              {score !== null ? (
                                <span
                                  aria-hidden
                                  className="block h-[3px] w-full max-w-[200px] overflow-hidden rounded-full bg-black/10"
                                >
                                  <span
                                    className={`block h-full rounded-full ${
                                      isBest ? "bg-[#c9a84c]" : "bg-[#8a8f98]"
                                    }`}
                                    style={{
                                      width: `${Math.max(0, Math.min(100, score))}%`,
                                    }}
                                  />
                                </span>
                              ) : null}

                              {verified ? (
                                <span
                                  aria-hidden
                                  className="text-[12px] leading-none text-[#8a6a12]"
                                >
                                  &#10003;
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              ))}

              {/* Footer CTA per property, on the same snap track, so each button
                  travels with its own column instead of detaching from it. */}
              <div className="flex">
                {compared.map((property) => (
                  <div
                    key={property.property_id}
                    className={`flex ${CELL_WIDTH} shrink-0 snap-start justify-start border-r border-black/10 p-5`}
                  >
                    <Link
                      href={`/properties/${property.property_id}`}
                      className="inline-flex min-h-11 w-full max-w-[280px] items-center justify-center rounded-full bg-[#c9a84c] px-5 text-[13px] font-semibold text-[#0f1114] transition hover:bg-[#d4b57e]"
                    >
                      Enquire on {property.name}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {compareStatus === "ready" && compared.length === 0 ? (
          <p className="mt-6 text-sm text-[#5b6270]">
            No comparable properties were returned for this selection.
          </p>
        ) : null}

        {result?.share_url ? (
          <p className="mt-4 text-[12px] font-semibold tracking-[0.04em] text-[#5b6270]">
            Shareable link · <span className="font-normal break-all text-[#3d4450]">{result.share_url}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
