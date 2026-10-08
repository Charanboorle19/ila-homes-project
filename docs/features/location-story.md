# Location Story / Satellite Before & After

This document describes the current Location Story implementation on the Property Details page. It complements, rather than duplicates, [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\verification.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\verification.md).

## 1. Feature purpose

The feature presents a property-specific location-history story: selectable timeline years, a title/story for the selected entry, and a satellite map centered on the property. The UI copy explicitly describes the satellite tiles as approximate demo context, not surveyed boundaries.

## 2. Where it appears on the Property Details page

It appears in the shared `PropertyPageView` as the Location Story section headed `How this place has changed`. The visible kicker is `Location story`.

## 3. Exact section position/order

`PropertyPageView` renders this sequence after the hero:

1. `PropertyHero`
2. `LifeStageMatch`
3. `FutureNeighbourhoodMap`
4. `Lifestyle`
5. `PriceEmiFuture`
6. `LegalDocuments`
7. `SatelliteBeforeAfter`
8. `BuyingJourneySteps`
9. `SimilarProperties`
10. `PropertyFinalCta`
11. `StickyBottomCta`

Location Story is immediately after Verification / Legal Documents and before the buying journey.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\SatelliteBeforeAfter.tsx` — feature component and satellite map.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — shared page composition.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `TimelineEntry` and `PropertyRecord` definitions plus local data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts` — API mapping and timeline fallback.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — styling.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\package.json` — MapLibre dependency.

## 5. Component names

The component is actually named `SatelliteBeforeAfter`, exported as the default function from `SatelliteBeforeAfter.tsx`. `PropertyPageView` renders `<SatelliteBeforeAfter property={property} />`. There is no separately confirmed `LocationStory` component.

## 6. Component props

```ts
{ property: PropertyRecord }
```

It has no callbacks or optional props. `PropertyPageView` passes no Location Story-specific state.

## 7. Data sources

The component reads normalized `PropertyRecord` values: `timeline`, `coordinates`, `zoom`, `name`, and `location`.

- Local properties use static records from `src/data/properties.ts`.
- API properties are fetched by `ApiPropertyView` and normalized by `apiPropertyToRecord` in `src/services/propertyMapper.ts`.
- Satellite imagery comes directly from Esri tiles through MapLibre; there is no Location Story API request.

## 8. Local/static property behavior

Local records contain property-specific timeline arrays. Entries provide year buttons, active story title/copy, and per-entry map zoom. Inspected records use historical years such as `2015`–`2019`, current `2026` entries where applicable, and future illustrative entries such as `2029` or `2030`; exact entries vary by property.

## 9. API property behavior

API records do not receive timeline data from an endpoint. `apiPropertyToRecord` assigns `timeline: PLACEHOLDER_TIMELINE`, where `PLACEHOLDER_TIMELINE` is an empty `TimelineEntry[]`. API properties therefore have no year buttons or active story. Their map initializes with `property.zoom`, but the active-map update exits without an active timeline entry.

## 10. Timeline data structure

`PropertyRecord.timeline` is an array: `timeline: TimelineEntry[]`.

## 11. Exact timeline fields

```ts
export type TimelineEntry = {
  year: string;
  title: string;
  story: string;
  zoom: number;
};
```

`year` is the button key/label and selection value; `title` and `story` render the active copy; `zoom` controls the active map camera.

## 12. Current vs future/2029 behavior

`SatelliteBeforeAfter` does not implement a separate `Current` / `In 2029` toggle. It renders one tab per `property.timeline` entry.

The explicit Current and In 2029 controls belong to `FutureNeighbourhoodMap`. Its state is `horizon: "today" | "2029"`, initialized to `"today"`; its buttons call `setHorizon("today")` or `setHorizon("2029")`, change nearby-place data, update GeoJSON, and refit that map. They do not control satellite imagery.

## 13. Satellite/map implementation

`SatelliteBeforeAfter` creates a MapLibre map in `<div className="pd-sat__map" />` using an inline raster style. It adds one gold `Marker` at `property.coordinates` after load. It adds no polygons, routes, image overlays, surveyed boundaries, or additional GeoJSON layers.

## 14. Map library and tile source

- Library: `maplibre-gl` `^6.12.0`.
- Worker: `setWorkerUrl("/maplibre/maplibre-gl-worker.mjs")`.
- Raster source id: `satellite`.
- Tile URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
- Tile size: `256`; attribution: `Tiles © Esri`.
- Raster layer id/source: `satellite` / `satellite`.
- Layer range: `minzoom: 0`, `maxzoom: 19`.

## 15. Map initialization

The mount-only effect constructs:

```ts
new MapLibreMap({
  container: containerRef.current,
  style: SATELLITE_STYLE,
  center: property.coordinates,
  zoom: active?.zoom ?? property.zoom,
  attributionControl: { compact: true },
})
```

On `load`, it creates `new Marker({ color: "#c6a46c" })`, sets its coordinates, adds it to the map, and sets `mapReady` true.

## 16. Map center/zoom behavior

Coordinates use MapLibre `[longitude, latitude]` order. Initial center is `property.coordinates`; initial zoom is `active?.zoom ?? property.zoom`. When an active entry exists, the update effect calls `map.easeTo({ center: property.coordinates, zoom: active.zoom, duration: 700 })` and updates the marker location. The center does not change between timeline entries.

## 17. State variables

`SatelliteBeforeAfter` state:

- `activeYear` — selected year; initialized to the second-to-last timeline year, then first year, then `""`.
- `mapReady` — MapLibre load completion, initially `false`.
- `mapError` — map construction/event error, initially `false`.

Refs: `containerRef`, `mapRef`, and `markerRef`. Related `FutureNeighbourhoodMap` state is `horizon`, `nearBy`, `mapFailed`, `apiPlaces`, and `isLoadingApi`.

## 18. Derived values

`active` is `property.timeline.find((item) => item.year === activeYear) ?? property.timeline[0]`. It is the selected title/story/zoom entry.

## 19. Functions

There are no separately named local functions in `SatelliteBeforeAfter`; its button handler calls `setActiveYear(item.year)` inline. The related map uses `formatDistanceDisplay`, `formatCategoryLabel`, `formatProximityLabel`, `mapApiNearbyPlace`, `offsetFrom`, and `buildGeoJson`.

## 20. Hooks

The component uses `useRef` for map/marker/container refs, `useState` for `activeYear`, `mapReady`, and `mapError`, and `useEffect` for timeline reset, map creation/cleanup, and active zoom/marker updates.

## 21. Loading behavior

There is no visual loading state or loading text for the satellite map. The container renders immediately; the marker is added only after MapLibre emits `load`.

## 22. Error behavior

Map construction is wrapped in `try/catch`; construction errors and MapLibre `error` events set `mapError`. The fallback text is: `Satellite map unavailable right now. Timeline story still works below.` There is no retry control.

## 23. Empty/missing timeline behavior

For an empty timeline, `activeYear` is `""`, `active` is undefined, no year buttons render, and the title/story block is omitted. The map still initializes using `property.coordinates` and `property.zoom`; the update effect does nothing. No explicit empty message is rendered.

## 24. Map marker/layer behavior

The satellite component has exactly one raster source/layer (`satellite`) and one marker, colored `#c6a46c`, at `property.coordinates`. The marker is moved with `setLngLat`, removed during cleanup, and never changes by year.

