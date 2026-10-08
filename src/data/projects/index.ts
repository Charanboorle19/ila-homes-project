import type { FeatureCollection, Polygon } from "geojson";
import type { Plot, PlotStatus } from "@/data/plots";

import sarkPlots from "@/ila-demo-project/sark-green-plots.json";
import sarkRoads from "@/ila-demo-project/sark-green-road.json";
import sarkMainRoads from "@/ila-demo-project/sark-green-main-road.json";

import meadowsPlots from "@/data/projects/geo/green-meadows-plots.json";
import meadowsRoads from "@/data/projects/geo/green-meadows-roads.json";
import meadowsOpen from "@/data/projects/geo/green-meadows-open-areas.json";
import {
  layoutRasterForBounds,
  type LayoutRaster,
} from "@/data/projects/layoutRasters";

export type ProjectId = string;

export type Bounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

export type { LayoutRaster };

export type EstateProject = {
  id: ProjectId;
  name: string;
  location: string;
  center: [number, number];
  bounds: Bounds;
  plots: Plot[];
  sitePadGeo: FeatureCollection;
  plotsGeo: FeatureCollection;
  roadsGeo: FeatureCollection;
  roadCenterlinesGeo: FeatureCollection;
  openAreasGeo: FeatureCollection;
  /** Optional georeferenced master-plan image under vector plots. */
  layoutRaster?: LayoutRaster;
};

type AnyProps = Record<string, unknown>;

export type BuildConfig = {
  id: ProjectId;
  name: string;
  location: string;
  plotsRaw: FeatureCollection;
  roadsRaw: FeatureCollection[];
  openAreasRaw?: FeatureCollection;
  /** When every status is empty, treat plots as available instead of sold */
  emptyStatusAs?: PlotStatus;
};

function asCollection(raw: unknown): FeatureCollection {
  return raw as FeatureCollection;
}

function ringCentroid(ring: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  const n = Math.max(ring.length - 1, 1);
  for (let i = 0; i < n; i += 1) {
    x += ring[i][0];
    y += ring[i][1];
  }
  return [x / n, y / n];
}

/** Accept GeoJSON Polygon rings or a flat API ring [[lng,lat],...]. */
function polygonOuterRing(geometry: Polygon): [number, number][] | null {
  const coords = geometry.coordinates as unknown;
  if (!Array.isArray(coords) || coords.length === 0) return null;

  const first = coords[0] as unknown;
  let ring: number[][] | null = null;

  if (
    Array.isArray(first) &&
    Array.isArray(first[0]) &&
    typeof (first as number[][])[0][0] === "number"
  ) {
    ring = first as number[][];
  } else if (
    Array.isArray(first) &&
    typeof first[0] === "number" &&
    typeof first[1] === "number"
  ) {
    ring = coords as number[][];
  }

  if (!ring || ring.length < 3 || !Array.isArray(ring[0])) return null;
  if (typeof ring[0][0] !== "number" || typeof ring[0][1] !== "number") {
    return null;
  }

  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring
      : [...ring, ring[0]];

  return closed as [number, number][];
}

function normalizeStatus(
  status: unknown,
  emptyAs: PlotStatus = "sold",
): PlotStatus {
  const value = String(status ?? "")
    .trim()
    .toUpperCase();
  if (!value) return emptyAs;
  if (value === "AVL" || value === "AVAILABLE" || value === "OPEN") {
    return "available";
  }
  return "sold";
}

function formatPlotNo(plotNo: unknown, fid: unknown): string {
  const raw = String(plotNo ?? fid ?? "").trim();
  if (!raw) return "00";
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0");
  return raw;
}

function formatFacing(facing: unknown): string {
  if (!facing) return "Facing TBA";
  return String(facing)
    .split("/")
    .map((part) => {
      const key = part.trim().toUpperCase();
      if (key === "N") return "North";
      if (key === "S") return "South";
      if (key === "E") return "East";
      if (key === "W") return "West";
      if (key === "NE") return "North-East";
      if (key === "NW") return "North-West";
      if (key === "SE") return "South-East";
      if (key === "SW") return "South-West";
      return part.trim();
    })
    .join(" / ")
    .concat(" Facing");
}

function formatPrice(props: AnyProps): string {
  const absolute = props.price ?? props.total_price ?? props.totalPrice;
  // The API sends price 0 for "not published". Rendering that as a
  // currency amount would read as a free plot, so treat it as unknown.
  const hasAbsolutePrice =
    absolute != null &&
    absolute !== "" &&
    Number.isFinite(Number(absolute)) &&
    Number(absolute) > 0;
  if (hasAbsolutePrice) {
    return `₹${Number(absolute).toLocaleString("en-IN")}`;
  }
  const yard = props.per_sq_yard_price ?? props.per_sq_yard_cost;
  const feet = props.per_sq_ft_price ?? props.per_sq_ft_cost;
  if (yard != null && yard !== "" && Number.isFinite(Number(yard))) {
    return `₹${Number(yard).toLocaleString("en-IN")}/sq.yd`;
  }
  if (feet != null && feet !== "" && Number.isFinite(Number(feet))) {
    return `₹${Number(feet).toLocaleString("en-IN")}/sq.ft`;
  }
  return "Price on request";
}

