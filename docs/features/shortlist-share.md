# Shortlist / WhatsApp Share feature

This document describes the current homepage `ShortlistShare` implementation only. It is based on the inspected TypeScript/React source, stylesheet, property-list API, tracked-share service, homepage integration, and directly related analytics/configuration files. It does not describe a server-side shortlist collection or the separate Property Details wishlist/share controls.

## 1. Feature purpose

`ShortlistShare` loads property records from the API, lets a visitor select properties while the component is mounted, creates a tracked share for each selected API property, and sends the selected property summaries and tracked URLs to WhatsApp. The section presents the flow as “Save your shortlist. Share it on WhatsApp in one tap.” It does not persist a shortlist collection, require login, or submit an enquiry.

## 2. Where it appears

The feature appears on the homepage route `/` as the `ShortlistShare` section. Its root element has `id="shortlist-share"` and `aria-label="Shortlist and share"`. No separate feature route is confirmed.

## 3. Homepage position

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` renders the relevant sequence as:

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

Therefore, Shortlist / WhatsApp Share appears immediately after the homepage Buying Guide (`BuyingJourney`) and before `EmiAppreciation`.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\ShortlistShare.tsx` — component, API-property projection, state, selection handlers, tracked WhatsApp URL creation, touch/wheel behavior, markup, and analytics calls.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\ShortlistShare.css` — feature layout, option/card styling, selected/disabled states, scrolling, and responsive rules.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\page.tsx` — homepage import and render position.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — API property-list request and `PropertyListItem` type used to load shortlist options.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` — tracked share creation and public tracking-URL construction.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\ilaApiConfig.ts` — source of `ILA_PROPERTY_ID`, used only as the analytics fallback property id.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\tracker.ts` — analytics transport called by the component.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\share on what'sapp.gif` — WhatsApp-sharing visual asset.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\Family Dreams Over a New Community.png`, `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\Golden-Hour Family Homecoming.png`, `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\Golden Hour Real Estate Growth.png`, and `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\assets\Golden-Hour View of Planned Cityscape.png` — mobile option-card images.

## 5. Component names

The default-exported homepage component is `ShortlistShare` from `ShortlistShare.tsx`.

Internal implementation names include `ShortlistPlot`, `PROPERTY_IMAGES`, `FEATURES`, `toPlot`, `buildShareText`, `togglePlot`, `shareOnWhatsApp`, `renderChoose`, and `handlePanelsWheel`.

## 6. Props

`ShortlistShare` accepts no props:

```tsx
export default function ShortlistShare()
```

All content, selection state, sharing state, and interaction behavior are internal.

## 7. Visible UI

The section visibly contains:

- Heading: `Save your shortlist. Share it on WhatsApp in one tap.`
- Three feature items: `Save as you browse`, `WhatsApp-ready card`, and `Shareable link`.
- A `Choose plots` kicker.
- Heading: `Select properties to shortlist`.
- Supporting copy: `Tap any property to add or remove it from your WhatsApp shortlist.`
- API-loaded selectable property options.
- Each option’s name, slug-derived location, metadata, and description/highlight.
- A selected-count message based on the number of selected properties; loading, empty, and fetch-error messages are shown when applicable.
- A share button in the left panel labelled `Share on WhatsApp`.
- A second share button in the choose-plots panel whose label changes between `Shared — open again`, `Select plots to share`, and `Share {n} plot(s) →`.
- A WhatsApp-sharing GIF on the desktop/right media panel.

## 8. Property data source

The component calls `fetchProperties` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` on mount with `status=ALL`, `page=1`, and `perPage=100`. The returned `PropertyListItem` records are projected into:

```ts
type ShortlistPlot = {
  id: string;
  name: string;
  location: string;
  meta: string;
  highlight: string;
  image: StaticImageData;
};
```

The projection uses the API `id`, `name`, `slug`, `property_type`, `price_label`/formatted price, and `description`. Option images cycle through four imported local assets; these images are presentation placeholders and do not represent API property galleries. No static property records or preset property selections are used by the component.

## 9. Shortlist behavior

Every property returned by the API list response can be shortlisted. Clicking an option calls `togglePlot(plot.id)`. If the API UUID is already in `pinned`, it is removed; otherwise it is appended. The option’s `aria-pressed`, check mark, border/background, and selected class update from the resulting membership. The selection starts empty and is held in memory only.

## 10. Share behavior

The feature has two visible share buttons, both wired to the same asynchronous `shareOnWhatsApp` function. Sharing is allowed only when at least one property is selected. The function calls `createPropertyShares` once per selected API UUID in parallel, converts each returned tracking token with `buildShareUrl`, adds those URLs to the WhatsApp message, opens WhatsApp in a new window, sets `shared` to `true`, and records `WHATSAPP_SHARE_CLICK`.

