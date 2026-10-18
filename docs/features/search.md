# Search feature

This document describes the current Search implementation only. It complements [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-enquiry.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-enquiry.md). Search is not a single shared feature: the hero has a search-shaped navigation form, while `MapSection` has the actual client-side property filtering behavior. **`Hero` is currently unmounted** — `/` renders `MapSection` alone — so only the `MapSection` filtering described here is reachable today.

## 1. Feature purpose

The current Search UI provides:

- A hero input (`Hero.tsx`, currently unmounted) that accepts a query, records a property-search analytics event, queries the search endpoint `GET /api/search?q={query}&limit=20` (with graceful catalogue fallback), and renders exact matches and recommendations in a dialog, displaying and highlighting any returned explanatory `message` before the data list.
- A map-panel input that filters the currently loaded API property catalogue in memory.

There is no shared search store, URL query parameter, search-results route, autocomplete result list, or standalone Search component.

## 2. Where search appears

- Hero: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\Hero.tsx` — currently unmounted.
- Developments map, `MapSection`: mobile search panel in the section header and desktop search overlay in the map/sidebar area, both in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`. `MapSection` is the only section rendered on `/`.

The `/properties` catalogue rendered by `PropertiesList` has no search input or client-side search state.

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\Hero.tsx` — search form, submit behavior, highlighted message callout, and results dialog. Not mounted on any route.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx` — map search input, property filtering, filter buttons, and result selection.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — renders `MapSection` only; the `Hero` import and render were removed.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — supplies `searchProperties`, `PropertySearchResult`, `PropertySearchResponse`, and the property catalogue consumed by `MapSection`.
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

The hero search in `Hero.tsx` (currently unmounted) queries the public natural language property search API:

`GET /api/search?q={query}&limit=20`

via `searchProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`. If the search endpoint is unreachable or query is under 2 characters, it gracefully falls back to `fetchProperties`:

`GET /api/properties?status=ALL&page=1&per_page=100`

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

For Hero search, `GET /api/search` accepts `q` between 2 and 100 characters. Submitting a query with fewer than 2 characters bypasses the search endpoint and loads the standard development catalogue.

The hero also stores `filter`, although that filter only changes the selected visual button and is not applied to search or results. `MapSection` stores a separate plot-status `filter` (`"all"`, `"available"`, or `"sold"`) and uses it for map/layout plot behavior, not the property text query.

## 9. Search matching logic

### Hero Search

Hero search connects to the backend natural language property search engine at `GET /api/search?q={query}&limit={count}`. The backend extracts filters and returns:
- `properties`: exact matching properties (`PropertySearchResult[]`)
- `recommendations`: up to 5 alternative property suggestions (ordered by featured status and update date)
- `no_results_found`: boolean indicating if exact matches were found
- `message`: optional explanatory notice (e.g. `"No exact matches found. Here are 5 other properties you might be interested in."`)

Supported query patterns on the backend include:
- Bedroom filters: `2bhk in Tukkuguda`, `3+ bedrooms in Maheshwaram`
- Proximity filters: `2-3 bhk near airport` (matching operational nearby places, ordered nearest-first via Haversine distance)
- Type and location: `plots in Tukkuguda`, `apartments ready to move`
- Price filters: `under 50 lakh`, `30 to 50 lakh` (normalized to rupees from lakh/crore)
- Area filters: `1800 sq ft` (normalized from sq yards or gaj with approximate 10% tolerance)
- Feature matching: `gym in Tukkuguda`

If the search API call fails or is unreachable, `Hero` gracefully falls back to client-side substring matching against the property catalogue (matching `name`, `property_type`, `slug`, `description`, `locality`, `city`), and generates fallback recommendations and an explanatory message if no exact matches exist.

### MapSection

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

`MapSection` applies the same rule a second time to the open layout's plots, via the `matchedPlotNumbers` memo. The development list is hidden while a layout is open, so the property matcher has no visible effect there; with a layout open the query instead narrows the plotted polygons. It reads `activeProject.plotsGeo` feature properties rather than the `Plot` display records, because the raw values are the searchable ones: `facing` is the API's own `East  South` before `formatFacing` tidies it, and `plotNo` is the zero-padded number a visitor would type. It returns a `Set<string>` of matching `plotNo` values, or `null` when there is no query or no open layout.

