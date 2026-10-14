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
3. `GrowthCorridors`
4. `FindYourPlot`
5. `PlotsWithPulse`
6. `WhoWeAre`
7. `FromTheField`
8. `EmiAppreciation`
9. `CompareProperties`
10. `ShortlistShare`
11. `BuyingJourney`
12. `Faq`
13. `HomeReadyToVisit`

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

### Background

The section paints a decorative blueprint tile behind its content, on a layer of its own:

```html
<section class="find-your-plot relative ... bg-[#1c1f24]">
  <div aria-hidden="true" class="find-your-plot-bg pointer-events-none absolute inset-0 z-0"></div>
  <div class="content-slot relative ...">...</div>
</section>
```

`.find-your-plot-bg` lives in `globals.css`. The opacity is on the **background layer**, not on the section, so it fades the pattern and never the heading, tiles, buttons or result cards. `.content-slot` (`position: relative; z-index: 1`) holds the content above it — the same stacking helper `GrowthCorridors` uses.

The pattern is six gradient layers on a 30x45px tile, masked by a radial gradient so it fades out before the section edges.

**The fill colour must stay equal to `background-color`.** In the source pattern `#E5E5F7` does two jobs: it is the `background-color`, *and* it appears inside every gradient as the stop that erases the line colour. The gradients paint over the fill rather than compositing with it, so the erase stops only line up with the arcs and diagonal hatching if they match the fill. Changing one without the other leaves a second, misaligned copy of the pattern painted on top.

Two values differ from the source, both because this section is dark:

| | Source | Here | Why |
|---|---|---|---|
| Fill | `#E5E5F7` | `#1c1f24` | The section surface |
| Line | `#444CF7` | `#c6a46c` | The section's gold accent |
| `opacity` | `0.8` | `0.16` | A mid blue on near-white stays quiet at full strength; the same gold at the same weight on near-black is bright lines running under `#f2f0ea` body copy |
| Mask | `0.7 → 0` at 75% | `0.8 → 0.5 → 0.4` | The original floor of zero made it a spotlight in the middle with bare `#1c1f24` in the corners. It now holds a 40% floor to the edges, so the pattern reads across the **whole** section |

The mask and the opacity are independent levers: the mask shapes where the pattern is strongest, the opacity sets how strong it is everywhere.

The source palette `#E5E5F7` / `#444CF7` is not used anywhere in `src/`.

## 7. Visible introductory copy

- Kicker: `Find your plot`
- Heading: `What matters to you?`
- Description: `Pick what you care about. We'll show you properties that score on every one of them.`

The heading was `What are you planning?`, which referred to the removed life-stage cards and is now wrong — there is no plan step and no stage to plan for.

Two further strings were added with the API-backed options: the hint under the chips, "A property has to score on every option you pick, so adding more narrows the search.", and the idle-state guidance in the results panel, which currently reads "Pick one or more options and we'll show the plots that score on every one of them." (see §17 for its full treatment).

## 8. User flow

1. The section loads the tenant's active features and renders them as chips.
2. Selecting a chip issues a match request and shows a loading state.
3. Selecting further chips re-issues the request with the wider set; because matching is AND this narrows results.
4. Removing a chip re-issues with the smaller set, widening results.
5. Removing the final chip returns the section to idle without calling the API.
6. On mobile a tap only selects or deselects a tile. The results sheet does **not** open on selection; a fixed bottom bar carries the match count and opens it. Closing the sheet leaves the bar in place, so it can be reopened at any time.

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

The options are the endpoint's rows, rendered as an asymmetrical **bento grid** in the left block. All features are displayed together without pagination. Subheadings (`feature.description`) are removed so each tile displays only its silhouette icon, heading (`feature.name`), and selection indicator. They appear in the order the endpoint returns them (`sort_order`, then `name`).

| Aspect | Behaviour |
|---|---|
| Source | `fetchActiveFeatures()` in `featuresService.ts` |
| Loaded | Once on mount, in a `useEffect` with an `AbortController` |
| Label | `PropertyFeature.name` (heading) |
| Detail | Subheadings are removed per user specification; only card headings are rendered |
| Pagination | Removed — all features render simultaneously in the bento grid |
| Ordering | Not re-sorted client-side — the endpoint already sorts |
| Missing keys | Not filtered. The endpoint is trusted to return well-formed rows |
| Loading | A `role="status"` line reading `Loading options…`, with the shared `ila-loader ila-loader--sm ila-loader--light` animation — see `docs\features\loading.md` |
| Load failure | A `role="alert"` line with the error message |
| Empty result | `No options are available right now. Please check back soon.` |
| Group semantics | `role="group"` labelled `What matters to you` |
| Row label above the grid | `Choose one or more` — an instruction, not a repeat of the heading. The heading asks the question, this answers it, and it is the only place that says the tiles are multi-select. It is paired with the `N selected` counter below |
| Selected count | An `N selected` counter in the row above the grid, **always rendered including at zero** |

Because the options are now the section's only input, there is no local fallback list. A failed load is reported rather than silently degrading, and there is no longer a second path to point the visitor at — the earlier "The life-stage plans above still work" line went with the life stages.

