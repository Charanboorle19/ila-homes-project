# Your buying journey

Documentation and implementation handoff for the homepage **Your buying journey** section in the ILA Homes demo.

> The complete runnable implementation is maintained in `BuyingJourney.jsx` and `BuyingJourney.css`. This document records the section purpose, exact step content, interaction model, responsive behavior, assets, and verification steps while keeping those source files as the canonical code.

## Section overview

The section explains the complete plot-purchase process before a visitor makes contact:

> **Your step-by-step guide to buying a plot**

Supporting copy:

```text
No hidden charges, no legal surprises — just a clear process from site visit to registration.
```

The UI has two parts:

- A left-side list of five selectable buying steps.
- A right-side detail panel containing the selected step’s illustration, timeline, summary, “What happens,” and “What you receive” information.

## Canonical source files

| Purpose | File |
|---|---|
| Homepage React section | [`src/components/BuyingJourney.jsx`](../src/components/BuyingJourney.jsx) |
| Homepage section styles | [`src/components/BuyingJourney.css`](../src/components/BuyingJourney.css) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |
| Property-detail compact journey | [`src/components/PropertyDetail/BuyingJourneySteps.jsx`](../src/components/PropertyDetail/BuyingJourneySteps.jsx) |
| Property-detail journey styles | [`src/components/PropertyDetail/BuyingJourneySteps.css`](../src/components/PropertyDetail/BuyingJourneySteps.css) |

> The property-detail journey is a separate, shorter component. This document describes the detailed homepage component imported by `HomePage.jsx`.

## Setup and prerequisites

The section is part of the existing React 19 + Vite application. No additional package is required for this component.

### Local setup

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```powershell
npm install
npm run dev
```

The application uses these package scripts:

| Script | Purpose |
|---|---|
| `npm run dev` | Starts the Vite development server with host access enabled. |
| `npm run lint` | Runs Oxlint across the project. |
| `npm run build` | Creates the Vite production build and generates the SPA fallback files. |
| `npm run preview` | Serves the production build locally. |

### Shared style dependencies

`BuyingJourney.css` expects the global variables defined in [`src/index.css`](../src/index.css):

- `--font-body` — currently Montserrat.
- `--space` — the shared responsive horizontal gutter.
- `--accent` — the site gold accent used by the active step and received-item markers.
- `--section-floor` — the mobile viewport-height floor, based on `100svh`.

The section should therefore be rendered through the normal application entry point. Mounting `BuyingJourney` in isolation requires equivalent fallback values for these variables.

## React integration

### Import

```jsx
import BuyingJourney from '../components/BuyingJourney'
```

### Render

The section appears after **Find your plot** and before **Plot compare**:

```jsx
<FindYourPlot />
<BuyingJourney />
<PlotCompare />
```

### Component imports

```jsx
import { useEffect, useRef, useState } from 'react'
import step1 from '../assets/step-1.png'
import step2 from '../assets/step-2.png'
import step3 from '../assets/step-3.png'
import step4 from '../assets/step-4.png'
import step5 from '../assets/step-5.png'
import stepLan1 from '../assets/step-lan-1.png'
import stepLan2 from '../assets/step-lan-2.png'
import stepLan3 from '../assets/step-lan-3.png'
import stepLan4 from '../assets/step-lan-4.png'
import stepLan5 from '../assets/step-lan-5.png'
import './BuyingJourney.css'
```

## Buying steps

### Step 01 — Select Your Plot & Review Feasibility

- **Timeline:** 1 to 3 Days
- **Summary:** Browse live layouts, zoning, and a fully itemized price sheet before you commit.
- **What happens:**
  - Browse live master layouts showing exact square footage, frontage width, orientation (Vastu/cardinal direction), and proximity to access roads.
  - Review baseline zoning classifications: residential, commercial, or agricultural conversion status.
  - Receive a clear price sheet with mandatory charges itemized upfront, including base land cost, infrastructure/development fees, and corner/park-facing premiums.
- **What you receive:**
  - Plot reservation worksheet
  - Master plan overlay showing the selected unit

### Step 02 — Guided On-Site Inspection & Boundary Demarcation

- **Timeline:** Day 3 to Day 7
- **Summary:** Walk the ground, verify boundaries, and confirm access, drainage, and utilities.
- **What happens:**
  - Walk the physical ground with a project representative to verify road access, soil grading, drainage, and water/electricity utility hookup points.
  - Verify physical boundary markers and corner survey stones against the layout diagram.
  - Assess neighbourhood connectivity, approach corridors, and active civic infrastructure.
- **What you receive:**
  - Site visit dossier
  - Physical plot coordinate sheet
  - Initial plot reservation token receipt upon selection

### Step 03 — Legal Due Diligence & Document Verification

