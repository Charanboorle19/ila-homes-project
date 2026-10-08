# Locations / Growth Corridors feature

This document describes the current homepage Locations implementation, whose React component is named `GrowthCorridors`. It documents verified behavior in the inspected source only; it does not describe a planned locations catalogue or a separate Locations route.

## 1. Feature purpose

The feature presents API-backed Hyderabad localities/growth corridors, lets visitors open a locality on a MapLibre map, and lets them inspect properties associated with the selected locality.

## 2. Where it appears

`GrowthCorridors` appears on the homepage route `/`. It is rendered after `MapSection` and `WhoWeAre`, and before `FindYourPlot`.

## 3. Exact section position/order

The homepage order in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` is:

1. `Hero`
2. `MapSection`
3. `WhoWeAre`
4. `GrowthCorridors`
5. `FindYourPlot`
6. `BuyingJourney`
7. `ShortlistShare`
8. `EmiAppreciation`
9. `FromTheField`
10. `PlotsWithPulse`
11. `Faq`

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\GrowthCorridors.tsx` — feature component, data loading, state, map, cards, and property exploration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\locationsService.ts` — locations API types, request helper, pagination derivation, and coordinate validation.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — locality property request and `PropertySummary` type.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage placement.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\tracker.ts` — event transport used by the component.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\useClickTracking.ts` — delegated tracking for `data-track` attributes.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\apiClient.ts` — tenant-aware API wrapper used by the service helpers.

## 5. Component names

The public component is the default export `GrowthCorridors`. Private helpers include `MapIcon`, `ArrowIcon`, and `formatCoords`. There is no separately confirmed `Locations` component.

## 6. Component props

`GrowthCorridors` accepts no props. Its data and interaction state are managed internally.

## 7. Section identity and semantics

The root section has `data-section="growth_corridors"`, `id="services"`, `className="growth-corridors ..."`, and `aria-label="Hyderabad growth corridors"`. The visible kicker is `South Hyderabad · Growth corridors`; the heading is `Explore locations shaping the next phase of Hyderabad`.

## 8. Data source

Visible locality values come from `GET /api/locations` through `fetchLocations`. The component explicitly contains no local/demo location data. The browser-side request goes through `apiFetch`, which attaches the current tenant domain using `X-Tenant-Domain` and may attach a stored bearer token.

## 9. Location data contract

`LocationRecord` contains:

- `id: string`
- `name: string`
- `slug: string`
- `description: string | null`
- `address: string | null`
- `latitude: number | null`
- `longitude: number | null`
- `status: string`
- `cover_url: string | null`

The UI renders `name`, `slug`, `description`, `address`, `latitude`, `longitude`, and `status`. `cover_url` is typed by the service but is not rendered by `GrowthCorridors`.

## 10. Locations endpoint and query parameters

The request path is `/api/locations?page={page}&per_page={perPage}`. The initial component state requests page `1` with `perPage` `20`. `fetchLocations` clamps both request values to at least `1` and reads `items`, `total`, `page`, and `per_page` from the response data.

## 11. Locations response and pagination derivation

The service returns `items`, `total`, `page`, `perPage`, `totalPages`, `hasNextPage`, and `hasPreviousPage`. `totalPages` is derived as `max(1, ceil(total / resolvedPerPage))`; next-page availability is `resolvedPage < totalPages`, and previous-page availability is `resolvedPage > 1`.

## 12. Initial list view

Before map mode is opened, the component displays locality cards when the locations request is ready and has items. The status line reads `Showing {locations.length} of {total} localities · Page {page} of {totalPages}`. Cards show the locality name, optional description, optional address, and optional formatted coordinates.

## 13. Locality card behavior

Each card has an `Explore` button. Selecting a mappable locality calls `selectLocation`, sets it active, emits `MAP_MARKER_CLICK`, sets the property state to loading, and starts the locality property request. A locality without finite numeric coordinates is disabled and displays `No map location`; it cannot be selected from the list.

