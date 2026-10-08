# Buying Journey feature

This document describes the current Buying Journey implementation rendered on the Property Details page. It complements, rather than duplicates, [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\location-story.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\location-story.md). It covers the compact property-detail component only, not the separate homepage Buying Journey component in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\BuyingJourney.tsx`.

## 1. Feature purpose

The Buying Journey explains the shared five-step plot-buying process from the first enquiry through registration. It is explanatory content, not a property transaction workflow: it does not select inventory, submit an enquiry, perform legal verification, accept payment, or initiate registration.

## 2. Where it appears on the Property Details page

It appears as the section with the visible kicker `Buying journey`, the heading `A simple, transparent process.`, and the lead copy `A clear path from your first conversation to the final handover.` It is rendered inside the shared `PropertyPageView` used for both local/static properties and normalized API properties.

## 3. Exact section position/order

After `PropertyHero`, the current `PropertyPageView` order is:

1. `LifeStageMatch`
2. `FutureNeighbourhoodMap`
3. `Lifestyle`
4. `PriceEmiFuture`
5. `LegalDocuments`
6. `SatelliteBeforeAfter`
7. `BuyingJourneySteps`
8. `SimilarProperties`
9. `PropertyFinalCta`
10. `StickyBottomCta`

Therefore, Buying Journey is immediately after Location Story (`SatelliteBeforeAfter`) and immediately before Similar Properties. It is the eighth rendered section/component after the hero in the complete page tree.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\BuyingJourneySteps.tsx` — Buying Journey component and its step data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — imports and renders the component.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — shared Property Details CSS, including all Buying Journey selectors.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyHero.tsx` — preceding hero/enquiry context.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\LegalDocuments.tsx` — preceding verification section.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx` — following final enquiry actions.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\StickyBottomCta.tsx` — following sticky enquiry shortcut.

## 5. Component names

The component is actually named `BuyingJourneySteps`. It is the default export from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\BuyingJourneySteps.tsx` and is imported with the same name by `PropertyPageView`.

There is also a separate component named `BuyingJourney` at `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\BuyingJourney.tsx`; that is not the component used in the Property Details page.

## 6. Component props

`BuyingJourneySteps` accepts no props:

```ts
export default function BuyingJourneySteps() { ... }
```

`PropertyPageView` renders it as `<BuyingJourneySteps />`. It does not pass `property`, callbacks, configuration, or API data.

## 7. Data sources

The component’s content comes only from the module-level `STEPS` constant in `BuyingJourneySteps.tsx`. It does not read `PropertyRecord`, `properties.ts`, an API response, query parameters, browser storage, or any external service.

The component is styled by the imported `PropertyDetail.css` stylesheet through `PropertyPageView`.

## 8. Static vs API behavior

The Buying Journey is static and identical for local/static and API-backed properties. `ApiPropertyView` normalizes API data into `PropertyRecord` and passes it to `PropertyPageView`, but `PropertyPageView` does not pass that record to `BuyingJourneySteps`.

There is no Buying Journey endpoint, API request, API-specific mapping, or property-specific step content.

## 9. Buying journey step data structure

`STEPS` is a module-level array declared with `as const`:

```ts
const STEPS = [
  {
    id: string,
    number: string,
    name: string,
    summary: string,
  },
  // five literal objects total
] as const;
```

Because of `as const`, the array and its field values are readonly literal types at compile time. It is consumed with `STEPS.map(...)`.

## 10. Exact step fields

Every step has exactly these fields:

- `id` — internal React key value; it is not rendered visibly.
- `number` — two-character display marker such as `"01"`; rendered in the marker span.
- `name` — rendered as the step `<h3>`.
- `summary` — rendered as the step `<p>`.

There are no URLs, CTA labels, status fields, property ids, dates, icons, completion flags, or interaction handlers in a step object.

## 11. Current five steps

The current literal step values are:

1. **Enquire** — `Tell us what you're looking for, and we'll share the right options.`
2. **Site Visit** — `Visit the property with our team and explore the layout and surroundings.`
3. **Legal Verification** — `Review approvals, title documents, and property details with complete clarity.`
4. **Book & Pay** — `Select your plot and complete the booking with a clear payment schedule.`
5. **Registration** — `We coordinate the registration process and guide you through the final handover.`

## 12. Step ordering

The source order is fixed by the `STEPS` array and is:

```text
01 enquire
02 visit
03 legal
04 book
05 registration
```

The component does not sort, filter, reverse, or otherwise reorder the array.

## 13. Step rendering behavior

The component renders an ordered list, `<ol className="pd-journey__steps">`. For each entry, `STEPS.map` renders:

```tsx
<li key={step.id} className="pd-journey__step">
  <span className="pd-journey__marker" aria-hidden="true">
    {step.number}
  </span>
  <h3>{step.name}</h3>
  <p>{step.summary}</p>