There is no generic share dialog, native share fallback, or copied-link feedback in this component. The generated links target `/property/{tracking_token}/view`, where the existing tracked-share route resolves the property.

## 11. WhatsApp behavior

After tracked shares are created, `shareOnWhatsApp` opens:

```ts
const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
window.open(url, "_blank", "noopener,noreferrer");
```

The exact text is generated by `buildShareText(selected, urls)` and includes one tracked URL for each selected property. The implementation does not use a phone-number-specific `wa.me/{number}` route.

## 12. Selection state

Selection is represented by an array of API property UUID strings and starts empty. The order of newly added ids follows click order. Removing an item filters it out. There is no maximum selection count.

## 13. State variables

The component declares:

- `properties` / `setProperties`: API-loaded `ShortlistPlot[]`.
- `pinned` / `setPinned`: `string[]` of selected API property UUIDs, initialized empty.
- `shared` / `setShared`: boolean, initialized to `false`; controls the inner share-button label.
- `loading`: indicates the initial property-list request.
- `sharing`: indicates tracked share creation and disables sharing while links are prepared.
- `error`: displays property-loading or sharing errors.
- `mobilePanelsRef`: ref to the mobile `.shortlist-share__panels` element.

The component has no persistent storage, shortlist route, or modal state.

## 14. Derived values

`selected` is memoized from the API-loaded properties and selected UUIDs:

```ts
properties.filter((plot) => pinned.includes(plot.id))
```

It is the ordered set of full `ShortlistPlot` objects corresponding to the selected ids. `isOn` is derived per option with `pinned.includes(plot.id)`. The count and button labels derive from `pinned.length`; the share message derives from `selected`.

## 15. Functions

- `buildShareText(plots, urls)` formats the WhatsApp message with one tracked URL per property.
- `togglePlot(id)` adds/removes an API property UUID, resets `shared` to `false`, and sends shortlist analytics.
- `shareOnWhatsApp()` returns immediately for an empty selection; otherwise creates tracked shares, builds the message, opens WhatsApp, sets `shared`, and sends share analytics.
- `renderChoose(instance)` renders the desktop or mobile chooser and its share button.
- `handlePanelsWheel(event)` passes wheel scrolling to the page when the chooser is at a scroll boundary.
- The `useEffect`-local functions `onTouchStart`, `onTouchMove`, and `restoreOverflow` manage nested mobile panel scrolling.

## 16. Hooks

- `useState` stores `pinned` and `shared`.
- `useMemo` derives `selected` from `pinned`.
- `useRef` stores the mobile panels element.
- `useEffect` attaches and removes passive `touchstart`, `touchmove`, `touchend`, and `touchcancel` listeners for mobile panel scroll handoff.

## 17. Storage behavior

The homepage `ShortlistShare` implementation does not use `localStorage`, `sessionStorage`, cookies, URL query parameters, URL fragments, or an API to persist the shortlist. The selected ids exist only in React state for the mounted component instance. The selection therefore does not survive a page refresh or a component remount.

This state is separate from Property Details keys such as `ila-wishlist-{id}` and `ila-interested-{id}`; no code connection between those keys and `pinned` was found.

## 18. Share URL/message construction

`buildShareText` maps each selected property to:

```text
• {plot.name} · {plot.location}
  {plot.meta}
  {urls[index]}
```

It joins the message as:

```text
My shortlisted properties via ILA Homes

{one formatted block per selected plot}

Open the links to review together.
```

The final WhatsApp URL is exactly `https://wa.me/?text=${encodeURIComponent(text)}`. Each message block contains a tracked `/property/{tracking_token}/view` URL; no single shortlist collection URL is generated.

## 19. Navigation behavior

The option controls are buttons and do not navigate. The share action opens the encoded WhatsApp URL with `window.open(..., "_blank", "noopener,noreferrer")`. No internal route is generated by this feature, and no option links to `/properties/{propertyId}` or `/#projects`.

## 20. Loading behavior

The component starts in a loading state while `fetchProperties` requests up to 100 API properties. During sharing, the button displays `Preparing links…` and is disabled until all selected share requests complete.

## 21. Error behavior

Property-fetch failures display `Properties could not be loaded. Please try again.` and sharing failures display `Sharing failed. Please try again.` Abort errors from unmount are ignored. Browser popup blocking and runtime failures after `window.open` are UNKNOWN — needs verification.

## 22. Empty-state behavior

The component starts with no selected properties. If the user removes all selections, both share buttons are disabled and the inner button says `Select properties to share`. If the API returns no items, the chooser displays an empty-results message rather than static options.

