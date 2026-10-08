# Plan your purchase — see size, cost and returns together

This document describes the homepage **Plan your purchase** section: its setup, placement, property model, EMI and appreciation calculations, interaction states, responsive layout, accessibility treatment, assets, and current demo limitations.

## Overview

The section gives visitors one place to compare a plot's size and price, adjust a down payment, see an estimated monthly EMI, and review illustrative future-value figures.

The current implementation is a client-side React demo:

- Six plot options are defined locally in `EmiAppreciation.jsx`.
- Sark Green Plains is the only option marked available and is selected initially.
- The remaining five options are displayed as “Coming soon” and cannot be selected.
- Down payment is held in component state and starts at `20%`.
- The calculator uses fixed demo assumptions: `8.5%` annual interest, a `20`-year tenure, and `38%` three-year appreciation.
- No API, loan-provider integration, market-data service, persistence, or server-side calculation is used.
- The “Calculate for my budget” action opens a shared mobile-number modal. The current modal validates the number and displays a local confirmation; it does not yet send a WhatsApp message or call an external service.

## Setup and local development

The application is a Vite + React project. From the repository root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite and scroll to the heading **Plan your purchase — see size, cost and returns together**.

The production build is generated with:

```bash
npm run build
```

The section does not need a separate route, environment variable, API, or map token.

## Source and integration map

| Responsibility | Source |
| --- | --- |
| React section component, plot data, and calculation logic | [`src/components/EmiAppreciation.jsx`](../src/components/EmiAppreciation.jsx) |
| Section stylesheet | [`src/components/EmiAppreciation.css`](../src/components/EmiAppreciation.css) |
| Shared WhatsApp-budget modal | [`src/components/WhatsAppBudgetModal.jsx`](../src/components/WhatsAppBudgetModal.jsx) |
| Modal stylesheet | [`src/components/WhatsAppBudgetModal.css`](../src/components/WhatsAppBudgetModal.css) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |
| Historical change notes | [`src/components/CHANGES.md`](../src/components/CHANGES.md) |

`HomePage` renders the section after the shortlist-sharing section and before the field updates section:

```jsx
<PlotCompare />
<ShortlistShare />
<EmiAppreciation />
<FromTheField />
```

The component imports its own stylesheet and all of its plot-card image assets, so no additional page-level CSS import is required.

## User-facing copy and layout

The section begins with:

```text
Plan your purchase — see size, cost and returns together
Pick a plot to see your payment breakdown, plot dimensions and estimated appreciation — all in one place.
```

The main content has two columns on larger screens:

1. **Calculator card** — plot picker, down-payment slider, payment summary, and expandable value story.
2. **Insights and CTA** — three supporting messages followed by either “Calculate for my budget” or “Select a property to continue”.

If the selected plot is unavailable or no plot is selected, the calculator enters a locked state and displays placeholders instead of monetary values.

## Plot data model

The local `PLOTS` array contains this shape:

```js
{
  id,
  name,
  location,
  size,
  price,
  priceLabel,
  image,
  available,
}
```

Current records are:

| Plot | Location | Size | Price | Availability |
| --- | --- | --- | ---: | --- |
| Sark Green Plains | Tukkuguda | 435 sq.yd | ₹2.09 Cr | Available / selected initially |
| Plot A12 | Narsingi | 267 sq.yd | ₹52 Lakhs | Coming soon |
| Plot B7 | Mokila | 200 sq.yd | ₹38 Lakhs | Coming soon |
| Plot C3 | Tukkuguda | 300 sq.yd | ₹44 Lakhs | Coming soon |
| Kokapet Heights | Financial District Belt | 240 sq.yd | ₹68 Lakhs | Coming soon |
| Mansanpally Meadows | Shamshabad Belt | 220 sq.yd | ₹29 Lakhs | Coming soon |

The displayed size is part of each picker card and is also included in the selected-plot summary along with name, location, and price.

## Selection behavior

