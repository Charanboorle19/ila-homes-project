# Property Enquiry feature

This document describes the current Property Enquiry implementation used around the Property Details page. It complements [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md), [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\similar-properties.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\similar-properties.md), and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\buying-journey.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\buying-journey.md). It documents the implementation currently present in the inspected source files only.

## 1. Feature purpose

Property Enquiry provides direct contact shortcuts for a property: start a WhatsApp conversation, request a site visit through WhatsApp, request a site visit through email, and retain related save/share actions on the final Property Details CTA. It is a client-side link-and-state feature. It does not submit a lead form, reserve a property, book inventory, or call a property-enquiry API.

## 2. Where enquiry actions appear

Current enquiry-related actions appear in:

- The Property Details hero: `WhatsApp enquiry` and `Schedule site visit`.
- The final CTA section: no WhatsApp or mailto actions remain. It now submits through the enquiry form described in `property-enquiry-form.md`, either to `POST /api/leads` (`Request a callback`) or to `POST /api/site-visits` (`Schedule site visit`). The former `WhatsApp enquiry`, `WhatsApp site visit` and `Email site visit` links have all been removed from this section.
- The sticky bottom CTA: `Email visit` and `WhatsApp`.
- The map `PropertySheet`: navigation to `View Project`, plus plot links labelled `Enquire about this plot` that navigate to `#contact`. These are not WhatsApp/mailto enquiry actions.

## 3. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — creates enquiry URLs and passes them into the hero and sticky CTA.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyHero.tsx` — hero enquiry links.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx` — final enquiry, wishlist, interested, and share controls.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\StickyBottomCta.tsx` — conditional sticky enquiry bar.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` — `whatsappUrl` and `siteVisitMailto`.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx` — map `PropertySheet` and plot navigation links.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — Property Details CTA and sticky-bar styling.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `PropertyRecord` contract used by the CTA components.

## 4. Component names

The relevant components are:

- `PropertyPageView` — shared Property Details composition component.
- `PropertyHero` — `forwardRef` hero component.
- `PropertyFinalCta` — final enquiry and related actions component.
- `StickyBottomCta` — conditional fixed enquiry shortcut.
- `PropertySheet` — local function component in `MapSection.tsx`, not a standalone popup file.

## 5. Component props

`PropertyPageView`:

```ts
type PropertyPageViewProps = {
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
};
```

`PropertyHero`:

```ts
type PropertyHeroProps = {
  property: PropertyRecord;
  gallery: GalleryItem[];
  activeImage: GalleryItem | undefined;
  onSelectGallery: (id: string) => void;
  connectivityScore: number;
  whatsappHref: string;
  siteVisitHref: string;
  priceLabel: string;
};
```

`PropertyFinalCta` receives `{ property: PropertyRecord }`.

`StickyBottomCta` receives:

```ts
type StickyBottomCtaProps = {
  property: PropertyRecord;
  heroRef: RefObject<HTMLElement | null>;
  siteVisitHref: string;
};
```

`PropertySheet` receives `project`, optional `property`, `expanded`, `dense`, optional `collapsible`, `tab`, `onTabChange`, optional `onToggle`, and optional `className`. Its exact type is declared locally as `PropertySheetProps` in `MapSection.tsx`.

## 6. Data sources

The Property Details CTA components receive a normalized `PropertyRecord`. Local records come from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`; API records are normalized by `apiPropertyToRecord` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts` before reaching `PropertyPageView`.

The enquiry links use only `property.name`, `property.location`, and `property.id`. The map sheet uses its `EstateProject` and optional `PropertyRecord` for display/navigation.

## 7. WhatsApp enquiry behavior

The hero and final CTA open a new tab/window with a WhatsApp URL. `PropertyPageView` creates the hero/final message:

```text
Hi ILA Homes, I'm interested in {property.name} ({property.location}). Please share availability and a site-visit slot.
```

`PropertyFinalCta` independently creates its WhatsApp-enquiry message:

```text
Hi ILA Homes, I'm interested in {property.name} at {property.location}. Please share next steps.
```

The sticky CTA creates:

```text
Hi ILA Homes, please help me schedule a site visit for {property.name} ({property.location}).
```

All are passed to `whatsappUrl` and use `target="_blank"` and `rel="noreferrer"`.

## 8. Site visit behavior

Site visit actions have two channels:

