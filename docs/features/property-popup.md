# Property Popup / PropertySheet feature

## Scope and terminology

There is no component named `PropertyPopup` in the current source. The map property popup equivalent is the function component `PropertySheet`, defined inside:

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`

This document describes the current `MapSection` implementation only. The broader map behavior is documented in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md`.

## 1. Feature purpose

`PropertySheet` is the selected-property summary shown from the property/plot map. It presents the selected development’s image, name, location, pricing, approval/RERA status, inventory summary, project size, plot size, tabbed information, and links to the property details page and page-section anchors.

It is a presentation component. It does not fetch data itself. `MapSection` resolves the selected property and passes the resulting `EstateProject` and optional `PropertyRecord` into it.

## 2. How the popup is triggered from the map

### Property marker

Property pins are created in `MapSection`’s marker effect. A pin click calls:

```ts
void selectProperty(project.id, {
  openSheet: isMobile,
  openLayout: true,
});
```

The relevant function is `selectProperty(propertyId, options)` in `MapSection.tsx`.

- `openLayout: true` loads the property layout and opens the map layout when geometry is available.
- `openSheet: isMobile` opens the mobile sheet directly for a mobile pin tap.
- On desktop, the loaded property becomes the active layout and the desktop sidebar renders the `PropertySheet`.

The marker click also calls `trackEvent` with `event_type: "MAP_MARKER_CLICK"`, `property_id: project.id`, and metadata `{ source: "map_pin", section_type: "hero_map" }`.

### Property list / layout selection

`openProject(projectId, plotId?)` selects a local/static project from the map/list UI. Without a plot id it sets `selectedProjectId` and therefore selects the property sheet. With a plot id it selects the plot and clears the property sheet selection.

For API-backed properties, `selectProperty` first calls `fetchPropertyById`, then `fetchPropertyUnits`. When the units are loaded it sets `remoteProject` and, according to the options, sets `activeProjectId` and/or `selectedProjectId`.

### Popup render condition

The mobile property popup is rendered when:

```tsx
portalReady && selectedProject && !selectedPlot && !mapFullscreen
```

It is rendered through `createPortal(…, document.body)`. See §7 for the portal rationale and the `portalReady` SSR guard.

The desktop sidebar renders `PropertySheet` whenever `activeProject` is truthy.

## 3. All popup states

The implementation has these states:

1. **No selected property** — the map/sidebar shows the development list or the normal map UI; no `PropertySheet` is rendered.
2. **Minimized mobile sheet** — `selectedProject` exists, `propertySheetExpanded` is `false`; the bottom sheet is `h-48 max-h-48` (192px).
3. **Expanded mobile sheet** — `selectedProject` exists, `propertySheetExpanded` is `true`; the sheet uses `h-[88%] max-h-[88%]` and can scroll internally.
4. **Expanded desktop sidebar sheet** — `activeProject` exists; the desktop sidebar always passes `expanded` and `collapsible={false}`.
5. **Property without a local `PropertyRecord`** — the sheet can still render project-derived values; `View Project` resolves `property?.id ?? apiProperty?.id`.
6. **Property without an image** — the hero image is omitted and the eyebrow/name/location render as text instead. In the minimized state the thumbnail is omitted and the identity row becomes text-only.
7. **Property with no units** — the parent can still show a property sheet/pin, but there is no plot geometry. `selectProperty` creates an `estatePlaceholderFromProperty` when an anchor exists.
8. **Fullscreen map** — the mobile sheet is not rendered at all, whatever its expand state.

There is no separate loading or error UI inside `PropertySheet`; those states are held by `MapSection` and described below.

## 4. Minimized state

The minimized state is mobile-only in the current popup container. It is controlled by:

```ts
const [propertySheetExpanded, setPropertySheetExpanded] = useState(false);
```

The mobile container is a portalled, viewport-fixed bottom sheet with:

- `h-48 max-h-48` (192px)
- `fixed inset-x-2 bottom-0 z-[200]`
- rounded top corners only (`rounded-t-[1.5rem]`); the bottom is docked to the viewport edge, so its corners are square and it carries `border-x border-t` only
- `px-2` side gutters, aligning it with the map frame's `mx-2`
- safe-area-aware bottom padding: `pb-[calc(env(safe-area-inset-bottom)+0.5rem)]`
- no scrim; the map remains visible and undimmed
- a control row (see §7) containing `Close property details` on the left, a drag grabber in the centre, and `Maximize property details` on the right

`PropertySheet` renders two bands:

1. An identity row: image (if available) with the `{availablePlots}/{totalPlots}` count overlaid on it, then name (`line-clamp-1`), location (`truncate`, with `PinIcon`), price, and `· from {starting}`.
2. A single fixed-height status strip that is itself the expand button (`onToggle`): an approval pill (`RERA` when `property.reraRegistered`, otherwise the approval label, capped at `max-w-[7rem]`) followed by `{availablePlots} avail · {projectExtent} · {plotSize}`.

There is no separate `View full details` button and no chevron on the strip — the expand affordance lives in the control row above.

The minimized component call passes `dense` and `onToggle={() => setPropertySheetExpanded((open) => !open)}`.

## 5. Expanded state

When expanded, `PropertySheet` renders:

- a hero block: image (`h-52 sm:h-60`) when one exists, with a floating `{availablePlots} available` badge, a `from-black/88` gradient, a gold-ruled `Selected property` eyebrow, name, and location. Without an image, the same eyebrow/name/location render as text (gold-ruled eyebrow, `pr-9` to clear the desktop Back button).
- the price card: a dark gradient surface (`bg-linear-to-br from-[#35322b] via-[#24231f] to-[#171614]`) with a gold hairline on its top edge, a `Price` eyebrow, the price, and a `Starting from` row justified to the right edge. The approval badge is **not** repeated here; approval and RERA appear once, in the chip row below.
- approval and optional `RERA` chips — the approval pill is green with a status dot, the RERA pill is gold with a `✦` seal
- a spec sheet `<dl>`: four label/value rows separated by hairlines, labelled `Total plots`, `Available`, `Acres`, `Plot size`. Each row carries a small colour dot drawn from the master-plan palette (`#8a8174`, `#1F8A68`, `#7CB342`, `#C6A46C` respectively)
- an underline tab bar (`role="tablist"`) with the four tabs: `about`, `location`, `amenities`, `developer`. The active tab is marked by a 2px gold `after:` underline
- the active tab content inside a `role="tabpanel"` (see §16)
- `View Project` when a `PropertyRecord` exists
- `Brochure` link to `#brochure`
- `Loan Calculator` link to `#loan-calculator`
- `Show less` when `collapsible` is true

The expanded mobile container uses `h-[88%] max-h-[88%]` and scrolls its content. Percentages resolve against the viewport for a `fixed` element, so the sheet no longer depends on viewport units that resize with mobile browser chrome.

## 6. Desktop behavior

The desktop property/plot sidebar is rendered at `md` and above by the `MapSection` layout. The relevant sidebar uses `hidden ... md:flex` and a fixed width of `w-88`.

When `activeProject` exists:

- the sidebar replaces the development heading/list with `PropertySheet`
- the call uses `expanded`, `dense={false}`, and `collapsible={false}`
- the sheet is therefore always full, with no `View full details`/`Show less` collapse control
- a separate `Back` button calls `closeLayout`
- the sidebar content scrolls vertically

The desktop sheet uses the roomier typography scale selected by `dense={false}` — `text-xl` for the name and `text-2xl` for the price, against `text-[16px]` for both on the `dense` phone scale. The desktop sidebar is not portalled and is not affected by the mobile sheet's positioning, z-index or fullscreen suppression.

## 7. Mobile behavior

On mobile (`md:hidden`):