### 10a. Bento tile grid

The feature tiles are displayed in an asymmetrical **bento grid layout** across 2 columns on mobile and 3 columns on desktop (`grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3`).

Tile sizing and layout:

| Property | Value |
|---|---|
| Span | Asymmetrical bento rhythm via `getBentoSpan(index)`: hero banner (`col-span-2 sm:col-span-2` at index 0), desktop accent (`col-span-1 sm:col-span-2` at index 6), mobile accent (`col-span-2 sm:col-span-1` at index 5), and standard tiles (`col-span-1 sm:col-span-1`) |
| Radius | `rounded-2xl` |
| Height | `min-h-[5.25rem] sm:min-h-[5.75rem]` with matching row heights |
| Padding | `p-3.5 sm:p-4` |
| Glyph | Scaled silhouette glyph (`h-4.5 w-4.5` to `h-5 w-5`), gold `#c6a46c` within a rounded icon chip (`h-8.5 w-8.5` up to `h-11 w-11`) |
| Label | Increased text size: prominent `text-[15px] sm:text-lg font-bold text-[#f2f0ea]` on wide bento cards, and `text-[14px] sm:text-[15px] font-semibold text-[#f2f0ea]` on standard cards |
| Subheading | Removed — cards display headings only |
| Layout | Adaptive: wide cards use a horizontal layout (icon on left, prominent title in center, checkmark on right) to fill the width naturally with zero empty space; standard cards use a vertical stacked layout |
| Selected | Gold `#c6a46c` border, `bg-[#c6a46c]/15` wash, selection circle filled gold with a dark tick, gold glow shadow |
| Unselected | `bg-[rgba(242,240,234,0.06)]`, `border-[rgba(242,240,234,0.13)]`, empty selection circle |
| Both | `backdrop-blur-md` — translucent glass allowing the blueprint pattern to show through |

#### Tiles are glass so the blueprint tile shows through

The section paints a decorative blueprint pattern behind its content (see §6). Both states are translucent with `backdrop-blur-md`, and both borders are white at low alpha:

```
unselected  bg-[rgba(242,240,234,0.06)]  border-[rgba(242,240,234,0.14)]
hover       bg-[rgba(242,240,234,0.12)]  border-[rgba(242,240,234,0.32)]
selected    bg-[#c6a46c]/12              border-[#c6a46c]
```

This replaces the solid `#23262b` / `#272a30` pair. `backdrop-filter` has something real to blur because `.find-your-plot-bg` is a sibling layer rather than a background on the section itself.

#### Subheadings removed: headings only for clean scannability

Subheadings (`PropertyFeature.description`) were removed in favor of concise, heading-only cards (`feature.name`). This keeps the bento grid balanced and highly scannable across desktop and mobile devices without arbitrary line-clamping or variable text height.

#### The tiles look selectable

- **The selection circle is always rendered** — a 20px outlined circle in the top-right when unselected, filled gold with a dark tick when selected. It is `aria-hidden`, because the button's own `aria-pressed` already carries the state and announcing both would double it.
- **Selection is a border plus a 12% gold wash, not a solid gold fill.** The old solid fill inverted the whole card's typography and left the gold selection dot invisible against the gold it sat on.
- **Each tile carries a glyph** — family, tree, shield or rising arrow — so the grid is scannable by silhouette instead of by reading labels.

#### Glyphs are resolved from the feature key by substring

`featureIcon(key)` matches substrings, not an exact list, because the keys are tenant-supplied and unverified. It returns **`null` for anything unrecognised**, falling back to a clean checkmark icon.

| Group | Matches |
|---|---|
| Family | `famil`, `child`, `kid`, `play` |
| Tree | `tree`, `green`, `park`, `nature`, `lake`, `garden`, `palm` |
| Shield | `shiel`, `secur`, `safe`, `gated`, `cctv`, `guard`, `boundary` |
| Growth | `growth`, `grow`, `appreciat`, `return`, `invest`, `yield`, `profit`, `future` |

### 10b. Removal of pagination: all data displayed

Pagination controls have been removed. All features loaded from `GET /api/features` render directly in the responsive bento grid without pagination splits or Previous / Next controls.

- No `page` state, no `TILES_PER_PAGE` slice, and no `buildPages` splitting.
- No `<nav aria-label="Feature pages">` navigation bar.
- Visitors can view and select from all available tenant features immediately in a single unified bento overview.
- The `selectedKeys` array tracks selections across all features.

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

All features render directly into the bento grid without pagination state.

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

Matching is performed entirely by `POST /api/match-properties`, which returns featured properties first, then newest first, with `match_score` already computed. **The results are then re-sorted client-side by `match_score`, highest first**, because that endpoint order is not a ranking — it put a 90% match below an 85% one. A null `match_score` sorts last rather than being read as zero, so an unscored property cannot outrank a scored one, and `Array.prototype.sort` being stable means equal scores keep the endpoint's order among themselves.

This sort is what makes the `01`-`04` numbers on the result cards mean anything. No local slicing or scoring is applied.

