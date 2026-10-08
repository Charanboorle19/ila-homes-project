# Find Your Plot feature

This document describes the current homepage `FindYourPlot` implementation. It is based on the inspected TypeScript/React source and the confirmed API responses only. It does not describe the separate API-backed `MapSection` or `GrowthCorridors` search experiences.

The section is now **entirely API-driven**. It holds no static catalogue, no hard-coded option list, and no locally invented scores. Every value it renders comes from `GET /api/features` or `POST /api/match-properties`.

## 1. Feature purpose

`FindYourPlot` lets a visitor pick what matters to them from the tenant's active feature list. It then shows the active properties that score on **every** selected feature, with the per-feature score breakdown. It is a recommendation UI, not a booking workflow.

## 2. Where it appears

The component is rendered on the homepage route `/`. In the current homepage order it appears after `GrowthCorridors` and before `BuyingJourney`.

## 3. Exact homepage position

The relevant order in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` is:

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

## 4. Component and data paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\FindYourPlot.tsx` — component, state, markup, responsive presentation, and result cards.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\featuresService.ts` — the feature APIs: `fetchActiveFeatures`, `findPropertiesByFeatures`, `fetchPropertyFeatureScores`, and their types.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\favoritesService.ts` — loads and updates the anonymous visitor's saved properties for the result-card favourite controls.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage integration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css` — global animation/style definitions. Exact ownership of every class used by this component is UNKNOWN — needs verification.

**This component no longer imports from `@/data/propertyLayouts`.** See §9 for what was removed and why.

## 5. Component API

`FindYourPlot` is a default-exported component that accepts no props. All selection, loading, result, and mobile-sheet state is internal.

## 6. Section identity and semantics

The root element is a `<section>` with `data-section="land_roadmap"`, `id="contact"`, class `find-your-plot`, and `aria-label="Find your plot"`. The `contact` id is also a fragment target used elsewhere in the application; this component does not itself submit contact information.

## 7. Visible introductory copy

- Kicker: `Find your plot`
- Heading: `What matters to you?`
- Description: `Pick what you care about. We'll show you properties that score on every one of it.`

The heading was `What are you planning?`, which referred to the removed life-stage cards and is now wrong — there is no plan step and no stage to plan for.

Two further strings were added with the API-backed options: the hint under the chips, "A property has to score on every option you pick, so adding more narrows the search.", and the idle-state guidance, "Pick what matters to you and we'll find properties that score on all of it."

## 8. User flow

1. The section loads the tenant's active features and renders them as chips.
2. Selecting a chip issues a match request and shows a loading state.
3. Selecting further chips re-issues the request with the wider set; because matching is AND this narrows results.
4. Removing a chip re-issues with the smaller set, widening results.
5. Removing the final chip returns the section to idle without calling the API.
6. On mobile the result sheet opens automatically and can be closed and reopened with `View matches`.

There is no second input path and no mode switch.

## 9. Static data removed from this feature

The section previously had two input paths. Both are gone, along with everything they needed.

### Life stages — removed

`LIFE_STAGES`, `LifeStage` and `LifeStageId` (deleted from `propertyLayouts.ts`), the four life-stage cards, their four imported background images (`STAGE_IMAGES`), `stageCard`, `withFeaturedFirst`, the `MatchResult` type, the `Or` divider, the `MATCH_LOAD_MS = 900` simulated delay, and the `mode` / `selectedStage` / `revealedStage` / `status` / `loadTimer` state.

The stage data was a curated marketing funnel: four personas, each with hand-picked `matchIds` and bespoke per-layout reasons. It was **not** derived from any API, and no endpoint corresponds to one — the feature APIs key off feature keys, and mapping "Invest & grow" onto `investment_growth` would mean inventing a correspondence the backend never documented.

`GET /api/properties/{id}/life-stage-fit` exists in `propertiesService.ts` and *is* API-backed, but it is per-property persona scoring used by the property detail page's `LifeStageMatch`. It is not a catalogue of stages and cannot drive a homepage funnel.

### Preference tags and demo scores — removed