- a selected property is shown as a viewport-fixed bottom sheet
- the sheet is rendered through `createPortal(…, document.body)`, so it is a page-level overlay rather than a child of the map section. Being nested inside the map frame bounded it by that frame's `overflow-hidden`, which clipped the sheet and made it read as a child of the map card instead of a surface in its own right. Portalling to `<body>` escapes every clipping ancestor.
- the render is guarded by `portalReady` (`useState(false)` flipped by a mount `useEffect`), because `createPortal` needs a real DOM and would throw on `document` during SSR
- the sheet has no dimming scrim and leaves the map visible
- the minimized sheet is 48 CSS height units tall (`h-48`, 192px) — sized so the control row, identity row, status strip and safe-area padding all fit without the body scrolling
- the expanded sheet occupies 88% of the viewport height
- the control row places `Close property details` left, the grabber centre, and `Maximize property details` right. The row is symmetric (two equal `h-7 w-7` slots flanking the 80px grabber) so the grabber stays optically centred; while expanded the right slot renders an inert `h-7 w-7` placeholder to preserve that symmetry. Both the grabber and the maximize button call `setPropertySheetExpanded(true)`
- the close action clears `selectedProjectId`, `activeProjectId`, and `propertySheetExpanded`
- the plot details sheet is mutually exclusive with the property sheet because the render condition requires `!selectedPlot`

### Fullscreen suppression

The render condition is:

```ts
portalReady && selectedProject && !selectedPlot && !mapFullscreen
```

`!mapFullscreen` was added because the fullscreen map is `fixed inset-0 z-50`, so the sheet covered the entire map it was describing. Selection state is untouched, so the sheet returns when fullscreen is exited.

### Consequences of page-level anchoring

`position: fixed` is viewport-anchored by definition. If the map section is scrolled out of view, the sheet stays pinned at the bottom of the screen over whatever content is now beneath it. This is an accepted tradeoff of the portal approach: the alternative (anchoring the sheet inside the map frame with `position: absolute`) keeps the sheet visually attached to the map but re-clips it against the frame's `overflow-hidden`.

The map marker determines mobile behavior with `window.matchMedia("(max-width: 767px)")`.

