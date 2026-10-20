# Map feature

## 1. Feature purpose

The project has two MapLibre-based map components:

- `MapSection` displays API-backed properties, property pins, and selectable estate/plot layouts.
- `GrowthCorridors` displays API-backed locations/localities and lets the visitor inspect a location and its properties.

**Only `MapSection` is rendered on the home page (`/`)**, and it is the only map section that route contains (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx`). The homepage first paints `IlaIntroLoader` (architectural brand reveal). `MapSection` is loaded dynamically (`next/dynamic` with `ssr: false`) and is **not mounted until `shouldMountMap` flips true after 1,200 ms**, so MapLibre WebGL does not initialize during the intro's first paint window; a lightweight `#090a0c` placeholder sits under the overlay until then. The intro stays visible until `onMapLoaded`, then fades out. `GrowthCorridors` still exists in the source but is no longer imported by the homepage; everything documented about it below describes the component as it stands, not a live part of `/`.

## 2. User interaction / flow

### Property and plot map (`MapSection`)

1. `MapSection` loads `GET /api/properties?status=ALL&page=1&per_page=100` through a single shared `fetchProperties` controller/promise (keyed by `singlePropertyId` + retry count) so StrictMode remounts reuse the in-flight request instead of aborting a duplicate. It owns the catalogue in `propertyList`. The Wishlist drawer receives `properties={propertyList}` and does not re-fetch the same list; favourites load only when the drawer is opened (`if (!isOpen) return`).
2. Property coordinates are taken from the list where available; missing coordinates are resolved with detail calls through `fetchPropertyAnchors` (maximum concurrency `4`). Progressive arrivals are buffered and flushed to state via `requestAnimationFrame` to avoid UI re-render bursts. Bottom Find-Your-Plot feature chips load via `fetchActiveFeatures` (`GET /api/features`) only after `mapReady` plus an 800 ms delay, so that request stays off the initial paint path.
3. Properties with usable coordinates receive gold-and-charcoal map pins featuring the branded ILA monogram vector mark with property name/price tags. At default overview zoom, tags remain compact and single-line; when zoomed in or hovered, tags expand and wrap cleanly onto multiple lines without truncating. New HTML markers are created in `requestAnimationFrame` chunks of 15 (removals and content updates stay synchronous) so attaching up to ~100 DOM pins does not block one long main-thread task; effect cleanup cancels the rAF chain so fast pin list updates do not leave orphaned work. Selecting a property pin or a property row smoothly animates the property summary card / results popup into view and loads its units/layout. On initial mount, no silent property/units warm-up is issued; units load strictly on demand when a property is opened and are cached in-memory with a 5-minute TTL.
4. Opening a property layout loads the property detail and `GET /api/properties/{id}/units?limit=all`. Unit geometry is converted into plot polygons.
5. A plot can be selected from the map or list. The plot selection shows its plot details and highlights the polygon. Map viewport exploration analytics (`MAP_ZOOM_REGION`) are debounced by 800 ms to avoid saturating the event queue during active gestures.
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
- Components import `Map as MapLibreMap`, `Marker`, and `setWorkerUrl` from `maplibre-gl`.
- Both components call `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.
- The build/postinstall script copies MapLibre worker files from `node_modules/maplibre-gl/dist` to `public/maplibre/` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\scripts\copy-maplibre-worker.cjs`).
- `MapSection` and `GrowthCorridors` use `https://tiles.openfreemap.org/styles/liberty` as `MAP_STYLE`.
- `MapSection` initializes with `maxTileCacheSize: 15`, `renderWorldCopies: false`, and `fadeDuration: 0`.
- `MapSection` uses a raster satellite source/layer over the vector style while an estate layout is open. The URL is `NEXT_PUBLIC_SATELLITE_TILES_URL`, defaulting to Esri World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. Attribution is `Imagery © Esri, Maxar, Earthstar Geographics`.
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
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\layoutPreview.ts` and `src\lib\layoutTiff.ts` — layout image loading.
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
  status: "available" | "sold";
  lng: number;
  lat: number;
  polygon: [number, number][];
  image: string;
}
```

