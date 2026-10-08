# EMI Calculator feature

This document describes the current EMI-related implementations only. The codebase has two separate calculators: the homepage `EmiAppreciation` section and the Property Details `PriceEmiFuture` section. They do not share calculator state or a calculator component.

## 1. Feature purpose

The calculators provide illustrative plot-financing estimates. They calculate a monthly EMI from a principal, interest rate, and tenure, show payment/principal/interest information, and show a separate illustrative future-appreciation projection. Neither calculator submits a loan application or guarantees a return.

## 2. Where it appears

- Homepage: `EmiAppreciation` is rendered on `/`.
- Property Details: `PriceEmiFuture` is rendered inside the shared Property Details page at `/properties/{propertyId}`.
- No separate calculator route is confirmed. `public/emi-calculator.html` is a standalone static HTML artifact and is not imported by the inspected React homepage or Property Details render tree.

## 3. Homepage position

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` renders `<EmiAppreciation />` immediately after `<ShortlistShare />` and before `<FromTheField />`:

`Hero → MapSection → WhoWeAre → GrowthCorridors → FindYourPlot → BuyingJourney → ShortlistShare → EmiAppreciation → FromTheField → PlotsWithPulse → Faq`.

## 4. Property Details location

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` renders `<PriceEmiFuture property={property} />` after `Lifestyle` and before `LegalDocuments`, `SatelliteBeforeAfter`, `BuyingJourneySteps`, `SimilarProperties`, and the final CTA. The rendered section heading uses `id="pd-emi-title"`. An exact `id="loan-calculator"` target is UNKNOWN — needs verification.

## 5. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\EmiAppreciation.tsx` — homepage calculator and appreciation story.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\EmiAppreciation.css` — homepage desktop/mobile styles.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PriceEmiFuture.tsx` — Property Details calculator, amortization, chart, and appreciation projection.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — Property Details calculator layout styles, including `.pd-emi__controls-scroll`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — Property Details integration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — `formatInr` and `futureValue` used by `PriceEmiFuture`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\WhatsAppBudgetModal.tsx` — budget CTA modal opened by both React calculator components.

## 6. Component names

- `EmiAppreciation` — default export from `EmiAppreciation.tsx`; standalone homepage component.
- `PriceEmiFuture` — default export from `PropertyDetail/PriceEmiFuture.tsx`; standalone Property Details child component.
- `PropertyPageView` — parent composition component that supplies the Property Details property.

## 7. Props

`EmiAppreciation` accepts no props: `function EmiAppreciation()`.

`PriceEmiFuture` accepts exactly:

```ts
{ property: PropertyRecord }
```

The `PropertyRecord` type is defined in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.

## 8. Visible UI

The homepage shows an “EMI Calculator”/EMI and appreciation story with plot-selection chips, a selected plot card, down-payment control, purchase/loan/EMI summary, an appreciation story/timeline, explanatory insights, and a “Calculate for my budget” CTA. On mobile it uses a progressive picker/card layout with expandable payment and growth panels.

Property Details shows a pricing/EMI section with purchase price, down payment, interest rate, tenure, reset, payment summary, a donut breakdown, yearly/monthly amortization controls, an expandable schedule table, future-value cards, a growth disclaimer, and a “Calculate for my budget” CTA.

## 9. Input fields

Homepage:

- Plot selection buttons for six static `PlotId` values: `sark-green-plains`, `a12`, `b7`, `c3`, `kokapet`, and `mansanpally`.
- Down-payment range input (`type="range"`) with `min=0`, `max=90`, `step=1`, and state `downPct`.
- Mobile plot picker controls; there is no homepage purchase-price, interest-rate, or tenure input.

Property Details:

- Purchase price input, state `purchasePrice`.
- Down payment percentage input/range, state `downPaymentPct`, percentage mode.
- Down payment flat-amount input/range, state `downPaymentFlat`, flat mode.
- Interest rate input/range, state `annualRate`.
- Tenure input/range, state `tenureValue`, with `tenureUnit` set to years or months.
- Yearly/monthly amortization buttons and expand/collapse control are presentation controls, not loan inputs.

## 10. Default values

Homepage constants are `ANNUAL_RATE = 0.085` (8.5%), `TENURE_YEARS = 20`, `APPRECIATION_3YR = 0.38` (38%), and `ACTIVE_PLOT_ID = "sark-green-plains"`. Desktop initially selects Sark Green Plains; mobile initially has no selected plot until a user selects one. `downPct` starts at `20`.

