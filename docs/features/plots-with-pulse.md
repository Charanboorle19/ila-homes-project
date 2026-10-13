# Plots with Pulse feature

## 1. Feature purpose

The homepage `PlotsWithPulse` section presents property cards with activity-style signals, guide pricing, and comparison scores. Its visible message is “See what others are looking at right now.” The section header presents a live demand signal badge while clearly noting that activity figures are provisional demo estimates.

## 2. Where it appears

It appears on the homepage render tree in `src/app/page.tsx`, rendered after `FromTheField` and before `Faq`.

## 3. Homepage position

The current homepage sequence around the feature is:

```text
ShortlistShare → EmiAppreciation → FromTheField → PlotsWithPulse → Faq
```

The section uses `data-section="compare_plots"` and `id="plots-pulse"`.

## 4. Component/file paths

- `src/components/PlotsWithPulse.tsx` — component, API fetching, activity seeds, derived records, carousel scroll management, and markup.
- `src/components/PlotsWithPulse.css` — feature-specific scrollbar and reduced-motion rules.
- `src/services/propertiesService.ts` — `fetchProperties`, `formatPrice`, and property typing.
- `src/app/page.tsx` — homepage import and render position.
- `src/app/assets/plots-pulse/kokapet.jpg` — Kokapet fallback image.
- `src/app/assets/plots-pulse/nallagandla.jpg` — Nallagandla fallback image.
- `src/app/assets/plots-pulse/mansanpally.jpg` — Mansanpally fallback image.
- `src/app/assets/about-panel/hero-property.jpg` — Sark Green Plains fallback image.

## 5. Component names

- `PlotsWithPulse` — default-exported React component.
- `BarRow` — presentational metric bar with percentage label and animated fill.
- `toPlot` — maps `PropertyListItem` from the API into a `PulsePlot` record with fallback images and provisional activity metrics.
- `formatArea` — formats property area range in sq yards.
- `nudgeViewing` — client-side interval helper nudging viewing counts.
- `ArrowIcon`, `PinIcon`, `FlameIcon`, `ClockIcon` — inline SVG icons for navigation, location, and pulse signals.

## 6. Props

`PlotsWithPulse` accepts no props. `BarRow` receives `{ label: string; value: number }`.

## 7. Data source

Property data is loaded from the live API via `fetchProperties({ status: "ALL", page: 1, perPage: 100 })`. Fallback cover photos use local static imports. Activity metrics (viewers, enquiries, last visited, comparison scores) are seeded provisional demo numbers that update dynamically client-side.

## 8. Data structure

`PulsePlot` contains:
- `id`: string
- `name`: string
- `location`: string
- `meta`: string
- `price`: string
- `status`: string
- `image`: StaticImageData | string
- `viewing`: number
- `enquiries`: number
- `lastVisitedMin`: number
- `appreciation`: number
- `connectivity`: number
- `infra`: number

## 9. How pulse/activity is calculated

The initial activity values are derived from property attributes and seed offsets. On the client, an interval runs every 4,500 ms:
- `viewing` nudges by `+1` or `-1` with a slight upward bias (`Math.random() < 0.55`), clamped between `1` and `12`.
- `lastVisitedMin` increments with probability `0.4`, capped at `59`.
- `enquiries`, `appreciation`, `connectivity`, and `infra` remain stable during the session.

## 10. What properties/plots are displayed

All properties returned by `fetchProperties` (up to 100) are rendered in the carousel. Each item displays its layout name, location, metadata, price, live viewing badge, enquiries, visit recency, and score bars.

## 11. Sorting/ranking logic

Items are ordered according to the API response.

## 12. Displayed metrics

For each card, the UI displays:
- `viewing`: `{n} viewing now` (with an emerald pulsing ping badge).
- `enquiries`: `{n} enquiries today` (with flame icon).
- `lastVisitedMin`: `Last active viewing {n}m ago` (with clock icon).
- `appreciation`, `connectivity`, and `infra`: horizontal score bars with gold fills and percentage values.

## 13. Section & Card UI Design