## 10. Fields searched

### Hero Search

Hero search sends the natural language query to `GET /api/search`, which evaluates:
- Property name/title (`title`)
- Property type (`property_type`, e.g. `APARTMENT`, `PLOT`, `VILLA`)
- Locality and city names (`location`)
- Bedroom count (`bedrooms`)
- Price and price ranges (`price`)
- Area ranges
- Operational nearby places (`nearby_place`, calculated `distance_km`)
- Property features / amenities

### MapSection

The actual `MapSection` property search fields are exactly:

- `item.name`
- `item.property_type`
- `item.slug`
- `item.description`

Falsy values are removed before matching. Locality, city, address, location name, status, price, coordinates, plot number, facing, and unit fields are not searched by the implemented property filter.

The layout plot matcher reads these already-mapped `plotsGeo` feature properties, listed in the module constant `PLOT_SEARCH_FIELDS`:

- `plotNo`, `label` — plot number, zero-padded (`"07"`, `"45"`)
- `facing` — raw API direction, e.g. `East  South`
- `sq_yards`, `sq_ft` — area
- `price`, `per_sq_yard_price`, `per_sq_ft_price`
- `status` (raw, e.g. `AVAILABLE`), `statusNorm` (normalized `available`/`sold`)

These are exactly the fields `fromApi.ts` already maps from `GET /api/properties/{id}/units`, so plot search adds nothing to the client data contract. The richer unit fields the API also returns — `dimensions`, `road_info`, `plot_colour`, `special_notes`, `is_corner`, `additional_premium` — are **not** mapped today and are therefore **not** searchable. Extending plot search to those fields requires mapping them first; that is UNKNOWN — needs verification as a separate change.

Because of this, the active-layout placeholder `Search plot, facing or area` is now accurate: plot number, facing and area are all searched.

## 11. Filtering behavior

An empty or whitespace-only `MapSection.query` returns the complete `propertyList` in its current order. A non-empty query returns only items with at least one matching searched field.

The property-status buttons (`All`, `Available`, `Sold`) are separate from text matching. They describe plot counts for the active layout and do not add a property-list predicate to `filteredProperties`.

When a layout is open the two are independent: `query` filters `propertyList`, `filter` filters plotted plots. They are not nested — `filteredProperties` has no status predicate and the plot layers have no text predicate.

The hero buttons (`All`, `Land`, `Plots`, `Villas`) only call `setFilter(item)`. They do not filter the map, catalogue, or any result collection.

## 12. Result ordering

For Hero search, exact matches are ordered nearest-first for proximity queries (`near <place>`). Recommendations return up to 5 properties ordered by featured status and then most recently updated. In the catalogue fallback, original API response order is preserved.

Filtered property results in `MapSection` preserve the order of `propertyList`, which is the order returned by the API list response. No alphabetical, relevance, price, location, or date sort is applied.

## 13. Result limit

The hero search passes `limit=20` to `GET /api/search?q={query}&limit=20` (the endpoint accepts 1 to 20, default 8). Recommendations are capped at up to 5 properties.

In `MapSection`, there is no client-side search-result limit, pagination, or “show more” behavior. `MapSection` initially requests up to `per_page=100` properties from the API:

`GET /api/properties?status=ALL&page=1&per_page=100`

The effective number of searchable items is whatever the API returns in that response. The API response's `total` is stored by the service result but is not used to add search pagination.

## 14. State variables

### `Hero`

- `query: string`
- `filter: "All" | "Land" | "Plots" | "Villas"`
- `wordIndex: number`
- `wordVisible: boolean`
- `inputFocused: boolean`
- `results: PropertySearchResult[] | null`
- `recommendations: PropertySearchResult[]`
- `searchMessage: string | null`
- `resultMeta: { total: number; searched: string } | null`
- `searchStatus: "idle" | "loading" | "ready" | "error"`
- `searchAbortRef: React.MutableRefObject<AbortController | null>`
- `portalReady: boolean`

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
- `matchedPlotNumbers` — `Set<string>` of `plotNo` values in the open layout matching `query`, or `null` when there is no query or no open layout. Drives the plot layer filter.
- `activeProject` — selected estate layout, which changes the map-search placeholder and panel mode.
- `counts` — `all`, `available`, and `sold` plot counts for the active project/layout.
- `loading` and `loadingLabel` — selected-property/layout loading presentation.