- WhatsApp: a generated site-visit message opens `https://wa.me/?text=...` in a new tab/window.
- Email: `siteVisitMailto(property)` creates a `mailto:` URL and relies on the browser/OS mail client.

There is no booking calendar, confirmation state, site-visit form, or server-side visit creation in these components.

## 9. Email/mailto behavior

`siteVisitMailto(property)` creates:

```text
mailto:hello@ilahomes.example?subject={encoded subject}&body={encoded body}
```

The subject before encoding is `Site visit — {property.name}`. The body before encoding is:

```text
Hi ILA Homes,

I'd like to schedule a site visit for {property.name} ({property.location}).

Thanks
```

The function uses `encodeURIComponent` for both subject and body. No email API is called.

## 10. Property data used in enquiry messages

Message content uses only:

- `property.name` — property/project name.
- `property.location` — location included in parentheses or after `at`.

The property id is not included in WhatsApp or mailto message text. The id is used for analytics metadata, local-storage keys, and route fallback/share URLs.

## 11. Message generation

Message strings are generated inline in `PropertyPageView`, `PropertyFinalCta`, and `StickyBottomCta`. There is no shared enquiry-message builder. `siteVisitMailto` is the shared helper for email, while `whatsappUrl` is the shared URL encoder for WhatsApp.

## 12. URL generation

`whatsappUrl(text)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts` returns:

```ts
`https://wa.me/?text=${encodeURIComponent(text)}`
```

`siteVisitMailto(property)` returns the encoded `mailto:hello@ilahomes.example` URL described in section 9. The final CTA share fallback also uses `whatsappUrl`, but that is a share action rather than an enquiry action.

## 13. CTA locations

The hero CTA links are rendered inside `.pd-hero__actions`. The final CTA links are inside `.pd-final__actions`. The sticky links are inside `.pd-sticky__actions`. Map actions are rendered by `PropertySheet` or the selected-plot panel in `MapSection.tsx`.

## 14. Hero CTA behavior

`PropertyHero` renders:

- `WhatsApp enquiry` as a primary anchor using the `whatsappHref` prop, opening WhatsApp in a new tab/window.
- `Schedule site visit` as a ghost anchor using the `siteVisitHref` prop, opening the mail client through `mailto:`.

The hero does not generate its own messages and does not have `data-track` attributes on either enquiry link. Consequently, no hero-specific `ENQUIRY_CLICK` or `WHATSAPP_CHAT_CLICK` is emitted by these current anchors.

## 15. Final CTA behavior

`PropertyFinalCta` renders the `Next step` section with id `pd-final-title`. It no longer contains any WhatsApp or mailto action. Its three former links — `WhatsApp enquiry`, `WhatsApp site visit` and `Email site visit` — were replaced by the enquiry form:

- `Request a callback` — `POST /api/leads` via `createPublicLead`.
- `Schedule site visit` — `POST /api/site-visits` via `bookPublicSiteVisit`, rendered only when `isPropertyUuid(property.id)` because that endpoint requires `property_id`.

Neither button carries `data-track` attributes; the submissions are recorded server-side. `whatsappUrl` and `siteVisitMailto` are no longer imported by this component. See `property-enquiry-form.md`.

## 16. Sticky CTA behavior

`StickyBottomCta` renders a fixed site-visit shortcut only when the hero is not intersecting and the bar has not been dismissed. Its actions are:

- `Email visit`: the `siteVisitHref` prop, `ENQUIRY_CLICK`, metadata `{"button_location":"sticky_bottom_cta","channel":"email"}`.
- `WhatsApp`: generated site-visit WhatsApp text, `WHATSAPP_CHAT_CLICK`, metadata `{"button_location":"sticky_bottom_cta"}`.

The sticky component has no `localStorage` persistence for dismissal. Dismissal lasts only for the mounted component instance and resets to `false` when `property.id` changes.

## 17. Map popup enquiry behavior

The map equivalent of a popup is `PropertySheet` inside `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`; there is no standalone `PropertyPopup` component in the inspected implementation.

`PropertySheet` has a `View Project` link to `/properties/{property.id}` when a `PropertyRecord` is available. It also has brochure and loan-calculator fragment links. It does not render a WhatsApp enquiry link, a `mailto:` link, or an enquiry form.

The selected-plot panel has an `Enquire about this plot` link to `#contact`. This is only fragment navigation; it does not pass plot data into an enquiry message and does not call an enquiry endpoint. The map-level `Visit Property`/`View All Properties` link also uses `#contact` and is navigation only.