function getPlotNumber(props: AnyProps): unknown {
  return props.plot_no ?? props["plot number"] ?? props.plotNumber;
}

function collectionBounds(collections: FeatureCollection[]): Bounds {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      minLng = Math.min(minLng, value[0]);
      maxLng = Math.max(maxLng, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    value.forEach(walk);
  };

  for (const collection of collections) {
    for (const feature of collection.features) {
      const geometry = feature.geometry;
      if (!geometry || geometry.type === "GeometryCollection") continue;
      walk(geometry.coordinates);
    }
  }

  return { minLng, minLat, maxLng, maxLat };
}

function sitePadFromBounds(bounds: Bounds, id: string): FeatureCollection {
  const padLng = (bounds.maxLng - bounds.minLng) * 0.04;
  const padLat = (bounds.maxLat - bounds.minLat) * 0.04;
  const minLng = bounds.minLng - padLng;
  const maxLng = bounds.maxLng + padLng;
  const minLat = bounds.minLat - padLat;
  const maxLat = bounds.maxLat + padLat;

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: `${id}-site-pad` },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
      },
    ],
  };
}

function polygonCenterline(ring: number[][]): [number, number][] | null {
  const pts =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring.slice();

  if (pts.length < 3) return null;

  type Edge = { a: number[]; b: number[]; len: number };
  const edges: Edge[] = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    edges.push({
      a,
      b,
      len: Math.hypot(b[0] - a[0], b[1] - a[1]),
    });
  }

  edges.sort((x, y) => y.len - x.len);
  const longA = edges[0];
  const longB = edges[1];
  if (!longA || !longB || longA.len < 1e-9) return null;

  const dirA = [longA.b[0] - longA.a[0], longA.b[1] - longA.a[1]] as const;
  const dirB = [longB.b[0] - longB.a[0], longB.b[1] - longB.a[1]] as const;
  const sameDir = dirA[0] * dirB[0] + dirA[1] * dirB[1] >= 0;
  const bStart = sameDir ? longB.a : longB.b;
  const bEnd = sameDir ? longB.b : longB.a;

  const samples = Math.max(6, Math.round(longA.len * 80000));
  const line: [number, number][] = [];
  for (let s = 0; s <= samples; s += 1) {
    const t = s / samples;
    const x1 = longA.a[0] + (longA.b[0] - longA.a[0]) * t;
    const y1 = longA.a[1] + (longA.b[1] - longA.a[1]) * t;
    const x2 = bStart[0] + (bEnd[0] - bStart[0]) * t;
    const y2 = bStart[1] + (bEnd[1] - bStart[1]) * t;
    line.push([(x1 + x2) / 2, (y1 + y2) / 2]);
  }
  return line;
}

function roadsToCenterlines(collection: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.flatMap((feature, index) => {
      if (feature.geometry?.type !== "Polygon") return [];
      const line = polygonCenterline(
        (feature.geometry as Polygon).coordinates[0],
      );
      if (!line || line.length < 2) return [];
      return [
        {
          type: "Feature" as const,
          properties: {
            ...(feature.properties || {}),
            id: `road-center-${index}`,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: line,
          },
        },
      ];
    }),
  };
}

function mergeCollections(collections: FeatureCollection[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collections.flatMap((c) => c.features),
  };
}

