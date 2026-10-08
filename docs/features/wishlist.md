# Wishlist / Favourites feature

This document describes the current Wishlist / Favourites-related implementation only. The codebase currently contains separate API favourites, Property Details local-storage wishlist flags, and homepage Shortlist / WhatsApp Share state. They are documented separately below and must not be treated as one shared store.

## 1. Feature purpose

The current implementation lets a visitor save API-backed properties as favourites from the Property List, mark a Property Details record as being in a local wishlist, or mark it as interested. The homepage `ShortlistShare` section separately lets a visitor select API property UUIDs and share tracked property links through WhatsApp.

There is no single Wishlist page, no confirmed cross-feature favourites route, and no unified client-side store combining these behaviors.

## 2. Where it appears

The API-backed favourite control appears on each card in the `/properties` catalogue. The control is rendered by `PropertiesList`.

The local-storage Wishlist and Interested controls appear in the final CTA section of each Property Details page at `/properties/{propertyId}`. They are rendered by `PropertyFinalCta`.

The separate Shortlist / WhatsApp Share section appears on the homepage `/`, with root `id="shortlist-share"` and `aria-label="Shortlist and share"`.

No favourite control is confirmed in `MapSection` or the map `PropertySheet`.

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx` — API property cards and API favourite control.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\favoritesService.ts` — visitor-based favourite API functions and response types.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx` — local-storage `Save to wishlist`, `I'm interested`, and `Share property` controls.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — renders `PropertyFinalCta` for the current `PropertyRecord`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — shared Property Details chip styling.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\ShortlistShare.tsx` — separate homepage API-backed shortlist selection and tracked WhatsApp sharing.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\ShortlistShare.css` — homepage Shortlist / Share layout and responsive styling.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — API property-list records used by `ShortlistShare`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` — tracked share creation used by `ShortlistShare`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\events.ts` — allowed favourite and shortlist event names.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\useClickTracking.ts` — delegated analytics handling for Property Details data attributes.

## 4. Component names

The relevant component names are:

- `PropertiesList` — default export for the API catalogue.
- `PropertyPageView` — shared Property Details composition component.
- `PropertyFinalCta` — Property Details wishlist, interested, share, and enquiry CTA component.
- `ShortlistShare` — separate homepage API-backed shortlist/share component; its in-memory selection is not the wishlist/favourites state.

The API service functions are `fetchFavorites`, `saveFavorite`, and `removeFavorite`.

## 5. Props

`PropertiesList` accepts no props.

`ShortlistShare` accepts no props.

`PropertyFinalCta` receives:

```ts
{
  property: PropertyRecord;
}
```

`PropertyPageView` receives a `property: PropertyRecord` and passes that record to `PropertyFinalCta`. It also has the unrelated optional `documentsState` prop.

## 6. Data source

The Property List favourite system is API-backed. It loads the current anonymous visitor's favourite records from `GET /api/favorites` and stores only returned `property_id` values in component state for card rendering.

The Property Details Wishlist and Interested controls use the supplied `PropertyRecord` only to identify the property and construct a storage key. They do not call the favourites API.

`ShortlistShare` uses the API property-list data source. It does not load API favourite records and does not share the Property List's saved state.

## 7. What can be favourited

The Property List saves an API property entity identified by its API `property.id`, which is expected to be a property UUID. The POST payload contains `{ property_id: propertyId }`.

The Property Details `Save to wishlist` button stores a flag for the current `PropertyRecord.id`. It does not save a plot/layout object or a complete property record.

The separate homepage Shortlist selects API property UUID values from its own property-list request. Those selections are not the API favourite entity and are not the Property Details wishlist entity.

## 8. Add/remove behavior

In `PropertiesList`, `handleFavoriteToggle(propertyId)` first checks whether the id is already in `savedIds` and whether that id is currently in `savingIds`. A pending id is ignored.

If already saved, it awaits `removeFavorite(propertyId)`, then deletes the id from `savedIds`. If not saved, it awaits `saveFavorite(propertyId)`, then adds the id to `savedIds`. State changes occur only after the API request succeeds.