- **Timeline:** 5 to 10 Business Days
- **Summary:** Full title chain, statutory approvals, and independent advocate access — no opaque files.
- **What happens:**
  - Access the complete title chain, including parent deeds dating back 30+ years, showing unencumbered ownership.
  - Inspect statutory layout sanctions, municipal/development authority approvals, and RERA registration documents.
  - Allow the buyer’s own advocate full, unhindered access to copies of original deeds and certificates for independent title verification.
- **What you receive:**
  - Encumbrance Certificate (EC) verifying zero liens, court attachments, or disputes
  - Government land-use/conversion certificate
  - Sanctioned layout approval order and certified survey sketch

### Step 04 — Transparent Agreement & Structured Payment

- **Timeline:** 7 to 14 Business Days
- **Summary:** Formal sale agreement with clear payment paths — including bank coordination if needed.
- **What happens:**
  - Execute a formal Agreement of Sale/Bilateral Contract detailing plot boundaries, agreed purchase consideration, and registration-date commitments.
  - Choose between a full down-payment or bank-financed payment schedule.
  - If financing, the team coordinates with approved panel banks for home/plot-loan disbursement.
- **What you receive:**
  - Stamped Sale Agreement copy
  - Bank pre-clearance validation
  - Official transaction receipts for all staged disbursements

### Step 05 — Sub-Registrar Office Execution & Khata/Title Mutation

- **Timeline:** 1 Day for execution + 15 to 30 Days for mutation
- **Summary:** Official registration, possession handover, and mutation of revenue records in your name.
- **What happens:**
  - Schedule an appointment at the local Sub-Registrar’s office for Sale Deed execution.
  - Pay statutory stamp duty and registration fees through a direct government challan, with no gray-market cash handling.
  - Complete biometric verification, digital photo capture, and official signing by both parties before the registrar.
  - Receive physical handover of plot possession keys/pegs and the original title bundle.
  - Follow up on mutation filing so local revenue records and municipal tax books reflect the buyer’s name.
- **What you receive:**
  - Registered Sale Deed original
  - Possession Certificate and physical handover letter
  - Updated Revenue Record/Municipal Tax Account (Khata/Patta) transfer proof

## Step data structure

The active content is stored in the `STEPS` constant. Each step follows this structure:

```js
{
  id: 'select',
  number: '01',
  name: 'Select Your Plot & Review Feasibility',
  time: '1 to 3 Days',
  image: step1,
  imageMobile: stepLan1,
  summary:
    'Browse live layouts, zoning, and a fully itemized price sheet before you commit.',
  happens: [
    'Browse live master layouts showing exact square footage, frontage width, orientation (Vastu/cardinal direction), and proximity to access roads.',
    'Review baseline zoning classifications (residential, commercial, or agricultural conversion status).',
    'Receive a clear price sheet with all mandatory charges itemized upfront.',
  ],
  receives: [
    'Plot reservation worksheet',
    'Master plan overlay showing the selected unit',
  ],
}
```

The remaining steps use the same fields and are defined in [`BuyingJourney.jsx`](../src/components/BuyingJourney.jsx).

## Interaction behavior

### Step selection

Each step is a semantic button inside an ordered list:

```jsx
<button
  type="button"
  className={`buying-journey__step${isActive ? ' is-active' : ''}`}
  aria-pressed={isActive}
  onClick={() => selectStep(step.id)}
>
  <span className="buying-journey__step-index" aria-hidden="true">
    {step.number}
  </span>
  <span className="buying-journey__step-name">{step.name}</span>
  <span className="buying-journey__step-arrow" aria-hidden="true">→</span>
</button>
```

Selecting a step:

- Changes the active step.
- Closes mobile details if they were open.
- Resets the detail-panel scroll position to the top.
- Updates the illustration, title, timeline, summary, and detail lists.
- Smoothly scrolls the selected step into view on horizontally scrollable layouts.

### Automatic step advance

The component automatically advances to the next step every `3,000ms`:

```js
const timer = window.setTimeout(() => {
  setActiveStep((prev) => {
    const index = STEPS.findIndex((step) => step.id === prev)
    return STEPS[(index + 1) % STEPS.length].id
  })
}, 3000)
```

On mobile, automatic advance pauses while the detailed “What happens”/“What you receive” content is open.

### Responsive image selection

```js
const stepImage = isMobile ? current.imageMobile : current.image
```

Desktop uses `step-1.png` through `step-5.png`. Mobile uses the corresponding `step-lan-1.png` through `step-lan-5.png` assets.

## Detail panel

The active step appears in an `aria-live="polite"` aside:

```jsx
<aside className="buying-journey__detail" aria-live="polite">
  <div className="buying-journey__detail-inner">
    <img
      className="buying-journey__media-image"
      src={stepImage}
      alt={`Illustration for step ${current.number}: ${current.name}`}
    />
    {/* title, timeline, summary, and detail panels */}
  </div>
</aside>
```

Each detail panel contains:

- **Step number**
- **Step title**
- **Typical timeline**
- **Summary**
- **What happens** list
- **What you receive** list

## Mobile behavior

The mobile breakpoint is:

```js
const MOBILE_QUERY = '(max-width: 980px)'
```

At or below this breakpoint:

- The section changes from a desktop two-column layout to a stacked layout.
- The step list becomes horizontally scrollable and the active item is scrolled into view.
- The detail image becomes a full-width responsive media block.
- The detailed lists are collapsed behind a **View about this** button.
- The button changes to **Hide details** when expanded.
- The detail panel content is not clipped by a fixed desktop height.

At widths of `640px` or less:

- The section maintains a minimum height of approximately 48rem.
- The detail media uses a `16 / 10` aspect ratio.
- Step titles and summaries are clamped to keep the initial mobile view compact.

## Styling

The section uses a light surface with a gold accent:

```css
.buying-journey {
  --bj-ink: #0f1114;
  --bj-muted: #6b7280;
  --bj-soft-text: #3d434b;
  --bj-line: rgba(15, 17, 20, 0.1);
  --bj-surface: #ffffff;
  --bj-soft: #f4f5f7;
  --bj-gold: #9a7b32;
  --bj-pad-y: clamp(2.5rem, 6vh, 4rem);
  --bj-detail-height: clamp(34rem, 72vh, 42rem);
}
```

The full stylesheet implements:

- Desktop two-column frame.
- Step list card, hover, and active states.
- Gold step index and arrows.
- Fixed-height desktop detail panel.
- Responsive portrait illustration area.
- “What happens” and “What you receive” panels.
- Mobile horizontal step navigation.
- Mobile details disclosure button.
- Motion transitions for selection, detail changes, and horizontal navigation. Global reduced-motion rules are provided by [`src/index.css`](../src/index.css); the buying-journey stylesheet does not define its own `prefers-reduced-motion` block.

Use [`src/components/BuyingJourney.css`](../src/components/BuyingJourney.css) for the complete style implementation.

## Assets

| Step | Desktop image | Mobile image |
|---|---|---|
| 01 | [`src/assets/step-1.png`](../src/assets/step-1.png) | [`src/assets/step-lan-1.png`](../src/assets/step-lan-1.png) |
| 02 | [`src/assets/step-2.png`](../src/assets/step-2.png) | [`src/assets/step-lan-2.png`](../src/assets/step-lan-2.png) |
| 03 | [`src/assets/step-3.png`](../src/assets/step-3.png) | [`src/assets/step-lan-3.png`](../src/assets/step-lan-3.png) |
| 04 | [`src/assets/step-4.png`](../src/assets/step-4.png) | [`src/assets/step-lan-4.png`](../src/assets/step-lan-4.png) |
| 05 | [`src/assets/step-5.png`](../src/assets/step-5.png) | [`src/assets/step-lan-5.png`](../src/assets/step-lan-5.png) |

## Accessibility

- The outer section has `aria-label="Your buying journey"`.
- Steps are contained in an ordered list with `aria-label="Buying steps"`.
- Each step is a semantic button with `aria-pressed` state.
- The active detail panel uses `aria-live="polite"`.
- Illustration alt text includes the step number and title.
- The mobile details control exposes its state through `aria-expanded`.
- Decorative arrows and step indexes are hidden from assistive technology where appropriate.
- Keyboard users can select steps without relying on hover behavior.

The section does not currently expose a pause control for the three-second auto-advance. The automatic timer is paused while mobile details are open; consider adding an explicit pause or disabling auto-advance if this becomes a production accessibility requirement.

## Verification

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)` run:

```powershell
npm run lint
npm run build
```

Then check manually:

1. The section heading reads **Your step-by-step guide to buying a plot**.
2. All five steps are visible and selectable.
3. Selecting a step updates the illustration, timeline, summary, and lists.
4. The active step receives the active visual state and `aria-pressed="true"`.
5. The section auto-advances every three seconds.
6. Auto-advance pauses when mobile details are open.
7. Desktop and mobile image assets switch at the `980px` breakpoint.
8. Mobile details open with **View about this** and close with **Hide details**.
9. The step list scrolls the active item into view on mobile.
10. The legal, payment, registration, and document-receipt copy is displayed correctly.

## Important implementation note

The timelines, approval references, legal-document descriptions, bank-coordination statements, fees, and registration/mutation workflow are demo/product copy. They should be reviewed by qualified legal and property professionals before production publication or use as contractual guidance.