# EMI Calculator feature

This document describes the EMI calculator as it now stands. There is **one** implementation, `PriceEmiFuture`, used on both the property detail page and the homepage "Plan your purchase" section.

## 1. Feature purpose

The calculator provides an illustrative plot-financing estimate. It derives a monthly EMI from a purchase price, down payment, interest rate and tenure; shows payment/principal/interest breakdowns and a full amortization schedule; and shows a separate illustrative future-appreciation projection. It does not submit a loan application or guarantee a return.

## 2. One implementation, two surfaces

| Surface | Component | Property source |
|---|---|---|
| `/properties/{propertyId}` | `PriceEmiFuture` inside `PropertyPageView` | `property.price` from the route's own record |
| `/` (homepage) | `EmiAppreciation` → `PriceEmiFuture` | `GET /api/properties`, chosen by the visitor |

`EmiAppreciation` is now a **shell**: it fetches the property list, renders a picker, and delegates the entire calculator to `PriceEmiFuture`. It contains no EMI arithmetic, no loan inputs and no appreciation maths.

This replaced a second, parallel calculator that had drifted. The homepage version had been pinned to a fixed 8.5% rate and 20-year tenure with only a down-payment slider, and priced six hard-coded demo plots. Reusing the real component means the two surfaces cannot disagree about a formula, a clamp bound or a zero-rate case.

## 3. Homepage position

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` renders `<EmiAppreciation />` after `<ShortlistShare />` and before `<FromTheField />`:

`Hero → MapSection → WhoWeAre → GrowthCorridors → FindYourPlot → BuyingJourney → ShortlistShare → EmiAppreciation → FromTheField → PlotsWithPulse → Faq`.

## 4. Property Details location

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` renders `<PriceEmiFuture property={property} />` after `Lifestyle` and before `LegalDocuments`. The rendered section heading uses `id="pd-emi-title"`. An exact `id="loan-calculator"` target is UNKNOWN — needs verification.

## 5. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PriceEmiFuture.tsx` — the calculator: controls, summary, donut chart, amortization schedule, future-value projection, print and reset.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — the calculator's only stylesheet rules (see §5a).
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — Property Details integration.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\EmiAppreciation.tsx` — homepage shell: property fetch, picker, locked placeholder. No calculator logic.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\EmiAppreciation.css` — homepage shell styles only.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — `formatInr` and `futureValue`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — `fetchProperties`, `PropertyListItem`, `formatPrice`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\WhatsAppBudgetModal.tsx` — budget CTA modal.

### 5a. Stylesheet portability

`PriceEmiFuture` imports `PropertyDetail.css` itself, so it is self-sufficient wherever it renders; `PropertyPageView` also imports it, which is harmless because CSS imports are deduplicated.

The calculator is almost entirely styled with Tailwind utilities in the JSX. Only two stylesheet rules target it:

- `.pd-emi__card`, in a shared box-shadow group alongside other lifted surfaces.
- `.pd-emi__controls-scroll` and its scrollbar pseudo-elements.

One rule in that group — `::-webkit-scrollbar-thumb:hover { background-color: var(--pd-gold) }` — depends on a `--pd-gold` variable that is normally defined by `.property-page`. The homepage section defines `--pd-gold: #c6a46c` on itself so that hover state resolves rather than silently falling back to nothing. This is the only inherited dependency.

## 6. Props

`PriceEmiFuture` accepts exactly:

```ts
{ property: EmiCalculatorProperty }

type EmiCalculatorProperty = {
  name: string;
  price: number;
};
```

The prop type was narrowed from the full `PropertyRecord` to the two fields the calculator actually reads — `property.price` seeds the initial purchase price and `property.name` labels the heading and the WhatsApp modal. This is what allows the homepage to render the component straight from an API list row instead of fabricating a full record. A `PropertyRecord` satisfies the narrower shape, so the property detail page is unaffected.

`EmiAppreciation` accepts no props.

## 7. Input fields