In `PropertyFinalCta`, `toggle(kind)` computes the inverse of either `wishlist` or `interested`, immediately updates the corresponding React state, and writes `"1"` for active or `"0"` for inactive to localStorage. It does not call an API and does not remove the key when toggled off.

In `ShortlistShare`, `togglePlot` adds or removes an API property UUID from the in-memory `pinned` array and emits separate shortlist analytics.

## 9. Favourite state

The Property List state is a set of API property ids returned for the current anonymous visitor. A card is favourite when `savedIds.has(property.id)` is true.

Property Details has two independent boolean states: `wishlist` and `interested`. `wishlist` controls `Save to wishlist` / `In wishlist`; `interested` controls `I'm interested` / `Marked interested`.

The homepage Shortlist state is an array of static layout ids named `pinned`; it is not synchronized with either favourite state.

## 10. State variables

`PropertiesList` declares:

- `items: Enriched[]` — rendered API property records.
- `total: number` — API-reported list total.
- `state: "loading" | "ready" | "error"` — list loading state.
- `savedIds: Set<string>` — API favourite property ids.
- `savingIds: Set<string>` — ids with an active save/remove request.
- `favoriteError: string | null` — favourite loading or toggle error message.

`PropertyFinalCta` declares `wishlist`, `interested`, and `shareNote`.

`ShortlistShare` declares `pinned`, `shared`, and `mobilePanelsRef`.

## 11. Derived values

The Property List derives each card's favourite status from `savedIds`, pending status from `savingIds`, and its button text from both sets.

`PropertyFinalCta` derives storage keys through `storageKey(kind, property.id)`, and derives `waText` and `visitText` from the current property. Its active chip class is derived from the corresponding boolean.

`ShortlistShare` derives `selected` with `PROPERTIES.filter((plot) => pinned.includes(plot.id))`. Its selected count and share-button disabled state are derived from `pinned.length`.

## 12. Functions

API favourites:

- `handleFavoriteToggle(propertyId)` — selects save or remove and updates local state after success.
- `fetchFavorites(signal?)` — waits for visitor readiness, calls the favourites GET endpoint, and returns `data.items` or an empty array.
- `saveFavorite(propertyId)` — POSTs one API property id.
- `removeFavorite(propertyId)` — DELETEs one API property id.

Property Details:

- `storageKey(kind, id)` — returns `ila-${kind}-${id}`.
- `toggle(kind)` — flips and persists the Wishlist or Interested flag.
- `share()` — attempts native share, then clipboard, then WhatsApp fallback.

Homepage Shortlist:

- `buildShareText(plots)` — builds the plain-text selected-layout summary.
- `togglePlot(plotId)` — changes `pinned` and emits add/remove analytics.
- `shareOnWhatsApp()` — opens the encoded text summary and emits share analytics.
- `renderChoose(mode)` — renders the desktop or mobile chooser.
- `handlePanelsWheel(event)` — handles the chooser panel wheel interaction.

## 13. Hooks

`PropertiesList` uses `useState` and `useEffect`. Its effect creates an `AbortController`, loads favourites and properties, and aborts on unmount.

`PropertyFinalCta` uses `useState` and `useEffect`. The effect reads localStorage whenever `property.id` changes.

`ShortlistShare` uses `useState`, `useMemo`, `useEffect`, and `useRef`. The effect installs touch listeners for the mobile panels and cleans them up.

## 14. Storage mechanism

The `/properties` card favourites use the backend API, associated with an anonymous visitor through the visitor readiness flow and `X-Visitor-Code`. They are not stored in localStorage or sessionStorage by `PropertiesList`.

The Property Details Wishlist and Interested flags use browser `localStorage` directly. Access is wrapped in `try/catch`; storage failures are ignored.

The homepage Shortlist uses only React memory. It has no localStorage, sessionStorage, cookie, URL, or API persistence.

## 15. Storage keys

Property Details constructs these exact keys:

- `ila-wishlist-{property.id}`
- `ila-interested-{property.id}`

The values written are the strings `"1"` and `"0"`.

