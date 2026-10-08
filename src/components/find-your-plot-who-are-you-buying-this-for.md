# Find your plot · Who are you buying this for?

Documentation and implementation handoff for the **Find your plot** section in the ILA Homes demo.

> The complete runnable implementation is maintained in `FindYourPlot.jsx` and `FindYourPlot.css`. This document captures the section purpose, content, matching behavior, integration, styling, assets, and verification steps while keeping those source files as the canonical code.

## Section overview

The section replaces generic property filters with a more human starting point:

> **Who are you buying this for?**

Visitors can either:

1. Choose a life-stage goal.
2. Choose one or more feelings or location preferences.

The section then presents a short list of matched layouts with a reason for each result. The featured property, **Sark Green Plains**, is always shown first when it is part of the match set. Other results currently display as **Coming soon** cards until their full property details are available.

## User-facing copy

```text
Find your plot
Who are you buying this for?
Skip the generic filters. Tell us your situation — or how you want to feel — and we'll match you with plots that actually fit.
```

Initial results state:

```text
Your matches will appear here
Select a life stage above, or pick feelings below — either path works.
```

Loading state:

```text
Finding your match
Searching plots for [your selection]…
```

## Canonical source files

| Purpose | File |
|---|---|
| React section component | [`src/components/FindYourPlot.jsx`](../src/components/FindYourPlot.jsx) |
| Section styles | [`src/components/FindYourPlot.css`](../src/components/FindYourPlot.css) |
| Layout/property data | [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js) |
| Home page integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |
| Related implementation notes | [`src/components/CHANGES.md`](../src/components/CHANGES.md) |

## React integration

### Import

```jsx
import FindYourPlot from '../components/FindYourPlot'
```

### Render

The section is rendered after the growth-corridors section on the home page:

```jsx
<GrowthCorridors />
<FindYourPlot />
<BuyingJourney />
```

The component imports its own CSS and property-layout data:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { propertyLayouts } from '../data/propertyLayouts'
import './FindYourPlot.css'
```

## Life-stage choices

The active component defines four selectable life stages in `LIFE_STAGES`.

### Starting a family

- **Description:** Looking for a safe, growing neighbourhood with schools and parks nearby.
- **Displayed count:** 12 plots matched
- **Candidate layouts:** Sark Green Plains, Nallagandla Enclave, Mansanpally Meadows, Singapore Township
- **Featured reason:** HMDA-approved Sark Green Plains at Tukkuguda — Plot 203, east facing, family-ready road and utilities.

### Investment first

- **Description:** Buying for appreciation. High-growth corridors near upcoming infrastructure.
- **Displayed count:** 8 plots matched
- **Candidate layouts:** Sark Green Plains, Kokapet Heights, Patancheru Gateway, Mansanpally Meadows
- **Featured reason:** Tukkuguda growth corridor with ORR and airport spillover — open for booking now.

### Building my home

- **Description:** Ready to build. Need a clear layout, approved plan, and builder connections.
- **Displayed count:** 17 plots matched
- **Candidate layouts:** Sark Green Plains, Singapore Township, Khajaguda Residency, Nallagandla Enclave
- **Featured reason:** Clear plot geometry, 40 ft road, sewerage and power planned — ready to start your build.

### Quiet retirement

- **Description:** Gated community, low density, peaceful surroundings outside the city noise.
- **Displayed count:** 6 plots matched
- **Candidate layouts:** Sark Green Plains, Khajaguda Residency, Mansanpally Meadows
- **Featured reason:** Plains living at Tukkuguda — quieter than the city core, still reachable via ORR.

## Feeling and preference choices

The alternative path is labelled **Tell us what you want to feel** and supports multi-select buttons:

| ID | Label |
|---|---|
| `quiet` | Away from traffic |
| `kids` | Kids can play outside |
| `temple` | Walk to a temple |
| `resale` | Good resale in 5 yrs |
| `corner` | Corner plot |
| `gated` | Gated community |
| `main-road` | Near a main road |
| `school` | School within 2km |
| `early` | No builders nearby yet |
| `weekend` | Weekend drive only |

Example JSX:

```jsx
<div
  className="find-your-plot__feel-tags"
  role="group"
  aria-label="Emotional preferences"
