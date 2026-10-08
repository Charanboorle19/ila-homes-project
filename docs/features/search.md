# Search feature

This document describes the current Search implementation only. It complements [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-enquiry.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-enquiry.md). Search is not a single shared feature: the homepage hero has a search-shaped navigation form, while `MapSection` has the actual client-side property filtering behavior.

## 1. Feature purpose

The current Search UI provides:

- A homepage hero input that accepts a query, records a property-search analytics event, and moves the visitor to the homepage developments map.
- A map-panel input that filters the currently loaded API property catalogue in memory.

There is no shared search store, URL query parameter, search-results route, autocomplete result list, or standalone Search component.

## 2. Where search appears

- Homepage hero: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\Hero.tsx`.
- Homepage developments map, `MapSection`: mobile search panel in the section header and desktop search overlay in the map/sidebar area, both in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`.

The `/properties` catalogue rendered by `PropertiesList` has no search input or client-side search state.

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\Hero.tsx` — homepage search form and submit behavior.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx` — map search input, property filtering, filter buttons, and result selection.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — renders `Hero` followed by `MapSection`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — supplies the API property list consumed by `MapSection`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\tracker.ts` — receives the hero `PROPERTY_SEARCH` event.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\events.ts` — declares `PROPERTY_SEARCH` and its batch-sendable status.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css` — custom animated hero-search word classes and keyframes.

## 4. Component names

- `Hero` — default export from `Hero.tsx`.
- `MapSection` — default export from `MapSection.tsx`.
- `SearchIcon` — private SVG helper in both `Hero.tsx` and `MapSection.tsx`.
- `PropertyCard` — private result card in `MapSection.tsx`; it receives filtered property items and is used for result selection.

## 5. Component props

- `Hero` accepts no props: `function Hero()`.
- `MapSection` accepts no props: `function MapSection()`.
- `SearchIcon` accepts `{ className?: string }` in both files.
- `PropertyCard` is internal to `MapSection.tsx`; its exact prop type is defined locally in that file. Search passes `item`, optional matching `detail`, `plotCount`, `active`, and an `onSelect` callback.

There is no public Search component prop contract.

## 6. Data sources

The hero search itself uses no property or location data.

`MapSection` loads the property catalogue with `fetchProperties({ status: "ALL", page: 1, perPage: 100, signal })`. The returned `PropertyListItem[]` becomes the local `propertyList` state. Missing coordinates are resolved separately with `fetchPropertyAnchors`; those coordinates are not search fields.

The map also loads selected-property details and units, but those requests do not provide the search result set.

## 7. Search input behavior

### Hero

The input is controlled by `query`, uses `onChange={(e) => setQuery(e.target.value)}`, and has `aria-label="Search location, area or properties"`. Its visible placeholder is animated text rather than the native `placeholder` attribute.

### MapSection

The input is controlled by the same local `query` state for both responsive renderings. It uses `onChange={(e) => setQuery(e.target.value)}`. Its placeholder is:

- `Search projects or plots` when no layout is active.
- `Search plot, facing or area` when `activeProject` is set.

On mobile the input is revealed by the `searchOpen` state and receives `autoFocus`. A clear button appears when `query` is non-empty and calls `setQuery("")`.

## 8. Search query/state structure

The query is a local string:

```ts
const [query, setQuery] = useState("");
```

It is not stored in the URL, browser storage, context, or a server-side search session. `Hero.query` and `MapSection.query` are separate states.

The hero also stores `filter`, although that filter only changes the selected visual button and is not applied to search or results. `MapSection` stores a separate plot-status `filter` (`"all"`, `"available"`, or `"sold"`) and uses it for map/layout plot behavior, not the property text query.

## 9. Search matching logic

`MapSection` derives `filteredProperties` with:

```ts
const q = query.trim().toLowerCase();
if (!q) return propertyList;
return propertyList.filter((item) =>
  [item.name, item.property_type, item.slug, item.description]
    .filter(Boolean)
    .some((field) => field!.toLowerCase().includes(q)),
);
```

Therefore matching is trimmed, case-insensitive, and based on substring inclusion. It is an OR match across the searched fields. There is no tokenization, fuzzy matching, stemming, ranking, debounce, or server-side query parameter.

The hero does not perform matching. Its typed query is only trimmed for analytics metadata and checked for non-empty submission.

## 10. Fields searched

The actual `MapSection` property search fields are exactly:

- `item.name`
- `item.property_type`
- `item.slug`
- `item.description`

Falsy values are removed before matching. Locality, city, address, location name, status, price, coordinates, plot number, facing, and unit fields are not searched by the implemented property filter.

Although the active-layout placeholder says `Search plot, facing or area`, no corresponding plot/facing/area query matching is implemented in the inspected code. `UNKNOWN — needs verification` only applies if another uninspected runtime integration is expected; no such integration is present in the current source.

## 11. Filtering behavior

An empty or whitespace-only `MapSection.query` returns the complete `propertyList` in its current order. A non-empty query returns only items with at least one matching searched field.

The property-status buttons (`All`, `Available`, `Sold`) are separate from text matching. They describe plot counts for the active layout and do not add a property-list predicate to `filteredProperties`.

The hero buttons (`All`, `Land`, `Plots`, `Villas`) only call `setFilter(item)`. They do not filter the map, catalogue, or any result collection.

## 12. Result ordering

Filtered property results preserve the order of `propertyList`, which is the order returned by the API list response. No alphabetical, relevance, price, location, or date sort is applied.

Hero submission produces no result collection.

## 13. Result limit

There is no client-side search-result limit, pagination, or “show more” behavior. `MapSection` initially requests up to `per_page=100` properties from the API:

`GET /api/properties?status=ALL&page=1&per_page=100`

The effective number of searchable items is whatever the API returns in that response. The API response's `total` is stored by the service result but is not used to add search pagination.

## 14. State variables

### `Hero`

- `query: string`
- `filter: "All" | "Land" | "Plots" | "Villas"`
- `wordIndex: number`
- `wordVisible: boolean`
- `inputFocused: boolean`

### `MapSection`

Search-related state includes:

- `query: string`
- `filter: "all" | "available" | "sold"`
- `searchOpen: boolean`
- `propertyList: PropertyListItem[]`
- `remoteStatus: "idle" | "loading" | "ready" | "error"`
- `activeProjectId: ProjectId | null`
- `activePropertyId: string | null`
- `activePropertyDetail: ApiProperty | null` (used for selected-property display, not matching)

The component has additional map, plot, selection, fullscreen, and loading state unrelated to text matching.

## 15. Derived values

### `Hero`

- `showAnimatedPlaceholder = !query && !inputFocused`.
- The displayed animated word is `SEARCH_WORDS[wordIndex]`, where `SEARCH_WORDS` is `[`"location"`, `"area"`, `"properties"`]`.

### `MapSection`

- `filteredProperties` — the client-side text-filtered property list.
- `activeProject` — selected estate layout, which changes the map-search placeholder and panel mode.
- `counts` — `all`, `available`, and `sold` plot counts for the active project/layout.
- `loading` and `loadingLabel` — selected-property/layout loading presentation.

## 16. Functions

Search-related functions and helpers are:

- `Hero.onSearch(event: FormEvent)` — prevents default submission, tracks a non-empty typed query, and scrolls or routes to `#projects`.
- `MapSection.SearchIcon({ className })` — renders the search icon.
- `MapSection.filteredProperties` — `useMemo` derivation implementing matching.
- `MapSection.closeLayout()` — exits the active layout and returns to the development list; its implementation also resets related map state.
- `MapSection.openProject(projectId, plotId?)` — opens a project/layout and resets query when entering a project without a specific plot.
- The inline clear handler — `setQuery("")`.

