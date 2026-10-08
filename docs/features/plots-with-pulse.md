# Plots with Pulse feature

## 1. Feature purpose

The homepage `PlotsWithPulse` section presents four featured layout cards with activity-style signals and comparison scores. Its visible message is “See what others are looking at right now.” The UI describes the activity numbers as provisional demo estimates and explicitly says they are not accurate live data.

## 2. Where it appears

It appears only in the homepage render tree. The component is rendered after `FromTheField` and before `Faq`.

## 3. Homepage position

The current homepage sequence around the feature is:

```text
ShortlistShare → EmiAppreciation → FromTheField → PlotsWithPulse → Faq
```

The section uses `data-section="compare_plots"`.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PlotsWithPulse.tsx` — component, local featured IDs, seeded pulse data, derived records, update interval, and markup.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PlotsWithPulse.css` — feature-specific styles and responsive rules.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\propertyLayouts.ts` — source layout records used for available-card details.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage import and render position.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\plots-pulse\kokapet.jpg` — Kokapet card image.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\plots-pulse\nallagandla.jpg` — Nallagandla card image.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\plots-pulse\mansanpally.jpg` — Mansanpally card image.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\about-panel\hero-property.jpg` — Sark Green Plains card image.

## 5. Component names

- `PlotsWithPulse` — default-exported React component.
- `BarRow` — local presentational function for each percentage bar.
- `buildPlots` — local function that combines layout records, pulse seeds, availability, and images.
- `formatPrice` — local price-label helper.
- `nudgeViewing` — local viewing-count update helper.

## 6. Props

`PlotsWithPulse` accepts no props. `BarRow` receives `{ label: string; value: number }`. The feature is self-contained and receives no property, search, map, or enquiry callback.

## 7. Data source

Pulse data is local/static seed data in the `PULSE_SEED` object in `PlotsWithPulse.tsx`. Layout text for an available record is read from the local `propertyLayouts` array. Images are local static imports. The component does not call an API, `fetch`, `apiFetch`, or any service endpoint. Therefore, there are no API endpoints or parameters for this feature.

## 8. Data structure

`PulseSeed` contains `badge`, `viewing`, `enquiries`, `lastVisitedMin`, `appreciation`, `connectivity`, `infra`, and `available`. `PulsePlot` adds `id`, `name`, `location`, `meta`, `price`, `status`, and `image`. `FEATURED_IDS` is a fixed four-item `LayoutId` tuple.

## 9. How pulse/activity is calculated

The initial activity values are directly seeded numbers; they are not calculated from views, enquiries, wishlists, CRM records, or analytics. On the client, only the available plot’s `viewing` and `lastVisitedMin` values are locally nudged every 4,500 ms:

- `viewing` changes by either `+1` or `-1`, selected with `Math.random() < 0.55`, and is clamped from `1` through `12`.
- `lastVisitedMin` increases by `1` with probability `0.4`, otherwise remains unchanged, and is capped at `59`.
- `enquiries`, `appreciation`, `connectivity`, and `infra` do not change at runtime.

The implementation does not establish real-time activity.

## 10. What properties/plots are displayed

Exactly four featured layout IDs are displayed, in fixed order:

1. `sark-green-plains` — Sark Green Plains; available.
2. `kokapet-heights` — displayed as `Coming soon`; unavailable.
3. `nallagandla-enclave` — displayed as `Coming soon`; unavailable.
4. `mansanpally-meadows` — displayed as `Coming soon`; unavailable.

Only Sark Green Plains displays its layout name, location, metadata, price, and pulse details. The other three use coming-soon display values.

## 11. Sorting/ranking logic

There is no sorting, ranking calculation, or dynamic ordering. `buildPlots()` maps `FEATURED_IDS` in their declared order. Badge labels such as `Hot`, `New`, and `Best Value` are seeded labels, not ranking results.

## 12. Displayed metrics

For the available card, the UI displays:

- `viewing`: `people viewing now`.
- `enquiries`: `enquiries today`.
- `lastVisitedMin`: `Last visited {n} min ago`.
- `appreciation`, `connectivity`, and `infra`: percentage bars labelled `Appreciation`, `Connectivity`, and `Infra Growth`.

The values are local demo values. The code does not use viewing counts, enquiry counts, wishlist counts, or another external popularity metric to calculate them.

## 13. Cards/list UI

The feature renders a grid container with one semantic `<article>` per plot. Each card has an image area, image text, badge, viewing/coming-soon strip, name, metadata, price, and either the activity/signals plus score bars or the unavailable-state copy. The available seed badge is `Open`; unavailable cards show `Soon`.

## 14. Click behavior

Cards are not buttons and do not have `onClick` handlers. There is no card action, selection state, hover action beyond CSS styling, or CTA inside the feature.

## 15. Navigation behavior

There is no link, `href`, router call, or navigation target in `PlotsWithPulse`. Clicking an item does not open a property page, map, search result, enquiry form, or external destination.

## 16. State variables

The component has one state variable:

- `plots` — `PulsePlot[]`, initialized with `buildPlots` and updated by the interval for available plots.

There is no loading, error, selected-card, filter, search, or navigation state.

## 17. Derived values

`buildPlots()` derives each record’s display fields from the fixed ID, the matching `propertyLayouts` record, the `PULSE_SEED` record, and `PLOT_IMAGES`. For unavailable records it derives:

- `name: "Coming soon"`
- `location: ""`
- `meta: "Details coming soon"`
- `price: "Adding soon"`
- `status: "Updating Soon"`

For available records, it derives layout metadata and formats the first segment of `priceRange` using `formatPrice`.

## 18. Functions

- `formatPrice(priceRange)` returns the text before the first en dash or middle dot.
- `buildPlots()` constructs the four `PulsePlot` records.
- `nudgeViewing(current)` randomly increments or decrements the viewing count and clamps it to `1–12`.
- `BarRow({ label, value })` renders one score row.
- `PlotsWithPulse()` owns state/effect behavior and renders the section.

## 19. Hooks

The component uses `useState` for `plots` and `useEffect` to create a browser interval. The effect returns cleanup through `window.clearInterval`. No data-fetching, route, media-query, or analytics hook is used.

## 20. Loading behavior

There is no feature-specific loading state. Local layout data and imported images are available synchronously to the component. The text `Updating this section.` is a persistent informational notice, not a loading indicator for an API request.

## 21. Error behavior

There is no feature-specific error state or error UI. No API request is made. Image loading/error fallback behavior is delegated to the current `next/image` and application configuration.

## 22. Empty-state behavior

There is no empty-state branch. The fixed four-item list is rendered from `FEATURED_IDS`; if a layout lookup were missing, the available fallback fields in `buildPlots()` would be empty or use the ID, but the current four IDs have matching layout records.

## 23. Analytics

`PlotsWithPulse.tsx` does not import or call `trackEvent`, does not add `data-track` attributes, and does not emit a feature-specific analytics event. Whether global section-dwell analytics observes the `data-section="compare_plots"` attribute is outside this component and is `UNKNOWN — needs verification`.

## 24. Relationship with MapSection

There is no import, prop, callback, shared state, API request, or navigation connection between `PlotsWithPulse` and `MapSection`. The cards do not open map layouts or map property sheets. Any broader relationship through shared project concepts is `UNKNOWN — needs verification`.

## 25. Relationship with Search

There is no search input, search handler, query state, search service, or search navigation in this feature. Search does not provide data to the cards, and the cards do not update search state. Any indirect homepage-level relationship is `UNKNOWN — needs verification`.

## 26. Relationship with Property Details

The component does not import Property Details components, create property-detail links, or pass a property ID to a detail route. Although its IDs overlap with `propertyLayouts` records used elsewhere, no runtime connection to `/properties/{propertyId}` is implemented here.

## 27. Relationship with Property Enquiry

The component has no enquiry form, enquiry CTA, enquiry handler, WhatsApp/mail link, enquiry service, or enquiry analytics event. The displayed `enquiries` number is a seeded display metric and does not submit or retrieve enquiries.

## 28. Desktop behavior

At widths above `900px`, the cards use a CSS grid with responsive columns based on `repeat(auto-fit, minmax(220px, 1fr))`. In the `901–1100px` range, the minimum card column width is reduced to `200px` and the gap to `0.75rem`. The section is centered within its frame and the image height is `9.5rem`.

## 29. Mobile behavior

At `900px` and below, the card grid becomes a single-row horizontal scroller with `overflow-x: auto`, touch scrolling, `scroll-snap-type: x mandatory`, and no wrapping. Cards are fixed-width horizontal items. At `640px` and below, the cards become narrower and the section has reduced bottom padding.

## 30. Responsive breakpoints

The exact CSS breakpoints are:

- `@media (max-width: 900px)` — mobile horizontal scroller, card sizing, reduced image height, and mobile section/frame rules.
- `@media (max-width: 640px)` — smaller card widths and bottom padding.
- `@media (min-width: 901px) and (max-width: 1100px)` — narrower desktop grid columns and gaps.

There is no JavaScript breakpoint or viewport hook.

## 31. CSS/classes

The main classes are `.plots-pulse`, `.plots-pulse__frame`, `.plots-pulse__intro`, `.plots-pulse__eyebrow`, `.plots-pulse__heading`, `.plots-pulse__lede`, `.plots-pulse__updating`, `.plots-pulse__grid`, `.plots-pulse__card`, `.plots-pulse__image`, `.plots-pulse__image-bg`, `.plots-pulse__image-text`, `.plots-pulse__badge`, `.plots-pulse__live`, `.plots-pulse__ping`, `.plots-pulse__body`, `.plots-pulse__name`, `.plots-pulse__meta`, `.plots-pulse__price`, `.plots-pulse__signals`, `.plots-pulse__bars`, `.plots-pulse__bar-row`, `.plots-pulse__bar-label`, `.plots-pulse__bar-track`, `.plots-pulse__bar-fill`, and `.plots-pulse__bar-val`. Unavailable cards also receive `.is-soon`; their CSS applies grayscale, reduced opacity, and `pointer-events: none`.

## 32. Accessibility

The section uses `aria-labelledby="plots-pulse-heading"` with a matching heading ID. Each card is an `<article>`. Images use `alt=""` and are treated as decorative because adjacent text supplies the visible card information. The notice uses `role="status"`. Unavailable cards expose `aria-disabled`. The score bars do not expose a progress-bar role or numeric ARIA value, and viewing-count changes are not separately announced in a live region.

## 33. Dependencies

Direct dependencies are React `useState`/`useEffect`, Next.js `Image` and `StaticImageData`, the local `propertyLayouts` module and `LayoutId` type, local image assets, and the component stylesheet. It does not use an API client, analytics client, map library, carousel library, or external pulse service.

## 34. Known issues

- Activity values are local provisional demo estimates, not authoritative live activity.
- The interval uses random local changes rather than real viewing or visit data.
- Only Sark Green Plains is currently displayed as available; the other three cards are disabled coming-soon cards.
- The `enquiries` metric is displayed but is not connected to actual enquiry records.
- Score values have no documented calculation or external source in the implementation.
- Cards have no property-detail or enquiry navigation.
- There is no feature-specific error or empty state.
- Whether global analytics observes the section marker is `UNKNOWN — needs verification`.
- The requested prerequisite file `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\instagram-videos.md` was not found during inspection (`ENOENT`).

## 35. Important constraints

- Treat the feature as a local static/demo presentation, not as a real-time activity feed.
- Preserve the fixed four-ID order unless the implementation is intentionally changed.
- Do not interpret `viewing`, `enquiries`, `lastVisitedMin`, or the three percentage bars as API-backed or verified business metrics.
- The current update interval affects only the available plot’s viewing and last-visited display values.
- Unavailable cards intentionally remain non-interactive through their markup and `.is-soon` styling.
- The feature currently has no navigation, enquiry submission, map integration, search integration, or feature-specific analytics event.
- This documentation describes the current implementation only; no application code was modified for this documentation task.