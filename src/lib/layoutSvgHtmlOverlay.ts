import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayoutRaster } from "@/data/projects/layoutRasters";

/**
 * Positions a native-SVG HTML box from `property_layout_cords` (via LayoutRaster
 * bounds) using MapLibre screen projection. The overlay sits under UI chrome,
 * uses `pointer-events: none`, and stays vector-sharp across zoom.
 */

export function layoutHasSvgOverlay(
  raster: LayoutRaster | undefined | null,
): raster is LayoutRaster & { svgMarkup: string } {
  return Boolean(raster?.svgMarkup);
}

/** Inject SVG markup into the overlay box (once per layout change). */
export function setLayoutSvgOverlayContent(
  box: HTMLElement | null,
  raster: LayoutRaster | undefined | null,
) {
  if (!box) return;
  if (!layoutHasSvgOverlay(raster)) {
    box.innerHTML = "";
    box.hidden = true;
    box.style.opacity = "0";
    return;
  }
  box.innerHTML = raster.svgMarkup;
  box.hidden = false;
  box.style.opacity = String(raster.opacity ?? 0.9);
}

/**
 * Reproject NW/SE corners into CSS pixels relative to the map container and
 * size the SVG box so it matches `property_layout_cords` exactly.
 */
export function syncLayoutSvgOverlayPosition(
  map: MapLibreMap,
  box: HTMLElement | null,
  raster: LayoutRaster | undefined | null,
) {
  if (!box) return;
  if (!layoutHasSvgOverlay(raster)) {
    box.hidden = true;
    return;
  }

  const { minLng, minLat, maxLng, maxLat } = raster.bounds;
  const nw = map.project([minLng, maxLat]);
  const se = map.project([maxLng, minLat]);
  const width = Math.max(1, se.x - nw.x);
  const height = Math.max(1, se.y - nw.y);

  box.hidden = false;
  box.style.transform = `translate3d(${nw.x}px, ${nw.y}px, 0)`;
  box.style.width = `${width}px`;
  box.style.height = `${height}px`;
}