### Section Container Architecture (Matching Growth Corridors)
The section container follows the exact architectural rhythm and styling of the **South Hyderabad · Growth corridors** section:
- Outer canvas: `bg-[#eceef2]` with the shared decorative blueprint background grid (`.growth-corridors-bg`).
- Content frame: `content-slot relative w-full px-6 py-16 sm:px-10 sm:py-24 lg:flex lg:flex-col lg:justify-center lg:pt-10 lg:pb-6 xl:pt-12`.
- Two-column header:
  - Left column: gold uppercase eyebrow (`Plots with pulse`), responsive bold title (`See what others are looking at right now`), and lede description.
  - Right column: "Live Demand Signal" pill with animated emerald ping indicator and provisional estimate disclaimer.
- Carousel navigation bar:
  - Left: `{plots.length} plots tracked`.
  - Right: active card counter (`{activeCardIndex + 1} / {plots.length}`) and desktop circular arrow navigation buttons (`scrollCards(-1)` / `scrollCards(1)`).
- Horizontal scroll track: `-mx-6 mt-6 flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto px-6 pb-4 scrollbar-none sm:mx-0 sm:px-0 lg:mt-8`.

### Card Design (Distinct, Light-Themed, Non-Growth-Corridor Style)
Unlike Growth Corridors' full-bleed dark image cards, Plots with Pulse cards are clean, bright, and luxury light-themed:
- Card surface: crisp white `bg-white` surface with rounded-2xl corners, subtle 1px border (`border-black/[0.08]`), and elevation hover lift (`hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,17,20,0.08)]`).
- Top inset image header: `h-44` landscape cover photo with zoom on hover.
  - Top-left: dark pill with uppercase status tag (`Available` or `Coming soon`).
  - Top-right: frosted glass pill with emerald ping dot and `{n} viewing now`.
- Card body:
  - Locality with gold location pin icon.
  - High-contrast property name and specification meta.
  - Guide price banner.
  - Live activity signals box (`bg-[#f8f9fb]`) showing enquiries today and visit recency.
  - Three comparison bars (Appreciation, Connectivity, Infra Growth) with smooth gold tracks.
  - Interactive "View property details" CTA button.

## 14. Click & Navigation behavior

- Each card includes a "View property details" button linking to `/properties/${plot.id}`.
- Desktop chevron arrow buttons smoothly scroll the carousel track left and right.
- Touch swiping is fully supported on mobile and tablet.

## 15. State variables

- `plots`: `PulsePlot[]` — list of properties mapped with live signals.
- `loading`: `boolean` — indicates whether initial property fetch is pending.
- `error`: `string | null` — stores network/fetch error message.
- `activeCardIndex`: `number` — zero-based index of the currently centered card, kept in sync with carousel scroll.
- `cardScroll`: `{ atStart: boolean; atEnd: boolean }` — tracks whether carousel is scrolled to edges to disable navigation buttons.

## 16. Functions

- `formatArea(property)`: formats square yards area.
- `toPlot(property, index)`: maps API property into `PulsePlot`.
- `nudgeViewing(current)`: randomly increments or decrements live viewing count.
- `scrollCards(direction)`: smoothly scrolls the horizontal card row by one card width plus gap.
- `BarRow({ label, value })`: renders a metric score bar.

## 17. Responsive breakpoints & behavior

- **Mobile (< 640px)**: Cards are sized at `82vw` snap-start items. Arrow buttons are hidden in favor of native touch swiping.
- **Tablet (640px – 1023px)**: Cards are sized at `48vw` snap-start items.
- **Desktop (≥ 1024px)**: Cards expand comfortably with `min-w-[21rem]` / `xl:min-w-[23rem]`. Desktop circular chevron arrows appear next to the active index counter.

## 18. Accessibility

- Section uses `aria-labelledby="plots-pulse-heading"`.
- Loading indicator uses `role="status"` with `.ila-loader--sm`.
- Error and empty states use semantic alert/status roles.
- Previous/next carousel buttons include descriptive `aria-label`s and `disabled` states.
- Reduced-motion preferences disable animations and smooth scroll behavior via CSS.