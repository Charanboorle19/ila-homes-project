"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
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

/**
 * The four capability cards in the desktop idle state.
 *
 * A module constant rather than four repeated blocks, so the icon tile, the
 * type scale and the border can only be defined once — when they were written
 * out separately the four had already drifted apart.
 *
 * `icon` holds a component rather than a glyph. These were emoji (`💰 📍 🏛️
 * 📈`) and they had three faults on this surface: the glyph is rendered by the
 * platform, not by us, so it cannot be sized or aligned to the tile; emoji
 * present at full colour beside a single-hue palette read as clip-art rather
 * than as part of the drawing; and the pin and the classical building were
 * near-duplicates of one another — both are "a landmark you point at" — so two
 * of the four icons said the same thing.
 *
 * The four below are line glyphs on the same `24` viewBox, `1.8` stroke,
 * round caps and joins as `ArrowIcon` and `CompareIcon`, and they inherit
 * `currentColor` from the tile. They are specific and distinct: a tag for
 * rates, a pin for proximity, a shield-and-check for approvals, a rising line
 * for growth.
 */
const FEATURE_HINTS: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}[] = [
  {
    icon: TagIcon,
    title: "Pricing & Rates",
    body: "Plot rates, price per sq.ft, and monthly maintenance",
  },
  {
    icon: PinIcon,
    title: "Connectivity Score",
    body: "ORR proximity, Metro reach, schools & transit ratings",
  },
  {
    icon: ShieldCheckIcon,
    title: "Approvals & Legal",
    body: "Verified RERA numbers, HMDA/DTCP layouts & plots",
  },
  {
    icon: TrendIcon,
    title: "Est. Growth & Fit",
    body: "Appreciation projections & buyer persona alignment",
  },
];

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

/**
 * Visible rows at or below this count get the availability row underneath them.
 *
 * The results card stretches to match the property picker beside it, so a short
 * table leaves a large dead area on the card. Eight is about where stretching
 * the rows alone stops covering that area — below it, the row either names what
 * the backend omitted or confirms that nothing was omitted.
 */
const AVAILABILITY_ROW_THRESHOLD = 8;

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

function CompareIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <rect x="18" y="22" width="26" height="26" rx="5.5" />
      <rect x="64" y="22" width="26" height="26" rx="5.5" />
      <rect x="18" y="53" width="72" height="5.5" rx="2.75" />
      <path d="M 48 56 H 60 L 70.5 76.5 A 5.5 5.5 0 0 1 65.6 84.5 H 42.4 A 5.5 5.5 0 0 1 37.5 76.5 Z" />
    </svg>
  );
}

/**
 * The four capability-card glyphs.
 *
 * Same construction as `ArrowIcon` and `CompareIcon` above — `24` viewBox,
 * `fill="none"`, `stroke="currentColor"`, `1.8` stroke, round caps and joins —
 * so they sit at the same optical weight and scale with `className` alone.
 *
 * **Two of them replace a near-duplicate pair.** The old `📍` and `🏛️` were
 * both "a landmark you point at", so two of the four cards carried the same
 * idea. `PinIcon` is now purely proximity and `ShieldCheckIcon` is a
 * verification claim, which is what "Approvals & Legal" and its RERA copy
 * actually mean.
 *
 * Each is `aria-hidden` individually rather than through a wrapper, matching
 * the other glyphs in this file.
 */

/** A price tag — the punched-hole corner is what makes it read as a tag. */
function TagIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** A map pin with its centre ring — distance, not a landmark. */
function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21.5s7-6.6 7-11.5a7 7 0 1 0-14 0c0 4.9 7 11.5 7 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * A shield with a tick inside it.
 *
 * The tick is what makes this "verified" rather than merely "protective", which
 * is the claim the card's body makes about RERA numbers.
 */
function ShieldCheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.8 4.5 6v5.6c0 4.6 3.1 8.7 7.5 9.9 4.4-1.2 7.5-5.3 7.5-9.9V6L12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2.2 2.2L15.2 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A rising line under an arrow head — appreciation. */
function TrendIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m3 16.5 5.5-5.5 3.5 3.5L21 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 5.5H21V11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type ComparePropertiesProps = {
  initialSelectedIds?: string[];
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  modalOnly?: boolean;
};

