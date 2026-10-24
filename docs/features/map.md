# Map feature

## Layout loading

`MapSection` first tries `/layouts/{propertyId}.webp`; if no valid local image is available, it continues through the existing prefetched/S3 loaders. Decoded remote previews are cached by property ID and full preview URL for 45 minutes, so a prefetched payload can reuse its decoded bitmap when the source URL is unchanged.

## 1. Feature purpose

The project has two MapLibre-based map components:

- `MapSection` displays API-backed properties, property pins, and selectable estate/plot layouts.
- `GrowthCorridors` displays API-backed locations/localities and lets the visitor inspect a location and its properties.

**Only `MapSection` is rendered on the home page (`/`)**, and it is the only map section that route contains (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx`). The homepage first paints `IlaIntroLoader` over a lightweight map skeleton. The splash is **uncoupled from MapLibre**: it fades out on a fixed timer (max **3,800 ms**, with the fade starting at **3,300 ms**) and never waits for `onMapLoaded` / tile completion, so LCP can register on the intro/placeholder. `MapSection` is loaded dynamically (`next/dynamic` with `ssr: false`) and mounts after **1,800 ms** (`shouldMountMap`) independently of the splash. `GrowthCorridors` still exists in the source but is no longer imported by the homepage; everything documented about it below describes the component as it stands, not a live part of `/`.

## 2. User interaction / flow

### Property and plot map (`MapSection`)

1. `src/app/page.tsx` is a Server Component that fetches the upstream catalogue (`GET /api/properties?status=ALL&page=1&per_page=100`) directly with `next: { revalidate: 300 }` (Data Cache at the edge) and passes `initialProperties` into `HomeClientView` and `MapSection`. In `MapSection`, `propertyList` and initial coordinates `propertyAnchors` are seeded synchronously into state on mount. If `initialProperties` is already present, redundant client-side duplicate fetches are skipped; otherwise, a client-side fetch is performed as a fallback. The Wishlist drawer receives `properties={propertyList}` and does not re-fetch the same list; favourites load only when the drawer is opened (`if (!isOpen) return`).
2. Property coordinates are taken from the list where available (seeded into `propertyAnchors` as soon as the list resolves). Missing coordinates are backfilled through `fetchPropertyAnchors` only after MapLibre's first `idle` (basemap tiles painted), at concurrency `2`, so detail GETs do not contend with style/tile/sprite streaming. Progressive arrivals are buffered and flushed to state via `requestAnimationFrame`. Bottom Find-Your-Plot feature chips load via `fetchActiveFeatures` (`GET /api/features`) only after `mapReady` plus an 800 ms delay, so that request stays off the initial paint path.
3. Properties with usable coordinates receive WebGL property pins: a GeoJSON `FeatureCollection` source (`property-pins`) rendered with MapLibre `symbol` layers (`property-pins-icon`, `property-pins-label`). Icons are the branded gold-and-charcoal ILA teardrop (monogram from `ILA-ICON.html`, needle tip) registered via `src/lib/ilaMapPinImage.ts` (`ila-pin`, `ila-pin-highlight`, `ila-pin-compare`). Pin position and compare/EMI/feature-filter visual state update via `source.setData` on the GPU — no HTML `Marker` DOM nodes. The open estate's own pin is filtered out (`hidden`). Selecting a property pin or a property row smoothly animates the property summary card / results popup into view and loads its units/layout. Listing-row and pin `mouseenter` call `prefetchEstate` to warm data when a visitor shows interest.
4. Opening a property layout uses `getEstateData(id)` (`GET /api/estates/{id}`) for property + units in one cached call. As soon as `layoutCords` + a layout URL exist, `attachLayoutImage` starts concurrently with `estateFromUnitsApi` plot building (pending raster merges into `estate.layoutRaster` before the first `setRemoteProject`). Warm `peekLayoutAsset` hits skip the candidate/refresh loop. Layout assets use `getLayoutAsset` → SVG/PNG/TIFF decoded to MapLibre `estate-layout-image` bitmaps (SVG is rasterized to `ImageBitmap`, not injected as HTML markup). `applyLayoutRaster` calls `syncLayoutRaster(map, raster, true)` on the live map before React state so the texture paints on the current frame; redundant `setRemoteProject` updates are skipped when the same raster was already merged via `pendingLayoutRef`.
5. A plot can be selected from the map or list. The plot selection highlights the polygon and displays a plot detail card styled identically to the minimized `PropertyBlock` (warm ivory `#f9f7f2` card, subtle `#ded9cf` borders, location pin, price badge, area and facing chips, and quick dismiss). It includes two action buttons: **Enquiry** (opens the `HomeReadyToVisit` site-visit/enquiry form modal tailored for the selected plot) and **View Property** (navigates to `/properties/{id}`). Dismissing the plot popup automatically returns to the open development's `PropertyBlock` summary card instead of leaving an empty map canvas. Map viewport exploration analytics (`MAP_ZOOM_REGION`) are debounced by 800 ms to avoid saturating the event queue during active gestures.
6. **First-time visitor feature tutorial (`FeatureTutorial`):** A guided onboarding spotlight tutorial automatically guides first-time visitors through key platform capabilities: **Wishlist** (save & WhatsApp share), **Instant EMI Calculator**, **Compare Up to 5 Properties**, and **Find Your Plot** smart filters. `MapSection` mounts `FeatureTutorial` only after `mapReady` plus a 2,000 ms delay (`showTutorial`), so the logo and map can register as LCP before the walkthrough card paints. Once mounted, the tutorial checks the `ila_tutorial_seen` cookie (1-year duration); if absent, it launches with an interactive dark overlay, target element glow ring, card explanation, step dots, and "Next" / "Skip" buttons. Completing or skipping the tutorial sets the cookie so it is never shown redundantly on subsequent visits. Spotlight pulse keyframes (`ilaTutorialPulse`, `ilaBeaconPing`) animate only `transform` and `opacity` (with `will-change`) so the rings stay GPU-composited; they do not animate `box-shadow`, SVG `stroke`, or `filter`.
7. The quick action toolbar on the right side provides quick access to Wishlist, EMI Calculator, and Compare Properties. The modal components for Compare Properties (`CompareProperties`) and the EMI calculator (`PriceEmiFuture`) are dynamically loaded on-demand via `next/dynamic` to keep the initial homepage map JavaScript chunk minimal. When the map is maximized (fullscreen), the right-side quick action buttons and the maximize button are hidden to provide an uncluttered full map experience. When EMI Calculator selection mode is activated, other floating options (Wishlist, Compare Properties, and FindYourPlot) are cleanly hidden, and a centered top note smoothly animates down to direct the visitor: "Select a property on the map to EMI calculate". When Compare is clicked, the UI enters Compare selection mode and cleanly hides all other floating options on the map (Wishlist, EMI Calculator, FindYourPlot feature cards, Developments sidebar button/panel, and zoom/fullscreen controls) leaving only the top guidance header, bottom property selection drawer, and selectable property map pins. Closing the comparison results popup (or clicking the close cross in the bottom bar or top notice) fully dismisses compare mode and resets selections, returning all regular map controls to view.

### Location/Development map (`GrowthCorridors`)

1. `GrowthCorridors` loads properties with `GET /api/properties?status=ALL&page=1&per_page=100`.
2. The visitor opens map mode from a property card's `Map` button or the header's `View all on map`. When entering map mode, the section is presented smoothly from the start of the section (`sectionRef`) without skipping down past the section header.
3. Properties with coordinates appear on the map and in the mobile development switcher strip.
4. When map mode is open, clicking `Back` exits map mode and returns to the card list view. If the map is currently maximized in fullscreen mode, clicking `Back` minimizes the map first.
5. Selecting a development or plot shows its details without obstructing the map canvas on mobile.

## 3. Map library and configuration

- Library: `maplibre-gl` `^6.12.0` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\package.json`).
- `MapSection` imports `Map as MapLibreMap`, `GeoJSONSource`, and `setWorkerUrl` from `maplibre-gl` (property pins are native GeoJSON layers, not HTML `Marker`s). `GrowthCorridors` still imports `Marker` for its active-location pin.
- Both components call `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.
- The build/postinstall script copies MapLibre worker files from `node_modules/maplibre-gl/dist` to `public/maplibre/` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\scripts\copy-maplibre-worker.cjs`).
- `MapSection` and `GrowthCorridors` use `https://tiles.openfreemap.org/styles/liberty` as `MAP_STYLE`.
- Custom MapLibre text layers use OpenFreeMap-hosted `Noto Sans Regular` glyphs; avoid unavailable font stacks such as `Arial Unicode MS`, which produce glyph-range 404s.
- `MapSection` fetches that style, prunes unused Liberty layers via `loadPrunedLibertyStyle` (`src/lib/pruneLibertyStyle.ts`), then passes the pruned JSON into `new Map()` — not the raw URL. Dropped categories: railways (`*rail*`), 3D building extrusion (`building-3d`), pedestrian paths (`*path_pedestrian*`, `highway-name-path`), highway shields (`*shield*`), and airport POIs (`airport`). Flat `building` footprints are kept. This avoids unused glyph `.pbf` requests and reduces style-layer work during tile parse on mobile.
- `MapSection` initializes with `maxTileCacheSize: 15`, `renderWorldCopies: false`, and `fadeDuration: 0`.
- `MapSection` uses a raster satellite source/layer over the vector style while an estate layout is open. The URL is `NEXT_PUBLIC_SATELLITE_TILES_URL`, defaulting to Esri World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. Attribution is `Imagery © Esri, Maxar, Earthstar Geographics`. The default service returns a uniform grey “Map data not available” placeholder at z19 for several project localities, while z18 still has imagery, so `SATELLITE_MAX_ZOOM = 18` caps both raster sources (`MapSection` and `GrowthCorridors`). While satellite imagery is visible, `MapSection` also caps the camera at z18 and shows the “Maximum Zoom Reached” notice; switching back to the default vector view restores the normal z18.5 ceiling.
- `MapSection` uses `LAYOUT_MAX_ZOOM = 17.2`; `GrowthCorridors` uses `DEFAULT_VIEW = { longitude: 78.44, latitude: 17.17, zoom: 11.35 }` and `LOCATION_ZOOM = 13.2`.

## 4. Relevant component file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx` — property/plot map and `PropertySheet`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\map-section-layouts.tsx` — master-plan GeoJSON layers, design tokens, and layout raster synchronization.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\GrowthCorridors.tsx` — locations map and location/property exploration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` — catalogue list used by `/properties`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — property API types and requests.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\locationsService.ts` — location API types and requests.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\projects\index.ts` — static estate/GeoJSON project construction.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\projects\fromApi.ts` — units-response-to-estate conversion.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\plots.ts` — `Plot` and `PlotStatus` types plus legacy/sample plot data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\satelliteTiles.ts` — satellite source configuration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\layoutPreview.ts` — layout format detection and priority (`resolveLayoutImageCandidates`: SVG → TIFF → PNG). SVG is rasterized to `ImageBitmap` (blob URL + `createImageBitmap`); available units render with a vibrant, noticeable emerald green fill (`#10B981`) and crisp deep emerald outline (`#047857`). Short, neat, and compact floating tags (`Plot <no> · <sq_yd> sq yd`) display strictly for available plots when zoomed into the master plan (`zoom >= 16.5`), staying hidden when zoomed out; non-available plots (booked/sold/blocked) do not display tags when clicked, presenting only the plot detail popup. The selected plot features a translucent emerald green highlight (`#10B981` at `0.55` opacity) and green outline (`#047857`). Non-available units (`BOOKED`, `SOLD`, `BLOCKED`) maintain muted dark tones (`#000000` at `0.32` opacity). Georeference from `property_layout_cords` in EPSG:4326 (NW→NE→SE→SW `[lng, lat]`).
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\layoutSvgHtmlOverlay.ts` — legacy HTML SVG overlay (`svgMarkup`) content + `map.project` position sync; live loads no longer set `svgMarkup`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\layoutTiff.ts` — TIFF layout decode (geotiff.js → ImageBitmap) for the MapLibre `estate-layout-image` source; stacked above satellite and below plot fills.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\estatePrefetch.ts` — client in-memory prefetch cache for `GET /api/estates/{id}` and `/api/layout-image` (deduped promises; layout keys via `getAssetCacheKey` strip presigned query strings; `peekLayoutAsset` for warm fast-path; optional `clearEstateCache`).
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\loading.css` — shared loading animation used by both components.

## 5. Data sources used by the map

`MapSection` uses:

- Live property list/detail/unit data from the properties API.
- Static projects `SARK_GREEN_PROJECT` and `GREEN_MEADOWS_PROJECT` from `src/data/projects/index.ts`.
- Static GeoJSON imports: `src/ila-demo-project/sark-green-plots.json`, `sark-green-road.json`, `sark-green-main-road.json`, and `src/data/projects/geo/green-meadows-plots.json`, `green-meadows-roads.json`, `green-meadows-open-areas.json`.
- API-provided layout image URLs and layout coordinates when a live property supplies them.
- OpenFreeMap vector tiles and optional Esri raster imagery.

`GrowthCorridors` uses live `/api/locations` and location-filtered `/api/properties` data only. Its source comment states there is no local demo location data.

## 6. Property/plot data structure used by the map

The normalized plot type is `Plot` (`src/data/plots.ts`):

```ts
{
  id: string;
  title: string;
  area: string;
  facing: string;
  location: string;
  price: string;
  status: "available" | "booked" | "sold" | "blocked";
  lng: number;
  lat: number;
  polygon: [number, number][];
  image: string;
}
```

API unit status strings are normalized in `src/lib/plotStatus.ts` (`normalizePlotStatus`): e.g. `AVAILABLE`/`AVL`/`OPEN` → `available`, `BOOKED`/`RESERVED`/`HOLD` → `booked`, `SOLD` → `sold`, `BLOCKED`/`LOCKED`/`NOT_FOR_SALE` → `blocked`. GeoJSON features also carry `statusNorm` and customer-facing `statusShort` (`Open` / `Held` / `Sold` / `Locked`) for map labels.

The normalized estate type is `EstateProject` (`src/data/projects/index.ts`): `id`, `name`, `location`, `center`, `bounds`, `plots`, `sitePadGeo`, `plotsGeo`, `roadsGeo`, `roadCenterlinesGeo`, `openAreasGeo`, and optional `layoutRaster`.

API property records contain fields including `id`, `location_id`, `name`, `slug`, `description`, `property_type`, `price`, `minimum_price`, `target_price`, `price_label`, inventory fields, `status`, address/location fields, `latitude`, `longitude`, `area`, `facing`, `amenities`, `connectivity_score`, and `rera_registered`. The complete typed subset is in `ApiProperty` in `src/services/propertiesService.ts`.

## 7. APIs used by the map

- `GET /api/properties?status=ALL&page=1&per_page=100` — initial property list and map pins (`fetchProperties`).
- `GET /api/properties/{id}` — property detail and fallback coordinate lookup (`fetchPropertyById`). `{id}` must be the property UUID, not the slug.
- `GET /api/properties/{id}/units?limit=all` — plot/unit geometry and optional layout data (`fetchPropertyUnits`).
- `GET /api/estates/{id}` — same-origin aggregate of property detail + units (`prefetchEstate` / `getEstateData` in `estatePrefetch.ts`); on success may kick off `prefetchLayoutAsset` for `units.layout_preview_url`.
- `GET /api/layout-image?url=…` — same-origin layout asset proxy; also prefetched/cached by `prefetchLayoutAsset` / `getLayoutAsset`.
- `GET /api/locations?page={page}&per_page={perPage}` — locations (`fetchLocations`).
- `GET /api/properties?location_slug={slug}&page={page}&per_page={perPage}` — properties for a selected location (`fetchPropertiesByLocation`).

`fetchNearbyPlaces` exposes `GET /api/properties/{id}/nearby-places`, but it is not used by `MapSection` or `GrowthCorridors` for the map.

## 8. API request/response structure

Requests are sent through `apiFetch` (`src/services/apiClient.ts`) to `NEXT_PUBLICAPIURL`, with:

- `X-Tenant-Domain`: current browser hostname, or `SITE_DOMAIN` server-side.
- `Accept: application/json`.
- `ngrok-skip-browser-warning: true`.
- Optional `Authorization: Bearer {localStorage.token}`.

List responses are expected as:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "per_page": 20
  }
}
```

The units response is unwrapped by `fetchPropertyUnits` and supports a payload containing an array, `units`, `plots`, or `items`, or a GeoJSON `FeatureCollection`. Unit features are normalized with fields such as `plot_no`, `status`, `facing`, `sq_yards`, `sq_ft`, `price`, `per_sq_yard_price`, `per_sq_ft_price`, and optional centroid coordinates. Layout imagery format priority is **SVG → TIFF → PNG** (JPEG/WebP count as PNG-tier). `resolveLayoutImageCandidates` in `layoutPreview.ts` inspects both `layout_preview_url` and `tif_url`, sorts by that priority, and `attachLayoutImage` tries each until one loads. SVG → `ImageBitmap` via `rasterizeSvgToImageBitmap` (no DOM overlay injection); TIFF → `loadLayoutRaster` (geotiff); PNG-tier → bitmap via `loadLayoutPreviewRaster`. All feed MapLibre `estate-layout-image` and are georeferenced with `property_layout_cords` in EPSG:4326 (NW→NE→SE→SW `[lng, lat]`). If `property_layout_cords` is empty or missing, layout bounds are derived from unit polygon coordinates (`estate.bounds`). Exact backend response variants beyond this normalization are UNKNOWN — needs verification.

## 9. Functions and hooks used

`MapSection` uses `useCallback`, `useEffect`, `useMemo`, `useRef`, and `useState`; MapLibre `LngLatBounds`, `Map`, and `GeoJSONSource`; and functions including `syncLayoutRaster`, `loadRasterForProperty`, `fetchProperties`, `fetchPropertyAnchors`, `getEstateData`, `prefetchEstate`, `getLayoutAsset`, `estateFromUnitsApi`, `estatePlaceholderFromProperty`, `propertyAnchor`, `loadLayoutPreviewFromPrefetch`, `loadLayoutPreviewRaster`, `loadLayoutRaster`, `loadLayoutRasterFromBuffer`, `pinsToGeoJSON`, `ensurePropertyPinLayers`, `formatPrice`, `formatInr`, and `trackEvent`.

`GrowthCorridors` uses `useEffect`, `useMemo`, `useRef`, and `useState`; MapLibre `Map` and `Marker`; and `fetchLocations`, `hasCoordinates`, `fetchPropertiesByLocation`, `formatPrice`, and `trackEvent`.

## 10. State management and important state variables

There is no external map store; state is local React component state.

`MapSection` important state includes `mapReady`, `showTutorial`, `mapError`, `activeProjectId`, `panelOpen`, `filter`, `query`, `selectedId`, `selectedProjectId`, `mobilePlotExpanded`, `propertySheetExpanded`, `remoteProject`, `remoteStatus`, `propertyList`, `propertyAnchors`, `activePropertyDetail`, `unitsCount`, and `focusRequest`. Refs include `mapContainerRef`, `mapRef`, and `sectionRef`.

`GrowthCorridors` important state includes `mapMode`, `mapReady`, `locations`, `locationsState`, `page`, `perPage`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`, `activeLocationId`, `properties`, `propertiesTotal`, and `propertiesState`. Refs include `mapContainerRef`, `mapRef`, and `markerRef`.

