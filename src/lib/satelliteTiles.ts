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

/**
 * Highest zoom with real imagery across the project's service area.
 *
 * The default World Imagery service returns a uniform grey "Map data not
 * available" tile at z19 for several localities (for example Akshita Golden
 * Breeze Phase 2 and Song of the South), while z18 still has real imagery.
 * Capping the raster source here keeps MapLibre from requesting those tiles;
 * MapSection also uses it as the satellite camera ceiling.
 */
export const SATELLITE_MAX_ZOOM = 18;

export const SATELLITE_SOURCE_ID = "satellite-imagery";
export const SATELLITE_LAYER_ID = "satellite-imagery-layer";