The former four-item cap no longer applies. The endpoint decides how many rows come back, and the result panel scrolls (`min-h-0 flex-1 overflow-y-auto` inside a `max-height`-capped aside, `max-h-[85vh] overflow-y-auto` in the mobile sheet).

The `FEATURED_MATCH_ID` featured-first rule applied only to stage results and is gone. The endpoint has its own ordering and its own notion of a featured property.

## 15. Result cards

`MatchCard` renders a single view model, `CardMatch`:

```ts
type CardMatch = {
  id: string;
  label: string;
  badge: string | null;  // headline percentage, from a 0-10 match_score
  score: number | null;  // the raw 0-10 match_score, for the proportion bar
  breakdown: { label: string; score: number }[];  // per-criterion, highest first
  href: string;
};
```

| Field | Value |
|---|---|
| `id` | `property_id` |
| `label` | `property_name` |
| `badge` | `match_score × 10` as a percentage, or `null` when `match_score` is null |
| `score` | The raw 0–10 `match_score`, or `null` |
| `breakdown` | One entry per selected criterion, `"{name}" + score 0-10` |
| `href` | `/properties/{property_id}` |

Entries are filtered to the **features the visitor actually selected**. The endpoint is documented to return only the requested keys, but filtering keeps a card honest if it ever returns more. If filtering empties the list, the full returned list is used as a fallback. Scores of `0` are rendered like any other value — the guide is explicit that zero is a valid score, not a missing one.

`score` exists alongside `badge` because the proportion bar needs the unrounded figure. `badge` is a string that has already lost the precision a 0–100 track needs at the top of the range.

### One criterion means no breakdown

`breakdown` is **empty when fewer than two criteria are selected**. With a single criterion the overall `match_score` is a mean over one number, so it *is* that criterion's score — listing `Family Friendly 9/10` under a `90% match` pill printed the same figure twice.

### Thumbnail, price and locality come from two other endpoints

`POST /api/match-properties` returns summary data only: `property_id`, `property_name`, `slug`, `match_score`, `feature_scores`. A card cannot show a thumbnail, a price or a locality from it.

Rather than one request per result card, two supporting lists are fetched **once**, the first time any match arrives, and joined in memory:

| Source | Fetched as | Joined on | Supplies |
|---|---|---|---|
| `GET /api/properties?status=ALL&page=1&per_page=100` | `fetchProperties` | `property_id` | `cover_url`, `price`, `property_type`, `location_id` |
| `GET /api/locations?page=1&per_page=100` | `fetchLocations` | `location_id` | locality name |

That is two requests for any number of matches. `detailsRequested` is a ref, so the effect never refetches as the selection changes, and the search is **not** awaited — results render immediately and the extra fields fill in when they land.

`locality_name` exists on `ApiProperty`, the ~71-field single-property type, but **not** on `PropertyListItem` returned by the list endpoint. That is why the locality needs the second request rather than coming free with the property.

Per_page is capped at 100, so a tenant with more active properties than that would have some cards without a thumbnail, price or locality. Those cards fall back to name and score rather than showing a broken tile.

### What the card shows now

| Element | Treatment |
|---|---|
| Surface | None. The row is a `border-b` hairline on the panel's own `#141519`, so rows separate by rule rather than by tint |
| Layout | `flex items-center gap-4 px-5 py-3` — thumbnail, text block, score, heart |
| Thumbnail slot | **Always rendered**, a fixed `h-14 w-14`. Tinted `bg-white/6` with a `BuildingIcon` at 20px / `rgba(242,240,234,0.28)` underneath, photo painted over it via `onError` → `display: none` |
| Micro-labels | Rank `01`-`04` in `#6b7280`, plus a gold "Top match" label on the first row |
| Name | `text-[15px] font-bold tracking-tight` |
| Score | `15px` bold tabular figure, gold `#c6a46c` on the top match and `#e8e6e1` elsewhere, over a `3px` proportion bar (gold / `#8a8f98`) in a `w-24` column. Unscored rows read "Unscored" |
| Locality · price | `text-[12px]`, **both always rendered**, separated by a `·`. Price through the shared `formatPrice` |
| Breakdown | One `name 9/10` per criterion, only when 2+ are selected |
| Favourite | 44x44 heart button, `aria-pressed`, `aria-label` naming the property |

The "Top match" label is guarded on `index === 0 && badge !== null`. `cards` is sorted by `match_score`, so the first row is normally the winner — but a first row with a null score sorts first only because nothing scored above it, and calling that a "top match" would be a claim the data does not support. Same rule as `CompareProperties`' `best_property_id` label.

The score bar is `aria-hidden`: the figure above it is the accessible value, and announcing the same number twice helps nobody.

#### Why the thumbnail slot is unconditional

Two bugs came from rendering it only when `cover_url` existed. A property with no image **lost the slot entirely**, so its text began a fixed inset to the left of every other row and the row came out shorter. And a `cover_url` that failed to load — a presigned URL past its expiry answers 403 — painted the browser's broken-image glyph onto the dark row.

The fallback mark now sits *underneath* the image rather than replacing it, so `onError` hiding the `<img>` reveals the fallback instead of a hole. Every row therefore has the same height and the same left text edge.