All calculator inputs live in `PriceEmiFuture` and appear on both surfaces:

- Purchase price — state `purchasePrice`.
- Down payment, percentage mode — state `downPaymentPct`, percentage slider.
- Down payment, flat mode — state `downPaymentFlat`.
- Interest rate — text input clamped 0–25% plus a slider 4–18%; state `annualRate`.
- Loan tenure — text input with a years/months unit toggle; state `tenureValue` and `tenureUnit`.
- Yearly/monthly amortization and expand/collapse — presentation controls, not loan inputs.

There is **no purchase-price input on the homepage shell** beyond the calculator's own; the shell only chooses which property seeds it.

## 8. Default values

`purchasePrice` initialises from `property.price` when finite and greater than zero, otherwise `50_00_000`. `downPaymentMode` is `"percentage"`; `downPaymentPct` is `20`; `downPaymentFlat` is `Math.round(initialPrice * 0.2)`; `annualRate` is `8.5`; `tenureUnit` is `"years"`; `tenureValue` is `20`; `amortizationMode` is `"yearly"`; and `isAmortizationExpanded` is `true`.

Because `purchasePrice` is initialised from the property, selecting a different property on the homepage **does not** reseed it: the calculator's own state persists across the swap. The visitor must press Reset, or reload the section, to pull the new property's price in. This is a known issue — see §22a.

## 9. Calculation formula

`EMI = [P × R × (1 + R)^N] / [(1 + R)^N − 1]`

where `P` is net principal, `R = annualRate / 12 / 100`, and `N` is tenure in months.

The zero-rate branch is required, not defensive: at 0% the denominator is exactly `0`, so without it the page renders `Infinity` as an EMI. It returns `principal / tenureMonths`, with zero interest and principal as the total payment.

## 10. Calculation logic

An effective down payment is derived first — `min(purchasePrice, round(purchasePrice × pct / 100))` in percentage mode, or `min(purchasePrice, max(0, flat))` in flat mode. Then `principal = max(0, purchasePrice − effectiveDownPayment)`.

Years convert to months by `tenureValue × 12`; months are used directly. For a positive rate: EMI from the formula above, `totalPayment = emi × n`, `totalInterest = max(0, totalPayment − principal)`.

## 11. State variables

`purchasePrice`, `downPaymentMode`, `downPaymentPct`, `downPaymentFlat`, `annualRate`, `tenureUnit`, `tenureValue`, `amortizationMode`, `isAmortizationExpanded`, and `budgetOpen`; plus `printAreaRef` in a ref.

`EmiAppreciation` holds `items`, `status` (`"loading" | "ready" | "error"`), `error`, and `selectedId`.

## 12. Derived values

`initialPrice`, `effectiveDownPayment`, `effectiveDownPaymentPct`, `principal`, `tenureMonths`, `monthlyEmi`, `totalInterest`, `totalPayment`, `yearlySchedule`, `monthlySchedule`, `chartSlices`, and the future-value presentation values `nearYear`, `laterYear`, `valueNear`, `valueLater`.

## 13. Functions

The reset handler, the print handler, the percentage/flat mode handlers, the purchase-price/down-payment/rate/tenure change handlers, the tenure-unit conversion handlers, `formatInr`, `futureValue`, and the schedule generation inside `useMemo`.

`EmiAppreciation` has one handler, `select(id)`.

## 14. Hooks

`PriceEmiFuture` uses `useState`, `useMemo`, `useId` and `useRef`.

`EmiAppreciation` uses `useState`, `useMemo` and a single `useEffect` that fetches the property list and aborts it on cleanup.

## 15. Input validation

Percentage down payment clamps to 0–100% and flat down payment to 0–`purchasePrice` in the text handler; the effective down payment clamps to the purchase price and to non-negative values. The percentage slider is 0–90%. The interest-rate text input clamps to 0–25% and its slider to 0–18%. The tenure input clamps to 1–35 years or 1–420 months. Empty and non-numeric values are coerced to 0 or 1 by the clamping handlers.

