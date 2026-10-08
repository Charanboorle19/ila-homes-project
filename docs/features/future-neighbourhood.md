# Future Neighbourhood feature

This document describes the current `FutureNeighbourhoodMap` implementation only. It is the property-specific Current/2029 neighbourhood view on the Property Details page. It is separate from Location Story: Location Story is implemented by `SatelliteBeforeAfter` and presents historical/timeline entries, whereas Future Neighbourhood switches between existing and expected-future nearby places and infrastructure.

## 1. Feature purpose

Future Neighbourhood presents the viewed property as an origin and shows nearby places/infrastructure for either the current horizon or an expected 2029 horizon. It combines a nearby-place list with a MapLibre map, connecting lines, labels, distances, and status text. The copy describes infrastructure as “expected to reshape the belt”; the implementation does not establish that proposed infrastructure is guaranteed.

## 2. Where it appears

It appears on `/properties/{propertyId}` in the shared Property Details page, immediately after Buyer Fit (`LifeStageMatch`) and before `Lifestyle`. The visible kicker is `Future neighbourhood` and the heading is `Not just today. A brighter 2029.`

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\FutureNeighbourhoodMap.tsx` — component, nearby-place loading, horizon state, GeoJSON generation, MapLibre setup, list, and interactions.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — renders `<FutureNeighbourhoodMap property={property} />`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — `ApiNearbyPlace`, `fetchNearbyPlaces`, and UUID validation.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `NeighbourhoodItem`, `PropertyRecord.neighbourhood`, coordinates, and zoom types/static data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — `distanceFromGachibowliKm` used by the demo “Near by me” label.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — Future Neighbourhood layout, map, list, card, and responsive styling.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\public\maplibre\maplibre-gl-worker.mjs` — MapLibre worker URL used by the component.

## 4. Component names

The feature component is the default-exported `FutureNeighbourhoodMap`. The parent composition component is `PropertyPageView`. The component also exports the `NearbyPlaceItem` TypeScript interface. There is no separately confirmed component named `FutureNeighbourhood`.

## 5. Props

`FutureNeighbourhoodMap` accepts one prop:

```ts
{ property: PropertyRecord }
```

It accepts no callbacks or externally controlled horizon, map, loading, or nearby-place props. `PropertyPageView` passes only the normalized `PropertyRecord`.

## 6. Data sources

The feature uses two possible nearby-place sources:

- API data from `fetchNearbyPlaces` for a UUID property, or a fixed sample UUID for a local/static property.
- Static `property.neighbourhood.existing` and `property.neighbourhood.proposed` arrays when the API returns no usable items or fails.

The property origin, map label, initial zoom, and static fallback data come from `PropertyRecord`. The “Near by me” value is calculated from the property record and a fixed Gachibowli reference in `distanceFromGachibowliKm`; it is not device geolocation.

## 7. API endpoints and parameters

The component calls:

```text
GET /api/properties/{propertyId}/nearby-places
```

The path segment is URL-encoded by `fetchNearbyPlaces`. There are no query parameters. The request receives an `AbortSignal` and uses the application `apiFetch` client, including its normal API/tenant configuration.

For a UUID property, `{propertyId}` is `property.id`. For a local/static property, the implementation requests the fixed fallback UUID `6429f090-c01d-4bcc-9145-b9bfb8595843`. The exact backend semantics of that sample record are UNKNOWN — needs verification.

## 8. Current vs future/2029 behavior

The horizon type is `"today" | "2029"`, initially `"today"`.

- `today` selects static `neighbourhood.existing` or API items mapped with `horizon: "today"`.
- `2029` selects static `neighbourhood.proposed` or API items mapped with `horizon: "2029"`.

For API data, a place is treated as future when its status is `PROPOSED`, `UPCOMING`, or `PLANNED`, or when `expected_year > 2026`. Otherwise it is mapped to `today`. This is an implementation classification, not proof that an infrastructure project will exist in 2029. If the selected horizon has no API items, the component falls back to all mapped API items rather than showing an empty map/list.

The base map style and imagery are not changed by the horizon. The selected points, connection lines, labels, fit bounds, item `horizon` properties, and marker colors change.

## 9. Toggle behavior

The `Current` and `In 2029` controls are native buttons. Each calls `setHorizon("today")` or `setHorizon("2029")` and exposes its state with `aria-pressed`. Changing the horizon recomputes the selected items and GeoJSON, updates the existing `future-items` and `future-links` sources, and refits the map to the property origin plus selected items.