`BuildingIcon` is a 1px line drawing rather than a solid glyph: it has to sit at low contrast one column to the left of a label, and anything heavier competes with the property name.

#### Why both fields are unconditional

`localityName` is null when the property has no `location_id`, **or when its locality falls outside the 100 rows `fetchLocations` returns**. Previously that null dropped the field and the separator, so the row's text shifted left. Both slots now always render; an unknown locality reads `Location unavailable` in the muted `#6b655c`, and an unpriced property falls through `formatPrice`'s existing `Price on request`.

The wording of the placeholder is a guess and easy to reword. The underlying limit is the `per_page: 100` cap on both supporting lists — a tenant larger than that will see the placeholder on rows whose locality simply fell off the end.

"Price on request" is a real answer from `formatPrice`, not a missing value, so it is shown rather than hidden.

### There is no `tone` prop any more

`MatchCard` and `ResultsPanel` used to take `tone: "light" | "dark"`, because the desktop aside was an opaque cream slab while the mobile sheet was dark — the same results looked like two different things on two viewports. Both components now have a single set of colours and **no branching at all**.

This is still true after the panel was rebuilt to match `CompareProperties`. The desktop aside and the mobile sheet render the identical `ResultsHeader` and `ResultsPanel`; only the *surface behind them* differs, and that is the sheet's own `#1c1f24` against the aside's `#141519`. Neither component knows which viewport it is in.

The removed light palette was `#1c1f24`, `#4a463f`, `#5c5852`, `#6b655c` and `#a3352b`. Those survive only where they are also the dark-mode value: `#6b655c` was the rank number on both, and the rebuild moved the rank label to `#6b7280` as part of the Compare table's micro-label treatment.

One value was **not** carried over. `favoriteError` rendered in `#a3352b` unconditionally, because the old light branch used it and nobody branched the alert. On the dark surface that red measures about 2.4:1, which makes an alert effectively invisible; it is now `#e8a49e`, matching the error state above it.

### The whole card is the "view" target

There is no `View` button. The card carries an absolutely positioned `<Link>` filling it, with a `sr-only` "View {name}", and the heart sits above it on `z-10`.

A `<Link>` wrapping the card would put the favourite `<button>` inside an anchor — invalid HTML, and screen readers then announce one control instead of two. The stretched-link pattern gives one tab stop for the card plus one for the heart, in reading order.

**`pointer-events-none` on the content wrapper is load-bearing.** The wrapper is a *positioned* element (`relative`) that comes after the link in tree order, and hit testing follows paint order — so it painted on top of the stretched link and swallowed every click on the card. The link was reachable in the DOM and in the accessibility tree, and completely dead to a mouse or finger. The heart carries `pointer-events-auto` to take its own clicks back.

The cost is that text inside a result card can no longer be selected, which is the usual trade for this pattern.

### The link is `/properties/{id}`, not `/property/{id}`

`src/app` has two property-shaped routes:

| Route | Purpose |
|---|---|
| `/properties/[propertyId]` | The property detail page. **This is the target.** |
| `/property/[trackingToken]/view` | Share landing. Takes a *tracking token*, not a property id. |

`/property/{property_id}` matches neither and answers **404** — verified against the dev server, where `/properties/aa7de8b7-…` returns 200 and `/property/aa7de8b7-…` returns 404.

`GrowthCorridors`, `MapSection`, `PropertiesList`, `CompareProperties` and `SimilarProperties` all link to `/properties/{id}`.

The card is not replaced by the detail-page wishlist action. Favouriting uses `favoritesService` and `/api/favorites`, independent of the Property Details page's local-storage `Save to wishlist` flag.

### Coming-soon cards — removed

The `comingSoon` / `Soon` treatment existed for static layouts with `available: false`. The matching endpoint returns `status = "ACTIVE"` properties exclusively, so no result can be unavailable and the concept was removed.

## 16. Result navigation

Every card links to `/properties/{property_id}` through an absolutely positioned stretched `<Link>` filling the card. The endpoint returns `property_id` as a UUID, which is what `/properties/[propertyId]` requires — `fetchPropertyById` throws for anything that fails `isPropertyUuid`. The `slug` the response also carries is not used.

Feature result cards carry no `data-track` attributes, so a card click is not attributed to this feature.

## 17. Result states

| State | Condition | Presentation |
|---|---|---|
| `idle` | Nothing selected | A gold icon tile, the eyebrow "Nothing selected yet", the 22px heading "Your matches appear here", and one supporting line — centred across, anchored to the top |
| `loading` | Request in flight | `aria-busy`, a spinner in a gold tile, "Searching" / "Finding your match", "Searching properties for {label}…" |
| `ready` | `items.length > 0` | The `ResultsHeader` band, then the rows, in an `aria-live="polite"` region |
| `empty` | `items.length === 0` | A gold tile, "No exact match" / "Nothing scores on all of them", "A property has to score on every option you pick. Remove one to widen the search." |
| `error` | Non-2xx | `role="alert"`, a rose tile, "Search error" / "We couldn't load matches" plus the backend message |