## 16. Functions

Search-related functions and helpers are:

- `Hero.executeSearch(targetQuery: string)` — core search logic; prevents redundant requests, tracks `PROPERTY_SEARCH` analytics, manages abort controllers, calls `searchProperties` with fallback, populates exact matches and recommendations, and displays highlighted notice messages.
- `Hero.onSearch(event: SubmitEvent<HTMLFormElement>)` — form submission handler that calls `executeSearch(query)`.
- `searchProperties({ query, limit, signal })` — requests `GET /api/search?q={query}&limit={limit}` via `apiFetch`, returning `PropertySearchResponse`.
- `Hero.renderResultCard(item, isRecommendation?)` — renders a navigable luxury result card displaying property type badge, recommended badge, title, subtitle, price chip, bedrooms badge, proximity badge, and "View Property" link.
- `Hero.closeResults()` — closes the search results dialog, aborts in-flight requests, and resets search results/message.
- `MapSection.SearchIcon({ className })` — renders the search icon.
- `MapSection.filteredProperties` — `useMemo` derivation implementing matching.
- `MapSection.matchedPlotNumbers` — `useMemo` derivation implementing layout plot matching, returning `Set<string>` or `null`.
- `MapSection.closeLayout()` — exits the active layout and returns to the development list; its implementation also resets related map state.
- `MapSection.openProject(projectId, plotId?)` — opens a project/layout and resets query when entering a project without a specific plot.
- The inline clear handler — `setQuery("")` in both Hero search and MapSection search.

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
2. Aborts any in-flight request, clears previous messages/results, sets `searchStatus` to `"loading"`.
3. If the trimmed query is at least 2 characters, calls `searchProperties({ query: trimmed, limit: 20, signal })` targeting `GET /api/search?q={query}&limit=20`.
4. On success stores `resp.properties` in `results`, `resp.recommendations` in `recommendations`, `resp.message` in `searchMessage`, sets `resultMeta`, and sets `searchStatus` to `"ready"`.
5. If `searchProperties` fails or is unreachable, gracefully falls back to `fetchProperties` and filters the catalogue client-side, populating matches or recommendations and an explanatory notice.
6. If the query is empty or 1 character, fetches the full catalogue via `fetchProperties`.
7. The dialog displays any returned `searchMessage` in a prominent, gold-accented callout card before the list of data. Exact matches and alternative recommendations are rendered as navigable cards.

The hero **no longer scrolls to `#projects` on submit.** It previously called `scrollIntoView` on the `#projects` element, falling back to `router.push("/#projects")`. That was removed because `MapSection` owns a separate `query` state that nothing ever wrote to, so scrolling could never reflect what was typed. The `View map` CTA still uses `scrollToProjects()`.

The MapSection input updates results immediately on each change; it has no submit action.

## 20. Result selection behavior

Map property cards are rendered from `filteredProperties`. Selecting a card calls `selectProperty(item.id, { openLayout: true })`, opens the panel, and emits a `PROPERTY_VIEW` event with metadata `{ source: "homepage_developments_list" }`.

Selection loads the property detail and units/layout. It does not navigate immediately. A selected property can subsequently expose a `View Project` link in `PropertySheet`.

Hero search results are selectable cards linking to `item.href` (or `/properties/{id}`), closing the dialog and navigating to the property page on click.

## 21. Navigation behavior

Hero submission no longer navigates. It opens a results dialog in place.

Map property-card selection stays within the map and opens the selected layout. `PropertySheet`'s `View Project` link navigates to `/properties/{property.id}` when a normalized property is available. The map panel's bottom link uses `#contact` — which no longer has a target on `/`, since `FindYourPlot` is unmounted — and it is not a Search result navigation.

The `/properties` catalogue uses its own result links to `/properties/{property.id}`, but it has no Search input.

## 22. Loading behavior

`MapSection` initially loads the property list with `remoteStatus` set to `"loading"` by the component's initial state. During selected-property detail/unit loading, `remoteStatus` is `"loading"` and the map displays `Loading developments` or `Loading layout` with the property name where available.

The development-list empty-area message is `Loading developments…` while the list is loading and no filtered items exist.

Both `MapSection` messages render the shared `ila-loader ila-loader--sm` animation beside the text; see `docs\features\loading.md`.

