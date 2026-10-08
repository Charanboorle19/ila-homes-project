# FAQ

This document describes the homepage **FAQ** section. It provides concise answers to common plot-buyer questions about legal verification, approvals, comparison, financing, the buying timeline, and family review.

## Purpose

The FAQ section is intended to reduce uncertainty before a prospective buyer contacts ILA Homes. Its displayed messaging is:

```text
FAQ
Answers before you
make the call.

Clear responses to the questions buyers ask most — legal checks, process, financing, and how we help you decide.
```

The section is informational. It does not fetch answers from an API, submit a form, or provide legal or financial advice beyond the explanatory copy shown in the component.

## Source and homepage placement

| Responsibility | Source |
| --- | --- |
| Questions, answers, and accordion state | [`src/components/Faq.jsx`](../src/components/Faq.jsx) |
| Layout, colors, typography, and responsive rules | [`src/components/Faq.css`](../src/components/Faq.css) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |
| Shared navigation link to the section | [`src/data/site.js`](../src/data/site.js) |

`HomePage` renders the section after **TrustStrip** and before **FinalCta**:

```jsx
<TrustStrip />
<Faq />
<FinalCta />
```

The section has the id `faq`, so site navigation can target it with `/#faq`.

## Questions and answers

The component contains six FAQ entries in this order:

### 1. Are the plots legally verified?

Every shared listing is described as going through title checks, approval-status review, and basic due diligence before it reaches the buyer.

### 2. What approvals should I look for?

Depending on the layout, the component says the team looks for HMDA, DTCP, GHMC, or RERA-linked clearances. It also says the team explains what each approval means for registration and construction.

### 3. Can I compare plots before visiting?

The answer directs buyers to **Compare**, **Find Your Plot**, and shortlist sharing to narrow options by price, size, location, and appreciation signals before scheduling a site visit.

### 4. Do you help with loans and EMI planning?

The component states that ILA Homes supports loan introductions with major banks and helps buyers model EMI against expected appreciation before committing.

### 5. How long does the buying process take?

The answer says most guided transactions move from shortlist to registration in a few weeks, depending on documentation readiness and bank timelines. It also says each step is mapped for the buyer.

### 6. Can my family review the shortlist remotely?

The answer says buyers can share a WhatsApp-ready shortlist containing plot details and context so family members can review the same options without scattered forwarded messages.

## Interaction behavior

The FAQ is implemented as a controlled accordion:

- The first question is open on initial render.
- Clicking an unopened question opens its answer.
- Opening a question closes the previously open question.
- Clicking the currently open question closes it, leaving all answers closed.
- The question control uses a `+` icon when closed and a `−` icon when open.
- Each answer panel is hidden with the native `hidden` attribute when closed.
- There is no animation in the current React/CSS implementation because closed panels are removed from layout with `hidden`.
- The accordion state is local to the component and resets when the component is remounted or the page is reloaded.

The cards are not links. There are no nested routes, external URLs, tracking calls, or submission actions associated with an FAQ answer.

## Implementation details

`Faq.jsx` uses React’s `useState` and `useId` hooks:

- `openId` stores the index of the currently open question.
- The initial value is `0`, which opens the first item.
- `-1` represents the state where no item is open.
- `useId()` generates a unique base id for the button and panel relationships.
- Each trigger receives an id such as `<base-id>-button-0`.
- Each answer panel receives a matching id such as `<base-id>-panel-0`.
- A question button’s `aria-controls` points to its panel.
- A panel’s `aria-labelledby` points back to its question button.

The FAQ list is rendered from the local `FAQS` array. The question text is used as the React key for each item.

## Visual design

The section uses a light accordion treatment:

- Background: approximately `#f7f8fa` with a subtle gold radial accent near the upper-right corner.
- Text: dark near-black for headings and questions, with muted blue-gray for supporting copy.
- Accent: gold for the `FAQ` eyebrow and open-state icon treatment.
- Separators: thin translucent dark lines above and below the list items.
- Open item: white background surface.
- Closed item: transparent background over the section background.
- Question controls: full-width, left-aligned buttons with the question on the left and a compact bordered icon on the right.
- The intro column remains visible while the FAQ list scrolls on larger screens through `position: sticky`.

The section uses the application’s shared `--space`, `--max`, `--font-body`, and responsive sizing variables rather than introducing a separate font or image set.

## Responsive behavior

### Larger screens

The section uses a two-column grid:

- The intro occupies a slightly narrower column.
- The accordion list occupies a slightly wider column.
- The columns have a responsive gap between `1.5rem` and `3rem`.
- The intro has a maximum width of `28rem` and sticks below the header at `5.5rem` while scrolling.
- The FAQ list spans the available width of its column.

### Tablet and mobile widths

At `800px` and below:

- The two-column grid becomes a single column.
- The intro is no longer sticky.
- The intro can expand to a maximum width of `36rem`.
- Section padding is reduced.
- The heading and lead text use smaller responsive font sizes.
- The FAQ list follows the intro vertically.

The controls remain full width, with a minimum one-rem gap between question text and the expand/collapse icon.

## Accessibility

Current accessibility behavior includes:

- A semantic `<section>` labelled by the `faq-heading` heading.
- Native `<button type="button">` controls for every question.
- `aria-expanded` communicates whether a question is open.
- `aria-controls` connects each trigger to its answer panel.
- Each answer uses `role="region"` and is labelled by its corresponding question button.
- The plus/minus icon is marked `aria-hidden="true"` because the expanded state is already exposed through the button’s accessible attributes.
- The native `hidden` attribute prevents closed answers from being read or navigated as visible content.
- Keyboard users can focus and activate the question buttons using standard browser behavior.

The current implementation does not add a custom focus style beyond the browser’s default focus behavior. If the global focus treatment is insufficient against the light background, a component-specific `:focus-visible` style should be added.

## Assets

The FAQ component does not reference images, icons, videos, fonts, or other local assets. Its expand/collapse indicators are text characters rendered inside the component.

## Content and product limitations

The current FAQ is a static frontend content block:

- Questions and answers are hard-coded in `Faq.jsx`.
- There is no CMS or admin editing workflow.
- Answers are not personalized by property, location, buyer type, or transaction stage.
- The legal-verification answer describes a process but does not expose individual title reports or approval documents.
- The approvals answer mentions HMDA, DTCP, GHMC, and RERA-linked clearances but does not identify which approval applies to each listing.
- Loan and EMI language should not be treated as a loan approval, guaranteed interest rate, or financial recommendation.
- “Expected appreciation” is used in the answer without a calculation method or market-data source in this component.
- The buying timeline is an estimate and depends on documentation and bank timelines.
- The section does not currently include a contact, escalation, or “ask another question” action.

For production, FAQ claims should be reviewed by the legal, sales, and finance stakeholders. Approval information should be tied to the relevant property records, financial language should include suitable disclaimers, and frequently changing content should be managed through an approved content workflow.

## Verification checklist

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```bash
npm run build
```

Manual checks:

1. Confirm the section appears after **TrustStrip** and before **FinalCta**.
2. Confirm the `FAQ` eyebrow, heading, lead text, and six questions are visible.
3. Confirm the first answer is open on initial render.
4. Confirm opening another question closes the currently open answer.
5. Confirm clicking the open question closes it.
6. Confirm the plus/minus indicator matches each item’s state.
7. Confirm keyboard users can focus and activate every question button.
8. Confirm the `/#faq` navigation target lands on the section.
9. Test the two-column desktop layout and single-column layout at `800px` and below.
10. Confirm no image or external asset request is required by the FAQ component.
