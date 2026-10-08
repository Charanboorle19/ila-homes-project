import type { Feature, FeatureCollection, Polygon } from "geojson";
import plotsGeojson from "@/ila-demo-project/sark-green-plots.json";
import roadsGeojson from "@/ila-demo-project/sark-green-road.json";
import mainRoadsGeojson from "@/ila-demo-project/sark-green-main-road.json";
import type { Plot, PlotStatus } from "@/data/plots";

type PlotProps = {
  fid: number;
  sq_yards: string | null;
  plot_no: string | null;
  facing: string | null;
  status: string | null;
  per_sq_ft_price: number | null;
  per_sq_yard_price: number | null;
};

export const SARK_GREEN = {
  name: "Sark Green",
  location: "Hyderabad",
  center: [78.455514, 17.207905] as [number, number],
  bounds: {
    minLng: 78.453334,
    minLat: 17.205717,
    maxLng: 78.457694,
    maxLat: 17.210092,
  },
};

/** Soft pad under the whole layout so the estate reads as one site */
export const sarkGreenSitePadGeo = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { id: "sark-site-pad" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [SARK_GREEN.bounds.minLng, SARK_GREEN.bounds.minLat],
            [SARK_GREEN.bounds.maxLng, SARK_GREEN.bounds.minLat],
            [SARK_GREEN.bounds.maxLng, SARK_GREEN.bounds.maxLat],
            [SARK_GREEN.bounds.minLng, SARK_GREEN.bounds.maxLat],
            [SARK_GREEN.bounds.minLng, SARK_GREEN.bounds.minLat],
          ],
        ],
      },
    },
  ],
};

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

function normalizeStatus(status: string | null | undefined): PlotStatus {
  const value = (status || "").trim().toUpperCase();
  if (value === "AVL" || value === "AVAILABLE" || value === "OPEN") {
    return "available";
  }
  return "sold";
}

function formatPlotNo(plotNo: string | null | undefined, fid: number): string {
  const raw = String(plotNo ?? fid).trim();
  if (!raw) return String(fid).padStart(2, "0");
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0");
  return raw;
}

function plotKeyFromNo(plotNo: string): string {
  return `sg-plot-${plotNo}`;
}

function formatFacing(facing: string | null | undefined): string {
  if (!facing) return "Facing TBA";
  return facing
    .split("/")
    .map((part) => {
      const key = part.trim().toUpperCase();
      if (key === "N") return "North";
      if (key === "S") return "South";
      if (key === "E") return "East";
      if (key === "W") return "West";
      return part.trim();
    })
    .join(" / ")
    .concat(" Facing");
}

function formatPrice(props: PlotProps): string {
  if (props.per_sq_yard_price) {
    return `₹${Number(props.per_sq_yard_price).toLocaleString("en-IN")}/sq.yd`;
  }
  if (props.per_sq_ft_price) {
    return `₹${Number(props.per_sq_ft_price).toLocaleString("en-IN")}/sq.ft`;
  }
  return "Price on request";
}

export const sarkGreenPlotsGeo = plotsGeojson as FeatureCollection<Polygon, PlotProps>;
export const sarkGreenRoadsGeo = roadsGeojson as FeatureCollection;
export const sarkGreenMainRoadsGeo = mainRoadsGeojson as FeatureCollection;

/** Build a centerline from a road polygon by averaging its two longest edges. */
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

  // Orient longB so both edges run in roughly the same direction.
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

function roadsToCenterlines(
  collection: FeatureCollection,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.flatMap((feature, index) => {
      if (feature.geometry?.type !== "Polygon") return [];
      const line = polygonCenterline(feature.geometry.coordinates[0]);
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

export const sarkGreenRoadCenterlinesGeo = roadsToCenterlines(sarkGreenRoadsGeo);
export const sarkGreenMainRoadCenterlinesGeo = roadsToCenterlines(
  sarkGreenMainRoadsGeo,
);

type Acc = {
  plotNo: string;
  props: PlotProps;
  statuses: PlotStatus[];
  centroids: [number, number][];
  polygon: [number, number][];
};

/** Listing data: one card per unique plot_no from Sark Green */
export const SARK_GREEN_PLOTS: Plot[] = (() => {
  const byPlot = new Map<string, Acc>();

  for (const feature of sarkGreenPlotsGeo.features) {
    const props = feature.properties;
    const plotNo = formatPlotNo(props.plot_no, props.fid);
    const key = plotKeyFromNo(plotNo);
    const ring = feature.geometry.coordinates[0] as [number, number][];
    const centroid = ringCentroid(ring);
    const existing = byPlot.get(key);

    if (!existing) {
      byPlot.set(key, {
        plotNo,
        props,
        statuses: [normalizeStatus(props.status)],
        centroids: [centroid],
        polygon: ring,
      });
      continue;
    }

    existing.statuses.push(normalizeStatus(props.status));
    existing.centroids.push(centroid);
    if (!existing.props.sq_yards && props.sq_yards) existing.props = props;
    if (!existing.props.facing && props.facing) existing.props = { ...existing.props, facing: props.facing };
  }

  return Array.from(byPlot.entries())
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
        location: `${SARK_GREEN.name}, ${SARK_GREEN.location}`,
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
})();

export function getSarkGreenFeatureByPlotId(
  plotId: string,
): Feature<Polygon, PlotProps> | undefined {
  const plotNo = plotId.replace("sg-plot-", "");
  return sarkGreenPlotsGeo.features.find(
    (f) => formatPlotNo(f.properties.plot_no, f.properties.fid) === plotNo,
  );
}

/** Enrich plot features with normalized fields for MapLibre styling */
export function getStyledPlotsGeo(): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sarkGreenPlotsGeo.features.map((feature) => {
      const plotNo = formatPlotNo(
        feature.properties.plot_no,
        feature.properties.fid,
      );
      return {
        ...feature,
        properties: {
          ...feature.properties,
          id: plotKeyFromNo(plotNo),
          featureId: `sg-${feature.properties.fid}`,
          statusNorm: normalizeStatus(feature.properties.status),
          label: `Plot ${plotNo}`,
          plotNo,
        },
      };
    }),
  };
}
