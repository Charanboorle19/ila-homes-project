# Similar Properties feature

This document describes the current Similar Properties implementation on the Property Details page. It complements [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\buying-journey.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\buying-journey.md). It documents only the implementation currently present in the inspected source files.

## 1. Feature purpose

Similar Properties presents scored alternatives to the current property so a visitor can continue exploring other catalogue properties. The section is informational and navigational; it does not compare properties interactively, submit an enquiry, reserve inventory, or perform any API operation.

## 2. Where it appears on the Property Details page

It appears as the section with the kicker `Keep exploring`, the heading `Similar properties`, and the lead text `Scored by locality, price band, facing, and shared features.` It is rendered by the shared Property Details page template for both local/static records and API-normalized records, although its candidate source is local/static only.

## 3. Exact section position/order

After `PropertyHero`, the current `PropertyPageView` order is:

1. `LifeStageMatch`
2. `FutureNeighbourhoodMap`
3. `Lifestyle`
4. `PriceEmiFuture`
5. `LegalDocuments`
6. `SatelliteBeforeAfter`
7. `BuyingJourneySteps`
8. `SimilarProperties`
9. `PropertyFinalCta`
10. `StickyBottomCta`

Therefore, Similar Properties is immediately after `BuyingJourneySteps` and immediately before `PropertyFinalCta`. It is the ninth rendered section/component after the hero in the complete page tree. When there are no items, the component returns `null`, so no section occupies the page at runtime.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\SimilarProperties.tsx` — section and card rendering.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\similar.ts` — `SimilarCard` type, candidate scoring, filtering, sorting, and limiting.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — derives the items and renders the section.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `PropertyRecord`, local `properties` array, `getPropertyGallery`, and default gallery data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — `formatInr` used for card prices.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — Similar Properties layout and card selectors.

## 5. Component names

The Property Details component is the default export named `SimilarProperties` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\SimilarProperties.tsx`.

The related data function is `getSimilarProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\similar.ts`. The page component that composes the section is the default export `PropertyPageView` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx`.

## 6. Component props

`SimilarProperties` accepts one prop:

```ts
{ items: SimilarCard[] }
```

It is rendered as `<SimilarProperties items={similar} />`. It does not receive the current property, callbacks, loading state, error state, API data, or configuration directly.

## 7. Data sources

The candidate source is the module-level local/static `properties` array imported from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.

`PropertyPageView` passes the current normalized `PropertyRecord` to `getSimilarProperties(property)`. The resulting `SimilarCard[]` is passed to the renderer. There is no Similar Properties API request, service, endpoint, or API-specific candidate list.

## 8. Local/static property behavior

For a local/static property, the current record is compared against every record in the local `properties` array. The current record is excluded by id, sold candidates are excluded, qualifying candidates are scored, sorted, and limited to six by the default function argument.

## 9. API property behavior

API properties are normalized by `apiPropertyToRecord` into the shared `PropertyRecord` shape and then passed through the same `getSimilarProperties` call. However, `getSimilarProperties` still scans only the local `properties` array. API records are not added to that source, so API-backed properties cannot appear as candidates. API-derived fields can affect scoring of local candidates only through the normalized current record.

## 10. Similar property data structure

`SimilarCard` is:

```ts
type SimilarCard = {
  property: PropertyRecord;
  score: number;
  reasons: string[];
};
```

Each returned card contains the full candidate `PropertyRecord`, its numeric similarity score, and at most three human-readable reason strings.

## 11. Exact fields used

The scoring function reads these `PropertyRecord` fields from the current and candidate records:

- `id`
- `locationKey`
- `location`
- `price`
- `propertyType`
- `facing`
- `corner`
- `parkFacing`
- `features`
- `approval`
- `status`

The renderer reads these candidate fields:

- `id` for the list key and route
- `approval` for the badge
- `name` for the card heading
- `location` for the location line
- `sqYards` for the metadata line
- `facing` for the metadata line
- `price` through `formatInr`
- `gallery` indirectly through `getPropertyGallery`