The hero search has a loading state: `searchStatus === "loading"` renders "Searching developments…" beside the shared `ila-loader ila-loader--sm` animation. While the dialog is open (`searchStatus !== "idle"`) `document.body.style.overflow` is set to `hidden`, so the page behind cannot scroll.

## 23. Error behavior

If the `searchProperties` call fails, `Hero` automatically logs a warning and attempts a graceful fallback to `fetchProperties` with client-side filtering. If both fail, `Hero` sets `searchStatus` to `"error"` and renders "Developments could not be loaded. Please try again shortly." in the dialog.

If the `fetchProperties` request fails in `MapSection`, it sets `remoteStatus` to `"error"`, logs `[ILA API] properties list failed`, and displays `Developments could not be loaded. Try again shortly.` when the result list is empty.

## 24. Empty-state and highlighted message behavior

### Hero Search Dialog

- **Modal Container & Redesigned Scrollbar**: The dialog expands up to `max-w-4xl` on desktop with `rounded-3xl` borders and executive dark/gold header styling. The results list container features the custom `.ila-search-scroll` class with a slim 6px gold gradient thumb and hidden track buttons.
- **Highlighted Notice Callout**: Whenever `message` is returned in the API response (or generated in fallback), it is displayed prominently before the list of data in a dual-tone gold callout card (`border-[#8a6d2f]/45 bg-gradient-to-r from-[#faf6ee] via-[#f5edd7] to-[#faf6ee]`) with an informational icon badge and bold text.
- **Card Presentation**: Results and recommendations render as elevated card components with property category badges, "Recommended" badges, high-contrast price chips, bedroom / nearby place pills, and "View Property" interactive links.
- **No Exact Matches**: When `no_results_found` is true, the highlighted message informs the visitor and alternative `recommendations` are rendered below the message with an "Alternative Recommendations" section header.
- **Empty Catalogue / Zero Results**: When neither matches nor recommendations exist, renders "No developments match your search." with helpful suggestions.
- **Dismissal**: The dialog is dismissible by the close button, by a backdrop click (only when the click target is the backdrop itself, not the panel), and by `Escape`. The `Escape` listener is attached by an effect keyed on `searchStatus`, and is removed on cleanup. Selecting any result card also closes the dialog and navigates to the property page.

For the MapSection development list:

- Loading: `Loading developments…`
- Request error: `Developments could not be loaded. Try again shortly.`
- Ready with a non-empty query and no matches: `No developments match your search.`
- Ready with an empty query and no properties: `No developments published yet.`

## 25. Missing-field/fallback behavior

The property matching expression applies `.filter(Boolean)` to `[name, property_type, slug, description]`, so null/empty field values are ignored. It does not substitute locality, address, or another fallback field.

The API service defaults a missing response item array to `[]`. A failed property-detail or coordinate-enrichment request does not change the list search fields; the list item remains searchable if the list request supplied it.

For a selected property, display fallbacks belong to `PropertySheet` and map/property components, not the search matcher.

## 26. API usage

The hero search is API-backed through:

`GET /api/search?q={query}&limit={count}`

implemented by `searchProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` via `apiFetch`. If the search endpoint is unreachable or the query is below 2 characters, the hero falls back to `fetchProperties`:

`GET /api/properties?status=ALL&page=1&per_page=100`

The MapSection searchable source is API-backed through:

`GET /api/properties?status=ALL&page=1&per_page=100`

This request is made by `fetchProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` through `apiFetch`, which attaches the tenant header.

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

With a layout open, the same `query` additionally filters the plotted polygons on the map. The status filter and the query are combined into a single MapLibre `["all", ...]` filter applied to `estate-plots-fill`, `estate-plots-outline` and `estate-plots-label`, so both narrow the visible plots together. `query` does not filter the pins, the development list, or the satellite raster layer.

The hero `#projects` target is the `id="projects"` on `MapSection`.

## 29. Relationship with Property List

`PropertiesList` at `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` is the `/properties` catalogue. It independently fetches all properties with `GET /api/properties?status=ALL&page=1&per_page=100`, enriches them with detail calls, and renders links.

It has no `query` state, search input, matching logic, result limit beyond its API request, or shared state with `MapSection`. The map's own filtering on `/` does not alter the catalogue.