There is a separate `Near by me` chip. It toggles `nearBy` only and shows/hides the demo Gachibowli distance text; it does not filter places, move the map, access device GPS, or change the API request.

## 10. Nearby places/infrastructure data

Static `NeighbourhoodItem` fields are `id`, `name`, `kind`, `distanceKm`, `status`, `detail`, and `coordinates: [number, number]`. Static records are split into `existing` and `proposed` arrays.

API `ApiNearbyPlace` fields are:

- Required: `id`, `property_id`, `name`, `category`, `distance`, `distance_unit`, `status`, `latitude`, and `longitude`.
- Optional: `proximity_label`, `expected_year`, `metadata`, `created_at`, and `updated_at`.
- `metadata` may contain `source`, `distance_type`, `verified_route_distance`, and additional unknown keys.

API categories are formatted for display, including `AIRPORT`, `BUSINESS`, `HIGHWAY`, `HOSPITAL`, `ORR`, `PARK`, `SCHOOL`, `METRO`, `MALL`, and `TRANSIT`. Unknown uppercase underscore categories are title-cased. Proximity labels such as `WALKING`, `VERY_CLOSE`, `NEARBY`, and drive-distance variants are converted to display labels.

## 11. Map behavior

The map is created once in a mount effect. Its GeoJSON sources contain point features for the selected places and LineString features from the property origin to each place. The map fits the origin and all selected points after initial load and after horizon/data changes.

Clicking a place card does not select a marker or change application state. It fits the map to the origin and that place, using padding `90`, `maxZoom: 14.5`, and an `800ms` duration. Invalid/zero item coordinates use the property origin for this card navigation.

## 12. Map configuration

The map library is `maplibre-gl`. The configured style is:

```text
https://tiles.openfreemap.org/styles/liberty
```

The worker is configured with `setWorkerUrl` to an absolute URL for `/maplibre/maplibre-gl-worker.mjs`. Map options include compact attribution, `pitch: 0`, disabled drag rotation, disabled pitch rotation, and disabled touch pitch. The map does not use the satellite style or imagery used by Location Story.

## 13. Coordinates and zoom

The property origin is `property.coordinates`, a `[longitude, latitude]` tuple. The initial map center is that origin and the initial zoom is `property.zoom`.

API places use `[item.longitude, item.latitude]`. Static places use their supplied coordinates when both values are finite and not both zero. If static coordinates are absent/invalid/zero, `offsetFrom` derives a point from the property origin, distance, and an evenly distributed bearing. The derived angular distance is capped at `5.5 km` and uses Earth radius `6371 km`.

After data is applied, `fitBounds` uses padding `64`, `maxZoom: 14`, and a `600ms` duration. Exact geographic accuracy of static derived coordinates is UNKNOWN — needs verification.

## 14. Marker behavior

The implementation does not create individual MapLibre `Marker` objects. It renders marker-like points with GeoJSON circle/symbol layers:

- `future-item-halo` and `future-item-dot` show each nearby place.
- `future-item-label` shows name, kind, distance, and status.
- `future-origin-halo`, `future-origin-dot`, and `future-origin-label` show the property origin.
- `future-link-glow` and `future-link-line` draw white underlay and dashed amber connections from origin to each item.

Current items use green (`#1f5c45`) circles; 2029 items use gold (`#c6a46c`). The origin is always gold. Labels are optional to avoid overlap. There is no confirmed marker click handler; place-card clicks perform map fitting instead.

## 15. Property-specific behavior

The property supplies the origin coordinates, initial zoom, map label, id, and static existing/proposed neighbourhood arrays. UUID status determines whether the property id or the fixed sample UUID is passed to the nearby-places endpoint. API properties can therefore receive live nearby-place data, while local/static properties can display API data if the fixed sample request succeeds; otherwise they use their own static record data.

## 16. State variables

The component state is:

- `horizon: Horizon`, initially `"today"`.
- `nearBy: boolean`, initially `false`.
- `mapFailed: boolean`, initially `false`.
- `apiPlaces: ApiNearbyPlace[] | null`, initially `null`.
- `isLoadingApi: boolean`, initially `false`.

Refs are `containerRef`, `mapRef`, and `readyRef`. `mapRef` stores the MapLibre instance; `readyRef` tracks style/load readiness.

## 17. Derived values

The component derives:

- `items`, from API places filtered to the horizon, or static existing/proposed arrays.
- `origin`, from `property.coordinates`.
- `geo`, from `buildGeoJson(items, origin, horizon)`.
- `fromGachibowli`, from `distanceFromGachibowliKm(property)`.