It also reads `score` only as part of sorting upstream; the numeric score is not displayed by the card. It reads `reasons` for the optional reasons line.

## 12. How similar properties are selected

`PropertyPageView` derives candidates with:

```ts
const similar = useMemo(() => getSimilarProperties(property), [property]);
```

`getSimilarProperties(current, limit = 6)` maps every local `properties` entry through `scoreCandidate(current, candidate)`, removes rejected candidates, sorts the remaining `SimilarCard` values by descending score, and slices the result to the requested limit.

## 13. Filtering behavior

Before scoring, `scoreCandidate` rejects:

1. The current property when `candidate.id === current.id`.
2. Any candidate whose `status === "sold"`.

After scoring, candidates with `score < 28` are rejected. The current property therefore cannot appear in results when its id matches the candidate id. There is no explicit locality-only filter, property-type-only filter, availability-only filter, or API filter.

## 14. Sorting behavior

Qualifying cards are sorted with `.sort((a, b) => b.score - a.score)`, so the highest score appears first. No secondary tie-breaker is implemented. For equal scores, the behavior is the JavaScript sort behavior for the original mapped array order; an explicit tie order is UNKNOWN — needs verification.

## 15. Number of properties displayed

`getSimilarProperties` defaults `limit` to `6` and applies `.slice(0, limit)`. `PropertyPageView` calls it without a second argument, so the maximum rendered result is six cards. Fewer than six cards render when fewer candidates qualify.

## 16. State variables

`SimilarProperties` declares no React state variables.

The parent `PropertyPageView` has page-level state such as `activeGalleryId`, but Similar Properties does not read or modify it. No Similar Properties-specific state exists.

## 17. Derived values

The parent derives `similar` with `useMemo` and `getSimilarProperties(property)`.

Inside each card render, the component derives `image` with `getPropertyGallery(property)[0]`. The displayed price is derived with `formatInr(property.price)`. The displayed reasons text is derived with `reasons.join(" · ")` when the reasons array is non-empty.

## 18. Functions

Functions directly involved are:

- `scoreCandidate(current, candidate)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\similar.ts` — rejects and scores one candidate.
- `getSimilarProperties(current, limit = 6)` — builds, filters, sorts, and limits the candidate list.
- `getPropertyGallery(property)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — resolves the effective gallery.
- `formatInr(amount)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — formats the candidate price.

The component itself has no named event handlers or interaction functions.

## 19. Hooks

`SimilarProperties` uses no React hooks. `PropertyPageView` uses `useMemo` for `similar`, with `[property]` as its dependency array.

## 20. Loading behavior

There is no Similar Properties loading state, loading component, skeleton, or asynchronous request. The section renders synchronously from the `items` prop. While an API property is being fetched, the surrounding `ApiPropertyView` controls page loading; Similar Properties itself has no independent loading behavior.

## 21. Error behavior

There is no local error state, error boundary, request error handling, retry behavior, or error message in `SimilarProperties` or `getSimilarProperties`. The scorer assumes the `PropertyRecord` fields and local `properties` data have their declared shapes. Behavior for malformed runtime records is UNKNOWN — needs verification.

## 22. Empty-state behavior

When `items.length === 0`, `SimilarProperties` returns `null`. It renders no section, heading, empty message, list, or placeholder. There is no visible empty state.

## 23. Missing-field/fallback behavior

For the image, the component calls `getPropertyGallery(property)`, which returns `property.gallery ?? DEFAULT_GALLERY`. If the effective gallery contains an item, the first item is rendered; if the effective gallery is empty, no image is rendered and the media background remains visible. The exact visual result of a broken non-empty image `src` is UNKNOWN — needs verification.

The card has no explicit fallbacks for `name`, `location`, `sqYards`, `facing`, or `approval`; those values are rendered as provided. `formatInr` formats the numeric `price` and has no missing-value branch for an absent/non-numeric runtime value. A missing individual `SimilarCard` field outside the declared type is UNKNOWN — needs verification.

## 24. Card rendering behavior