Favourite loading and toggle failures are shown as a separate alert above the rows; they do not hide or invalidate the property matches. A save or remove failure leaves that property's previous saved state unchanged.

The idle guidance is deliberate: AND matching is the most surprising property of the endpoint, and an unexplained blank panel would read as a bug. `total: 0` is mapped to `empty`, never to `error`.

### Every state is a status card, top-aligned

`idle`, `loading`, `error` and `empty` all render the same composition that `CompareProperties` uses for its own status cards: an icon tile in a `h-14 w-14 rounded-2xl` gold wash, an `11px` uppercase eyebrow, a `22px` bold heading, one supporting paragraph capped at `max-w-md`, and nothing else. All four carry `items-center text-center justify-start px-8 pt-14 pb-10` and `min-h-[280px] flex-1`.

**Horizontally they are centred; vertically they are anchored to the top.**

That vertical alignment has been through two states:

1. **Originally `items-start justify-start text-left`** — flush to the gutter, no horizontal centring. With nothing selected there is no left edge to align to, so the copy hung off the gutter as a few stranded lines in the top-left of a tall empty column, which read as a broken layout rather than as an instruction.
2. **Then fully centred**, `items-center justify-center p-8`. Better as a composition, but the panel is **tall** — `.find-your-plot-panel` derives its height from the viewport rather than from its content — so centring stranded the tile and its four lines of copy in the middle of that height, a long way below the header band that already states what the panel is showing.
3. **Now: centred across, anchored to the top.** The eye reads band → tile → heading → paragraph as one stack, rather than having to find the content in the middle of the column. `pt-14` is what puts it there without tucking it against the band's own hairline.

`min-h-[280px]` replaced the `360px` the centred version carried — that floor existed to give a centred block room to sit in the middle of. Top-aligned, the content needs only its own height plus `pt-14`, and the lower floor stops a short viewport from squeezing the tile and the heading together.

This applies to the mobile sheet as well, because `ResultsPanel` is a single component with no `tone` prop — see §15. There is no viewport branch to add, and none should be.

The heading and the match count live in `ResultsHeader`, outside the scroll region, so the `ready` state no longer carries a heading of its own — see §18.

At desktop the section's height is driven by the left column anyway, so the panel does not change the page's shape on selection.

`loadingLabel` is the names of at most the first two selected features, resolved through the loaded feature list, falling back to "your preferences".

### The loading spinner sets a custom property, not a colour

`loading.css` defines `.ila-loader` with `--ila-loader-color` (default `#171717`), and the loader paints entirely from that variable — **not** from `color`. A `text-[#c6a46c]` utility placed on a loader therefore has no effect on it.

The loading tile uses `[--ila-loader-color:#c6a46c]` with `ila-loader--sm` for size.

`CompareProperties` renders its loading spinner as `ila-loader ila-loader--lg text-[#c9a84c]`, and **neither modifier does anything**: `--ila-loader-color` is left at the near-black default, and `ila-loader--lg` is not defined anywhere in `loading.css`. That spinner is near-black on a gold wash — visible, but not the gold its class names imply.

`ila-fyp-progress`, the animated gold bar this state previously used, is still defined in `globals.css` including its reduced-motion fallback, but **is no longer referenced by this component**.

## 18. Responsive layout

At widths of at least 981 px the results panel is shown in a right-hand aside. Below that breakpoint the aside is hidden and a fixed bottom bar carries the match count and opens the sheet.

### The two columns start at the same line

The section is a two-column grid **from the very top of its content**, not from below the header:

```
content-slot (max-w-7xl, mx-auto)
└── grid min-[981px]:grid-cols-[1.15fr_0.85fr] min-[981px]:items-stretch
    ├── div.min-w-0            ← header + options block
    └── aside (flex)           ← results panel
```

The `<header>` was previously a sibling *above* both columns, so the panel began under it — level with the "Choose one or more" row, which lined its top edge up with neither the heading above nor the first row of tiles below. Folding the header into the left column puts the panel's top level with the `Find your plot` eyebrow, and fills the empty top-right corner. `items-stretch` gives both columns the same height.

### The panel is not sticky any more

`sticky top-24 min-h-112` is replaced by `flex-1` inside a flex `<aside>`. A panel that spans the full height of the left column is by definition as tall as the content, so there is nothing left for it to stick through — and `sticky` would fight the stretch.

`flex-1` rather than `h-full` because the `<aside>` is itself the flex container, so the panel's height does not depend on a percentage resolving against an auto-height parent.

### The panel is capped, grows past the left column, and scrolls internally

```
aside.find-your-plot-panel      align-self: start
                                height:     calc(100svh - var(--nav-h) - 7rem)
                                max-height: calc(100svh - var(--nav-h) - 9rem)
└── div (panel)                 flex column, overflow-x-clip, bg #141519
    ├── ResultsHeader           shrink-0, border-b            ← band, does not scroll
    ├── div.ila-scroll-dark     min-h-0 flex-1 overflow-y-auto  ← the rows
    └── div                     shrink-0 border-t              ← pinned CTA
```