No function submits a search request to an API.

## 17. Hooks

`Hero` uses `useRouter`, `useRef`, `useState`, and `useEffect`. Its effects control mobile hero height and animated placeholder words.

`MapSection` uses `useState`, `useMemo`, `useCallback`, `useEffect`, and `useRef`. Search-specific derivation is implemented with `useMemo`; the property list is fetched in an effect on mount.

No search-specific debounce, throttle, query-param hook, or external search hook exists.

## 18. Keyboard behavior

### Hero

The hero search is a native `<form role="search">`. Pressing Enter in its input submits the form and invokes `onSearch`.

### MapSection

The map search input is not inside a search form and has no `onKeyDown` or explicit Enter handler. Pressing Enter therefore has no Search-specific behavior beyond the browser's normal input behavior.

No arrow-key navigation, Escape handler, or keyboard result-selection handler is implemented for Search. Escape behavior for other map panels must not be inferred as search behavior.

## 19. Submit behavior

Only the hero has submit behavior. `onSearch` calls `event.preventDefault()`, trims `query`, and:

1. Emits `PROPERTY_SEARCH` only when the trimmed query is non-empty.
2. Finds `document.getElementById("projects")` and calls `scrollIntoView({ behavior: "smooth", block: "start" })` when present.
3. Otherwise calls `router.push("/#projects")`.