Property Details initializes `purchasePrice` from `property.price` when finite and greater than zero, otherwise `50_00_000`; `downPaymentMode` is `"percentage"`; `downPaymentPct` is `20`; `downPaymentFlat` is `Math.round(initialPrice * 0.2)`; `annualRate` is `8.5`; `tenureUnit` is `"years"`; `tenureValue` is `20`; `amortizationMode` is `"yearly"`; and `isAmortizationExpanded` is `true`.

## 11. Calculation formula

The Property Details component explicitly documents and implements:

`EMI = [P × R × (1 + R)^N] / [(1 + R)^N − 1]`

where `P` is net principal, `R = annualRate / 12 / 100`, and `N` is tenure in months. The homepage uses the same standard formula in `calcEmi`, with its rate passed as `0.085` and converted to a monthly decimal by dividing by 12.

## 12. Calculation logic

Homepage `buildStory(plot, downPct)` calculates `downPayment = plot.price × downPct / 100`, `loanAmount = plot.price − downPayment`, and EMI using the fixed 8.5%/20-year assumptions. The story also calculates `value2028 = plot.price × (1 + 0.38)` and `value2030 = plot.price × (1 + 0.38 × 1.45)`.

Property Details derives an effective down payment, then `principal = max(0, purchasePrice − effectiveDownPayment)`. Years are converted to months by `tenureValue × 12`; months are used directly. For a positive rate it calculates EMI, total payment (`emi × n`), and total interest (`max(0, totalPayment − principal)`). For a zero/non-positive rate it uses `principal / tenureMonths`, zero interest, and principal as total payment.

## 13. State variables

Homepage state: `isMobile`, `selectedId`, `downPct`, `hint`, `storyOpen`, `paymentOpen`, `budgetOpen`, `pickerOpen`, and `hasUserPicked`.

Property Details state: `purchasePrice`, `downPaymentMode`, `downPaymentPct`, `downPaymentFlat`, `annualRate`, `tenureUnit`, `tenureValue`, `amortizationMode`, `isAmortizationExpanded`, and `budgetOpen`; it also keeps `printAreaRef` in a ref.

## 14. Derived values

Homepage derives `plot`, `isLocked`, `showUpdatingNotice`, and `story`.

Property Details derives `initialPrice`, `effectiveDownPayment`, `effectiveDownPaymentPct`, `principal`, `tenureMonths`, `monthlyEmi`, `totalInterest`, `totalPayment`, `yearlySchedule`, `monthlySchedule`, `chartSlices`, and future-value presentation data (`nearYear`, `laterYear`, `valueNear`, `valueLater`).

## 15. Functions

Homepage functions include `formatLakhs`, `formatRupee`, `calcEmi`, `buildStory`, `showSelectHint`, `selectPlot`, `handleSliderChange`, `handleSliderAttempt`, `openPicker`, and `togglePicker`.

Property Details functions/handlers include the reset handler, print handler, percentage/flat mode handlers, purchase-price/down-payment/rate/tenure change handlers, tenure-unit conversion handlers, `formatInr`, `futureValue`, and the schedule generation logic inside `useMemo`.

## 16. Hooks

`EmiAppreciation` uses `useState`, `useMemo`, and `useLayoutEffect`. `useLayoutEffect` synchronizes the `(max-width: 980px)` media query and removes its listener on cleanup.

`PriceEmiFuture` uses `useState`, `useMemo`, `useId`, and `useRef`. No data-fetching hook is used by either calculator.

## 17. Input validation

Homepage plot selection only produces a calculation for a plot whose `available` value is not `false`; the five non-active plots are currently marked unavailable. Its down-payment range is 0–90%. A locked calculator prevents slider interaction and shows a selection hint.

Property Details clamps percentage down payment to 0–100% and flat down payment to 0–`purchasePrice` in the text-input handler; effective down payment also clamps to purchase price and non-negative values. The percentage slider is 0–90%. Interest-rate text input clamps to 0–25%; its slider is 0–18%. Tenure text input clamps to 1–35 years or 1–420 months. The range handlers rely on their declared ranges. Empty/non-numeric values are converted to 0 or 1 by the relevant clamping handlers. Exact browser behavior while an input is temporarily empty is UNKNOWN — needs verification.

## 18. Formatting

