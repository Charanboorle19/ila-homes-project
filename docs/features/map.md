# Map feature

## 1. Feature purpose

The project has two MapLibre-based map experiences on the home page (`/`):

- `MapSection` displays API-backed properties, property pins, and selectable estate/plot layouts.
- `GrowthCorridors` displays API-backed locations/localities and lets the visitor inspect a location and its properties.

The home page renders them in this order: `MapSection`, then `GrowthCorridors` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx`).

## 2. User interaction / flow

### Property and plot map (`MapSection`)

1. `MapSection` loads `GET /api/properties?status=ALL&page=1&per_page=100` through `fetchProperties`.
2. Property coordinates are taken from the list where available; missing coordinates are resolved with detail calls through `fetchPropertyAnchors` (maximum concurrency `4`).
3. Properties with usable coordinates receive gold map pins. Selecting a property pin or a property row opens the property summary sheet and can load its units/layout.
4. Opening a property layout loads the property detail and `GET /api/properties/{id}/units?limit=all`. Unit geometry is converted into plot polygons.
5. A plot can be selected from the map or list. The plot selection shows its plot details and highlights the polygon.
6. The visitor can filter plots by `all`, `available`, or `sold`, search the current property/plot list, toggle layout imagery, and close the layout/property sheet.

### Location map (`GrowthCorridors`)

1. `GrowthCorridors` loads `GET /api/locations?page=1&per_page=20`.
2. The visitor opens map mode with the section's map action or selects a location.
3. Locations with numeric latitude and longitude are shown as markers/list entries; locations without coordinates remain non-mappable.
4. Selecting a location centers the map at that location and shows a location card.
5. `Explore` loads properties for that location with `GET /api/properties?location_slug={slug}&page=1&per_page=10`; the resulting links use `/properties/{property.id}`.

## 3. Map library and configuration

- Library: `maplibre-gl` `^6.12.0` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\package.json`).
- Components import `Map as MapLibreMap`, `Marker`, and `setWorkerUrl` from `maplibre-gl`.
- Both components call `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.
- The build/postinstall script copies MapLibre worker files from `node_modules/maplibre-gl/dist` to `public/maplibre/` (`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\scripts\copy-maplibre-worker.cjs`).
- `MapSection` and `GrowthCorridors` use `https://tiles.openfreemap.org/styles/liberty` as `MAP_STYLE`.
- `MapSection` uses a raster satellite source/layer over the vector style while an estate layout is open. The URL is `NEXT_PUBLIC_SATELLITE_TILES_URL`, defaulting to Esri World Imagery: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. Attribution is `Imagery © Esri, Maxar, Earthstar Geographics`.
- `MapSection` uses `LAYOUT_MAX_ZOOM = 17.2`; `GrowthCorridors` uses `DEFAULT_VIEW = { longitude: 78.44, latitude: 17.17, zoom: 11.35 }` and `LOCATION_ZOOM = 13.2`.

## 4. Relevant component file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx` — property/plot map and `PropertySheet`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\GrowthCorridors.tsx` — locations map and location/property exploration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` — catalogue list used by `/properties`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — property API types and requests.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\locationsService.ts` — location API types and requests.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\projects\index.ts` — static estate/GeoJSON project construction.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\projects\fromApi.ts` — units-response-to-estate conversion.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\plots.ts` — `Plot` and `PlotStatus` types plus legacy/sample plot data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\satelliteTiles.ts` — satellite source configuration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\layoutPreview.ts` and `src\lib\layoutTiff.ts` — layout image loading.

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

The units response is unwrapped by `fetchPropertyUnits` and supports a payload containing an array, `units`, `plots`, or `items`, or a GeoJSON `FeatureCollection`. Unit features are normalized with fields such as `plot_no`, `status`, `facing`, `sq_yards`, `sq_ft`, `price`, `per_sq_yard_price`, `per_sq_ft_price`, and optional centroid coordinates. Exact backend response variants beyond this normalization are UNKNOWN — needs verification.

## 9. Functions and hooks used

`MapSection` uses `useCallback`, `useEffect`, `useMemo`, `useRef`, and `useState`; MapLibre `LngLatBounds`, `Map`, and `Marker`; and functions including `syncLayoutRaster`, `loadRasterForProperty`, `fetchProperties`, `fetchPropertyAnchors`, `fetchPropertyById`, `fetchPropertyUnits`, `estateFromUnitsApi`, `estatePlaceholderFromProperty`, `propertyAnchor`, `loadLayoutPreviewRaster`, `loadLayoutRaster`, `formatPrice`, `formatInr`, and `trackEvent`.

`GrowthCorridors` uses `useEffect`, `useMemo`, `useRef`, and `useState`; MapLibre `Map` and `Marker`; and `fetchLocations`, `hasCoordinates`, `fetchPropertiesByLocation`, `formatPrice`, and `trackEvent`.

