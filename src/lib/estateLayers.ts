/**
 * Estate master-plan layers, shared by any map that draws a property layout.
 *
 * `MapSection` keeps its own copies of this for now; this module exists so a
 * second map can present an identical layout without a second copy drifting
 * from the first. Moving `MapSection` onto it is a separate, self-contained
 * change — deliberately not bundled with the growth-corridors work, so a
 * regression in the developments map is never mixed in with a new feature.
 *
 * Nothing here holds React state or touches the network: a layer is added once
 * on map load, then `setLayoutData` / `syncLayoutRaster` drive it as the
 * selected estate changes.
 */

import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type ImageSource,
  type MapLibreMap,
} from "maplibre-gl";
import type { EstateProject } from "@/data/projects";
import type { LayoutRaster } from "@/data/projects/layoutRasters";

const EMPTY_FC = {
  type: "FeatureCollection" as const,
  features: [],
};

/** Estate master-plan palette */
export const LAYOUT = {
  siteFill: "#EFE6D6",
  siteEdge: "#C6A46C",
  openArea: "#7CB342",
  openAreaEdge: "#E8F5C8",
  available: "#10B981",
  booked: "#000000",
  sold: "#000000",
  blocked: "#000000",
  availableEdge: "#047857",
  bookedEdge: "#1A1A1A",
  soldEdge: "#1A1A1A",
  blockedEdge: "#1A1A1A",
  pulseGlowAvailable: "#10B981",
  plotEdge: "#FFFFFF",
  selected: "#06B6D4",
  selectedEdge: "#0891B2",
  road: "#0B0B0B",
  roadLine: "#FFFFFF",
  roadCasing: "#2A2A2A",
} as const;

const PLOT_STATUS_FILL_COLOR: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  LAYOUT.available,
  "booked",
  LAYOUT.booked,
  "blocked",
  LAYOUT.blocked,
  LAYOUT.sold,
];

const PLOT_STATUS_EDGE_COLOR: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  LAYOUT.availableEdge,
  "booked",
  LAYOUT.bookedEdge,
  "blocked",
  LAYOUT.blockedEdge,
  LAYOUT.soldEdge,
];

export const LAYOUT_LAYER_IDS = [
  "estate-site-pad-fill",
  "estate-site-pad-edge",
  "estate-open-fill",
  "estate-open-edge",
  "estate-plots-fill",
  "estate-plots-outline",
  "estate-plots-pulse",
  "estate-plots-label",
  "estate-roads-fill",
  "estate-roads-casing",
  "estate-roads-edge",
  "estate-roads-center",
] as const;

/** Keep the estate GeoJSON visible so plot polygons remain selectable. */
export const SHOW_ESTATE_GEOJSON = true;

/** Ceiling for the layout fit, so an estate always fills the frame. */
export const LAYOUT_MAX_ZOOM = 17.2;

export const LAYOUT_RASTER_SOURCE_ID = "estate-layout-image";
export const LAYOUT_RASTER_LAYER_ID = "estate-layout-raster";

/**
 * Adds every estate source and layer, all hidden.
 *
 * Called once from a map's `load` handler. The order matters: the layout image
 * and site pad sit at the bottom, plots and labels above them, so the plan is
 * never painted over the plot boundaries.
 */