The hero's selected `filter` is not included in the submit event and does not affect navigation or filtering.

The MapSection input updates results immediately on each change; it has no submit action.

## 20. Result selection behavior

Map property cards are rendered from `filteredProperties`. Selecting a card calls `selectProperty(item.id, { openLayout: true })`, opens the panel, and emits a `PROPERTY_VIEW` event with metadata `{ source: "homepage_developments_list" }`.

Selection loads the property detail and units/layout. It does not navigate immediately. A selected property can subsequently expose a `View Project` link in `PropertySheet`.

The hero has no selectable search results.

## 21. Navigation behavior

Hero submission navigates/scrolls to the homepage section `#projects`.

Map property-card selection stays within the homepage map and opens the selected layout. `PropertySheet`'s `View Project` link navigates to `/properties/{property.id}` when a normalized property is available. The map panel's bottom link uses `#contact` and is not a Search result navigation.

The `/properties` catalogue uses its own result links to `/properties/{property.id}`, but it has no Search input.

## 22. Loading behavior

`MapSection` initially loads the property list with `remoteStatus` set to `"loading"` by the component's initial state. During selected-property detail/unit loading, `remoteStatus` is `"loading"` and the map displays `Loading developments` or `Loading layout` with the property name where available.

The development-list empty-area message is `Loading developments…` while the list is loading and no filtered items exist.

The hero search has no loading state, spinner, async request, or pending submit state.

## 23. Error behavior

If the `fetchProperties` request fails, `MapSection` sets `remoteStatus` to `"error"`, logs `[ILA API] properties list failed`, and displays `Developments could not be loaded. Try again shortly.` when the result list is empty.

The hero has no search error state. Analytics transport failures are handled by the existing tracker, not by `Hero`.

## 24. Empty-state behavior

For the MapSection development list:

- Loading: `Loading developments…`
- Request error: `Developments could not be loaded. Try again shortly.`
- Ready with a non-empty query and no matches: `No developments match your search.`
- Ready with an empty query and no properties: `No developments published yet.`

There is no separate hero empty-results state because the hero does not produce results.

## 25. Missing-field/fallback behavior

The property matching expression applies `.filter(Boolean)` to `[name, property_type, slug, description]`, so null/empty field values are ignored. It does not substitute locality, address, or another fallback field.

The API service defaults a missing response item array to `[]`. A failed property-detail or coordinate-enrichment request does not change the list search fields; the list item remains searchable if the list request supplied it.