</li>
```

All five steps are rendered at once. There is no active step, detail panel, expansion, selection, animation, or conditional rendering.

## 14. State variables

`BuyingJourneySteps` declares no state variables. It does not call `useState` or maintain an active step.

## 15. Derived values

The component has no derived values. It uses the `step` object supplied directly by `STEPS.map` and does not calculate values from a property or user input.

## 16. Functions

The only component function is the default function component `BuyingJourneySteps()`. The only rendering operation specific to the steps is the inline callback passed to `STEPS.map`.

There are no journey-specific event handlers, navigation functions, submit functions, toggle functions, or formatting helpers.

## 17. Hooks

The component uses no React hooks. It has no `useState`, `useEffect`, `useMemo`, `useRef`, `useId`, or custom hook usage.

## 18. Interaction behavior

No step is interactive. The step markers, headings, and descriptions are non-button, non-link content. There is no click, hover selection, keyboard action, focus state, active step, or expandable content implemented by `BuyingJourneySteps`.

## 19. Loading behavior

There is no Loading state or loading UI. The component is synchronous static markup and does not wait for property, document, journey, or other data.

## 20. Error behavior

There is no Buying Journey error state, error boundary, retry action, or error message. The component performs no operation that can make a journey-specific request.

## 21. Empty-state behavior

There is no empty-state branch or empty-state message. The source always contains five entries in `STEPS` when the component is built and rendered.

## 22. Missing-field behavior

There is no fallback or validation for missing step fields. The component directly renders `step.number`, `step.name`, and `step.summary`. In the current source, all five objects contain all four expected fields. Behavior for a future malformed object is UNKNOWN — needs verification.

## 23. CTA/button behavior

Buying Journey contains no CTA, button, WhatsApp action, email action, enquiry action, site-visit action, payment action, or registration action. The text describes those stages but does not implement them.

The nearby Property Details CTAs are separate components. They are not descendants of `BuyingJourneySteps` and are not triggered by its content.

## 24. Link/route behavior

Buying Journey renders no links and defines no routes or anchor navigation. It does not navigate to `/`, `/properties`, `/properties/{propertyId}`, WhatsApp, email, documents, or any other destination.

The section’s heading id is `pd-journey-title`; this is an accessibility target used by `aria-labelledby`, not a link or route. No separate Buying Journey anchor id is present.

## 25. Analytics behavior

`BuyingJourneySteps.tsx` contains no `data-track`, `data-track-property`, or `data-track-meta` attributes and does not call `trackEvent`. Therefore it emits no Buying Journey-specific analytics event.

The global delegated click tracker in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\useClickTracking.ts` can track elements carrying those data attributes, but this component carries none. Page-level `useTrackPropertyView(property.id)` in `PropertyPageView` tracks property view/revisit/time events independently; those are not Buying Journey events.

## 26. Desktop behavior

Above the mobile breakpoint, `.pd-journey__steps` uses a five-column CSS grid:

```css
grid-template-columns: repeat(5, minmax(0, 1fr));
gap: clamp(1rem, 3vw, 3rem);
```

The five step items appear horizontally in source order. A one-pixel horizontal connector is rendered by `.pd-journey__steps::before`, from `left: 1.15rem` to `right: 1.15rem`, at `top: 1.15rem`. Each marker sits over that connector.

Exact behavior at particular desktop viewport widths beyond the CSS rules is UNKNOWN — needs verification.

## 27. Mobile behavior

At `@media (max-width: 700px)`, the list becomes a vertical timeline. Each `.pd-journey__step` spans both grid columns and uses a two-column grid with a `2.3rem` marker column and a content column. The marker occupies the first column and the heading/description occupy the second.

The last step removes its bottom padding with `.pd-journey__step:last-child { padding-bottom: 0; }`.

## 28. Responsive behavior

The responsive breakpoint is exactly `max-width: 700px`:

- Above `700px`: five columns and a horizontal connector.
- At or below `700px`: one vertical sequence, a vertical connector, and two-column step rows.

On mobile, `.pd-journey__steps::before` changes from horizontal to vertical by setting `top: 1.15rem`, `bottom: 1.15rem`, `left: 1.15rem`, `right: auto`, `width: 1px`, and `height: auto`.

## 29. CSS classes

Buying Journey markup uses these classes:

- `pd-section` — shared section base.
- `pd-journey` — Buying Journey section and theme/layout rules.
- `pd-section__inner` — centered section content wrapper.
- `pd-kicker` — `Buying journey` label.
- `pd-section__lead` — introductory lead paragraph.
- `pd-journey__steps` — ordered list/grid and connector pseudo-element.
- `pd-journey__step` — individual step item.
- `pd-journey__marker` — numbered circular marker.