export function addEstateLayers(map: MapLibreMap): void {
  map.addSource("estate-site-pad", { type: "geojson", data: EMPTY_FC });
  map.addSource("estate-open-areas", { type: "geojson", data: EMPTY_FC });
  map.addSource("estate-plots", { type: "geojson", data: EMPTY_FC });
  map.addSource("estate-roads", { type: "geojson", data: EMPTY_FC });
  map.addSource("estate-road-centers", { type: "geojson", data: EMPTY_FC });

  // Created without a url: a layout image is only known once a property is
  // opened, and an image source left empty draws nothing until `updateImage`
  // hands it one. These coordinates are a placeholder quad, replaced by the
  // property's own extent on every load.
  map.addSource(LAYOUT_RASTER_SOURCE_ID, {
    type: "image",
    coordinates: [
      [78.37881930400647, 17.136994933863203], // NW
      [78.3822802855224, 17.136994933863203], // NE
      [78.3822802855224, 17.13329363718222], // SE
      [78.37881930400647, 17.13329363718222], // SW
    ],
  });

  map.addLayer({
    id: LAYOUT_RASTER_LAYER_ID,
    type: "raster",
    source: LAYOUT_RASTER_SOURCE_ID,
    layout: { visibility: "none" },
    paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
  });

  map.addLayer({
    id: "estate-site-pad-fill",
    type: "fill",
    source: "estate-site-pad",
    layout: { visibility: "none" },
    paint: { "fill-color": LAYOUT.siteFill, "fill-opacity": 0.72 },
  });

  map.addLayer({
    id: "estate-site-pad-edge",
    type: "line",
    source: "estate-site-pad",
    layout: { visibility: "none" },
    paint: {
      "line-color": LAYOUT.siteEdge,
      "line-width": 2,
      "line-opacity": 0.85,
      "line-dasharray": [1.5, 1.2],
    },
  });

  map.addLayer({
    id: "estate-open-fill",
    type: "fill",
    source: "estate-open-areas",
    layout: { visibility: "none" },
    paint: { "fill-color": LAYOUT.openArea, "fill-opacity": 0.55 },
  });

  map.addLayer({
    id: "estate-open-edge",
    type: "line",
    source: "estate-open-areas",
    layout: { visibility: "none" },
    paint: { "line-color": LAYOUT.openAreaEdge, "line-width": 1.4 },
  });

  map.addLayer({
    id: "estate-plots-fill",
    type: "fill",
    source: "estate-plots",
    layout: { visibility: "none" },
    paint: {
      "fill-color": PLOT_STATUS_FILL_COLOR,
      "fill-opacity": [
        "match",
        ["get", "statusNorm"],
        "available",
        1.0,
        "booked",
        0.32,
        "blocked",
        0.32,
        0.32,
      ],
    },
  });

  map.addLayer({
    id: "estate-plots-outline",
    type: "line",
    source: "estate-plots",
    layout: { visibility: "none", "line-join": "miter" },
    paint: {
      "line-color": PLOT_STATUS_EDGE_COLOR,
      "line-width": 1.15,
      "line-opacity": 0.95,
    },
  });

  map.addLayer({
    id: "estate-plots-pulse",
    type: "line",
    source: "estate-plots",
    filter: ["==", ["get", "statusNorm"], "available"],
    layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": LAYOUT.pulseGlowAvailable,
      "line-width": 3.2,
      "line-opacity": 0.55,
      "line-blur": 1.2,
    },
  });

  map.addLayer({
    id: "estate-plots-label",
    type: "symbol",
    source: "estate-plots",
    filter: ["==", ["get", "statusNorm"], "available"],
    layout: {
      visibility: "none",
      "text-field": [
        "case",
        ["==", ["get", "statusNorm"], "available"],
        [
          "case",
          [
            "all",
            ["has", "sq_yards"],
            ["!=", ["to-string", ["get", "sq_yards"]], ""],
            ["!=", ["to-string", ["get", "sq_yards"]], "null"],
          ],
          [
            "concat",
            "AVAILABLE\n#",
            ["to-string", ["get", "plotNo"]],
            "\n",
            ["to-string", ["get", "sq_yards"]],
            " sq yd",
          ],
          [
            "concat",
            "AVAILABLE\n#",
            ["to-string", ["get", "plotNo"]],
          ],
        ],
        "",
      ],
      "text-justify": "center",
      "text-line-height": 1.15,
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        16.0,
        5,
        17.0,
        6.5,
        18.0,
        8,
        19.0,
        10,
      ],
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-allow-overlap": false,
      "text-padding": 3,
      "symbol-placement": "point",
      "text-max-width": 6,
    },
    paint: {
      "text-color": "#15803D",
      "text-halo-color": "#FFFFFF",
      "text-halo-width": 1.2,
      "text-opacity": [
        "interpolate",
        ["linear"],
        ["zoom"],
        16.2,
        0,
        16.7,
        1,
      ],
    },
  });

  map.addLayer({
    id: "estate-roads-fill",
    type: "fill",
    source: "estate-roads",
    layout: { visibility: "none" },
    paint: { "fill-color": LAYOUT.road, "fill-opacity": 1 },
  });

  map.addLayer({
    id: "estate-roads-casing",
    type: "line",
    source: "estate-roads",
    layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
    paint: {
      "line-color": LAYOUT.roadCasing,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        4,
        16.5,
        8,
        18,
        14,
      ],
    },
  });

  map.addLayer({
    id: "estate-roads-edge",
    type: "line",
    source: "estate-roads",
    layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
    paint: {
      "line-color": LAYOUT.roadLine,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        2,
        16.5,
        4.5,
        18,
        8,
      ],
      "line-opacity": 1,
    },
  });

  map.addLayer({
    id: "estate-roads-center",
    type: "line",
    source: "estate-road-centers",
    layout: { visibility: "none", "line-cap": "butt", "line-join": "round" },
    paint: {
      "line-color": LAYOUT.roadLine,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        1.2,
        16.5,
        2.6,
        18,
        4.5,
      ],
      "line-opacity": 1,
      "line-dasharray": [2.2, 1.8],
    },
  });
}

