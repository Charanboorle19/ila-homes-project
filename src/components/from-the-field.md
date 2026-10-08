# From the field

This document describes the homepage **From the field** section, which presents local plot walkthrough content and links visitors to the ILA Homes Instagram profile.

## Purpose

The section is a social-media-style showcase intended to make the property experience feel current and grounded in real locations. It loads the tenant's currently active Instagram reel from the public tenant API and keeps the profile card alongside it. Its message is:

```text
From the field
Hear it straight from the ground
Short walkthroughs. Real plots. No filters.
```

The section does not embed Instagram content. It fetches one active reel link dynamically, uses a local decorative thumbnail, and opens the canonical Instagram URL in a new browser tab.

## Source and homepage placement

| Responsibility | Source |
| --- | --- |
| React component and rendering states | [`src/components/FromTheField.tsx`](./FromTheField.tsx) |
| Section styling and responsive rules | [`src/components/FromTheField.css`](../src/components/FromTheField.css) |
| Active reel API service | [`src/services/tenantReelsService.ts`](../services/tenantReelsService.ts) |
| Homepage integration | [`src/app/page.tsx`](../app/page.tsx) |

`HomePage` renders the section after `EmiAppreciation` and before `PlotsWithPulse`:

```jsx
<EmiAppreciation />
<FromTheField />
<PlotsWithPulse />
```

The component imports `FromTheField.css` directly, so the homepage does not require a separate stylesheet import for this section.

## Component structure

The component renders a labelled `<section>` containing:

1. An introductory header.
2. A reels area containing one linked vertical card when an active tenant reel is available.
3. An Instagram profile card containing the account image, handle, bio, follow link, and static counts.

The component props are:

```js
{
  handle = '@ila.homes',
  profileUrl,
  profileImage,
  followers = '26K+',
  reelCount = '50+',
}
```

The props configure account information and profile imagery. Reel data is loaded from the active tenant reel API rather than passed as static component data.

## Active reel card

The component calls:

```http
GET /api/tenant/reels/active
```

The request is public and is routed through `apiFetch`, which sends `Accept: application/json` and the current `X-Tenant-Domain` header. The service accepts the documented response shape:

```ts
{
  success: true,
  data: {
    id: string,
    reel_url: string,
    is_active: boolean,
  } | null,
}
```

Only one card is rendered, preventing duplicate static reel content. The card:

- Opens `reel_url` in a new tab using `target="_blank"`.
- Uses `rel="noopener noreferrer"` for external-link safety.
- Uses the accessible label `Watch the latest ILA Homes reel`.
- Uses a local thumbnail as decorative presentation imagery.
- Displays a decorative play icon in the center.
- Displays `Latest ILA Homes reel` at the bottom of the card.

The API normalizes Instagram URLs to the canonical `/reel/{shortcode}/` format. Non-Instagram URLs are preserved by the backend according to the documented contract.

## Instagram profile card

The right-hand profile card shows:

- Profile handle: `@ila.homes`
- Profile bio: `Follow for weekly plot walkthroughs, location updates & investment tips.`
- CTA: `Follow on Instagram`
- Static profile summary: `26K+ Followers · 50+ Reels`

The profile card is an `<aside>` labelled `Instagram profile`. The CTA opens the configured Instagram profile URL in a new tab with the same external-link protections as the reel cards.

## Assets

The component uses these local assets:

| Use | Asset |
| --- | --- |
| Mansanpally reel thumbnail | [`src/assets/plots-pulse/mansanpally.jpg`](../src/assets/plots-pulse/mansanpally.jpg) |
| Kokapet Heights reel thumbnail | [`src/assets/plots-pulse/kokapet.jpg`](../src/assets/plots-pulse/kokapet.jpg) |
| Nallagandla reel thumbnail | [`src/assets/plots-pulse/nallagandla.jpg`](../src/assets/plots-pulse/nallagandla.jpg) |
| Default Instagram profile image | [`src/assets/about-panel/hero-property.jpg`](../src/assets/about-panel/hero-property.jpg) |

Images are imported through Vite. Reel thumbnails use lazy loading and asynchronous decoding. They are decorative because the surrounding accessible link label and text provide the meaningful content, so the images intentionally use empty `alt` attributes.

## Desktop layout and styling

The section uses a light warm background with gold accents:

- Background color: `#f0ebe4`.
- The main content is constrained by the shared `--max` width.
- The main grid uses a wider reels column and a narrower profile column.
- The reels display as three equal-width vertical cards.
- Cards use a `9 / 16` aspect ratio, rounded corners, a dark fallback background, and a bottom gradient overlay for readable labels.
- Hover and keyboard focus slightly enlarge the card and add a gold border/glow.
- The profile image is circular with a gold gradient ring.
- The Instagram CTA uses a transparent background with a gold border and gold text, changing to a filled gold button on hover or focus.

## Responsive behavior

At viewport widths of `980px` and below:

- The two-column layout becomes a single column.
- The active reel card becomes a horizontally scrollable row when present.
- Horizontal scrolling uses scroll snapping.
- Scrollbars are hidden visually while touch scrolling remains enabled.
- Each card uses a compact mobile width of up to `12.5rem`.
- The profile card moves below the reel row.

At viewport widths of `520px` and below, cards use a smaller maximum width of `11.25rem` while preserving the vertical reel format.

## Accessibility

The implementation includes:

- A semantic section labelled by its heading through `aria-labelledby`.
- A reels container with `role="list"`.
- The active reel anchor is exposed as a list item and has an explicit `aria-label`.
- Decorative thumbnail images use empty alt text.
- Decorative play icons are hidden with `aria-hidden="true"`.
- Keyboard-visible focus styles for reel cards and the Instagram CTA.
- External links use `rel="noopener noreferrer"`.
- Reduced-motion rules disable card scaling, image zoom, and CTA transitions for users who request reduced motion.

## Current limitations
The section still has static profile presentation values, but the reel link is API-backed:

- Follower count and reel count remain hard-coded display values.
- The active reel endpoint is a tenant API endpoint, not the Instagram API.
- The reel thumbnail and display label are presentation fallbacks; the reel URL comes from the API.
- Instagram data is not fetched from the Instagram API.
- A `data: null` response hides the reel card while retaining the profile card.
- Loading and fetch-error states are shown in the reel area.
- The local thumbnail may not exactly match the media available at the external Instagram destination.
If live profile counts or media thumbnails are required, they should come from an approved content-management or social-media integration rather than be read directly from the client.

## Verification checklist

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```bash
npm run build
```

Manual checks:

1. Confirm the section appears after the EMI calculator on the homepage.
2. Confirm the heading and lede are visible.
3. Confirm the active reel card shows its thumbnail, play icon, and latest-reel label when the API returns data.
4. Activate the reel card with keyboard focus and verify its focus styling and accessible label.
5. Confirm the card opens the API-provided Instagram reel URL in a new tab.
6. Confirm the profile card displays `@ila.homes`, the bio, CTA, and static counts.
7. Confirm the Instagram CTA opens the profile URL in a new tab.
8. Confirm `data: null` hides only the reel card and keeps the profile card visible.
9. Test loading and API-error states.
10. Test the desktop two-column layout and the mobile horizontal reel scroller.
11. Test with reduced-motion preferences enabled.
