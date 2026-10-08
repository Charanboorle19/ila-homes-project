# Amenities / Lifestyle feature

This document describes the current Amenities / Lifestyle implementation used by the Property Details page. The current code does not expose separate Property Details components named `Amenities` and `Lifestyle`; the feature is implemented together by the `Lifestyle` component. This document complements, rather than duplicates, [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-images.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-images.md).

## 1. Feature purpose

The feature presents lifestyle moments or property amenities as selectable numbered points. Selecting a point changes the right-hand stage to either an image with a caption or an image-free typographic panel. For local properties, the points describe lifestyle imagery. For API properties, published amenities are normalized into the same lifestyle-point UI.

## 2. Where it appears on the Property Details page

It appears as the `pd-lifestyle` section in the shared Property Details page rendered by `PropertyPageView`. It follows `FutureNeighbourhoodMap` and precedes `PriceEmiFuture`.

## 3. Exact section order/position

`PropertyPageView` renders the relevant sequence as:

1. `<LifeStageMatch property={property} />`
2. `<FutureNeighbourhoodMap property={property} />`
3. `<Lifestyle key={property.id} property={property} />`
4. `<PriceEmiFuture property={property} />`

The `Lifestyle` section is therefore the fourth major content component after the hero, and is immediately before pricing/EMI content in the complete page render order.

## 4. Component/file paths

- Component: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\Lifestyle.tsx`
- Parent page composition: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx`
- Data types, defaults, and resolver: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`
- API normalization: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts`
- API property type/request functions: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`
- Styling: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`
- API detail wrapper: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ApiPropertyView.tsx`

## 5. Component names

The component is the default export `Lifestyle` from `Lifestyle.tsx`. It is imported and rendered by `PropertyPageView`. There is no separately confirmed Property Details component named `Amenities`.

## 6. Component props

`Lifestyle` accepts exactly one prop:

```ts
{ property: PropertyRecord }
```

It has no separate `items`, `activeId`, `paused`, callback, image, or API props. The component obtains its items from `getPropertyLifestyle(property)` and owns its interaction state internally.

## 7. Data sources

The effective lifestyle data comes from `getPropertyLifestyle` in `src/data/properties.ts`:

```ts
export function getPropertyLifestyle(property: PropertyRecord): LifestyleItem[] {
  return property.lifestyle ?? DEFAULT_LIFESTYLE;
}
```

Sources are therefore:

- A local/static `PropertyRecord.lifestyle` array when present.
- API `amenities`, converted by `apiPropertyToRecord` into `PropertyRecord.lifestyle`.
- `DEFAULT_LIFESTYLE` when `property.lifestyle` is `null` or `undefined`.

The nullish coalescing operator means an explicit empty array remains empty; it does not fall back to `DEFAULT_LIFESTYLE`.

## 8. Property fields used

`Lifestyle` directly uses these `PropertyRecord` fields:

- `property.lifestyle`, indirectly through `getPropertyLifestyle(property)`.
- `property.name`, only for the API/no-image stage panel metadata.

Each effective item uses `id`, `caption`, optional `src`, and `alt`. Other `PropertyRecord` fields are not read by `Lifestyle`.

## 9. Lifestyle data structure

`LifestyleItem` is defined in `src/data/properties.ts` as:

```ts
export type LifestyleItem = {
  id: string;
  caption: string;
  src?: string;
  alt: string;
};
```

`src` is optional and is omitted when the item has no photograph. `alt` is still required by the type, but API-generated amenity items set it to the empty string.

## 10. Amenities data structure

The API field is `ApiProperty.amenities`, typed as `string[] | null` in `src/services/propertiesService.ts`. The normalized `PropertyRecord` also stores the filtered amenity strings in `features` and in `popupSample.amenities`, but the Lifestyle UI uses the normalized `lifestyle` field.

API amenities become `LifestyleItem[]` with this shape:

```ts
{
  id: `amenity-${index}`,
  caption: trimmedAmenity,
  alt: ""
}
```

No `src` is created for API amenities.

## 11. Local/static property behavior

Local records can define `lifestyle` directly. The inspected explicit local lifestyle override is on `sark-green-plains`, with three items:

- `sl1`: `Plains light, plotted pace`, `/assets/property/hero-property.jpg`, alt `Sark Green Plains`
- `sl2`: `Evenings on open approaches`, `/assets/property/growth.png`, alt `Growth corridor vista`
- `sl3`: `Space to build without squeeze`, `/assets/property/extra-image-8.png`, alt `Open plot setting`

Local records without a `lifestyle` field use the four-item `DEFAULT_LIFESTYLE` array. Local lifestyle items can therefore have images and descriptive `alt` text.

## 12. API property behavior

API properties are fetched by `ApiPropertyView`, normalized with `apiPropertyToRecord`, and then rendered through the same `PropertyPageView` and `Lifestyle` component as local records. API data does not use a separate Amenities component or an amenities-specific page route.

When the API publishes usable amenities, they become the API record's `lifestyle`. When it publishes no usable amenities, `apiPropertyToRecord` sets `lifestyle` to `undefined`, allowing `getPropertyLifestyle` to return `DEFAULT_LIFESTYLE`.

## 13. API amenities mapping

`apiPropertyToRecord` first derives `amenities` from `property.amenities`:

```ts
const amenities = Array.isArray(property.amenities)
  ? property.amenities.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0,
    )
  : [];