## 8. Exact component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`
  - `PropertySheet`
  - `PropertySheetProps`
  - `SHEET_TABS`, `SheetTab`
  - `PinIcon`, `ArrowIcon`, `CloseIcon`, `ExpandIcon`, `ChevronIcon` — the local SVG icons the sheet renders
  - `selectProperty`
  - `openProject`
  - `closeLayout`
  - `portalReady` state and its mount effect
  - mobile (portalled) and desktop render sites
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css`
  - `body { background: var(--background); color: var(--foreground) }` with `--foreground: #ffffff`. Every light surface in the sheet must therefore set its own text colour.
  - `.ila-scroll`, `.ila-tabs-scroll`, `.ila-map-loader`, `.ila-project-pin`, `animate-sheet-up`, `animate-map-hint-fade`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`
  - `PropertyRecord`
  - `popupSample`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\projects\index.ts`
  - `EstateProject`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`
  - `ApiProperty`
  - `fetchPropertyById`
  - `fetchPropertyUnits`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts`
  - `apiPropertyToRecord`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\[propertyId]\page.tsx`
  - property detail route selection

## 9. Component props

`PropertySheetProps` is:

```ts
type PropertySheetProps = {
  project: EstateProject;
  property: PropertyRecord | undefined;
  /** Live API detail for UUID-backed properties. */
  apiProperty?: ApiProperty | null;
  expanded: boolean;
  dense: boolean;
  collapsible?: boolean;
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  onToggle?: () => void;
  className?: string;
};
```

Defaults inside `PropertySheet`:

- `apiProperty = null`
- `collapsible = true`
- `onToggle = () => undefined`
- `className = ""`

The desktop call passes `collapsible={false}`. The mobile call uses the default collapsible behavior.

`apiProperty` is passed at both render sites from `activePopupApiProperty`, the `useMemo` in `MapSection` that merges `activePropertyDetail` with the matching row of `propertyList` so whichever response supplied each field wins (see §10).

## 10. Property data used

The sheet uses the live API detail when available, plus two normalized/fallback inputs:

### `ApiProperty` (live API detail)

For UUID-backed properties loaded by `selectProperty`, `MapSection` passes the fetched `ApiProperty` directly to `PropertySheet`. The popup gives these fields precedence over local fallbacks:

- `name`
- `description`
- `locality`, `city`, `location_name`, `address`
- `cover_url`
- `price_label`, `price`, `minimum_price`
- `rera_registered`
- `total_plots`, `available_plots_count`, `total_inventory`, `available_inventory`
- `area`, `area_range.min`, and `area_range.max`
- `amenities`

This means an API property does not need a matching entry in the local `PropertyRecord` catalogue to populate the popup. The `View Project` link uses the API UUID when no local record exists.

### `EstateProject`

Relevant fields:

- `id`
- `name`
- `location`
- `plots`

`plots` supplies fallback total and available counts.

### `PropertyRecord | undefined`

Relevant fields:

- `name`
- `location`
- `gallery`
- `popupSample`
- `areaCents`
- `sqYards`
- `price`
- `approval`
- `reraRegistered`
- `description`
- `tagline`
- `nearbyAmenities`
- `features`
- `id`

`selectedProperty` is derived from the selected project for local/static fallback content. For `sark-green`, `MapSection` maps the project id to the local property id `sark-green-plains`; otherwise it calls `getPropertyById(selectedProject.id)`. API-backed UUID properties additionally use `activePropertyDetail` directly, so missing local records no longer prevent API data from appearing.

## 11. Exact data fields displayed

### Header and summary

- API `cover_url`, otherwise `property.gallery[0]`, through `next/image`
- API `name`, otherwise `property.name ?? project.name`
- API locality/city/location/address, otherwise `property.location ?? project.location`
- API `price_label`, otherwise `formatPrice(api.price)`, then existing popup/local price fallbacks
- API `minimum_price`/`price`, otherwise existing starting-price fallbacks
- API `rera_registered`, otherwise existing approval/local fallbacks

### Counts/statistics

- API `total_plots`, then `popupSample.totalPlots`, `total_inventory`, and `project.plots.length`
- API `available_plots_count`, then `popupSample.availablePlots`, `available_inventory`, and the local available-plot count
- API `area` in acres, then existing project-extent/local fallbacks
- API `area_range` formatted as a square-yard range, then existing plot-size/local fallbacks

Full view labels are exactly `Total plots`, `Available`, `Acres`, and `Plot size`, rendered as a `<dl>` of label/value rows.

Compact view no longer uses separate labelled stat tiles. It shows `{availablePlots}/{totalPlots}` overlaid on the thumbnail and a single inline strip reading `{availablePlots} avail · {projectExtent} · {plotSize}`, preceded by the approval pill. `truncate` is applied to every value so the sheet height stays fixed as values get longer.

### Tab fields

- **About:** API `description`, then `property.description`, then `property.tagline`, then `Project details are available on the property page.`
- **Location:** `popupSample.locationHighlights`, otherwise `property.nearbyAmenities.map(item => `${item.name} · ${item.distanceKm} km`)`, otherwise `[projectLocation]`
- **Amenities:** API `amenities`, then `popupSample.amenities`, then `property.features`, then `property.nearbyAmenities.map(item => item.name)`, otherwise `Details available on request`
- **Developer:** `popupSample.developer`, otherwise `Developer information`; with popup sample, `${developerExperience} · ${projectsCompleted} projects completed`, otherwise `Developer details available on the property page.`

## 12. APIs used

`PropertySheet` itself uses no API.

The parent `MapSection` uses these service functions while preparing the selected property:

- `fetchProperties({ status: "ALL", page: 1, perPage: 100 })` — initial map/list data; endpoint `GET /api/properties?status=ALL&page=1&per_page=100`.
- `fetchPropertyById(propertyId)` — endpoint `GET /api/properties/{id}`.
- `fetchPropertyUnits(propertyId)` — endpoint `GET /api/properties/{id}/units?limit=all&offset={offset}` for paged unit loading.

The API base is `NEXT_PUBLIC_API_URL`, resolved by `apiFetch`/`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\ilaApiConfig.ts`. The property id for detail requests must be a UUID; `fetchPropertyById` rejects non-UUID ids.

## 13. API request/response structure relevant to the popup

### Property detail request

`fetchPropertyById(id)` requests:

```http
GET /api/properties/{id}
```

Expected relevant response shape:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "...",
    "description": "...",
    "short_description": "...",
    "price": 0,
    "total_inventory": 0,
    "available_inventory": 0,
    "approval_details": "...",
    "rera_registered": true,
    "rera_number": "...",
    "cover_url": "...",
    "amenities": [],
    "locality": "...",
    "city": "...",
    "latitude": 0,
    "longitude": 0,
    "metadata": {}
  }
}
```