## 11. Property selection behavior

`MapSection` maintains separate layout selection (`activeProjectId`), property-sheet selection (`selectedProjectId`), and plot selection (`selectedId`). Opening a plot clears the property summary selection; opening a project/property clears the plot selection. A property with no units can still show a property sheet and pin, but has no plot geometry to draw. A property without coordinates receives no pin.

Static projects are selected by project id (`sark-green` or `green-meadows`). API properties use their UUID as the project id after conversion.

## 12. Map controls and interactions

The current UI provides:

- Map pan/zoom through MapLibre's standard map interaction.
- Property/plot list selection and map selection.
- Plot status filtering / legend: `all`, `available`, `booked`, `sold`, `blocked` (clickable swatches with counts in a single top row while a layout is open).
- Text query filtering in the property/plot panel.
- Layout open/close behavior: closing an estate layout or desktop property block resets the map camera back to the normal zoomed-out portfolio view (`fitBounds` on `pinsBounds`).
- Mobile plot-list expansion and property-sheet expansion.
- Satellite/layout imagery visibility controls in the estate layout view.
- Per-locality `Map` and `Explore` controls, location selection, map mode open/close, location pagination, and `Explore` links in `GrowthCorridors`.

The source does not expose a separate documented compass, geolocation, or drawing control. UNKNOWN — needs verification whether MapLibre's default attribution/control UI is visually enabled by the current rendered style.

