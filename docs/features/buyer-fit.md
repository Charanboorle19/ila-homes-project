# Buyer Fit feature

This document describes the current Buyer Fit implementation only. In source, the feature is implemented by `LifeStageMatch` and is rendered inside the Property Details page. It is separate from the homepage `FindYourPlot` component: Buyer Fit is property-specific, while Find Your Plot uses static homepage recommendation data.

## 1. Feature purpose

Buyer Fit explains how the currently viewed plot/property matches four buyer goals. The visitor selects a goal and sees that property's fit percentage and a property-specific reason. It is guidance UI; it does not rank a catalogue, make a booking, submit an enquiry, or calculate a buyer score in the browser.

## 2. Where it appears

Buyer Fit appears on the Property Details route `/properties/{propertyId}`, immediately after the property hero and before Future Neighbourhood. It is present in the shared `PropertyPageView` template for local/static properties and API-backed UUID properties.

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\LifeStageMatch.tsx` — Buyer Fit UI, goal selection, animated score display, and result presentation.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — renders `<LifeStageMatch property={property} />`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ApiPropertyView.tsx` — independently fetches API life-stage fit and passes the mapped property record to the shared page.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — `fetchPropertyLifeStageFit` and API response types.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts` — persona normalization, score clamping, fallback states, and mapping into `lifeStageMatch`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `LifeStageKey`, `LifeStageMatchEntry`, and `PropertyRecord.lifeStageMatch` types/data.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — Buyer Fit layout, visual states, animation, and responsive rules.

## 4. Component names

The primary component is `LifeStageMatch`, default-exported from `LifeStageMatch.tsx`. The surrounding composition component is `PropertyPageView`. API loading is handled by `ApiPropertyView`; API normalization is handled by `apiPropertyToRecord` and `lifeStageFitToMatch`.

## 5. Props

`LifeStageMatch` accepts one prop:

```ts
{
  property: PropertyRecord;
}
```

It accepts no callbacks, API client, selected goal, score, or result props. `PropertyPageView` receives `property: PropertyRecord` and passes it through. `ApiPropertyView` itself accepts `{ id: string }`.

## 6. Data source

The displayed data comes from `property.lifeStageMatch[goal]`, where each entry contains `score`, `reason`, and optional `pending` or `unavailable` flags. For local/static properties, this data is present in the static `PropertyRecord`. For API UUID properties, it is populated from the separate life-stage-fit request and mapped into the same record shape.

Buyer Fit is therefore API-backed for API properties, but not exclusively API-backed: local/static property records use static data. It is not a static homepage recommendation feature.

## 7. API endpoints and parameters

For an API property, the fit request is:

```text
GET /api/properties/{propertyId}/life-stage-fit
```

`propertyId` is URL-encoded and is the API property UUID. No query parameters are added. The request also receives the page's `AbortSignal` through `apiFetch`; `apiFetch` supplies the application's normal API configuration and tenant behavior.

The expected response data is `{ property_id, personas }`, where each persona has `persona`, `fit_percentage`, and `reason`. There is no separate Buyer Fit endpoint for Find Your Plot.

## 8. Buyer goals/options

The exact four options are:

| Id | Label | Description |
|---|---|---|
| `family` | `Starting a family` | `Space, schools, and everyday ease.` |
| `investment` | `Investment first` | `Corridor upside and resale narrative.` |
| `building` | `Building my home` | `Plot geometry ready to construct.` |
| `retirement` | `Quiet retirement` | `Softer pace and open sky.` |

The initial selected goal is `family`.

## 9. Matching logic

The component selects one goal at a time and reads the corresponding entry from the current property's `lifeStageMatch` record. It does not match the visitor against multiple properties and does not use browser-entered preferences.

For API data, persona names are normalized by trimming, lowercasing, and converting spaces/hyphens to underscores. Supported aliases map to the four goals, including `starting_a_family`, `investment_first`, `building_my_home`, and `quiet_retirement`, plus their compact and short aliases. Unknown personas are skipped with a console warning.

## 10. Score/calculation logic

There is no client-side buyer-fit formula, weighted calculation, averaging, or score ranking. For API personas, `fit_percentage` is accepted only when it is a finite number, rounded with `Math.round`, and clamped to the inclusive range 0–100. A missing or invalid percentage becomes unavailable rather than a real 0% score.

The visual meter width is `Math.min(target, 100)%`. The displayed numeric score is animated from the prior shown value to the target with a 620 ms cubic ease-out count-up, but that animation does not change the score.

## 11. Result structure

Buyer Fit has one current result object for the selected goal:

```ts
{
  score: number;
  reason: string;
  pending?: boolean;
  unavailable?: boolean;
}
```

The selected goal, its label, and its result are displayed. There is no array of matched properties, result pagination, result ordering, or ranked result list.

## 12. Displayed result fields

The result panel displays:

- The selected goal label.
- The score, followed by `% match`, when a score is available.
- A horizontal visual meter representing the score.
- The property's reason text.

When no score is available, the score displays `—`, the meter has no filled span, and the reason is the applicable pending or unavailable message.

## 13. State variables

`LifeStageMatch` owns:

- `goal`, initialized to `"family"`.
- `animated`, initially `null`, containing `{ goal, value }` when the count-up has produced a frame.
- `shownRef`, initialized from the selected target score, storing the last animated numeric value.

`ApiPropertyView` separately owns `lifeStage`, initialized as `{ status: "pending" }`; its possible statuses are `pending`, `ready`, and `unavailable`.

## 14. Derived values

The component derives `match` from `property.lifeStageMatch[goal]`, `activeGoal` from `GOALS.find`, `pending` from `match.pending`, `noScore` from `pending || match.unavailable`, `target` from `match.score`, and `displayScore` from the goal-matched animated value or target. `apiPropertyToRecord` derives the final `lifeStageMatch` record through `lifeStageFitToMatch`.

## 15. Functions

The component's interaction handler is the inline button callback `setGoal(item.id)`. Its animation effect defines `tick`, which calculates the eased count-up value and schedules the next `requestAnimationFrame`; cleanup calls `cancelAnimationFrame`.

The directly related data functions are `fetchPropertyLifeStageFit`, `lifeStageFitToMatch`, `normalizePersonaKey`, and `apiPropertyToRecord`. There is no Buyer Fit-specific submit, save, share, enquiry, or navigation function.

## 16. Hooks

`LifeStageMatch` uses `useState`, `useRef`, and `useEffect`. `useEffect` animates score changes and cleans up the animation frame. `useRef` preserves the currently shown score between goal changes.

`ApiPropertyView` uses `useEffect` for the independent life-stage-fit request and `useState` for its source status. It uses `AbortController` cleanup when the property id changes or the component unmounts.

## 17. User interaction

The visitor clicks one of four native goal buttons. The selected goal changes immediately, updates the result label, switches the score/reason, and restarts the meter animation. The score count-up is skipped when reduced motion is requested. No form submission or confirmation action is required.

## 18. Selection behavior

Exactly one goal is selected at all times. The initial selection is `Starting a family`. Clicking another goal replaces the selection; clicking the already active goal simply sets the same id again and produces no alternate state. Buttons expose the current selection through `aria-pressed`.

## 19. Loading behavior

For an API property, the main property page renders independently of Buyer Fit. While `/life-stage-fit` is pending, the selected goal shows `—`, the reason `Working out how this fits…`, and a shimmer-style pending meter with no filled score span. The property page does not wait for this request and there is no full-page Buyer Fit spinner.

## 20. Error behavior

If the life-stage-fit request fails, `ApiPropertyView` logs `[property] life-stage-fit failed` and changes the source to `unavailable`. Buyer Fit then renders `—` and `No fit score published for this property yet.` rather than leaving the loading state active. The rest of the property page remains available.

If the main API property request fails, the surrounding page—not Buyer Fit specifically—shows `Property unavailable` and a `← Back to properties` link, so Buyer Fit is not rendered.

## 21. Empty-state behavior

An empty `personas` array, omitted persona, unknown persona, missing fit object, invalid score, or null score does not produce a match. The affected goal uses score `0` internally but is flagged unavailable and displays `—` with `No fit score published for this property yet.` No “no matches” property list exists because this feature does not return a list of properties.

## 22. Reset behavior

There is no explicit reset button. The selected goal resets to `family` when `LifeStageMatch` mounts anew, such as when its parent is remounted for a different page instance. Changing the `property` prop does not have a component effect that explicitly resets `goal`; normal route/page remount behavior is the confirmed reset path. API loading state resets to pending when `ApiPropertyView` initializes for a new id.

## 23. Navigation behavior

Buyer Fit itself has no links and does not navigate when a goal is selected. It does not open a property route, catalogue route, enquiry flow, or share URL. Property Details navigation remains controlled by the surrounding Property Details components, not by Buyer Fit.

## 24. Analytics

No Buyer Fit-specific analytics event, `data-track` attribute, `trackEvent` call, or analytics hook is present in `LifeStageMatch`. The allowed analytics vocabulary includes `PERSONA_SELECT` and `MATCH_RESULT_VIEW`, but their presence in the event definitions does not confirm that Buyer Fit emits them; the inspected Buyer Fit implementation does not.

The surrounding Property Details page independently emits property-view lifecycle analytics through `useTrackPropertyView`, including `PROPERTY_VIEW`, possible `PROPERTY_REVISIT`, and `TIME_ON_PROPERTY`. Those are page analytics, not Buyer Fit goal-selection analytics. Exact section-level analytics for this component are UNKNOWN — needs verification.

## 25. Relationship with Find Your Plot

Buyer Fit and Find Your Plot are separate implementations. `FindYourPlot` is a homepage `/` component using static `propertyLayouts`, life-stage data, preference tags, and its own matching logic. Buyer Fit is `LifeStageMatch` inside `/properties/{propertyId}` and uses the current property's `lifeStageMatch` record, with API fit data for API properties.

No shared Buyer Fit/Find Your Plot state, callback, result handoff, formula, endpoint, or synchronization is confirmed. Buyer Fit does not reuse Find Your Plot's preference scoring or ranking.

## 26. Relationship with Property Details

Buyer Fit is a section of the shared Property Details template. `PropertyPageView` renders it after `PropertyHero` and passes the normalized `PropertyRecord`. Local records and API records use the same `LifeStageMatch` UI contract. Buyer Fit does not control the hero, gallery, maps, documents, EMI calculator, similar properties, final CTA, or sticky CTA.

## 27. Relationship with Wishlist/Favourites

Buyer Fit has no confirmed relationship with Wishlist/Favourites. It does not read or write API favourites, `ila-wishlist-{id}`, `ila-interested-{id}`, ShortlistShare state, or any saved-item store. The result does not add a property to a wishlist/favourites list.

## 28. Desktop behavior

At desktop widths, the Buyer Fit content is a two-column grid: goal controls occupy the wider left column (`1.15fr`) and the result panel occupies the right column (`0.85fr`). At widths of at least 980px, the four goal buttons become a two-column grid. The section is a full-width dark band; no sticky Buyer Fit panel is defined.

## 29. Mobile behavior

Below the desktop breakpoint, the goal controls and result panel use the default single-column grid. Goal buttons stack vertically, and the result panel follows them. The same four buttons, score/reason content, native keyboard behavior, and meter remain available; there is no mobile sheet, carousel, or alternate mobile result component.

## 30. Responsive breakpoints

The Buyer Fit-specific layout breakpoint is `@media (min-width: 760px)`, where `.pd-match__grid` becomes two columns. A second breakpoint, `@media (min-width: 980px)`, changes `.pd-match__goals` to two columns. The stylesheet also has a global Property Details `@media (prefers-reduced-motion: reduce)` block. No other Buyer Fit-specific breakpoint is confirmed.

## 31. CSS/classes

Buyer Fit uses these primary classes:

- `.pd-match` — dark Buyer Fit section background and contrast styling.
- `.pd-match__grid` — goal/result layout.
- `.pd-match__goals` — goal button collection.
- `.pd-match__goal` and `.pd-match__goal.is-active` — goal controls and selected state.
- `.pd-match__goal-label`, `.pd-match__goal-desc` — option text.
- `.pd-match__result` — result card.
- `.pd-match__goalname`, `.pd-match__score`, `.pd-match__score-value`, `.pd-match__score-unit` — result typography.
- `.pd-match__meter`, `.pd-match__meter > span`, `.pd-match__meter--pending`, `.pd-match__score-value--pending` — score meter and pending state.
- `.pd-match__reason` — explanation text.

Animations are `pd-match-meter-in`, `pd-match-meter-pending`, and `pd-match-reveal`. The CSS source is `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`.

## 32. Accessibility

The section is a semantic `<section>` labelled by the heading `How this plot matches your goal` through `aria-labelledby="pd-match-title"`. The goal controls are native `<button type="button">` elements in a `role="group"` labelled `Life stage goals`. Each button exposes selection through `aria-pressed`.

The result panel has `aria-live="polite"`, so goal/result changes can be announced. The meter uses `role="img"` and an accessible label of either `No fit score` or `{target} percent match`. Reduced-motion users are detected with `matchMedia`, which prevents the JavaScript count-up; the stylesheet also removes the Buyer Fit animations in its reduced-motion block. Exact screen-reader behavior for all animation transitions is UNKNOWN — needs verification.

## 33. Dependencies

The feature depends on React hooks, the `PropertyRecord`/life-stage types, the shared Property Details composition, the internal `apiFetch` client for API properties, `propertiesService`, `propertyMapper`, and `PropertyDetail.css`. It does not depend on Find Your Plot, a map library, localStorage, favourites services, a modal library, or a result-ranking library.

## 34. Known issues

- Buyer Fit has no client-visible distinction between an API failure and an API response with no usable scores beyond the same unavailable message.
- API personas not recognized by the alias map are skipped and only produce the generic unavailable fallback for that goal.
- Duplicate API personas for one goal are not merged; the first recognized persona wins.
- The feature does not expose a result-property list, so “no matches” is represented as no score rather than an empty ranked result set.
- Buyer Fit-specific analytics are not implemented in the inspected component, despite related persona/matching event names existing in the analytics vocabulary.
- The exact server-side formula that produced `fit_percentage` is not present in the frontend. `UNKNOWN — needs verification`.
- Exact backend validation and semantics for `property_id` versus returned `data.property_id` are UNKNOWN — needs verification.

## 35. Important constraints

- Preserve the distinction between property-specific Buyer Fit and homepage Find Your Plot; do not claim shared matching or scoring logic without new code evidence.
- Preserve the four goal ids, labels, descriptions, and the initial `family` selection unless the current UI contract intentionally changes.
- Preserve `GET /api/properties/{propertyId}/life-stage-fit` and the UUID path parameter for API properties.
- Preserve the `PropertyRecord.lifeStageMatch` shape and the pending/unavailable distinction; do not present missing data as a genuine 0% fit.
- Keep the life-stage-fit request independent of the main property request so a fit failure does not remove the rest of the Property Details page.
- Do not add or infer Buyer Fit ranking, property navigation, save/share/enquire actions, Wishlist/Favourites synchronization, or analytics events from the current implementation.
- Preserve native button semantics, `aria-pressed`, the labelled goal group, polite result announcements, meter labelling, and reduced-motion behavior.
- Application code was not modified for this documentation task; unrelated existing working-tree changes must be preserved.