The full TypeScript contract is `ApiProperty` in `propertiesService.ts`; fields not needed by the sheet are not repeated here.

### Units/layout request

`fetchPropertyUnits(id)` requests one or more pages of:

```http
GET /api/properties/{id}/units?limit=all&offset={offset}
```

Relevant response shape:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "property_id": "uuid",
        "plot_number": "A-01",
        "area_sq_yards": 150,
        "price": 0,
        "status": "available",
        "geometry": { "type": "Polygon", "coordinates": [] }
      }
    ],
    "total": 0,
    "limit": 0,
    "offset": 0,
    "layout_preview_url": "...",
    "tif_url": "...",
    "property_layout_cords": { "east": 0, "west": 0, "north": 0, "south": 0 }
  }
}
```

The units response creates the `EstateProject` used by the sheet/layout. The sheet does not display individual `PropertyUnit` fields.

### Mapping to popup data

`apiPropertyToRecord` in `propertyMapper.ts` maps API data into `PropertyRecord`, including `popupSample`:

- price-per-square-yard from `price` and minimum square-yard value
- starting price from `minimum_price` or `price`
- approval label from metadata/API approval fields
- total plots from `metadata.brochure_plot_count`/`metadata.total_plots` or `total_inventory`
- available plots from `available_inventory` or metadata
- project extent from metadata/API area
- plot sizes from mapped square-yard values
- developer from `metadata.developer` or `ILA Homes`
- location highlights from mapped location and optional `pincode`
- amenities from API `amenities`

## 14. Functions and hooks

### Functions directly related to the sheet

- `PropertySheet`
- `formatInr` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`
- `selectProperty`
- `openProject`
- `closeLayout`
- `closePanel`
- `getPropertyById`
- `apiPropertyToRecord`

### Hooks/state utilities in the parent

- `useState`
- `useMemo` for `activeProject`, `selectedProject`, `selectedProperty`, `selectedPlot`, `activePopupApiProperty`, and `loadingLabel`
- `useCallback` for `selectProperty` and `attachLayoutImage`
- `useEffect` for API loading, map marker behavior, fullscreen body-scroll locking, the `portalReady` mount flag, and the map `moveend` analytics
- `useRef` for the map, selection abort controller, and map-related runtime state
- `createPortal` from `react-dom` for the mobile sheet

`PropertySheet` itself does not use React hooks.

## 15. State variables

The popup-specific `MapSection` state is:

```ts
const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(null);
const [propertySheetExpanded, setPropertySheetExpanded] = useState(false);
const [propertySheetTab, setPropertySheetTab] = useState<SheetTab>("about");
const [portalReady, setPortalReady] = useState(false);
```

`portalReady` starts `false` and is flipped to `true` by a mount `useEffect`. It gates the `createPortal` call so nothing touches `document` during server rendering.

Related selection/layout state:

- `activeProjectId`
- `selectedId` — selected plot id
- `activePropertyId`
- `activePropertyDetail`
- `remoteProject`
- `remoteStatus`
- `unitsCount`
- `panelOpen`
- `focusRequest`

Derived values:

- `selectedProject`
- `selectedProperty`
- `activeProject`
- `activeProperty`
- `selectedPlot`

## 16. Tabs and their behavior

`SHEET_TABS` is exactly:

```ts
const SHEET_TABS = ["about", "location", "amenities", "developer"] as const;
```