## 13. Markers, polygons, labels, or layers

`MapSection` uses a WebGL GeoJSON property-pin source (`property-pins`) with layers `property-pins-icon` (branded ILA pin images) and `property-pins-label` (price / compare text), plus estate GeoJSON/raster sources. Pin labels are warm-ivory price tags with charcoal text, a gold hairline, a short gold accent rule and a soft baked drop shadow (gold tags with charcoal text for compare badges): stretchable sprites `ila-pin-label-bg` / `ila-pin-label-bg-compare` from `src/lib/ilaMapPinImage.ts`, applied with MapLibre `icon-text-fit: both` so the tag grows around the price text. Tag offsets hug the pin’s circular head without covering it: side tags keep a ~3px gap from the head and are level with it, and above-head tags sit ~3px above the head’s top edge. The offsets account for the stretchable tag’s fixed left/right text inset plus `icon-text-fit-padding`, so the tag sits beside the head without covering it. Tag side is **not fixed to the right**: `pinsToGeoJSON` writes a per-feature `labelPlacement` pair (one neighbor-aware MapLibre anchor + offset) consumed by `text-variable-anchor-offset`, preferring left/right/above-head sides away from nearby pins. Emitting a single side is deliberate: trying every candidate made MapLibre fall back to another side whenever zoom changed the collision result, so tags jumped around while zooming. With one fixed side per pin, a tag is simply visible or hidden; zoom changes never move it. Label-layer collision is enabled (`text-allow-overlap` / `icon-allow-overlap` false): when tags would overlap (especially zoomed out), one tag stays in front and the rest are hidden rather than mixed into an unreadable stack; zooming in reveals more. Pin icons on `property-pins-icon` still always overlap so every pin remains visible. Compare/highlight tags win collisions via a lower `symbol-sort-key`. Pin layers are added before estate layout layers so plot polygons stay on top and remain clickable. Estate layer ids are:

