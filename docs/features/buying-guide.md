# Buying Guide feature

This document describes the current homepage Buying Guide implementation only. In source, the feature is named `BuyingJourney`; “Buying Guide” refers to the same homepage section. The separate Property Details component `BuyingJourneySteps` is documented only where its relationship to this feature is relevant.

## 1. Feature purpose

The feature explains the plot-purchase process from selecting a plot through site inspection, legal verification, agreement/payment, and registration or mutation. It is explanatory UI. The component does not itself select inventory, submit an enquiry, accept payment, perform legal verification, or initiate registration.

## 2. Where it appears

The feature appears on the homepage route `/` as the `BuyingJourney` section. It is not a separate confirmed route or API-backed catalogue.

## 3. Homepage position

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` renders the relevant homepage sequence as:

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

Therefore, the Buying Guide appears immediately after Find Your Plot and before Shortlist Share.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\BuyingJourney.tsx` — homepage component, static step data, state, hooks, interaction logic, and markup.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\BuyingJourney.css` — homepage Buying Journey styles, responsive layouts, transitions, and CSS classes.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage import and render position.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-1.png` through `step-5.png` — desktop step images.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-lan-1.png` through `step-lan-5.png` — mobile step images.

The older handoff file `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\your-buying-journey.md` references a previous JSX/Vite layout and paths; the current canonical implementation is the TypeScript/Next.js source listed above.

## 5. Component names

The homepage component is the default export `BuyingJourney` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\BuyingJourney.tsx`.

The source also defines the internal `StepId` and `Step` types and the `STEPS` constant. `BuyingJourneySteps` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\BuyingJourneySteps.tsx` is a separate Property Details component, not this homepage feature.

## 6. Props

`BuyingJourney` accepts no props:

```tsx
export default function BuyingJourney()
```

All content and interaction state are internal.

## 7. Visible content

The section root has:

- Kicker/eyebrow: `Your buying journey`
- Heading: `Your step-by-step guide to buying a plot`
- Supporting copy: `No hidden charges, no legal surprises — just a clear process from site visit to registration.`

For the active step, the detail view displays the step number, title, `Typical timeline · {time}`, a summary, an illustration, a `What happens` list, and a `What you receive` list on desktop. The mobile view displays the step number, title, timeline, illustration, summary, and three highlights.

## 8. Step structure

There are exactly five steps in the static `STEPS` array. Desktop uses a left selectable ordered list and a right detail panel. Mobile uses a horizontal five-node timeline, active-step content, and previous/next controls.

## 9. Step data

Each step has `id`, `number`, `name`, `time`, `image`, `imageMobile`, `summary`, `happens`, `receives`, and exactly three `highlights`.

### Step 01 — `select`

- **Title:** `Select Your Plot & Review Feasibility`
- **Time:** `1 to 3 Days`
- **Summary:** `Browse live layouts, zoning, and a fully itemized price sheet before you commit.`
- **What happens:**
  - Browse live master layouts showing exact square footage, frontage width, orientation (Vastu/cardinal direction), and proximity to access roads.
  - Review baseline zoning classifications (residential, commercial, or agricultural conversion status).
  - Receive a clear price sheet with all mandatory charges itemized upfront (base land cost, infrastructure/development fees, corner/park-facing premiums).
- **What you receive:** `Plot reservation worksheet`; `Master plan overlay showing the selected unit`.
- **Highlights:** `Browse live layouts`; `Review zoning status`; `Itemized price sheet`.
- **Images:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-1.png`, `step-lan-1.png`.

### Step 02 — `inspect`

- **Title:** `Guided On-Site Inspection & Boundary Demarcation`
- **Time:** `Day 3 to Day 7`
- **Summary:** `Walk the ground, verify boundaries, and confirm access, drainage, and utilities.`
- **What happens:**
  - Walk the physical ground with a project representative to verify road access, soil grading, drainage, and utility hookup points (water, electricity).
  - Verify physical boundary markers and corner survey stones against the layout diagram.
  - Assess neighborhood connectivity, approach corridors, and active civic infrastructure.
