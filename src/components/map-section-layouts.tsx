import type {
  ExpressionSpecification,
  Map as MapLibreMap,
  GeoJSONSource,
  ImageSource,
} from "maplibre-gl";
import type { EstateProject, LayoutRaster } from "@/data/projects";

export const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Estate Master-Plan & Plots Design Palette
 * Modify these tokens to redesign the plots, status fills, outlines, roads, and open spaces.
 *
 * Status hierarchy for buyers: Available pops (pulse + stronger fill);
 * Booked / Sold / Blocked stay quieter but labelled.
 */
export const LAYOUT_DESIGN = {
  // Site boundary / pad
  siteFill: "transparent",
  siteEdge: "#C6A46C",

  // Parks & green open areas
  openArea: "#7CB342",
  openAreaEdge: "#E8F5C8",

  // Plot status fills
  available: "#10B981", // vibrant, attractive emerald green
  booked: "transparent",
  sold: "transparent",
  blocked: "transparent",

  // Status edge accents (when not selected)
  availableEdge: "#047857",
  bookedEdge: "rgba(255, 255, 255, 0.4)",
  soldEdge: "rgba(255, 255, 255, 0.4)",
  blockedEdge: "rgba(255, 255, 255, 0.4)",

  // Plot borders / outlines
  plotEdge: "#FFFFFF",
  plotOutlineWidth: 1.5,
  plotOutlineOpacity: 0.95,

  // Selected plot styling (cyan/blue highlight)
  selected: "#06B6D4",
  selectedEdge: "#0891B2",
  selectedOutlineWidth: 3.2,

  // Available plot pulse effect
  pulseGlowAvailable: "#10B981",
  pulseGlowEdge: "#A7F3D0",

  // Roads and internal circulation
  road: "#0B0B0B",
  roadLine: "#FFFFFF",
  roadCasing: "#2A2A2A",

  // Plot label typography
  labelColor: "#1a1a1a",
  labelHaloColor: "#ffffff",
  labelHaloWidth: 1.4,
} as const;

/** MapLibre match expression for status → fill color. */
export const PLOT_STATUS_FILL_COLOR: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  LAYOUT_DESIGN.available,
  "booked",
  LAYOUT_DESIGN.booked,
  "blocked",
  LAYOUT_DESIGN.blocked,
  LAYOUT_DESIGN.sold,
];

/**
 * Per-property plot fills rendered translucent so the master-plan artwork
 * underneath stays legible. Add a property UUID here to opt its layout in.
 */
export const TRANSLUCENT_PLOT_FILL_PROPERTY_IDS = new Set<string>([
  "d37ee42d-a758-4627-b4ea-507dd9138438",
]);

/** Status colours kept as-is, only the fill alpha drops for opted-in layouts. */
export const TRANSLUCENT_PLOT_STATUS_FILL_COLOR: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  "#10B981",
  "booked",
  "#F59E0B",
  "blocked",
  "#F97316",
  "sold",
  "#EF4444",
  "#8A8178",
];

export const TRANSLUCENT_PLOT_STATUS_FILL_OPACITY: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  1.0,
  "booked",
  1.0,
  "blocked",
  1.0,
  1.0,
];