`FEEL_TAGS`, `FEEL_SCORES` and `FeelTagId`: a fixed list of ten "feelings" with invented `0–100` scores per layout. Both are superseded — chips are now `PropertyFeature.name`, and scores are the backend's real `0–10` values.

### Placeholder result image — removed

`RESULT_IMAGE = "/hero-image.png"` was substituted for every API result, because the matching endpoint returns no image. That made an unpopulated card look populated. Cards are now text-only, and `next/image` is no longer imported by this component at all.

### What remains in `propertyLayouts.ts`

`propertyLayouts`, `getLayoutById`, `LayoutId`, `PropertyLayout` and `FEATURED_MATCH_ID` are **kept** — they remain the source for `PlotsWithPulse`, `data/properties.ts`, and the property page's local fallback records. `ShortlistShare` now loads its selectable properties from the API instead. A comment in that file records what was removed and why.

## 10. Feature controls

The options are the endpoint's rows, rendered as a **bento grid** of large tiles in the left block. They appear in the order the endpoint returns them (`sort_order`, then `name`).

| Aspect | Behaviour |
|---|---|
| Source | `fetchActiveFeatures()` in `featuresService.ts` |
| Loaded | Once on mount, in a `useEffect` with an `AbortController` |
| Label | `PropertyFeature.name` |
| Detail | `PropertyFeature.description`, rendered visibly and clamped to two lines |
| Ordering | Not re-sorted client-side — the endpoint already sorts |
| Missing keys | Not filtered. The endpoint is trusted to return well-formed rows |
| Loading | A `role="status"` line reading `Loading options…` |
| Load failure | A `role="alert"` line with the error message |
| Empty result | `No options are available right now. Please check back soon.` |
| Group semantics | `role="group"` labelled `What matters to you` |
| Selected count | An `N selected` counter in the row above the grid, shown only when at least one is selected |

Because the options are now the section's only input, there is no local fallback list. A failed load is reported rather than silently degrading, and there is no longer a second path to point the visitor at — the earlier "The life-stage plans above still work" line went with the life stages.

### 10a. Bento grid

The previous layout was a fixed two-row strip scrolled horizontally (`grid-rows-2 grid-flow-col w-max` inside `overflow-x-auto`). That only worked because the ten hard-coded labels were short and roughly uniform. With tenant-supplied labels of unknown length it hid options behind a scroll, which is undiscoverable and awkward on touch.

The tiles are now sized from the content. `tileSpanClass(feature, index)` returns `col-span-2` when either:

- `index === 0` — the highest-priority feature by `sort_order` leads wide, so the grid reads as bento even when every label is short and nothing would otherwise differ; or
- `feature.name.length > 16` — a long label gets a double-width tile so it never wraps awkwardly or clips.

Tile sizing:

| Property | Value |
|---|---|
| Radius | `rounded-2xl` |
| Minimum height | `min-h-28`, rising to `sm:min-h-32` |
| Padding | `p-3.5`, rising to `sm:p-4` |
| Label | `text-sm`, rising to `sm:text-[15px]` |
| Description | `text-xs`, `line-clamp-2` |
| Selected | Gold fill, dark ink, gold ring, check badge top-right |
| Unselected | `#23262b` fill, `#f2f0ea` ink, subtle translucent border |

The check badge is a 20px circle in the top-right, rendered only while selected. The label carries `max-w-[85%]` only in that state, so it stays clear of the badge without wasting width when there is nothing to avoid.

### Column counts are tuned to the block, not the viewport

`grid-cols-2` → `sm:grid-cols-3` → `min-[1400px]:grid-cols-4`.

Above 981px the section splits into `1.15fr / 0.85fr`, so the left block is only about **500px** wide even on a large display. A fourth column there would leave roughly 118px tiles and wrap every label to two or three lines, which defeats the point of making them larger. The fourth column therefore waits until 1400px, where the block is wide enough to earn it.

### `grid-flow-row-dense`

Dense flow backfills the row a double-width tile opens rather than leaving a visible hole — without it a 3-column grid hit by a `col-span-2` tile leaves a gap.

