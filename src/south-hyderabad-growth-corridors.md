# South Hyderabad · Growth corridors

Documentation and implementation handoff for the **South Hyderabad · Growth corridors** section in the ILA Homes demo.

> The complete, runnable source is already present in the project. This document records the section contract, content, integration, styling, assets, and verification steps. The source links below point to the canonical files so the documentation does not drift from the implementation.

## Section overview

The section lets visitors:

- Browse five South Hyderabad growth corridors as image-backed cards.
- Select a corridor to reveal its description, infrastructure highlights, and stats.
- Open an interactive Mapbox view focused on the selected corridor.
- View the selected corridor on a map from both desktop and mobile layouts.
- Use a responsive card layout with mobile-specific map controls and reduced-motion support.

### User-facing copy

```text
South Hyderabad · Growth corridors
Explore locations shaping the next phase of Hyderabad
Navigate Hyderabad's southern growth corridors and discover verified opportunities — designed for clarity, not clutter.
```

## Canonical source files

| Purpose | File |
|---|---|
| React section component | [`src/components/GrowthCorridors.jsx`](../src/components/GrowthCorridors.jsx) |
| Section styles | [`src/components/GrowthCorridors.css`](../src/components/GrowthCorridors.css) |
| Map locations and camera defaults | [`src/data/locations.js`](../src/data/locations.js) |
| Change notes | [`src/components/CHANGES.md`](../src/components/CHANGES.md) |
| Standalone accordion prototype | [`src/components/growth_corridors_accordion.html`](../src/components/growth_corridors_accordion.html) |

## Corridor content

The active React component defines the content in its `CORRIDOR_CONTENT` constant.

### 1. South Hyderabad

- **Tag:** Growth epicentre
- **Status:** Adding soon
- **Description:** The next Gachibowli. ORR and airport corridor infrastructure is already in place. The window to buy before prices reflect it is narrowing fast.
- **Stats:** `28 min` — To airport via ORR; `Rising` — Demand index
- **Badge:** 28 min to airport
- **Map tag:** Growth epicentre · ORR corridor
- **Infrastructure:**
  - Metro expansion — Narsingi corridor — Govt. approved
  - ORR Phase 3 expansion — Under construction
  - TSREIS School — 800m from plots — Planned 2026

### 2. Maheshwaram

- **Tag:** ORR · Srisailam highway
- **Status:** Adding soon
- **Map asset:** `src/assets/Maheshwaram.png`

### 3. Thukkuguda

- **Tag:** ORR Exit 14 · Airport corridor
- **Status:** Available / active corridor
- **Map asset:** `src/assets/Thukkuguda.png`

### 4. Mansanpally

- **Tag:** Quiet growth belt
- **Status:** Adding soon
- **Map asset:** `src/assets/Mansanpally.png`

### 5. Future City

- **Tag:** Long-horizon planning zone
- **Status:** Adding soon
- **Map asset:** `src/assets/Future City.png`

> The exact description, infrastructure entries, stats, badges, and availability flags for every corridor are maintained in `CORRIDOR_CONTENT` in [`GrowthCorridors.jsx`](../src/components/GrowthCorridors.jsx). Keep that constant as the content source of truth.

## React implementation

### Import the section

```jsx
import GrowthCorridors from './components/GrowthCorridors'
```

### Render the section

```jsx
<GrowthCorridors />
```

The component imports its own stylesheet and image assets, so no additional CSS import is required at the page level.

### Core dependencies

```jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import {
  mapLocations,
  mapReferencePoints,
  SOUTH_HYDERABAD_VIEW,
} from '../data/locations'
import southImage from '../assets/south-image.png'
import maheshwaramImage from '../assets/Maheshwaram.png'
import thukkugudaImage from '../assets/Thukkuguda.png'
import mansanpallyImage from '../assets/Mansanpally.png'
import futureCityImage from '../assets/Future City.png'
import './GrowthCorridors.css'
```

### Map configuration

```jsx
const MAPBOX_TOKEN = import.meta.env.MAPBOX_ACCESS_TOKEN
const HAS_MAPBOX_TOKEN =
  Boolean(MAPBOX_TOKEN) && MAPBOX_TOKEN !== 'YOUR_MAPBOX_PUBLIC_TOKEN'
const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'
const MOBILE_MAP_QUERY = '(max-width: 720px)'
```

The project exposes `MAPBOX_ACCESS_TOKEN` through Vite. Add the token to the root `.env.local` file and restart the Vite server after changing it:

```env
MAPBOX_ACCESS_TOKEN=your_mapbox_public_token
```

If no usable token is present, the component uses its token-absent fallback state instead of attempting to initialize Mapbox with a placeholder token.

## Map data

