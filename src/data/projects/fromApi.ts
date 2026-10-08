import type { Feature, FeatureCollection, Geometry } from "geojson";
import {
  buildEstateProject,
  type EstateProject,
} from "@/data/projects";
import { propertyAnchor, type PropertyAnchor } from "@/services/propertiesService";
import type { PropertyLayoutCords } from "@/services/propertiesService";
import { layoutCordsToBounds } from "@/data/projects/layoutRasters";

// Re-exported so map code can read a coordinate pair without reaching into the
// service layer directly.
export { propertyAnchor, type PropertyAnchor };

type AnyRecord = Record<string, unknown>;

/**
 * Half-span of the framing box used for a property that has coordinates but no
 * unit geometry yet — roughly a 450 m radius, enough for the pin to sit in a
 * sensible place without zooming to the block.
 */
const PLACEHOLDER_HALF_SPAN_DEG = 0.004;

/**
 * How far the property's coordinates may sit from the plotted geometry before
 * they are treated as a bad geocode and the geometry centroid is kept instead.
 */
const ANCHOR_MAX_OFFSET_M = 2500;

const emptyFc = (): FeatureCollection => ({
  type: "FeatureCollection",
  features: [],
});

function haversineMeters(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function anchorIsPlausible(anchor: PropertyAnchor, center: [number, number]) {
  if (
    Math.abs(anchor.latitude) > 90 ||
    Math.abs(anchor.longitude) > 180
  ) {
    return false;
  }
  return (
    haversineMeters([anchor.longitude, anchor.latitude], center) <=
    ANCHOR_MAX_OFFSET_M
  );
}

/**
 * A project with no geometry, used only so a property that has coordinates but
 * no units still gets a pin at the right spot on the map. Nothing is drawn for
 * it until a layout is opened, and `plots` being empty keeps every plot-derived
 * view (counts, filters, layout) inert.
 */
export function estatePlaceholderFromProperty(options: {
  propertyId: string;
  name?: string;
  location?: string;
  anchor: PropertyAnchor;
}): EstateProject {
  const { anchor } = options;
  const lng = anchor.longitude;
  const lat = anchor.latitude;

  return {
    id: options.propertyId,
    name: options.name ?? "Live Development",
    location: options.location ?? "Hyderabad",
    center: [lng, lat],
    bounds: {
      minLng: lng - PLACEHOLDER_HALF_SPAN_DEG,
      minLat: lat - PLACEHOLDER_HALF_SPAN_DEG,
      maxLng: lng + PLACEHOLDER_HALF_SPAN_DEG,
      maxLat: lat + PLACEHOLDER_HALF_SPAN_DEG,
    },
    plots: [],
    sitePadGeo: emptyFc(),
    plotsGeo: emptyFc(),
    roadsGeo: emptyFc(),
    roadCenterlinesGeo: emptyFc(),
    openAreasGeo: emptyFc(),
  };
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRecord)
    : null;
}

function pickString(obj: AnyRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (value == null || value === "") continue;
    return String(value);
  }
  return null;
}