The normalized estate type is `EstateProject` (`src/data/projects/index.ts`): `id`, `name`, `location`, `center`, `bounds`, `plots`, `sitePadGeo`, `plotsGeo`, `roadsGeo`, `roadCenterlinesGeo`, `openAreasGeo`, and optional `layoutRaster`.

API property records contain fields including `id`, `location_id`, `name`, `slug`, `description`, `property_type`, `price`, `minimum_price`, `target_price`, `price_label`, inventory fields, `status`, address/location fields, `latitude`, `longitude`, `area`, `facing`, `amenities`, `connectivity_score`, and `rera_registered`. The complete typed subset is in `ApiProperty` in `src/services/propertiesService.ts`.

## 7. APIs used by the map

- `GET /api/properties?status=ALL&page=1&per_page=100` — initial property list and map pins (`fetchProperties`).
- `GET /api/properties/{id}` — property detail and fallback coordinate lookup (`fetchPropertyById`). `{id}` must be the property UUID, not the slug.
- `GET /api/properties/{id}/units?limit=all` — plot/unit geometry and optional layout data (`fetchPropertyUnits`).
- `GET /api/locations?page={page}&per_page={perPage}` — locations (`fetchLocations`).
- `GET /api/properties?location_slug={slug}&page={page}&per_page={perPage}` — properties for a selected location (`fetchPropertiesByLocation`).

`fetchNearbyPlaces` exposes `GET /api/properties/{id}/nearby-places`, but it is not used by `MapSection` or `GrowthCorridors` for the map.

## 8. API request/response structure

Requests are sent through `apiFetch` (`src/services/apiClient.ts`) to `NEXT_PUBLIC_API_URL`, with:

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

The units response is unwrapped by `fetchPropertyUnits` and supports a payload containing an array, `units`, `plots`, or `items`, or a GeoJSON `FeatureCollection`. Unit features are normalized with fields such as `plot_no`, `status`, `facing`, `sq_yards`, `sq_ft`, `price`, `per_sq_yard_price`, `per_sq_ft_price`, and optional centroid coordinates. When `layout_preview_url` carries a `.tif` or `.tiff` URL (or `tif_url` is provided), client-side TIFF parsing is automatically utilized; if `property_layout_cords` is empty or missing, layout bounds are derived directly from unit polygon coordinates (`estate.bounds`). Exact backend response variants beyond this normalization are UNKNOWN — needs verification.

## 9. Functions and hooks used

`MapSection` uses `useCallback`, `useEffect`, `useMemo`, `useRef`, and `useState`; MapLibre `LngLatBounds`, `Map`, and `Marker`; and functions including `syncLayoutRaster`, `loadRasterForProperty`, `fetchProperties`, `fetchPropertyAnchors`, `fetchPropertyById`, `fetchPropertyUnits`, `estateFromUnitsApi`, `estatePlaceholderFromProperty`, `propertyAnchor`, `loadLayoutPreviewRaster`, `loadLayoutRaster`, `formatPrice`, `formatInr`, and `trackEvent`.

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
- Plot status filtering: `all`, `available`, `sold`.
- Text query filtering in the property/plot panel.
- Layout open/close behavior.
- Mobile plot-list expansion and property-sheet expansion.
- Satellite/layout imagery visibility controls in the estate layout view.
- Per-locality `Map` and `Explore` controls, location selection, map mode open/close, location pagination, and `Explore` links in `GrowthCorridors`.

The source does not expose a separate documented compass, geolocation, or drawing control. UNKNOWN — needs verification whether MapLibre's default attribution/control UI is visually enabled by the current rendered style.

## 13. Markers, polygons, labels, or layers

`MapSection` uses property `Marker` instances and estate GeoJSON/raster sources. Estate layer ids are:

`estate-site-pad-fill`, `estate-site-pad-edge`, `estate-open-fill`, `estate-open-edge`, `estate-plots-fill`, `estate-plots-outline`, `estate-plots-label`, `estate-roads-fill`, `estate-roads-casing`, `estate-roads-edge`, and `estate-roads-center`.

