# From the field

This document describes the homepage **From the field** section, which presents local plot walkthrough content and links visitors to the ILA Homes Instagram profile.

## Purpose

The section is a social-media-style showcase intended to make the property experience feel current and grounded in real locations. Its message is:

```text
From the field
Hear it straight from the ground
Short walkthroughs. Real plots. No filters.
```

The section does not embed Instagram content or fetch posts dynamically. It uses local thumbnail assets and static metadata, with links to Instagram opened in a new browser tab.

## Source and homepage placement

| Responsibility | Source |
| --- | --- |
| React component and default content | [`src/components/FromTheField.jsx`](../src/components/FromTheField.jsx) |
| Section styling and responsive rules | [`src/components/FromTheField.css`](../src/components/FromTheField.css) |
| Homepage integration | [`src/pages/HomePage.jsx`](../src/pages/HomePage.jsx) |

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
2. A reels area containing three linked vertical cards.
3. An Instagram profile card containing the account image, handle, bio, follow link, and static counts.

The default component props are:

```js
{
  reels,
  handle = '@ila.homes',
  profileUrl,
  profileImage,
  followers = '26K+',
  reelCount = '50+',
}
```

The props make the component reusable with different reel data, account information, and profile imagery if the content later becomes data-driven.

## Reel cards

The default reel list contains:

| Title | Location | Duration |
| --- | --- | ---: |
| Plot A3 | Mansanpally | 0:42 |
| Corner plot walk | Kokapet Heights | 0:58 |
| Road-facing lot | Nallagandla | 0:36 |

Each reel record has this shape:

```js
{
  thumbnail,
  title,
  location,
  duration,
  reelUrl,
}
```

Each card is an anchor element and:

- Opens `reelUrl` in a new tab using `target="_blank"`.
- Uses `rel="noopener noreferrer"` for external-link safety.
- Builds an accessible label in the form `Watch reel: location · title`.
- Displays the duration in the top-right corner.
- Displays a decorative play icon in the center.
- Displays the location and title at the bottom of the card.

At present, all three default cards use the same Instagram profile URL:

```text
https://www.instagram.com/ila.homes?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==
```

They are not individual Instagram reel URLs yet.

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

At viewport widths of `900px` and below:

- The two-column layout becomes a single column.
- The reel cards become a horizontally scrollable row.
- Horizontal scrolling uses scroll snapping.
- Scrollbars are hidden visually while touch scrolling remains enabled.
- Each card uses a compact mobile width of up to `12.5rem`.
- The profile card moves below the reel row.

At viewport widths of `520px` and below, cards use a smaller maximum width of `11.25rem` while preserving the vertical reel format.

## Accessibility

The implementation includes:

- A semantic section labelled by its heading through `aria-labelledby`.
- A reels container with `role="list"`.
- Each reel anchor is exposed as a list item and has an explicit `aria-label`.
- Decorative thumbnail images use empty alt text.
- Decorative play icons are hidden with `aria-hidden="true"`.
- Keyboard-visible focus styles for reel cards and the Instagram CTA.
- External links use `rel="noopener noreferrer"`.
- Reduced-motion rules disable card scaling, image zoom, and CTA transitions for users who request reduced motion.

## Current limitations

The section is currently a static content presentation:

- Reel titles, locations, durations, follower count, and reel count are hard-coded defaults.
- Instagram data is not fetched from the Instagram API.
- The displayed `26K+` followers and `50+` reels are not live values.
- The three reel cards currently link to the Instagram profile rather than specific reels.
- The local thumbnails may not exactly match the media available at the external Instagram destination.
- There is no loading, error, or unavailable-content state for external Instagram links.

For production, individual reel URLs and reviewed content metadata should replace the shared profile URL. If live counts or media are required, they should come from an approved content-management or social-media integration rather than being read directly from the client.

## Verification checklist

From `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`:

```bash
npm run build
```

Manual checks:

1. Confirm the section appears after the EMI calculator on the homepage.
2. Confirm the heading and lede are visible.
3. Confirm all three reel cards show their thumbnail, duration, play icon, and location/title label.
4. Activate each reel card with keyboard focus and verify its focus styling and accessible label.
5. Confirm each card opens Instagram in a new tab.
6. Confirm the profile card displays `@ila.homes`, the bio, CTA, and static counts.
7. Confirm the Instagram CTA opens the profile URL in a new tab.
8. Test the desktop two-column layout and the mobile horizontal reel scroller.
9. Test with reduced-motion preferences enabled.