## 23. Reset behavior

Clicking a selected option removes only that option. Any selection change calls `setShared(false)`, so a prior `Shared — open again` label returns to the count-based label. Remounting the component resets the API-loaded list, selection, and sharing state. There is no visible reset-all button.

## 24. Analytics

`ShortlistShare.tsx` directly imports and calls `trackEvent`.

- Add: `SHORTLIST_ADD` with the selected API UUID as `property_id` and metadata `{ property_id, section_type: "shortlist_whatsapp" }`.
- Remove: `SHORTLIST_REMOVE` with the same metadata shape.
- WhatsApp share: `WHATSAPP_SHARE_CLICK` with the first selected API UUID as `property_id` and metadata `{ shortlist_count, property_ids, section_type: "shortlist_whatsapp" }`.

The component has no `data-track` attributes. `ILA_PROPERTY_ID` is read from `NEXT_PUBLIC_ILA_PROPERTY_ID` through `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\ilaApiConfig.ts`. Exact server delivery, batching, and failure handling are owned by the analytics tracker and are UNKNOWN — needs verification.

## 25. Relationship with Find Your Plot

`FindYourPlot` appears immediately before `BuyingJourney`, while `ShortlistShare` appears after `BuyingJourney`. `ShortlistShare` loads its own API property list; it does not receive `FindYourPlot` results, import its state, or automatically shortlist its result cards. No shared selection state or callback is present.

## 26. Relationship with MapSection

`MapSection` is a separate API-backed/map-driven homepage feature. `ShortlistShare` does not import `MapSection`, its map state, `PropertyRecord`, plot units, or map selection callbacks. Although both features can load API properties, no runtime synchronization between map selections and `pinned` is implemented.

## 27. Relationship with Property Details

Property Details uses `/properties/{propertyId}` and has separate controls in `PropertyFinalCta`, including `Save to wishlist`, `I'm interested`, and `Share property`. Those controls use `PropertyRecord`, localStorage keys `ila-wishlist-{id}` / `ila-interested-{id}`, the Web Share API, clipboard, and a WhatsApp fallback. `ShortlistShare` uses none of that state or fallback chain. The two features must not be treated as a shared Wishlist/Favourites/shortlist implementation.

## 28. Relationship with Property Enquiry

The homepage feature is not an enquiry form and does not call an enquiry API, create a mailto link, or use the Property Details enquiry helpers. Its WhatsApp message is a multi-layout sharing summary, not the Property Details enquiry or site-visit templates. A successful `window.open` is not an enquiry submission or confirmation.

## 29. Desktop behavior

Above the mobile breakpoint, the section uses a two-column `.shortlist-share__frame`: a narrower left column for heading/features/count/share and a wider right column for the chooser and WhatsApp media. Desktop property options render as text-first button cards with a check indicator, name, location, metadata, and appreciation score. The right chooser contains a scrollable `.shortlist-share__panels` region. The left panel and right panel share the same selection handlers.

## 30. Mobile behavior

At mobile widths, the layout becomes a single-column flow. The mobile chooser is rendered in `.shortlist-share__choose-mobile`, while the desktop chooser is hidden. Mobile option buttons use a thumbnail image, an overlaid check indicator, and compact text. The mobile panels element has touch listeners that temporarily control `overflowY` at nested-scroll bounds so page scrolling can continue. The mobile share button is full width in the mobile CSS rules.

## 31. Responsive breakpoints

The main responsive switch is `@media (max-width: 980px)` in `ShortlistShare.css`. At this breakpoint the desktop/right arrangement is replaced by the mobile presentation, and the `next/image` media `sizes` hint also uses `(max-width: 980px) 0px, 28vw`.

There is an additional `@media (max-width: 640px)` rule that adjusts the intro card height/padding. No other ShortlistShare breakpoint was confirmed in the inspected stylesheet.

## 32. CSS/classes

The root and major layout classes are `.shortlist-share`, `.shortlist-share__frame`, `.shortlist-share__left`, `.shortlist-share__right`, `.shortlist-share__detail-inner`, `.shortlist-share__copy`, `.shortlist-share__media`, `.shortlist-share__media-frame`, and `.shortlist-share__media-image`.

Intro/content classes include `.shortlist-share__intro`, `.shortlist-share__intro-bg`, `.shortlist-share__intro-content`, `.shortlist-share__heading`, `.shortlist-share__features`, `.shortlist-share__feature-item`, `.shortlist-share__feature`, `.shortlist-share__feature-index`, `.shortlist-share__feature-body`, `.shortlist-share__feature-title`, `.shortlist-share__feature-copy`, `.shortlist-share__feature-line`, and `.shortlist-share__count`.