The plot fill palette is: available `#1F8A68`, sold `#8A8178`, selected `#D4A84B`, white plot edges, green open areas, beige site pad, and black/white road styling. Plot labels use the normalized `label` field (for example, `Plot 24`).

The optional layout image uses source id `estate-layout-image` and layer id `estate-layout-raster`. Satellite imagery uses source id `satellite-imagery` and layer id `satellite-imagery-layer`.

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

- OpenFreeMap vector style: `https://tiles.openfreemap.org/styles/liberty`.
- `MapSection` MapLibre init sets `maxTileCacheSize: 15` and `renderWorldCopies: false` to limit offscreen tile retention and wrapped-world work during first paint.
- On the map's first `idle` (viewport tiles rendered), `MapSection` calls `allowAnalyticsFlush()`; the first `POST /api/events/batch` then waits an additional `INITIAL_FLUSH_DELAY_MS` (4s) so it does not contend with tile streaming. Non-map routes use an 8s `startAnalytics` fallback. `pagehide` flushes are ungated.
- Esri World Imagery raster tiles by default, configurable through `NEXT_PUBLIC_SATELLITE_TILES_URL`.
- ILA backend API configured by `NEXT_PUBLIC_API_URL`.
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

- The map depends on `NEXT_PUBLIC_API_URL`; there is no code fallback for a missing API base URL.
- The map depends on the tenant header being resolved from the hostname (or `SITE_DOMAIN` server-side).
- A property without coordinates has no map pin.
- A property without unit geometries has no plot polygons/layout, although its property sheet can still be shown.
- Layout imagery can fail independently of the plot geometry and uses a retry path for refreshed signed URLs.
- The default Esri World Imagery endpoint is documented in source as suitable for evaluation/development and requiring a contracted provider before commercial shipping.
- `MapSection` includes static demo estate data alongside live API properties; the exact intended production scope of the static projects is UNKNOWN — needs verification.
- **Performance & Architectural Bottlenecks (Audit)**:
  - *Marker rebuilds (Resolved)*: Pins are DOM markers. Previously, state updates (wishlist, compare, EMI, selection) triggered full teardown and rebuilds of all DOM markers. Now marker lifecycles are decoupled: markers are created/removed strictly when pin data changes, while compare, EMI, and selection states update existing marker DOM classes, badges, and styles in place with zero rebuilds. New marker DOM inserts are further split across animation frames (chunk size 15) to avoid a single blocking create/addTo pass.
  - *Startup waterfall*: Property list and map tiles are prioritized on first load. Visitor/session/analytics POSTs are idle-deferred via `TelemetryBootstrap`; `GET /api/features` for bottom chips waits until `mapReady` + 800 ms. Wishlist no longer calls `fetchProperties` / `fetchFavorites` on mount. Mount-time silent units warm-up has been eliminated.
  - *Heavy bundle*: MapLibre is statically imported on subpages, but dynamically imported on `/` (`ssr: false`).
  - *Giant component*: `MapSection.tsx` spans ~3,000 lines with ~20 `useState` and ~17 `useEffect` hooks, increasing coupling and regression risks during changes.
  - *No cache / Proxy buffering*: The image proxy sends `no-store`, buffers up to 120MB, and performs no image resizing, leading to slow repeated layout image loads.

## 25. Important constraints

- Do not bypass `apiFetch`; it attaches the tenant header and API base URL.
- API property detail requests must use UUID ids, not slugs.
- MapLibre's worker must remain available at `/maplibre/maplibre-gl-worker.mjs`; the build/postinstall copy script supplies it.
- Layout images require valid layout coordinates (`PropertyLayoutCords`) to georeference them.
- Plot status is normalized to `available` or `sold`; unknown/empty statuses are normalized according to the estate builder's `emptyStatusAs` value.
- Coordinate pairs are `[longitude, latitude]` throughout the map data.
- Locations without finite numeric latitude/longitude cannot be mapped.
- `NEXT_PUBLIC_SATELLITE_TILES_URL` must preserve required tile placeholders such as `{z}`, `{x}`, and `{y}` if overridden; validation of a custom URL is UNKNOWN — needs verification.
- No application code was changed for this documentation task.