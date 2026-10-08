# Save your shortlist. Share it on WhatsApp in one tap.

This document describes the homepage **Shortlist + Share** section: its setup, placement, content model, interaction behavior, responsive layout, accessibility treatment, visual assets, and verification status.

## Overview

The section helps visitors choose property layouts, keep a temporary shortlist, and send the selected plot summaries to family through WhatsApp. It is designed around the idea that a land purchase is often reviewed by more than one household decision-maker.

The current implementation is a client-side demo:

- Six property layouts are available as selectable options.
- Two layouts are selected when the component first renders.
- Selection is held in React state for the current page session.
- No login, backend, or `localStorage` persistence is used by this section.
- Sharing opens a WhatsApp text deep link in a new tab/window.
- The generated message contains the selected layout name, location, plot-size/price/tag metadata, and an appreciation score.
- The UI includes copy about a “Shareable link,” but the current implementation does not generate or append a shortlist URL. The actual behavior is text sharing through `https://wa.me/?text=...`.

## Setup and local development

### Requirements

Use the project’s existing Node.js installation and package manager. The application is a Vite + React project.

Install dependencies from the repository root:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite and scroll to the section with the heading **Save your shortlist. Share it on WhatsApp in one tap.**

The production build is generated with:

```bash
npm run build
```

The package scripts are defined in [`package.json`](../package.json). The section does not require a separate route or API service.

## Source and integration map

| Responsibility | Source |
| --- | --- |
| React section component | [`src/components/ShortlistShare.jsx`](../src/components/ShortlistShare.jsx) |
| Component stylesheet | [`src/components/ShortlistShare.css`](../src/components/ShortlistShare.css) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |
| Property/layout data | [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js) |
| Homepage global styles and responsive variables | [`src/index.css`](../src/index.css) |
| Shared application sizing rules | [`src/App.css`](../src/App.css) |
| Section image asset | [`src/assets/Sharing Dream Plots With Family.png`](../src/assets/Sharing%20Dream%20Plots%20With%20Family.png) |

`HomePage` renders the section after [`PlotCompare`](../src/components/PlotCompare.jsx) and before [`EmiAppreciation`](../src/components/EmiAppreciation.jsx):

```jsx
<PlotCompare />
<ShortlistShare />
<EmiAppreciation />
```

The section has the page anchor `#shortlist-share` and the accessible section label `Shortlist and share`.

## Content and data model

`ShortlistShare.jsx` imports all records from `propertyLayouts.js` and maps each record into the smaller shape needed by the UI:

```js
{
  id,
  name: layout.label,
  location: layout.location,
  meta: `${layout.plotSizes} · ${layout.priceRange} · ${layout.tag}`,
  highlight: layout.highlight,
  score,
}
```

The appreciation values are demo values defined locally in the component:

| Layout | Score |
| --- | ---: |
| Singapore Township | 76/100 |
| Nallagandla Enclave | 82/100 |
| Kokapet Heights | 91/100 |
| Khajaguda Residency | 74/100 |
| Patancheru Gateway | 88/100 |
| Mansanpally Meadows | 79/100 |

The initial selected IDs are:

```js
[
  'nallagandla-enclave',
  'kokapet-heights',
]
```

The left side communicates the three-part value proposition:

1. **Save as you browse** — pin plots while exploring without logging in.
2. **WhatsApp-ready card** — build a concise summary for family review.
3. **Shareable link** — the intended content promise; currently the implementation sends the summary text but does not create a link.

## Interaction behavior

### Selecting and removing plots

Each property is rendered as a native `button` with `aria-pressed` reflecting its current state. Clicking an option toggles its property ID in the `pinned` array:

- Selected options show a check mark and selected styling.
- Unselected options can be added with the same button.
- Removing the last selected option is allowed.
- Changing the selection resets the `shared` status to `false`.
- The count message reports `N plot(s) selected`.

The desktop chooser and mobile chooser are two responsive renderings of the same underlying state. Both are assigned distinct keys through the `instance` parameter, but only one chooser is visible at a time through CSS.

### Sharing to WhatsApp

When at least one property is selected, either share button calls `shareOnWhatsApp()`:

1. The selected layout records are read from the memoized `selected` array.
2. `buildShareText()` creates a plain-text message beginning with `My shortlisted plots via ILA Homes`.
3. Each selected layout contributes its name, location, metadata, and appreciation score.
4. The message ends with `Open the shortlist to review together.`
5. The message is URL encoded and appended to `https://wa.me/?text=`.
6. `window.open()` opens the WhatsApp URL in a new tab/window with `noopener,noreferrer`.
7. The button changes to `Shared — open again` until the selection changes.

There is no recipient number field. WhatsApp chooses the recipient after the visitor opens the link.

### Empty state

With no selected plots:

- The count says `Select plots on the right to build your shortlist`.
- The primary left-side share button is disabled.
- The chooser share button says `Select plots to share` and is disabled.
- The share handler returns without opening a window.

## Layout and visual design

The component uses a light, editorial layout with a pale gray surface and restrained gold accent:

- The section background uses a soft gray surface with a subtle gold radial highlight.
- Desktop uses a two-column frame: a narrower content/CTA column on the left and a wider chooser/media area on the right.
- The left column contains the headline, three numbered feature cards, selected-count text, and a WhatsApp CTA.
- The right panel uses a cool gray gradient, a scrollable list of property options, a chooser CTA, and the family-sharing image.
- Selected cards use a white surface, stronger border, shadow, and a gold check indicator.
- The image is displayed with `object-fit: cover` and positioned toward the top of its frame.
- Buttons use the shared site accent variables with local fallbacks: `--accent` and `--accent-light`.

The component stylesheet defines local variables including `--ss-ink`, `--ss-muted`, `--ss-line`, `--ss-surface`, `--ss-soft`, `--ss-gold`, and `--ss-pad-y`. It also depends on global variables from [`src/index.css`](../src/index.css):

- `--font-body` for Montserrat typography.
- `--space` for the shared responsive page gutter.
- `--accent` and `--accent-light` for the site gold action color.

The section is intended to render inside the normal application shell. Mounting it in isolation requires equivalent fallback values for those shared variables.

## Responsive behavior

### Desktop and tablet-wide: above `980px`

- The two-column frame remains visible.
- The left column shows the feature list, selection count, and primary share button.
- The right side shows the property chooser and family image.
- The property chooser is a vertically scrollable list with a stable scrollbar gutter.
- The media and chooser are arranged side by side within the right panel.

### Responsive layout: `980px` and below

- The section switches to a single-column flow.
- The desktop right panel is hidden.
- The left-side count and duplicate left-side share button are hidden.
- The heading becomes a photo-backed intro card using the same family-sharing asset, with a dark gradient overlay for text contrast.
- The mobile chooser is shown below the feature list.
- Property options become horizontally scrollable cards with scroll snapping.
- The mobile chooser has a full-width share button.

### Narrow mobile: `640px` and below

- The photo-backed intro card uses a shorter responsive minimum height.
- Padding and image treatment are tightened for small screens.
- Option names and metadata use smaller sizes and line clamping to prevent long property content from expanding cards excessively.

## Accessibility

Current accessibility measures include:

- The root section has `aria-label="Shortlist and share"`.
- The feature list is an ordered list with `aria-label="How shortlist sharing works"`.
- The chooser group has `role="group"` and `aria-label="All properties"`.
- Plot selectors are native buttons, keyboard reachable, and expose selection through `aria-pressed`.
- Share controls are native buttons and use the disabled state when there is nothing to share.
- The right-side detail area uses `aria-live="polite"` so selection-related content changes can be announced without interrupting the user.
- The primary image has meaningful alternative text: `Sharing dream plots with family on WhatsApp`.
- The decorative mobile background layer is marked `aria-hidden="true"`.
- Check marks and arrow glyphs are hidden from assistive technology where they are decorative.

Accessibility considerations for production:

- The section does not currently provide a visible success message separate from the button label after the WhatsApp window opens.
- Opening a new window can be blocked by browser settings or unavailable if WhatsApp is not installed; the UI does not currently expose a fallback copy/share action.
- The “Shareable link” feature copy should be changed or implemented so the UI promise matches behavior.
- “Save” is temporary React state rather than durable saved data; production requirements may call for authentication or persistence.
- The component stylesheet has hover transitions but does not define a component-local `prefers-reduced-motion` block. Global motion rules exist elsewhere in the application, but this section should be reviewed if its transitions are expanded.

## Assets

The section uses one image:

| Asset | Usage |
| --- | --- |
| [`src/assets/Sharing Dream Plots With Family.png`](../src/assets/Sharing%20Dream%20Plots%20With%20Family.png) | Desktop media image and mobile intro-card background |

The asset is imported through Vite rather than referenced by a hard-coded public URL. Its exact filename includes spaces and must remain synchronized with the import in `ShortlistShare.jsx`.

Property option content comes from [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js). The shortlist section itself does not render those property image fields; the imported family-sharing image is its only direct visual asset.

## Verification checklist

Use the following checks when changing this section:

1. Run `npm run dev` and open the homepage.
2. Confirm the section appears after plot comparison and before the EMI/appreciation section.
3. Confirm Nallagandla Enclave and Kokapet Heights start selected.
4. Toggle several options and verify the count and button labels update.
5. Remove all options and verify both share controls become disabled.
6. Select at least one option and verify the WhatsApp button opens a URL beginning with `https://wa.me/?text=` and contains encoded shortlist text.
7. Check the desktop layout above `980px` and the mobile chooser at or below `980px`.
8. Check horizontal scrolling and scroll snapping for the mobile property cards.
9. Use keyboard navigation to focus and toggle property buttons and share controls.
10. Run the production build:

```bash
npm run build
```

At the time of writing, the build command is the appropriate automated validation for this documentation change. `npm run lint` may be unavailable in the Windows environment if Oxlint’s optional native binding is missing; that is an environment/package-installation issue rather than a section-specific runtime behavior.

## Related sections

This homepage section is distinct from property-detail sharing controls such as [`src/components/PropertyDetail/PropertyFinalCta.jsx`](../src/components/PropertyDetail/PropertyFinalCta.jsx). The homepage component builds a multi-property shortlist, while property-detail controls share or enquire about an individual property.