API mapping derives display `kind`, `status`, `detail`, numeric `distanceKm`, display proximity label, and the `today`/`2029` classification.

## 18. Functions

The feature defines `formatDistanceDisplay`, `formatCategoryLabel`, `formatProximityLabel`, `mapApiNearbyPlace`, `offsetFrom`, and `buildGeoJson`. `formatDistanceDisplay` renders one decimal place and returns `Nearby` for invalid values. `buildGeoJson` creates point and link FeatureCollections. The component also contains inline button/card handlers for horizon changes, the near-me toggle, and card map fitting.

## 19. Hooks

It uses `useState` for UI/fetch state, `useRef` for the DOM container/map/readiness refs, `useMemo` for selected items/GeoJSON/Gachibowli distance, and `useEffect` for the API request, one-time map creation/cleanup, map data updates, and a `ResizeObserver` that calls `map.resize()`.

## 20. Loading behavior

The nearby-place request sets `isLoadingApi` to `true`. A `Loading nearby landmarks…` list card is rendered only when loading is active and the selected `items` array is empty. Static fallback items can therefore remain visible while an API request is loading. The map itself has no separate loading indicator.

## 21. Error behavior

Nearby-place request failures are logged with a warning and set `apiPlaces` to `null`, causing static fallback data to be used. Aborted requests are ignored. Map construction errors and pre-ready MapLibre errors set `mapFailed` and are logged. Data-update errors are logged as warnings; there is no retry control.

## 22. Empty-state behavior

An empty API response is treated as no API data and falls back to static data. If the selected API horizon has no items, all mapped API items are shown. If the final static/API arrays are empty, the list has no explicit empty-state message and the map receives no item features; this is UNKNOWN — needs verification from runtime behavior.

## 23. Reset behavior

There is no explicit reset function or reset button. Horizon starts at `today`, `nearBy` starts off, API data starts null, and loading starts false when the component mounts. The API effect aborts its request during cleanup. The map is removed during map-effect cleanup. A property-id change refetches nearby data, but the inspected component does not explicitly reset `horizon`, `nearBy`, or `mapFailed` in that effect.

## 24. Navigation behavior

There is no route navigation, property navigation, external link, or detail-page transition in the feature. Clicking a nearby-place card only animates the map camera to the property and that place. The `Near by me` control does not navigate or use browser geolocation.

## 25. Analytics

No Future Neighbourhood-specific `trackEvent` call, `data-track` attribute, or analytics event is present in the inspected component. Card clicks and horizon/near-me toggles are not explicitly tracked by this feature. General analytics event names such as `MAP_MARKER_CLICK` in the shared vocabulary are not evidence that this component emits them. Future Neighbourhood analytics behavior is UNKNOWN — needs verification outside the inspected implementation.

## 26. Relationship with Buyer Fit

`PropertyPageView` renders `LifeStageMatch` immediately before `FutureNeighbourhoodMap`. Buyer Fit explains a selected buyer goal and property-specific fit score; Future Neighbourhood shows current/expected-future neighbourhood context. They share the normalized `PropertyRecord` through the parent but share no state, callbacks, scoring logic, or map instance.

## 27. Relationship with Location Story

Location Story is the separate `SatelliteBeforeAfter` component rendered later, after `LegalDocuments`. Location Story uses `property.timeline` entries and an Esri satellite map to present historical/story years. Future Neighbourhood uses a Current/2029 horizon, nearby-place data, OpenFreeMap Liberty, GeoJSON points/links, and expected infrastructure context. The Future Neighbourhood toggle does not control Location Story.

## 28. Relationship with Property Details

`PropertyPageView` passes the normalized `PropertyRecord` and renders the feature in the fixed page sequence. API properties are normalized before reaching this component. The feature is independent of the property hero, pricing, documents, lifestyle, buying journey, similar properties, and CTAs except for their shared page composition and stylesheet.

## 29. Relationship with MapSection

Future Neighbourhood does not import or reuse `MapSection`, its map instance, plot polygons, layout raster, or homepage map state. It independently creates its own MapLibre map, style, sources, layers, origin, data, and cleanup. It shares the MapLibre package/worker convention but not the MapSection implementation.

## 30. Desktop behavior

At desktop widths, the list and map use a two-column grid. The map is the right column, becomes sticky below the navigation offset, and is `34rem` high. The nearby list has a maximum height of `34rem` and its own vertical scrolling. The map/list column ratio is `0.95fr 1.05fr` under the shared desktop rule.

## 31. Mobile behavior