`overflow-x-clip` on the panel, never `overflow-hidden`. Nothing inside is sticky against this element, and `clip` does not create a scrollport.

The `max-height` is the hard limit: without it, five or more result rows made the panel taller than the viewport and the last row was unreachable. `7rem` is this section's `py-24` (96px) below its own top edge plus breathing room. `svh` rather than `vh` so a mobile browser's collapsed address bar cannot push the panel past the usable area.

`height` is set from the viewport, not from the content, so the panel is the same height on two screens of different sizes. `align-self: start` is what makes that possible — without it the grid row's `stretch` wins over any height and the panel is locked to whatever the heading plus the tile grid happens to measure.

**This trades away equal column heights.** The panel's bottom can extend past the left column's content on screens taller than the options block. Equal bottoms were a deliberate choice two changes ago. Dropping `align-self` and `height` from `.find-your-plot-panel` returns the panel to tracking the row, at the cost of the extra height.

`min-h-0` on the scroll region is load-bearing — a flex item defaults to `min-height: auto` and would refuse to shrink below its content, pushing the panel past its cap.

Both scroll regions — this list and the mobile sheet — carry `.ila-scroll-dark`, defined in `globals.css`. It is `.ila-scroll` (the existing light-panel version, used by `MapSection`) with light-thumb colours for a dark surface, **plus `::-webkit-scrollbar-button { display: none }`**, which `.ila-scroll` does not have. Those buttons render as small arrows pinned to each end of the track and read as a stray control against a rounded panel; setting a width on `::-webkit-scrollbar` alone leaves them in place.

The "View all N properties" button is a **sibling** of the scroll region, not inside it, so it stays put while the list scrolls. `N` is the catalogue total from the `/api/properties` response, not the match count — the matches are already all on screen above, so a button promising "all of them" would point at the page it is on. It links to `/properties` and renders only when `apiStatus === "ready"` and `total > 0`.

### The cap is a class, not an arbitrary value

```css
@media (min-width: 981px) {
  .find-your-plot-panel {
    max-height: calc(100svh - var(--nav-h) - 9rem);
  }
}
```

This was `max-h-[calc(100svh-var(--nav-h)-9rem)]`, and **Tailwind's scanner silently drops it**. The two-term form `calc(100svh - var(--nav-h))` is emitted correctly — `.lg:min-h-[calc(100svh-var(--nav-h))]` in `GrowthCorridors` proves it — but adding a third term makes the class produce **no rule at all**. There is no build error and no missing-utility warning; the panel would simply have stayed uncapped. The class is scoped to the same 981px breakpoint the aside appears at.

### The content starts from the left edge, and the panel fills what's left

The container is `w-full` with **no `mx-auto`**. `GrowthCorridors` caps its content at 1280px and lets the leftover space fall on the right, so both sections start at the left edge of the viewport. The block briefly carried `mx-auto`, which centred it and left it aligned with nothing else on the page.

What "equal side margins" means here is the *gutter* — `px-6 sm:px-10` on both sides — not a centred block.

The 1280px cap now applies to the **left column alone**, so the results panel can grow into the space that would otherwise be dead to the right of the section:

```
grid-cols-[1.15fr_0.85fr]                                    /* 981–1279px */
grid-cols-[42rem_minmax(0,1fr)]                              /* from 1280px */
```

`42rem` is 672px, which is exactly the width the left column already had inside the old 1280px cap, so from 1280px the heading and the tile grid do not move by a pixel and the entire extra width goes to the panel.

The proportional split is kept for 981–1279px rather than replaced outright: pinning the left track at every two-column width would leave the panel about 200px wide at 981px.

Measured panel width, on a viewport of that size:

| Viewport | Panel |
|---|---|
| 1280px | 496px (unchanged from before) |
| 1440px | 656px |
| 1920px | 1136px |

**A 1136px results panel is very wide for a list of cards.** Each row is a 56px thumbnail, a name, a score, a locality and price, and a 44px heart — at that width the rows are sparse and the "View all N properties" button is a very long pill. If it reads badly in practice, capping the aside at a maximum (and accepting dead space again) is a one-class change.

The option tiles reflow in an asymmetrical bento grid — 2 columns on mobile, 3 columns from `sm` (`grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3`). All features are displayed together without pagination. Subheadings are removed, leaving clean, prominently typed heading-only cards with adaptive layout for wide tiles to eliminate empty space.

Because the life-stage card grid is gone, the left column is now a single block rather than a `grid-cols-2` of tall cards. The outer `min-[981px]:grid-cols-[1.15fr_0.85fr]` split is unchanged.

### The panel mirrors the `CompareProperties` right column

The desktop results panel now shares its **layout and typography** with the right-hand column of `CompareProperties`. It deliberately does not share its **colour** — see the caveat at the end.