export default function CompareProperties({
  initialSelectedIds,
  isModalOpen,
  onCloseModal,
  modalOnly = false,
}: ComparePropertiesProps = {}) {
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [listStatus, setListStatus] = useState<Status>("loading");
  /** `location_id` -> locality name, for the card's location line. */
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});

  /** Selection order is the comparison order, and the backend preserves it. */
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);

  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedIds(initialSelectedIds);
    }
  }, [initialSelectedIds]);

  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [compareStatus, setCompareStatus] = useState<Status>("idle");
  const [compareError, setCompareError] = useState<string | null>(null);
  const compareAbort = useRef<AbortController | null>(null);

  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  // Sync external isModalOpen prop and trigger comparison if opened
  useEffect(() => {
    if (typeof isModalOpen === "boolean") {
      setMobileModalOpen(isModalOpen);
      const effectiveIds = initialSelectedIds && initialSelectedIds.length > 0 ? initialSelectedIds : selectedIds;
      if (isModalOpen && effectiveIds.length >= 2) {
        const ids = normalizeCompareIds(effectiveIds);
        if (canCompare(ids)) {
          compareAbort.current?.abort();
          const controller = new AbortController();
          compareAbort.current = controller;
          setCompareStatus("loading");
          setCompareError(null);

          compareProperties(ids, controller.signal)
            .then((comparison) => {
              if (controller.signal.aborted) return;
              setResult(comparison);
              setCompareStatus("ready");
              setMobileModalOpen(true);
            })
            .catch((error: unknown) => {
              if (controller.signal.aborted) return;
              setCompareStatus("error");
              setCompareError(
                error instanceof Error
                  ? error.message
                  : "Comparison is unavailable right now. Please try again shortly.",
              );
            });
        }
      }
    }
  }, [isModalOpen, initialSelectedIds, selectedIds]);

  const handleCloseModal = useCallback(() => {
    setMobileModalOpen(false);
    onCloseModal?.();
  }, [onCloseModal]);

  const [activeCategory, setActiveCategory] = useState<"all" | MetricSpec["group"]>("all");
  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    if (!mobileModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileModalOpen]);

  useEffect(() => {
    if (!mobileModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileModalOpen]);

  const copyShareUrl = useCallback(() => {
    if (!result?.share_url) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(result.share_url);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }, [result?.share_url]);



  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p]));
  }, [properties]);

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
      ? "sticky bottom-0 z-20 -mx-5 rounded-b-2xl bg-[#f7f8fa] px-5 pb-[env(safe-area-inset-bottom)] sm:static sm:mx-0 sm:z-auto sm:rounded-none sm:bg-white/80 sm:px-0 sm:pb-0"
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
    setMobileModalOpen(false);
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
      setMobileModalOpen(true);

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

  const filteredGroups = useMemo(() => {
    if (activeCategory === "all") return groupedMetrics;
    return groupedMetrics.filter((g) => g.group === activeCategory);
  }, [groupedMetrics, activeCategory]);

  /**
   * The rows actually on screen: canonical group order, backend order within
   * each group. One source of truth for both tables and for the coverage count,
   * so the summary can never describe a different row set than the one rendered.
   */
  const visibleRows = useMemo(
    () => filteredGroups.flatMap(({ rows }) => rows),
    [filteredGroups],
  );

  const compared = result?.properties ?? [];

  /**
   * Per-property coverage across the rows currently on screen.
   *
   * Counted over `visibleRows`, not `result.metrics`, so the denominator always
   * matches the rows the visitor can actually see — narrow the category pills
   * and both the table and the count narrow together. A value counts as
   * available only when it is neither `null`, `undefined` nor an empty string,
   * the same test the table cell uses, so the two can never disagree.
   *
   * Nothing here is derived beyond counting. No value is substituted, ranked or
   * inferred — the row only reports what the backend did and did not return.
   */
  const availability = useMemo(() => {
    const total = visibleRows.length;
    return compared.map((property) => {
      const missing: string[] = [];
      for (const { row, spec } of visibleRows) {
        const raw = row.values?.[property.property_id];
        if (raw === null || raw === undefined || raw === "") missing.push(spec.label);
      }
      return { property, total, available: total - missing.length, missing };
    });
  }, [compared, visibleRows]);

  /**
   * Whether the availability row renders at all.
   *
   * Two triggers, both about emptiness: any property missing a value on a
   * visible row, or a short table that cannot fill the card on its own. With
   * every value present across a full table there is nothing to explain, so the
   * row stays out of the way rather than padding the card with "all available".
   */
  const showAvailability =
    visibleRows.length > 0 &&
    (availability.some((entry) => entry.missing.length > 0) ||
      visibleRows.length <= AVAILABILITY_ROW_THRESHOLD);
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

  const bestMatchProperty = useMemo(() => {
    return compared.find((p) => p.property_id === bestMatchId) ?? compared[0] ?? null;
  }, [compared, bestMatchId]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const atMax = selectedIds.length >= COMPARE_MAX_IDS;
  const canRun = canCompare(selectedIds) && compareStatus !== "loading";

  // Modal-only mode: only display the comparison popup dialog and blur loading animation,
  // without rendering the full static section block.
  if (modalOnly) {
    if (!mobileModalOpen && compareStatus === "idle") {
      return null;
    }

    return (
      <Fragment>
        {/* Loading overlay with blurred background and loader animation */}
        {compareStatus === "loading" && (
          <div
            className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
            aria-live="polite"
            aria-label="Loading comparison data"
          >
            <span
              className="ila-loader mb-4"
              style={{ ["--ila-loader-color" as string]: GOLD, ["--ila-loader-size" as string]: "48px" }}
              aria-hidden="true"
            />
            <p className="text-sm font-semibold tracking-wide text-white/90">
              Comparing properties...
            </p>
          </div>
        )}

        {/* Comparison Popup Modal Dialog */}
        {mobileModalOpen && compared.length > 0 && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Property comparison results"
            className="ila-compare-modal fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#141519] text-white animate-fade-in"
          >
            {/* Header band */}
            <div className="shrink-0 border-b border-white/10 bg-[#17191e] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[18px] leading-[1.25] font-bold tracking-tight text-white">
                    Comparison Results
                  </h3>
                  <p className="mt-1 text-[12px] leading-snug text-[#8a909e]">
                    Comparing <strong className="text-[#e8e6e1]">{compared.length}</strong> properties
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  aria-label="Close comparison"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/90 transition active:scale-95 hover:bg-white/15"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Category filter pills */}
              <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`min-h-9 shrink-0 snap-start rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition ${
                    activeCategory === "all"
                      ? "bg-[#c9a84c] text-[#0f1114]"
                      : "bg-white/10 text-white/75 active:bg-white/15"
                  }`}
                >
                  All metrics
                </button>
                {(["overview", "location", "inventory", "growth"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`min-h-9 shrink-0 snap-start rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition ${
                      activeCategory === cat
                        ? "bg-[#c9a84c] text-[#0f1114]"
                        : "bg-white/10 text-white/75 active:bg-white/15"
                    }`}
                  >
                    {GROUP_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* The table */}
            <div className="ila-search-scroll min-h-0 flex-1 overflow-auto overscroll-contain scroll-pl-[116px] snap-x">
              <div
                className="grid w-max"
                style={{
                  gridTemplateColumns: `116px repeat(${compared.length}, minmax(0, max-content))`,
                }}
              >
                <div className="sticky left-0 z-20 flex min-h-[56px] w-[116px] items-end border-r border-b border-white/10 bg-[#141519] px-3 py-3">
                  <span className="text-[10px] font-bold tracking-[0.14em] text-[#6b7280] uppercase">
                    Metric
                  </span>
                </div>

                {compared.map((property) => {
                  const isTop = bestMatchId === property.property_id;
                  const locality = property.metrics.locality ?? property.metrics.location;

                  return (
                    <div
                      key={property.property_id}
                      className={`flex max-w-[220px] snap-start flex-col border-r border-b border-white/10 px-3 py-3 ${
                        isTop ? "bg-[rgba(201,168,76,0.08)]" : ""
                      }`}
                    >
                      <p
                        className={`text-[9px] font-bold tracking-[0.14em] uppercase ${
                          isTop ? "text-[#c9a84c]" : "text-[#6b7280]"
                        }`}
                      >
                        {isTop ? "Best match" : "Pinned"}
                      </p>
                      <h4 className="mt-1 line-clamp-2 break-words text-[14px] leading-[1.25] font-bold tracking-tight text-[#f2f0ea]">
                        {property.name}
                      </h4>
                      {locality ? (
                        <p className="mt-1 line-clamp-2 break-words text-[11px] leading-[1.3] text-[#8a909e]">
                          {locality}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                {visibleRows.map(({ row, spec }) => (
                  <Fragment key={row.key}>
                    <div className="sticky left-0 z-10 flex min-h-[56px] w-[116px] items-center border-r border-b border-white/10 bg-[#141519] px-3 text-[11px] leading-[1.3] font-medium text-[#8a909e]">
                      {spec.label}
                    </div>

                    {compared.map((property) => {
                      const raw = row.values?.[property.property_id] ?? null;
                      const isBest = row.best_property_id === property.property_id;
                      const missing = raw === null || raw === undefined || raw === "";
                      const score =
                        !missing && SCORE_METRICS.has(row.key) && typeof raw === "number"
                          ? raw
                          : null;
                      const verified =
                        !missing &&
                        row.key === "approval_status" &&
                        typeof raw === "string" &&
                        /rera/i.test(raw);

                      return (
                        <div
                          key={property.property_id}
                          className={`flex min-h-[56px] max-w-[220px] snap-start flex-col justify-center border-r border-b border-white/10 px-3 py-2.5 ${
                            isBest && !missing ? "bg-[rgba(201,168,76,0.05)]" : ""
                          }`}
                        >
                          <span
                            className={`text-[14px] tabular-nums ${
                              missing
                                ? "text-[12px] text-[#6b7280]"
                                : isBest
                                  ? "font-bold text-[#c9a84c]"
                                  : "font-semibold text-[#e8e6e1]"
                            }`}
                          >
                            {formatValue(raw, spec)}
                          </span>

                          {score !== null ? (
                            <div
                              aria-hidden="true"
                              className="mt-2 h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-white/10"
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isBest ? "bg-[#c9a84c]" : "bg-[#8a8f98]"
                                }`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, score))}%`,
                                }}
                              />
                            </div>
                          ) : null}

                          {verified ? (
                            <p className="mt-1.5 text-[11px] font-semibold text-[#c9a84c]">
                              <span>&#10003;</span> RERA Registered
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}

                {visibleRows.length === 0 ? (
                  <div className="col-span-full flex min-h-[72px] items-center border-b border-white/10 px-3 text-[12px] text-[#8a909e]">
                    No metrics were returned for this category.
                  </div>
                ) : null}

                {showAvailability ? (
                  <Fragment>
                    <div className="sticky left-0 z-10 flex min-h-[72px] w-[116px] items-center border-r border-b border-white/10 bg-[#141519] px-3 text-[11px] leading-[1.3] font-medium text-[#8a909e]">
                      Data availability
                    </div>

                    {availability.map(({ property, total, available, missing }) => {
                      const percent = total === 0 ? 0 : (available / total) * 100;
                      const complete = missing.length === 0;

                      return (
                        <div
                          key={property.property_id}
                          className="flex min-h-[72px] max-w-[220px] snap-start flex-col justify-center gap-1.5 border-r border-b border-white/10 px-3 py-2.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="line-clamp-2 break-words text-[11px] leading-[1.3] text-[#8a909e]">
                              {property.name}
                            </span>
                            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#e8e6e1]">
                              {available}
                              <span className="text-[#6b7280]">/{total}</span>
                            </span>
                          </div>

                          <div
                            aria-hidden="true"
                            className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
                          >
                            <div
                              className="h-full rounded-full bg-[#8a8f98] transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <p className="line-clamp-2 text-[10px] text-[#6b7280]">
                            {complete
                              ? "Every metric returned a value"
                              : `Missing ${missing.join(", ")}`}
                          </p>
                        </div>
                      );
                    })}
                  </Fragment>
                ) : null}

                <div className="sticky left-0 z-10 w-[116px] bg-[#141519] py-4" />
                {compared.map((property) => (
                  <div
                    key={property.property_id}
                    className="flex snap-start items-center bg-[#141519] px-3 py-4"
                  >
                    <Link
                      href={`/properties/${property.property_id}`}
                      aria-label={`Enquire on ${property.name}`}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c9a84c] px-3 text-[12px] font-semibold text-[#0f1114] transition hover:bg-[#d4b57e]"
                    >
                      Enquire
                    </Link>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </Fragment>
    );
  }

  // The section uses `overflow-x-clip`, not `overflow-hidden`.
  //
  // It still clips horizontally -- the carousel's `-mr-5` and the results table
  // both run to the section edge -- but `clip` does not create a scroll
  // container and `overflow: hidden` does. A sticky descendant resolves against
  // its nearest scrollport, so under `overflow: hidden` the Compare button's
  // sticky row would have had a scrollport that never scrolls and would have
  // stayed exactly where it was. Same fix `FindYourPlot`'s section uses.
  return (
    /* `lg:grid lg:h-[104dvh]` — on desktop the section is a two-column grid that
       runs **edge to edge**. Neither column carries an outer gutter, so the
       picker is flush left and the results card is flush right, and both are
       flush top and bottom:

         0px                                              viewport edge
         ┌────────────────────────────────────────────────────────┐
         │ heading (row 1)      │  │  results card              │  ↑
         ├──────────────────────┤  │  (row 1 / row 2 span)      │  │
         │ property picker      │  │                           │  │
         │ (row 2)              │  │                           │  ↓
         └──────────────────────┴──┴───────────────────────────┘

       `lg:gap-x-0` puts the two columns hard against each other — the picker's
       `border-r` is the seam, and the dark table starts the instant the white
       panel ends. `lg:gap-y-5` is kept, because the heading needs to breathe
       above the picker.

       Two rows, `auto minmax(0,1fr)`. The results block carries
       `lg:row-span-2`, so it occupies the full height of the section and is
       not pushed down by the heading the way it was when the heading sat above
       the grid. The heading and its sub-heading live in the left column, above
       the picker.

       `480px` / `500px`, up from `440px` / `460px`. The picker carries two
       180px tiles per row, and at 440px those came to 194px — tall and narrow,
       with most development names wrapping to two lines. The extra 40px takes
       them to 218px. Nothing in the results column moves: its `w-64` cells and
       `w-52` label column are fixed, so the table's own geometry is untouched.

       `104dvh` rather than `100dvh` — "a little" taller than the viewport. The
       trade is a short page scroll at `lg`. Return to `lg:h-[100dvh]` to remove
       it. `dvh` rather than `vh` so the browser's own chrome is not counted.

       `overflow-hidden` replaces the base `overflow-x-clip` at `lg` and up. It
       is safe here because nothing on the desktop branch is sticky against an
       ancestor scrollport: the metric label column sticks against the table's
       own `overflow-auto` wrapper, which sits between it and this element. The
       mobile branch, which does rely on a sticky row resolving against this
       section, keeps `overflow-x-clip`.

       Below `lg` this is an ordinary block again and the mobile/tablet flow is
       unchanged: heading, then the selection card, then the results. */
    <section
        data-section="compare_plots"
        aria-label="Compare properties"
        className="relative w-full overflow-x-clip bg-[#eceef2] lg:grid lg:h-[104dvh] lg:grid-cols-[480px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-0 lg:gap-y-5 lg:overflow-hidden xl:grid-cols-[500px_minmax(0,1fr)]"
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

      {/* `content-slot` stacks the content above that layer.

          `lg:col-start-1 lg:row-start-1` puts the heading in the **left** column
          at `lg`, above the picker, instead of spanning the full width above
          both columns as it did before.

          The left column has no outer gutter, so the heading supplies its own:
          `lg:px-5` keeps the type off the viewport edge and `lg:pt-5` sets the
          section's top inset, matched by the results column. `lg:pb-0` hands
          the 20px below to the section's `lg:gap-y-5` so it is not doubled.

          Type scale is retuned for a 440px column rather than a full-width
          band. The heading dropped from `2rem` to `lg:text-[24px]` with
          `leading-[1.15]` — at 32px the same sentence ran to three lines in a
          400px measure and pushed the picker down. The intro dropped to
          `lg:text-[13px]` for the same reason. The mobile steps are unchanged;
          this is the `lg` pass. */}
      <div className="content-slot w-full px-5 pt-12 pb-6 sm:px-8 sm:pt-12 sm:pb-12 lg:col-start-1 lg:row-start-1 lg:px-5 lg:pt-5 lg:pb-0">
        <header className="max-w-2xl">
          <p className="text-[12px] font-bold tracking-[0.2em] text-[#7a5c28] uppercase">
            Side by side
          </p>
          <h2 className="mt-2 text-[28px] leading-[1.2] font-bold tracking-tight text-[#0f1114] sm:text-3xl lg:mt-2.5 lg:text-[24px] lg:leading-[1.15]">
            Compare up to five properties at once
          </h2>
          <p className="mt-3 text-[16px] leading-[1.5] font-medium text-[#3d4450] lg:mt-2.5 lg:text-[13px] lg:leading-[1.55]">
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
            followed the button almost immediately.

            `lg:contents` is the load-bearing part of the desktop restructure.
            It drops this wrapper's own box, so the two panels inside become
            direct children of the section's grid and can each take a cell of
            their own. Below `lg` it is an ordinary block and the mobile/tablet
            flow below is untouched. */}
      <div className="content-slot w-full px-5 pb-6 sm:px-8 sm:pb-12 lg:contents">
        {/* ======================================================== */}
        {/* DESKTOP PANELS (lg and above: 1024px+)                   */}
        {/* Left Column: heading + properties selector               */}
        {/* Right Column: comparison results, full section height    */}
        {/* ======================================================== */}
        {/* `lg:contents` for the same reason as the wrapper above: the two
            panels become direct grid items of the section and place themselves
            with `col-start` / `row-start`. `hidden` below `lg` keeps the
            desktop-only panels off the mobile flow. */}
        <div className="hidden lg:contents">
          {/* LEFT COLUMN: Properties Selection.

              No `lg:px-*` and no `lg:pb-*` — the panel is flush left and flush
              bottom, with the section's `lg:gap-y-5` the only space above it.
              `content-slot` restores the `position: relative; z-index: 1` that
              the `display: contents` ancestors discarded, keeping the panel
              above the dot-grid layer.

              The card is a separate element rather than the cell itself only
              for its internal padding — `px-4` here, since the outer gutter is
              gone and `px-*` on one element would fight the card's own `p-*`. */}
          <div className="content-slot hidden min-h-0 lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col">
            {/* Square, not `rounded-2xl`. The panel is flush to the left and
                bottom edges of the section, where rounding would show the
                section's `#eceef2` through the corner and read as a mistake.
                `border-r` is the seam against the dark results card — the
                column gap is `gap-x-0`, so nothing else separates them. */}
            <div className="flex h-full min-h-0 w-full flex-col border-r border-black/10 bg-white">
            {/* One compact row. The "Available Properties" h3 and the
                "Select 2 to 5 developments below…" line are gone: the section
                heading directly above already carries that copy, and in a 440px
                column two stacked headings plus a paragraph cost a whole tile
                row. The count stays — it is the one thing this row says that
                the section heading does not. */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-4">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#7a5c28] uppercase">
                Available properties
              </p>
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-[#4a5060]">
                {properties.length} total
              </span>
            </div>

            {listStatus === "loading" ? (
              <div className="flex h-64 items-center justify-center text-sm text-[#5b6270]">
                <span className="ila-loader ila-loader--sm mr-2" aria-hidden />
                Loading properties…
              </div>
            ) : null}

            {listStatus === "error" ? (
              <div className="flex h-64 items-center justify-center text-sm text-[#5b6270]">
                Properties are unavailable right now. Please try again shortly.
              </div>
            ) : null}

            {listStatus === "ready" && properties.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-[#5b6270]">
                No properties published yet.
              </div>
            ) : null}

            {/* `flex-1` (not a fixed `max-h`) so the list grows into whatever height the
                right block forces on the row, and `content-start` so the tiles
                keep their own height instead of stretching to fill.

                `px-4` here is the panel's only horizontal inset — the column
                itself is flush left, so the tiles would otherwise run into the
                viewport edge. `pb-4` plus the footer's `p-4` gives the list a
                clean break above the selection action. */}
            {listStatus === "ready" && properties.length > 0 ? (
              <ul className="ila-search-scroll grid min-h-0 flex-1 grid-cols-2 content-start gap-3 overflow-y-auto px-4 pt-3 pb-4">
                {properties.map((property) => {
                  const selected = selectedSet.has(property.id);
                  const blocked = !selected && atMax;
                  const order = selectedIds.indexOf(property.id);

                  return (
                    <li key={property.id}>
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
                        className={`group relative flex h-[180px] w-full flex-col rounded-xl border p-3.5 text-left transition-all ${
                          selected
                            ? "border-[#c9a84c] bg-[#241f14] shadow-md ring-2 ring-[#c9a84c]/30"
                            : "border-black/20 bg-[#1b1d22] hover:border-black/40"
                        } disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        {property.cover_url ? (
                          <div
                            aria-hidden
                            className="absolute inset-0 z-0 overflow-hidden rounded-xl"
                          >
                            <Image
                              src={property.cover_url}
                              alt=""
                              fill
                              sizes="220px"
                              unoptimized
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                        ) : null}

                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-linear-to-t from-black/95 via-black/65 to-black/40"
                        />

                        <div className="relative z-10 flex flex-1 flex-col justify-between">
                          <div className="flex items-start justify-between gap-1.5">
                            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] text-white uppercase backdrop-blur-xs">
                              {property.property_type ?? "Plot"}
                            </span>

                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums transition-colors ${
                                selected
                                  ? "border-[#c9a84c] bg-[#c9a84c] text-[#0f1114]"
                                  : "border-white/45 text-white/85 group-hover:border-[#c9a84c] group-hover:text-[#c9a84c]"
                              }`}
                              aria-hidden
                            >
                              {selected ? order + 1 : <PlusIcon className="h-3 w-3" />}
                            </span>
                          </div>

                          <div>
                            <h4 className="line-clamp-2 text-[14px] font-bold leading-snug tracking-tight text-white">
                              {property.name}
                            </h4>
                            {locationNames[property.location_id ?? ""] ? (
                              <p className="mt-0.5 truncate text-[11px] text-white/70">
                                {locationNames[property.location_id ?? ""]}
                              </p>
                            ) : null}
                            <p className="mt-1 text-[13px] font-bold text-[#c9a84c]">
                              {property.price_label ?? formatPrice(property.price)}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {/* Selection Footer in Left Block. `shrink-0` and flush bottom — the list
                above takes the slack, so the action never drifts as the
                selection changes. */}
            <div className="shrink-0 border-t border-black/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-[#5b6270] uppercase">
                  {selectedIds.length === 0
                    ? `Select at least ${COMPARE_MIN_IDS} to compare`
                    : selectedIds.length === 1
                      ? "Select 1 more to compare"
                      : `${selectedIds.length} of ${COMPARE_MAX_IDS} selected`}
                </p>

                {selectedIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-[0.1em] text-[#5b6270] uppercase transition hover:text-[#0f1114]"
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
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] px-5 py-3 text-[11px] font-bold tracking-[0.14em] text-[#0f1114] uppercase shadow-[0_6px_18px_rgba(201,168,76,0.35)] transition hover:bg-[#d4b57e] disabled:cursor-not-allowed disabled:bg-[#e4e7ec] disabled:text-[#5b6270] disabled:shadow-none"
              >
                {compareStatus === "loading" ? "Comparing…" : "Compare now"}
                <ArrowIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          </div>

          {/* RIGHT COLUMN: Comparison Results / Preview / Status.

              `lg:row-span-2` is what makes the table reach the full height of
              the section: it starts at the same row as the heading and runs
              past the picker to the section's bottom edge. The heading is in
              the left column, so nothing sits above it here any more.

              No `lg:px-*`, `lg:pt-*` or `lg:pb-*` — the card is **flush to the
              right edge and to the top and bottom of the section**. Nothing
              insets it, and the card itself carries no rounding, so the dark
              surface runs uninterrupted to the viewport edge. The table's own
              `px-4` cells keep the type off that edge.

              `min-h-0` is what lets the table's `overflow-auto` wrapper scroll
              vertically instead of the block overflowing the section. */}
          <div className="content-slot hidden min-h-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:flex lg:flex-col">
            {/* Blueprint tile behind the panel whenever there is no comparison
                to show — idle, loading and error. See `.compare-results-bg` in
                globals.css: the source pattern retinted to this section's own
                `#eceef2` fill and `#c9a84c` line work, at opacity 0.35 so it
                stays a texture under the copy rather than competing with it.

                Gated on `compareStatus !== "ready"` because the ready state
                paints an opaque `#141519` surface over the whole column — the
                pattern would be invisible there anyway, and rendering it would
                cost a full-panel gradient stack for nothing.

                `absolute inset-0 z-0` against the wrapper's `content-slot`
                positioning. The status cards below carry `relative z-10`,
                which they need: an absolutely positioned box paints after
                in-flow content, so without it the pattern would sit on top of
                the copy rather than behind it. */}
            {compareStatus !== "ready" ? (
              <div
                aria-hidden="true"
                className="compare-results-bg pointer-events-none absolute inset-0 z-0"
              />
            ) : null}

            <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
            {/* 1. Loading State */}
            {compareStatus === "loading" ? (
              /* Status cards: square, like the ready card, so they fill the same flush
               column without the section surface showing through a corner.

               `relative z-10` to sit above the blueprint layer, and no
               background of their own — `bg-transparent` would hide the very
               pattern the panel is showing. */
              <div className="relative z-10 flex min-h-[360px] flex-1 flex-col items-center justify-center border border-black/10 bg-transparent p-12 text-center">
                <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
                  <span className="ila-loader ila-loader--lg text-[#c9a84c]" aria-hidden />
                </div>
                <h4 className="text-[18px] font-bold text-[#0f1114]">Generating comparison…</h4>
                <p className="mt-1 text-[13px] text-[#5b6270]">
                  Analyzing metrics, connectivity scores, inventory, and growth projections across selected developments.
                </p>
              </div>
            ) : null}

            {/* 2. Error State */}
            {compareStatus === "error" ? (
              <div className="relative z-10 flex min-h-[280px] flex-1 flex-col items-center justify-center border border-rose-200 bg-rose-50/40 p-8 text-center">
                <p className="text-[12px] font-bold text-rose-600 uppercase tracking-wider">Comparison Error</p>
                <h4 className="mt-1 text-[17px] font-bold text-[#0f1114]">Unable to generate comparison</h4>
                <p className="mt-2 max-w-md text-[13px] text-[#5b6270]">
                  {compareError ?? "Comparison is unavailable right now. Please try again shortly."}
                </p>
                <button
                  type="button"
                  onClick={() => void runComparison()}
                  className="mt-4 rounded-xl bg-[#0f1114] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-black/80"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {/* 3. Idle Preview State */}
            {compareStatus === "idle" ? (
              <div className="relative z-10 flex min-h-[360px] flex-1 flex-col items-center justify-center border border-dashed border-black/20 bg-transparent p-8 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#c9a84c]/15 text-[#8a6a12]">
                  <CompareIcon className="h-7 w-7" />
                </div>
                <p className="text-[11px] font-bold tracking-[0.18em] text-[#7a5c28] uppercase">
                  Side-by-side Intelligence
                </p>
                <h3 className="mt-1 text-[22px] font-bold tracking-tight text-[#0f1114]">
                  Comparison Results
                </h3>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#5b6270]">
                  Select developments from the left block and click{" "}
                  <strong className="text-[#0f1114]">Compare now</strong> to view an in-depth
                  side-by-side analysis of pricing, connectivity, approvals, and growth.
                </p>

                {/* The four capability cards.

                    **The icon is a tile, not a glyph inside the title.** The
                    original was `💰 Pricing & Rates` on one line, which put
                    the glyph on the text baseline: it rendered at the 12px
                    bold weight, sat optically low against the cap height, and
                    made all four titles begin at a different x depending on
                    how wide the glyph happened to be. An `h-8 w-8` tile puts
                    every title on the same line and rhymes with the
                    `CompareIcon` tile directly above.

                    **`h-[18px]` inside an `h-8 w-8` tile.** 16px reads thin
                    against a 32px box; 20px crowds the border. 18px is roughly
                    what the 15px emoji was contributing, so the tile reads at
                    the same density it did before — the change is in *what* the
                    glyph is, not in how loud it is.

                    The tile sets no font size: the icon is an SVG sized purely
                    by `className` and coloured by `currentColor`, so neither a
                    platform font nor an emoji presentation applies.

                    **The gold is a wash, not the solid accent.**
                    `bg-[#c9a84c]/15` is the same tile the `CompareIcon` above
                    uses, so the five read as a set. Four *solid* gold tiles
                    would spend the section's only accent on decoration and
                    compete with "Run Comparison" below, which is the one gold
                    element here that is an action.

                    `items-start` on the card and `mt-1` under the title, so a
                    two-line body hangs off the title instead of pushing the
                    tile down — with `items-center` the icon would drift lower
                    on the cards whose body wraps and sit high on the ones
                    whose body does not.

                    `line-clamp-2` bounds the height at two lines. The idle
                    card lives in a `min-h-[360px] flex-1` box inside a
                    section capped at `104dvh`, so four cards each running to
                    three lines would push the copy under the CTA and the
                    section's `overflow-hidden` would clip it.

                    `max-w-xl` rather than the old `max-w-lg`: the column is
                    544px wide at `lg`, so the old cap was already inert
                    there, and at `xl` the wider cap buys the cards enough
                    measure that most bodies fit two lines instead of three. */}
                <div className="mt-6 grid w-full max-w-xl grid-cols-2 gap-2.5 text-left">
                  {FEATURE_HINTS.map(({ icon: Icon, title, body }) => (
                    <div
                      key={title}
                      className="flex items-start gap-2.5 rounded-xl border border-black/10 bg-white/80 p-3 shadow-xs"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#c9a84c]/25 bg-[#c9a84c]/15 text-[#8a6a12]">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[12px] leading-tight font-bold text-[#0f1114]">
                          {title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-[1.4] text-[#5b6270]">
                          {body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedIds.length >= COMPARE_MIN_IDS ? (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <p className="text-[12px] font-semibold text-[#8a6a12]">
                      ✓ {selectedIds.length} properties selected and ready to compare
                    </p>
                    <button
                      type="button"
                      onClick={() => void runComparison()}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#c9a84c] px-6 py-2.5 text-[11px] font-bold tracking-[0.14em] text-[#0f1114] uppercase shadow-md transition hover:bg-[#d4b57e]"
                    >
                      <span>Run Comparison</span>
                      <ArrowIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="mt-6 text-[12px] font-medium text-[#7a5c28]">
                    {selectedIds.length === 0
                      ? "← Click any property card on the left to start"
                      : "← Pick at least 1 more development on the left"}
                  </p>
                )}
              </div>
            ) : null}

            {/* 4. Ready Comparison Results

                One dark card: header band, hairline, then the table. The
                reference puts the whole comparison on a single near-black
                surface, so the header is a band on that surface rather than a
                second white card floating above it.

                **No `rounded-2xl`, no border, no shadow.** The column is flush
                to the right, top and bottom edges of the section, and rounding
                a panel that runs to the viewport edge shows the `#eceef2`
                section surface through the corner — which reads as a clipped
                card rather than a deliberate one. The dark surface itself
                defines the edge; nothing else is needed.

                `overflow-x-clip` on the card, never `overflow-hidden`. It is
                still there to stop the table's scrollport painting past the
                card, but it rounds nothing now, and `clip` does not create a
                scrollport — so the sticky label column below resolves against
                the table's own `overflow-auto` wrapper, which is the scrollport
                it is supposed to stick inside. Under `hidden` the pinned labels
                would have resolved against a container that never scrolls. */}
            {compareStatus === "ready" && compared.length > 0 ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-x-clip bg-[#141519]">
                {/* Right Block Header. `shrink-0` — the table below is the only
                    part allowed to absorb the card's spare height. */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[rgba(242,240,234,0.08)] px-5 py-4">
                  <div>
                    <h3 className="text-[15px] font-bold tracking-tight text-[#f2f0ea]">
                      Comparison Results
                    </h3>
                    <p className="text-[12px] text-[#8a909e]">
                      Comparing <strong className="text-[#e8e6e1]">{compared.length}</strong> properties
                    </p>
                  </div>

                  {/* Category Filter Pills on Desktop */}
                  <div className="w-full flex items-center gap-1.5 overflow-x-auto pt-1 scrollbar-none">
                    <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.16em] mr-1">
                      Categories
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveCategory("all")}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition ${
                        activeCategory === "all"
                          ? "bg-[#c9a84c] text-[#0f1114]"
                          : "bg-white/8 text-[#aeb4c0] hover:bg-white/15"
                      }`}
                    >
                      All metrics
                    </button>
                    {(["overview", "location", "inventory", "growth"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setActiveCategory(cat)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition ${
                          activeCategory === cat
                            ? "bg-[#c9a84c] text-[#0f1114]"
                            : "bg-white/8 text-[#aeb4c0] hover:bg-white/15"
                        }`}
                      >
                        {GROUP_LABELS[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side-by-side Table with Sticky Metric Labels.

                    This is the part of the card that absorbs the height the
                    picker beside it forces on the grid row. Three layers do it:

                      - the scrollport is `flex-1`, so it takes all remaining
                        height rather than letting the card show bare surface;
                      - the rows are `flex-1 min-h-[56px]`, so a short table
                        spreads into that height instead of clustering at the
                        top with a void beneath it, and a long one floors at
                        56px per row and scrolls;
                      - `max-h-[92px]` stops a two- or three-row filter from
                        inflating into absurd bands. Whatever the rows cannot
                        use falls through to the availability row, then to the
                        pinned CTA footer.

                    `min-w-max` on the inner column gives every row a containing
                    block as wide as the widest one, so the sticky label column
                    and the per-property cells stay on one shared track.
                    `overflow-auto` rather than `overflow-x-auto`: the rows grow
                    *and* scroll, so both axes need to be scrollable. */}
                <div className="ila-search-scroll flex min-h-0 flex-1 flex-col overflow-auto">
                  <div className="flex min-w-max flex-1 flex-col">
                    <div className="flex shrink-0 border-b border-[rgba(242,240,234,0.08)]">
                      <div className="sticky left-0 z-20 flex w-52 shrink-0 items-center border-r border-[rgba(242,240,234,0.08)] bg-[#141519] px-4 py-4 text-[12px] font-medium text-[#8a909e]">
                        Development
                      </div>
                      {compared.map((property) => {
                        const isTop = bestMatchId === property.property_id;
                        const locality = property.metrics.locality ?? property.metrics.location;

                        return (
                          <div
                            key={property.property_id}
                            className={`w-64 shrink-0 border-r border-[rgba(242,240,234,0.08)] px-4 py-4 ${
                              isTop ? "bg-[rgba(201,168,76,0.08)]" : ""
                            }`}
                          >
                            {/* The micro-label carries both the state and the
                                reason for it, so it stays "Best match" / "Pinned"
                                with no icon — the gold alone is not the claim. */}
                            <p
                              className={`text-[10px] font-bold tracking-[0.14em] uppercase ${
                                isTop ? "text-[#c9a84c]" : "text-[#6b7280]"
                              }`}
                            >
                              {isTop ? "Best match" : "Pinned"}
                            </p>
                            <h4 className="mt-1 line-clamp-2 text-[15px] font-bold tracking-tight text-[#f2f0ea]">
                              {property.name}
                            </h4>
                            {locality ? (
                              <p className="mt-0.5 truncate text-[12px] text-[#8a909e]">
                                {locality}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Rows only, no group band. `visibleRows` keeps the canonical group order
                        and the backend order inside each group; the grouping
                        itself is untouched, since it is still what the category
                        pills filter on and what `bestMatchId` tallies. */}
                    {visibleRows.map(({ row, spec }) => (
                        <div
                          key={row.key}
                          className="flex max-h-[92px] min-h-[56px] flex-1 border-b border-[rgba(242,240,234,0.08)]"
                        >
                          <div className="sticky left-0 z-10 flex w-52 shrink-0 items-center border-r border-[rgba(242,240,234,0.08)] bg-[#141519] px-4 text-[12px] font-medium text-[#8a909e]">
                            {spec.label}
                          </div>

                          {compared.map((property) => {
                            const raw = row.values?.[property.property_id] ?? null;
                            const isBest = row.best_property_id === property.property_id;
                            const missing = raw === null || raw === undefined || raw === "";
                            const score =
                              !missing && SCORE_METRICS.has(row.key) && typeof raw === "number"
                                ? raw
                                : null;
                            const verified =
                              !missing &&
                              row.key === "approval_status" &&
                              typeof raw === "string" &&
                              /rera/i.test(raw);

                            return (
                              /* `min-h-[56px]` and `justify-center` on a column
                                 rather than `items-center` on a row: the score
                                 bar and the RERA tick need a second line under
                                 the number, which a single-line centred cell
                                 could not give. */
                              <div
                                key={property.property_id}
                                className={`flex min-h-[56px] w-64 shrink-0 flex-col justify-center border-r border-[rgba(242,240,234,0.08)] px-4 ${
                                  isBest && !missing ? "bg-[rgba(201,168,76,0.05)]" : ""
                                }`}
                              >
                                {/* Gold text is the whole "best" signal. A pill
                                    beside it would be a second, louder mark for
                                    the same fact. */}
                                <span
                                  className={`text-[15px] tabular-nums ${
                                    missing
                                      ? "text-[12px] text-[#6b7280]"
                                      : isBest
                                        ? "font-bold text-[#c9a84c]"
                                        : "font-semibold text-[#e8e6e1]"
                                  }`}
                                >
                                  {formatValue(raw, spec)}
                                </span>

                                {score !== null ? (
                                  /* `aria-hidden`: the number above it is the
                                     accessible value. */
                                  <div
                                    aria-hidden="true"
                                    className="mt-2 h-[3px] w-full max-w-[180px] overflow-hidden rounded-full bg-white/10"
                                  >
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isBest ? "bg-[#c9a84c]" : "bg-[#8a8f98]"
                                      }`}
                                      style={{
                                        width: `${Math.max(0, Math.min(100, score))}%`,
                                      }}
                                    />
                                  </div>
                                ) : null}

                                {verified ? (
                                  <p className="mt-1.5 text-[11px] font-semibold text-[#c9a84c]">
                                    <span>&#10003;</span> RERA Registered
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ))}

                    {/* A category pill can land on a group the backend returned
                        nothing for. Say so rather than rendering a header row
                        over an empty body. */}
                    {visibleRows.length === 0 ? (
                      <div className="flex flex-1 items-center border-b border-[rgba(242,240,234,0.08)] px-4 py-6 text-[12px] text-[#8a909e]">
                        No metrics were returned for this category.
                      </div>
                    ) : null}

                    {/* Availability row — the adaptive part.

                        A row like every other one, on the same `w-52` + `w-64`
                        track, so it reads as part of the table rather than a
                        footer bolted under it. It takes whatever height the
                        metric rows above could not use, which is what fills the
                        card when the backend returns few metrics or a category
                        pill narrows to a handful.

                        It reports only what arrived and what did not. Nothing is
                        substituted for a missing value, and no score is inferred
                        from a partial row — the count is a tally of the visible
                        rows, not a quality score.

                        The bar is `#8a8f98`, not gold. Unlike the score bars,
                        which mark a row winner, this marks a data gap, and gold
                        is reserved for the former. */}
                    {showAvailability ? (
                      <div className="flex max-h-[160px] min-h-[64px] flex-1 border-b border-[rgba(242,240,234,0.08)]">
                        <div className="sticky left-0 z-10 flex w-52 shrink-0 items-center border-r border-[rgba(242,240,234,0.08)] bg-[#141519] px-4 text-[12px] font-medium text-[#8a909e]">
                          Data availability
                        </div>

                        {availability.map(({ property, total, available, missing }) => {
                          const percent = total === 0 ? 0 : (available / total) * 100;
                          const complete = missing.length === 0;

                          return (
                            <div
                              key={property.property_id}
                              className="flex min-h-[64px] w-64 shrink-0 flex-col justify-center gap-1.5 border-r border-[rgba(242,240,234,0.08)] px-4"
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-[11px] text-[#8a909e]">
                                  {property.name}
                                </span>
                                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#e8e6e1]">
                                  {available}
                                  <span className="text-[#6b7280]">/{total}</span>
                                </span>
                              </div>

                              {/* A true proportion — both terms are counted
                                  integers from the rows above. */}
                              <div
                                aria-hidden="true"
                                className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
                              >
                                <div
                                  className="h-full rounded-full bg-[#8a8f98] transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              <p className="line-clamp-2 text-[10px] text-[#6b7280]">
                                {complete
                                  ? "Every metric returned a value"
                                  : `Missing ${missing.join(", ")}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {/* One CTA per column, on the same track as the columns so each button travels
                        with its own property. `min-h-11` keeps a 44px touch
                        target under a 13px label, and `max-w-[220px]` stops the
                        text running the full column width on a wide screen.
                        `shrink-0` pins it to the card floor so the bottom edge
                        stays put however many rows are above it. */}
                    <div className="flex shrink-0 bg-[#141519] px-4 py-5">
                      <div className="sticky left-0 z-10 w-52 shrink-0 bg-[#141519]" />
                      {compared.map((property) => (
                        <div key={property.property_id} className="w-64 shrink-0 px-4">
                          <Link
                            href={`/properties/${property.property_id}`}
                            className="inline-flex min-h-11 max-w-[220px] w-full items-center justify-center rounded-xl bg-[#c9a84c] px-4 text-[13px] font-semibold text-[#0f1114] transition hover:bg-[#d4b57e]"
                          >
                            Enquire on {property.name}
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {compareStatus === "ready" && compared.length === 0 ? (
              <p className="text-sm text-[#5b6270]">
                No comparable properties were returned for this selection.
              </p>
            ) : null}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE & TABLET FLOW (below lg: <1024px)                 */}
        {/* ======================================================== */}
        <div className="block lg:hidden">
          {/* Card container: rounded corners, subtle border, and 20px padding on mobile. */}
          <div className="w-full rounded-2xl border border-black/10 bg-[#f7f8fa] px-5 py-4 sm:bg-white/80 sm:px-5 sm:py-5">
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

            {listStatus === "ready" && properties.length > 0 ? (
              <ul className="-mr-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pr-5 pt-3 pb-2 scrollbar-none sm:mr-0 sm:gap-3.5 sm:overflow-x-visible sm:pr-0 sm:pt-0 sm:grid sm:grid-cols-2 md:grid-cols-3">
                {properties.map((property) => {
                  const selected = selectedSet.has(property.id);
                  const blocked = !selected && atMax;
                  const order = selectedIds.indexOf(property.id);

                  return (
                    <li
                      key={property.id}
                      className="w-[76vw] max-w-[290px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:shrink"
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
                        {property.cover_url ? (
                          <div
                            aria-hidden
                            className="absolute inset-0 z-0 overflow-hidden rounded-2xl"
                          >
                            <Image
                              src={property.cover_url}
                              alt=""
                              fill
                              sizes="(min-width: 640px) 42vw, 290px"
                              unoptimized
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                              className="object-cover"
                            />
                          </div>
                        ) : null}

                        <div
                          aria-hidden
                          className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-linear-to-t from-black/90 via-black/62 to-black/45"
                        />

                        <div className="relative z-10 flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-semibold tracking-[0.1em] text-white uppercase">
                              {property.property_type ?? "Development"}
                            </span>

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

                          {locationNames[property.location_id ?? ""] ? (
                            <p className="mt-1 truncate text-[12px] text-white/70">
                              {locationNames[property.location_id ?? ""]}
                            </p>
                          ) : null}

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

            {/* Selection count, clear, and compare action */}
            <div className={actionRowClass}>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-[#5b6270] uppercase">
                  {selectedIds.length === 0
                    ? `Select at least ${COMPARE_MIN_IDS} to compare`
                    : selectedIds.length === 1
                      ? "Select 1 more to compare"
                      : `${selectedIds.length} of ${COMPARE_MAX_IDS} selected`}
                </p>

                {selectedIds.length > 0 ? (
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

          {/* Error Line */}
          {compareError ? (
            <p className="mt-6 text-sm text-[#5b6270]">{compareError}</p>
          ) : null}

          {/* MOBILE LAUNCHER: below `sm` the comparison table is not in the page
              flow at all — it lives in the full-screen dialog. This card is what
              the visitor sees when the dialog is closed: the state badge, a line
              about what the comparison holds, the top match, and the way back
              in.

              `p-5` matches the section's own 20px mobile gutter, so the card's
              content edge is the same line as the heading, the property
              carousel and the Compare button above it. The badge row is
              `items-center` rather than `items-start` so its two labels share
              one optical line, and the count is `shrink-0` so it cannot be
              pushed around by a long development name in the match row below. */}
          {compareStatus === "ready" && compared.length > 0 ? (
            <div className="mt-6 block sm:hidden">
              <div className="overflow-hidden rounded-2xl border border-[#c9a84c]/30 bg-[#16181d] p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10 px-3 py-1 text-[11px] font-semibold text-[#c9a84c]">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c9a84c] opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#c9a84c]" />
                    </span>
                    Comparison ready
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-white/50">
                    {compared.length} developments
                  </span>
                </div>

                <h3 className="mt-4 text-[18px] leading-[1.25] font-bold tracking-tight text-white">
                  Side-by-side comparison is ready
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                  Price, connectivity, approvals, inventory and growth, lined up
                  one row per metric and one column per development.
                </p>

                {bestMatchProperty ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-[0.14em] text-[#c9a84c] uppercase">
                        Top overall match
                      </p>
                      <p className="mt-0.5 truncate text-[13px] font-bold text-white">
                        {bestMatchProperty.name}
                      </p>
                    </div>
                    <Link
                      href={`/properties/${bestMatchProperty.property_id}`}
                      className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-white/10 px-3 text-[12px] font-semibold text-white transition hover:bg-white/20"
                    >
                      View
                    </Link>
                  </div>
                ) : null}

                {/* `min-h-12` so the target is 48px rather than the 32px an
                    11px label alone would give, and "table" rather than
                    "popup" because the destination is now a full-screen dialog
                    with nothing behind it to pop over. */}
                <button
                  type="button"
                  onClick={() => setMobileModalOpen(true)}
                  className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c9a84c] text-[12px] font-bold tracking-[0.12em] text-[#0f1114] uppercase shadow-[0_8px_20px_rgba(201,168,76,0.3)] transition hover:bg-[#d4b57e]"
                >
                  <span>Open comparison table</span>
                  <ArrowIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {/* TABLET INLINE VIEW: sm to lg */}
          {compareStatus === "ready" && compared.length > 0 ? (
            <div className="mt-8 hidden sm:block overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
              <div className="overflow-x-auto ila-search-scroll">
                <div className="flex border-b border-black/10 bg-[#f8f9fb]">
                  <div className="w-52 shrink-0 p-5 font-bold text-[12px] uppercase tracking-wider text-[#4a5060] flex items-center">
                    Development
                  </div>
                  {compared.map((property) => {
                    const isTop = bestMatchId === property.property_id;
                    const item = propertyMap.get(property.property_id);
                    const locality = property.metrics.locality ?? property.metrics.location;

                    return (
                      <div
                        key={property.property_id}
                        className={`w-64 shrink-0 border-l border-black/10 p-5 ${
                          isTop ? "bg-[#fdf6e3]/70" : "bg-white"
                        }`}
                      >
                        {item?.cover_url ? (
                          <div className="relative mb-3 h-28 w-full overflow-hidden rounded-xl bg-black/10">
                            <Image
                              src={item.cover_url}
                              alt={property.name}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : null}

                        <p
                          className={`text-[10px] font-bold tracking-[0.14em] uppercase ${
                            isTop ? "text-[#8a6a12]" : "text-[#6b7280]"
                          }`}
                        >
                          {isTop ? "★ Best match" : "Pinned"}
                        </p>
                        <h4 className="mt-1 line-clamp-2 text-[15px] font-bold tracking-tight text-[#0f1114]">
                          {property.name}
                        </h4>
                        {locality ? (
                          <p className="mt-0.5 truncate text-[12px] text-[#5b6270]">
                            {locality}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[15px] font-bold text-[#8a6a12]">
                          {item?.price_label ??
                            (typeof property.metrics.price === "number"
                              ? formatPrice(property.metrics.price)
                              : "Price on request")}
                        </p>

                        <Link
                          href={`/properties/${property.property_id}`}
                          className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl border border-black/15 bg-white text-[12px] font-semibold text-[#0f1114] transition hover:border-[#c9a84c] hover:bg-[#c9a84c]/10"
                        >
                          View property
                        </Link>
                      </div>
                    );
                  })}
                </div>

                {visibleRows
                  .map(({ row, spec }) => (
                    <div
                      key={row.key}
                      className="flex border-b border-black/5 hover:bg-black/[0.015] transition-colors"
                    >
                      <div className="w-52 shrink-0 p-5 text-[13px] font-semibold text-[#3d4450]">
                        {spec.label}
                      </div>

                      {compared.map((property) => {
                        const raw = row.values?.[property.property_id] ?? null;
                        const isBest = row.best_property_id === property.property_id;
                        const missing = raw === null || raw === undefined || raw === "";
                        const score =
                          !missing && SCORE_METRICS.has(row.key) && typeof raw === "number"
                            ? raw
                            : null;
                        const verified =
                          !missing &&
                          row.key === "approval_status" &&
                          typeof raw === "string" &&
                          /rera/i.test(raw);

                        return (
                          <div
                            key={property.property_id}
                            className={`w-64 shrink-0 border-l border-black/10 p-5 ${
                              isBest && !missing ? "bg-[#fbf3dc]/50" : ""
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[14px] tabular-nums ${
                                  missing
                                    ? "text-[12px] text-[#6b7280]"
                                    : isBest
                                      ? "font-bold text-[#0f1114]"
                                      : "font-medium text-[#3d4450]"
                                }`}
                              >
                                {formatValue(raw, spec)}
                              </span>
                              {isBest && !missing ? (
                                <span className="rounded-md bg-[#8a6a12]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#8a6a12]">
                                  Best
                                </span>
                              ) : null}
                            </div>

                            {score !== null ? (
                              <div className="mt-2 h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-black/10">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isBest ? "bg-[#c9a84c]" : "bg-[#8a8f98]"
                                  }`}
                                  style={{
                                    width: `${Math.max(0, Math.min(100, score))}%`,
                                  }}
                                />
                              </div>
                            ) : null}

                            {verified ? (
                              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                <span>&#10003;</span> RERA Registered
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                <div className="flex bg-[#f8f9fb] p-5">
                  <div className="w-52 shrink-0" />
                  {compared.map((property) => (
                    <div key={property.property_id} className="w-64 shrink-0 border-l border-black/10 px-5">
                      <Link
                        href={`/properties/${property.property_id}`}
                        className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#c9a84c] px-4 text-[12px] font-bold text-[#0f1114] uppercase tracking-wider shadow-sm transition hover:bg-[#d4b57e]"
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
            <p className="mt-4 hidden text-[12px] font-semibold tracking-[0.04em] text-[#5b6270] sm:block">
              Shareable link ·{" "}
              <span className="font-normal break-all text-[#3d4450]">
                {result.share_url}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* MOBILE FULL-SCREEN COMPARISON DIALOG (below lg: <1024px)

          **Full screen, square, flush on all four edges.** It was a 94vh bottom
          sheet: `justify-end` on the wrapper, `h-[94vh] max-h-[94vh]` with
          `rounded-t-[26px]` on the panel, a `border-t border-white/15` to read
          as a lid, and a `bg-black/75 backdrop-blur-sm` button behind it. A
          full-screen dialog has no sheet to peek over, so all of that goes:
          `inset-0`, no rounding, no lid, no border, and **no backdrop at all** —
          an opaque surface over the entire viewport has nothing behind it to tap
          to dismiss. Escape and the close button remain.

          **No left/right padding on the panel itself.** It carries no `px-*`, no
          `mx-*` and no `max-w-*`, so the table runs to both viewport edges
          exactly as the desktop card runs to the right edge of the section.
          Spacing moved into the blocks that need it: the header band and the
          share bar take `px-4`, and the table's own cells take `px-3`. That puts
          the header title, the metric captions and the values on three
          near-parallel 12-16px lines instead of on the three unrelated indents
          the sheet had.

          `lg:hidden` is load-bearing: `runComparison` opens the dialog on any
          viewport under 1024px, and above `lg` the desktop card is the
          comparison surface. */}
      {mobileModalOpen && compared.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Property comparison results"
          className="ila-compare-modal fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#141519] text-white"
        >
          {/* Header band.

              `shrink-0`: it holds the title, the top-match line, the close
              control and the category pills, and every one of those has to stay
              reachable while the table scrolls in both axes. It is also the only
              element that reaches the status bar, which is why it carries the
              safe-area inset the bottom sheet never needed.

              `pt-[calc(env(safe-area-inset-top)+0.75rem)]` rather than a bare
              `env()` inset: the root layout sets no `viewport-fit=cover`, so
              `env()` resolves to `0px` and a bare inset would leave the title
              flush against the screen edge on every current browser. The `calc`
              keeps a 12px floor and adds the inset where it is honoured — the
              same shape MapSection's sheet uses for its bottom inset.

              Note for whoever edits this comment next: never leave a
              half-written arbitrary-value utility in the source text. Tailwind
              scans source, not the rendered DOM, so a literal whose argument is
              an ellipsis gets picked up as a candidate and emitted into
              globals.css as invalid CSS, which fails the whole build. */}
          <div className="shrink-0 border-b border-white/10 bg-[#17191e] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* `min-w-0` on the text column so a long top-match name
                  truncates instead of pushing the close button off the band. */}
              <div className="min-w-0">
                <h3 className="text-[18px] leading-[1.25] font-bold tracking-tight text-white">
                  Comparison Results
                </h3>
                <p className="mt-1 text-[12px] leading-snug text-[#8a909e]">
                  Comparing{" "}
                  <strong className="text-[#e8e6e1]">{compared.length}</strong>{" "}
                  properties
                </p>
              </div>

              {/* 44px, not the 32px the sheet used. The sheet had a drag handle
                  as a second way out; this does not, so the close control is the
                  only visible dismissal on the surface and has to be a real
                  touch target. `border` + `bg-white/8` rather than a solid
                  `bg-white/10`, so it reads as a control against the `#17191e`
                  band rather than as a hole in it. */}
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Close comparison"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white/90 transition active:scale-95 hover:bg-white/15"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Category filter pills.

                `-mx-4 px-4` so the strip bleeds to both edges while its pills
                still start on the header's own 16px line — the same treatment
                the property carousel gets from `-mr-5 pr-5`, and the reason the
                strip can scroll left without the pills appearing to detach from
                the band. `snap-x` without `snap-mandatory`: proximity lets a
                pill settle between two stops, which matters when a category
                label is wider than half the viewport.

                `min-h-9` (36px) is the floor for a chip row — the 44px minimum
                is reserved for the close control, the per-column Enquire
                buttons and the share button, which are the actions rather than
                the filters. */}
            <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`min-h-9 shrink-0 snap-start rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition ${
                  activeCategory === "all"
                    ? "bg-[#c9a84c] text-[#0f1114]"
                    : "bg-white/10 text-white/75 active:bg-white/15"
                }`}
              >
                All metrics
              </button>
              {(["overview", "location", "inventory", "growth"] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`min-h-9 shrink-0 snap-start rounded-full px-3.5 text-[12px] font-semibold whitespace-nowrap transition ${
                    activeCategory === cat
                      ? "bg-[#c9a84c] text-[#0f1114]"
                      : "bg-white/10 text-white/75 active:bg-white/15"
                  }`}
                >
                  {GROUP_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

            {/* The table. This is the dialog's scrollport on both axes: rows go down,
                property columns go sideways.

                **One grid, not a stack of flex rows.** Every cell below belongs
                to a single `w-max grid` whose track widths are declared once in
                `gridTemplateColumns`. That is what keeps a value in row 12 in
                the same column as the value in row 3, and it is why each row is
                emitted as a `Fragment` — a row has no box of its own to carry a
                border or a height, so those live on the cells.

                **The property tracks are `minmax(0, max-content)`: a column is
                exactly as wide as its widest cell needs and no wider.** They were
                `w-[86vw]`, which on a 390px phone is 335px to hold a value like
                "3" or "₹85 L" — over 300px of empty cell to the right of every
                number, with the property name in the header the only thing that
                ever used the width. `max-content` measures the real content
                instead: the longest name, the longest formatted value, the
                score bar's own cap.

                That gives up the old "one property per swipe" guarantee, which
                is the right trade here: at content width two or three columns
                frequently fit a phone outright, and a table that fits needs no
                scrolling. Where it still overflows — long names, five
                properties — the horizontal scroll and the snapping behave
                exactly as before.

                **`116px` is repeated deliberately.** It is in the template and in
                every caption cell because it is the one measurement that has to
                be identical everywhere: it is the sticky column's width, and the
                sticky column's width is what `scroll-pl-[116px]` reserves.

                **`scroll-pl-[116px]` is what makes the sideways scroll land
                correctly.** Snapping a value cell with `snap-start` parks its
                left edge on the scrollport's left edge — which is *underneath*
                the sticky caption column, hiding the first 116px of every value.
                Scroll padding reserves exactly that column, so a snapped cell
                stops flush against the caption column instead of under it. The
                caption cell itself carries no `snap-start`, so the position that
                would hide the first property is not a stop the browser is aiming
                for; proximity snapping still lets the visitor rest anywhere.

                `snap-x` is proximity rather than mandatory: mandatory would fight
                a slow drag across a five-property table.

                `overscroll-contain` because the dialog is `fixed` over a page
                that is still in the scroll tree. Without it, a fling that reaches
                either end of the table scrolls the section behind, which reads as
                the dialog itself jumping.

                `.ila-search-scroll` rather than a bare overflow: the gold
                scrollbar is the affordance saying there is more table to the
                right, and it is the same one the desktop card's scrollport uses,
                so the two surfaces scroll the same way.

                **No group headers.** Rows come from `visibleRows`, the same
                flattened list the desktop and tablet tables render, so all three
                read identically. `groupedMetrics` still drives the category pills
                and `bestMatchId`; only the visible band is gone. */}
            <div className="ila-search-scroll min-h-0 flex-1 overflow-auto overscroll-contain scroll-pl-[116px] snap-x">
              <div
                className="grid w-max"
                style={{
                  gridTemplateColumns: `116px repeat(${compared.length}, minmax(0, max-content))`,
                }}
              >
                {/* Header band. `items-end` puts the caption on the same
                    baseline as the bottom of the three header lines beside it.
                    `min-h-[56px]` matches the metric rows below, so the band
                    does not collapse around its own three lines. */}
                <div className="sticky left-0 z-20 flex min-h-[56px] w-[116px] items-end border-r border-b border-white/10 bg-[#141519] px-3 py-3">
                  <span className="text-[10px] font-bold tracking-[0.14em] text-[#6b7280] uppercase">
                    Metric
                  </span>
                </div>

                {compared.map((property) => {
                  const isTop = bestMatchId === property.property_id;
                  const locality = property.metrics.locality ?? property.metrics.location;

                  return (
                    /* `max-w-[220px]` bounds the track. Without it a single long
                       development name, or a `truncate`d locality whose
                       max-content is its full nowrap width, would set the column
                       width for every row under it. `break-words` on the name is
                       the matching guard: `line-clamp-2` clips an overlong word
                       rather than wrapping it, so a name with no spaces would
                       otherwise be cut mid-word. */
                    <div
                      key={property.property_id}
                      className={`flex max-w-[220px] snap-start flex-col border-r border-b border-white/10 px-3 py-3 ${
                        isTop ? "bg-[rgba(201,168,76,0.08)]" : ""
                      }`}
                    >
                      {/* The same micro-label as the desktop header — it
                          carries the state and the reason for it, so it stays
                          text-only and the gold alone is never the claim. */}
                      <p
                        className={`text-[9px] font-bold tracking-[0.14em] uppercase ${
                          isTop ? "text-[#c9a84c]" : "text-[#6b7280]"
                        }`}
                      >
                        {isTop ? "Best match" : "Pinned"}
                      </p>
                      <h4 className="mt-1 line-clamp-2 break-words text-[14px] leading-[1.25] font-bold tracking-tight text-[#f2f0ea]">
                        {property.name}
                      </h4>
                      {locality ? (
                        /* `line-clamp-2`, not `truncate`. A locality is the
                           one line in this cell that routinely outruns the
                           content-sized column, and ellipsising it loses the
                           half a visitor actually reads — "Shadnagar, Hyd…".
                           Wrapping to a second line keeps all of it, and the
                           cell's `max-w-[220px]` is what stops that from
                           feeding back into the track width. */
                        <p className="mt-1 line-clamp-2 break-words text-[11px] leading-[1.3] text-[#8a909e]">
                          {locality}
                        </p>
                      ) : null}
                    </div>
                  );
                })}

                {/* Metric rows. Identical rules to the desktop table — same
                    `formatValue`, same gold-on-best, same score bars and RERA
                    ticks, same "Not available" for a null — so the two surfaces
                    cannot drift apart. Only the geometry differs: the caption
                    column is 116px rather than `w-52` because it has to share
                    the row with a phone-width value column, and the cells are
                    `flex-col justify-center` because the bar and the tick still
                    need a second line under the number.

                    The `border-b` is on the cells rather than on a row wrapper,
                    because a grid row has no element of its own to put it on.
                    `min-h-[56px]` likewise: the grid row is as tall as its
                    tallest cell, so putting it on both the caption and the
                    values floors the row rather than only the cell.

                    `max-w-[220px]` on every property cell, so the column's width
                    is decided once by the track and no individual cell can push
                    it wider. A value that does not fit wraps onto a second line
                    rather than being clipped — there is no `truncate` on any
                    value in this table. */}
                {visibleRows.map(({ row, spec }) => (
                  <Fragment key={row.key}>
                    <div className="sticky left-0 z-10 flex min-h-[56px] w-[116px] items-center border-r border-b border-white/10 bg-[#141519] px-3 text-[11px] leading-[1.3] font-medium text-[#8a909e]">
                      {spec.label}
                    </div>

                    {compared.map((property) => {
                      const raw = row.values?.[property.property_id] ?? null;
                      const isBest = row.best_property_id === property.property_id;
                      const missing = raw === null || raw === undefined || raw === "";
                      const score =
                        !missing && SCORE_METRICS.has(row.key) && typeof raw === "number"
                          ? raw
                          : null;
                      const verified =
                        !missing &&
                        row.key === "approval_status" &&
                        typeof raw === "string" &&
                        /rera/i.test(raw);

                      return (
                        <div
                          key={property.property_id}
                          className={`flex min-h-[56px] max-w-[220px] snap-start flex-col justify-center border-r border-b border-white/10 px-3 py-2.5 ${
                            isBest && !missing ? "bg-[rgba(201,168,76,0.05)]" : ""
                          }`}
                        >
                          <span
                            className={`text-[14px] tabular-nums ${
                              missing
                                ? "text-[12px] text-[#6b7280]"
                                : isBest
                                  ? "font-bold text-[#c9a84c]"
                                  : "font-semibold text-[#e8e6e1]"
                            }`}
                          >
                            {formatValue(raw, spec)}
                          </span>

                          {score !== null ? (
                            /* `aria-hidden`: the number above it is the
                               accessible value. `max-w-[120px]` rather than
                               the desktop's 180px — a 3px bar has no business
                               setting a content-sized column's width. */
                            <div
                              aria-hidden="true"
                              className="mt-2 h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-white/10"
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isBest ? "bg-[#c9a84c]" : "bg-[#8a8f98]"
                                }`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, score))}%`,
                                }}
                              />
                            </div>
                          ) : null}

                          {verified ? (
                            <p className="mt-1.5 text-[11px] font-semibold text-[#c9a84c]">
                              <span>&#10003;</span> RERA Registered
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}

                {/* A category pill can land on a group the backend returned
                    nothing for. Say so rather than leaving an empty body.
                    `col-span-full` because in a grid this line is one cell
                    across every track, not a full-width block. */}
                {visibleRows.length === 0 ? (
                  <div className="col-span-full flex min-h-[72px] items-center border-b border-white/10 px-3 text-[12px] text-[#8a909e]">
                    No metrics were returned for this category.
                  </div>
                ) : null}

                {/* Data availability — the same row the desktop and tablet
                    tables render, off the same `showAvailability` trigger and
                    the same `visibleRows` count, so narrowing the pills narrows
                    the table and the denominator together.

                    The bar is `#8a8f98`, not gold. Unlike the score bars, which
                    mark a row winner, this marks a data gap, and gold is
                    reserved for the former. */}
                {showAvailability ? (
                  <Fragment>
                    <div className="sticky left-0 z-10 flex min-h-[72px] w-[116px] items-center border-r border-b border-white/10 bg-[#141519] px-3 text-[11px] leading-[1.3] font-medium text-[#8a909e]">
                      Data availability
                    </div>

                    {availability.map(({ property, total, available, missing }) => {
                      const percent = total === 0 ? 0 : (available / total) * 100;
                      const complete = missing.length === 0;

                      return (
                        /* `max-w-[220px]` is the same bound the header cell carries, and it is
                           needed here for the same reason: this cell holds a
                           full property name, and an unbounded `line-clamp-2`
                           name's max-content is its whole string, which would
                           size this column — and every row above it — to the
                           longest name in the comparison.

                           `flex-col` rather than `justify-between`, so when the
                           name takes a second line the count moves under it
                           instead of being squeezed to a 1-digit-per-line
                           column. */
                        <div
                          key={property.property_id}
                          className="flex min-h-[72px] max-w-[220px] snap-start flex-col justify-center gap-1.5 border-r border-b border-white/10 px-3 py-2.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="line-clamp-2 break-words text-[11px] leading-[1.3] text-[#8a909e]">
                              {property.name}
                            </span>
                            <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#e8e6e1]">
                              {available}
                              <span className="text-[#6b7280]">/{total}</span>
                            </span>
                          </div>

                          {/* A true proportion — both terms are counted
                              integers from the rows above. */}
                          <div
                            aria-hidden="true"
                            className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
                          >
                            <div
                              className="h-full rounded-full bg-[#8a8f98] transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>

                          <p className="line-clamp-2 text-[10px] text-[#6b7280]">
                            {complete
                              ? "Every metric returned a value"
                              : `Missing ${missing.join(", ")}`}
                          </p>
                        </div>
                      );
                    })}
                  </Fragment>
                ) : null}

                {/* One CTA per column, on the same track as the columns, so
                    each button travels with its own property — desktop parity,
                    and the reason the dialog needs no separate pinned action
                    bar.

                    **The label is `Enquire`, not `Enquire on {name}`** — the
                    only reason desktop can afford the long form is its fixed
                    `w-64` column. Here the column is `max-content`, and a
                    `truncate`d label is `white-space: nowrap`, so its
                    max-content is the full string: every column would be sized
                    by its CTA rather than by its data. The name is directly
                    above in the header, and `aria-label` carries the full
                    phrasing for a screen reader.

                    `min-h-11` keeps a 44px touch target under a 12px label. The
                    caption spacer mirrors the caption column's width so this
                    row's cells line up with every row above it. */}
                <div className="sticky left-0 z-10 w-[116px] bg-[#141519] py-4" />
                {compared.map((property) => (
                  <div
                    key={property.property_id}
                    className="flex snap-start items-center bg-[#141519] px-3 py-4"
                  >
                    <Link
                      href={`/properties/${property.property_id}`}
                      aria-label={`Enquire on ${property.name}`}
                      className="flex min-h-11 w-full items-center justify-center rounded-xl bg-[#c9a84c] px-3 text-[12px] font-semibold text-[#0f1114] transition hover:bg-[#d4b57e]"
                    >
                      Enquire
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Share bar. `shrink-0`, and the only thing below the table. A sibling
            of the scrollport, not a child of it — it sits at the dialog root's own
            indent, alongside the header band and the table.

            Rendered only when the backend returned a share URL — otherwise it
            would be a strip of `#17191e` pinned under the table with no content
            in it, which on a full-screen dialog reads as a broken layout rather
            than as an absent feature.

            `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]` for the home
            indicator: a bottom sheet stopped short of it by construction, a
            full-screen dialog runs straight into it. Same `calc` floor and same
            reasoning as the header's top inset.

            The label doubles as the confirmation. A toast would need a timer, an
            icon and its own stacking context; the button already owns
            `copiedShare`, so the state lands where the tap was. `min-h-11`
            because this is the only control in the bar. */}
        </div>
      ) : null}
    </section>
  );
}