The trade is that visual order can then differ from DOM order, so tab sequence may not read strictly left-to-right. That is accepted here because each tile carries its own visible label and announces its own `aria-pressed` state, so it stays unambiguous when focused out of visual sequence. Removing the `grid-flow-row-dense` class restores strict visual/tab order at the cost of an uneven grid.

### Horizontal scrolling is gone

`overflow-x-auto`, `scrollbar-none`, `grid-rows-2 grid-flow-col` and `w-max` were all removed. Nothing in the section scrolls sideways any more, and options are reached with buttons rather than a swipe.

### 10b. Three rows, with Previous / Next

Only `BENTO_ROWS = 3` rows of tiles are rendered at once. A long feature list cannot push the results panel out of reach, and the left block keeps a bounded height.

#### Pages are cut by column-units, not item count

Counting items per page would be **wrong**. A double-width tile consumes two columns, so a page of `columns × 3` items can occupy four rows rather than three — which is exactly the thing the three-row limit exists to prevent.

`buildPages(features, columns)` therefore walks the list accumulating each tile's span from `tileSpan` and cuts a page once it has consumed `columns × 3` column-units. A tile is never split across a page boundary, and the leftover unit stays within budget, so every page is exactly three rows tall.

#### Column count is read live from the layout

`useBentoColumns()` listens to two media queries and returns the number of columns the grid is actually using:

| Viewport | Query | Columns | Page budget |
|---|---|---|---|
| `< 640px` | `(max-width: 639px)` | 2 | 6 units |
| `640px–1399px` | — | 3 | 9 units |
| `≥ 1400px` | `(min-width: 1400px)` | 4 | 12 units |

The breakpoints mirror the grid's Tailwind classes exactly. Without reading them, the page size would have to be guessed, and a wrong guess is visible: too large and a page spills into a fourth row, too small and the grid looks half empty.

#### Navigation

| Aspect | Behaviour |
|---|---|
| Rendered | Only when `pageCount > 1`; omitted entirely when everything fits |
| Container | `<nav aria-label="Feature pages">`, below the AND-matching hint |
| Controls | `Previous` and `Next` buttons with a chevron icon |
| Disabled | `Previous` on the first page, `Next` on the last, with `disabled` set as well as dimmed styling |
| Position indicator | `9–16 of 24`, from the global tile indices, `tabular-nums` so the digits do not jitter |
| Announced | The range uses a visually hidden "to" between the numbers, so it reads "9 to 16 of 24" rather than "9 dash 16 of 24" |

The range is built from each tile's index in the **full** list, carried through `buildPages` as `Tile = { feature, index }`. It would be wrong to derive it from the visible slice's own indices.

`safePage = Math.min(page, pageCount - 1)` **clamps rather than resets**. Resizing the window changes the column count, hence the page size; a visitor already on page 3 lands on the nearest page that exists instead of being thrown back to the first.

#### Selection survives paging

Selected state lives in `selectedKeys`, not in the tile, so a feature selected on one page is still selected when that page is revisited. The `N selected` counter above the grid reflects selections across **all** pages, not just the visible one.

This does mean a selection made on a hidden page is not visible on the current one. The counter is what communicates that; no per-tile off-page marker is drawn.

## 11. Selection behavior

Chips are multi-select. Clicking an unselected chip adds its key; clicking a selected chip removes it. Selection state is `selectedKeys: string[]` — feature **keys**, not display names, because keys are what the request takes.

`runFeatureSearch` aborts the previous request through a stored `AbortController` before issuing the next one. This is not an optimisation: without it, a slow early request can settle after a faster later one and render results for a selection the visitor has already changed. The same abort runs on unmount.

Removing the final chip does not call the API. `findPropertiesByFeatures([])` would return no matches, which is not what "nothing selected" means, so `toggleFeature` returns to idle locally instead. The service also short-circuits an empty key list for the same reason.

## 12. Internal state