The result is rendered as a `<ul className="pd-similar__grid">`. Each item becomes an `<li key={property.id}>` containing one `Link` with class `pd-similar__card`.

Each card contains:

1. A `.pd-similar__media` wrapper.
2. An optional `next/image` image.
3. A `.pd-similar__badge` containing the approval string.
4. A `.pd-similar__body` wrapper.
5. An `<h3>` with the property name.
6. A location paragraph.
7. A `.pd-similar__meta` paragraph containing size, facing, and formatted price separated by ` · `.
8. An optional `.pd-similar__reasons` paragraph containing up to three reasons separated by ` · `.

## 25. Image behavior

The component uses `getPropertyGallery(property)[0]`, so only the first effective gallery item is used for each card. It renders `next/image` with `src={image.src}`, `alt=""`, `fill`, and `sizes="(max-width: 700px) 100vw, 33vw"`.

The image has no explicit per-card fallback asset in `SimilarProperties`. The gallery resolver supplies the shared `DEFAULT_GALLERY` when `property.gallery` is `null` or `undefined`. The image is styled by `.pd-similar__media img { object-fit: cover; }`.

## 26. Price behavior

The card uses `formatInr(property.price)` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`; it does not use `property.priceLabel`.

The exact formatter is:

- `>= ₹1,00,00,000`: rupee value in crores, `₹{value} Cr`; one decimal for values at least 10 Cr, otherwise two decimals.
- `>= ₹1,00,000`: rupee value in lakhs, `₹{value} L`; zero decimals for values at least 10 L, otherwise one decimal.
- Below one lakh: `₹` plus `amount.toLocaleString("en-IN")`.

## 27. Link/route behavior

Each card is a Next.js `Link` with:

```ts
href={`/properties/${property.id}`}
```

The route is therefore `/properties/{candidate.id}`. The link is the whole card, and no fragment anchor, query string, external URL, or `target` is specified.

## 28. CTA/button behavior

There is no separate CTA, button, enquiry action, save action, share action, WhatsApp action, site-visit action, or hover control in the card. The only interaction is navigation through the full-card `Link` to the candidate Property Details route.

## 29. Analytics behavior

The Similar Properties `Link` has no `data-track`, `data-track-property`, or `data-track-meta` attributes. `SimilarProperties` does not call `trackEvent` and emits no feature-specific analytics event.

The parent page independently calls `useTrackPropertyView(property.id)`, which tracks page-level property-view/revisit/time-on-property behavior. That is not a Similar Properties card analytics event. Whether generic browser/page analytics observe the navigation is UNKNOWN — needs verification.

## 30. Desktop behavior

At `@media (min-width: 760px)`, `.pd-similar__grid` uses `grid-template-columns: repeat(3, minmax(0, 1fr))`, so qualifying cards display in up to three columns. The base grid retains a one-column layout until this desktop rule applies. The card uses a grid display, border, translucent white background, hidden overflow, and a hover transform/border-color transition.

## 31. Mobile behavior

There is no Similar Properties-specific mobile media rule. Below the desktop `min-width: 760px` rule, `.pd-similar__grid` remains a single-column CSS grid with a `1rem` gap. Each card therefore spans the available list width in the normal one-column layout.

## 32. Responsive behavior

The image `sizes` hint changes at `700px`: `(max-width: 700px) 100vw, 33vw`. The grid itself changes to three columns at `min-width: 760px`; between those breakpoints it remains the base single-column layout. The source does not define a separate two-column Similar Properties layout.

## 33. CSS classes

Classes used by the section/card markup are:

- `pd-section`
- `pd-similar`
- `pd-section__inner`
- `pd-kicker`
- `pd-section__lead`
- `pd-similar__grid`
- `pd-similar__card`
- `pd-similar__media`
- `pd-similar__badge`
- `pd-similar__body`
- `pd-similar__meta`
- `pd-similar__reasons`

The Similar Properties-specific CSS definitions are in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`. The shared image selector also includes `.pd-similar__media img` with `object-fit: cover`.