/** Pushes an estate's GeoJSON into the shared sources, or clears them. */
export function setLayoutData(
  map: MapLibreMap,
  project: EstateProject | null,
): void {
  const set = (id: string, data: object) => {
    const source = map.getSource(id) as GeoJSONSource | undefined;
    source?.setData(data as GeoJSON.FeatureCollection);
  };

  if (!project) {
    set("estate-site-pad", EMPTY_FC);
    set("estate-open-areas", EMPTY_FC);
    set("estate-plots", EMPTY_FC);
    set("estate-roads", EMPTY_FC);
    set("estate-road-centers", EMPTY_FC);
    return;
  }

  set("estate-site-pad", project.sitePadGeo);
  set("estate-open-areas", project.openAreasGeo);
  set("estate-plots", project.plotsGeo);
  set("estate-roads", project.roadsGeo);
  set("estate-road-centers", project.roadCenterlinesGeo);
}

/**
 * Shows or hides the master-plan image.
 *
 * A raster is applied as soon as it exists so the decode is not held until the
 * layout opens; only its visibility waits. The beige site pad is dropped while
 * an image is showing, since both describe the same ground.
 */
export function syncLayoutRaster(
  map: MapLibreMap,
  raster: LayoutRaster | undefined,
  layoutVisible: boolean,
): void {
  const source = map.getSource(LAYOUT_RASTER_SOURCE_ID) as
    | ImageSource
    | undefined;
  if (!source || !map.getLayer(LAYOUT_RASTER_LAYER_ID)) return;

  if (raster) {
    // Exactly one of the two: a decoded image skips the network, a URL is
    // fetched by the map itself.
    if (raster.image) {
      source.updateImage({ image: raster.image, coordinates: raster.coordinates });
    } else if (raster.url) {
      source.updateImage({ url: raster.url, coordinates: raster.coordinates });
    }
    map.setPaintProperty(
      LAYOUT_RASTER_LAYER_ID,
      "raster-opacity",
      raster.opacity,
    );
  }

  map.setLayoutProperty(
    LAYOUT_RASTER_LAYER_ID,
    "visibility",
    layoutVisible && raster ? "visible" : "none",
  );

  const showPad = Boolean(
    SHOW_ESTATE_GEOJSON && layoutVisible && !raster,
  );
  for (const layerId of ["estate-site-pad-fill", "estate-site-pad-edge"] as const) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", showPad ? "visible" : "none");
    }
  }
}

/**
 * Paints the selected plot in gold. `plotId` null clears the highlight without
 * touching the rest of the fill expression.
 */
export function highlightPlot(
  map: MapLibreMap,
  plotId: string | null,
  hasRaster: boolean,
): void {
  if (!map.getLayer("estate-plots-fill")) return;

  const active = plotId ?? "";

  map.setPaintProperty("estate-plots-fill", "fill-color", [
    "case",
    ["==", ["get", "id"], active],
    LAYOUT.selected,
    PLOT_STATUS_FILL_COLOR,
  ]);

  // The master plan under the plots is the point of drawing it, so the fills go
  // translucent while an image is showing and opaque without one. Available
  // stays strongest; booked/sold/blocked dim so inventory reads at a glance.
  const scale = hasRaster ? 0.5 : 1;
  map.setPaintProperty("estate-plots-fill", "fill-opacity", [
    "case",
    ["==", ["get", "id"], active],
    0.95,
    [
      "match",
      ["get", "statusNorm"],
      "available",
      1.0,
      "booked",
      0.32,
      "blocked",
      0.32,
      0.32, // sold
    ],
  ]);

  map.setPaintProperty("estate-plots-outline", "line-color", [
    "case",
    ["==", ["get", "id"], active],
    LAYOUT.selectedEdge,
    PLOT_STATUS_EDGE_COLOR,
  ]);
  map.setPaintProperty("estate-plots-outline", "line-width", [
    "case",
    ["==", ["get", "id"], active],
    3.2,
    1.15,
  ]);
}