| State | Type | Purpose |
|---|---|---|
| `features` | `PropertyFeature[]` | Chips from `GET /api/features` |
| `featuresStatus` | `"loading" \| "ready" \| "error"` | Chip load state |
| `featuresError` | `string \| null` | Chip load failure text |
| `selectedKeys` | `string[]` | Selected feature keys |
| `apiMatches` | `PropertyMatch[]` | Results from `POST /api/match-properties` |
| `apiStatus` | `ResultStatus` | Result status |
| `apiError` | `string \| null` | Match request failure text |
| `sheetOpen` | boolean | Mobile results sheet |
| `isMobileSheet` | boolean | Viewport is below `980px` |
| `page` | number | Current page of feature tiles |

`useBentoColumns()` holds its own `columns` state, read from media queries.

`ResultStatus` is `idle | loading | ready | empty | error`. `empty` and `error` are both reachable because the section now has one live path.

`matchAbort` holds the current `AbortController`. There is no longer a simulated-load timeout ref.

`cards` and `loadingLabel` are derived, not stored.

## 13. Feature APIs

All three endpoints are public and go through `apiFetch`, so the tenant header is attached as with every other request. `apiFetch` throws `ApiError` on any non-2xx response.

### `GET /api/features`

```text
GET /api/features
```

Returns only `active = true` rows, already ordered by `sort_order` then `name`. Response: `{ success, data: PropertyFeature[] }`. `data` missing becomes `[]`.

Each `PropertyFeature` carries `id`, `key`, `name`, `description`, `active`, `sort_order`, `created_at`, `updated_at`. Only `key`, `name` and `description` are read.

### `POST /api/match-properties`

```ts
{ features: string[] }
```

Response: `{ success, data: { items: PropertyMatch[], total: number } }`. Each `PropertyMatch` is `property_id`, `property_name`, `slug`, `match_score`, `feature_scores`.

Three documented endpoint behaviours shape this call:

- **AND matching.** A property must score on *every* requested key, so each additional chip narrows the result set. `total: 0` is a normal answer and is mapped to the `empty` state, never to `error`.
- **`match_score` is 0–10**, being the mean of the requested feature scores. It is multiplied by 10 before being shown as a percentage; showing it raw would read as a 0–10 score in a slot that means percent.
- **`feature_scores[].feature_name` holds the feature _key_**, not a display name, and `feature_id` comes back as an empty string. Display names are therefore resolved through a `featureNames` map built from `GET /api/features`, falling back to the raw key.

An empty `features` array is answered locally as `{ items: [], total: 0 }` instead of over the network, because the API's own answer to an empty selection is "match nothing" and that costs a round trip to learn.

### `GET /api/properties/{property_id}/feature-scores`

Implemented as `fetchPropertyFeatureScores`, but **not called by this component**. It exists in the service for a future property-detail integration — see §23. Unlike the matching endpoint, its `feature_id` and `feature_name` are populated, so it needs no key-to-name mapping.

### Credentials

The endpoint guide's own examples pass `credentials: "include"` on all three calls, and `featuresService` does the same.

Supporting this required a new opt-in `credentials` field on `apiFetch`'s `RequestOptions`. It is **undefined by default**, so every other caller in the application keeps its current behaviour unchanged; only these three requests set it.