## 14. Coordinate validation and formatting

`hasCoordinates` accepts only finite numeric latitude and longitude values. A valid locality is placed at `[longitude, latitude]` for MapLibre. Display text is formatted as `latitude.toFixed(5), longitude.toFixed(5)`, in latitude/longitude display order.

## 15. Map-mode entry

When at least one locality on the current page is mappable, the list view shows a `View on map` button. `openMap()` chooses the passed locality or the first mappable locality, makes it active, and sets `mapMode` to `true`. The component does not open map mode when the current page has no mappable locality.

## 16. Map library and worker

The component uses `maplibre-gl`, importing `Map` as `MapLibreMap`, `Marker`, and `setWorkerUrl`. The worker URL is `/maplibre/maplibre-gl-worker.mjs`. The worker files are copied into `public/maplibre/` by the repository’s MapLibre worker copy script.

## 17. Map configuration

The vector style is `https://tiles.openfreemap.org/styles/liberty`. The fallback view is longitude `78.44`, latitude `17.17`, zoom `11.35`; it is used only when no active/first mappable location is available at map creation. A selected locality uses zoom `13.2`. The map disables MapLibre’s built-in attribution control with `attributionControl: false`; attribution requirements for the external style are UNKNOWN — needs verification.

## 18. Map lifecycle and marker behavior

The map is created once when map mode opens and is removed when the map-mode effect cleans up. On map load, `mapReady` becomes true. When the active locality changes, the existing marker is removed, the map eases to the active coordinates over `900` ms at zoom `13.2`, and a new labelled marker is added. Marker cleanup and map cleanup are explicitly implemented.

## 19. Active locality state

`activeLocationId` stores the selected locality id. `activeLocation` is derived from the current page’s `locations`; therefore a selection from a previous page stops resolving after the page changes. The map-mode sidebar highlights the active locality, and the map overlay shows its status, name, optional description, and optional address.

## 20. Map-mode layout

In map mode the section drops its outer list-view padding. On small screens the locality strip is horizontally scrollable and the map is full-bleed below it. On large screens the locality list is a sidebar and the map is an inset rounded panel beside it. The map container has a minimum height of `46vh` on small screens and the map-mode wrapper has a minimum height of `62vh` on small screens and `75vh` at `lg`.

## 21. Exiting map mode

The map-mode mobile bar includes a back button that sets `mapMode` to `false`. The inspected source contains no separate desktop back/close button in the map sidebar; desktop exit behavior beyond responsive visibility is UNKNOWN — needs verification.

## 22. Locality property exploration flow

Selecting a locality also sets `propertiesSlug` to its slug. This replaces the locality list with a property view containing `Back to localities`, a `Properties in {name}` label, loading/error/empty messaging, and property cards. `closeProperties` clears the slug, properties, total, and property state, returning to the locality list.

## 23. Properties endpoint and request contract

`fetchPropertiesByLocation` requests `GET /api/properties?location_slug={slug}&page=1&per_page=10`. The slug is URL-encoded by `URLSearchParams`. The component uses constants `PROPERTIES_PAGE = 1` and `PROPERTIES_PER_PAGE = 10`; there is no property-list pagination control in this locality view. The reason recorded in source is that current localities have 1–2 properties, so page 2 would return empty according to the source comment.

## 24. Property summary fields and rendering

`PropertySummary` contains `id`, `location_id`, `name`, `slug`, `description`, `property_type`, `price`, and `cover_url`. Cards render `name`, optional `property_type`, optional description, `/slug`, and a formatted price. `cover_url` and `location_id` are not rendered in this component. Prices use the shared Indian-format helper; null, non-finite, or non-positive values display `Price on request`.

## 25. Property navigation

Each locality property card is a Next.js `Link` to `/properties/{property.id}` and displays `View details`. The link carries `data-track="PROPERTY_VIEW"`, `data-track-property={property.id}`, and metadata identifying `source: "growth_corridors"` and the selected `location_slug`.