`estate-site-pad-fill`, `estate-site-pad-edge`, `estate-open-fill`, `estate-open-edge`, `estate-plots-fill`, `estate-plots-outline`, `estate-plots-pulse`, `estate-plots-label`, `estate-roads-fill`, `estate-roads-casing`, `estate-roads-edge`, and `estate-roads-center`.

The plot fill palette is: available `#1F8A68` (strongest + breathing pulse outline via `estate-plots-pulse`), booked `#C6A46C`, sold `#8A8178`, blocked `#3A3A3A`, selected `#D4A84B`, status-tinted edges, green open areas, and black/white road styling. Non-available fills are dimmed so open inventory reads first. **Opted-in layouts** (`TRANSLUCENT_PLOT_FILL_PROPERTY_IDS` in `map-section-layouts.tsx`) keep those status colours but paint every unselected plot at reduced alpha (available 0.4; booked/sold/blocked 0.35) so the master-plan artwork underneath stays legible; property `d37ee42d-a758-4627-b4ea-507dd9138438` is currently opted in. Plot labels (`estate-plots-label`) carrying plot numbers and status texts, as well as the yellow dotted site pad boundary line (`estate-site-pad-edge`), are hidden on the layout view for a cleaner aesthetic. A top-of-map single-row legend explains the four statuses and filters the map when tapped. Detail cards use matching status pills.