function pickNumber(obj: AnyRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (value == null || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isGeometry(value: unknown): value is Geometry {
  const obj = asRecord(value);
  return Boolean(obj && typeof obj.type === "string" && "coordinates" in obj);
}

/** ILA API sometimes sends Polygon coordinates as a flat ring [[lng,lat],...] instead of GeoJSON [[[lng,lat],...]]. */
function normalizeGeometry(geometry: Geometry): Geometry {
  if (geometry.type !== "Polygon") return geometry;

  const coords = geometry.coordinates as unknown;
  if (!Array.isArray(coords) || coords.length === 0) return geometry;

  const first = coords[0] as unknown;
  // Flat ring: first element is a position [lng, lat]
  if (
    Array.isArray(first) &&
    typeof first[0] === "number" &&
    typeof first[1] === "number" &&
    !Array.isArray(first[0])
  ) {
    const ring = coords as number[][];
    const closed =
      ring.length >= 3 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1]
        ? ring
        : ring.length >= 3
          ? [...ring, ring[0]]
          : ring;
    return { type: "Polygon", coordinates: [closed] };
  }

  return geometry;
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  const obj = asRecord(value);
  return Boolean(obj && obj.type === "FeatureCollection" && Array.isArray(obj.features));
}

function isFeature(value: unknown): value is Feature {
  const obj = asRecord(value);
  return Boolean(obj && obj.type === "Feature" && obj.geometry);
}

function unwrapPayload(json: unknown): unknown {
  const root = asRecord(json);
  if (!root) return json;
  if (isFeatureCollection(root)) return root;
  if (root.data != null) return unwrapPayload(root.data);
  if (root.result != null) return unwrapPayload(root.result);
  if (root.units != null) return root.units;
  if (root.plots != null) return root.plots;
  if (root.items != null) return root.items;
  if (Array.isArray(root.features)) return root;
  return json;
}

function unitToFeature(unit: unknown, index: number): Feature | null {
  if (isFeature(unit)) {
    const props = asRecord(unit.properties) ?? {};
    const geometry = unit.geometry ? normalizeGeometry(unit.geometry) : unit.geometry;
    return {
      ...unit,
      geometry,
      properties: {
        ...props,
        fid: props.fid ?? index + 1,
      },
    };
  }

  const obj = asRecord(unit);
  if (!obj) return null;

  const geometryCandidate =
    obj.geometry ??
    obj.geojson ??
    obj.geom ??
    obj.boundary ??
    obj.polygon ??
    asRecord(obj.geojson)?.geometry ??
    null;

  let geometry: Geometry | null = null;
  if (isGeometry(geometryCandidate)) {
    geometry = normalizeGeometry(geometryCandidate);
  } else if (isFeature(geometryCandidate)) {
    geometry = geometryCandidate.geometry
      ? normalizeGeometry(geometryCandidate.geometry)
      : null;
  } else if (Array.isArray(geometryCandidate)) {
    // Assume ring of [lng, lat]
    const ring = geometryCandidate as number[][];
    if (ring.length >= 3 && Array.isArray(ring[0])) {
      const closed =
        ring[0][0] === ring[ring.length - 1][0] &&
        ring[0][1] === ring[ring.length - 1][1]
          ? ring
          : [...ring, ring[0]];
      geometry = { type: "Polygon", coordinates: [closed] };
    }
  }

  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) {
    return null;
  }

  const centroidObj = asRecord(obj.centroid);
  const centroidLng = centroidObj ? pickNumber(centroidObj, ["lng", "lon", "longitude"]) : null;
  const centroidLat = centroidObj ? pickNumber(centroidObj, ["lat", "latitude"]) : null;

  const source = asRecord(obj.source);
  const plotNo =
    pickString(obj, [
      "plot_no",
      "plotNo",
      "plot_number",
      "plotNumber",
      "unit_number",
      "unitNumber",
      "unit_no",
      "name",
      "title",
      "code",
    ]) ??
    (source ? pickString(source, ["fid"]) : null) ??
    String(index + 1);

  const status =
    pickString(obj, ["status", "availability", "sale_status", "saleStatus"]) ??
    "";

  const facing = pickString(obj, ["facing", "face", "direction"]);
  const sqYards =
    pickString(obj, [
      "sq_yards",
      "sqYards",
      "area_sq_yards",
      "areaSqYards",
    ]) ??
    pickNumber(obj, ["sq_yards", "sqYards", "area_sq_yards", "areaSqYards"]);
  const sqFt =
    pickNumber(obj, ["sq_ft", "sqFt", "area_sqft", "areaSqft", "area"]);
  const price = pickNumber(obj, ["price", "total_price", "totalPrice"]);
  const perSqYard = pickNumber(obj, [
    "per_sq_yard_price",
    "perSqYardPrice",
    "price_per_sq_yard",
  ]);
  const perSqFt = pickNumber(obj, [
    "per_sq_ft_price",
    "perSqFtPrice",
    "price_per_sq_ft",
  ]);

  return {
    type: "Feature",
    properties: {
      fid:
        pickNumber(obj, ["fid"]) ??
        (source ? pickNumber(source, ["fid"]) : null) ??
        index + 1,
      plot_no: plotNo,
      status,
      facing,
      sq_yards: sqYards != null ? String(sqYards) : null,
      sq_ft: sqFt,
      price,
      per_sq_yard_price: perSqYard,
      per_sq_ft_price: perSqFt,
      source_id: pickString(obj, ["id", "uuid", "unit_id", "unitId"]),
      ...(centroidLng != null && centroidLat != null
        ? { centroid_lng: centroidLng, centroid_lat: centroidLat }
        : {}),
    },
    geometry,
  };
}

export function unitsResponseToPlotsGeo(json: unknown): FeatureCollection {
  const payload = unwrapPayload(json);

  if (isFeatureCollection(payload)) {
    return {
      type: "FeatureCollection",
      features: payload.features
        .map((feature, index) => unitToFeature(feature, index))
        .filter((f): f is Feature => Boolean(f)),
    };
  }

  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload)?.units)
      ? (asRecord(payload)!.units as unknown[])
      : Array.isArray(asRecord(payload)?.plots)
        ? (asRecord(payload)!.plots as unknown[])
        : Array.isArray(asRecord(payload)?.items)
          ? (asRecord(payload)!.items as unknown[])
          : [];

  return {
    type: "FeatureCollection",
    features: list
      .map((unit, index) => unitToFeature(unit, index))
      .filter((f): f is Feature => Boolean(f)),
  };
}

export function estateFromUnitsApi(options: {
  propertyId: string;
  name?: string;
  location?: string;
  /** latitude/longitude from GET /api/properties/{id}; anchors the map pin. */
  anchor?: PropertyAnchor | null;
  /** Extent of the estate master plan, from the units response. */
  layoutCords?: PropertyLayoutCords | null;
  unitsJson: unknown;
}): EstateProject {
  const plotsRaw = unitsResponseToPlotsGeo(options.unitsJson);
  if (plotsRaw.features.length === 0) {
    throw new Error("No plot geometries found in units API response");
  }

  const estate = buildEstateProject({
    id: options.propertyId,
    name: options.name ?? "Live Development",
    location: options.location ?? "Hyderabad",
    plotsRaw,
    roadsRaw: [{ type: "FeatureCollection", features: [] }],
    emptyStatusAs: "available",
  });

  if (estate.plots.length === 0 || estate.plotsGeo.features.length === 0) {
    throw new Error("Units API returned geometries that could not be mapped to plots");
  }

  // The API's layout extent is wider than the plotted polygons (it includes
  // roads and setbacks), so it is the better frame — and the extent the
  // master-plan image is georeferenced to.
  const layoutCords = options.layoutCords ?? null;
  const bounds = layoutCords ? layoutCordsToBounds(layoutCords) : estate.bounds;

  // buildEstateProject attaches a hard-coded raster for the static demo
  // layouts; an API property carries its own scan instead (decoded separately),
  // so that guess must not leak through.
  const base: EstateProject = {
    ...estate,
    bounds,
    layoutRaster: undefined,
  };

  // The pin follows the property's own coordinates rather than the geometry
  // centroid, so it always sits where the API says the development is.
  const anchor = options.anchor ?? null;
  if (anchor && anchorIsPlausible(anchor, estate.center)) {
    return { ...base, center: [anchor.longitude, anchor.latitude] };
  }

  return base;
}