## 26. Loading, error, and empty states

The initial locality state is `loading`; the visible message is `Loading localities…`. A failed locality request displays `Localities are unavailable right now. Please try again shortly.` A ready request with no items displays `No localities to show right now.`

For properties, the component uses `idle`, `loading`, `ready`, and `error`. It displays `Loading properties…`, `Properties are unavailable right now. Please try again shortly.`, or `No properties listed in this locality yet.` as applicable. A ready property request also displays `Showing {properties.length} of {propertiesTotal} properties`.

## 27. Pagination controls

The locality list provides a `Per page` select with values `5`, `10`, `20`, and `50`. Changing it sets loading, updates `perPage`, and resets the page to `1`. `Previous` and `Next` buttons use the API-derived flags, are disabled while loading or when unavailable, and display `Page {page} / {totalPages}`.

## 28. State and request cancellation

Locations and properties each use an `AbortController`. Cleanup aborts an in-flight request when dependencies change or the component unmounts. Aborted results/errors are ignored. Locations reload when `page` or `perPage` changes; properties reload when `propertiesSlug` changes.

## 29. Analytics behavior

Selecting a locality directly calls `trackEvent` with event type `MAP_MARKER_CLICK` and metadata `{ location_id, location_slug, section_type: "growth_corridors" }`. The locality Explore button also carries matching `data-track` attributes, so the global delegated click tracker can emit the same event. Property links emit `PROPERTY_VIEW` through the delegated tracker with the locality source metadata. The event tracker queues events and posts batches to `/api/events/batch` when a visitor code is available.

## 30. Accessibility behavior

The root section has an accessible label. The map-mode list uses `aria-label="Localities"`; pagination uses `aria-label="Localities pagination"`; locality buttons provide `aria-label="View {location.name} on map"`; the active map detail card uses `aria-live="polite"`. The property view also uses `aria-live="polite"`. Exact screen-reader behavior of the MapLibre canvas and custom marker is UNKNOWN — needs verification.

## 31. Responsive and visual behavior

The component uses Tailwind responsive utilities. List-view cards are horizontally scrollable on small screens and become a three-column grid at `lg`. Map-mode locality entries are a horizontal snap strip on small screens and a vertical sidebar list at `lg`. The active-location map card sits over the lower map area on small screens and is constrained to the lower-right on larger screens. The custom marker classes are `ila-corridor-marker`, `ila-corridor-marker__dot`, and `ila-corridor-marker__label`; their CSS definition was not found in the inspected `src` search, so exact marker styling is UNKNOWN — needs verification.

## 32. External integrations and dependencies

The feature depends on React hooks, Next.js `Link`, MapLibre GL, the OpenFreeMap Liberty style, the ILA API configured through `NEXT_PUBLIC_API_URL`, tenant resolution through `X-Tenant-Domain`, optional browser token storage, and the shared analytics tracker. No geolocation API, location search provider, or separate locations route is used by the inspected component. API authentication/authorization outcomes for different tenant environments are UNKNOWN — needs verification.

## 33. Known limitations and maintenance constraints

- Locations without finite numeric coordinates remain visible in the list but cannot be mapped or selected.
- The fallback map view is a technical viewport, not a displayed location record.
- Changing location pages does not explicitly clear `activeLocationId`; the derived active locality simply becomes null if it is absent from the new page.
- The locality property view requests only page 1 with 10 items and has no property pagination UI.
- `cover_url` is available in both service types but is not currently rendered.
- Exact API response examples, production locality counts, map-style attribution compliance, custom marker CSS ownership, and automated test coverage are UNKNOWN — needs verification.
- Preserve the service query names `page`, `per_page`, and `location_slug`; the backend contract depends on them.
- Preserve longitude/latitude order when passing coordinates to MapLibre.
- Preserve request abort handling and MapLibre marker/map cleanup when changing the feature.
- This documentation task creates only `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\locations.md`; application code is intentionally unchanged.