## 18. Share behavior if related

Share is implemented only in `PropertyFinalCta` and is related to contact/discovery but is not an enquiry submission. `share()` uses `navigator.share` first with `{ title: property.name, text: `${property.name} — ${property.location}`, url }`. If unavailable or rejected, it tries `navigator.clipboard.writeText(url)`. If that fails, it opens WhatsApp with the property text and URL through `whatsappUrl`.

The URL is `window.location.href` in the browser, or `https://ilahomes.example/properties/{property.id}` when `window` is unavailable. The button emits `PROPERTY_SHARE` with `button_location: "property_final_cta"`. Its user feedback is `Shared`, `Link copied`, or `Opened WhatsApp share`.

## 19. Wishlist/save behavior if related

`PropertyFinalCta` has `Save to wishlist` and `I'm interested` buttons. These are not enquiry submissions. They persist independent flags in local storage using `ila-wishlist-{property.id}` and `ila-interested-{property.id}` with values `"1"` or `"0"`.

Both buttons emit `PROPERTY_FAVORITE`; metadata contains `action` (`add` or `remove`) and the relevant `button_location`. The wishlist button uses `property_final_cta`; the interested button uses `property_final_cta_interested`.

## 20. State variables

`PropertyPageView` owns `activeGalleryId` and `heroRef`; it does not own enquiry state.

`PropertyFinalCta` owns:

- `wishlist: boolean`
- `interested: boolean`
- `shareNote: string`

`StickyBottomCta` owns:

- `visible: boolean`
- `dismissed: boolean`

There is no `enquiryOpen`, `enquiryStatus`, `enquiryLoading`, `enquiryError`, form field, or submitted-enquiry state.

## 21. Derived values

Enquiry-related derived/local values include:

- `waText` in `PropertyPageView`.
- `waText` and `visitText` in `PropertyFinalCta`.
- `waText` in `StickyBottomCta`.
- `siteVisitHref` from `siteVisitMailto(property)`.
- `whatsappHref` from `whatsappUrl(waText)`.
- `url`, `payload`, and `shareNote` flow in the final share fallback.

## 22. Functions

Relevant functions are:

- `whatsappUrl(text: string)`.
- `siteVisitMailto(property: PropertyRecord)`.
- `storageKey(kind, id)` in `PropertyFinalCta`.
- `toggle(kind)` in `PropertyFinalCta`.
- `share()` in `PropertyFinalCta`.
- `PropertySheet(...)` in `MapSection.tsx`.
- Sticky `IntersectionObserver` callback and dismiss handler in `StickyBottomCta`.

## 23. Hooks

- `PropertyFinalCta` uses `useState` for wishlist/interested/share feedback and `useEffect` to read local storage when `property.id` changes.
- `StickyBottomCta` uses `useState` and `useEffect` to reset dismissal and observe the hero with `IntersectionObserver`.
- `PropertyPageView` uses `useMemo` for the property-derived page values and `useRef` for the hero reference; it passes generated links to children.
- No enquiry-specific custom hook exists.

## 24. API usage

No property-enquiry API request is made. The CTA links are external/browser actions. Analytics may use the shared event transport described in section 28, but that is tracking and not enquiry creation.

API-backed properties can still display these CTAs because `ApiPropertyView` maps them to `PropertyRecord`. The mapped API record uses its normalized `name` and `location` fields and has no separate enquiry integration.

## 25. Loading behavior

There is no enquiry-specific loading state or spinner. Once `PropertyPageView` receives a `PropertyRecord`, the links are rendered synchronously. API property loading happens before the shared page receives its mapped record; the enquiry components do not manage that loading lifecycle.

## 26. Error behavior

There is no enquiry-specific error UI, retry action, or error callback. Browser failures opening WhatsApp/mail clients are not handled by the anchor components. Share has its own fallback chain, but that does not apply to ordinary enquiry links.

## 27. Missing-field/fallback behavior

`PropertyRecord.name` and `PropertyRecord.location` are required by the type, so there is no enquiry-specific missing-field fallback in the CTA components. If runtime data violates that contract, the interpolated message contains the resulting runtime value. The API mapper supplies fallbacks for broader record fields, but this documentation cannot confirm any additional backend guarantees beyond the mapper: UNKNOWN — needs verification.

