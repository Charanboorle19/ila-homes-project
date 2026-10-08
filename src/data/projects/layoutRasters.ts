import type { PropertyLayoutCords } from "@/services/propertiesService";

/** Bounds of a master-plan image, in WGS84 degrees. */
export type LayoutRasterBounds = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/**
 * An image the map can draw without another network request, i.e. what
 * MapLibre's `updateImage({ image })` accepts. A layout fetched from a bucket
 * with no CORS headers has to be decoded here first — see @/lib/layoutPreview.
 */
export type LayoutRasterImage =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap
  | ImageData;

/** MapLibre image-source corners: top-left → top-right → bottom-right → bottom-left [lng, lat]. */
export type LayoutRaster = {
  id: string;
  /** Served from this origin, so the map may fetch it itself. */
  url?: string;
  /** Already-decoded image, for bytes fetched through the same-origin proxy. */
  image?: LayoutRasterImage;
  /** Clockwise corner coordinates in WGS84. */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  opacity: number;
  bounds: LayoutRasterBounds;
};

/**
 * MapLibre image-source corners: top-left → top-right → bottom-right → bottom-left [lng, lat].
 *
 * Derived from layoutCordsToBounds, so an extent that arrives with `east` below
 * `west` (or `south` above `north`) still maps the right way up instead of
 * drawing the plan inside-out.
 */
export function layoutCordsToCoordinates(
  cords: PropertyLayoutCords,
): LayoutRaster["coordinates"] {
  const { minLng, minLat, maxLng, maxLat } = layoutCordsToBounds(cords);
  return [
    [minLng, maxLat], // NW
    [maxLng, maxLat], // NE
    [maxLng, minLat], // SE
    [minLng, minLat], // SW
  ];
}

export function layoutCordsToBounds(cords: PropertyLayoutCords): LayoutRasterBounds {
  return {
    minLng: Math.min(cords.west, cords.east),
    minLat: Math.min(cords.south, cords.north),
    maxLng: Math.max(cords.west, cords.east),
    maxLat: Math.max(cords.south, cords.north),
  };
}

/**
 * Shreyas Green layout TIFF georeference (EPSG:3857 meters):
 * east 8725475.5286 · west 8725090.2539 · north 1936777.9021 · south 1936346.7373
 * Converted to WGS84 for MapLibre. Source asset: src/app/assets/shreyas_green_layout_asset.tif
 */
export const SHREYAS_GREEN_LAYOUT_RASTER: LayoutRaster = {
  id: "shreyas-green-layout",
  url: "/map/shreyas-green-layout.png",
  coordinates: [
    [78.37881930400647, 17.136994933863203], // NW
    [78.3822802855224, 17.136994933863203], // NE
    [78.3822802855224, 17.13329363718222], // SE
    [78.37881930400647, 17.13329363718222], // SW
  ],
  opacity: 0.85,
  bounds: {
    minLng: 78.37881930400647,
    minLat: 17.13329363718222,
    maxLng: 78.3822802855224,
    maxLat: 17.136994933863203,
  },
};

type BoundsLike = LayoutRaster["bounds"];

export function boundsOverlap(a: BoundsLike, b: BoundsLike): boolean {
  return (
    a.minLng <= b.maxLng &&
    a.maxLng >= b.minLng &&
    a.minLat <= b.maxLat &&
    a.maxLat >= b.minLat
  );
}

export function layoutRasterForBounds(bounds: BoundsLike): LayoutRaster | undefined {
  if (boundsOverlap(bounds, SHREYAS_GREEN_LAYOUT_RASTER.bounds)) {
    return SHREYAS_GREEN_LAYOUT_RASTER;
  }
  return undefined;
}