## 10. State management and important state variables

There is no external map store; state is local React component state.

`MapSection` important state includes `mapReady`, `mapError`, `activeProjectId`, `panelOpen`, `filter`, `query`, `selectedId`, `selectedProjectId`, `mobilePlotExpanded`, `propertySheetExpanded`, `remoteProject`, `remoteStatus`, `propertyList`, `propertyAnchors`, `activePropertyDetail`, `unitsCount`, and `focusRequest`. Refs include `mapContainerRef`, `mapRef`, and `sectionRef`.

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
- Location selection, map mode open/close, location pagination, and `Explore` links in `GrowthCorridors`.

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

## 15. How the map connects to the Property List

The homepage property/plot list is rendered inside `MapSection` and uses the same `propertyList`, `propertyAnchors`, `remoteProject.plots`, `filter`, `query`, and selection state as the map. Clicking a list item calls the same project/plot opening logic used by map selections.

The separate catalogue at `/properties` renders `PropertiesList` and does not share React state with `MapSection`; both call the same property service. Catalogue links navigate to `/properties/{property.id}`.

## 16. How the map connects to Search

`MapSection` has its own `query` state for filtering the visible property/plot panel. It is not connected to the homepage hero search state.

`Hero` (`src/components/Hero.tsx`) accepts a typed query, tracks `PROPERTY_SEARCH`, and scrolls to `#projects` or navigates to `/#projects`. The inspected `MapSection` source does not define an `id="projects"`; the exact resulting scroll target is UNKNOWN — needs verification.

## 17. How the map connects to Locations

`GrowthCorridors` is the location map. It loads `LocationRecord` values (`id`, `name`, `slug`, `description`, `address`, `latitude`, `longitude`, `status`, `cover_url`), filters to `hasCoordinates` for map placement, and uses `activeLocationId` to synchronize the location list, marker, and detail card.

The selected location's `slug` is sent as `location_slug` to the properties endpoint. Location property cards link to `/properties/{id}`.

## 18. Related pages and routes

- `/` — renders `MapSection` and `GrowthCorridors`.
- `/properties` — renders the live `PropertiesList` catalogue.
- `/properties/{propertyId}` — renders `PropertyPageView` for local static ids or `ApiPropertyView` for API UUIDs.
- `/#projects` — hero search fallback target; presence of the target in current markup is UNKNOWN — needs verification.
- `/api/properties`, `/api/properties/{id}`, `/api/properties/{id}/units`, and `/api/locations` — remote API paths consumed by the map.

## 19. External services/integrations

- OpenFreeMap vector style: `https://tiles.openfreemap.org/styles/liberty`.
- Esri World Imagery raster tiles by default, configurable through `NEXT_PUBLIC_SATELLITE_TILES_URL`.
- ILA backend API configured by `NEXT_PUBLIC_API_URL`.
- Tenant identification through `X-Tenant-Domain`.
- Optional bearer token from browser `localStorage` key `token`.
- Analytics through `trackEvent` (`src/services/analytics/tracker`).
- MapLibre worker files served from `/maplibre/`.

## 20. Mobile behavior

`MapSection` contains mobile-specific plot-list and property-sheet expansion state (`mobilePlotExpanded`, `propertySheetExpanded`). `GrowthCorridors` renders the map full-bleed on mobile with a minimum height of `46vh`; location cards use horizontal overflow, while the desktop layout uses a sidebar/list arrangement. The active location card is positioned over the lower map area on small screens.

Exact breakpoint behavior beyond the Tailwind classes in the components is UNKNOWN — needs verification.

## 21. Desktop behavior

`GrowthCorridors` renders an inset rounded map beside the location list on desktop (`lg`). Its location list becomes a vertical list. `MapSection` uses the wider property panel/layout presentation on desktop and caps estate fitting at zoom `17.2`.

## 22. Loading and error states

`MapSection` tracks `mapReady`, `mapError`, and `remoteStatus` (`loading`, `ready`, `error`). It uses abort controllers for requests, logs failures, and can show a property with no units as a pin/sheet without plot geometry. Layout image loading is intentionally separate from plot geometry; a failed/slow image does not delay the layout polygons. A failed fresh layout-image request can re-request the units endpoint for a new signed URL.

`GrowthCorridors` tracks `locationsState` and `propertiesState` as `loading`, `ready`, or `error`; pagination flags are derived from the locations response. Locations without coordinates are omitted from the map. Exact user-facing error copy for every state is UNKNOWN — needs verification.

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
- The hero search target `#projects` is referenced by code but was not found in the inspected `src/app/page.tsx`/`MapSection` source. UNKNOWN — needs verification.

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