| Element | Treatment | Matches Compare |
|---|---|---|
| Panel surface | `bg-[#141519]`, **no** radius, border, shadow or `backdrop-blur` | ✅ |
| Header band | `shrink-0`, `border-b`, `px-5 py-4`; title `15px` bold, subtitle `12px` | ✅ |
| Criteria pills | Full-width scrolling row, `-mx-5 px-5`, gold `rounded-full` "active" pills | ✅ category row |
| Result rows | `border-b` hairlines on the surface itself, `flex items-center gap-4 px-5 py-3` | ✅ table rows |
| Score | `15px` bold tabular figure + `3px` proportion bar, gold on the top match, `#8a8f98` on the rest | ✅ score bars |
| Micro-label pair | `10px` uppercase rank plus a "Top match" state label | ✅ "Best match" / "Pinned" |
| Pinned CTA | `rounded-xl`, `min-h-11`, gold, `border-t` sibling of the scrollport | ✅ per-column CTA |
| Scrollport | `ila-scroll-dark` (dark thumb), `min-h-0 flex-1` | gold scrollbar |

### Why the surface is solid rather than glass

The panel was `bg-[rgba(242,240,234,0.05)]` glass with a `rounded-[22px]`, a hairline and a deep drop shadow, and the rows were `bg-[rgba(242,240,234,0.1)]` cards on top of it. Two translucencies compositing over the same dark section left each row only marginally lighter than the panel behind it — a stack of chips, not a list.

`#141519` is a step below the section's own `#1c1f24`, so the panel is a surface in its own right rather than a tint on someone else's. With a solid fill there is nothing for a border and a shadow to separate, which is why both are gone along with the radius.

### Why the layout is shared but the colour is not

`CompareProperties` sits on a light `#eceef2` section, so its right column — and its non-ready status cards, which sit on `.compare-results-bg`, the light blueprint layer — are light. This section is `#1c1f24`. Reproducing the light panel here would put a light rectangle in the middle of a dark section rather than a seamless continuation of it.

Everything about **structure and typography** is therefore shared, and the surface stays dark. One consequence worth knowing: this component does **not** use `.compare-results-bg`, so the blueprint texture never appears inside the panel in any state.

### The panel is still not flush to the viewport edge

`CompareProperties` achieves its flush column by making the whole section a `lg:grid lg:h-[104dvh]` with no outer gutter, so the right column touches the right, top and bottom edges. `FindYourPlot` is a normal flow section with `px-6 sm:px-10` and a content-driven height, so its panel sits inside the gutter.

Matching that would mean restructuring the section into a screen-height grid the way Compare does, which changes the left column's padding and the page's scroll behaviour. That was out of scope for this change; it is a separate piece of work.

### Section padding matches `GrowthCorridors`

The container is `px-6 py-16 sm:px-10 sm:py-24`, identical to the localities section directly above it on the homepage. It was `px-6 py-10 sm:py-12` with no `sm` side step, so the section read as tighter than its neighbour at every breakpoint. Two adjacent sections with a 24px padding difference read as a seam, not as variation.

`GrowthCorridors` overrides its own vertical padding at `lg` with `lg:pt-10 lg:pb-6 xl:pt-12`. That is **not** copied here: it exists because that section is sized to one screen with `lg:min-h-[calc(100svh-var(--nav-h))]`, so its padding is a leftover after the content fills the viewport. This section has no such constraint and its height follows its content.

### Section spacing sits on one scale

| Break | Value | Between |
|---|---|---|
| Header paragraph → options block | `mt-6` (24px) | Section blocks |
| Label row → tile grid | `mt-6` (24px) | Section blocks |
| Options block → results aside | `gap-8` (32px) | Columns, from `min-[981px]` |
| Tile grid gutters | `gap-2.5 sm:gap-3` (10-12px) | Bento tiles |
| Tile grid → AND hint | `mt-3.5` (14px) | Within one block |

Previously the two block gaps were `mt-8` (32px) and `mt-3` (12px) — a large break into a tight one — and `min-[981px]:gap-10` (40px) was off the 8/12/16/24/32 scale entirely. The tile gutter also stepped 10px to 12px at `sm`; `gap-2` is a single value at every width.

## 19. Mobile results bar and sheet

### The sheet no longer opens on selection

For `(max-width: 980px)` the sheet is opened **only** by the bottom bar. `runFeatureSearch` used to call `setSheetOpen(true)` on every search, so the first tap on a tile covered the tiles with the results — a visitor who selected one criterion was immediately looking somewhere else instead of adding a second. That is the one thing a multi-select must not do.

Tapping a tile now only selects or deselects it. The sheet still has a dimmed backdrop, `role="dialog"`, `aria-modal="true"`, `aria-label="Your plot matches"`, a close button, a maximum height of `85vh`, and scrollable content, and can be closed through the backdrop or the close button.

### The bottom bar

| Aspect | Behaviour |
|---|---|
| Rendered | `isMobileSheet && !sheetOpen && apiStatus !== "idle"` — so after any completed or failed search as well as a successful one |
| Position | `fixed inset-x-0 bottom-0 z-40`, `px-4 pb-4`, below the sheet's `z-50` |
| Control | One full-width gold pill, `min-h-14` |
| Label | `resultsBarLabel` — see below |
| Action | `View` plus a chevron; opens the sheet |
| Spacing | An `h-20` spacer is rendered with it, so the bar never covers the section's own content |