export function buildEstateProject(config: BuildConfig): EstateProject {
  const emptyAs = config.emptyStatusAs ?? "sold";
  const plotsRaw = asCollection(config.plotsRaw);
  const roadsGeo = mergeCollections(config.roadsRaw.map(asCollection));
  const openAreasGeo = asCollection(
    config.openAreasRaw ?? { type: "FeatureCollection", features: [] },
  );

  const bounds = collectionBounds([plotsRaw, roadsGeo, openAreasGeo]);
  const center: [number, number] = [
    (bounds.minLng + bounds.maxLng) / 2,
    (bounds.minLat + bounds.maxLat) / 2,
  ];

  type Acc = {
    plotNo: string;
    props: AnyProps;
    statuses: PlotStatus[];
    centroids: [number, number][];
    polygon: [number, number][];
  };

  const byPlot = new Map<string, Acc>();

  for (const feature of plotsRaw.features) {
    if (feature.geometry?.type !== "Polygon") continue;
    const props = (feature.properties || {}) as AnyProps;
    const fid = props.fid ?? 0;
    const plotNo = formatPlotNo(getPlotNumber(props), fid);
    const id = `${config.id}-plot-${plotNo}`;
    const ring = polygonOuterRing(feature.geometry);
    if (!ring) continue;
    const fromPropsLng = Number(props.centroid_lng);
    const fromPropsLat = Number(props.centroid_lat);
    const centroid: [number, number] =
      Number.isFinite(fromPropsLng) && Number.isFinite(fromPropsLat)
        ? [fromPropsLng, fromPropsLat]
        : ringCentroid(ring);
    if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) {
      continue;
    }
    const status = normalizeStatus(props.status, emptyAs);
    const existing = byPlot.get(id);

    if (!existing) {
      byPlot.set(id, {
        plotNo,
        props,
        statuses: [status],
        centroids: [centroid],
        polygon: ring,
      });
      continue;
    }

    existing.statuses.push(status);
    existing.centroids.push(centroid);
    if (!existing.props.sq_yards && props.sq_yards) existing.props = props;
    if (!existing.props.facing && props.facing) {
      existing.props = { ...existing.props, facing: props.facing };
    }
  }

  const plots: Plot[] = Array.from(byPlot.entries())
    .map(([id, acc]) => {
      const lng =
        acc.centroids.reduce((sum, c) => sum + c[0], 0) / acc.centroids.length;
      const lat =
        acc.centroids.reduce((sum, c) => sum + c[1], 0) / acc.centroids.length;
      const status: PlotStatus = acc.statuses.includes("available")
        ? "available"
        : "sold";
      const yards = acc.props.sq_yards
        ? `${acc.props.sq_yards} sq.yd`
        : "Area TBA";

      return {
        id,
        title: `Plot ${acc.plotNo}`,
        area: yards,
        facing: formatFacing(acc.props.facing),
        location: `${config.name}, ${config.location}`,
        price: formatPrice(acc.props),
        status,
        lng,
        lat,
        polygon: acc.polygon,
        image: "/hero-image.png",
      };
    })
    .sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true }),
    );

  const plotsGeo: FeatureCollection = {
    type: "FeatureCollection",
    features: plotsRaw.features.flatMap((feature, index) => {
      if (feature.geometry?.type !== "Polygon") return [];
      const ring = polygonOuterRing(feature.geometry);
      if (!ring) return [];
      const props = (feature.properties || {}) as AnyProps;
      const fid = props.fid ?? index;
      const plotNo = formatPlotNo(getPlotNumber(props), fid);
      return [
        {
          type: "Feature" as const,
          properties: {
            ...props,
            id: `${config.id}-plot-${plotNo}`,
            featureId: `${config.id}-${fid}`,
            statusNorm: normalizeStatus(props.status, emptyAs),
            label: `Plot ${plotNo}`,
            plotNo,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [ring],
          },
        },
      ];
    }),
  };

  return {
    id: config.id,
    name: config.name,
    location: config.location,
    center,
    bounds,
    plots,
    sitePadGeo: sitePadFromBounds(bounds, config.id),
    plotsGeo,
    roadsGeo,
    roadCenterlinesGeo: roadsToCenterlines(roadsGeo),
    openAreasGeo,
    layoutRaster: layoutRasterForBounds(bounds),
  };
}

export const SARK_GREEN_PROJECT = buildEstateProject({
  id: "sark-green",
  name: "Sark Green",
  location: "Hyderabad",
  plotsRaw: asCollection(sarkPlots),
  roadsRaw: [asCollection(sarkRoads), asCollection(sarkMainRoads)],
  emptyStatusAs: "sold",
});

export const GREEN_MEADOWS_PROJECT = buildEstateProject({
  id: "green-meadows",
  name: "Green Meadows",
  location: "Hyderabad",
  plotsRaw: asCollection(meadowsPlots),
  roadsRaw: [asCollection(meadowsRoads)],
  openAreasRaw: asCollection(meadowsOpen),
  emptyStatusAs: "available",
});

export const ESTATE_PROJECTS: EstateProject[] = [
  SARK_GREEN_PROJECT,
  GREEN_MEADOWS_PROJECT,
];

export function getProjectById(id: ProjectId | null | undefined) {
  return ESTATE_PROJECTS.find((project) => project.id === id) ?? null;
}

export const ALL_PROJECTS_BOUNDS: Bounds = ESTATE_PROJECTS.reduce(
  (acc, project) => ({
    minLng: Math.min(acc.minLng, project.bounds.minLng),
    minLat: Math.min(acc.minLat, project.bounds.minLat),
    maxLng: Math.max(acc.maxLng, project.bounds.maxLng),
    maxLat: Math.max(acc.maxLat, project.bounds.maxLat),
  }),
  {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  },
);