The map sheet falls back from a normalized property to `project.name` and `project.location` for display. It only renders `View Project` when `property` exists. Plot enquiry links remain `#contact` and do not generate a fallback message.

## 28. Analytics events

CTA events are attached through `data-track` attributes and are handled by the existing click-tracking utility:

- `WHATSAPP_CHAT_CLICK`: sticky WhatsApp site-visit shortcut. The final-CTA `WhatsApp enquiry` link that used to carry it has been removed.
- `ENQUIRY_CLICK`: sticky email visit only. The two final-CTA links that used to carry it — `WhatsApp site visit` and `Email site visit` — have both been removed.
- `PROPERTY_FAVORITE`: wishlist/interested toggles.
- `PROPERTY_SHARE`: final share button.

The hero enquiry links currently have no `data-track` attributes. Map `View Project`, `#contact`, brochure, and loan-calculator links have no Property Enquiry-specific tracking attributes. `ENQUIRY_SUBMIT` and `SITE_VISIT_REQUEST` exist in the analytics vocabulary but are not emitted by this client implementation.

The shared tracker queues sendable events and posts them to `/api/events/batch` through `apiFetch` when visitor/session conditions permit. Unsupported or non-sendable events are dropped by the existing tracker; no enquiry-specific transport exists.

## 29. Routes and external URLs

Internal routes/fragments:

- `/properties/{property.id}` — map `View Project` navigation and normal Property Details route.
- `#contact` — map-level and selected-plot navigation only.
- `#brochure` and `#loan-calculator` — map sheet fragment links, not enquiry actions.

External/browser URLs:

- `https://wa.me/?text={encoded message}` — WhatsApp enquiry/site-visit/share fallback.
- `mailto:hello@ilahomes.example?...` — email site visit.

## 30. Desktop behavior

At `@media (min-width: 760px)`, the hero uses a two-column `.pd-hero__grid` with `1.15fr 0.85fr`; `.pd-hero__price-row` becomes a horizontal row and the hero actions sit beside the price block. The sticky bar’s `.pd-sticky__inner` also becomes a horizontal row at this breakpoint.

The final CTA actions remain wrapping flex rows. No desktop-only enquiry channel or separate desktop component exists.

## 31. Mobile behavior

Below the desktop breakpoint, the hero remains a single-column flow: price and actions stack through the base `.pd-hero__price-row` column layout. CTA links use the shared `.pd-btn` styles and wrap when needed. The sticky bar uses a column layout for its inner content and still provides email and WhatsApp actions when visible.

The map `PropertySheet` uses its `dense` prop to render compact mobile typography and spacing; its behavior remains navigation/display only for enquiry purposes.

## 32. Responsive behavior

The confirmed Property Details enquiry-related breakpoint is `@media (min-width: 760px)`. The hero has an image `sizes` hint at `900px`, but that is an image-rendering hint rather than an enquiry breakpoint. The sticky bar is fixed to the viewport bottom at all sizes when visible, includes safe-area bottom padding, and has no CSS rule that hides it specifically on mobile.

Exact behavior at intermediate widths where wrapped CTA rows change line count is determined by flex wrapping and is otherwise UNKNOWN — needs verification.

## 33. CSS classes

Relevant Property Details classes in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` are:

- Shared buttons: `.pd-btn`, `.pd-btn--primary`, `.pd-btn--ghost`.
- Hero: `.pd-hero__actions`, `.pd-hero__price-row`, `.pd-hero__price-block`.
- Final CTA: `.pd-final`, `.pd-final__inner`, `.pd-final__actions`, `.pd-final__toggles`, `.pd-final__share-note`, `.pd-final__quote`.
- Save/share controls: `.pd-chip`, `.pd-chip.is-active`.
- Sticky CTA: `.pd-sticky`, `.pd-sticky__inner`, `.pd-sticky__label`, `.pd-sticky__meta`, `.pd-sticky__actions`, `.pd-sticky__close`.

Map popup and plot links use Tailwind utility class strings directly in `MapSection.tsx`, not the `.pd-*` stylesheet classes.

## 34. Relationship with PropertyRecord

The CTA components accept the full `PropertyRecord` but directly use only a subset:

- `id` for analytics, storage, and URL fallback.
- `name` and `location` for enquiry messages, labels, and share text.
- `testimonial` for the unrelated final quote.

`PropertyRecord` also carries display fields used by the surrounding hero and map sheet. Enquiry does not require a special `enquiryUrl`, contact object, phone number, or API lead identifier.

## 35. Relationship with PropertyPageView

`PropertyPageView` is the enquiry URL composition point. It creates `waText`, calls `whatsappUrl(waText)`, calls `siteVisitMailto(property)`, and passes those values to `PropertyHero` and `StickyBottomCta`. It renders `PropertyFinalCta` with `property`.

The render order places `PropertyFinalCta` after `SimilarProperties` and `StickyBottomCta` immediately after it. `useTrackPropertyView(property.id)` is page-view tracking, not an enquiry action.

## 36. Relationship with Property Popup

The map property-popup equivalent is `PropertySheet` in `MapSection.tsx`. It can navigate to `/properties/{property.id}` when a normalized property is available. It does not receive or reuse the Property Details enquiry URL props and does not call `whatsappUrl` or `siteVisitMailto`.

The plot panel’s `Enquire about this plot` text is only a `#contact` link. It does not share enquiry state with `PropertyFinalCta`, `StickyBottomCta`, or `PropertyHero`.