`resultsBarLabel` only shows a count where one is meaningful:

| `apiStatus` | Label |
|---|---|
| `ready` | `4 matches`, or `1 match` |
| `loading` | `Searching` |
| `empty` | `No matches` |
| `error` | `Could not load` |

Rapid chip taps pass through `loading` on every selection, which is why it is a single word rather than a sentence.

The `h-20` spacer appears and disappears with the bar, so the sections below move by 80px the first time a search runs. Reserving it permanently would instead leave an 80px hole above an untouched section, which is the worse of the two.

## 20. Scroll locking and cleanup

When the mobile sheet is open, the component sets `document.body.style.overflow` to `hidden` and restores the previous value during cleanup. The match request is aborted on unmount.

Focus trapping, focus restoration, and Escape-key dismissal are not implemented; exact behavior is UNKNOWN — needs verification.

## 21. Accessibility behavior

Feature controls are semantic buttons with `type="button"` and `aria-pressed`. The tile container is a `role="group"` labelled "What matters to you". The loading panel exposes `aria-busy`; ready results use `aria-live="polite"`; error states use `role="alert"`. The mobile sheet uses dialog semantics and labelled close controls. Decorative SVGs use `aria-hidden`.

Each tile is a whole-card target rather than a small pill, which improves touch accessibility — the tap area is roughly 170x112px on mobile instead of a compact chip.

The selected state is conveyed by `aria-pressed`, not by the check badge or the colour alone. Each result card's favourite button also exposes its saved state with `aria-pressed` and is disabled while its save/remove request is pending.

With pagination removed, all tiles remain in the DOM within the `role="group"` container, allowing full keyboard navigation across all available features.

Visual order and DOM order follow standard reading flow across the bento grid columns without dense reordering.

The selection circle on each tile is `aria-hidden`. The button's own `aria-pressed` already carries the selected state, so exposing the circle as well would announce it twice.

Cards carry a thumbnail with `alt=""` — it is `aria-hidden` and carries no information the property name does not. The previous decision that cards contain no images at all no longer applies; see §15 for how the image is sourced.

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
- `match_score` is `number | null` and is handled, but null has not been observed in practice. A null sorts last, but it would still be given a rank number by the card's `01`-`04` label, since that label is the card's position rather than a score.
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
10. Mobile: tapping a tile only selects it and the sheet stays closed; the bottom bar shows the count and opens the sheet; closing it leaves the bar; body scroll is restored.
11. Feature `View` resolves `/properties/{uuid}` and loads the detail page.
12. Existing favourites load into the result cards, and each card keeps a 44px heart with `aria-pressed` and an `aria-label` naming the property. Tapping the heart must **not** navigate — the stretched link is underneath it.
13. Saving and removing a result sends the property's UUID to `/api/favorites`; the card state changes only after success, and the control is disabled while pending.
14. A favourites load or toggle failure shows its alert without removing the match results.
15. Confirm the text-only cards read acceptably without an image.
16. Confirm no tile clips a long feature name or description at 320px, 768px, 1000px and 1440px.
17. Confirm all cards render with uniform, balanced dimensions and no awkward empty spaces.
18. Tab through the tiles and result-card controls and confirm focus is always visible and both pressed states are announced.
19. Confirm all features render together in the bento grid with no pagination splits or pager navigation buttons.
20. Confirm cards display headings only (`feature.name`), with no subheadings or descriptions.
21. Confirm selecting features updates `selectedKeys`, turns on the card's active styling/check mark, and maintains accurate `N selected` counter.
22. Confirm bento grid renders with increased typography sizes (`text-lg font-bold` on wide cards, `text-[15px] font-semibold` on standard cards) and balanced proportions across mobile and desktop.
23. Confirm `cards` is sorted by `match_score` descending, so the `01`-`04` numbers and the card order agree.
24. With one criterion selected, confirm no per-criterion breakdown is shown; with two or more, confirm one line per criterion.
25. Confirm the thumbnail, locality and price appear once `/api/properties` and `/api/locations` resolve, and that a property missing from the list response still renders with name and score.
26. Desktop: with nothing selected, confirm the panel shows a status card — gold tile, eyebrow, 22px heading, one paragraph — **centred horizontally but anchored to the top of the panel**, sitting just below the header band rather than floating in the middle of the column.
27. Desktop: the header band (title, count line, criteria pills) stays fixed while the result rows scroll under it, and the "View all N properties" button stays fixed at the bottom.
28. Desktop: exactly one row carries the gold "Top match" label, and it is row 1. Confirm a row whose `match_score` is null never takes that label.
29. Compare each panel state against the corresponding state of the `CompareProperties` right column at 1280px+ and confirm the composition, type scale and gold match.
30. Confirm the loading spinner renders in gold, not near-black — a `text-` colour utility on `.ila-loader` has no effect, only `[--ila-loader-color:…]` does.

Automated test coverage for this component is UNKNOWN — needs verification.

## 26. Related documentation

- `docs/architecture/api.md` — the API architecture, including the feature endpoints and the constraints recorded there.
- `docs/features/property-details.md` — the `/properties/{propertyId}` route the result cards link to.