**Layout SVG / PNG / TIFF (native WebGL):** fetched via `/api/layout-image`. SVG markup is rasterized to `ImageBitmap` (blob URL → `Image.decode` → `createImageBitmap`); TIFF uses geotiff.js; PNG-tier uses bitmap decode. WebP assets are resized directly from the source blob to a maximum 4096px long edge; other raster formats retain the GPU `MAX_TEXTURE_SIZE` limit (hard cap 8192px). All register on MapLibre image source `estate-layout-image` / raster layer `estate-layout-raster` with corners NW→NE→SE→SW from `property_layout_cords`. `applyLayoutRaster` may call `syncLayoutRaster` immediately on the live map instance before `setRemoteProject`. Paint uses `raster-resampling: nearest`, `raster-fade-duration: 0`, and zoom-interpolated `raster-opacity`. Stack: satellite → layout raster → GeoJSON plots — the raster is visual-only and does not intercept clicks (`map.on('click', 'estate-plots-fill', …)` hits plots directly). A legacy HTML SVG overlay path still exists for `LayoutRaster.svgMarkup` (hidden WebGL raster when set) but live loads no longer populate it.

**PNG/SVG alignment:** Corners always come from `layoutCordsToCoordinates(property_layout_cords)` (NW→NE→SE→SW `[lng,lat]`, same as MapLibre image-source top-left→…→bottom-left). The decoded bitmap/SVG is uploaded **as-is** to `estate-layout-image` — no mercator letterboxing. That matches a QGIS EPSG:4326 georeferenced PNG overlay (`[WEST,NORTH]…[WEST,SOUTH]`). SVG rasterization uses `preserveAspectRatio="none"` so content fills the texture edge-to-edge before those corners are applied. Assets should be authored edge-to-edge for the extent (no outer padding/legends); baked-in margins cannot be trimmed at runtime.

Satellite imagery uses source id `satellite-imagery` and layer id `satellite-imagery-layer`.

`GrowthCorridors` uses one `Marker` for the active location and does not render polygons or estate layers.

## 14. How the map connects to the Property Popup