The tenure unit conversion uses `Math.max(1, Math.round(months / 12))` going to years and `min(420, years × 12)` going to months, so 7 months becomes 1 year rather than 0.

Exact browser behaviour while an input is temporarily empty is UNKNOWN — needs verification.

## 16. Formatting

`formatInr` from `propertyUtils` is used for all money. The homepage picker uses `formatPrice` from `propertiesService`, which formats compactly (`₹2.09 Cr`, `₹52 L`) and returns "Price on request" for a null or non-positive price. Schedule values pass through `Math.round` before formatting.

## 17. Result display

The calculator displays the effective down payment and its percentage, the net loan principal, the monthly EMI, the total interest, the total payment, a donut split of down payment/principal/interest, and either yearly or monthly amortization rows with beginning balance, payment, principal paid, interest paid and ending balance. It separately displays two future-value milestones from the purchase price at `ANNUAL_APPRECIATION = 0.11`.

## 18. Loading and error behavior

`PriceEmiFuture` has **no loading or error state**. Values derive synchronously and invalid input is handled by clamping, not by an error message.

`EmiAppreciation` does have three states for the property list: `Loading properties…` as a `role="status"`, an error line as a `role="alert"` carrying the backend message, and an empty state when the list returns nothing. If any of the first two apply, the picker grid is not rendered and the locked placeholder stays.

## 19. Empty-state behavior

The calculator itself has no empty state, because it always receives a property; an invalid price falls back to `50_00_000`.

The homepage shell has one: before a property is selected, a locked placeholder is rendered **in place of** the calculator. It is dashed, flattened and dimmed, carries `aria-disabled="true"`, and reads "Select a property to run the numbers".

`PriceEmiFuture` was not given a `disabled` prop. Handing it a fabricated price purely to grey it out would display a real-looking EMI for a property nobody chose, which is worse than displaying nothing. Swapping the whole component out is the honest equivalent of disabling it.

## 20. Reset behavior

`handleReset` restores `purchasePrice` to `initialPrice`, percentage mode, a 20% down payment, a flat amount of 20% of the initial price, an 8.5% rate, years unit, 20-year tenure, yearly amortization and an expanded schedule.

The homepage's Reset is the same button, and it is the only way to re-pull the selected property's price after switching properties — see §8 and §22a.

## 21. Analytics

`PriceEmiFuture` emits `EMI_CALCULATOR_USE` from the reset and print actions with `section_type: "emi_calculator"` and a `surface` discriminator.

`EmiAppreciation` emits `EMI_PROPERTY_SELECT` with `{ property_id, section_type: "emi_calculator" }` when a property is picked. The homepage previously emitted `EMI_PROPERTY_SELECT` with `plot_id` and `EMI_CALCULATOR_USE` on every slider change; both of those homepage emitters are gone with the replaced calculator. Consumers reading `plot_id` from this event will now receive `property_id` instead.

No calculator-specific event named `EMI_CALCULATOR_RESET` or `EMI_CALCULATOR_PRINT` is confirmed.

## 22. Relationship with the property detail page

None beyond the shared component. The property detail page supplies a full `PropertyRecord`; the homepage supplies a `{ name, price }` pair from an API list row. Both render the same calculator with the same state shape and the same defaults.

## 23. Relationship with Property Enquiry

The calculator does not submit an enquiry. Its "Calculate for my budget" CTA opens `WhatsAppBudgetModal`, whose label is built from the computed purchase price, down-payment percentage and EMI. Exact modal message and submission behaviour belong to `WhatsAppBudgetModal.tsx`.

## 24. Layout and responsive behavior

`PriceEmiFuture` renders a two-column layout with a scrollable controls column (`.pd-emi__controls-scroll`) beside a sticky summary. The shared stylesheet carries calculator rules at `max-width: 700px`, `min-width: 760px` and `min-width: 980px`. Exact pixel behaviour beyond those rules is UNKNOWN — needs verification.