Below the desktop breakpoint, the grid remains a single-column layout in normal document flow: the list appears before the map. The map has a minimum height of `24rem`; the list remains vertically scrollable with a `34rem` maximum height. Toggles wrap as needed. There is no separate mobile component or mobile-only map interaction.

## 32. Responsive breakpoints

The Future Neighbourhood-specific desktop layout is enabled by `@media (min-width: 760px)`. The same shared Property Details media block also applies the two-column `.pd-future__layout`, sticky map, and `34rem` height. No Future Neighbourhood-specific `980px` breakpoint is present. Exact behavior between CSS viewport widths is UNKNOWN — needs verification.

## 33. CSS/classes

Relevant classes include `.pd-section`, `.pd-section__inner`, `.pd-future`, `.pd-future__toggles`, `.pd-future__near`, `.pd-future__layout`, `.pd-future__list`, `.pd-future__card`, `.pd-future__card-top`, `.pd-future__kind`, `.pd-future__status`, `.pd-future__dist`, `.pd-future__map`, `.pd-future__canvas`, and `.pd-future__map-error`. Shared `.pd-chip` styles provide the horizon and near-me controls. MapLibre control classes are adjusted through `.pd-future__map .maplibregl-ctrl-group` and `.pd-future__map .maplibregl-ctrl-attrib`.

## 34. Accessibility

The outer section is labelled by `aria-labelledby="pd-future-title"`. Horizon and near-me controls are native `button type="button"` elements with `aria-pressed`. The demo distance paragraph uses `aria-live="polite"`. The map container has `role="application"` and an aria label containing the property neighbourhood map label and nearby landmarks. Nearby-place cards are `<li>` elements with click handlers rather than native buttons; keyboard activation behavior for those clickable list items is UNKNOWN — needs verification. The map itself relies on MapLibre controls and the surrounding list for landmark detail.

## 35. Dependencies

Direct dependencies are React hooks, `maplibre-gl`, `maplibre-gl/dist/maplibre-gl.css`, GeoJSON types, `PropertyRecord`/`NeighbourhoodItem`, `distanceFromGachibowliKm`, `fetchNearbyPlaces`, `isPropertyUuid`, and the internal API client through the service. It depends on the copied MapLibre worker in `public/maplibre/` and `PropertyDetail.css`. No geolocation library, satellite imagery service, marker library, analytics hook, or routing library is used by this feature.

## 36. Known issues

- Local/static properties still issue a live nearby-places request using the fixed sample UUID; this means static properties can display sample/API places rather than only their own static neighbourhood data.
- API failure and an empty API response both use the static fallback path, with no user-visible API error message.
- The 2029 classification is based on status/`expected_year > 2026`; the frontend does not verify whether the proposed infrastructure is committed or guaranteed.
- The map imagery/style does not change between Current and 2029; only data, labels, colors, links, and camera fitting change.
- Static coordinates can be synthesized from distance/bearing and capped at 5.5 km, so they are presentation coordinates rather than confirmed surveyed positions.
- There is no explicit empty-list message, retry action, or Future Neighbourhood-specific analytics event in the inspected implementation.
- The nearby-place list items have click handlers but are not native interactive controls; keyboard interaction is UNKNOWN — needs verification.
- Exact server-side nearby-place filtering and the meaning of the fixed sample UUID are UNKNOWN — needs verification.

## 37. Important constraints

- Preserve `FutureNeighbourhoodMap` and its `{ property: PropertyRecord }` prop contract unless all parent usage is updated.
- Preserve the distinction between Future Neighbourhood’s Current/2029 horizon and Location Story’s historical timeline; they are separate components, maps, and states.
- Preserve `GET /api/properties/{id}/nearby-places`, UUID path encoding, abort cleanup, and the static fallback behavior unless the API contract intentionally changes.
- Keep coordinates in `[longitude, latitude]` order and do not describe derived/demo coordinates or Gachibowli distance as device GPS or surveyed data.
- Do not describe proposed/expected infrastructure as guaranteed; current code only labels it as proposed, upcoming, planned, or expected.
- Preserve the OpenFreeMap Liberty style, MapLibre worker URL, source ids, layer behavior, origin marker, connection lines, and current/2029 color distinction unless the map contract intentionally changes.
- Preserve loading, fallback, map-error, and empty-state behavior as documented rather than inventing a retry or empty-state UI.
- Do not infer analytics events from the general analytics vocabulary when this component does not emit them.
- Application code was not modified for this documentation task; unrelated existing working-tree changes must be preserved.