- **What you receive:** `Site visit dossier`; `Physical plot coordinate sheet`; `Initial plot reservation token receipt upon selection`.
- **Highlights:** `Verify boundaries`; `Check access, drainage & utilities`; `Confirm plot details`.
- **Images:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-2.png`, `step-lan-2.png`.

### Step 03 — `legal`

- **Title:** `Legal Due Diligence & Document Verification`
- **Time:** `5 to 10 Business Days`
- **Summary:** `Full title chain, statutory approvals, and independent advocate access — no opaque files.`
- **What happens:**
  - Access the complete title chain (parent deeds dating back 30+ years) showing unencumbered ownership.
  - Inspect statutory layout sanctions, municipal/development authority approvals, and RERA registration documents.
  - Independent legal verification: your own advocate receives full, unhindered access to copies of original deeds and certificates to verify title clearance.
- **What you receive:** `Encumbrance Certificate (EC) verifying zero liens, court attachments, or disputes`; `Government land use / conversion certificate`; `Sanctioned layout approval order and certified survey sketch`.
- **Highlights:** `Title chain review`; `Statutory approvals`; `Advocate access`.
- **Images:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-3.png`, `step-lan-3.png`.

### Step 04 — `agreement`

- **Title:** `Transparent Agreement & Structured Payment`
- **Time:** `7 to 14 Business Days`
- **Summary:** `Formal sale agreement with clear payment paths — including bank coordination if needed.`
- **What happens:**
  - Execute a formal Agreement of Sale (Bilateral Contract) detailing plot boundaries, agreed-upon purchase consideration, and registration date commitments.
  - Choose between full down-payment or bank-financed payment schedules.
  - If financing, the team coordinates directly with approved panel banks for home/plot loan disbursements.
- **What you receive:** `Stamped Sale Agreement copy`; `Bank pre-clearance validation`; `Official transaction receipts for all staged disbursements`.
- **Highlights:** `Sale agreement`; `Payment schedule`; `Bank coordination`.
- **Images:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-4.png`, `step-lan-4.png`.

### Step 05 — `register`

- **Title:** `Sub-Registrar Office Execution & Khata/Title Mutation`
- **Time:** `1 Day (Execution) + 15 to 30 Days (Mutation)`
- **Summary:** `Official registration, possession handover, and mutation of revenue records in your name.`
- **What happens:**
  - Schedule an appointment at the local Sub-Registrar’s office for Sale Deed execution.
  - Pay statutory stamp duty and registration fees via direct government challan—no gray-market cash handling.
  - Biometric verification, digital photo capture, and official signing by both parties in front of the registrar.
  - Physical handover of plot possession keys/pegs and original title bundle.
  - Follow-up mutation filing with local revenue records to reflect your name in municipal tax books.
- **What you receive:** `Registered Sale Deed original`; `Possession Certificate and physical handover letter`; `Updated Revenue Record / Municipal Tax Account (Khata/Patta) transfer proof`.
- **Highlights:** `Sale deed execution`; `Possession handover`; `Khata / title mutation`.
- **Images:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\step-5.png`, `step-lan-5.png`.

## 10. User interaction

Users can activate any step using its native `<button>`. Selecting a step changes the active step, illustration, timeline, summary, and associated detail content. On mobile, users can also activate `Previous step` and `Next step` buttons. The active step automatically advances every 3000 ms and wraps from step 05 back to step 01.

## 11. Selection/active state

The active state is `activeStep`, initialized to `STEPS[0].id` (`select`). Desktop active buttons receive `buying-journey__step is-active`. Mobile nodes receive `bj-m__node is-active`; steps before the active index also receive `is-done`, and completed timeline lines receive `bj-m__timeline-line is-filled`. Active buttons expose `aria-pressed="true"`; inactive buttons expose `aria-pressed="false"`.

## 12. Navigation behavior

Desktop navigation is step selection from the vertical list. Mobile navigation is step-node selection plus `goPrev` and `goNext`; both wrap cyclically. The mobile active node shows a three-second SVG progress ring. The desktop list is horizontally scrolled with smooth behavior when the active step changes, although its normal layout is vertical.

## 13. Links/CTAs

The feature contains no `<Link>`, anchor, external URL, route target, enquiry CTA, property-detail CTA, or payment CTA. Its interactive elements are step-selection and mobile previous/next buttons only.

## 14. State variables

The component declares:

- `isMobile` — boolean responsive-layout state, initially `false`.
- `activeStep` — `StepId` state, initially `STEPS[0].id`.

It also declares refs:

- `copyRef` — detail-copy scroll container ref.
- `stepsRef` — desktop steps ordered-list ref.
- `stepItemRefs` — partial map of `StepId` to desktop step `<li>` refs.

## 15. Derived values

