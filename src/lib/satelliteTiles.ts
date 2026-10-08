/**
 * Satellite basemap tiles, drawn over the vector style while an estate layout
 * is open.
 *
 * The vector style (OpenFreeMap) has no imagery variant, so the layout view
 * stacks a raster tile layer underneath the plot polygons. That is far cheaper
 * than swapping the whole style: no sources or layers have to be rebuilt, and
 * the toggle is instant.
 *
 * NOTE: this is added as a plain layer rather than a full satellite style so it
 * can sit *below* the estate overlay. The default endpoint is Esri's public
 * World Imagery service, which is fine for development but is licensed for
 * evaluation use — point NEXT_PUBLIC_SATELLITE_TILES_URL at a contracted
 * provider before shipping this commercially. Attribution must be kept either
 * way.
 *
 * NOTE: this must stay a literal `process.env.NEXT_PUBLIC_*` access. Next.js
 * only inlines that exact string form at build time.
 */

export const SATELLITE_TILES_URL =
  process.env.NEXT_PUBLIC_SATELLITE_TILES_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const SATELLITE_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics";

export const SATELLITE_SOURCE_ID = "satellite-imagery";
export const SATELLITE_LAYER_ID = "satellite-imagery-layer";