## 30. Relationship with Locations

`GrowthCorridors` loads locations with `GET /api/locations?page=1&per_page=20` and can load properties for a selected location with `GET /api/properties?location_slug={slug}&page=1&per_page=10`.

Those location and location-property states are independent of both `Hero.query` and `MapSection.query`. The Search feature does not search location records and does not search the `LocationRecord` fields `name`, `slug`, `description`, or `address`.

## 31. Relationship with Property Details

Selecting a MapSection property card loads property detail/layout data and may expose `PropertySheet` navigation to `/properties/{property.id}`. Direct property-page loading is documented in `property-details.md` and is not part of the Search matcher.

The Property Details page has no Search state or Search API request. Its breadcrumb/catalogue links are navigation relationships only.

## 32. Desktop behavior

### Hero

- **Search Bar Redesign**: The hero search form is full-width up to `max-w-3xl`. It features a dark glassmorphic shell with subtle gold borders (`border-[#c6a46c]/40`, `bg-gradient-to-r from-black/90 via-[#13110d]/95 to-black/90`), an inset circular search icon with a gold accent ring, an integrated clear button (`✕`) when a query is present, and an elevated gold gradient search button with an arrow micro-interaction.
- **Popular Suggestion Chips**: Below the input bar on desktop (`hidden md:flex`), quick-search pills ("Plots in Tukkuguda", "Luxury Villas", "Near Airport", "Maheshwaram") provide one-click search triggers.
- **Search Results Modal**: Portalled to `document.body` and expanded to `max-w-4xl` on larger screens. Features an executive dark-and-gold header with query and result count badges, a prominent notice banner, and luxury property listing cards.
- **Custom Scrollbar**: The search results scroll area uses the custom `.ila-search-scroll` class with a slim 6px gold gradient thumb and hidden track buttons.

### MapSection

The desktop map search is always rendered at `md` and above inside a top-right overlay:

`hidden ... md:flex`

Features an elevated `rounded-2xl` glassmorphic panel (`border-black/15 bg-[#eae4da]/95 shadow-[0_12px_32px_rgba(15,23,42,0.18)] backdrop-blur-md`) with gold focus borders and clean filter button dividers. The desktop sidebar is also `hidden ... md:flex`. The search panel is visible without a separate open/close state on desktop.

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

## 34a. Hero backdrop asset

The hero backdrop is a looping autoplaying video, replacing the previous pair of `next/image` stills (`hero-image-mobile.png` for small screens and `/hero-image.png` for `md` and above). `Hero.tsx` no longer imports `next/image`.

The asset lives at `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\public\assets\ila-homes-intro-video_DCqMvTfy.mp4` and is referenced by URL through the module constant `HERO_VIDEO_SRC = "/assets/ila-homes-intro-video_DCqMvTfy.mp4"`.

It must be served from `public/`. Importing a `.mp4` from `src/app/assets/` fails the build under Turbopack with `Unknown module type` — no loader is registered for that extension. Consequently the video is addressed by URL rather than imported, and no `*.mp4` TypeScript declaration exists or is needed.

The element is a single `<video>` with `autoPlay`, `muted`, `loop`, `playsInline`, and `preload="auto"`, plus `aria-hidden` and `tabIndex={-1}` because the backdrop is decorative. `muted` and `playsInline` are both required for correct mobile playback: iOS blocks unmuted autoplay, and without `playsInline` it takes the video fullscreen. The `animate-hero-zoom` entrance is retained; it is a 1.4s one-shot in `globals.css` that settles at `scale(1)` and is already disabled under reduced motion.

Encoding constraints, verified with `ffprobe`:

- Codec must be `h264` with `pix_fmt=yuv420p`. The supplied source was HEVC, which only Safari decodes; it rendered as a blank canvas in Chrome and Firefox.
- `moov` must precede `mdat` (faststart). The source had `moov` at byte 4,336,471 of 4,353,706, forcing a near-full download before playback.
- Current encode: `h264` High, `1080x1920`, `30fps`, `yuv420p`, `4.07 MB`, 10s, audio stripped.

The source footage is portrait `9:16` while the hero is landscape full-bleed. With `object-cover` only roughly the middle 31% of the frame height is visible on desktop; `object-[center_18%] md:object-center` sets the crop offsets. A landscape cut of the footage would be the real fix.