There is no component named `PropertyPopup` in the inspected source. The equivalent is `PropertySheet` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`.

`PropertySheet` receives the selected `EstateProject`, selected `PropertyRecord`/API detail, plot count/data, and selection callbacks. Its tabs are `about`, `location`, `amenities`, and `developer`. It opens when `selectedProjectId` is set and is closed by clearing `selectedProjectId`/`activeProjectId`.

### The mobile property sheet is full-bleed

Below `md`, `PropertySheet` is rendered through a React portal onto `<body>` rather than inside the map frame. The portal is necessary because the map frame carries `overflow-hidden`, which clipped the sheet and made it a child of a card instead of a surface in its own right; `fixed` from `<body>` escapes every clipping ancestor.

The sheet is **`fixed inset-x-0 bottom-0`** — full viewport width. It was `inset-x-2`, an 8px inset per side chosen to line the sheet up with the map card's own `mx-2` gutters. That nested it inside a second frame the map was not in, and the doubled margin read as a card floating above the fold rather than as a sheet attached to the screen. Full bleed leaves the two top corners as the only rounded ones, and `bottom-0` docks it so the square bottom corners read as deliberate.

Height uses percentages (`h-48` collapsed, `h-[88%]` expanded) and the bottom padding uses `env(safe-area-inset-bottom)` — never `dvh`, which would resize the sheet whenever the mobile browser shows or hides its URL bar. The sheet is suppressed entirely in fullscreen, where the map is the whole point.

### The mobile sheet is dark; the desktop sidebar is not

`PropertySheet` renders in two places with genuinely different surfaces, so it takes an explicit `tone: "light" | "dark"` prop. It **defaults to `light`**, which is the desktop sidebar sitting in the light `#d9d2c7` panel; only the phone bottom sheet passes `tone="dark"`.

The prop is explicit rather than derived from `dense`. `dense` already distinguishes the two hosts, but it means "compact type scale", not "dark surface" — deriving colour from it would silently couple two unrelated decisions.

`SHEET_TONE` in `MapSection.tsx` holds both palettes as class strings. Two reasons it is a table of class strings rather than CSS custom properties:

- arbitrary-value `var()` calls would make every themed colour invisible to Tailwind's scanner and to anyone grepping for a hex;
- a missing key is a TypeScript error rather than an invisible fallback.

| | Light (desktop sidebar) | Dark (phone sheet) |
|---|---|---|
| Sheet shell | `bg-[#f5f2ea]` | `bg-[#141519]` |
| Tab bodies / stats list | `bg-white`, `border-[#ded9cf]` | `bg-white/[0.06]`, `border-white/10` |
| Primary ink | `text-[#24231f]` | `text-[#f2f0ea]` |
| Muted copy | `text-[#77736a]` / `text-[#8a8174]` | `text-[#a8a49c]` / `text-[#8a857c]` |
| Gold ink | `text-[#a07c3c]` (no-image) / `text-[#8a6d34]` (labels) | `text-[#c6a46c]` |
| Price block | inverted dark gradient, `#3a362e` edge | **lighter** than the shell — `from-[#2b2f36] via-[#21252b] to-[#1a1e23]`, gold edge |
| Primary action | `bg-[#24231f] text-white` | `bg-[#c6a46c] text-[#171717]` |
| Secondary / tertiary | white `bg-white` with `#ded9cf` edge | `bg-white/[0.06]` / `[0.04]`, `border-white/15` |
| Approval chip | `bg-[#f2f7f2] text-[#1f5c45]` | `bg-[#1f8a68]/15 text-[#6fd0a8]` |

Three things the dark palette had to invert rather than just re-tint:

1. **The price block stops being the dark surface.** On the light sheet it was the only inverted block, which is what made it the most-sought value. On a dark shell it would disappear into the background, so it becomes a step *lighter* than the shell with a gold hairline instead of a `#3a362e` one.
2. **The primary action flips from near-black to gold.** `bg-[#24231f] text-white` on `#141519` is a 3% step and reads as a hole.
3. **The close button inverts too.** It was `bg-[#171717]` when the shell was cream; on a `#141519` shell that is invisible, so it is now `bg-[#f2f0ea] text-[#141519]`. It keeps the same role — light fill, dark glyph — and still reads as the destructive exit. The maximize button's `#c6a46c` fill needed no change and remains the only gold in the control row.

The `onPhoto*` keys are deliberately identical in both palettes: the hero carries its own `from-black/88` gradient scrim, so white copy is correct over a photo regardless of the shell behind it.

### Its two controls are 40px and filled

| Control | Size | Treatment | Meaning carried by the fill |
|---|---|---|---|
| Close | `h-10 w-10` (40px), `CloseIcon` `h-4 w-4` | `bg-[#f2f0ea]`, `#141519` glyph | Ends the sheet. A light fill with a dark glyph is the inverse of the near-black fill it used on the cream sheet, which is why the value had to change when the shell went dark. |
| Maximize | `h-10 w-10` (40px), `ExpandIcon` `h-4.5 w-4.5` | `bg-[#c6a46c]`, `#171717` glyph | Opens the full card. The section's gold — the same accent the price block and the status chips sit on — because it is the action that *adds* something rather than ending it. |

Both were `h-7 w-7` (28px) with a `bg-white/85` fill and a `border-white/70` hairline. Two problems:

- **28px is well under the 44px touch minimum**, and on a sheet whose whole job is one-thumb tapping it was the smallest target in the section.
- **`bg-white/85` on the sheet's own surface is invisible** — a near-invisible step on the cream sheet it started on, and pure white-on-white once the shell went dark. The solid fills make each legible on its own, and differing them means they read as two different actions rather than as a matched pair of decorations.