## 34. Relationship with PropertyRecord

`PropertyRecord` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` is the source type for both the current property and every `SimilarCard.property`. The scorer relies on its id, location, price, classification, feature, approval, and status fields. The renderer relies on its id, gallery, approval, name, location, size, facing, and price fields.

The optional `gallery` field is not read directly by the component; `getPropertyGallery` resolves it to either the record gallery or `DEFAULT_GALLERY`.

## 35. Relationship with PropertyPageView

`PropertyPageView` accepts `property: PropertyRecord` and computes `similar` with `useMemo(() => getSimilarProperties(property), [property])`. It renders `<SimilarProperties items={similar} />` after `<BuyingJourneySteps />` and before `<PropertyFinalCta property={property} />`.

`PropertyPageView` owns the current property and the similarity derivation; `SimilarProperties` only renders the supplied cards. Changes to the current `property` object recalculate the list because it is the `useMemo` dependency.

## 36. Relationship with Property Popup / map

Similar Properties is not rendered inside the map popup or `PropertySheet` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`. The popup/map experience has separate property selection and navigation behavior.

A user can arrive at the full Property Details page through other map/popup navigation, after which `PropertyPageView` may render Similar Properties. No popup state, popup props, map selection state, or map-specific analytics are passed into this component.

## 37. Dependencies

Direct dependencies of `SimilarProperties.tsx` are:

- `next/image` (`Image`)
- `next/link` (`Link`)
- `SimilarCard` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\similar.ts`
- `formatInr` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`
- `getPropertyGallery` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`
- `PropertyDetail.css`, imported by `PropertyPageView`

It has no direct dependency on API services, fetch calls, React hooks, analytics helpers, map libraries, modal components, localStorage, WhatsApp, or email helpers.

## 38. Known issues

- Similar Properties is local/static-source only; API-backed records are not included as candidates.
- The current property is excluded by exact `id` equality, but no separate protection exists for duplicate records with different ids representing the same real-world property.
- Sold candidates are excluded; `coming-soon` candidates are allowed and receive no availability bonus, while `available` candidates receive an eight-point bonus.
- The displayed score is not shown, and the displayed reasons are limited to the first three reason strings.
- No explicit tie-breaker is implemented for equal scores; exact equal-score ordering is UNKNOWN — needs verification.
- No visible empty, loading, or error state exists.
- Image fallback is delegated to `getPropertyGallery`; invalid non-empty image URLs are not validated by this feature.
- Card links do not carry Similar Properties-specific analytics attributes.

## 39. Important constraints

- Preserve the `SimilarProperties({ items }: { items: SimilarCard[] })` prop contract unless `PropertyPageView` is updated together.
- Preserve `SimilarCard` fields `property`, `score`, and `reasons` when changing the scoring pipeline or renderer.
- Preserve the local `properties` source and the current default limit of six unless the intended data source or result count changes.
- Preserve the current-property exclusion (`candidate.id === current.id`) and sold-property exclusion (`candidate.status === "sold"`) unless the selection requirements intentionally change.
- Preserve the minimum qualifying score of `28`, descending score sort, and `.slice(0, limit)` behavior unless the ranking contract intentionally changes.
- Preserve the route format `/properties/${property.id}` and the section heading id `pd-similar-title` unless page navigation or anchor consumers are intentionally changed.
- Preserve the first-image behavior through `getPropertyGallery(property)[0]`; do not assume `property.gallery` is always populated.
- Preserve the current price formatter behavior through `formatInr(property.price)`; the card does not use `priceLabel`.
- Preserve the three-column layout at `min-width: 760px`, the base single-column layout below it, and the `700px` image `sizes` boundary unless the responsive contract intentionally changes.
- Do not attribute page-level `useTrackPropertyView` events to Similar Properties; the feature currently emits no dedicated analytics event.
- Do not treat the Similar Properties section as an API-backed recommendation service; the current implementation is synchronous and local/static.
- Application files were not modified for this documentation task. Existing working-tree changes must be preserved.