- The initial selected ID is `sark-green-plains`.
- A selectable plot button sets `selectedId` to that plot's ID.
- Unavailable records have `aria-disabled` and do not update the selection.
- The active card uses the `is-on` style and exposes `aria-pressed="true"`.
- The selected plot summary is formatted as `name · size · location · price`.
- The picker uses image cards with the plot name, size, and price below the image. Unavailable cards use a grayscale/reduced-opacity treatment and show “Coming soon”, “Adding soon”, and `—` in place of live selection data.

## EMI and appreciation calculations

The component defines these constants:

```js
const ANNUAL_RATE = 0.085
const TENURE_YEARS = 20
const APPRECIATION_3YR = 0.38
```

For a selected plot and down-payment percentage:

1. `downPayment = plot.price * (downPct / 100)`
2. `loanAmount = plot.price - downPayment`
3. Monthly EMI uses the standard amortizing-loan formula with:
   - monthly rate = `annualRate / 12`
   - number of payments = `years * 12`
4. Estimated 2028 value is `plot.price * (1 + 0.38)`.
5. Projected 2030 value is `plot.price * (1 + 0.38 * 1.45)`.

The down-payment range is:

| Property | Value |
| --- | ---: |
| Minimum | 10% |
| Maximum | 40% |
| Step | 5 percentage points |
| Initial value | 20% |

Changing the slider recalculates the down payment, loan amount, and monthly EMI live. The future-value figures are based on the plot price and fixed appreciation assumptions, so they do not change with the down-payment percentage.

The UI formats rupee values with `Intl.NumberFormat('en-IN')`. Larger summary amounts use compact lakh/crore formatting such as `₹52L` or `₹2.09 Cr`.

## Value story panel

The **How this plot grows in value** control is a semantic button with `aria-expanded` and `aria-controls`. It toggles a region containing:

- A sentence describing the selected plot, price, down payment, EMI, and illustrative 2028 value.
- A three-point timeline:
  - What you pay today — 2026
  - Estimated value in 2028
  - Projected value in 2030 — when ORR Phase 3 completes
- A disclaimer stating that the section is still being updated and that the figures are illustrative, not accurate market data or guaranteed returns.

The body uses a grid-row expansion animation. Reduced-motion users receive disabled transitions through the component's `prefers-reduced-motion` rule.

## Insights and budget CTA

The right column contains three local insight items:

1. **Your EMI pays the bank. The land pays you back.** — a demo message about appreciation and EMI cost.
2. **Loans made easy** — a demo message referencing SBI, HDFC, and Axis Bank.
3. **See it for yourself** — explains that selecting a plot and changing the down payment updates the figures.

When a selectable plot is active, the CTA opens `WhatsAppBudgetModal` with a property label in the form `Plot name (size)`. When no selectable plot is active, the CTA reads **Select a property to continue**, shows a temporary hint, and does not open the modal.

## WhatsApp budget modal

The modal is shared with the property-detail affordability component [`src/components/PropertyDetail/PriceEmiFuture.jsx`](../src/components/PropertyDetail/PriceEmiFuture.jsx).

Current behavior:

1. Opening the modal resets the number, validation message, and submitted state.
2. The dialog asks for a 10-digit Indian mobile number with a visible `+91` prefix.
3. Input is restricted to digits and ten characters.
4. Validation requires `/^[6-9]\d{9}$/`.
5. On valid submit, the modal displays a “Details on the way” confirmation containing the entered number and selected property label.
6. Escape, the scrim, the close button, or the Done button closes the modal.

The modal is rendered into `document.body` with a React portal and temporarily locks body scrolling while open.

## Responsive behavior

The section uses the existing responsive spacing variables and changes layout in the stylesheet:

| Viewport | Behavior |
| --- | --- |
| Larger screens | Two-column section; picker cards use a compact grid and the calculator/insights sit side by side. |
| Around 900px and below | The main grid collapses to one column; the calculator is shown before the insight/CTA column. |
| Smaller mobile widths | Plot cards become horizontally scrollable cards with fixed compact widths; controls, summaries, timeline text, and CTA use the available width. |
| Up to 480px in the modal | The budget dialog becomes a bottom-aligned sheet with safe-area-aware bottom padding. |
| Reduced motion | Story expansion and chevron transitions are disabled. |