The homepage shell is a single column: heading, then picker grid, then the calculator. The picker is 2 columns, 3 from `640px` and 4 from `1100px`, with `grid-auto-flow: row dense` so a double-width tile cannot leave a hole. Dense flow can make visual order diverge from DOM order, so tab sequence may not read strictly left-to-right; each tile carries its own visible label and `aria-pressed`, so it stays unambiguous.

## 25. Accessibility

The calculator uses `useId()` to associate labels with inputs, semantic table headings with `scope="col"`, buttons for mode and toggle controls, and an SVG chart accompanied by textual summary values.

The homepage picker is a `role="group"` labelled by `emi-picker-label`, with `aria-pressed` on each option. The locked placeholder carries `aria-disabled` and an `aria-label` explaining it is awaiting a property. Exact screen-reader behaviour for the scrollable schedules and the modal is UNKNOWN — needs verification.

## 26. Known issues

- **Switching property does not reseed the calculator.** `purchasePrice` is initialised from the property only on mount, so a second selection keeps the first property's price until Reset is pressed. This is the most likely thing a reviewer will notice, and it is a direct consequence of reusing one stateful component.
- The picker shows at most `PICKER_LIMIT = 12` properties with no pagination or "load more". The endpoint is paginated, so a tenant with more than 12 active properties will show only the first page.
- The picker requests `status: "ACTIVE"`. Whether the list endpoint honours that filter is UNKNOWN — needs verification. If it does not, unavailable properties will appear.
- Properties with a null or non-positive price fall back to `50_00_000` inside the calculator and read "Price on request" in the picker, so the two can disagree on screen.
- Appreciation values are explicitly illustrative and are not accurate market data or guaranteed returns.
- There is no loading or calculation-error state inside the calculator itself.
- No exact `loan-calculator` anchor was confirmed in the property detail render output.
- The standalone `public/emi-calculator.html` is not confirmed to be part of the Next.js application flow.
- Automated test coverage is UNKNOWN — needs verification.
- The homepage has not been exercised in a browser as part of this change; no build, type-check or dev server was run.

## 27. Important constraints

- Do not reintroduce a second calculator. The homepage must delegate to `PriceEmiFuture`.
- Preserve the zero-rate branch. Removing it reintroduces an `Infinity` EMI.
- Preserve `ANNUAL_APPRECIATION = 0.11` and the two future-value milestones.
- Preserve `initialPrice` derivation and its `50_00_000` fallback.
- Preserve the analytics event names `EMI_PROPERTY_SELECT` and `EMI_CALCULATOR_USE`. Note that `EMI_PROPERTY_SELECT` now carries `property_id` rather than `plot_id` on the homepage.
- Keep `--pd-gold` defined on the homepage section, or the calculator's scrollbar hover state resolves to nothing.
- Do not treat appreciation projections as EMI calculations, guaranteed returns, or verified market data.

## 28. Verification checklist

1. `GET /api/properties?status=ACTIVE` returns rows and the picker renders them with real names and formatted prices.
2. Selecting a property swaps the locked placeholder for the calculator and seeds the purchase price from that property.
3. **Select a second property and confirm the stale-price behaviour matches §26** — currently the price will not update.
4. Press Reset and confirm the purchase price snaps to the currently selected property.
5. Confirm the zero-rate path: set the interest rate to 0 and confirm the EMI is finite.
6. Confirm the same calculator renders correctly on `/properties/{propertyId}` — the prop narrowing must not have changed anything there.
7. Confirm the embedded calculator's styling resolves on the homepage, especially the scrollbar hover state.
8. Confirm the picker's empty, loading and error states.
9. Tab through the picker and confirm focus is visible and pressed state is announced.
10. Confirm `EMI_PROPERTY_SELECT` fires with `property_id`.

## 29. Related documentation

- `docs/architecture/api.md` — the properties API architecture.
- `docs/features/property-details.md` — the `/properties/{propertyId}` page that renders the same calculator.