`SheetTab` is the union of those four strings. Clicking a tab calls `onTabChange(item)`, which is `setPropertySheetTab` in `MapSection`.

The tab bar is a real ARIA tablist. Each tab is a `<button role="tab">` with:

- `id={`property-tab-${item}`}`
- `aria-selected={tab === item}`
- `aria-controls={`property-panel-${item}`}`

The single content wrapper is `<div role="tabpanel">` with `id={`property-panel-${tab}`}` and `aria-labelledby={`property-tab-${tab}`}`. Only the active tab's body is mounted, so the block does not change height as the reader switches. The active tab is styled with a gold `after:` underline rather than a filled pill.

Panel bodies, all sharing one surface class and one heading class:

- **about** — heading `About the project`, then one paragraph.
- **location** — heading `Nearby landmarks`, then a hairline-divided `<ul>`. The divider is suppressed on the first row by index, not by `first-of-type` (which would target the heading if the heading were an `<li>`).
- **amenities** — heading `Amenities`, then a fixed two-row `<ul>` laid out with `grid-flow-col grid-rows-2 auto-cols-max` inside `overflow-x-auto`. Column flow fills the first row then the second, so the list scrolls sideways rather than growing taller as amenities are added. Scrollbars are hidden via `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.
- **developer** — heading `Developer`, then an avatar row.

The shared panel surface carries an explicit `text-[#3f3a34]`. This is required, not decorative: `globals.css` sets `body { color: var(--foreground) }` with `--foreground: #ffffff`, so a panel without its own colour renders its body copy white-on-white.

There is no tab-specific API request and no tab-specific loading state.

## 17. Buttons/actions and what they do

- **Map property pin:** calls `selectProperty`; loads detail/units and opens the layout; opens the sheet immediately on mobile.
- **Desktop Back:** `aria-label="Back to all developments"`; calls `closeLayout` and clears layout/property/plot selection.
- **Mobile close (`Close property details`):** control-row left slot; clears `selectedProjectId`, `activeProjectId`, and `propertySheetExpanded`.
- **Mobile maximize (`Maximize property details`):** control-row right slot, shown only while minimized; calls `setPropertySheetExpanded(true)`.
- **Mobile grabber (`Show full property details`):** control-row centre; calls `setPropertySheetExpanded(true)`. Rendered as an inert `<span aria-hidden>` while expanded, since `Show less` already collapses.
- **Minimized status strip:** a full-width `<button>` calling `onToggle`; expands the sheet. It carries no chevron — the maximize button is the explicit expand affordance.
- **Tab buttons:** call `onTabChange`.
- **Show less:** calls `onToggle`; changes expanded mobile sheet to minimized. Only rendered when `collapsible` is true, so it never appears in the desktop sidebar.
- **View Project:** navigates to `/properties/${viewPropertyId}`.
- **Brochure:** navigates to the fragment `#brochure` in the current document.
- **Loan Calculator:** navigates to the fragment `#loan-calculator` in the current document.

## 18. Navigation/routes

The implemented property-detail navigation is:

```text
/properties/{property.id}
```

The route is handled by:

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\[propertyId]\page.tsx`

That page uses local `PropertyPageView` for known local records and `ApiPropertyView` for API UUID records.

The popup also contains same-document fragment links:

- `#brochure`
- `#loan-calculator`

No other popup route is implemented.

## 19. Related pages

- `/` — renders `MapSection`, which owns the sheet.
- `/properties` — renders `PropertiesList`; it is a separate catalogue and does not share `MapSection` React state.
- `/properties/{propertyId}` — renders the full property details page.

## 20. Related features

- MapLibre property pins and estate layouts in `MapSection`.
- Plot selection and plot details in `MapSection`.
- API property catalogue and property detail loading.
- Full property detail sections: lifestyle, neighbourhood, EMI/future value, legal documents, buying journey, similar properties, and CTAs.

## 21. Relationship with `MapSection`

`MapSection` owns all popup lifecycle state and supplies the selected data. `PropertySheet` is not exported and cannot be imported as a standalone component from another file.

The parent also decides whether the selection represents:

- a property (`selectedProjectId`/`selectedProject`), or
- a plot (`selectedId`/`selectedPlot`).

Opening a plot clears `selectedProjectId`; opening a project/property clears `selectedId`. Closing the layout clears both.

## 22. Relationship with the Property Details page

`View Project` is the only direct connection from the sheet to the details page. It links to `/properties/${property.id}`.

The full page is implemented by `PropertyPageView` and, for API UUIDs, `ApiPropertyView`. The page fetches the property detail and separately fetches documents and life-stage-fit data. The popup does not reuse `PropertyPageView` and does not render the full-page sections.

## 23. Relationship with Amenities

The popup’s `amenities` tab displays, in priority order:

1. `property.popupSample.amenities`
2. `property.features`
3. names from `property.nearbyAmenities`
4. `Details available on request`

The popup does not call an amenities endpoint. The full property page has its own mapped/lifestyle presentation.

## 24. Relationship with Developer information

The `developer` tab displays `popupSample.developer`, or the literal fallback `Developer information`. If `popupSample` exists, it appends `developerExperience` and `projectsCompleted`; otherwise it displays `Developer details available on the property page.`

There is no separate developer component, endpoint, or developer navigation connected to the popup in the inspected implementation.

## 25. Relationship with Loan Calculator if already connected

The popup contains a `Loan Calculator` link with `href="#loan-calculator"`. This is an in-page anchor only. No popup code imports `PriceEmiFuture`, `EmiAppreciation`, or a loan-calculator service, and no popup-specific calculator state is present.

The full property page’s `PropertyPageView` renders `PriceEmiFuture`, which contains the property-page EMI calculator. Whether an element with the exact id `loan-calculator` exists in the current rendered page is UNKNOWN — needs verification.

## 26. Relationship with Brochure if already connected

The popup contains a `Brochure` link with `href="#brochure"`. It does not fetch a brochure, open a document, or call `fetchPropertyDocuments`.

The full property page uses `LegalDocuments` and API `GET /api/properties/{id}/documents` through `ApiPropertyView`. That is a legal-document integration, not a popup brochure implementation. Whether an element with the exact id `brochure` exists in the current rendered page is UNKNOWN — needs verification.

## 27. Loading/error/empty states

### Loading

`MapSection` sets `remoteStatus` to `"loading"` and clears the previous remote project while `selectProperty` awaits `fetchPropertyById` and `fetchPropertyUnits`. `PropertySheet` is not rendered from a loading placeholder in this path; the exact user-facing loading UI during that transition is UNKNOWN — needs verification.

### Error

If `selectProperty` fails, it sets `remoteStatus` to `"error"` and logs `[ILA API] property load failed`. There is no error branch inside `PropertySheet`; exact visible error copy for the map selection path is UNKNOWN — needs verification.

### Empty/no geometry

If the units response contains no units, `selectProperty` still creates a placeholder project when coordinates are available, sets `remoteStatus` to `"ready"`, and can set `selectedProjectId` when `openSheet` is true. The sheet can therefore display a property without plot polygons.

### Missing property record

If `selectedProperty` is undefined, the live API fields and project fallbacks are still used. `View Project` remains available using the API property UUID.

### Missing fields

The component uses the literal fallbacks documented in sections 10 and 11, including `—`, `Price on request`, `Approval pending`, `Developer information`, and `Details available on request`.

## 28. External integrations

- MapLibre marker/map interaction is owned by `MapSection`.
- `next/image` renders the popup image.
- `next/link` renders the internal property and fragment links.
- `react-dom`'s `createPortal` renders the mobile sheet into `document.body`.
- `apiFetch` performs API requests using `NEXT_PUBLIC_API_URL` and tenant configuration.
- `trackEvent` records map marker clicks before property selection.

No external popup/modal library is used.

## 29. Dependencies

Direct source dependencies of `PropertySheet` include:

- React rendering through `MapSection.tsx`
- `next/image`
- `next/link`
- `EstateProject` from `@/data/projects`
- `PropertyRecord` and `getPropertyById` from `@/data/properties`
- `ApiProperty`, `PropertyListItem` and `formatPrice` from `@/services/propertiesService`
- `formatInr` from `@/lib/propertyUtils`

Mobile container dependencies include:

- `createPortal` from `react-dom`, for the page-level overlay described in §7

Parent selection dependencies include:

- `fetchPropertyById` and `fetchPropertyUnits` from `@/services/propertiesService`
- `apiPropertyToRecord`-compatible mapped property data
- MapLibre and the map/layout data structures documented in `map.md`

## 30. Known issues

- The source has no separately named `PropertyPopup`; changing the popup requires editing the large `MapSection.tsx` file.
- The popup does not own or expose its own loading/error state.
- `Brochure` and `Loan Calculator` are fragment links only; the target element presence is UNKNOWN — needs verification.
- API-backed `popupSample.developerExperience` and `popupSample.projectsCompleted` are currently mapped to `"—"` in `apiPropertyToRecord`.
- API-backed properties without `cover_url` have no popup image.
- API-backed properties without unit geometry can show a sheet but cannot show plot polygons/layout geometry.
- The popup’s displayed plot count can use brochure metadata rather than live inventory because `apiPropertyToRecord` prioritizes `metadata.brochure_plot_count`/`metadata.total_plots` for total plots.
- The popup’s location tab is named for location but falls back to `nearbyAmenities` when no `popupSample.locationHighlights` exists.
- The exact user-facing map loading/error copy is UNKNOWN — needs verification.
- The mobile sheet is `position: fixed` from a `<body>` portal, so it stays pinned to the viewport when the map section scrolls out of view. No `IntersectionObserver` currently hides it. Adding one is the intended remedy if the floating-over-other-sections behavior proves undesirable.
- The minimized sheet height (`h-48`) is hand-tuned to fit the control row, identity row, status strip and safe-area padding without scrolling. Adding a band to the minimized state means re-checking that budget.
- The mobile plot-details sheet (`selectedPlot`) is still nested inside the map frame and still uses `z-60`, not a portal and not `z-[200]`. It escapes clipping only because `position: fixed` is unaffected by an ancestor's `overflow: hidden` (no ancestor sets a transform/filter/contain). It is inconsistent with the property sheet and is a candidate for the same treatment.
- The tab bar scrolls horizontally on narrow screens. Arrow-key navigation between tabs is not implemented, so `role="tab"` is incomplete under the ARIA authoring practices; the buttons remain individually focusable and operable by Tab and Enter.

## 31. Important constraints

- Do not rename `PropertySheet` to `PropertyPopup` without updating the local type, render sites, and documentation; no separate popup component currently exists.
- Preserve the `PropertySheetProps` contract and the four-value `SheetTab` union when changing the sheet.
- Keep `selectedProjectId` and `selectedId` mutually exclusive for property-versus-plot presentation.
- API property detail requests require UUID ids; slugs are not accepted by `fetchPropertyById`.
- Use the existing `apiFetch` path/configuration rather than bypassing tenant/API setup.
- Preserve the mobile `selectedProject && !selectedPlot` condition unless the intended property/plot priority changes. `!mapFullscreen` is layered on top of it and suppresses the sheet in fullscreen.
- Keep the mobile sheet’s safe-area padding and internal scrolling behavior.
- Keep the `portalReady` guard on `createPortal`. Removing it renders a portal during SSR and throws on `document`.
- Do not reintroduce viewport-height units (`dvh`/`svh`) for the sheet's height. `dvh` resizes whenever the mobile browser shows or hides its URL bar, which is what made the sheet jump mid-scroll. Use percentages, which resolve against the viewport for a `fixed` element.
- Any element the sheet renders must set its own text colour, or inherit one from an ancestor that does. `globals.css` sets the body colour to `#ffffff`, so an uncoloured light panel renders white-on-white.
- `PropertySheet` assumes `project: EstateProject` is present; only `property` is optional.
- Coordinate/layout and MapLibre constraints remain those documented in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md`.