>
  {FEEL_TAGS.map((tag) => {
    const isOn = selectedFeels.includes(tag.id)

    return (
      <button
        key={tag.id}
        type="button"
        className={`find-your-plot__feel-tag${isOn ? ' is-selected' : ''}`}
        aria-pressed={isOn}
        onClick={() => toggleFeel(tag.id)}
      >
        {tag.label}
      </button>
    )
  })}
</div>
```

## Matching logic

### Life-stage matching

Each life stage supplies a list of layout IDs and a reason for each layout:

```js
const stageMatches = useMemo(() => {
  if (!stage) return []

  const raw = stage.matchIds
    .map((id) => {
      const layout = getLayoutById(id)
      if (!layout) return null

      return {
        ...layout,
        reason: stage.reasons[id] ?? layout.highlight,
      }
    })
    .filter(Boolean)

  return withFeaturedFirst(raw, { stage })
}, [stage])
```

### Feeling matching

For the feeling path, each layout has a score from `0` to `100` for every preference. The score for a selected set is the rounded average:

```js
function scoreFeelMatch(layoutId, selectedTags) {
  if (selectedTags.length === 0) return 0

  const scores = FEEL_SCORES[layoutId] ?? {}
  const total = selectedTags.reduce(
    (sum, id) => sum + (scores[id] ?? 0),
    0,
  )

  return Math.round(total / selectedTags.length)
}
```

The feeling results are sorted by match percentage, limited to four candidates, and then passed through the featured-first rule:

```js
const feelMatches = useMemo(() => {
  if (revealedFeels.length === 0) return []

  const raw = propertyLayouts
    .map((layout) => ({
      ...layout,
      matchPct: scoreFeelMatch(layout.id, revealedFeels),
      reason: layout.highlight,
    }))
    .sort((a, b) => {
      if (a.id === FEATURED_MATCH_ID) return -1
      if (b.id === FEATURED_MATCH_ID) return 1
      return b.matchPct - a.matchPct
    })
    .slice(0, 4)

  return withFeaturedFirst(raw, {
    feelMode: true,
    feelTags: revealedFeels,
  })
}, [revealedFeels])
```

### Featured result rule

```js
const FEATURED_MATCH_ID = 'sark-green-plains'
```

`withFeaturedFirst()` ensures:

- Sark Green Plains is first when it is available in the matching set.
- It keeps its real name, location, size, price, image, and property link.
- In feeling mode it receives a match percentage of at least `90%`.
- The remaining results are presented as `Coming soon` until more layouts are ready.

## Interaction flow

### Selecting a life stage

1. The visitor clicks one of the four stage cards.
2. The component switches to `stage` mode.
3. A `900ms` loading state is displayed.
4. Matches are revealed after the delay.
5. The selected card receives `aria-pressed="true"` and an active style.
6. Clicking the same selected card again resets the section to its idle state.

### Selecting feelings

1. The visitor toggles one or more preference tags.
2. The component switches to `feel` mode.
3. The selected stage is cleared.
4. Match percentages are calculated from the selected tags.
5. Removing the final selected tag resets the section to idle.
6. Adding or removing tags refreshes the match list after the loading delay.

### Result cards

Each result card contains:

- Numbered index (`01`, `02`, etc.)
- Layout tag or match percentage
- Property name
- Location and plot-size metadata
- A reason explaining the match
- Price range or `Adding soon`
- `View property` link for live layouts

The live property link uses React Router:

```jsx
<Link
  className="find-your-plot__match-link"
  to={`/properties/${match.id}`}
>
  View property
