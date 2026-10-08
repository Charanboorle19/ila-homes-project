# Find Your Plot feature

This document describes the current homepage `FindYourPlot` implementation. It is based on the inspected TypeScript/React source and static data only. It does not describe the separate API-backed `MapSection` or `GrowthCorridors` search experiences.

## 1. Feature purpose

`FindYourPlot` gives visitors two ways to discover static property-layout matches: choose a life-stage goal or select one or more preference tags. It then shows a short, reasoned list of matching layouts. It is a recommendation UI, not a live property search or booking workflow.

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

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\FindYourPlot.tsx` — component, state, matching logic, markup, responsive presentation, and result cards.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\propertyLayouts.ts` — layout records, featured-layout id, preference tags/scores, and life-stage definitions.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage integration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\globals.css` — possible global animation/style definitions. Exact ownership of every class used by this component is UNKNOWN — needs verification.

## 5. Component API

`FindYourPlot` is a default-exported component that accepts no props. All selection, loading, result, and mobile-sheet state is internal.

## 6. Section identity and semantics

The root element is a `<section>` with `data-section="land_roadmap"`, `id="contact"`, class `find-your-plot`, and `aria-label="Find your plot"`. The `contact` id is also a fragment target used elsewhere in the application; this component does not itself submit contact information.

## 7. Visible introductory copy

The current rendered copy is:

- Kicker: `Find your plot`
- Heading: `What are you planning?`
- Description: `Tell us what matters to you. We'll show you properties that fit your goals.`

The older handoff phrase “Who are you buying this for?” is not the current JSX copy.

## 8. User flow

1. The visitor sees four life-stage cards and a row of preference tags.
2. Selecting a life stage starts the loading state and then reveals stage-defined matches.
3. Selecting one or more preference tags starts the loading state and then reveals scored matches.
4. Selecting a different mode clears the other mode’s selections.
5. Clearing the final preference tag returns the feature to its idle state.
6. Selecting the already-active life stage resets the entire feature.

## 9. Life-stage choices

The static `LIFE_STAGES` data defines four choices:

| Id | Label | Description | Displayed count |
|---|---|---|---|
| `building` | Build a home | A place to call your own. | 12 properties match |
| `investment` | Invest & grow | For long-term appreciation. | 8 properties match |
| `family` | For my family | Space for what’s ahead. | 10 properties match |
| `exploring` | Just exploring | Show me what’s available. | 24 properties match |

The displayed counts are data-file copy; they are not calculated from the number of result cards.

## 10. Life-stage candidate layouts

The stage candidate ids are:

- `building`: Sark Green Plains, Singapore Township, Khajaguda Residency, Nallagandla Enclave.
- `investment`: Sark Green Plains, Kokapet Heights, Patancheru Gateway, Mansanpally Meadows.
- `family`: Sark Green Plains, Nallagandla Enclave, Mansanpally Meadows, Singapore Township.
- `exploring`: all seven layouts.

Unknown or missing ids are filtered out by `getLayoutById`; no current missing ids were found in the inspected data.

## 11. Life-stage explanations

Each stage provides optional per-layout reasons. The stage result uses that reason when present and falls back to the layout’s `highlight` text when it is absent. These descriptions are static marketing/demo copy and are not verified property claims.

## 12. Preference controls

Preference tags are rendered as buttons with `aria-pressed`. The current labels are:

1. Away from traffic
2. Kids can play outside
3. Walk to a temple
4. Good resale in 5 yrs
5. Corner plot
6. Gated community
7. Near a main road
8. School within 2km
9. No builders nearby yet
10. Weekend drive only

## 13. Preference selection behavior

Preference tags are multi-select. Clicking an unselected tag adds it; clicking a selected tag removes it. Any preference interaction clears the selected/revealed life stage. When at least one tag remains, mode becomes `feel` and matching is scheduled. Removing the final tag clears the mode, results, loading state, and mobile sheet.

## 14. Internal state

The component maintains `mode`, `selectedStage`, `revealedStage`, `selectedFeels`, `revealedFeels`, `status`, `sheetOpen`, and `isMobileSheet`. The result status is one of `idle`, `loading`, or `ready`. A ref stores the pending timeout so a previous simulated load can be cancelled.

## 15. Simulated loading behavior

Every non-empty selection sets status to `loading`, then waits `MATCH_LOAD_MS = 900` milliseconds before copying the selection into its revealed state and setting status to `ready`. This is a client-side delay; the component does not fetch matches during it.

## 16. Idle result state

Before a selection, the results panel displays an idle glow SVG, `Your matches will appear here`, and guidance to choose a plan or pick feelings. The exact explanatory punctuation is current JSX text; no empty-result API state exists.

## 17. Loading result state

While loading, the panel has `aria-busy="true"`, a gold progress bar, `Finding your match`, and `Searching properties for {loadingLabel}…`. In feel mode, `loadingLabel` includes at most the first two selected tag labels; in stage mode it uses the selected stage title.

## 18. Stage matching algorithm

After the delay, each `revealedStage.matchIds` value is mapped through `getLayoutById`. Missing layouts are discarded. The result receives the stage-specific reason or layout highlight, then passes through `withFeaturedFirst`.

## 19. Preference matching algorithm

For each layout, `scoreFeelMatch` averages the selected tags’ scores from `FEEL_SCORES` and rounds the result to the nearest integer. Missing individual scores contribute `0`. All layouts are sorted by descending percentage, except that the featured layout is forced to the front, and the list is limited to four before the final featured-first normalization.

## 20. Featured layout rule

`FEATURED_MATCH_ID` is `sark-green-plains`. When present in a result set, Sark Green Plains is always first. In preference mode its displayed percentage is at least 90, even if the calculated average is lower. This is presentation logic, not a separate ranking service.