Homepage `formatRupee` uses `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })` after `Math.round`. `formatLakhs` displays amounts below ₹1 crore as `₹{lakhs}L` (0 decimals at 10L or more, otherwise 1 decimal) and amounts at or above ₹1 crore as `₹{crores.toFixed(2)} Cr`.

Property Details uses `formatInr` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`; schedule values are passed through `Math.round` before formatting. Percentages and rate labels use the numeric state values; future-value text uses the helper’s returned values.

## 19. Result display

Homepage displays down payment, loan amount, and monthly EMI, plus “What you pay today — 2026”, estimated value in 2028, projected value in 2030, and an illustrative-only disclaimer.

Property Details displays effective down payment and percentage, net loan principal, monthly EMI, total interest, total payment, a donut split of down payment/principal/interest, and either yearly or monthly amortization rows containing beginning balance, payment/EMI, principal paid, interest paid, and ending balance. It separately displays two future-value milestones based on the purchase price.

## 20. Loading behavior

Neither React calculator has a loading state or asynchronous calculation. Values derive synchronously during render. The WhatsApp budget modal has its own behavior, but no calculator-specific loading state is confirmed.

## 21. Error behavior

Neither React calculator renders a calculation error state. Invalid numeric input is handled through clamping/default arithmetic rather than an error message. Analytics and modal delivery failures are outside these components; exact failure behavior is UNKNOWN — needs verification.

## 22. Empty-state behavior

Homepage mobile starts locked with no selected plot and displays dashes/selection guidance until a plot is selected. On desktop, Sark Green Plains is selected by default. Property Details has no empty calculator state because it receives a `property` prop; a non-positive/invalid property price falls back to ₹50,00,000.

## 23. Reset behavior

The Property Details `handleReset` restores `purchasePrice` to `initialPrice`, percentage mode, 20% down payment, a flat amount equal to 20% of initial price, 8.5% rate, years unit, 20-year tenure, yearly amortization, and expanded schedule state. The homepage has no reset button or reset function confirmed.

## 24. Analytics

`EmiAppreciation` directly emits `EMI_PROPERTY_SELECT` with `{ plot_id, section_type: "emi_calculator" }` when a plot is selected, and `EMI_CALCULATOR_USE` with `{ down_payment_pct, plot_id, section_type: "emi_calculator" }` when its slider changes.

`PriceEmiFuture` directly emits `EMI_CALCULATOR_USE` from the reset and print actions with Property Details calculator metadata. The exact complete metadata object for those calls is present in `PriceEmiFuture.tsx`; a separate event for every input change is not confirmed. No calculator-specific event named `EMI_CALCULATOR_RESET` or `EMI_CALCULATOR_PRINT` is confirmed.

## 25. Relationship with Property Details

`PriceEmiFuture` is part of Property Details and receives the current `PropertyRecord`. Its initial purchase price is automatically supplied from `property.price` when valid. The homepage `EmiAppreciation` does not receive a `PropertyRecord` and uses its own six-item static plot catalog. The two calculators have separate state and formulas/constants.

## 26. Relationship with Property Popup

No direct import or callback connects either calculator to the map/property popup implementation. A popup can navigate to a Property Details route, where `PriceEmiFuture` then uses that page’s `PropertyRecord`; automatic transfer of popup price or calculator state is not confirmed.

## 27. Relationship with Property Enquiry

The calculators do not submit an enquiry. Their “Calculate for my budget” CTA opens `WhatsAppBudgetModal` and passes a property label on the React implementations. This is separate from Property Details hero/final/sticky enquiry links and from the Property Enquiry implementation. Exact modal message/submission behavior belongs to `WhatsAppBudgetModal.tsx` and is not duplicated here.

## 28. Desktop behavior

Homepage desktop renders the two-column dark calculator/story layout with plot chips and a visible selected-plot panel. `PriceEmiFuture` renders the full controls, summary/chart, future-value area, and expandable amortization table; its controls area is scrollable where defined by `.pd-emi__controls-scroll`.

## 29. Mobile behavior

At homepage mobile width, the desktop presentation is replaced by the `ea-m` progressive layout. It begins with no selected property, uses a picker, stacks the calculator content, and exposes payment and growth information through expandable fold sections. At very narrow widths the frame uses a minimum-height layout.

Property Details retains the calculator controls and makes the relevant content/table fit narrow screens through responsive layout and horizontal/vertical scrolling rules in `PropertyDetail.css`. Exact pixel behavior beyond those CSS rules is UNKNOWN — needs verification.

## 30. Responsive breakpoints

Homepage TypeScript uses `MOBILE_QUERY = "(max-width: 980px)"`. `EmiAppreciation.css` also contains `@media (max-width: 1100px)`, `@media (max-width: 900px)`, `@media (max-width: 640px)`, `@media (max-width: 980px)`, and `@media (prefers-reduced-motion: reduce)` rules. The mobile-specific `.ea-m` layout is enabled at `max-width: 980px`; an additional `max-width: 640px` rule tightens its frame sizing.

Property Details CSS contains calculator-related base rules plus `@media (max-width: 700px)`, `@media (min-width: 760px)`, and `@media (min-width: 980px)` rules in the shared stylesheet. No separate calculator-only breakpoint beyond these source rules is confirmed.

## 31. CSS/classes

Homepage primary classes include `.emi-appreciation`, `.emi-appreciation__frame`, `__intro`, `__heading`, `__grid`, `__card`, `__picker`, `__chips`, `__chip`, `__plot`, `__slider`, `__row`, `__row--emi`, `__story`, `__story-toggle`, `__story-body`, `__timeline`, `__point`, `__point--peak`, `__insights`, `__insight`, `__cta`, `.is-locked`, `.is-on`, `.is-soon`, `.is-disabled`, and mobile `.ea-m` classes such as `.ea-m__frame`, `.ea-m__picker`, `.ea-m__card`, `.ea-m__fold`, `.ea-m__fold--growth`, `.ea-m__timeline`, and `.ea-m__cta`.

Property Details uses Tailwind utility class strings extensively and calculator-specific stylesheet classes including `.pd-emi__controls-scroll` and its scrollbar pseudo-elements. The root/heading classes and exact full class list are in `PriceEmiFuture.tsx` and `PropertyDetail.css`.

## 32. Accessibility

Both components use native buttons and labels/inputs. The homepage section has `aria-label="EMI and appreciation story"`; its mobile sections use button controls and `aria-expanded`/region semantics where shown in the component. Decorative images/icons use empty alt text or `aria-hidden`. Property Details uses generated `useId()` values to associate labels and inputs, semantic table headings with `scope="col"`, buttons for mode/toggle controls, and an SVG chart with textual summary values. Exact screen-reader behavior for the scrollable schedules and modal is UNKNOWN — needs verification.

## 33. Dependencies

Direct dependencies are React hooks/types, Next.js `Image` in the homepage component, local plot image assets, `WhatsAppBudgetModal`, `trackEvent`, `PropertyRecord`, `formatInr`, `futureValue`, and the two CSS files. No calculator API, persistence layer, native Web Share API, or external calculator library is imported by these React components.

## 34. Known issues

- The homepage calculator uses hard-coded static plot data and fixed 8.5%/20-year assumptions; it is not connected to Property Details inventory or prices.
- Homepage unavailable plots remain visible as selection chips but lock the calculation and show a selection hint.
- Homepage appreciation values are explicitly illustrative and are not accurate market data or guaranteed returns.
- Property Details uses a fallback purchase price when `property.price` is invalid, and its exact behavior for malformed runtime records is UNKNOWN — needs verification.
- The calculators have no loading or visible calculation-error state.
- No exact `loan-calculator` anchor was confirmed in the inspected Property Details render output.
- The standalone `public/emi-calculator.html` is not confirmed to be part of the Next.js application flow.
- Automated test coverage for these calculator components is UNKNOWN — needs verification.

## 35. Important constraints

- Keep `EmiAppreciation` and `PriceEmiFuture` documented as separate implementations with separate state and inputs.
- Preserve the exact homepage constants: `ANNUAL_RATE = 0.085`, `TENURE_YEARS = 20`, and `APPRECIATION_3YR = 0.38`.
- Preserve Property Details’ principal calculation, zero-rate path, down-payment clamping, tenure conversion, amortization logic, and `ANNUAL_APPRECIATION = 0.11` future-value inputs.
- Do not claim that homepage or popup prices automatically populate the homepage calculator; only Property Details `property.price` population is confirmed.
- Do not treat appreciation projections as EMI calculations, guaranteed returns, or verified market data.
- Preserve analytics event names `EMI_PROPERTY_SELECT` and `EMI_CALCULATOR_USE` where currently emitted.
- Preserve the current breakpoints and class contracts in `EmiAppreciation.css` and `PropertyDetail.css` when referring to current behavior.
- This documentation task must not modify application code; existing application working-tree changes must be preserved.