- `current` — `STEPS.find((step) => step.id === activeStep) ?? STEPS[0]`.
- `activeIndex` — index of `activeStep` in `STEPS`.
- `stepImage` — `current.imageMobile` when `isMobile` is true, otherwise `current.image`.
- `STEP_TOTAL` — padded string representation of `STEPS.length`, currently `05`.
- `STEP_HOLD_MS` — `3000`.
- `MOBILE_QUERY` — `(max-width: 980px)`.

## 16. Functions

- `sync` — updates `isMobile` from the `matchMedia` result.
- `selectStep(id: StepId)` — sets `activeStep`.
- `goPrev()` — selects the preceding step, wrapping from step 01 to step 05.
- `goNext()` — selects the following step, wrapping from step 05 to step 01.
- The auto-advance timeout callback finds the current index and selects the next step with modulo wrapping.

## 17. Hooks

The component imports and uses React `useState`, `useRef`, and `useEffect`.

- The first `useEffect` subscribes to `window.matchMedia(MOBILE_QUERY)` changes and removes the listener on cleanup.
- The second resets the detail-copy scroll position to `0` whenever `activeStep` changes.
- The third centers the active desktop step in its list with `scrollTo({ behavior: "smooth" })` when appropriate.
- The fourth creates and cleans up the 3000 ms auto-advance timeout whenever `activeStep` changes.

## 18. Loading behavior

There is no asynchronous data loading state. Images are rendered through Next.js `Image`, with the first (`select`) image marked `priority`. Any image loading behavior supplied by Next.js is not a Buying Guide state. A separate feature loading indicator is UNKNOWN — needs verification.

## 19. Error behavior

The component has no API request, error state, error boundary, retry function, or error message. Image/network failure presentation is handled outside the component and is UNKNOWN — needs verification.

## 20. Empty-state behavior

There is no empty-state branch. The static `STEPS` array is populated with five records. Behavior if the array were empty is UNKNOWN — needs verification.

## 21. Reset behavior

There is no user-facing reset button. Selecting a step changes the active state; the auto-advance timer is recreated for the selected step. Remounting the component initializes `activeStep` to step 01. The detail-copy scroll position resets to the top after active-step changes.

## 22. Analytics

`BuyingJourney.tsx` contains no `data-track` attributes, analytics event names, `trackEvent` call, or analytics hook. Selecting steps and using previous/next controls therefore have no feature-specific analytics behavior confirmed in this component. Global section/dwell analytics, if any, are outside the directly related component and are UNKNOWN — needs verification.

## 23. Relationship with Find Your Plot

`FindYourPlot` is rendered immediately before `BuyingJourney` on `/`. Find Your Plot recommends static property layouts; BuyingJourney explains a general purchase process. BuyingJourney does not read Find Your Plot state, props, results, or selection, and no direct callback or link connects the two components.

## 24. Relationship with Property Details

The homepage BuyingJourney does not import or render Property Details components and has no property id prop. Property Details has a separate `BuyingJourneySteps` component with five different compact step records (`Enquire`, `Site Visit`, `Legal Verification`, `Book & Pay`, and `Registration`). The two components are not connected by state or navigation in the inspected source.

## 25. Relationship with Property Enquiry

The homepage BuyingJourney has no enquiry form, enquiry handler, enquiry route, enquiry link, WhatsApp link, mailto link, or enquiry analytics attribute. Its copy mentions the buying process but does not submit or initiate an enquiry. Any relationship to Property Enquiry is UNKNOWN — needs verification beyond this component.

## 26. Desktop behavior

Above the mobile breakpoint, the component renders `.buying-journey__desktop`: a two-column frame with the introductory copy and selectable step list on the left, and a fixed-height detail area on the right. The detail area contains the desktop image beside scrollable copy panels for `What happens` and `What you receive`.

## 27. Mobile behavior

At or below 980 px, the desktop layout is hidden and `.buying-journey__mobile` is displayed. The layout uses the five-node horizontal timeline, active-step content, mobile image, summary, three highlight pills, and previous/next controls. Mobile uses `step-lan-1.png` through `step-lan-5.png`. The active node displays a three-second progress ring; the component does not expose a pause control.

## 28. Responsive breakpoints

- `@media (max-width: 1100px)` changes the desktop detail-inner grid columns and gap.
- `@media (max-width: 980px)` hides `.buying-journey__desktop`, displays `.buying-journey__mobile`, and applies mobile styles. This matches `MOBILE_QUERY = "(max-width: 980px)"`.
- `@media (max-width: 640px)` applies additional mobile sizing rules.
- `@media (prefers-reduced-motion: reduce)` disables or shortens the component’s transitions/animations as defined in the stylesheet.

## 29. CSS/classes