There is a real prerequisite worth knowing. `credentials: "include"` on a cross-origin request only succeeds if the API answers with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin`. If it does not, the browser rejects the request as a CORS failure rather than quietly dropping the cookie. Both endpoints are public and require no bearer token, so cookies carry no identity here — **if these three calls fail with a CORS error, removing `credentials: CREDENTIALS` from them is the fix.**

## 13a. Error handling

The guide's status table is implemented rather than collapsed into one generic message. `featureApiErrorMessage` in `featuresService` maps:

| Status | Message |
|---|---|
| `422` | `The search could not be sent correctly. Please try again.` |
| `500` | `Our service is having trouble. Please try again shortly.` |
| `404` | `That property could not be found.` |
| Anything else | The backend's own `error.message`, or `Please try again.` |
| Not an `ApiError` | `Could not reach the service. Please try again.` |

`422` is worded as a client bug rather than a visitor error, because a schema mismatch in this request is our problem, not theirs. `FEATURE_API_STATUS` names the three documented codes.

## 14. Matching algorithm

There is no client-side matching. The former `scoreFeelMatch` averaged invented per-layout scores from `FEEL_SCORES`, sorted locally and sliced to four; all of that is gone.

Matching is performed entirely by `POST /api/match-properties`, which returns featured properties first, then newest first, with `match_score` already computed. No local sorting, slicing or scoring is applied.

The former four-item cap no longer applies. The endpoint decides how many rows come back, and the result panel scrolls (`max-h-[min(70vh,40rem)] overflow-y-auto` in the aside, `max-h-[85vh] overflow-y-auto` in the mobile sheet).

The `FEATURED_MATCH_ID` featured-first rule applied only to stage results and is gone. The endpoint has its own ordering and its own notion of a featured property.

## 15. Result cards

`MatchCard` renders a single view model, `CardMatch`:

```ts
type CardMatch = {
  id: string;
  label: string;
  badge: string | null;  // percentage pill, from a 0-10 match_score
  reason: string;       // per-feature score breakdown
  href: string;
};
```

Each displayed property card also keeps the API-backed `Save as favourite` control alongside its `View` link. The control uses the property's `property_id`, so saving a match is the same anonymous-visitor favourites flow used by the property catalogue. Existing saved properties load when the section mounts; successful save/remove requests update the button state, and a pending request disables that card's control.

With one data source this is no longer a reconciliation layer between two sources — it is just what `featureCard` derives from a `PropertyMatch`.

| Field | Value |
|---|---|
| `id` | `property_id` |
| `label` | `property_name` |
| `badge` | `match_score × 10` as a percentage, or `null` when `match_score` is null |
| `reason` | `"{Feature Name} {score}/10"` joined with `·` |
| `href` | `/properties/{property_id}` |

The `reason` line is the per-feature score breakdown, e.g. `Family Friendly 9/10 · School Access 8/10`, ordered by score descending. It is the only explanation the response supports and it is factual.

Entries are filtered to the **features the visitor actually selected**. The endpoint is documented to return only the requested keys, but filtering keeps a card honest if it ever returns more, and the breakdown is there to explain why *this* property matched *those* selections. If filtering empties the list, the full returned list is used as a fallback so the card never loses its explanation. Scores of `0` are rendered like any other value — the guide is explicit that zero is a valid score, not a missing one.

### What the cards deliberately do not show

`POST /api/match-properties` returns summary data only: `property_id`, `property_name`, `slug`, `match_score`, `feature_scores`. There is no image, price, plot size or location, so those lines are absent from the card entirely rather than being filled with a placeholder or invented. An earlier version substituted a shared hero image for every result, which made an unpopulated card look populated; that was removed.

The guide notes the full property can be fetched separately "if required by the page". Adding it would mean one extra request per result card, so it was not added.

The card does not replace the favourite action with the detail-page wishlist action. `Save as favourite` / `Saved as favourite` uses `favoritesService` and the `/api/favorites` endpoints; it is independent of the Property Details page's local-storage `Save to wishlist` flag.

### Coming-soon cards — removed

The `comingSoon` / `Soon` treatment existed for static layouts with `available: false`. The matching endpoint returns `status = "ACTIVE"` properties exclusively, so no result can be unavailable and the concept was removed. Every card renders a `View` link.

## 16. Result navigation

Every card links to `/properties/{property_id}`. The endpoint returns `property_id` as a UUID, which is what `/properties/[propertyId]` requires — `fetchPropertyById` throws for anything that fails `isPropertyUuid`. The `slug` the response also carries is not used.

Feature result cards carry no `data-track` attributes, so a `View` click is not attributed to this feature.

## 17. Result states

| State | Condition | Presentation |
|---|---|---|
| `idle` | Nothing selected | Idle glow SVG, "Your matches will appear here", and guidance to pick what matters |
| `loading` | Request in flight | `aria-busy`, gold progress bar, "Finding your match", "Searching properties for {label}…" |
| `ready` | `items.length > 0` | Count line plus the cards, in an `aria-live="polite"` region |
| `empty` | `items.length === 0` | "No exact match yet" and "A property has to score on every feature you pick. Remove one to widen the search." |
| `error` | Non-2xx | `role="alert"`, "We couldn't load matches" plus the backend message |

Favourite loading and toggle failures are shown as a separate alert above the match count; they do not hide or invalidate the property matches. A save or remove failure leaves that property's previous saved state unchanged.

The empty-state guidance is deliberate: AND matching is the most surprising property of the endpoint, and an unexplained blank panel would read as a bug. `total: 0` is mapped to `empty`, never to `error`.

`loadingLabel` is the names of at most the first two selected features, resolved through the loaded feature list, falling back to "your preferences".

## 18. Responsive layout

At widths of at least 981 px the results panel is shown in a sticky right-hand aside (`sticky top-24`). Below that breakpoint the aside is hidden and a `View matches` button reopens the sheet after it is closed.

The option tiles reflow rather than scroll — 2 columns on mobile, 3 from `sm`, 4 from `min-[1400px]`. See §10a for why the fourth column waits until 1400px. Tiles have a minimum height rather than a fixed one, so a tile with a two-line description grows without pushing its whole row into a fixed size.

Exactly three rows render at a time at every breakpoint, with `Previous` / `Next` to reach the rest — see §10b. The page size is read from the live column count, so it is 6, 9 or 12 column-units depending on width, and always exactly three rows.

Because the life-stage card grid is gone, the left column is now a single block rather than a `grid-cols-2` of tall cards. The outer `min-[981px]:grid-cols-[1.15fr_0.85fr]` split is unchanged.

## 19. Mobile results sheet

For `(max-width: 980px)`, a search opens a fixed bottom sheet. It has a dimmed backdrop, `role="dialog"`, `aria-modal="true"`, `aria-label="Your plot matches"`, a close button, a maximum height of `85vh`, and scrollable content. It can be closed through the backdrop or close button and reopened through `View matches`.

`View matches` renders when `apiStatus !== "idle"`, so it appears after any completed or failed search as well as a successful one.

## 20. Scroll locking and cleanup

When the mobile sheet is open, the component sets `document.body.style.overflow` to `hidden` and restores the previous value during cleanup. The match request is aborted on unmount.

Focus trapping, focus restoration, and Escape-key dismissal are not implemented; exact behavior is UNKNOWN — needs verification.

## 21. Accessibility behavior

Feature controls are semantic buttons with `type="button"` and `aria-pressed`. The tile container is a `role="group"` labelled "What matters to you". The loading panel exposes `aria-busy`; ready results use `aria-live="polite"`; error states use `role="alert"`. The mobile sheet uses dialog semantics and labelled close controls. Decorative SVGs use `aria-hidden`.

Each tile is a whole-card target rather than a small pill, which improves touch accessibility — the tap area is roughly 170x112px on mobile instead of a compact chip.

The selected state is conveyed by `aria-pressed`, not by the check badge or the colour alone. Each result card's favourite button also exposes its saved state with `aria-pressed` and is disabled while its save/remove request is pending.

Page navigation is a `<nav aria-label="Feature pages">` containing two buttons and a text range. Both buttons set `disabled` as well as dimming, so they are unreachable by keyboard when at the first or last page. The range text hides a visually-hidden "to" between the two numbers so it is announced as "9 to 16 of 24" rather than with an ambiguous dash.

Paging replaces tiles in the DOM rather than hiding them with CSS, so only the current page's tiles are focusable and exposed to assistive technology.

`grid-flow-row-dense` can make visual order diverge from DOM order, so tab sequence may not read strictly left-to-right across the grid. Each tile is self-describing and announces its own pressed state, so it remains unambiguous, but this is a known deviation from strict visual order — see §10a.

Cards no longer contain images, so the previous empty-`alt` decision is moot.

## 22. Analytics attributes

Feature buttons carry `data-track="PREFERENCE_TAG_SELECT"` and metadata `{ tag_id, selected }`, where `tag_id` is the feature **key** and `selected` is the next state.

`tag_id` changed from the former local tag id to the feature key, since that is the stable tenant-side identifier. The metadata is built with `JSON.stringify` instead of template interpolation: `key` is tenant data, so a quote or backslash in it would otherwise produce malformed JSON. This is the only analytics change; the event name is unchanged.

The `PERSONA_SELECT` event went with the life-stage cards. The component does not directly call `trackEvent`.

## 23. Known gaps

**`fetchPropertyFeatureScores` is implemented but unused.** `GET /api/properties/{property_id}/feature-scores` is in the service and typed, but nothing calls it. It would fit the property-detail page — showing a property's scored features — which is a separate change.

**Rate limiting and error codes are not enumerated.** The guide documents statuses (`404`, `422`, `500`) and the standard error envelope but lists no specific error-code values, so `featureApiErrorMessage` branches on HTTP status and falls back to the backend's `error.message`. A status is handled before its `error.code` is ever read.

**The live path is unverified in a browser.** This change was made by reading source and confirmed API shapes only; no build, type-check or dev server was run. See §25.

## 24. Dependencies, limitations, and maintenance constraints

- The component depends on React hooks, Next.js `Link`, `featuresService`, and `favoritesService`.
- It does **not** import `next/image`, MapLibre, geolocation, or `@/data/propertyLayouts`.
- Every rendered value is API-derived. There is no static fallback, so an API outage means an empty section with a visible error rather than degraded-but-working content. That is the intended trade now that no real data is available locally.
- The visible match count is the real returned `items.length`. The old "12 properties match" style counts were data-file copy that did not correspond to the rendered cards.
- `match_score` is `number | null` and is handled, but null has not been observed in practice.
- Exact CSS definitions for `animate-sheet-up`, `ila-fyp-progress`, and any reduced-motion handling are UNKNOWN — needs verification.
- The older `src/components/find-your-plot-who-are-you-buying-this-for.md` handoff references obsolete `.jsx`, `.css`, routing behavior, and the deleted `FEEL_TAGS` / `FEEL_SCORES` / `LIFE_STAGES` data; it is not canonical for the current implementation.

## 25. Verification checklist

1. `/api/features` returns rows — chips render in endpoint order with no client sorting.
2. A failed `/api/features` shows the alert line and no chips.
3. An empty feature list shows the fallback copy, not an empty row.
4. One chip selected — exactly one `POST /api/match-properties` with that key.
5. Two chips — the request body contains both keys; **confirm the AND narrowing is acceptable** for real tenant data.
6. Rapid chip clicks — the last selection wins and stale responses do not overwrite it.
7. `items: []` shows the empty state, not an error and not a blank panel.
8. Request failure shows the error state with the backend message.
9. Removing the final chip returns to idle and issues **no** request.
10. Mobile: the sheet opens on search, `View matches` reopens it, body scroll is restored.
11. Feature `View` resolves `/properties/{uuid}` and loads the detail page.
12. Existing favourites load into the result cards, and each card keeps a `Save as favourite` / `Saved as favourite` control beside `View`.
13. Saving and removing a result sends the property's UUID to `/api/favorites`; the card state changes only after success, and the control is disabled while pending.
14. A favourites load or toggle failure shows its alert without removing the match results.
15. Confirm the text-only cards read acceptably without an image.
16. Confirm no tile clips a long feature name or description at 320px, 768px, 1000px and 1440px.
17. Confirm the double-width tiles produce an even grid with no hole at each column count.
18. Tab through the tiles and result-card controls and confirm focus is always visible and both pressed states are announced.
19. With more than one page, confirm every page renders **exactly three rows** — especially a page where double-width tiles appear, since that is where an item-count implementation would spill into four.
20. Confirm `Previous` is disabled on page 1 and `Next` on the last page, and that the range indicator is correct.
21. Select a feature on page 2, go back to page 1, return to page 2, and confirm it is still selected and the `N selected` count is right.
22. Resize the window across 640px and 1400px and confirm the page size changes without leaving the pager on a page that no longer exists.

Automated test coverage for this component is UNKNOWN — needs verification.

## 26. Related documentation

- `docs/architecture/api.md` — the API architecture, including the feature endpoints and the constraints recorded there.
- `docs/features/property-details.md` — the `/properties/{propertyId}` route the result cards link to.