The exact breakpoints and overflow rules are maintained in [`src/components/EmiAppreciation.css`](../src/components/EmiAppreciation.css); use that file as the styling source of truth when changing the layout.

## Accessibility

Current accessibility measures include:

- Property choices are native buttons and expose selection with `aria-pressed`.
- Unavailable choices expose `aria-disabled`.
- The picker is grouped with `role="group"` and `aria-label="Select a property"`.
- The value story uses `aria-expanded`, `aria-controls`, and a labelled region.
- Decorative plot-card images use empty alt text because the adjacent card text supplies the content.
- Decorative arrows and check marks are hidden from assistive technology.
- The budget modal uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- The mobile number input uses `type="tel"`, numeric input mode, autocomplete metadata, and `aria-invalid`/`aria-describedby` when validation fails.
- Escape closes the modal, and focus is moved to the mobile-number input when it opens.
- Reduced-motion styling is provided for the expandable story.

Potential production improvements include a complete focus trap and focus restoration for the modal, plus a live announcement for calculator values if testing shows that screen-reader users need explicit updates while dragging the slider.

## Assets

The section imports one image per plot record:

| Plot record | Asset |
| --- | --- |
| Plot A12 | [`src/assets/extra-image-3.png`](../src/assets/extra-image-3.png) |
| Plot B7 | [`src/assets/extra-image-5.png`](../src/assets/extra-image-5.png) |
| Plot C3 | [`src/assets/extra-image-8.png`](../src/assets/extra-image-8.png) |
| Kokapet Heights | [`src/assets/extra-image-6.png`](../src/assets/extra-image-6.png) |
| Mansanpally Meadows | [`src/assets/IMAGE-6-ORG.png`](../src/assets/IMAGE-6-ORG.png) |
| Sark Green Plains | [`src/assets/about-panel/hero-property.jpg`](../src/assets/about-panel/hero-property.jpg) |

Assets are imported through Vite rather than referenced through hard-coded public URLs. Keep filenames synchronized with the imports in `EmiAppreciation.jsx`.

## Current limitations and production considerations

This section should not be treated as a financial quote or investment recommendation:

- The EMI rate, tenure, and appreciation assumptions are hard-coded demo constants.
- Future values are simple price multipliers, not a time-based investment model and not a loan repayment/return comparison.
- The 2028 and 2030 figures are illustrative only; the UI explicitly says they are not accurate market data or guaranteed returns.
- Availability and prices are local display data and are not fetched from inventory or pricing services.
- The budget modal does not currently send WhatsApp messages, persist a lead, or call a CRM/API despite its WhatsApp-oriented copy.
- The “Loans made easy” message contains unverified demo copy and should be reviewed before publication.
- A production version should source rates, tenure, availability, approvals, and appreciation assumptions from reviewed business data and clearly distinguish estimates from commitments.

## Verification checklist

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```bash
npm run build
```

Then check manually:

1. The homepage renders the section after shortlist sharing and before field updates.
2. The heading and lede match the current implementation.
3. Sark Green Plains is selected initially and displays its size, location, and price.
4. The five unavailable plot cards show their image and “Coming soon” state and cannot be selected.
5. Moving the down-payment slider through 10%, 20%, 30%, and 40% updates the down payment and monthly EMI.
6. The selected-plot summary and timeline show the expected formatted values.
7. The expandable value story opens and closes, and its disclaimer is visible when open.
8. The budget CTA opens the mobile-number modal with the selected plot label.
9. Invalid numbers are rejected; a valid 10-digit number beginning with 6–9 shows the confirmation state.
10. Escape, scrim, close, and Done controls close the modal.
11. Check the two-column desktop layout and the single-column/mobile horizontal plot picker.
12. Run the production build again after any calculation or content change.

At the time of writing, `npm run build` is the appropriate automated validation for this documentation change. `npm run lint` may remain unavailable in the Windows environment if Oxlint's optional native binding is missing; that is an environment/package-installation issue rather than a section-specific behavior.
