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

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m5 13 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
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

  /** Selection order is the comparison order, and the backend preserves it. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [compareStatus, setCompareStatus] = useState<Status>("idle");
  const [compareError, setCompareError] = useState<string | null>(null);
  const compareAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

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
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atMax = selectedIds.length >= COMPARE_MAX_IDS;
  const canRun = canCompare(selectedIds) && compareStatus !== "loading";

  /**
   * Column templates, split by breakpoint.
   *
   * The metric-label column is deliberately much narrower on mobile so the
   * property columns keep a usable width; long labels such as "Est.
   * appreciation" wrap onto a second line instead of forcing a wider column.
   * Both templates are published as CSS variables so the header row and every
   * metric row stay on exactly the same track sizing.
   */
  const columnTemplate = (labelMin: string, columnMin: string) =>
    `minmax(${labelMin}, 1fr) repeat(${compared.length}, minmax(${columnMin}, 1.5fr))`;

  /** Reads one of the two templates above; set on the shared scroll wrapper. */
  const GRID_COLUMNS =
    "[grid-template-columns:var(--cmp-cols)] sm:[grid-template-columns:var(--cmp-cols-wide)]";

  return (
    <section
      data-section="compare_plots"
      aria-label="Compare properties"
      className="relative w-full overflow-hidden bg-[#eceef2]"
      style={{ ["--cmp-gold" as string]: GOLD }}
    >
      <div className="w-full px-6 pt-10 pb-6 sm:px-8 sm:pt-12 sm:pb-12 lg:px-12">
        <header className="max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#7a5c28] uppercase">
            Side by side
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#0f1114] sm:text-3xl lg:text-[2rem] lg:leading-tight">
            Compare up to five properties at once
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed font-medium text-[#3d4450]">
            Pick {COMPARE_MIN_IDS} to {COMPARE_MAX_IDS} developments. We line
            them up on price, connectivity, inventory and growth, and mark the
            better value in each row.
          </p>
        </header>
      </div>

      {/* One unified block: the properties sit on top and the compare action
            lives in the same block, so selection and action are never split.
            Full-bleed and square-edged on mobile; inset and rounded from sm up. */}
      <div className="w-full sm:px-8 sm:pb-12 lg:px-12">
        <div className="w-full bg-[#f7f8fa] px-4 py-4 sm:rounded-2xl sm:border sm:border-black/10 sm:bg-white/80 sm:px-5 sm:py-5">
          {/* Properties first, at the top of the block. */}
          {listStatus === "loading" ? (
            <p className="text-sm text-[#5b6270]">Loading properties…</p>
          ) : null}

          {listStatus === "error" ? (
            <p className="text-sm text-[#5b6270]">
              Properties are unavailable right now. Please try again shortly.
            </p>
          ) : null}

          {listStatus === "ready" && properties.length === 0 ? (
            <p className="text-sm text-[#5b6270]">No properties published yet.</p>
          ) : null}

          {listStatus === "ready" && properties.length > 0 ? (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-3 pb-2 scrollbar-none sm:mx-0 sm:gap-3.5 sm:overflow-x-visible sm:px-0 sm:pt-0 lg:grid lg:grid-cols-4">
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
                      {/* Cover image from the GET /api/properties response, used as
                          the card background. Rendered only when the API
                          supplies one; a property without a cover_url falls
                          back to its own dark surface rather than a stock
                          image.

                          It lives in its own clipped wrapper rather than
                          using overflow-hidden on the button, because that
                          would also clip the selection badge, which
                          deliberately overhangs the card corner. */}
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
                          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/62 to-black/45" />
                        </div>
                      ) : null}

                      <div className="relative z-10 flex flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-white uppercase">
                            {property.property_type ?? "Development"}
                          </span>
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              selected
                                ? "border-[#c9a84c] bg-[#c9a84c] text-[#0f1114]"
                                : "border-white/45 text-white/85 group-hover:border-[#c9a84c] group-hover:text-[#c9a84c]"
                            }`}
                            aria-hidden
                          >
                            {selected ? (
                              <CheckIcon className="h-3.5 w-3.5" />
                            ) : (
                              <PlusIcon className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </div>

                        <h3 className="mt-3 line-clamp-2 text-sm font-semibold tracking-tight text-white">
                          {property.name}
                        </h3>

                        {/* Anchored to the bottom so the taller mobile card reads
                            as intentional rather than padded out. */}
                        <p className="mt-auto pt-3 text-[13px] font-semibold text-white/85">
                          {property.price_label ?? formatPrice(property.price)}
                        </p>
                      </div>

                      {/* Selection order, so the comparison column order is
                          visible without a separate summary block. */}
                      {selected ? (
                        <span className="absolute -top-2 -left-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#c9a84c] text-[10px] font-bold text-[#0f1114]">
                          {order + 1}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* Selection count, clear, and the compare action — all in this same
              block, directly under the properties. */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#5b6270] uppercase">
              {selectedIds.length} of {COMPARE_MAX_IDS} selected
              {selectedIds.length === 1
                ? ` · add ${COMPARE_MIN_IDS - selectedIds.length} more to compare`
                : ""}
            </p>

            {selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-[#4a5060] uppercase transition hover:text-[#0f1114]"
              >
                <CloseIcon className="h-3 w-3" />
                Clear all
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void runComparison()}
            disabled={!canRun}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#c9a84c] px-5 py-3 text-[10px] font-bold tracking-[0.14em] text-[#0f1114] uppercase shadow-[0_6px_18px_rgba(201,168,76,0.35)] transition hover:bg-[#d4b57e] disabled:cursor-not-allowed disabled:bg-black/8 disabled:text-[#8a909e] disabled:shadow-none"
          >
            {compareStatus === "loading" ? "Comparing…" : "Compare now"}
            <ArrowIcon className="h-4 w-4" />
          </button>
        </div>

        {compareError ? (
          <p className="mt-6 text-sm text-[#5b6270]">{compareError}</p>
        ) : null}

        {/* Results. The header and the body share one horizontal scroller, so
            the columns cannot drift apart when the table scrolls on mobile. */}
        {compareStatus === "ready" && compared.length > 0 ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-black/10 bg-white">
            <div className="overflow-x-auto">
              <div
                className="min-w-[32rem] sm:min-w-[52rem]"
                style={{
                  ["--cmp-cols" as string]: columnTemplate("6rem", "8.5rem"),
                  ["--cmp-cols-wide" as string]: columnTemplate("11rem", "12rem"),
                }}
              >
                {/* Property column headers */}
                <div
                  className={`grid gap-px border-b border-black/12 bg-black/12 ${GRID_COLUMNS}`}
                >
                  <div className="sticky left-0 z-20 bg-[#faf9f6] px-3 py-4 sm:px-5">
                    <span className="text-[11px] font-bold tracking-[0.14em] text-[#4a5060] uppercase">
                      Metric
                    </span>
                  </div>
                  {compared.map((property: ComparisonProperty) => (
                    <div key={property.property_id} className="bg-white px-4 py-4 sm:px-5">
                      <p className="line-clamp-2 text-[15px] leading-snug font-bold tracking-tight text-[#0f1114]">
                        {property.name}
                      </p>
                      <Link
                        href={`/properties/${property.property_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.08em] text-[#8a6a12] uppercase transition hover:text-[#0f1114]"
                      >
                        View
                        <ArrowIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>

                {/* Metric rows, values keyed by property id */}
                {groupedMetrics.map(({ group, rows }) => (
                  <section key={group}>
                    <h3 className="bg-[#0f1114] px-3 py-2.5 text-[11px] font-bold tracking-[0.16em] text-[#c9a84c] uppercase sm:px-5">
                      {/* Pinned to the left edge so the group title stays put
                          while the property columns scroll underneath it. */}
                      <span className="sticky left-3 inline-block sm:left-5">
                        {GROUP_LABELS[group]}
                      </span>
                    </h3>

                    {rows.map(({ row, spec }) => (
                      <div
                        key={row.key}
                        className={`grid gap-px border-b border-black/10 bg-black/10 last:border-b-0 ${GRID_COLUMNS}`}
                      >
                        {/* Sticky on mobile so the label stays readable while
                            the property columns scroll under it. Long labels
                            wrap rather than widening the column. */}
                        <div className="sticky left-0 z-10 bg-[#faf9f6] px-3 py-3 sm:px-5">
                          <span className="text-[13px] leading-snug font-semibold wrap-break-word text-[#3d4450]">
                            {spec.label}
                          </span>
                        </div>

                        {compared.map((property) => {
                          // Values are keyed by id, never read by column index.
                          const raw = row.values?.[property.property_id] ?? null;
                          const isBest =
                            row.best_property_id === property.property_id;
                          const missing =
                            raw === null || raw === undefined || raw === "";

                          return (
                            <div
                              key={property.property_id}
                              className={`px-4 py-3 sm:px-5 ${
                                isBest ? "bg-[#fbf3dc]" : "bg-white"
                              }`}
                            >
                              <span
                                className={`text-[15px] leading-snug ${
                                  missing
                                    ? "text-[13px] font-medium text-[#6b7280] italic"
                                    : isBest
                                      ? "font-bold text-[#0f1114]"
                                      : "font-semibold text-[#3d4450]"
                                }`}
                              >
                                {formatValue(raw, spec)}
                              </span>
                              {isBest && !missing ? (
                                <span className="ml-2 inline-flex translate-y-[-1px] items-center rounded-full bg-[#c9a84c] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#0f1114] uppercase">
                                  Best
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </section>
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