For a selected property, display fallbacks belong to `PropertySheet` and map/property components, not the search matcher.

## 26. API usage

Search is not API-backed as a query operation.

The MapSection searchable source is API-backed through:

`GET /api/properties?status=ALL&page=1&per_page=100`

This request is made by `fetchProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` through `apiFetch`, which attaches the tenant header. The query text is never sent as an API parameter.

Selected-result behavior may subsequently call:

- `GET /api/properties/{id}`
- `GET /api/properties/{id}/units?...`

Those are property/layout loading requests, not Search requests.

## 27. Analytics behavior

The hero emits `PROPERTY_SEARCH` directly with:

```ts
{
  query: trimmed,
  location: null,
  result_count: null,
  page_url: window.location.pathname,
}
```

It emits this only for a non-whitespace typed query on hero form submission. `PROPERTY_SEARCH` is declared in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\events.ts` and is batch-sendable.

Map query typing, clearing, and filtering have no dedicated Search analytics event. Selecting a filtered property emits `PROPERTY_VIEW` with `{ source: "homepage_developments_list" }`.

## 28. Relationship with Map

`MapSection` is the primary implementation of client-side Search. Its property list and `filteredProperties` drive the “Our Developments” panel while map pins and layout rendering are managed separately.

Filtering the text list does not filter map pins. Selecting a filtered list card loads its property detail and layout, and map interactions can then select plots.

The hero `#projects` target is the `id="projects"` on `MapSection`.

## 29. Relationship with Property List

`PropertiesList` at `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` is the `/properties` catalogue. It independently fetches all properties with `GET /api/properties?status=ALL&page=1&per_page=100`, enriches them with detail calls, and renders links.

It has no `query` state, search input, matching logic, result limit beyond its API request, or shared state with `MapSection`. Search filtering on the homepage does not alter the catalogue.

## 30. Relationship with Locations

`GrowthCorridors` loads locations with `GET /api/locations?page=1&per_page=20` and can load properties for a selected location with `GET /api/properties?location_slug={slug}&page=1&per_page=10`.

Those location and location-property states are independent of both `Hero.query` and `MapSection.query`. The Search feature does not search location records and does not search the `LocationRecord` fields `name`, `slug`, `description`, or `address`.

## 31. Relationship with Property Details

Selecting a MapSection property card loads property detail/layout data and may expose `PropertySheet` navigation to `/properties/{property.id}`. Direct property-page loading is documented in `property-details.md` and is not part of the Search matcher.

The Property Details page has no Search state or Search API request. Its breadcrumb/catalogue links are navigation relationships only.

## 32. Desktop behavior

### Hero

The hero form is full-width within responsive max-width containers. At `md` and above it is positioned toward the bottom of the hero with `md:bottom-9`, and at large screens `lg:bottom-12`.

### MapSection

The desktop map search is always rendered at `md` and above inside a top-right overlay:

`hidden ... md:flex`

The desktop sidebar is also `hidden ... md:flex`. The search panel is visible without a separate open/close state on desktop.

## 33. Mobile behavior

### Hero

The hero form is positioned near the top with `top-4` (and `sm:top-5`). The hero uses a mobile height-lock effect when `(max-width: 767px)` matches.

### MapSection

The mobile search is initially closed. The section header shows an `Open search` button; clicking it sets `searchOpen` to `true`, renders the search panel, and focuses the input with `autoFocus`. A `Close search` button sets `searchOpen` to `false`; a separate clear button resets the query.

The mobile map/header is used below the desktop `md` breakpoint. The map layout and property sheet remain touch-oriented, but text search itself only filters the development list.

## 34. Responsive behavior

The primary Search/Map breakpoint is Tailwind `md`, which corresponds to `768px` in the rendered utility CSS:

- Below `768px`: mobile header search is conditional on `searchOpen`; desktop sidebar and desktop overlay are hidden.
- At `768px` and above: desktop sidebar and desktop overlay search are shown; mobile header search controls are hidden.