## 35. CSS classes

Search-specific custom CSS in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css`:

- `.ila-search-scroll` — custom luxury gold-gradient slim scrollbar (6px width, floating pill thumb, hidden buttons) for the hero search results dialog and search containers.
- `.ila-scroll` — modern slim scrollbar with hidden buttons for the map panel developments list and property sheets.
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
- Utility classes for the input/panel such as `rounded-2xl`, `border-black/15`, `bg-[#eae4da]/95`, `md:flex`, and `md:hidden`

The hero input uses the utility class string `relative z-10 min-w-0 w-full bg-transparent text-sm font-medium tracking-wide text-white outline-none sm:text-base`.

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

- The hero and `MapSection` still hold independent `query` state. Submitting in the hero does not seed `MapSection.query`.
- The hero filter buttons (`All`, `Land`, `Plots`, `Villas`) are visual state only and do not filter data.
- The MapSection placeholder says `Search projects or plots` / `Search plot, facing or area`, but the implemented text matcher only searches property `name`, `property_type`, `slug`, and `description`.
- MapSection does not filter plot rows or plot polygons using `query`; plot status filtering remains separate.
- Plot search matches only the unit fields `fromApi.ts` already maps. `dimensions`, `road_info`, `plot_colour`, `special_notes` and `is_corner` are returned by the units API but never reach the client, so they cannot be searched without first changing that mapping.
- Search state is not shared between the hero, map, `/properties` catalogue, or location/property views.
- Hero analytics sends `location: null` and `result_count: null`; no result count is calculated.
- The hero fallback route is `/#projects`; the current `MapSection` does define `id="projects"`.
- Exact backend behavior when the API returns more than 100 properties is UNKNOWN — needs verification.
- Exact visual behavior for browser zoom levels between the documented responsive utility breakpoints is UNKNOWN — needs verification.

## 38. Important constraints

- Treat `Hero` search and `MapSection` filtering as separate implementations; do not assume they share query state.
- Hero natural language search queries `GET /api/search?q={query}&limit=20` via `searchProperties`. Preserve the fallback to `fetchProperties` with client-side filtering if the search endpoint is unreachable or query is under 2 characters.
- In `Hero`, always display any returned response `message` in a highlighted callout card placed before the list of data.
- When `no_results_found` is true, render the message and display alternative `recommendations`.
- Hero results render as navigable `<Link>` cards targeting `item.href` (or `/properties/{id}`), closing the dialog on selection.
- Preserve the exact MapSection property matching fields and rule unless the intended Search contract changes: trimmed, lowercased substring matching over `name`, `property_type`, `slug`, and `description`, with falsy fields ignored.
- Keep `PLOT_SEARCH_FIELDS` limited to properties `fromApi.ts` already maps. Adding a field there that is not mapped would search for values the client never receives.
- Plot search filters map polygons only. There is no plot result list; `MapSection` renders plots as `estate-plots-fill`, `estate-plots-outline` and `estate-plots-label`, and the text predicate is applied to all three alongside the status predicate.
- Preserve the API list request shape used by MapSection: `status=ALL`, `page=1`, `per_page=100`.
- Preserve API result order for MapSection; no client-side sort or relevance ordering currently exists.
- Plot/facing/area matching IS implemented for the open layout via `matchedPlotNumbers`. It resolves in React and is applied to the map as a filter expression.
- `Hero` state includes `results: PropertySearchResult[] | null`, `recommendations: PropertySearchResult[]`, `searchMessage: string | null`, `resultMeta: { total, searched } | null`, `searchStatus: "idle" | "loading" | "ready" | "error"`, a `searchAbortRef` for superseding in-flight requests, and `portalReady` for the portal gate.
- Search still does not filter the map pins or the development list by plot attributes; only the plotted polygons are affected.
- The hero results dialog is portalled to `document.body` via `createPortal`. It is gated on a `portalReady` flag set after mount.
- Preserve the current analytics event name `PROPERTY_SEARCH` and its metadata shape when documenting or modifying the hero event.
- Keep `MapSection.query` separate from the plot-status `filter`; they control different behaviors.
- Preserve the `md`/`768px` desktop-mobile split, the hero `(max-width: 767px)` check, and the mobile `searchOpen`/`autoFocus` behavior.