Chooser/option/action classes include `.shortlist-share__choose`, `.shortlist-share__choose-mobile`, `.shortlist-share__choose-desktop`, `.shortlist-share__detail-head`, `.shortlist-share__detail-kicker`, `.shortlist-share__detail-title`, `.shortlist-share__detail-summary`, `.shortlist-share__panels`, `.shortlist-share__option`, `.shortlist-share__option--media`, `.shortlist-share__option-top`, `.shortlist-share__option-media`, `.shortlist-share__option-image`, `.shortlist-share__option-body`, `.shortlist-share__option-copy`, `.shortlist-share__option-name`, `.shortlist-share__option-loc`, `.shortlist-share__option-meta`, `.shortlist-share__option-score`, `.shortlist-share__option-check`, `.shortlist-share__wa-btn`, and `.shortlist-share__share`.

The selected modifier is `.is-selected` for mobile options and `.is-selected`/the corresponding selected styling in the desktop option rules; disabled styling is defined for `.shortlist-share__wa-btn:disabled` and `.shortlist-share__share:disabled`. Exact visual ownership of any global variables such as `--accent` and `--accent-light` is UNKNOWN — needs verification.

## 33. Accessibility

- The root section has `aria-label="Shortlist and share"`.
- The feature list is an ordered list with `aria-label="How shortlist sharing works"`.
- Property options and share controls are native `<button type="button">` elements and are keyboard activatable.
- Each option exposes selection through `aria-pressed`.
- Decorative check marks, feature indices, connector lines, and the option check overlay are hidden from assistive technology with `aria-hidden="true"`.
- The options container uses `role="group"` and `aria-label="All properties"`.
- The right panel uses `aria-live="polite"`.
- Mobile option images use empty alt text; the main WhatsApp GIF has alt text `Sharing dream plots with family on WhatsApp`.
- Disabled share buttons communicate the no-selection condition through native button disabled semantics.

There is no explicit live announcement for each selection change, no focus management after sharing, and no confirmed keyboard-specific behavior for the nested scroll handoff. Exact assistive-technology behavior is UNKNOWN — needs verification.

## 34. Dependencies

Direct dependencies are React hooks and types, Next.js `Image`, local static image assets, `fetchProperties`/`PropertyListItem`, `createPropertyShares`/`buildShareUrl`, `ILA_PROPERTY_ID`, `trackEvent`, browser `window.open`, DOM touch/wheel/scroll APIs, and `ShortlistShare.css`. No router, localStorage helper, Web Share API, Clipboard API, enquiry helper, MapLibre component, or external modal library is imported by `ShortlistShare.tsx`.

## 35. Known issues

- The shortlist is loaded from one API page (`status=ALL`, `page=1`, `per_page=100`); properties beyond that response are not shown.
- Selection is not persisted and is not synchronized with Find Your Plot, MapSection, or Property Details wishlist state.
- The API `slug` is currently used as the location display because the list item does not provide a dedicated location label; this should be reviewed against the API's intended location fields.
- Option images are local rotating placeholders rather than API-specific property images.
- Tracked-share creation depends on visitor readiness and fails if no visitor code or tracking token is available.
- Popup blocking behavior after successful link creation is UNKNOWN — needs verification.
- The feature has no native Web Share API or clipboard fallback.
- Exact analytics delivery/failure behavior is outside the component and UNKNOWN — needs verification.
- Automated test coverage for this feature is UNKNOWN — needs verification.

## 36. Important constraints

- Preserve the current component name/default export `ShortlistShare` and homepage placement unless the homepage integration intentionally changes.
- Treat `pinned` as the current in-memory API property UUID array; do not assume it is a persisted wishlist/favourites store.
- Preserve the `fetchProperties({ status: "ALL", page: 1, perPage: 100 })` request and the API `id` values used for selection and share creation.
- Preserve the exact WhatsApp construction `https://wa.me/?text=${encodeURIComponent(text)}` and include one `buildShareUrl` result for every selected property.
- Keep shortlist analytics event names `SHORTLIST_ADD`, `SHORTLIST_REMOVE`, and `WHATSAPP_SHARE_CLICK`, using selected API UUIDs in the property-id fields.
- Keep the distinction between this homepage feature and the API/map-driven `MapSection`, Property Details `PropertyFinalCta`, and Property Enquiry actions.
- Preserve the `max-width: 980px` mobile switch and the additional `max-width: 640px` intro adjustment when referring to current responsive behavior.
- Do not document shortlist persistence, native share fallback, clipboard fallback, or shared Wishlist/Favourites state unless separately confirmed in source.
- Keep tracked-share creation in `shareService.ts`; do not post slugs or local layout ids as `entity_id`.