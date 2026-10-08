# Plots with pulse

This document describes the homepage **Plots with pulse** section. The section presents featured property layouts with demo activity indicators and comparison-style scores for appreciation, connectivity, and infrastructure growth.

## Purpose

The section is designed as a social-proof and comparison panel. Its messaging is:

```text
Plots with pulse
See what others are looking at and where the momentum is building.
```

It shows activity-style signals such as people viewing a layout, enquiries today, and the last visit time. These values are explicitly labelled as provisional demo estimates in the UI. They are not live analytics, booking data, market data, or guaranteed investment indicators.

## Source and homepage placement

| Responsibility | Source |
| --- | --- |
| React component, plot list, pulse values, and update timer | [`src/components/PlotsWithPulse.jsx`](../src/components/PlotsWithPulse.jsx) |
| Section styling and responsive rules | [`src/components/PlotsWithPulse.css`](../src/components/PlotsWithPulse.css) |
| Shared property layout records | [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |

`HomePage` renders the section after **From the field** and before `TrustStrip`:

```jsx
<FromTheField />
<PlotsWithPulse />
<TrustStrip />
```

The component imports its own stylesheet and does not require a separate route, API, environment variable, map token, or backend service.

## Featured layouts

The component displays four records in this order:

1. `sark-green-plains`
2. `kokapet-heights`
3. `nallagandla-enclave`
4. `mansanpally-meadows`

The layout name, location, plot sizes, tag, and price source come from `propertyLayouts.js`. Pulse values come from the local `PULSE_SEED` object in `PlotsWithPulse.jsx`.

| Layout | Display state | Seed badge | Initial viewing | Enquiries today | Last visited |
| --- | --- | --- | ---: | ---: | ---: |
| Sark Green Plains | Available | Open | 5 | 2 | 11 min ago |
| Kokapet Heights | Coming soon | Hot | 6 | 2 | 14 min ago |
| Nallagandla Enclave | Coming soon | New | 2 | 1 | 8 min ago |
| Mansanpally Meadows | Coming soon | Best Value | 4 | 3 | 21 min ago |

Only Sark Green Plains has `available: true`. The other three records are intentionally presented as unavailable and use “Coming soon”, “Soon”, “Adding soon”, and “Details coming soon” copy instead of their layout details.

## Card content

Each plot card contains:

- A local background image.
- A short image label containing the layout name and location for available plots.
- A status badge such as `Open`, or `Soon` for unavailable plots.
- A live-style viewing indicator such as `5 viewing now` for the available plot.
- The layout name.
- Metadata containing the plot-size range and layout tag.
- A displayed price value.
- For the available plot, an activity list:
  - People viewing now.
  - Enquiries today.
  - Last visited time.
- Three horizontal score bars:
  - Appreciation.
  - Connectivity.
  - Infra Growth.

Unavailable cards instead show the message:

```text
Layout pulse data is being updated. Check back soon.
```

The cards are informational `<article>` elements, not links or buttons. There is currently no card-click action or property-detail navigation from this section.

## Seeded pulse values

The initial local values are:

| Layout | Appreciation | Connectivity | Infra Growth | Available |
| --- | ---: | ---: | ---: | :---: |
| Sark Green Plains | 84% | 76% | 81% | Yes |
| Kokapet Heights | 91% | 88% | 86% | No |
| Nallagandla Enclave | 82% | 79% | 74% | No |
| Mansanpally Meadows | 79% | 71% | 84% | No |

The score bars use inline widths based on their percentage values. Although scores are present in the local seed data for all four records, only available cards render the score bars in the current JSX. Therefore, only Sark Green Plains currently displays the percentage bars to the visitor.

## Runtime update behavior

When the component mounts, it creates a `window.setInterval` that runs every `4.5` seconds. On each tick:

- Unavailable cards are returned unchanged.
- Sark Green Plains’ `viewing` value is randomly nudged by either `+1` or `-1`.
- Viewing is clamped between `1` and `12`.
- `lastVisitedMin` sometimes increases by one minute.
- Last-visited time is clamped at `59` minutes.

The interval is cleared when the component unmounts. The update uses `Math.random()`, so the activity values are simulated and are not deterministic across page loads.

## Data construction

`buildPlots()` combines each featured ID with two local data sources:

1. The matching `propertyLayouts` record supplies layout metadata and availability.
2. The matching `PULSE_SEED` record supplies badge, activity, score, and availability values.

For available records:

- The display name comes from `layout.label`.
- The location comes from `layout.location`.
- Metadata is formed from `layout.plotSizes` and `layout.tag`.
- The displayed price uses the first part of `layout.priceRange` before an en dash when available.
- Status comes from `layout.status`.

For unavailable records, the component intentionally replaces these values with coming-soon copy.

For Sark Green Plains, the current source data produces:

- Name: `Sark Green Plains`
- Location: `Tukkuguda · Hyderabad`
- Metadata: `435 sq yards · HMDA Approved Layout`
- Displayed price: `₹48,000 / sq yard`
- Status source: `Open for Booking`

## Visual design

The section uses a light neutral background with subtle green and gold radial accents:

- Background: approximately `#f7f8fa`.
- Cards: white with a light border and small hover shadow.
- Gold is used for labels, prices, score fills, and accent details.
- Green is used for the animated viewing indicator.
- Available plot imagery uses a fixed image area of approximately `9.5rem` on larger screens.
- The image has a dark gradient overlay so the location text and activity badge remain readable.
- Unavailable cards use grayscale, reduced opacity, and disabled pointer events.

## Responsive behavior

### Larger screens

The cards use a responsive grid with `minmax(220px, 1fr)` columns. At medium desktop widths between `901px` and `1100px`, the minimum card width is reduced to `200px` and the gap is tightened.

### Tablet and mobile widths

At `900px` and below:

- The section prevents horizontal overflow at the page level.
- The card grid becomes a horizontally scrollable row.
- Cards use scroll snapping.
- The scrollbar remains available in a thin styled form.
- Cards have a width between `15rem` and `17.5rem` depending on the viewport.
- The image area is reduced to approximately `8.25rem`.

At `640px` and below, cards use a smaller width between `14.5rem` and `16rem`.

## Accessibility

Current accessibility treatment includes:

- A semantic `<section>` labelled by the main heading using `aria-labelledby`.
- Each plot is represented by an `<article>`.
- Decorative card images use empty `alt` attributes because the adjacent text supplies the content.
- The section’s updating notice uses `role="status"`.
- Available and unavailable states are visible through text, styling, and the card’s `aria-disabled` value.

The score bars are currently visual indicators and do not expose an explicit progress-bar role or value attributes. If these values become important to assistive-technology users, they should be enhanced with accessible names and numeric values. Likewise, the changing viewing count is not separately announced through a live region.

## Assets

The component uses these local images:

| Layout | Asset |
| --- | --- |
| Sark Green Plains | [`src/assets/about-panel/hero-property.jpg`](../src/assets/about-panel/hero-property.jpg) |
| Kokapet Heights | [`src/assets/plots-pulse/kokapet.jpg`](../src/assets/plots-pulse/kokapet.jpg) |
| Nallagandla Enclave | [`src/assets/plots-pulse/nallagandla.jpg`](../src/assets/plots-pulse/nallagandla.jpg) |
| Mansanpally Meadows | [`src/assets/plots-pulse/mansanpally.jpg`](../src/assets/plots-pulse/mansanpally.jpg) |

The assets are imported through Vite rather than referenced with hard-coded public URLs. Keep the filenames synchronized with the imports in `PlotsWithPulse.jsx`.

## Current limitations

This section is a static frontend demonstration with simulated activity:

- Viewing numbers, enquiries, last-visited times, and scores are local demo values.
- The runtime updates use random numbers and do not represent actual user activity.
- Only Sark Green Plains is active; the other three featured layouts are not yet available in this card.
- Cards do not currently link to property detail pages.
- No inventory, enquiry, analytics, market-data, or CRM service is connected.
- The appreciation, connectivity, and infrastructure percentages have no documented calculation or external source in the component.
- “Momentum” language should not be interpreted as a financial prediction or investment recommendation.
- The section explicitly warns that activity numbers are not accurate live data.

For production, activity metrics should come from reviewed analytics or inventory services, score definitions should be documented, unavailable cards should link to an approved waitlist or detail experience, and any changing data should be presented with appropriate consent and privacy considerations.

## Verification checklist

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```bash
npm run build
```

Manual checks:

1. Confirm the section appears after **From the field** and before the trust strip.
2. Confirm the heading, description, and provisional-data notice are visible.
3. Confirm four cards render in the featured order.
4. Confirm Sark Green Plains shows its layout metadata, price, activity list, and score bars.
5. Confirm the other three cards show their coming-soon state and are visually disabled.
6. Leave the page open for more than 4.5 seconds and confirm the available card’s viewing/last-visited values can update.
7. Confirm the activity values remain within the documented bounds.
8. Test the desktop grid and mobile horizontal scroller.
9. Verify all card images load and the section does not introduce page-level horizontal overflow.