The separate `FutureNeighbourhoodMap` uses GeoJSON source IDs `future-items`, `future-links`, and `future-origin-src`; it has landmark point/label layers, origin halo/dot/label layers, and origin-to-landmark line features. Those are not layers in Location Story.

## 25. Toggle behavior

Location Story uses year tabs. Each button has `role="tab"`, `aria-selected`, the `is-active` class when selected, and calls `setActiveYear(item.year)`.

The unrelated Future Neighbourhood Current/2029 controls use `aria-pressed`, `.pd-segment`, and `is-active`; they only change `horizon`.

## 26. Desktop behavior

At `@media (min-width: 760px)`, `.pd-sat__layout` uses `grid-template-columns: 0.95fr 1.05fr`; map first, story second. Location Story’s map is not sticky. The sticky desktop rule applies only to `.pd-future__map`.

## 27. Mobile behavior

Below `760px`, `.pd-sat__layout` remains a single-column grid, with map and story in normal flow. `.pd-sat__years` is a wrapping flex row, so year buttons wrap as needed.

## 28. Responsive behavior

Relevant CSS classes are `.pd-section`, `.pd-section__inner`, `.pd-sat`, `.pd-sat__layout`, `.pd-sat__map-wrap`, `.pd-sat__map`, `.pd-sat__overlay`, `.pd-sat__fallback`, `.pd-sat__years`, `.pd-sat__story`, and `.pd-sat__years button`.