The hero's mobile-specific JavaScript check is `(max-width: 767px)`. The hero layout also uses `sm` (`640px`), `md` (`768px`), and `lg` (`1024px`) utility variants. No separate Search-specific breakpoint is defined.

## 35. CSS classes

Search-specific custom CSS in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css`:

- `.hero-search-word`
- `.hero-search-word--in`
- `.hero-search-word--out`
- `.hero-search-word-slot`
- `.hero-search-word-slot > *`
- `@keyframes search-word-in`
- `@keyframes search-word-out`

Map search-specific named classes in `MapSection.tsx`/global styles include:

- `.ila-map-search-panel--open`
- `.ila-scroll` on the desktop result list container
- Utility classes for the input/panel such as `rounded-xl`, `border-black/15`, `bg-[#d9d2c7]`, `md:flex`, and `md:hidden`

The hero input uses the utility class string `relative z-10 min-w-0 w-full bg-transparent text-base font-medium tracking-wide text-white outline-none sm:text-lg`.

## 36. Dependencies

Direct Search dependencies are:

- React: `useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`.
- Next.js: `useRouter` from `next/navigation` in `Hero`.
- `fetchProperties`, `PropertyListItem`, and related property types from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`.
- `apiFetch` through the existing service boundary.
- `trackEvent` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\tracker.ts`.
- `PROPERTY_SEARCH` and `PROPERTY_VIEW` event vocabulary from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\events.ts`.
- Tailwind utility classes and the custom global CSS search-word animation.
- MapLibre and the other `MapSection` dependencies for map/layout presentation; they are not used to perform text matching.

## 37. Known issues

- The homepage hero search does not search or display results; it only tracks and scrolls to the map.
- The hero filter buttons (`All`, `Land`, `Plots`, `Villas`) are visual state only and do not filter data.
- The MapSection placeholder says `Search projects or plots` / `Search plot, facing or area`, but the implemented text matcher only searches property `name`, `property_type`, `slug`, and `description`.
- MapSection does not filter plot rows or plot polygons using `query`; plot status filtering remains separate.
- Search state is not shared between the hero, map, `/properties` catalogue, or location/property views.
- Hero analytics sends `location: null` and `result_count: null`; no result count is calculated.
- The hero fallback route is `/#projects`; the current `MapSection` does define `id="projects"`.
- Exact backend behavior when the API returns more than 100 properties is UNKNOWN — needs verification.
- Exact visual behavior for browser zoom levels between the documented responsive utility breakpoints is UNKNOWN — needs verification.

## 38. Important constraints

- Treat `Hero` navigation and `MapSection` filtering as separate implementations; do not assume they share query state.
- Preserve the exact MapSection matching fields and rule unless the intended Search contract changes: trimmed, lowercased substring matching over `name`, `property_type`, `slug`, and `description`, with falsy fields ignored.
- Do not send the query text as an API parameter unless the API contract is intentionally changed; the current implementation is client-side after the initial property-list fetch.
- Preserve the API list request shape used by MapSection: `status=ALL`, `page=1`, `per_page=100`.
- Preserve API result order; no client-side sort or relevance ordering currently exists.
- Do not describe plot/facing/area matching as implemented; the current code only changes the placeholder when a layout is active.
- Preserve the hero Enter behavior: prevent default, track only non-empty trimmed input, then scroll to `#projects` or route to `/#projects`.
- Preserve the current analytics event name `PROPERTY_SEARCH` and its metadata shape when documenting or modifying the hero event.
- Keep `MapSection.query` separate from the plot-status `filter`; they control different behaviors.
- Preserve the `md`/`768px` desktop-mobile split, the hero `(max-width: 767px)` check, and the mobile `searchOpen`/`autoFocus` behavior.
- Application files were not modified for this documentation task. Existing working-tree changes must be preserved.