No localStorage or sessionStorage key is used by the API-backed Property List favourites or by `ShortlistShare`.

## 16. Persistence behavior

API favourites are persisted by the backend for the current anonymous visitor and reloaded by `fetchFavorites()` when `PropertiesList` mounts. The exact backend retention period and visitor-code lifetime are UNKNOWN — needs verification.

Property Details localStorage flags survive a page refresh in the same browser storage context, subject to browser storage availability and the property id remaining the same.

Shortlist selections do not survive a page refresh or component unmount. `pinned` starts with `nallagandla-enclave` and `kokapet-heights` on each mount.

## 17. UI states

The Property List favourite button has these visible labels:

- `Save as favourite`
- `Saved as favourite`
- `Saving…`
- `Removing…`

The button exposes its state through `aria-pressed` and is disabled while its id is pending.

Property Details uses `Save to wishlist` / `In wishlist` and `I'm interested` / `Marked interested`, with the active state represented by the `is-active` class and `aria-pressed`.

Shortlist options use selected/unselected styling and `aria-pressed`; its share button is enabled only when at least one API property is selected.

## 18. Loading behavior

`PropertiesList` initially uses `state="loading"`. Its favourite request runs alongside the property list request. The favourite request does not block rendering the property list; its result initializes `savedIds` when available.

Property Details does not show a Wishlist-specific loading state. The localStorage read runs in `useEffect`, so the initial boolean state is false until the effect reads the stored value.

ShortlistShare loads up to 100 API properties and shows loading, empty, and fetch-error states. Tracked-share creation also has a pending button state and a sharing-error message.

## 19. Error behavior

If loading favourites fails, `PropertiesList` logs a warning and sets `favoriteError` to `Could not load saved properties.` when the request is not aborted. The property list can still render.

If a save fails, the UI reports `Could not save this property. Please try again.` If removal fails, it reports `Could not remove this property. Please try again.` The saved set is not changed for the failed operation.

Property Details catches and ignores localStorage read/write errors. It has no visible storage error state.

ShortlistShare has no explicit error state for `window.open`; popup-blocking behavior is UNKNOWN — needs verification.

## 20. Empty-state behavior

There is no separate saved-favourites or Wishlist page with an empty state.

The Property List empty state is the list's no-properties state, not a saved-favourites state. The exact text is `No properties found.` when the loaded list is empty.

ShortlistShare displays `Select plots on the right to build your shortlist` when `pinned.length` is zero and disables sharing. Its initial state is not empty because two layouts are initially pinned.

## 21. Reset/clear behavior

There is no clear-all favourites or clear-all Wishlist control.

The Property List removes one API favourite at a time through `DELETE /api/favorites/{id}`.

Property Details toggling off writes `"0"`; it does not remove the localStorage key. Its state is reread when `property.id` changes.

ShortlistShare removes individual layout ids through `togglePlot`. There is no reset button; unmounting resets state to the initial pinned ids on the next mount.

## 22. Navigation behavior

The Property List card link navigates to `/properties/{property.id}`. The favourite button is positioned over the card and its click handler performs the save/remove operation; the button itself is not a navigation link.

Property Details Wishlist and Interested buttons do not navigate. `Share property` shares the current URL through the Web Share API, clipboard, or WhatsApp fallback.

ShortlistShare does not navigate to a Wishlist or Shortlist route. Its WhatsApp action opens a `https://wa.me/?text=...` URL in a new window.

## 23. Analytics

Property List favourite buttons do not have `data-track` attributes and no direct favourite analytics call is present in `PropertiesList`. Exact analytics for API favourites is UNKNOWN — needs verification.

Property Details Wishlist and Interested buttons both emit `PROPERTY_FAVORITE` through delegated `data-track` handling. They send `property_id={property.id}` and metadata:

- Wishlist: `{ "action": "add" | "remove", "button_location": "property_final_cta" }`.
- Interested: `{ "action": "add" | "remove", "button_location": "property_final_cta_interested" }`.

`Share property` emits `PROPERTY_SHARE` with `button_location: "property_final_cta"`.