The map data is intentionally marked as approximate/demo-only in the source.

```js
export const mapLocations = [
  {
    id: 'south-hyderabad',
    name: 'South Hyderabad',
    description:
      'A major growth corridor shaped by connectivity, infrastructure and emerging development.',
    coordinates: [78.44, 17.25],
    zoom: 11.2,
    demoNote: 'Approximate corridor focus',
  },
  {
    id: 'maheshwaram',
    name: 'Maheshwaram',
    description:
      'A developing southern belt with improving access and interest in plotted opportunities.',
    coordinates: [78.43, 17.14],
    zoom: 12.2,
    demoNote: 'Approximate area focus',
  },
  {
    id: 'thukkuguda',
    name: 'Thukkuguda',
    description:
      'Infrastructure-led growth near key transit and employment routes south of the city.',
    coordinates: [78.46, 17.27],
    zoom: 12.4,
    demoNote: 'Approximate area focus',
  },
  {
    id: 'mansanpally',
    name: 'Mansanpally',
    description:
      'An emerging pocket within the wider Maheshwaram growth belt.',
    coordinates: [78.4, 17.155],
    zoom: 12.5,
    demoNote: 'Approximate area focus',
  },
  {
    id: 'future-city',
    name: 'Future City',
    description:
      'A long-horizon planning zone tied to the next phase of Hyderabad’s southern expansion.',
    coordinates: [78.38, 17.19],
    zoom: 11.8,
    demoNote: 'Approximate area focus',
  },
]

export const SOUTH_HYDERABAD_VIEW = {
  longitude: 78.44,
  latitude: 17.24,
  zoom: 11.35,
  pitch: 0,
  bearing: 0,
}
```

The full map data, reference labels, and default Hyderabad view are in [`src/data/locations.js`](../src/data/locations.js).

## Styling

The section uses a light mist palette and the existing project typography variables:

```css
.growth-corridors.section {
  --gc-bg: #e8eaef;
  --gc-surface: #eef0f4;
  --gc-surface-soft: #e4e7ed;
  --gc-surface-lift: #f3f4f7;
  --gc-ink: #0f1114;
  --gc-fog: #4a5060;
  --gc-muted: #8a909e;
  --gc-line: rgba(15, 17, 20, 0.08);
  --gc-gold: #c9a84c;
  --gc-gold-dark: #a6862e;
}
```

The complete stylesheet includes:

- Browse mode and full-height map mode.
- Five-column desktop picker with image overlays.
- Responsive card and spotlight layouts.
- Mobile map interaction rules.
- Focus, hover, active, and disabled states.
- `prefers-reduced-motion` handling.

Use [`src/components/GrowthCorridors.css`](../src/components/GrowthCorridors.css) for the complete style implementation.

## Responsive behavior

| Viewport | Behavior |
|---|---|
| Desktop | “View on map” appears on the card image beside the corridor name. The map uses a two-column layout. |
| Mobile | The map CTA appears in the card footer. The map disables one-finger page-blocking gestures and allows two-finger pinch zoom. |
| Up to 560px | The header map CTA is hidden; each card retains its own map action. |
| Reduced motion | Transitions and animations are disabled. |

## Accessibility behavior

- The outer section has `aria-label="Hyderabad growth corridors"`.
- Interactive controls use semantic `button` elements.
- Map mode uses `aria-live="polite"` for the selected corridor spotlight.
- Images use empty alt text when decorative; corridor names are provided by adjacent text.
- The component includes keyboard and focus states in the stylesheet.
- Motion-sensitive users are supported with `prefers-reduced-motion` styles.

## Assets

| Corridor | Asset |
|---|---|
| South Hyderabad | [`src/assets/south-image.png`](../src/assets/south-image.png) |
| Maheshwaram | [`src/assets/Maheshwaram.png`](../src/assets/Maheshwaram.png) |
| Thukkuguda | [`src/assets/Thukkuguda.png`](../src/assets/Thukkuguda.png) |
| Mansanpally | [`src/assets/Mansanpally.png`](../src/assets/Mansanpally.png) |
| Future City | [`src/assets/Future%20City.png`](../src/assets/Future%20City.png) |

## Verification

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)` run:

```powershell
npm run lint
npm run build
```

Then check manually:

1. The section heading reads **South Hyderabad · Growth corridors**.
2. All five image cards render.
3. Selecting a card updates the spotlight content.
4. “View on map” switches to the selected corridor.
5. Mobile cards place “View on map” below the image.
6. The app still renders a useful fallback when `MAPBOX_ACCESS_TOKEN` is unavailable.

## Important implementation note

Coordinates and infrastructure descriptions are prototype/demo content. They should be reviewed and verified before production publication or use in investment-related claims.