The row is symmetric — close, centred grabber, maximize — so the right-hand spacer while expanded is also `h-10 w-10`. A mismatched spacer would push the centred grabber off-centre by exactly the size difference.

## 15. How the map connects to the Property List

The homepage property/plot list is rendered inside `MapSection` and uses the same `propertyList`, `propertyAnchors`, `remoteProject.plots`, `filter`, `query`, and selection state as the map. Clicking a list item calls the same project/plot opening logic used by map selections.

The separate catalogue at `/properties` renders `PropertiesList` and does not share React state with `MapSection`; both call the same property service. Catalogue links navigate to `/properties/{property.id}`.

## 16. How the map connects to Search

`MapSection` has its own `query` state for filtering the visible property/plot panel. It is not connected to the homepage hero search state.

`Hero` (`src/components/Hero.tsx`) accepts a typed query, tracks `PROPERTY_SEARCH`, and scrolls to `#projects` or navigates to `/#projects`. `scrollToProjects` looks up `PROJECTS_ANCHOR_ID` with `document.getElementById` and calls `scrollIntoView({ behavior: "smooth", block: "start" })`; it returns `false` when the element is absent so `onSearch`/`onViewMap` fall back to `router.push("/#projects")`. The target exists: `MapSection` renders `id="projects"` on its root `<section>`, and it is the only such id on `/`. **`Hero` is no longer mounted on `/`, so nothing on the homepage triggers that scroll; the `id` and the anchor links in `Navbar`/`Footer` still resolve.**

## 17. How the map connects to Locations

`GrowthCorridors` is the location map. It loads `LocationRecord` values (`id`, `name`, `slug`, `description`, `address`, `latitude`, `longitude`, `status`, `cover_url`), filters to `hasCoordinates` for map placement, and uses `activeLocationId` to synchronize the location list, marker, and detail card.

The selected location's `slug` is sent as `location_slug` to the properties endpoint. Location property cards link to `/properties/{id}`.

## 18. Related pages and routes

- `/` — renders `MapSection` only. `GrowthCorridors` is not mounted here.
- `/properties` — renders the live `PropertiesList` catalogue.
- `/properties/{propertyId}` — renders `PropertyPageView` for local static ids or `ApiPropertyView` for API UUIDs.
- `/#projects` — hero search fallback target; resolved to the `MapSection` root section, which carries `id="projects"`. It is now the only fragment target on `/`. The `#contact` links the desktop sidebar CTA and the plot read-out render use no longer have a target, because `FindYourPlot` — which carried `id="contact"` — is no longer mounted.
- `/api/properties`, `/api/properties/{id}`, `/api/properties/{id}/units`, and `/api/locations` — remote API paths consumed by the map.

## 19. External services/integrations

- OpenFreeMap vector style: `https://tiles.openfreemap.org/styles/liberty` (pruned before map init in `MapSection`; see §3).
- `MapSection` MapLibre init sets `maxTileCacheSize: 15` and `renderWorldCopies: false` to limit offscreen tile retention and wrapped-world work during first paint.
- On the map's first `idle` (viewport tiles rendered), `MapSection` calls `allowAnalyticsFlush()`; the first `POST /api/events/batch` then waits an additional `INITIAL_FLUSH_DELAY_MS` (4s) so it does not contend with tile streaming. Non-map routes use an 8s `startAnalytics` fallback. `pagehide` flushes are ungated.
- Esri World Imagery raster tiles by default, configurable through `NEXT_PUBLIC_SATELLITE_TILES_URL`.
- ILA backend API configured by `NEXT_PUBLICAPIURL`.
- Tenant identification through `X-Tenant-Domain`.
- Optional bearer token from browser `localStorage` key `token`.
- Analytics through `trackEvent` (`src/services/analytics/tracker`).
- MapLibre worker files served from `/maplibre/`.

## 20. Mobile behavior

`MapSection` contains mobile-specific plot-list and property-sheet expansion state (`mobilePlotExpanded`, `propertySheetExpanded`). `GrowthCorridors` renders the map full-bleed on mobile at a fixed `h-[46vh]`; location cards use horizontal overflow, while the desktop layout uses a sidebar/list arrangement. The active location card is positioned over the lower map area on small screens.

The `GrowthCorridors` mobile map frame needs a **definite** height rather than a minimum. MapLibre's `maplibregl-map { position: relative }` is unlayered CSS and overrides the Tailwind `absolute` utility on the container, so the container depends on `h-full` resolving against its parent. In the mobile `flex-col` wrapper the frame was `flex-1` with `min-h-[46vh]`, leaving its height `auto`, so `height: 100%` resolved to `auto` and the map rendered as a blank zero-height canvas. The frame now uses `h-[46vh] flex-none` on small screens, restoring the stretched flex item at `lg` with `lg:h-auto lg:flex-1 lg:min-h-0`. `MapSection` is unaffected because its section uses a definite `h-[calc(100svh-var(--nav-h))]`. In addition, entering map mode or switching active properties triggers an instant auto-scroll (`scrollToMapSection`) targeting the map frame (`mapFrameRef`) across animation frames, preventing touch inertia or reflow from stranding the mobile scroll position on content below the map, while invoking `map.resize()`.

The selected property detail card (`activeItem`) flows **below the map** on mobile as a separate block (`relative shrink-0 overflow-hidden bg-[#1b1d22] p-4`), sitting directly beneath the map canvas inside the frame container with its own positioning context (so its background cover image does not escape to cover the map frame). At `lg` (and in fullscreen mode) the card is positioned as an absolute overlay in the bottom-right corner.