ShortlistShare directly emits `SHORTLIST_ADD` or `SHORTLIST_REMOVE` with the selected API UUID as `property_id` and metadata containing `property_id` and `section_type: "shortlist_whatsapp"`. WhatsApp sharing emits `WHATSAPP_SHARE_CLICK` with the first selected API UUID as `property_id`, plus `shortlist_count`, `property_ids`, and `section_type` metadata.

## 24. Relationship with Property List

The Property List is the only inspected component using the visitor-based `/api/favorites` system. It initializes card state from the API and updates that state after successful API operations.

The Property Details localStorage Wishlist flags are not read by `PropertiesList`, and the API `savedIds` are not passed into `PropertyFinalCta`. Therefore a property saved in the catalogue is not confirmed to make the Property Details `Save to wishlist` chip active, and vice versa.

## 25. Relationship with Property Details

Property List cards navigate to Property Details using the API property id. Property Details then renders `PropertyFinalCta` with a normalized `PropertyRecord`.

The Property Details `Save to wishlist` control is a separate localStorage flag. It does not call `fetchFavorites`, `saveFavorite`, or `removeFavorite`. The `I'm interested` flag is also separate from both API favourites and Wishlist.

## 26. Relationship with Property Enquiry

Wishlist and Interested actions are adjacent to enquiry actions in `PropertyFinalCta`, but they do not submit an enquiry, create a lead, book a site visit, or call an enquiry API.

Property Enquiry uses WhatsApp and email links with separate `ENQUIRY_CLICK` and `WHATSAPP_CHAT_CLICK` analytics. The local Wishlist and Interested flags have no enquiry payload or submission confirmation.

## 27. Relationship with Shortlist / Share

The homepage `ShortlistShare` feature is separate from both API favourites and Property Details Wishlist. It selects API property UUIDs, starts with no pinned properties, creates one tracked share per selected property, and sends the resulting links to WhatsApp.

It does not read or write `ila-wishlist-{id}` / `ila-interested-{id}`, does not call the favourites API, and does not synchronize with `PropertiesList`, `MapSection`, or Property Details. Wishlist and Shortlist are not the same system in the current implementation.

## 28. Desktop behavior

The Property List uses the same card component structure on desktop and mobile; there is no separate desktop favourite control.

Property Details uses the same `PropertyFinalCta` chip controls on desktop and mobile. The surrounding CTA layout changes through shared Property Details CSS, but no separate Wishlist component is rendered.

ShortlistShare uses a two-column desktop layout: explanatory content and controls on the left, chooser/details/media content on the right. The desktop chooser is rendered in the right panel.

## 29. Mobile behavior

The Property List keeps the same favourite button and card interaction on mobile; only the card grid changes to one column below the list's `sm` breakpoint.

Property Details keeps the same Wishlist and Interested buttons on mobile. Exact visual wrapping of the final CTA controls follows `PropertyDetail.css`; no mobile-only Wishlist implementation is present.

ShortlistShare renders a mobile chooser in the left content area, hides the desktop chooser/media arrangement as defined by CSS, and supports touch panel scrolling. Its share button remains disabled when no layout is selected.

## 30. Responsive breakpoints

The Property List card grid uses Tailwind breakpoints: base one column, `sm` at `640px` for two columns, and `lg` at `1024px` for three columns.

ShortlistShare switches its desktop/mobile arrangement at `max-width: 980px` and has an additional intro adjustment at `max-width: 640px`.

Property Details contains responsive rules at `min-width: 760px` and `min-width: 980px`, but an exact Wishlist-chip-specific breakpoint is UNKNOWN — needs verification.

## 31. CSS/classes

The API favourite button uses Tailwind utility classes including absolute positioning, rounded background, shadow, hover colors, opacity, and disabled cursor/opacity utilities. It has no dedicated named favourite CSS class.

Property Details uses `.pd-final__toggles`, `.pd-chip`, and `.pd-chip.is-active` from `PropertyDetail.css`.