/** MapLibre match expression for status → outline accent. */
export const PLOT_STATUS_EDGE_COLOR: ExpressionSpecification = [
  "match",
  ["get", "statusNorm"],
  "available",
  LAYOUT_DESIGN.availableEdge,
  "booked",
  LAYOUT_DESIGN.bookedEdge,
  "blocked",
  LAYOUT_DESIGN.blockedEdge,
  LAYOUT_DESIGN.soldEdge,
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

export const LAYOUT_RASTER_SOURCE_ID = "estate-layout-image";
export const LAYOUT_RASTER_LAYER_ID = "estate-layout-raster";

/**
 * Native WebGL paint for PNG/TIFF layout imagery.
 * - nearest resampling: keeps master-plan linework crisp when zoomed in
 * - fade-duration 0: no cross-fade stutter while panning
 * - zoom opacity: slightly stronger when framed on the estate
 */
export const LAYOUT_RASTER_PAINT = {
  "raster-resampling": "nearest" as const,
  "raster-fade-duration": 0,
  "raster-opacity": [
    "interpolate",
    ["linear"],
    ["zoom"],
    13,
    0.55,
    15,
    0.82,
    17,
    0.92,
  ] as ExpressionSpecification,
};

/**
 * Initializes and adds all master-plan GeoJSON sources and design layers to the MapLibre map.
 */
export function initLayoutLayers(map: MapLibreMap) {
  // 1. Add GeoJSON Sources for layout geometry
  if (!map.getSource("estate-site-pad")) {
    map.addSource("estate-site-pad", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("estate-open-areas")) {
    map.addSource("estate-open-areas", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("estate-plots")) {
    map.addSource("estate-plots", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("estate-roads")) {
    map.addSource("estate-roads", { type: "geojson", data: EMPTY_FC });
  }
  if (!map.getSource("estate-road-centers")) {
    map.addSource("estate-road-centers", { type: "geojson", data: EMPTY_FC });
  }

  // 2. Native MapLibre image source for PNG/TIFF master plans.
  // Coordinates are NW → NE → SE → SW (property_layout_cords); replaced on open.
  if (!map.getSource(LAYOUT_RASTER_SOURCE_ID)) {
    map.addSource(LAYOUT_RASTER_SOURCE_ID, {
      type: "image",
      coordinates: [
        [78.37881930400647, 17.136994933863203], // NW (west, north)
        [78.3822802855224, 17.136994933863203], // NE (east, north)
        [78.3822802855224, 17.13329363718222], // SE (east, south)
        [78.37881930400647, 17.13329363718222], // SW (west, south)
      ],
    });
  }

  // Raster lives in WebGL only — no DOM — so it never steals plot clicks.
  // Inserted before plot fills so GeoJSON stays on top for hit-testing.
  if (!map.getLayer(LAYOUT_RASTER_LAYER_ID)) {
    map.addLayer(
      {
        id: LAYOUT_RASTER_LAYER_ID,
        type: "raster",
        source: LAYOUT_RASTER_SOURCE_ID,
        layout: { visibility: "none" },
        paint: LAYOUT_RASTER_PAINT,
      },
      map.getLayer("estate-plots-fill") ? "estate-plots-fill" : undefined,
    );
  }

  // 3. Site Pad (Estate boundary polygon)
  // Transparent fill so satellite imagery shows through clearly without a white/beige opaque shade
  if (!map.getLayer("estate-site-pad-fill")) {
    map.addLayer({
      id: "estate-site-pad-fill",
      type: "fill",
      source: "estate-site-pad",
      layout: { visibility: "none" },
      paint: {
        "fill-color": "transparent",
        "fill-opacity": 0,
      },
    });
  }
  if (!map.getLayer("estate-site-pad-edge")) {
    map.addLayer({
      id: "estate-site-pad-edge",
      type: "line",
      source: "estate-site-pad",
      layout: { visibility: "none" },
      paint: {
        "line-color": LAYOUT_DESIGN.siteEdge,
        "line-width": 1.5,
        "line-opacity": 0.6,
        "line-dasharray": [2, 2],
      },
    });
  }

  // 4. Open Areas & Parks
  if (!map.getLayer("estate-open-fill")) {
    map.addLayer({
      id: "estate-open-fill",
      type: "fill",
      source: "estate-open-areas",
      layout: { visibility: "none" },
      paint: {
        "fill-color": LAYOUT_DESIGN.openArea,
        "fill-opacity": 0.55,
      },
    });
  }
  if (!map.getLayer("estate-open-edge")) {
    map.addLayer({
      id: "estate-open-edge",
      type: "line",
      source: "estate-open-areas",
      layout: { visibility: "none" },
      paint: {
        "line-color": LAYOUT_DESIGN.openAreaEdge,
        "line-width": 1.4,
      },
    });
  }

  // 5. Plots Fills (status: available / booked / sold / blocked)
  if (!map.getLayer("estate-plots-fill")) {
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
          0, // no dark shade for booked, blocked, sold
        ],
      },
    });
  }

  // 6. Plots Outlines (thin black stroke)
  if (!map.getLayer("estate-plots-outline")) {
    map.addLayer({
      id: "estate-plots-outline",
      type: "line",
      source: "estate-plots",
      layout: { visibility: "none" },
      paint: {
        "line-color": "#000000",
        "line-width": 0.5,
        "line-opacity": 0.8,
      },
    });
  }

  // 6b. Available pulse glow — opacity animated by MapSection while layout is open
  if (!map.getLayer("estate-plots-pulse")) {
    map.addLayer({
      id: "estate-plots-pulse",
      type: "line",
      source: "estate-plots",
      filter: ["==", ["get", "statusNorm"], "available"],
      layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": LAYOUT_DESIGN.pulseGlowAvailable,
        "line-width": 3.2,
        "line-opacity": 0.55,
        "line-blur": 1.2,
      },
    });
  }

  // 7b. Plot Number Labels for specific layout (d37ee42d-a758-4627-b4ea-507dd9138438)
  // Shows just the plot number on all plots for this estate
  if (!map.getLayer("estate-plots-plotno-label")) {
    map.addLayer({
      id: "estate-plots-plotno-label",
      type: "symbol",
      source: "estate-plots",
      layout: {
        visibility: "none",
        "text-field": ["to-string", ["get", "plotNo"]],
        "text-justify": "center",
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          16.0,
          8,
          17.0,
          10,
          18.0,
          12,
          19.0,
          14,
        ],
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": true,
        "text-padding": 2,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": "#000000",
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 0,
        "text-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15.5,
          0,
          16.5,
          1,
        ],
      },
    });
  }

  // 7. Available Plot Badge Label (Check icon + AVAILABLE badge + Plot No + Area in sq yd)
  if (!map.getLayer("estate-plots-label")) {
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
              "AVAILABLE\nPlot ",
              ["to-string", ["get", "plotNo"]],
              "\n",
              ["to-string", ["get", "sq_yards"]],
              " sq yd",
            ],
            [
              "concat",
              "AVAILABLE\nPlot ",
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
        "text-font": ["Noto Sans Regular"],
        "text-allow-overlap": false,
        "text-padding": 3,
        "symbol-placement": "point",
        "text-max-width": 6,
      },
      paint: {
        "text-color": "#15803D", // vibrant forest green
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
  }

  // 8. Roads (Fill, Casing, and Edge lines)
  if (!map.getLayer("estate-roads-fill")) {
    map.addLayer({
      id: "estate-roads-fill",
      type: "fill",
      source: "estate-roads",
      layout: { visibility: "none" },
      paint: {
        "fill-color": LAYOUT_DESIGN.road,
        "fill-opacity": 1,
      },
    });
  }
  if (!map.getLayer("estate-roads-casing")) {
    map.addLayer({
      id: "estate-roads-casing",
      type: "line",
      source: "estate-roads",
      layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
      paint: {
        "line-color": LAYOUT_DESIGN.roadCasing,
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
  }
  if (!map.getLayer("estate-roads-edge")) {
    map.addLayer({
      id: "estate-roads-edge",
      type: "line",
      source: "estate-roads",
      layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
      paint: {
        "line-color": LAYOUT_DESIGN.roadLine,
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
  }
  if (!map.getLayer("estate-roads-center")) {
    map.addLayer({
      id: "estate-roads-center",
      type: "line",
      source: "estate-road-centers",
      layout: { visibility: "none", "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": LAYOUT_DESIGN.roadLine,
        "line-width": 1.4,
        "line-dasharray": [2, 2],
      },
    });
  }
}

/**
 * Pushes GeoJSON feature collections for the active project into the map's layout sources.
 */
export function setLayoutData(map: MapLibreMap, project: EstateProject | null) {
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
 * Synchronizes the MapLibre SVG/PNG/TIFF master-plan image when a layout is open.
 *
 * Pins the decoded bitmap into the WebGL image source with real-world corners
 * (NW→NE→SE→SW from `property_layout_cords`). SVG layouts are rasterized to
 * ImageBitmap upstream (`layoutPreview`); a legacy `svgMarkup` still hides this
 * layer in favor of the HTML overlay.
 *
 * Layer stack: satellite → layout raster → GeoJSON plots. Raster never receives
 * click/hover — those hit `estate-plots-*` via map.on('click', layerId, …).
 *
 * Callers may invoke this directly from `applyLayoutRaster` (before React
 * state) so the texture lands on the current animation frame.
 */
export function syncLayoutRaster(
  map: MapLibreMap,
  raster: LayoutRaster | undefined,
  layoutVisible: boolean,
) {
  const source = map.getSource(LAYOUT_RASTER_SOURCE_ID) as ImageSource | undefined;
  if (!source || !map.getLayer(LAYOUT_RASTER_LAYER_ID)) {
    return;
  }

  const useHtmlSvg = Boolean(raster?.svgMarkup);
  const showRaster = Boolean(layoutVisible && raster && !useHtmlSvg);

  if (raster && !useHtmlSvg) {
    try {
      // Native image source: already-decoded PNG/TIFF bitmap + geo corners.
      if (raster.image) {
        source.updateImage({
          image: raster.image,
          coordinates: raster.coordinates,
        });
      } else if (raster.url) {
        source.updateImage({
          url: raster.url,
          coordinates: raster.coordinates,
        });
      }
    } catch (error) {
      console.warn("[ILA map] estate-layout-image updateImage failed", error);
    }

    // Above satellite, strictly under plot fills for hit-testing.
    try {
      if (map.getLayer("estate-plots-fill")) {
        map.moveLayer(LAYOUT_RASTER_LAYER_ID, "estate-plots-fill");
      } else if (map.getLayer("estate-site-pad-fill")) {
        map.moveLayer(LAYOUT_RASTER_LAYER_ID, "estate-site-pad-fill");
      }
    } catch {
      // moveLayer throws if ids are missing mid-teardown — ignore.
    }

    map.setPaintProperty(
      LAYOUT_RASTER_LAYER_ID,
      "raster-resampling",
      LAYOUT_RASTER_PAINT["raster-resampling"],
    );
    map.setPaintProperty(
      LAYOUT_RASTER_LAYER_ID,
      "raster-fade-duration",
      LAYOUT_RASTER_PAINT["raster-fade-duration"],
    );
    // Zoom-dependent opacity (bitmap clarity under plots across scales).
    map.setPaintProperty(
      LAYOUT_RASTER_LAYER_ID,
      "raster-opacity",
      LAYOUT_RASTER_PAINT["raster-opacity"],
    );
  }

  map.setLayoutProperty(
    LAYOUT_RASTER_LAYER_ID,
    "visibility",
    showRaster ? "visible" : "none",
  );
}