On mobile, `GrowthCorridors` map interactions are completely unrestricted: full multi-directional touch pan (`dragPan`), pinch-zoom, and map interaction gestures are enabled directly on the canvas without axis-locking or touch-action overrides.

Exact breakpoint behavior beyond the Tailwind classes in the components is UNKNOWN — needs verification.

## 21. Desktop behavior

`GrowthCorridors` renders an inset rounded map beside the location list on desktop (`lg`). Its location list becomes a vertical list. `MapSection` uses the wider property panel/layout presentation on desktop and caps estate fitting at zoom `17.2`.

## 22. Loading and error states

`MapSection` tracks `mapReady`, `mapError`, and `remoteStatus` (`loading`, `ready`, `error`). It uses abort controllers for requests, logs failures, and can show a property with no units as a pin/sheet without plot geometry. Layout image loading is intentionally separate from plot geometry; a failed/slow image does not delay the layout polygons. A failed fresh layout-image request can re-request the units endpoint for a new signed URL.

`GrowthCorridors` tracks `locationsState` and `propertiesState` as `loading`, `ready`, or `error`; pagination flags are derived from the locations response. Locations without coordinates are omitted from the map. Exact user-facing error copy for every state is UNKNOWN — needs verification.

Both components render their loading states with the shared `ila-loader ila-loader--sm` animation beside the existing text, defined once in `src\app\loading.css`. The previous `.ila-map-loader` class was removed from `globals.css`; see `docs\features\loading.md`.

## 23. Dependencies

Direct map-relevant dependencies are `maplibre-gl`, `geotiff` (layout TIFF support), `next`, `react`, and `react-dom` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\package.json`). Internal dependencies include the property/location services, project/plot data, layout raster loaders, API client, analytics tracker, and Next `Image`/`Link` components.

## 24. Known issues

- The map depends on `NEXT_PUBLICAPIURL`; there is no code fallback for a missing API base URL.
- The map depends on the tenant header being resolved from the hostname (or `SITE_DOMAIN` server-side).
- A property without coordinates has no map pin.
- A property without unit geometries has no plot polygons/layout, although its property sheet can still be shown.
- Layout imagery can fail independently of the plot geometry and uses a retry path for refreshed signed URLs.
- The default Esri World Imagery endpoint is documented in source as suitable for evaluation/development and requiring a contracted provider before commercial shipping.
- `MapSection` includes static demo estate data alongside live API properties; the exact intended production scope of the static projects is UNKNOWN — needs verification.
- **Performance & Architectural Bottlenecks (Audit)**:
  - *Marker rebuilds (Resolved)*: Property pins are no longer HTML `Marker` DOM nodes. They are a single GeoJSON source updated with `setData`; compare, EMI, feature-filter, and active-layout visibility are feature properties painted by branded ILA `symbol` icon layers on the GPU.
  - *Startup waterfall*: Property list and map tiles are prioritized on first load. Visitor/session/analytics POSTs are idle-deferred via `TelemetryBootstrap`; `GET /api/features` for bottom chips waits until `mapReady` + 800 ms. Wishlist no longer calls `fetchProperties` / `fetchFavorites` on mount. Estate prefetch is triggered by hover on list rows / pins; opening uses `getEstateData` / `getLayoutAsset` with placeholder-estate fallbacks.
  - *Heavy bundle*: MapLibre is statically imported on subpages, but dynamically imported on `/` (`ssr: false`).
  - *Giant component*: `MapSection.tsx` spans ~3,000 lines with ~20 `useState` and ~17 `useEffect` hooks, increasing coupling and regression risks during changes.
  - *Edge-cached proxy streaming*: The layout-image proxy runs on the Edge runtime, streams `upstream.body` (max **256 MB**; counting TransformStream only when Content-Length is absent), infers SVG/PNG/WebP/TIFF `Content-Type`, and sets public CDN cache headers (`Cache-Control` / `CDN-Cache-Control`) plus `Access-Control-Allow-Origin: *`. Oversized objects return 413 immediately without awaiting body cancel. No server-side image resizing — large TIFFs are still heavy on the client decode path.

## 25. Important constraints

- Do not bypass `apiFetch`; it attaches the tenant header and API base URL.
- API property detail requests must use UUID ids, not slugs.
- MapLibre's worker must remain available at `/maplibre/maplibre-gl-worker.mjs`; the build/postinstall copy script supplies it.
- Layout images require valid layout coordinates (`PropertyLayoutCords`) to georeference them.
- PNG/SVG/TIFF layout assets should be authored edge-to-edge for that extent (no outer padding/legends/viewBox margins). Runtime uploads the decoded bitmap as-is to the MapLibre image source (no mercator letterboxing), matching a QGIS EPSG:4326 overlay.
- Plot status is normalized to `available` or `sold`; unknown/empty statuses are normalized according to the estate builder's `emptyStatusAs` value.
- Coordinate pairs are `[longitude, latitude]` throughout the map data.
- Locations without finite numeric latitude/longitude cannot be mapped.
- `NEXT_PUBLIC_SATELLITE_TILES_URL` must preserve required tile placeholders such as `{z}`, `{x}`, and `{y}` if overridden; validation of a custom URL is UNKNOWN — needs verification.