</Link>
```

## State model

```js
const [mode, setMode] = useState(null)
const [selectedStage, setSelectedStage] = useState(null)
const [revealedStage, setRevealedStage] = useState(null)
const [selectedFeels, setSelectedFeels] = useState([])
const [revealedFeels, setRevealedFeels] = useState([])
const [status, setStatus] = useState('idle')
const [sheetOpen, setSheetOpen] = useState(false)
```

Possible result statuses:

| Status | Meaning |
|---|---|
| `idle` | No stage or feeling has been selected. |
| `loading` | The component is simulating the matching/search step. |
| `ready` | Results have been calculated and rendered. |

## Mobile behavior

At widths of `980px` or less, the results panel becomes a bottom sheet:

- Results slide up from the bottom after a selection.
- The page body is locked while the sheet is open.
- A scrim is displayed behind the sheet.
- The sheet has a close button and drag-style visual handle.
- A `View matches` button allows the visitor to reopen closed results.
- At widths of `640px` or less, the stage cards become a single-column stack.
- Feeling tags use a horizontally scrollable compact layout on smaller screens.

The breakpoint constants are maintained in the component:

```js
const MATCH_LOAD_MS = 900
const MOBILE_SHEET_QUERY = '(max-width: 980px)'
```

## Styling

The section uses a soft charcoal standout palette:

```css
.find-your-plot {
  --fyp-ink: #f2f0ea;
  --fyp-ink-soft: #c4beb3;
  --fyp-muted: #9a9388;
  --fyp-soft: #d8d2c8;
  --fyp-line: rgba(242, 240, 234, 0.12);
  --fyp-surface: #2a2d32;
  --fyp-surface-soft: #23262b;
  --fyp-bg: #1c1f24;
  --fyp-radius: 14px;
}
```

The full stylesheet includes:

- Responsive two-column section layout.
- Life-stage card grid with custom areas for desktop.
- Gold-accented feeling tags and selected states.
- Dark gradient image-backed match cards.
- Loading animation and progress indicator.
- Result-card entrance animation.
- Mobile bottom-sheet presentation.
- Focus-visible and reduced-motion states.

Use [`src/components/FindYourPlot.css`](../src/components/FindYourPlot.css) for the complete style implementation.

## Property data and assets

The section reads from [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js). Current layout records include:

| Layout | Location | Status | Image |
|---|---|---|---|
| Sark Green Plains | Tukkuguda · Hyderabad | Open for Booking | [`hero-property.jpg`](../src/assets/about-panel/hero-property.jpg) |
| Singapore Township | Isnapur, West Hyderabad | Updating Soon | [`singapore-township.jpg`](../src/assets/about-panel/singapore-township.jpg) |
| Nallagandla Enclave | Near University of Hyderabad | Updating Soon | [`nallagandla-enclave.jpg`](../src/assets/about-panel/nallagandla-enclave.jpg) |
| Kokapet Heights | Kokapet – Financial District Belt | Updating Soon | [`kokapet-heights.jpg`](../src/assets/about-panel/kokapet-heights.jpg) |
| Khajaguda Residency | Khajaguda, Rajendra Nagar | Updating Soon | [`khajaguda-residency.webp`](../src/assets/about-panel/khajaguda-residency.webp) |
| Patancheru Gateway | Patancheru, NH-65 Corridor | Updating Soon | [`patancheru-gateway.jpg`](../src/assets/about-panel/patancheru-gateway.jpg) |
| Mansanpally Meadows | Mansanpally, Shamshabad Belt | Updating Soon | [`mansanpally-meadows.jpg`](../src/assets/about-panel/mansanpally-meadows.jpg) |

### Featured property data

Sark Green Plains is the currently active featured property:

```js
{
  id: 'sark-green-plains',
  label: 'Sark Green Plains',
  location: 'Tukkuguda · Hyderabad',
  tag: 'HMDA Approved Layout',
  plotNumber: 203,
  plots: 239,
  plotSizes: '435 sq yards',
  priceRange: '₹48,000 / sq yard · Negotiable',
  facing: 'East facing',
  road: '40 ft road facing',
  status: 'Open for Booking',
  available: true,
}
```

## Accessibility

- The section has `aria-label="Find your plot by life stage"`.
- Life-stage controls use semantic buttons and `aria-pressed`.
- Feeling controls also use `aria-pressed` and a labelled group.
- The results panel uses `aria-live="polite"` and `aria-busy` during loading.
- Decorative SVG icons are hidden from assistive technology.
- The mobile close control has an accessible label.
- Results are keyboard-operable through buttons and React Router links.

## Verification

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)` run:

```powershell
npm run lint
npm run build
```

Then check manually:

1. The section heading reads **Who are you buying this for?**
2. All four life-stage cards are visible and selectable.
3. Selecting a stage shows the loading state, then match cards.
4. Selecting the same stage again resets the section.
5. Feeling tags can be selected together and produce percentage matches.
6. Clearing all feeling tags returns the section to its idle state.
7. Sark Green Plains appears first when applicable.
8. Live results use **View property** and navigate to `/properties/{id}`.
9. Coming-soon results do not expose an active property link.
10. At mobile widths, results open in a bottom sheet and can be closed/reopened.

## Important implementation note

The match counts, feeling scores, infrastructure descriptions, prices, and approval labels are demo content maintained in the project data files. They should be reviewed and verified before being used as production property, legal, or investment claims.