ShortlistShare uses the `.shortlist-share` namespace, including `.shortlist-share__choose`, `.shortlist-share__option`, `.shortlist-share__option.is-selected`, `.shortlist-share__share`, and related mobile chooser classes.

## 32. Accessibility

The API favourite and Property Details Wishlist/Interested controls are native `button` elements with `type="button"` and `aria-pressed`. The API button is disabled while its request is pending.

The Property List card is a semantic link inside a list item. Its favourite error is exposed in a screen-reader-only polite live region. Exact screen-reader behavior for the absolutely positioned button over the card link is UNKNOWN — needs verification.

Property Details share feedback uses `aria-live="polite"`. No explicit live announcement is present for Wishlist or Interested state changes beyond the button text and `aria-pressed` value.

ShortlistShare uses native buttons, `aria-pressed` on layout options, `role="group"` with `aria-label="All properties"`, an ordered feature list label, and a polite live region for the detail panel. Its buttons are keyboard activatable through native button behavior. Exact keyboard behavior of the custom touch/wheel scrolling handoff is UNKNOWN — needs verification.

## 33. Dependencies

The API favourite implementation depends on React, the internal `apiFetch` client, `favoritesService`, `visitor` / `visitorReady` helpers, and the API tenant configuration used by `apiFetch`.

Property Details depends on React, `PropertyRecord`, browser `localStorage`, the internal WhatsApp/mailto helpers, and delegated analytics tracking.

ShortlistShare depends on React hooks, Next.js `Image`, static image assets, `fetchProperties`, `createPropertyShares`, `buildShareUrl`, `ILA_PROPERTY_ID`, `trackEvent`, browser window/touch/wheel APIs, and `ShortlistShare.css`.

## 34. Known issues

- The codebase has separate API favourites and local-storage Wishlist flags with no confirmed synchronization.
- The Property List has no saved-favourites page, filter, or clear-all action.
- API favourite analytics are not directly instrumented in the inspected Property List button; exact backend-side analytics behavior is UNKNOWN — needs verification.
- Property Details localStorage failures are silently ignored, so a blocked or unavailable storage area produces no user-visible error.
- Property Details writes `"0"` rather than removing an inactive Wishlist or Interested key.
- `ShortlistShare` starts with no selected properties, is not persisted, and is not synchronized with MapSection, Find Your Plot, or Property Details.
- The homepage feature creates one tracked property link per selected API UUID before composing the WhatsApp message; it does not create a persistent shortlist collection.
- The exact backend behavior when a saved API property no longer exists is UNKNOWN — needs verification. The inspected client only receives the favourites response and does not implement a deleted-property cleanup flow.
- Exact browser popup-blocking behavior for ShortlistShare is UNKNOWN — needs verification.

## 35. Important constraints

- Preserve the distinction between API favourites, Property Details localStorage Wishlist/Interested flags, and homepage Shortlist / WhatsApp Share.
- Treat the API favourite entity as the API property UUID sent in `property_id`; do not document the homepage shortlist selection as the same entity.
- Preserve the API routes and visitor header: `GET /api/favorites`, `POST /api/favorites` with `{ property_id }`, `DELETE /api/favorites/{id}`, and `X-Visitor-Code`.
- Preserve localStorage key formats `ila-wishlist-{id}` and `ila-interested-{id}` and values `"1"` / `"0"` when describing the Property Details implementation.
- Do not claim that favourites are shared between Property List, Property Details, MapSection, ShortlistShare, or another component unless a future implementation explicitly adds that connection.
- Preserve the current post-success API state updates, per-id pending disable behavior, and visible Saving/Removing labels.
- Preserve the current `PROPERTY_FAVORITE`, `PROPERTY_SHARE`, `SHORTLIST_ADD`, `SHORTLIST_REMOVE`, and `WHATSAPP_SHARE_CLICK` event names and metadata contracts where they are explicitly implemented.
- Do not infer a Wishlist route, saved-items page, API-backed Property Details Wishlist, deleted-record cleanup, or cross-device synchronization from the current controls.
- Application files were not modified for this documentation task; unrelated existing working-tree changes must be preserved.