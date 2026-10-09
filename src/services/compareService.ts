/**
 * Property comparison.
 *
 * The backend exposes the same comparison builder through three routes:
 *
 *   GET  /api/properties/compare   stateless; no visitor identity, no history
 *   POST /api/favorites/compare    visitor-aware; records property_comparisons
 *   GET  /api/favorites/compare    shareable replay of the above
 *
 * All three return the same `properties` + grouped `metrics` payload; the
 * favorites routes add `items`, `total` and `share_url`.
 *
 * This module exposes the visitor-aware POST for the compare tray, because the
 * comparison should be attributed to the same anonymous visitor as favorites,
 * shortlists and leads. See `comparePropertiesStateless` for the read-only case.
 *
 * Source of truth for the response shape: src/components/explanational-file
 */

import { getVisitorCode } from "@/lib/visitor";
import { whenVisitorReady } from "@/lib/visitorReady";
import { apiFetch } from "@/services/apiClient";

/** The backend accepts 2-5 distinct ids; fewer or more is a 422. */
export const COMPARE_MIN_IDS = 2;
export const COMPARE_MAX_IDS = 5;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The route parses ids as UUIDs, so a slug is rejected before the request. */
export function isPropertyUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Normalizes a candidate id list into something the backend will accept.
 *
 * Returns the distinct ids in the order given, because the comparison preserves
 * the requested order in `data.properties` and the table renders columns in it.
 */
export function normalizeCompareIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const id of ids) {
    if (!isPropertyUuid(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }

  return out;
}

/** True when the id list satisfies the backend's 2-5 distinct id contract. */
export function canCompare(ids: readonly string[]): boolean {
  return ids.length >= COMPARE_MIN_IDS && ids.length <= COMPARE_MAX_IDS;
}

/** Per-property metric bag. Every field is nullable — absent is not zero. */
export type ComparisonMetrics = {
  price: number | null;
  price_per_sqft: number | null;
  area_sqft: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string | null;
  location: string | null;
  location_id: string | null;
  locality: string | null;
  address: string | null;
  connectivity_score: number | null;
  life_stage_fit: Record<string, number> | null;
  schools_nearby: number | null;
  hospitals_nearby: number | null;
  parks_nearby: number | null;
  metro_distance_km: number | null;
  possession: string | null;
  availability: boolean | null;
  property_status: string | null;
  available_inventory: number | null;
  approval_status: string | null;
  amenities_count: number | null;
  builder: string | null;
  estimated_appreciation: number | null;
  maintenance_cost: number | null;
};

/** One compared property. The table reads values from the grouped metrics. */
export type ComparisonProperty = {
  property_id: string;
  name: string;
  metrics: ComparisonMetrics;
};

/** Compact row, returned by the favorites routes only. */
export type ComparisonItem = {
  id: string;
  name: string;
  property_type: string | null;
  price_from: number | null;
  status: string | null;
};

/** Which direction wins a metric. Used only to explain the highlight. */
export type MetricDirection = "LOWER" | "HIGHER";

/**
 * One row of the comparison table.
 *
 * `values` is keyed by property id — never read it by column position, because
 * a property missing a value still occupies its column.
 */
export type ComparisonMetricRow = {
  key: string;
  better: MetricDirection | null;
  values: Record<string, number | string | boolean | null>;
  best_property_id: string | null;
};

export type ComparisonResult = {
  /** Full comparison model; drives the table. Backend order is preserved. */
  properties: ComparisonProperty[];
  /** Compact cards. Only the favorites routes populate this. */
  items?: ComparisonItem[];
  total?: number;
  /** Use this verbatim rather than rebuilding a route. */
  share_url?: string | null;
  currency: string | null;
  area_unit: string | null;
  metrics: ComparisonMetricRow[];
};

type CompareResponse = {
  success?: boolean;
  data?: Partial<ComparisonResult> | null;
};

/**
 * Reads a property's own metric value.
 *
 * Grouped rows flatten `life_stage_fit.<persona>` into the key space, so the
 * dotted form is checked first; the nested object is the fallback.
 */
export function metricValue(
  metrics: ComparisonMetrics | undefined | null,
  key: string,
): number | string | boolean | null {
  if (!metrics) return null;

  const direct = metrics[key as keyof ComparisonMetrics];
  if (direct !== undefined && typeof direct !== "object") return direct;

  const [group, persona] = key.split(".");
  if (!persona) return null;
  const nested = metrics[group as keyof ComparisonMetrics];
  if (!nested || typeof nested !== "object") return null;

  const value = (nested as Record<string, number>)[persona];
  return value === undefined ? null : value;
}

/**
 * Runs a visitor-aware comparison.
 *
 * Identifies the visitor (cookie, else the created code), records the
 * comparison, and returns the shared comparison model.
 */
export async function compareProperties(
  propertyIds: readonly string[],
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  const ids = normalizeCompareIds(propertyIds);

  if (!canCompare(ids)) {
    throw new Error(
      `Comparison needs ${COMPARE_MIN_IDS}-${COMPARE_MAX_IDS} distinct properties, got ${ids.length}`,
    );
  }

  // The endpoint is public, so a missing visitor code is not fatal — the
  // backend will identify or create one. Only send the header if we have it.
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  const response = await apiFetch<CompareResponse>("/api/favorites/compare", {
    method: "POST",
    // Keeps the HTTP-only visitor cookie flowing. The backend only sets a
    // cookie-safe response when credentials are included.
    credentials: "include",
    headers: visitorCode ? { "X-Visitor-Code": visitorCode } : {},
    body: { property_ids: ids },
    signal,
  });

  return normalizeResult(response?.data, ids);
}

/**
 * Stateless comparison: no visitor identity, no history, no event.
 *
 * Use for a shareable or read-only view where the action should not be
 * attributed to anyone.
 */
export async function comparePropertiesStateless(
  propertyIds: readonly string[],
  signal?: AbortSignal,
): Promise<ComparisonResult> {
  const ids = normalizeCompareIds(propertyIds);

  if (!canCompare(ids)) {
    throw new Error(
      `Comparison needs ${COMPARE_MIN_IDS}-${COMPARE_MAX_IDS} distinct properties, got ${ids.length}`,
    );
  }

  const query = encodeURIComponent(ids.join(","));
  const response = await apiFetch<CompareResponse>(
    `/api/properties/compare?property_ids=${query}`,
    { signal },
  );

  return normalizeResult(response?.data, ids);
}

/**
 * Fills the response into a shape the table can render unconditionally.
 *
 * The route preserves the requested order, but the ids are re-applied here so a
 * backend that reorders cannot silently misalign the columns against the
 * values map, which is always keyed by id.
 */
function normalizeResult(
  data: Partial<ComparisonResult> | null | undefined,
  requestedIds: string[],
): ComparisonResult {
  const properties = Array.isArray(data?.properties) ? data.properties : [];

  const byId = new Map(properties.map((p) => [p.property_id, p]));
  const ordered = requestedIds
    .map((id) => byId.get(id))
    .filter((p): p is ComparisonProperty => Boolean(p));

  return {
    properties: ordered,
    items: Array.isArray(data?.items) ? data.items : [],
    total: typeof data?.total === "number" ? data.total : ordered.length,
    share_url: data?.share_url ?? null,
    currency: data?.currency ?? "INR",
    area_unit: data?.area_unit ?? null,
    metrics: Array.isArray(data?.metrics) ? data.metrics : [],
  };
}