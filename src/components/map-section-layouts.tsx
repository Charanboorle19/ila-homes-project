import type { Map as MapLibreMap, GeoJSONSource, ImageSource } from "maplibre-gl";
import type { EstateProject, LayoutRaster } from "@/data/projects";

export const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/**
 * Estate Master-Plan & Plots Design Palette
 * Modify these tokens to redesign the plots, status fills, outlines, roads, and open spaces.
 */
export const LAYOUT_DESIGN = {
  // Site boundary / pad
  siteFill: "transparent",
  siteEdge: "#C6A46C",

  // Parks & green open areas
  openArea: "#7CB342",
  openAreaEdge: "#E8F5C8",

  // Plot status fills
  available: "#1F8A68",
  sold: "#8A8178",
  reserved: "#C6A46C",

  // Plot borders / outlines
  plotEdge: "#FFFFFF",
  plotOutlineWidth: 1.15,
  plotOutlineOpacity: 0.95,

  // Selected plot styling
  selected: "#D4A84B",
  selectedEdge: "#FFFFFF",
  selectedOutlineWidth: 3.2,

  // Available plot pulse effect
  pulseGlowAvailable: "#34D399",
  pulseGlowEdge: "#E6FFFA",

  // Roads and internal circulation
  road: "#0B0B0B",
  roadLine: "#FFFFFF",
  roadCasing: "#2A2A2A",

  // Plot label typography
  labelColor: "#1a1a1a",
  labelHaloColor: "#ffffff",
  labelHaloWidth: 1.4,
} as const;

export const LAYOUT_LAYER_IDS = [
  "estate-site-pad-fill",
  "estate-site-pad-edge",
  "estate-open-fill",
  "estate-open-edge",
  "estate-plots-fill",
  "estate-plots-outline",
  "estate-roads-fill",
  "estate-roads-casing",
  "estate-roads-edge",
  "estate-roads-center",
] as const;

export const LAYOUT_RASTER_SOURCE_ID = "estate-layout-image";
export const LAYOUT_RASTER_LAYER_ID = "estate-layout-raster";

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

  // 2. Add georeferenced master plan raster image source & layer
  if (!map.getSource(LAYOUT_RASTER_SOURCE_ID)) {
    map.addSource(LAYOUT_RASTER_SOURCE_ID, {
      type: "image",
      coordinates: [
        [78.37881930400647, 17.136994933863203], // NW
        [78.3822802855224, 17.136994933863203], // NE
        [78.3822802855224, 17.13329363718222], // SE
        [78.37881930400647, 17.13329363718222], // SW
      ],
    });
  }

  if (!map.getLayer(LAYOUT_RASTER_LAYER_ID)) {
    map.addLayer({
      id: LAYOUT_RASTER_LAYER_ID,
      type: "raster",
      source: LAYOUT_RASTER_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "raster-opacity": 0.85,
        "raster-fade-duration": 0,
      },
    });
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

  // 5. Plots Fills (Status based: available vs sold vs reserved)
  if (!map.getLayer("estate-plots-fill")) {
    map.addLayer({
      id: "estate-plots-fill",
      type: "fill",
      source: "estate-plots",
      layout: { visibility: "none" },
      paint: {
        "fill-color": [
          "match",
          ["get", "statusNorm"],
          "available",
          LAYOUT_DESIGN.available,
          LAYOUT_DESIGN.sold,
        ],
        "fill-opacity": 0.82,
      },
    });
  }

  // 6. Plots Outlines
  if (!map.getLayer("estate-plots-outline")) {
    map.addLayer({
      id: "estate-plots-outline",
      type: "line",
      source: "estate-plots",
      layout: { visibility: "none", "line-join": "miter" },
      paint: {
        "line-color": LAYOUT_DESIGN.plotEdge,
        "line-width": LAYOUT_DESIGN.plotOutlineWidth,
        "line-opacity": LAYOUT_DESIGN.plotOutlineOpacity,
      },
    });
  }

  // 7. Plot Number Labels (disabled as requested)
  if (!map.getLayer("estate-plots-label")) {
    map.addLayer({
      id: "estate-plots-label",
      type: "symbol",
      source: "estate-plots",
      layout: {
        visibility: "none",
        "text-field": "",
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
 * Synchronizes the MapLibre raster master-plan image when a layout is open.
 * Native SVG layouts use the HTML overlay instead (`svgMarkup`) and keep this
 * WebGL raster layer hidden so plots stay sharp and clickable above it.
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
  }

  map.setLayoutProperty(
    LAYOUT_RASTER_LAYER_ID,
    "visibility",
    showRaster ? "visible" : "none",
  );
  if (showRaster && raster?.opacity !== undefined) {
    map.setPaintProperty(LAYOUT_RASTER_LAYER_ID, "raster-opacity", raster.opacity);
  }
}