## 21. Coming-soon result rule

Non-featured layouts with `available: false` are converted to `comingSoon: true` by `withFeaturedFirst`. Their card displays `Coming soon`, `Full details unlocking soon`, `Adding soon`, a grayscale image, and `Soon` instead of an active view link. The featured layout is forced to remain non-coming-soon by the current helper.

## 22. Result-card content

Each card displays a numeric order badge, image, title or `Coming soon`, location and plot-size text when available, either a match percentage or layout tag, a two-line reason, price text, and either `View` or `Soon`. The image has an empty alt attribute because it is treated as decorative in the card.

## 23. Available result navigation

For an available, non-coming-soon match, the card renders a Next.js `Link` with `href="/#projects"` and label `View`. It does not navigate to `/properties/{id}` and does not pass the match id in the URL. The target’s downstream behavior is outside this component and is UNKNOWN — needs verification.

## 24. Unavailable result navigation

Unavailable cards have no link and no click handler. They render the text `Soon`. The component does not open a property detail page, enquiry form, WhatsApp conversation, brochure, or API action for those cards.

## 25. Responsive layout

At widths of at least 981 px, the results panel is shown in a sticky right-hand aside. Below that breakpoint, the aside is hidden and a `View matches` button can reopen results after the sheet is closed. The input cards remain in a two-column grid, while preference tags wrap horizontally.

## 26. Mobile results sheet

For `(max-width: 980px)`, selecting a result mode opens a fixed bottom sheet. It has a dimmed backdrop, `role="dialog"`, `aria-modal="true"`, `aria-label="Your plot matches"`, a close button, a maximum height of `85vh`, and scrollable content. It can be closed through the backdrop or close button and reopened through `View matches`.

## 27. Scroll locking and cleanup

When the mobile sheet is open, the component sets `document.body.style.overflow` to `hidden` and restores the previous value during cleanup. The selection timeout is cleared when replaced, reset, or when the component unmounts. Focus trapping, focus restoration, and Escape-key dismissal are not implemented in the inspected component; exact behavior is UNKNOWN — needs verification.

## 28. Accessibility behavior

Life-stage and preference controls are semantic buttons with `type="button"` and `aria-pressed`. The loading panel exposes `aria-busy`; ready results use `aria-live="polite"`; the mobile sheet uses dialog semantics and labelled close controls. Decorative images/SVGs use empty or hidden alternative text. The preference container’s exact group semantics and keyboard behavior beyond native buttons are UNKNOWN — needs verification.

## 29. Analytics attributes

Life-stage buttons carry `data-track="PERSONA_SELECT"` and metadata containing `persona_id` and the next `selected` value. Preference buttons carry `data-track="PREFERENCE_TAG_SELECT"` and metadata containing `tag_id` and the next `selected` value. The component does not directly call `trackEvent`.

## 30. Analytics transport

The component relies on the application’s delegated click-tracking infrastructure to interpret its `data-track` attributes. Exact event batching, visitor identification, failure handling, and whether the current tracker is mounted on every route are outside this component and are UNKNOWN — needs verification. Result-card `View` links have no feature-specific `data-track` attributes.

## 31. Static layout data contract

Each `PropertyLayout` contains `id`, `label`, `location`, `tag`, `plotSizes`, `priceRange`, `highlight`, `status`, `available`, and `image`. The current static dataset contains seven layouts. All seven currently reference `/hero-image.png` as their image source.

## 32. Current layout inventory

| Layout | Location | Plot sizes | Status | Available |
|---|---|---|---|---|
| Sark Green Plains | Tukkuguda · Hyderabad | 435 sq yards | Open for Booking | Yes |
| Singapore Township | Isnapur, West Hyderabad | 200–400 sq yards | Updating Soon | No |
| Nallagandla Enclave | Near University of Hyderabad | 250–350 sq yards | Updating Soon | No |
| Kokapet Heights | Kokapet – Financial District Belt | 200–300 sq yards | Updating Soon | No |
| Khajaguda Residency | Khajaguda, Rajendra Nagar | 300–450 sq yards | Updating Soon | No |
| Patancheru Gateway | Patancheru, NH-65 Corridor | 200–400 sq yards | Updating Soon | No |
| Mansanpally Meadows | Mansanpally, Shamshabad Belt | 250–400 sq yards | Updating Soon | No |

Prices and property descriptions are static data-file values and require business verification before production use.

## 33. Dependencies, limitations, and maintenance constraints

- The component depends on React hooks, Next.js `Image`, Next.js `Link`, local static data, and imported local stage-background assets.
- It does not import `fetch`, an API service, MapLibre, geolocation, or the legacy `plots.ts` dataset.
- Match counts are display labels and may not equal the rendered card count.
- Preference scores are explicitly demo scores in `propertyLayouts.ts`.
- There is only one currently available layout, so most result cards are intentionally coming-soon.
- Exact CSS definitions for `animate-sheet-up`, `ila-fyp-progress`, and any reduced-motion handling are UNKNOWN — needs verification.
- The older `src/components/find-your-plot-who-are-you-buying-this-for.md` handoff references obsolete `.jsx`, `.css`, and routing behavior; it is not canonical for the current implementation.

## 34. Verification checklist and source boundary

Manual verification should cover idle, loading, ready, stage selection, stage reset, multi-tag selection, clearing all tags, featured-first ordering, coming-soon cards, the available `/#projects` link, desktop sticky results, mobile sheet close/reopen, body scroll restoration, and keyboard activation of controls. Automated test coverage for this component is UNKNOWN — needs verification.

This documentation change intentionally creates only `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\find-your-plot.md`; application code is not part of the feature-documentation scope.