The relevant CSS is in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`. The section-specific CSS variables are `--journey-ink`, `--journey-muted`, `--journey-gold`, and `--journey-line`.

## 30. Relationship with PropertyRecord

There is no direct relationship in the component implementation. `BuyingJourneySteps` does not import `PropertyRecord` and receives no `property` prop. It therefore does not use the property id, name, location, price, documents, timeline, coordinates, or any other record field.

The surrounding `PropertyPageView` does receive `property: PropertyRecord`, but that record is passed only to the other property-detail components that require it.

## 31. Relationship with PropertyPageView

`PropertyPageView` imports `BuyingJourneySteps` and renders `<BuyingJourneySteps />` after `<SatelliteBeforeAfter property={property} />` and before `<SimilarProperties items={similar} />`.

`PropertyPageView` does not pass state, props, callbacks, loading status, error status, or property data to the Buying Journey. Changes to `property` do not change this component’s rendered content.

## 32. Relationship with PropertyHero / enquiry

`PropertyHero` is rendered before the Buying Journey and owns the top-of-page enquiry actions. `PropertyPageView` constructs the hero’s `whatsappHref` using `whatsappUrl(waText)` and its `siteVisitHref` using `siteVisitMailto(property)`.

Those hero links are independent of Buying Journey. The `Enquire` and `Site Visit` step descriptions do not link to or invoke the hero’s WhatsApp or email actions. There is no callback from Buying Journey to `PropertyHero` or to an enquiry flow.

## 33. Relationship with LegalDocuments / verification

`LegalDocuments` is the immediately preceding verification section. It receives `property` and `documentsState` and renders actual document loading/error/empty/published states. Buying Journey receives none of that state.

The `Legal Verification` step is explanatory copy only. It does not open the `#documents` section, inspect documents, call the document API, or interact with `LegalDocuments`.

## 34. Relationship with Property Popup

Buying Journey is not rendered in the Property Popup/`PropertySheet`. The popup is a separate map/list experience and does not import or render `BuyingJourneySteps`.

The popup’s property-detail navigation can lead to `/properties/{propertyId}`, where the full Property Details page then renders Buying Journey as part of `PropertyPageView`. No popup state, props, CTA, or analytics event is shared with this component.

## 35. Dependencies

Direct implementation dependencies are:

- React/Next rendering through the function component syntax.
- The local `STEPS` constant.
- `PropertyDetail.css` for styling, loaded by `PropertyPageView`.

The component has no direct dependency on API services, `PropertyRecord`, analytics, `next/link`, `next/image`, MapLibre, WhatsApp helpers, email helpers, localStorage, or modal components.

## 36. Known issues

- The component is static and does not reflect property-specific or API-provided buying-process data.
- The `Legal Verification`, `Book & Pay`, and `Registration` descriptions describe activities but do not implement document review, payment, booking, or registration workflows.
- No step is interactive and there is no direct CTA from the section to the enquiry features.
- The section has no loading, error, empty, or malformed-data handling.
- The homepage `BuyingJourney` component and the property-detail `BuyingJourneySteps` component are separate implementations; changes to one do not automatically affect the other.
- Exact behavior if the compile-time `STEPS` data is changed to contain missing fields is UNKNOWN — needs verification.

## 37. Important constraints

- Preserve the component name `BuyingJourneySteps` and its current no-props contract unless every `PropertyPageView` usage is intentionally updated.
- Preserve the current source-of-truth location for the five property-detail steps: the module-level `STEPS` array in `BuyingJourneySteps.tsx`.
- Preserve the exact current field contract `id`, `number`, `name`, and `summary` if modifying the data-driven map.
- Preserve the current five-step order unless the intended user-facing process order changes: Enquire, Site Visit, Legal Verification, Book & Pay, Registration.
- Do not assume the step text implements an enquiry, visit, verification, booking, payment, or registration integration; none exists in this component.
- Keep the section heading id `pd-journey-title` aligned with `aria-labelledby` and any consumers that intentionally target it.
- Preserve the semantic ordered list and non-interactive `<li>` rendering unless accessibility and interaction requirements intentionally change.
- Preserve the CSS breakpoint at `max-width: 700px` and the horizontal desktop/vertical mobile connector behavior unless the responsive contract intentionally changes.
- Do not add property-specific behavior by assuming `PropertyRecord` is available; the current component receives no property data.
- Do not attribute nearby hero, final CTA, sticky CTA, page-view, or popup analytics to Buying Journey; the component currently emits no analytics events.
- Application files were not modified for this documentation task. Existing working-tree changes, including the pre-existing change to `BuyingJourneySteps.tsx`, must be preserved.