The root and primary desktop classes are `buying-journey`, `buying-journey__atmosphere`, `buying-journey__blob`, `buying-journey__blob--a` through `buying-journey__blob--e`, `buying-journey__frame`, `buying-journey__desktop`, `buying-journey__mobile`, `buying-journey__left`, `buying-journey__intro`, `buying-journey__eyebrow`, `buying-journey__heading`, `buying-journey__lede`, `buying-journey__steps`, `buying-journey__step`, `buying-journey__step-index`, `buying-journey__step-name`, `buying-journey__step-arrow`, `buying-journey__detail`, `buying-journey__detail-inner`, `buying-journey__media`, `buying-journey__media-frame`, `buying-journey__media-image`, `buying-journey__copy`, `buying-journey__detail-head`, `buying-journey__detail-kicker`, `buying-journey__detail-title`, `buying-journey__detail-time`, `buying-journey__detail-summary`, `buying-journey__panels`, `buying-journey__panel`, `buying-journey__panel--receive`, `buying-journey__panel-title`, `buying-journey__list`, and `buying-journey__list--receive`.

Mobile-specific classes include `bj-m__intro`, `bj-m__eyebrow`, `bj-m__heading`, `bj-m__lede`, `bj-m__timeline`, `bj-m__timeline-item`, `bj-m__timeline-line`, `bj-m__node`, `bj-m__node-label`, `bj-m__node-progress`, `bj-m__node-progress-track`, `bj-m__node-progress-bar`, `bj-m__content`, `bj-m__step-kicker`, `bj-m__step-title`, `bj-m__step-time`, `bj-m__media`, `bj-m__media-image`, `bj-m__summary`, `bj-m__highlights`, `bj-m__highlight`, `bj-m__nav`, `bj-m__nav-btn`, and `bj-m__nav-count`. State modifier classes include `is-active`, `is-done`, and `is-filled`.

## 30. Accessibility

- The root section uses `aria-label="Your buying journey"`.
- Desktop and mobile step lists use ordered lists with `aria-label="Buying steps"`.
- Steps and mobile navigation are native buttons and therefore keyboard activatable.
- Step buttons use `aria-pressed` to expose active state.
- Mobile step nodes use labels such as `Step 01: Select Your Plot & Review Feasibility`.
- Desktop detail content and mobile content use `aria-live="polite"`.
- Step images use alt text in the form `Illustration for step {number}: {name}`.
- Decorative atmosphere, arrows, indexes, progress SVG, and timeline lines are hidden from assistive technology where specified.
- The component has no pause control for its automatic three-second advance. Exact screen-reader timing experience is UNKNOWN — needs verification.

## 31. Dependencies

Direct dependencies are React hooks (`useEffect`, `useRef`, `useState`), Next.js `Image`, local static image assets, and the component stylesheet `BuyingJourney.css`. It also relies on browser `window.matchMedia`, timeout APIs, DOM element refs, and scrolling APIs. No API service, fetch helper, property data module, enquiry service, router, map library, or external UI library is imported by the component.

## 32. Known issues

- The step copy includes legal, approval, payment, banking, registration, mutation, and fee-related claims that are static product/demo copy; their business and legal accuracy is UNKNOWN — needs verification.
- The auto-advance has no explicit pause control.
- The component does not expose loading, error, or empty states because its content is static.
- The desktop detail copy has its own vertical scrolling area; exact usability across all viewport heights is UNKNOWN — needs verification.
- Analytics for step selection is not implemented directly; any global section tracking is UNKNOWN — needs verification.
- Automated test coverage for this component is UNKNOWN — needs verification.

## 33. Important constraints

- Preserve the homepage component name `BuyingJourney` and its default export path unless the homepage integration is intentionally changed.
- Preserve the five-step static data contract and the `StepId` values `select`, `inspect`, `legal`, `agreement`, and `register` when referring to existing state or assets.
- Preserve the 3000 ms auto-advance and cyclic navigation behavior as current implementation details.
- Preserve the `max-width: 980px` relationship between CSS layout switching and the `MOBILE_QUERY` media query.
- Keep desktop and mobile image mappings aligned: `step-1.png` through `step-5.png` and `step-lan-1.png` through `step-lan-5.png`.
- Do not treat the explanatory step copy as a confirmed contractual, legal, financial, or registration promise without separate verification.
- Do not conflate this homepage `BuyingJourney` with Property Details `BuyingJourneySteps`.
- This documentation task creates only `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\buying-guide.md`; application code is intentionally unchanged.