## 37. Relationship with Buying Journey

`BuyingJourneySteps` is rendered before Similar Properties and the final CTA, but it is static explanatory content with no props, enquiry callback, link, state, or analytics. Its `Enquire` step does not invoke the Property Enquiry implementation. The final CTA is the next actionable enquiry area after the journey section.

## 38. Relationship with Similar Properties

`SimilarProperties` is rendered immediately before `PropertyFinalCta` and only links to other `/properties/{id}` pages. It has no enquiry props, WhatsApp/mailto behavior, enquiry analytics, or shared state. Selecting a similar property navigates to another Property Details page, where that page creates its own enquiry URLs from its own `PropertyRecord`.

## 39. Dependencies

The direct implementation dependencies are:

- React hooks: `useEffect`, `useState`, `useRef`, `useMemo`.
- Next.js `next/link` and `next/image` in surrounding components.
- `PropertyRecord` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.
- `whatsappUrl`, `siteVisitMailto`, and related property utilities from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`.
- Browser APIs: `window`, `navigator.share`, `navigator.clipboard`, `localStorage`, and `IntersectionObserver`.
- Existing analytics click tracking and event tracker.
- Existing map/project data and `MapLibre` infrastructure for the map sheet, though not for WhatsApp/mailto generation.

## 40. Known issues

- Hero enquiry links are not instrumented with the same `data-track` analytics attributes as final and sticky CTAs.
- The three Property Details areas use different WhatsApp message templates; there is no shared message-generation helper.
- `PropertyFinalCta` and `StickyBottomCta` use WhatsApp/mailto shortcuts only; there is no enquiry form or submission confirmation.
- Map labels such as `Enquire about this plot` navigate to `#contact` but do not carry plot details into a message or submit an enquiry.
- `hello@ilahomes.example` and `https://ilahomes.example` are the literal configured/example destinations in the current code.
- Map popup enquiry behavior is navigation-only; no popup-specific enquiry action was confirmed beyond the `#contact` links.
- Exact behavior when browser popup blocking, missing mail clients, unavailable clipboard/share APIs, or malformed runtime property fields occurs is UNKNOWN — needs verification.

## 41. Important constraints

- Preserve the current `PropertyRecord` input contract and use normalized records for both local and API-backed properties.
- Preserve the exact current helper formats: `https://wa.me/?text=${encodeURIComponent(text)}` and the `mailto:hello@ilahomes.example` subject/body construction.
- Preserve the current message templates unless the intended customer-facing copy changes.
- Keep the hero, final, and sticky CTA prop contracts aligned with `PropertyPageView`.
- Do not treat `#contact` map links as implemented enquiry submission; they are fragment navigation only.
- Do not assume `ENQUIRY_SUBMIT` or `SITE_VISIT_REQUEST` is emitted; the current CTA code emits `ENQUIRY_CLICK` and `WHATSAPP_CHAT_CLICK` where explicitly instrumented.
- Keep local-storage wishlist/interested state separate from enquiry state; no enquiry state is currently persisted.
- Preserve sticky visibility behavior based on hero intersection, dismissal state, and the `0.12` observer threshold.
- Preserve the `760px` responsive layout breakpoint and fixed bottom sticky positioning unless the responsive contract intentionally changes.
- Application files were not modified for this documentation task. Existing working-tree changes must be preserved.