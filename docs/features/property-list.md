# Property List feature

This document describes the current Property List implementation only. It does not describe the separate property/plot list inside `MapSection`, the homepage Search behavior, or the Locations property results.

## 1. Feature purpose

The Property List is the catalogue view for browsing plotted developments currently returned by the API. It shows a responsive set of property cards with basic project information, links to property details, and a save-as-favourite control.

## 2. Where it appears

It appears on the Properties catalogue page. The page heading is `Properties`, with the supporting copy `Every plotted development currently on our books.`

## 3. Route

The exact route is `/properties`, rendered by `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\page.tsx`.

The property detail route used by each card is `/properties/{property.id}`.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\page.tsx` — catalogue route and page composition.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` — client-side list loading, enrichment, cards, and favourite controls.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — property list/detail types, requests, and price formatting.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\favoritesService.ts` — favourite loading, saving, and removal requests.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\apiClient.ts` — tenant-aware API request wrapper.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\useClickTracking.ts` — delegated handling of the card link analytics attributes.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — shared `.property-page`, `.pd-section`, and `.pd-section__inner` styling used by the route.

## 5. Component names

The route renders the default `PropertiesList` component from `PropertiesList.tsx`.

The route component is `PropertiesIndexPage`. There is no separate public `PropertyCard` component: each card is rendered inline by `PropertiesList` as a `Link` inside a list item.

## 6. Props

`PropertiesIndexPage` accepts no props, and `PropertiesList` accepts no props. The list obtains its data and interaction state internally.

## 7. Data source

The visible catalogue is API-backed, not a static property array. `PropertiesList` runs in the browser because the API tenant is identified from the browser hostname and sent as a request header.

The initial list response is loaded from `fetchProperties`. Favourites are loaded separately through `fetchFavorites`. Each returned list item is then optionally enriched with `fetchPropertyById`.

## 8. API endpoints and parameters

The initial request is:

`GET /api/properties?status=ALL&page=1&per_page=100`

The service constructs these query parameters as `status=ALL`, `page=1`, and `per_page=100`. The response is expected under `data.items`, with `data.total`, `data.page`, and `data.per_page` used when present.

For enrichment, the component requests:

`GET /api/properties/{id}`

where `{id}` is the property UUID from the list item. Up to three detail requests run concurrently.

Favourites use `GET /api/favorites`, `POST /api/favorites` with JSON body `{ property_id: "{id}" }`, and `DELETE /api/favorites/{id}`. Favourite requests include the `X-Visitor-Code` header.

All requests go through `apiFetch`, which uses `NEXT_PUBLIC_API_URL`, adds `X-Tenant-Domain`, and may add a stored bearer token.

## 9. Exact initial request size

The list initially requests `100` properties: `perPage: 100`, serialized as `per_page=100`. It requests page `1` and status `ALL`.

## 10. Property data structure

The list endpoint type is `PropertyListItem`:

- `id: string`
- `location_id: string | null`
- `name: string`
- `slug: string`
- `description: string | null`
- `property_type: string | null`
- `price: number | null`
- `cover_url: string | null`
- optional `latitude` and `longitude`, each `number | null`

The rendered/enriched item is `Enriched = PropertyListItem & Partial<ApiProperty>`. The detail type includes fields such as `status`, `locality`, `city`, `total_inventory`, and `rera_registered`, along with the other API property fields. The complete API response beyond the typed fields is UNKNOWN — needs verification.

## 11. Property fields displayed

The card can display these fields:

- `cover_url` as the card image; otherwise `No image`.
- `property_type` as a type badge when present.
- `status` as a status badge when present.
- `name` as the card heading.
- `locality` and `city`, joined with `, ` when either exists.
- `description`, limited to two visual lines.
- `total_inventory` under `Plots`, or `—` when falsy.
- `rera_registered` under `RERA`, shown as `Registered` or `Not listed`.
- `slug`, displayed with a leading slash.
- `price`, formatted by `formatPrice`; null, non-finite, or non-positive values display `Price on request`.

The card does not display every field in `ApiProperty`. Fields such as amenities, facing, address, available inventory, sold inventory, and coordinates are not displayed by this list card.

## 12. Property cards/list layout

Cards are rendered as `<li>` elements inside a semantic `<ul>`. Each card is a full-height Next `Link` containing an image area and a content area.

The image area uses a `16/10` aspect ratio. The content area contains the name, optional locality/city and description, a two-column `Plots`/`RERA` definition list, and the slug/price row. The favourite button is positioned over the card independently of the link.

## 13. Filtering behavior

There is no user-facing filtering control or filter state in `PropertiesList`.

The API request uses the fixed server filter `status=ALL`; the list does not expose a status, property-type, locality, RERA, price, or availability filter. No client-side filtering is performed after loading.

## 14. Sorting behavior

There is no sorting control, sort state, sort function, or client-side sort. The rendered order follows the API response order.

## 15. Pagination behavior

The service calculates `totalPages` for generic property-list requests, but `PropertiesList` does not render pagination controls and does not change the requested page. The UI always requests page `1` with `100` items.

Therefore pagination does not actually exist in the Property List UI. If the API has more than 100 matching properties, the complete UI behavior is UNKNOWN — needs verification.

## 16. Search behavior

The `/properties` catalogue has no search input, query state, autocomplete, URL query parameter, or search request.

The homepage Search implementation and `MapSection` search state are separate. Search is not implemented in this Property List component.

## 17. Property selection behavior

Selecting the card link selects the property for navigation by activating the Next `Link`. There is no in-list selected-card state, active card state, comparison selection, or map selection state.

Selecting the favourite button does not select or navigate to the property; it performs the independent favourite toggle request.

## 18. Navigation behavior

Each property card navigates to the exact internal route `/properties/{property.id}`. The id is the API property id, not the slug.

Navigation is implemented with `next/link`. The detail page then handles the UUID-based API property route.

## 19. State variables

`PropertiesList` owns these React state variables:

- `items`: the current list of `Enriched` properties.
- `total`: the API-reported total.
- `state`: `loading`, `ready`, or `error`.
- `savedIds`: a `Set<string>` of favourite property ids.
- `savingIds`: a `Set<string>` of ids currently being saved or removed.
- `favoriteError`: an optional favourite-loading or favourite-toggle message.

There is no page, filter, sort, query, selected-property, or map state in this component.

## 20. Derived values

The component derives the visible count text as `{items.length} of {total} properties`.

Each card derives the locality label by joining non-empty `locality` and `city`; the RERA label from `rera_registered`; the favourite button label from `savedIds` and `savingIds`; and the formatted price through `formatPrice`.

The service derives `totalPages` as `Math.max(1, Math.ceil(total / resolvedPerPage))`, but this value is not consumed by the catalogue UI.

## 21. Functions

Relevant functions are:

- `PropertiesIndexPage()` — renders the catalogue route.
- `PropertiesList()` — owns list rendering and state.
- `mapWithLimit()` — enriches list items with a maximum concurrency of three and preserves result positions.
- `handleFavoriteToggle(propertyId)` — saves or removes a favourite and updates local sets.
- `load()` — loads favourites, the initial property list, and detail enrichment.
- `fetchProperties()` — requests the list endpoint.
- `fetchPropertyById()` — requests one property detail.
- `formatPrice()` — formats API prices for display.
- `fetchFavorites()`, `saveFavorite()`, and `removeFavorite()` — operate on the favourites API.

## 22. Hooks

The component uses React `useState` for list/favourite state and `useEffect` for the one-time load operation and abort cleanup.

It uses Next `Link` and `Image`; it does not use `useRouter`, a shared search hook, a pagination hook, or a map hook.

## 23. Loading behavior

The initial state is `loading`. While the list request is pending, the component renders `Loading properties…` with `role="status"`.

After the list response arrives, the component changes to `ready` and renders the list immediately using the list fields. Detail enrichment then updates the cards with richer fields as a group completes. A slow or failed detail request does not remove the corresponding list item; the list item is retained as fallback data.

## 24. Error behavior

If the main list-loading promise rejects, the component logs `[properties] list fetch failed` and renders `Properties are unavailable right now. Please try again shortly.`

Detail-fetch failures are caught by `mapWithLimit` and fall back to the original list item; they do not put the whole list into the error state.

Favourite loading failures are independent. They log a warning and expose `Saved properties could not be loaded.` through the screen-reader-only live region. Favourite toggle failures expose either `Could not save this property. Please try again.` or `Could not remove this property. Please try again.`

Exact server error payloads shown to users are UNKNOWN — needs verification.

## 25. Empty-state behavior

When the list request succeeds but `items.length === 0`, the component renders `No properties listed yet.`

There is no empty-state action, retry button, or separate no-search-results state.

## 26. Analytics

Each property card link has:

- `data-track="PROPERTY_VIEW"`
- `data-track-property={property.id}`
- `data-track-meta='{"source":"properties_list"}'`

The global delegated click tracker emits `PROPERTY_VIEW` with the property id and metadata `{ source: "properties_list" }`. The analytics tracker queues the event and sends batches to `POST /api/events/batch` when a visitor code is available.

The list favourite button has no `data-track` attribute and `PropertiesList` does not call `trackEvent`; a Property List-specific `PROPERTY_FAVORITE` event is therefore not confirmed. UNKNOWN — needs verification whether another global mechanism records these API favourite requests.

## 27. Relationship with MapSection

There is no confirmed shared state between `PropertiesList` and `MapSection`.

`MapSection` separately loads its own `fetchProperties({ status: "ALL", page: 1, perPage: 100 })` result and owns its own query, plot filter, anchors, map selection, and layout state. The Property List does not consume MapSection state and does not render the map.

## 28. Relationship with Search

The Property List does not implement Search and does not receive the homepage hero query or `MapSection.query`.

The Search documentation confirms that the catalogue has no search input or client-side search state. Any homepage or map search interaction is independent of `/properties`.

## 29. Relationship with Locations

The Property List does not load locations and does not receive a location selection.

`GrowthCorridors` separately loads locations and its locality property results. Its property links also use `/properties/{property.id}`, but those results and state are not shared with `PropertiesList`.

## 30. Relationship with Property Details

The list is a producer of Property Details navigation. Its card links open `/properties/{property.id}`.

The Property Details route distinguishes local/static ids from API UUIDs; the list uses API property ids returned by the catalogue API. The list itself does not fetch documents, units, nearby places, life-stage data, or the full Property Details presentation.

## 31. Relationship with Wishlist/Favourites

The list is connected to the API-backed anonymous visitor favourites service, not the Property Details page's local-storage wishlist flags.

On mount it calls `fetchFavorites()` and initializes `savedIds` from returned `property_id` values. The card button calls `saveFavorite()` or `removeFavorite()`, disables itself while that id is in `savingIds`, and updates local state only after the request succeeds.

The visitor code comes from the visitor readiness flow and is sent as `X-Visitor-Code`. Favourites are not represented in the property-list request itself.

## 32. Desktop behavior

At the Tailwind `lg` breakpoint, the list uses three columns. Cards remain full-height within their grid cells. The card link has hover border/shadow behavior and a visible keyboard focus outline.

The route uses the shared property-page content container and section styling; no desktop-only alternate component is rendered.

## 33. Mobile behavior

Below the `sm` breakpoint, the cards use one column. At `sm` and above they use two columns, and at `lg` and above they use three columns.

The card image is responsive and uses the `next/image` sizes hint `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw`. There is no horizontal card scroller or mobile-specific alternate list behavior.

## 34. Responsive breakpoints

The Property List grid uses Tailwind breakpoints:

- Base: one column.
- `sm` (`min-width: 640px`): two columns.
- `lg` (`min-width: 1024px`): three columns.

The image sizes hint uses the corresponding `640px` and `1024px` boundaries. Other exact browser-width behavior outside these declared utilities is UNKNOWN — needs verification.

## 35. CSS/classes

The route uses these shared CSS classes from `PropertyDetail.css`: `property-page`, `pd-section`, `pd-section__inner`, `pd-kicker`, and `pd-section__lead`.

The list and cards primarily use Tailwind utility classes, including `grid`, `gap-4`, `sm:grid-cols-2`, `lg:grid-cols-3`, `relative`, `aspect-16/10`, `rounded-2xl`, `border`, `hover:border-[\#c6a46c]`, and `focus-visible:outline-2`.

The image uses `object-cover`; missing images use a text fallback. No separate Property List stylesheet or named card CSS class is confirmed.

## 36. Accessibility

The cards are semantic links inside a semantic unordered list. The main loading message uses `role="status"`.

The favourite control is a native button with `type="button"`, `aria-pressed`, and a disabled state while its request is pending. Favourite error text is placed in a screen-reader-only `aria-live="polite"` paragraph.

The card link has a `focus-visible` outline. Images currently use `alt=""`, so the cover image is treated as decorative; the visible property name supplies the card’s textual content. Exact screen-reader announcement behavior for the combined link/card and absolutely positioned favourite button is UNKNOWN — needs verification.

## 37. Dependencies

The feature depends on React 19 hooks, Next.js `Link` and `Image`, the internal `apiFetch` client, `propertiesService`, `favoritesService`, visitor readiness/cookie helpers, and the global delegated click-tracking infrastructure.

The project dependency versions include Next `16.3.8`, React `19.2.8`, React DOM `19.2.8`, Tailwind CSS `4`, and TypeScript `5`. The Property List does not directly depend on MapLibre, GeoTIFF, a search provider, or a pagination library.

## 38. Known issues and important constraints

Known current limitations and constraints are:

- The UI requests only page 1 and 100 properties; it has no pagination controls.
- There is no filtering, sorting, or search in this component.
- List detail enrichment is additional API traffic and is limited to three concurrent requests.
- A detail failure falls back to the shorter list record, so fields such as status, locality, inventory, and RERA may be unavailable for that card.
- Favourites depend on visitor readiness and the `X-Visitor-Code` header; failure does not fail the property list.
- The list uses API UUID ids for detail navigation; it does not navigate with slugs.
- The API base URL requires `NEXT_PUBLIC_API_URL`; tenant resolution requires the current hostname or server-side `SITE_DOMAIN`.
- The Property List state must not be assumed to be shared with `MapSection`, Search, or Locations.
- The exact backend behavior when more than 100 properties match is UNKNOWN — needs verification.
- Application files were not modified for this documentation task; unrelated existing working-tree changes must be preserved.