Base styles use section padding `clamp(2.25rem, 5vh, 3.75rem) var(--pd-space)`, an inner `width: min(100%, var(--pd-max))`, heading size `clamp(1.55rem, 3.4vw, 2.25rem)`, and an 18rem map/wrapper height. The only Location Story-specific breakpoint confirmed is `@media (min-width: 760px)`.

## 29. External integrations

The feature integrates MapLibre GL, the worker at `/maplibre/maplibre-gl-worker.mjs`, and Esri World Imagery raster tiles. It uses no Location Story API endpoint, geolocation API, surveyed-boundary service, or imagery-comparison service.

## 30. Relationship with PropertyRecord

`PropertyRecord` is the component contract. Location Story consumes `timeline`, `coordinates`, `zoom`, `name`, and `location`; `timeline` is `TimelineEntry[]`, `coordinates` is `[number, number]`, and `zoom` is a number. The component does not mutate the record.

## 31. Relationship with PropertyPageView

`PropertyPageView` imports `SatelliteBeforeAfter` and renders `<SatelliteBeforeAfter property={property} />` after `LegalDocuments`. It passes no Location Story state or callbacks.

## 32. Relationship with ApiPropertyView

`ApiPropertyView` passes the normalized `apiPropertyToRecord` result to `PropertyPageView`. It does not fetch or pass timeline data separately, so API properties use the mapper’s empty `PLACEHOLDER_TIMELINE` fallback.

## 33. Relationship with FutureNeighbourhoodMap

`FutureNeighbourhoodMap` is the preceding, separate MapLibre section. It owns Current/2029 horizon state, nearby-place loading, list rendering, GeoJSON sources, routes, and origin layers. It shares no map instance or state with `SatelliteBeforeAfter`.

## 34. Relationship with the map feature

The home-page map is documented in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md`. Location Story reuses the MapLibre package and worker path but has its own inline satellite style and does not use `MapSection`, its layout raster, plot polygons, routes, or map instance.

## 35. Dependencies

Direct dependencies are React hooks, `maplibre-gl`, `maplibre-gl/dist/maplibre-gl.css`, and the `PropertyRecord` type. Indirect dependencies are `PropertyPageView`, property data/mapping, `PropertyDetail.css`, and the copied MapLibre worker in `public/maplibre/`.

## 36. Known issues

- API properties receive an empty timeline fallback and therefore have no year/story controls.
- The `SatelliteBeforeAfter` name suggests before/after imagery, but the implementation uses one unchanged raster source and changes only zoom/text selection.
- Imagery is approximate demo context, not surveyed boundaries.
- The marker is a single point, not a surveyed parcel marker.
- There is no satellite-map loading UI or retry action.
- Empty timelines have no explicit empty-state message.
- Exact imagery capture dates are UNKNOWN — needs verification.
- Exact coordinate accuracy/precision is UNKNOWN — needs verification.

## 37. Important constraints

- Preserve `SatelliteBeforeAfter` and its `{ property: PropertyRecord }` contract unless all usage is updated.
- Preserve `TimelineEntry`: `year: string`, `title: string`, `story: string`, `zoom: number`.
- Keep coordinates in `[longitude, latitude]` order.
- Do not describe the current behavior as a real before/after imagery comparison; source and raster layer remain unchanged by year.
- Do not treat the marker or tiles as surveyed boundaries.
- Keep API behavior distinct: the mapper currently supplies `PLACEHOLDER_TIMELINE: []` and there is no timeline endpoint.
- Keep year tabs separate from `FutureNeighbourhoodMap`’s `horizon` Current/2029 state.
- Preserve source/layer ID `satellite` and the Esri tile URL unless the map contract intentionally changes.
- Preserve marker/map cleanup and the confirmed `@media (min-width: 760px)` responsive behavior.