const lifestyle = amenitiesToLifestyle(amenities);
```

`amenitiesToLifestyle(amenities)` trims each string, skips empty values, and performs case-insensitive deduplication. It preserves the original array index in the id, so an item is emitted as `{ id: \`amenity-${index}\`, caption, alt: "" }`. If the resulting array is empty, `apiPropertyToRecord` assigns `lifestyle: undefined`, not `[]`.

## 14. Image handling

When the active `LifestyleItem` has a truthy `src`, `Lifestyle` renders Next.js `<Image>` with:

- `src={active.src}`
- `alt={active.alt}`
- `fill`
- `priority`
- `sizes="(max-width: 900px) 100vw, 56vw"`
- `className="pd-lifestyle__img"`
- `key={active.id}`

The image is inside `.pd-lifestyle__stage`, which is positioned relative. The active caption is rendered as `.pd-lifestyle__caption` over the image.

## 15. Image fallback behavior

There is no image `onError` handler or network-error replacement in `Lifestyle`. The feature's intentional missing-image behavior is based on `src` being absent: it renders `.pd-lifestyle__panel` instead of `<Image>`. This is the current API amenity behavior, because API amenities do not receive invented photographs.

If an item has a non-empty but invalid `src`, a Lifestyle-specific fallback is `UNKNOWN — needs verification`.

## 16. Layout structure

The rendered structure is:

```text
section.pd-section.pd-lifestyle[aria-labelledby="pd-life-title"]
└── div.pd-section__inner
    ├── p.pd-kicker                         Lifestyle
    ├── h2#pd-life-title                    How days could feel here
    ├── p.pd-section__lead                   dynamic instruction
    └── div.pd-lifestyle__layout
        ├── ul.pd-lifestyle__points[--dense?]
        │   └── li > button.pd-lifestyle__point[.is-active?]
        │       ├── span.pd-lifestyle__point-index
        │       └── span.pd-lifestyle__point-body
        │           ├── span.pd-lifestyle__point-title
        │           └── span.pd-lifestyle__point-alt[optional]
        └── div.pd-lifestyle__stage
            ├── next/image.pd-lifestyle__img + p.pd-lifestyle__caption
            └── or div.pd-lifestyle__panel
```

The list has `role="list"`; each point is a button with `aria-pressed`.

## 17. Desktop behavior

At `@media (min-width: 760px)`, `.pd-lifestyle__layout` becomes a two-column grid with `grid-template-columns: 0.85fr 1.15fr`, `gap: 1.75rem`, and `align-items: start`. Points occupy the narrower left column and the stage occupies the wider right column.

At the same breakpoint, `.pd-lifestyle__stage` is sticky with `top: calc(var(--nav-h) + 1rem)`, `height: 30rem`, and `min-height: 0`. Dense points become a two-column grid with `grid-template-columns: repeat(2, minmax(0, 1fr))`; horizontal overflow is removed and point text may wrap.

## 18. Mobile behavior

Below `760px`, `.pd-lifestyle__layout` has no explicit column definition and remains a single-column grid with `gap: 1.25rem`. The points appear before the stage in normal document flow. The stage has `min-height: 20rem` and is not sticky.

For dense lists below `760px`, `.pd-lifestyle__points--dense` is a horizontal flex row with `overflow-x: auto`, `scroll-snap-type: x proximity`, and `white-space: nowrap` on each point. Each list item is non-shrinking and uses `scroll-snap-align: start`.

## 19. Responsive breakpoints

The Lifestyle-specific responsive breakpoint is `@media (min-width: 760px)` in `PropertyDetail.css`. The `next/image` `sizes` hint also uses `900px`: `(max-width: 900px) 100vw, 56vw`. There is no separate Lifestyle-specific `max-width` media query.

## 20. Active item behavior

The initial active state is:

```ts
const [activeId, setActiveId] = useState(items[0]?.id ?? "");
```

The active item is derived by finding `activeId` in `items`; if found, it is used, otherwise `items[0]` is used:

```ts
const activeIndex = items.findIndex((item) => item.id === activeId);
const active = activeIndex >= 0 ? items[activeIndex] : items[0];
```

Clicking a point calls `setActiveId(item.id)`. The matching button receives `.is-active` and `aria-pressed={true}`. The index is displayed as a two-digit value using `String(index + 1).padStart(2, "0")`.

The component is rendered with `key={property.id}`, so navigating to another property remounts it and resets both active selection and pause state.

## 21. Hover behavior if implemented

Hover is implemented on the point list, not as a selection action. `onMouseEnter={() => setPaused(true)}` pauses automatic cycling while the pointer is over `.pd-lifestyle__points`; `onMouseLeave={() => setPaused(false)}` resumes it.

`.pd-lifestyle__point:hover` changes the border to `rgba(198, 164, 108, 0.5)` and background to `#fff`. Hover does not change `activeId`.

## 22. Auto-cycle/carousel behavior if implemented

The feature auto-cycles with a restarting `window.setTimeout`, not a fixed interval. `autoCycle` is true only when `items.length > 1 && !dense`. `dense` is true when `items.length > 6`.

When active, the timeout waits `DWELL_MS = 4200` milliseconds, finds the current item index, and advances to the next item with wraparound:

```ts
items[(index + 1) % items.length]?.id ?? current
```

Manual selection changes `activeId`, which restarts the timeout and gives the selected item a full dwell period.

## 23. Pause/resume behavior if implemented

The `paused` state is initialized to `false`. Cycling is paused when:

- The pointer enters `.pd-lifestyle__points`.
- A point button receives focus.
- `prefers-reduced-motion: reduce` matches; in this case the effect returns without creating a timer.

Cycling resumes when the pointer leaves the list or the focused button blurs, provided `autoCycle` remains true. There is no visible pause/resume control button.

## 24. State variables

`Lifestyle` owns exactly these React state variables:

- `activeId`: initialized to `items[0]?.id ?? ""` and updated by click/auto-cycle.
- `paused`: initialized to `false` and updated by mouse/focus handlers.

`PropertyPageView` does not own Lifestyle state; its `activeGalleryId` belongs only to the Property Images/Gallery feature.

## 25. Derived values

`Lifestyle` derives:

- `items = getPropertyLifestyle(property)`.
- `dense = items.length > DENSE_ITEM_COUNT`, where `DENSE_ITEM_COUNT = 6`.
- `autoCycle = items.length > 1 && !dense`.
- `activeIndex = items.findIndex((item) => item.id === activeId)`.
- `active = activeIndex >= 0 ? items[activeIndex] : items[0]`.

## 26. Functions

Relevant functions are:

- `getPropertyLifestyle(property)` in `src/data/properties.ts`.
- `amenitiesToLifestyle(amenities)` in `src/services/propertyMapper.ts`.
- `apiPropertyToRecord(property, lifeStage?, documents?)` in `src/services/propertyMapper.ts`.
- The component's inline state callbacks: `setActiveId`, `setPaused`, the timeout callback that advances the item, and the mouse/focus/click handlers.

## 27. Hooks

`Lifestyle.tsx` imports and uses:

- `useState` for `activeId` and `paused`.
- `useEffect` for the conditional, cancellable auto-cycle timeout.

The effect depends on `[activeId, autoCycle, items, paused]` and clears its timeout with `window.clearTimeout` on cleanup. It also calls `window.matchMedia("(prefers-reduced-motion: reduce)")`.

## 28. APIs used

`Lifestyle` itself calls no API. API-backed content reaches it through `ApiPropertyView`, which calls `fetchPropertyById` for the main property and separately fetches documents and life-stage fit. The Lifestyle-specific API field is `amenities` from the main property response.

There is no confirmed amenities-specific API endpoint.

## 29. API request/response structures

The main API request is `GET /api/properties/{id}` through `fetchPropertyById` and `apiFetch`. The response is expected as `{ success?: boolean; data?: ApiProperty }`; the mapper reads `data.amenities: string[] | null`.

The typed `ApiProperty` field relevant here is:

```ts
amenities: string[] | null;
```

The documents request (`GET /api/properties/{id}/documents`) and life-stage-fit request are independent page requests and do not provide Lifestyle data.

## 30. Loading states

There is no Lifestyle-specific loading state, skeleton, spinner, or asynchronous item loading. `ApiPropertyView` displays `Loading property…` while the main API property request is pending; `PropertyPageView` and `Lifestyle` render only after the main property is available.

## 31. Error states

There is no Lifestyle-specific API error UI and no image `onError` UI. If the main API property request fails, `ApiPropertyView` renders its page-level `Property unavailable` error instead of `PropertyPageView`, so Lifestyle is not rendered. Failures in the independent documents or life-stage-fit requests do not change the Lifestyle content.

## 32. Empty/missing-data states

- Missing local `lifestyle` (`null`/`undefined`) uses the four-item `DEFAULT_LIFESTYLE`.
- API `amenities: null`, a non-array value at runtime, or an array containing no usable strings produces no normalized lifestyle items; `apiPropertyToRecord` sets `lifestyle` to `undefined`, so the shared default lifestyle is used.
- An explicit `property.lifestyle: []` remains empty. Then `activeId` is `""`, `active` is `undefined`, the point list is empty, and the stage renders no active content. There is no explicit empty-state message.
- An amenity with no `src` renders the typographic panel, not a broken image.

## 33. Relationship with `PropertyRecord`

`PropertyRecord` defines the optional `lifestyle?: LifestyleItem[]` field and the `LifestyleItem` shape. The component accepts the full `PropertyRecord` but directly needs only `lifestyle` through the resolver and `name` for the no-image panel metadata. `PropertyRecord.features` is a separate normalized string list and is not used by `Lifestyle`.

## 34. Relationship with `getPropertyLifestyle`

`getPropertyLifestyle` is the single resolver used by `Lifestyle`. It returns `property.lifestyle ?? DEFAULT_LIFESTYLE`. It does not clone, filter, deduplicate, or validate local lifestyle items. API filtering/deduplication occurs earlier in `amenitiesToLifestyle`.

## 35. Relationship with `PropertyPageView`

`PropertyPageView` imports `Lifestyle` and renders `<Lifestyle key={property.id} property={property} />` between `FutureNeighbourhoodMap` and `PriceEmiFuture`. The `key` forces a remount when the property id changes, resetting `activeId` and `paused`. No Lifestyle callbacks or state are passed from `PropertyPageView`.

## 36. Relationship with `PropertyHero`

`PropertyHero` is unrelated to the Lifestyle state and markup. It renders the separate Property Images/Gallery hero. `PropertyPageView` renders `PropertyHero` first and `Lifestyle` later; neither component passes data or callbacks to the other.

## 37. Relationship with API normalization / `apiPropertyToRecord`

`apiPropertyToRecord` converts the API `amenities` array into `lifestyle` using `amenitiesToLifestyle`. It also assigns the same filtered amenity strings to `features` and `popupSample.amenities`, but those are separate consumers. It assigns `lifestyle: lifestyle.length ? lifestyle : undefined`, specifically preserving the shared default fallback for API properties with no published amenities.

## 38. Dependencies

Direct Lifestyle dependencies are:

- React `useEffect` and `useState`.
- Next.js `next/image`.
- `PropertyRecord` and `LifestyleItem` from `src/data/properties.ts`.
- `getPropertyLifestyle` from `src/data/properties.ts`.
- `PropertyDetail.css` classes and CSS custom properties such as `--pd-line`, `--pd-gold`, `--pd-ink`, `--pd-muted`, and `--nav-h`.

API-backed rendering additionally depends on `ApiPropertyView`, `propertiesService`, and `propertyMapper`.

## 39. External integrations

The feature uses Next.js Image Optimization through `next/image` for lifestyle items with `src`. It uses browser `window.setTimeout`, `window.clearTimeout`, and `window.matchMedia` for the auto-cycle and reduced-motion behavior. It does not use a carousel library, amenities API client, upload service, map service, or third-party lifestyle/amenities integration.

## 40. Known issues

- The feature is named `Lifestyle` in code even when its API input represents amenities.
- API amenities have no images and therefore render typographic panels rather than photographs.
- API properties with no usable amenities receive the shared default lifestyle moments, which may not describe that API property.
- An explicit empty `lifestyle: []` renders no empty-state message and leaves the stage empty.
- Invalid non-empty image URLs have no confirmed Lifestyle-specific error fallback: UNKNOWN — needs verification.
- There is no visible pause control; pause is implicit through hover/focus and reduced-motion preference.
- The exact browser/Next.js presentation of a failed Lifestyle `<Image>` request is UNKNOWN — needs verification.

## 41. Important constraints

- Preserve the component name `Lifestyle` and its prop contract `{ property: PropertyRecord }` unless all parent usage is updated.
- Resolve effective items through `getPropertyLifestyle(property)` to retain the current nullish fallback and explicit-empty-array behavior.
- Preserve the `LifestyleItem` fields `id`, `caption`, optional `src`, and `alt`.
- Keep API amenity conversion in `amenitiesToLifestyle` if the normalized `PropertyRecord.lifestyle` contract remains unchanged.
- Do not assume an amenities-specific API endpoint exists; current data comes from `ApiProperty.amenities` in the main property response.
- Preserve case-insensitive deduplication and the current `amenity-${index}` id format if API mapping behavior is not intentionally changed.
- Preserve the dense threshold: more than six items sets `dense` and disables auto-cycle.
- Preserve the 4200 ms restarting timeout, hover/focus pause behavior, and reduced-motion check unless interaction behavior is intentionally changed.
- Keep `.pd-lifestyle__stage` positioned relative because `next/image` uses `fill`.
- Preserve the `@media (min-width: 760px)` desktop layout and the dense mobile horizontal scroll behavior unless responsive design is intentionally changed.
- Keep the feature-specific documentation aligned with the current implementation; planned amenities endpoints or separate Amenities components are not documented here.