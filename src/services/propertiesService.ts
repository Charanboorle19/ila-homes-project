import { apiFetch } from "@/services/apiClient";

/**
 * Properties belonging to a locality, via
 * GET /api/properties?location_slug=<slug>&page=<n>&per_page=<n>
 *
 * Fetched from the browser via apiFetch so the tenant header is attached.
 */

export type PropertySummary = {
  id: string;
  location_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  property_type: string | null;
  price: number | null;
  cover_url: string | null;
};

type PropertiesResponse = {
  success?: boolean;
  data?: {
    items?: PropertySummary[];
    total?: number;
    page?: number;
    per_page?: number;
  };
};

export async function fetchPropertiesByLocation(options: {
  locationSlug: string;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<{
  items: PropertySummary[];
  total: number;
  page: number;
  perPage: number;
}> {
  const { locationSlug } = options;

  if (!locationSlug) {
    return { items: [], total: 0, page: 1, perPage: 10 };
  }

  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.max(1, options.perPage ?? 10);

  const query = new URLSearchParams({
    location_slug: locationSlug,
    page: String(page),
    per_page: String(perPage),
  });

  const response = await apiFetch<PropertiesResponse>(
    `/api/properties?${query.toString()}`,
    { signal: options.signal },
  );

  return {
    items: response?.data?.items ?? [],
    total: response?.data?.total ?? 0,
    page: response?.data?.page ?? page,
    perPage: response?.data?.per_page ?? perPage,
  };
}

/**
 * A single property, via GET /api/properties/{id}.
 *
 * The path segment must be the UUID; passing the slug returns
 * VALIDATION_ERROR ("Invalid UUID for property_id").
 *
 * Fetched from the browser via apiFetch so the tenant header is attached.
 * Only the fields this app renders are typed; the API returns ~90.
 *
 * Money fields are typed as `number | string` because the API is not
 * consistent: `price` arrives as a number while `minimum_price` and
 * `target_price` arrive as strings ("1197000.00"). Use the numeric coercion in
 * propertyMapper rather than trusting either shape.
 */
export type ApiProperty = {
  id: string;
  location_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  property_type: string | null;
  listing_type: string | null;
  configuration: string | null;
  price: number | null;
  minimum_price: number | string | null;
  target_price: number | string | null;
  price_label: string | null;
  price_per_sqft: number | null;
  negotiable: boolean | null;
  total_inventory: number | null;
  available_inventory: number | null;
  sold_inventory: number | null;
  availability_status: string | null;
  status: string | null;
  featured: boolean | null;
  address: string | null;
  locality: string | null;
  landmark: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Plot area in acres. */
  area: number | null;
  facing: string | null;
  amenities: string[] | null;
  connectivity_score: number | null;
  rera_registered: boolean | null;
  rera_number: string | null;
  approval_details: string | null;
  project_theme: string | null;
  possession_status: string | null;
  possession_date: string | null;
  cover_url: string | null;
  video_url: string | null;
  floor_plan_url: string | null;
  /** Extent of the master plan, in WGS84 degrees. Null until a survey exists. */
  property_layout_cords: {
    east: number;
    west: number;
    north: number;
    south: number;
  } | null;
  metadata: Record<string, unknown> | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPropertyUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export async function fetchPropertyById(
  id: string,
  signal?: AbortSignal,
): Promise<ApiProperty> {
  if (!isPropertyUuid(id)) {
    throw new Error(`Not a property id: ${id}`);
  }

  const response = await apiFetch<{ success?: boolean; data?: ApiProperty }>(
    `/api/properties/${encodeURIComponent(id)}`,
    { signal },
  );

  if (!response?.data) {
    throw new Error("Property not found");
  }

  return response.data;
}

/**
 /**
 * Plot-level units for a property, from
 * GET /api/properties/{propertyId}/units
 *
 * The endpoint is paginated and silently clamps `limit` (verified: 62 units
 * exist, `limit=all` returns 11 with `total: 62`), so every page is walked
 * until the reported total is collected.
 *
 * The response also carries the estate's master plan: `layout_preview_url`, a
 * presigned PNG of it (`property_layout_cords` gives its extent), and the
 * older `tif_url`, the raw survey scan. The preview is preferred — it is what
 * the map draws when it is there. Both are presigned S3 objects that expire an
 * hour after they are minted. `centroid` is null on every current unit, so the
 * geometry is the only usable position source for a plot.
 */
export type PropertyUnit = {
  id: string;
  property_id: string;
  plot_number: string;
  unit_type: string | null;
  area_sq_yards: number | null;
  price: number | null;
  facing: string | null;
  status: string | null;
  centroid: { lng?: number; lat?: number } | null;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
  source: unknown;
};

/** Extent of the master-plan scan, in WGS84 degrees. */
export type PropertyLayoutCords = {
  east: number;
  west: number;
  north: number;
  south: number;
};

export type PropertyUnitsResult = {
  units: PropertyUnit[];
  /** Server-reported total, which can exceed the number of units returned. */
  total: number;
  /** Presigned PNG master-plan preview. Expires, so it is not cached long-term. */
  layoutPreviewUrl: string | null;
  /** Presigned master-plan TIFF. Expires, so it is not cached long-term. */
  tifUrl: string | null;
  layoutCords: PropertyLayoutCords | null;
};

type UnitsResponse = {
  success?: boolean;
  data?: {
    items?: PropertyUnit[];
    total?: number;
    limit?: number;
    offset?: number;
    layout_preview_url?: string | null;
    tif_url?: string | null;
    property_layout_cords?: Partial<PropertyLayoutCords> | null;
  };
};

/** Guards against a server that never advances past the first page. */
const MAX_UNIT_PAGES = 200;

function parseLayoutCords(
  value: Partial<PropertyLayoutCords> | null | undefined,
): PropertyLayoutCords | null {
  if (!value) return null;
  const { east, west, north, south } = value;
  const parts = [east, west, north, south];
  if (!parts.every((n) => typeof n === "number" && Number.isFinite(n))) {
    return null;
  }
  const cords = {
    east: east as number,
    west: west as number,
    north: north as number,
    south: south as number,
  };
  // A zero-area extent would collapse the map fit.
  if (cords.east === cords.west || cords.north === cords.south) return null;
  return cords;
}

export async function fetchPropertyUnits(
  propertyId: string,
  signal?: AbortSignal,
): Promise<PropertyUnitsResult> {
  if (!propertyId) {
    return {
      units: [],
      total: 0,
      layoutPreviewUrl: null,
      tifUrl: null,
      layoutCords: null,
    };
  }

  const units: PropertyUnit[] = [];
  const seen = new Set<string>();
  let total = 0;
  let offset = 0;
  let layoutPreviewUrl: string | null = null;
  let tifUrl: string | null = null;
  let layoutCords: PropertyLayoutCords | null = null;
  let pagesFetched = 0;

  for (let page = 0; page < MAX_UNIT_PAGES; page += 1) {
    const query = new URLSearchParams({
      limit: "all",
      offset: String(offset),
    });

    const response = await apiFetch<UnitsResponse>(
      `/api/properties/${encodeURIComponent(propertyId)}/units?${query}`,
      { signal },
    );
    if (signal?.aborted) break;

    const data = response?.data;
    const items = data?.items ?? [];

    // Layout image + geometry only arrive on the first page, but log what
    // came back: this is the call that decides whether a layout can be drawn,
    // so its shape needs to be visible when a map renders nothing.
    console.log(
      `[ILA API] GET /api/properties/${propertyId}/units — page ${page}`,
      {
        items: items.length,
        total: data?.total,
        limit: data?.limit,
        offset: data?.offset,
        layout_preview_url: data?.layout_preview_url ?? null,
        tif_url: data?.tif_url ?? null,
        property_layout_cords: data?.property_layout_cords ?? null,
        first_item: items[0]
          ? {
              plot_number: items[0].plot_number,
              status: items[0].status,
              area_sq_yards: items[0].area_sq_yards,
              geometry_type: items[0].geometry?.type ?? null,
            }
          : null,
      },
    );

    if (typeof data?.total === "number") total = data.total;
    pagesFetched = page + 1;
    layoutPreviewUrl = data?.layout_preview_url || layoutPreviewUrl;
    tifUrl = data?.tif_url || tifUrl;
    layoutCords = parseLayoutCords(data?.property_layout_cords) ?? layoutCords;

    for (const unit of items) {
      if (seen.has(unit.id)) continue;
      seen.add(unit.id);
      units.push(unit);
    }

    const serverOffset =
      typeof data?.offset === "number" ? data.offset : offset;
    const serverLimit =
      typeof data?.limit === "number" && data.limit > 0 ? data.limit : items.length;
    const nextOffset = serverOffset + serverLimit;

    // Stop on an empty or non-advancing page, or once the total is collected.
    if (items.length === 0) break;
    if (nextOffset <= serverOffset) break;
    if (total > 0 && nextOffset >= total) break;
    offset = nextOffset;
  }

  console.log(
    `[ILA API] GET /api/properties/${propertyId}/units — collected`,
    {
      pages: pagesFetched,
      units: units.length,
      total,
      has_layout_preview: Boolean(layoutPreviewUrl),
      has_layout_tif: Boolean(tifUrl),
      layout_cords: layoutCords,
    },
  );

  return { units, total, layoutPreviewUrl, tifUrl, layoutCords };
}

/**
 * Buyer-fit scoring for a property, from
 * GET /api/properties/{propertyId}/life-stage-fit
 *
 * ```json
 * { "success": true, "data": { "property_id": "…", "personas": [
 *     { "persona": "starting_a_family", "fit_percentage": 83, "reason": "…" },
 *     …
 * ] } }
 * ```
 *
 * The four persona ids line up with the LifeStageKey goals the property page
 * already renders; `lifeStageFitToMatch` does that mapping.
 */
export type ApiLifeStagePersona = {
  persona: string;
  fit_percentage: number | null;
  reason: string | null;
};

export type ApiLifeStageFit = {
  propertyId: string | null;
  personas: ApiLifeStagePersona[];
};

export async function fetchPropertyLifeStageFit(
  propertyId: string,
  signal?: AbortSignal,
): Promise<ApiLifeStageFit> {
  if (!propertyId) return { propertyId: null, personas: [] };

  const response = await apiFetch<{
    success?: boolean;
    data?: {
      property_id?: string | null;
      personas?: ApiLifeStagePersona[] | null;
    };
  }>(`/api/properties/${encodeURIComponent(propertyId)}/life-stage-fit`, {
    signal,
  });

  const data = response?.data;
  return {
    propertyId: data?.property_id ?? propertyId,
    personas: Array.isArray(data?.personas) ? data.personas : [],
  };
}

/**
 * Properties matching a filter, e.g.
 * GET /api/properties?status=ALL&page=1&per_page=100
 *
 * The list endpoint returns a trimmed record (id, location_id, name, slug,
 * description, property_type, price, cover_url) — not the ~71 fields the
 * single-property endpoint returns.
 */
export type PropertyListItem = {
  id: string;
  location_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  property_type: string | null;
  price: number | null;
  cover_url: string | null;
  /** Present on some deployments of the list endpoint; null elsewhere. */
  latitude?: number | null;
  longitude?: number | null;
};

/** A usable latitude/longitude pair for a property. */
export type PropertyAnchor = { latitude: number; longitude: number };

/**
 * Reads a valid coordinate pair off any property-shaped object. The API uses
 * null for "not geocoded", and sometimes sends strings, so both are rejected
 * rather than coerced.
 */
export function propertyAnchor(
  property: { latitude?: number | null; longitude?: number | null } | null,
): PropertyAnchor | null {
  if (!property) return null;
  const { latitude, longitude } = property;
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export async function fetchProperties(options: {
  status?: string;
  page?: number;
  perPage?: number;
  locationSlug?: string;
  signal?: AbortSignal;
}): Promise<{
  items: PropertyListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.max(1, options.perPage ?? 100);

  const query = new URLSearchParams({
    status: options.status ?? "ALL",
    page: String(page),
    per_page: String(perPage),
  });

  if (options.locationSlug) {
    query.set("location_slug", options.locationSlug);
  }

  const response = await apiFetch<{
    success?: boolean;
    data?: {
      items?: PropertyListItem[];
      total?: number;
      page?: number;
      per_page?: number;
    };
  }>(`/api/properties?${query.toString()}`, { signal: options.signal });

  const items = response?.data?.items ?? [];
  const total = response?.data?.total ?? items.length;
  const resolvedPerPage = response?.data?.per_page ?? perPage;

  return {
    items,
    total,
    page: response?.data?.page ?? page,
    perPage: resolvedPerPage,
    totalPages: Math.max(1, Math.ceil(total / resolvedPerPage)),
  };
}

/**
 * Coordinates for every listed property, so the map can pin them all.
 *
 * The list endpoint does not reliably include latitude/longitude, so anything
 * it omits is resolved with one property-detail call per missing property.
 * Those are issued a few at a time and individual failures are skipped — a
 * property without coordinates simply gets no pin.
 */
export async function fetchPropertyAnchors(
  items: PropertyListItem[],
  options: { signal?: AbortSignal; concurrency?: number } = {},
): Promise<Record<string, PropertyAnchor>> {
  const anchors: Record<string, PropertyAnchor> = {};
  const missing: string[] = [];

  for (const item of items) {
    const anchor = propertyAnchor(item);
    if (anchor) {
      anchors[item.id] = anchor;
    } else {
      missing.push(item.id);
    }
  }

  const limit = Math.max(1, options.concurrency ?? 4);
  let cursor = 0;

  const worker = async () => {
    while (cursor < missing.length) {
      const id = missing[cursor];
      cursor += 1;
      if (options.signal?.aborted) return;
      try {
        const detail = await fetchPropertyById(id, options.signal);
        const anchor = propertyAnchor(detail);
        if (anchor) anchors[id] = anchor;
      } catch {
        // Leave this property without a pin; the list still renders it.
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, missing.length) }, worker),
  );

  return anchors;
}

/** The API returns price as a float; 0 means "price on request". */
export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "Price on request";
  if (!Number.isFinite(price) || price <= 0) return "Price on request";

  if (price >= 10_000_000) {
    return `₹${(price / 10_000_000).toFixed(price % 10_000_000 === 0 ? 0 : 2)} Cr`;
  }
  if (price >= 100_000) {
    return `₹${(price / 100_000).toFixed(price % 100_000 === 0 ? 0 : 1)} L`;
  }
  return `₹${price.toLocaleString("en-IN")}`;
}