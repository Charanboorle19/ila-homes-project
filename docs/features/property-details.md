# Property Details feature

## Scope and terminology

This document describes the current Property Details implementation at `/properties/{propertyId}`. It complements, rather than repeats, [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-popup.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-popup.md).

## 1. Feature purpose

The feature presents a complete property/project detail page: overview, images, pricing, plot/project facts, buyer-fit guidance, neighbourhood context, lifestyle/amenities, financing, verification documents, location story, buying process, similar properties, and enquiry CTAs.

The page has one shared visual template, `PropertyPageView`, for both local/static properties and API-backed properties. API records are normalized into the local `PropertyRecord` shape before rendering.

## 2. Property Details page flow

`PropertyDetailPage` receives the route `propertyId`, first calls `getPropertyById(propertyId)`, and branches as follows:

1. A matching local id renders `<PropertyPageView property={property} />`.
2. No local record renders `<ApiPropertyView id={propertyId} />`.
3. `ApiPropertyView` validates that the id is a UUID, fetches the API property, documents, and life-stage fit independently, maps the result with `apiPropertyToRecord`, and renders the same `PropertyPageView`.
4. The shared template renders the page sections in a fixed order described in section 22.

## 3. How the page is opened/navigated to

The page is opened with an internal URL of the form `/properties/{propertyId}`. Current producers include:

- `PropertiesList` links for API property ids.
- `GrowthCorridors` property links using `/properties/{property.id}`.
- `SimilarProperties` links using `/properties/${property.id}` for local records.
- `PropertySheet` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`, whose `View Project` link uses the local/API property id when a `PropertyRecord` is available.

`PropertyHero` also provides breadcrumb links to `/` and `/properties`. A direct URL is valid for a UUID API property even though that UUID is not in the local static catalogue.

## 4. All supported property ID types

Two id types are supported by the route:

- **Local/static property ids:** `LayoutId` values from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` and `listPropertyIds()`.
- **API property ids:** UUID strings accepted by `isPropertyUuid()` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`.

API detail requests require the UUID, not the API property slug. A non-UUID id that is not found locally is treated as an API-view error.

## 5. Route structure

The route is `/properties/[propertyId]`, producing URLs such as `/properties/{local-id}` or `/properties/{uuid}`. The catalogue route is `/properties`; the home route is `/`.

## 6. Route/page file

The route file is `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\[propertyId]\page.tsx`.

It exports `generateStaticParams()`, `generateMetadata()`, and the default async `PropertyDetailPage({ params })` function. `params` is `Promise<{ propertyId: string }>`.

`generateStaticParams()` maps `listPropertyIds()` to `{ propertyId }`. `generateMetadata()` uses local `property.name` and `property.tagline`; for an API-only id it uses `${propertyId.replace(/-/g, " ")} · ILA Homes`.

## 7. Local property vs API property behavior

Local properties are synchronously read from the static `properties` array through `getPropertyById()`. They do not need a property-detail API request, document request, or life-stage-fit request.

API properties have UUID ids and are fetched in the browser by `ApiPropertyView`. The API result is mapped into a `PropertyRecord`. API-only data does not provide all local content: gallery, timeline, neighbourhood, connectivity details, and testimonial may use shared defaults or placeholders; API documents and life-stage scores are loaded separately.

## 8. `PropertyPageView` behavior

File: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx`.

`PropertyPageView({ property, documentsState = "ready" })` is a client component. It computes gallery, similar properties, and connectivity score with `useMemo`, tracks the property view with `useTrackPropertyView(property.id)`, owns the active gallery id, resets that id when the property changes, builds WhatsApp text, and renders the shared section tree.

## 9. `ApiPropertyView` behavior

File: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ApiPropertyView.tsx`.

`ApiPropertyView({ id }: { id: string })` owns three independent effects: `fetchPropertyById`, `fetchPropertyDocuments`, and `fetchPropertyLifeStageFit`. Each uses an `AbortController` and ignores results after abort. The property request controls the main loading/error screen. Documents and buyer fit do not block the main page.

When ready, it calls `apiPropertyToRecord(property, lifeStage, documents.items)` and renders `<PropertyPageView property={record} documentsState={documents.status} />`.

## 10. Exact component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\properties\[propertyId]\page.tsx` — route dispatcher and metadata.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — shared page composition.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ApiPropertyView.tsx` — API loading/normalization boundary.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyHero.tsx` — hero, summary, gallery, primary CTAs, tracked share control.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ShareButton.tsx` — POST /api/shares trigger, tracked-link field, copy and WhatsApp actions.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` — `createPropertyShare`, `buildShareUrl`, and the `ShareResult`/`ShareType`/`ShareChannel`/`ShareEntityType` types.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\LifeStageMatch.tsx` — Buyer Fit.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\FutureNeighbourhoodMap.tsx` — Future Neighbourhood.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\Lifestyle.tsx` — lifestyle/amenity content.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PriceEmiFuture.tsx` — pricing, EMI, amortization, future value.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\LegalDocuments.tsx` — Verification.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\SatelliteBeforeAfter.tsx` — Location Story.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\BuyingJourneySteps.tsx` — Buying Journey.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\SimilarProperties.tsx` — similar cards.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx` — final enquiry/save/share actions.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\StickyBottomCta.tsx` — scroll-triggered bottom CTA.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — property-detail styles.

## 11. Component props

- `PropertyPageView`: `property: PropertyRecord`; optional `documentsState: "loading" | "ready" | "error"`.
- `ApiPropertyView`: `id: string`.
- `PropertyHero`: `property`, `gallery: GalleryItem[]`, `activeImage`, `onSelectGallery(id)`, `connectivityScore`, `whatsappHref`, `siteVisitHref`, `priceLabel`; it is a `forwardRef<HTMLElement>`.
- `LifeStageMatch`, `FutureNeighbourhoodMap`, `Lifestyle`, `PriceEmiFuture`, `LegalDocuments`, `SatelliteBeforeAfter`, and `PropertyFinalCta`: `property: PropertyRecord`; `LegalDocuments` also accepts `documentsState`.
- `SimilarProperties`: `items: SimilarCard[]`.
- `StickyBottomCta`: `property`, `heroRef: RefObject<HTMLElement | null>`, `siteVisitHref`.

## 12. Property data sources

- Local/static: `properties`, `getPropertyById`, `getPropertyGallery`, `getPropertyLifestyle`, and `listPropertyIds` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.
- API: `apiFetch` through `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`.
- API normalization: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts`.
- Similar local records: `getSimilarProperties` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\similar.ts`.
- Derived helpers: `formatInr`, `computeConnectivityScore`, `futureValue`, `whatsappUrl`, and `siteVisitMailto` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\propertyUtils.ts`.
- Share: `createPropertyShare` and `buildShareUrl` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts`; visitor readiness from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\visitorReady.ts` and `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\visitor.ts`.
- Leads: `createPublicLead` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\leadsService.ts`, used by the final-CTA callback form on both property routes.
- Site visits: `bookPublicSiteVisit` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\siteVisitsService.ts`, used by the same form's booking control.

## 13. Exact data fields used

The shared page consumes these `PropertyRecord` fields: `id`, `name`, `location`, `locationKey`, `tagline`, `description`, `sqYards`, `areaSqFt`, `areaCents`, `facing`, `dimensions`, `roadWidth`, `propertyType`, `price`, `priceLabel`, `approval`, `possession`, `status`, `bankEligible`, `reraRegistered`, `corner`, `parkFacing`, `features`, `highwayKm`, `viewingCount`, `enquiryCount`, `lifeStageMatch`, `connectivity`, `connectivityScore`, `nearbyAmenities`, `documents`, `neighbourhood`, `coordinates`, `zoom`, `timeline`, `testimonial`, `gallery`, `lifestyle`, `specs`, and `popupSample` where the downstream component uses it.

Nested fields used include gallery `id/src/alt`; lifestyle `id/caption/src/alt`; documents `id/label/href/detail/documentType/sizeBytes/visibility`; neighbourhood `mapLabel/badge/existing/proposed`; timeline `year/title/story/zoom`; testimonial `quote/author/role`; and popup sample pricing, approval, inventory, project extent, plot sizes, status, developer, highlights, and amenities.

## 14. Data mapping/transformation

`apiPropertyToRecord()` maps API snake_case fields to `PropertyRecord`: names/location, descriptions, price and price labels, plot-size/configuration specs, approval/RERA, possession/status, inventory, amenities, coordinates, and connectivity score. It uses neutral defaults for unsupported local fields and sets `gallery` from `cover_url` when present.

`apiDocumentsToRecords()` maps `ApiPropertyDocument.id` to `id`, `name` to `label`, `storage_reference` to `href`, `document_type`, `size_bytes`, `visibility`, and `created_at` to the corresponding record fields. API life-stage personas are normalized through aliases into `family`, `investment`, `building`, and `retirement`.

## 15. APIs used

- `GET /api/properties/{id}` — API property detail.
- `GET /api/properties/{id}/documents` — API verification documents.
- `GET /api/properties/{id}/life-stage-fit` — API Buyer Fit scores.
- `GET /api/properties/{id}/nearby-places` — Future Neighbourhood landmarks for UUID properties.
- `POST /api/shares` — mints a tracked share link for a property. See §37a.
- `POST /api/leads` — creates the public lead from the final-CTA callback form. See §37.
- `POST /api/site-visits` — books a site visit from the same form. See §37.

The first three are called directly by `ApiPropertyView`/its rendered child. `FutureNeighbourhoodMap` also fetches nearby places; for a local property its current code uses the fallback sample UUID `6429f090-c01d-4bcc-9145-b9bfb8595843`.

## 16. API request structures

Requests are made with `apiFetch` and an optional `AbortSignal`; the API base URL and tenant behavior come from the existing API client/configuration.

`fetchPropertyById(id, signal)` requests `/api/properties/${encodeURIComponent(id)}` and rejects non-UUID ids before calling the API. `fetchPropertyDocuments` requests `/api/properties/${encodeURIComponent(id)}/documents`. `fetchPropertyLifeStageFit` requests `/api/properties/${encodeURIComponent(id)}/life-stage-fit`. `fetchNearbyPlaces` requests `/api/properties/${encodeURIComponent(propertyId)}/nearby-places`.

### POST /api/shares

`createPropertyShare({ entityId, message, signal })` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` sends:

```http
POST /api/shares
X-Visitor-Code: {visitor_code}
Content-Type: application/json
```

```json
{
  "share_type": "SYSTEMATIC",
  "share_channel": "WHATSAPP",
  "entity_id": "{property_id}",
  "entity_type": "PROPERTY",
  "message": "Please check this property"
}
```

`share_type`, `share_channel` and `entity_type` are fixed by the service and typed as `ShareType`, `ShareChannel` and `ShareEntityType`. `entity_id` is the property's `property_id`. Anonymous identity comes from the `visitor_code` cookie via `whenVisitorReady()`/`getVisitorCode()` and the `X-Visitor-Code` header, exactly as favourites and analytics do; a missing visitor code throws rather than falling back.

## 17. API response structures relevant to the page

The detail response is expected as `{ success?: boolean; data?: ApiProperty }`; documents as `{ success?: boolean; data?: { items?: ApiPropertyDocument[]; total?: number } }`; life-stage fit is an `ApiLifeStageFit`; nearby places are `{ success?: boolean; data?: ApiNearbyPlace[] }`.

The share response is `{ success?: boolean; data?: ShareResult }` where `ShareResult` is `share_id?`, `tracking_token?`, `tracking_url?`, `share_type?`. `createPropertyShare` throws if `data.tracking_token` is absent, since that token is the only thing the caller needs.

### GET /api/shares/{tracking_token}

`fetchSharePropertyId(trackingToken, signal)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` resolves a tracking token to the property it refers to:

```http
GET /api/shares/{tracking_token}
X-Tenant-Domain: {hostname}
X-Visitor-Code: {visitor_code}   // sent when a visitor code exists
```

Confirmed response shape:

```json
{
  "success": true,
  "data": {
    "property": {
      "id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
      "name": "Akshita Golden Breeze Phase 2",
      "price": 1197000,
      "property_type": "PLOT",
      "status": "ACTIVE"
    }
  }
}
```

`data.property` is a **summary**, not the full property payload. Only `data.property.id` is consumed; it is the same property id posted to `POST /api/shares` as `entity_id` with `entity_type: "PROPERTY"`. The full property is then loaded from the existing `GET /api/properties/{id}`, so the share response's `name`, `price`, `property_type` and `status` are never rendered directly.

`fetchSharePropertyId` throws when `data.property.id` is absent. The visitor code is optional here — a visitor opening a link they were sent is usually not the visitor who created it, so the request is not gated on one, unlike `POST /api/shares`. `X-Tenant-Domain` is attached by `apiFetch` to every request.

`ApiProperty` fields used by the mapper include `id`, `location_id`, `name`, `slug`, `description`, `short_description`, `property_type`, `listing_type`, `configuration`, `price`, `minimum_price`, `target_price`, `price_label`, `price_per_sqft`, `negotiable`, `total_inventory`, `available_inventory`, `sold_inventory`, `availability_status`, `status`, `address`, `locality`, `landmark`, `location_name`, `city`, `state`, `pincode`, `latitude`, `longitude`, `area`, `facing`, `amenities`, `connectivity_score`, `rera_registered`, `rera_number`, `cover_url`, `possession`, and metadata used for approval/developer/project values. Any response fields outside the typed service subset are UNKNOWN — needs verification.

## 18. Functions

Route/page: `generateStaticParams`, `generateMetadata`, `PropertyDetailPage`. Data: `getPropertyById`, `getPropertyGallery`, `getPropertyLifestyle`, `listPropertyIds`, `fetchPropertyById`, `fetchPropertyDocuments`, `fetchPropertyLifeStageFit`, `fetchNearbyPlaces`, `createPropertyShare`, `buildShareUrl`, `apiDocumentsToRecords`, and `apiPropertyToRecord`. Page composition: `useTrackPropertyView`, `computeConnectivityScore`, `getSimilarProperties`, `whatsappUrl`, and `siteVisitMailto`. Component-local functions include gallery selection, life-stage goal selection, nearby-item mapping, timeline selection, wishlist/interested `toggle`, final-CTA `share`, and `ShareButton`'s `create`/`copy`.

## 19. Hooks

The page uses React `useEffect`, `useMemo`, `useRef`, `useState`, `useId`, and `forwardRef`. It uses `useTrackPropertyView` from `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\analytics\usePropertyView.ts`. Map sections use MapLibre lifecycle effects; `StickyBottomCta` uses `IntersectionObserver` through an effect. `ShareButton` uses `useEffect` (property-change reset, unmount timer cleanup), `useRef` (copy timer), and `useState`.

## 20. State variables

- `ApiPropertyView`: `property`, `lifeStage`, `documents`, `state`.
- `PropertyPageView`: `activeGalleryId`.
- `LifeStageMatch`: `goal`, `animated`, plus `shownRef`.
- `FutureNeighbourhoodMap`: map refs, `horizon` (`"today" | "2029"`), `nearBy`, API items/loading state, and map failure/readiness state.
- `Lifestyle`: `activeId`, `paused`.
- `PriceEmiFuture`: `purchasePrice`, `downPaymentMode`, `downPaymentPct`, `downPaymentFlat`, `annualRate`, `tenureUnit`, `tenureValue`, `amortizationMode`, `isAmortizationExpanded`, `budgetOpen`; it also has generated ids and `printAreaRef`.
- `SatelliteBeforeAfter`: `activeYear`, `mapReady`, `mapError`, and map/marker refs.
- `PropertyFinalCta`: `wishlist`, `shareNote`, `fields` (`{ name, phone, description, scheduledAt }`), `errors`, `status` and `statusMessage` for the callback, `visitStatus`, `visitMessage` and `visitError` for the booking.
- `StickyBottomCta`: `visible`, `dismissed`, plus `barRef`. It measures the rendered bar with a `ResizeObserver` and publishes `--pd-sticky-clearance` on `document.documentElement` (bar height + `12px`), removing the property on cleanup. `.pd-final` consumes it as `padding-bottom`. See §21a.
- `ShareButton`: `status` (`"idle" | "loading" | "ready" | "error"`), `shareUrl`, `copied`, plus `copyTimerRef`.

## 21. Derived/normalized data

`PropertyPageView` derives `gallery`, `similar`, `connectivityScore`, `activeImage`, and WhatsApp text. `PropertyHero` derives the spec row from `property.specs` or the fixed `Size/Facing/Dimensions/Road` fields. `PriceEmiFuture` derives effective down payment, percentage, principal, tenure months, monthly EMI, total interest/payment, future values, and amortization schedules. `FutureNeighbourhoodMap` derives display labels, horizon-filtered items, map GeoJSON, and demo distance from Gachibowli. `apiPropertyToRecord` supplies all API-to-record normalization.

## 21a. Sticky-bar clearance

`.pd-sticky` is `position: fixed; bottom: 0; z-index: 60`, so it is out of flow and overlays whatever sits at the bottom of the page. The last section is `.pd-final`, which is where the enquiry form's buttons are. Without matching bottom padding the bar paints over those buttons and swallows their clicks, and because a fixed element intercepts the event the button gives no feedback at all — no focus, no request, no message. It reads as a dead button rather than as an overlap.

`StickyBottomCta` therefore measures itself and publishes the result as `--pd-sticky-clearance` on `document.documentElement`; `.pd-final` spends it as `padding-bottom`.

| Concern | Behaviour |
|---|---|
| Measurement | `ResizeObserver` on `barRef`, so the value updates when the bar resizes |
| Value | `Math.ceil(height + 12)`, leaving a `12px` gap above the bar |
| Variable | `--pd-sticky-clearance`, inheritable from `documentElement` |
| Consumer | `.pd-final { padding-bottom: var(--pd-sticky-clearance, 0px) }` |
| When the bar is hidden | The effect runs with a null ref, removes the property, and the padding falls back to `0px` |
| Dismissal | The close button unmounts the bar, cleanup removes the property, and the reserved space collapses rather than leaving a trailing gap |
| Why measured, not hard-coded | The actions row is `flex-wrap: wrap` and becomes a horizontal row at `760px`, and `padding-bottom` adds `env(safe-area-inset-bottom)`. Both change the height, so a constant would stop clearing the bar at exactly the widths where the actions wrap |

Reset on `property.id` change is unchanged: `dismissed` resets to `false`, so the bar returns and republishes its height.

## 22. Page sections and their order

`PropertyPageView` renders, in this exact order:

1. `PropertyHero`
2. `LifeStageMatch`
3. `FutureNeighbourhoodMap`
4. `Lifestyle`
5. `PriceEmiFuture`
6. `LegalDocuments`
7. `SatelliteBeforeAfter`
8. `BuyingJourneySteps`
9. `SimilarProperties`
10. `PropertyFinalCta`
11. `StickyBottomCta` (conditionally visible over the page)

## 23. Hero/property summary

`PropertyHero` renders breadcrumbs, approval/RERA/possession badges, `name`, `tagline`, `description`, specs, `priceLabel` or `formatInr(price)`, connectivity score, viewing/enquiry counts, WhatsApp enquiry, schedule-site-visit actions, and — for UUID properties only — the tracked `ShareButton`. It uses `next/image` for the active gallery image. See §37a for the share control.

## 24. Property images/gallery

`getPropertyGallery(property)` returns `property.gallery` or `DEFAULT_GALLERY`. `PropertyPageView` selects the first image initially and resets selection on property change. `PropertyHero` renders the active image, count, and clickable thumbnails. API properties use a one-item gallery from `cover_url` when available; without it, the shared default gallery is used.

## 25. Pricing

Hero pricing uses `property.priceLabel ?? formatInr(property.price)`. The API mapper can preserve a published API price range/label. The similar-properties cards use `formatInr(property.price)`. The popup’s pricing is separate and is documented in `property-popup.md`.

## 26. Property/project information

The hero presents `sqYards`, `facing`, `dimensions`, and `roadWidth`, unless `specs` exists. API records can instead show structured specs such as plot-size range, project area, plot count, and configuration. Approval, possession, status, property type, bank eligibility, RERA registration, corner/park-facing flags, and features are part of the normalized record and are consumed by the relevant sections/cards.

## 27. Location information

The hero displays `property.location`. `FutureNeighbourhoodMap` displays `property.neighbourhood.mapLabel`, nearby landmarks, categories, statuses, distances, and optional Gachibowli demo distance. `SatelliteBeforeAfter` centers on `property.coordinates` and labels the map with name/location.

## 28. Amenities

`Lifestyle` calls `getPropertyLifestyle(property)`. Local records use lifestyle items with captions and optional images. API amenities are mapped into lifestyle items; API properties with more than six items use a dense list and do not auto-cycle. API amenities without imagery render typographic panels rather than broken images. The normalized `features` and `popupSample.amenities` remain separate data used by other views.

## 29. Developer information

There is no separately rendered developer component in `PropertyPageView`. API developer metadata is mapped into `popupSample.developer` for the map `PropertySheet`, while `developerExperience` and `projectsCompleted` are currently mapped to `"—"` for API records. A full Property Details developer section is UNKNOWN — needs verification.

## 30. EMI / future-value calculator

`PriceEmiFuture` renders the affordability/financing section. It defaults purchase price to `property.price` when positive, otherwise `50_00_000`; down payment defaults to 20%; annual rate to `8.5`; and tenure to 20 years. It supports percentage/flat down payment, years/months tenure, yearly/monthly amortization, expand/collapse, and a WhatsApp budget modal.

EMI uses the standard principal/rate/month formula, with a zero-rate path. Future value uses `futureValue` with `ANNUAL_APPRECIATION = 0.11`. The rendered heading id is `pd-emi-title`; an element with exact id `loan-calculator` is UNKNOWN — needs verification.

## 31. Buyer Fit

`LifeStageMatch` renders the “Buyer fit” section with goals `family`, `investment`, `building`, and `retirement`, initially selecting `family`. It reads `property.lifeStageMatch[goal]`, displays score/reason, animates score transitions unless reduced motion is preferred, and displays `—` for pending/unavailable scores. API scores arrive asynchronously from `/life-stage-fit`; failure produces the normalized unavailable state.

## 32. Future Neighbourhood

`FutureNeighbourhoodMap` renders current/2029 horizon controls, a “Near by me” toggle, a nearby landmark list, and a MapLibre map. It uses `GET /api/properties/{id}/nearby-places` for UUID ids, maps API categories/status/proximity labels, and uses static `neighbourhood.existing/proposed` data otherwise. “Near by me” is explicitly a fixed Gachibowli demo distance, not device GPS. Heading id: `pd-future-title`.

## 33. Location Story

`SatelliteBeforeAfter` renders `property.timeline` year tabs, the active title/story, and a MapLibre satellite map with a marker at `property.coordinates`. It uses an Esri World Imagery raster style and changes map zoom from the active timeline entry. Copy states that tiles are approximate demo context, not surveyed boundaries. Heading id: `pd-sat-title`.

## 34. Verification / legal documents

`LegalDocuments` renders the section with id `documents`. It displays loading, error, published-document, or empty copy. Each document uses `label`, `documentType`, `visibility`, `sizeBytes`, `detail`, and optional `href`; links open in a new tab with `rel="noreferrer"`. API documents come from `/documents`; local records use their static `documents` array. The “View build rules” link targets `#document-build-rules`, whose target is UNKNOWN — needs verification.

## 35. Buying Journey

`BuyingJourneySteps` is static and renders five steps in order: Enquire, Site Visit, Legal Verification, Book & Pay, Registration. It has no props, API calls, or local state. Heading id: `pd-journey-title`.

## 36. Similar properties

`getSimilarProperties(property, 6)` scores only the local `properties` array, excludes the current property and sold properties, and scores locality, price band, property type, facing, corner/park-facing, shared features, approval, and availability. `SimilarProperties` returns `null` when there are no matches; otherwise it links to `/properties/{candidate.id}` and displays local gallery, approval, name, location, size, facing, price, and reasons.

## 37. Property enquiry / WhatsApp CTA

`PropertyHero`, `PropertyFinalCta`, and `StickyBottomCta` generate `https://wa.me/?text=...` links through `whatsappUrl`. They open WhatsApp links in a new tab. Site visits also use `siteVisitMailto`, which creates a `mailto:hello@ilahomes.example` link with encoded subject/body. Analytics data attributes include `WHATSAPP_CHAT_CLICK` and `ENQUIRY_CLICK` on applicable CTAs.

`PropertyFinalCta`'s `Share property` chip is deliberately excluded from that section's enquiry behaviour. It uses the Web Share API where available and otherwise copies `window.location.href` to the clipboard. It never opens a chat app: there is no `whatsappUrl` fallback in the share path. Dismissing the native share sheet rejects with `AbortError`, which is treated as a deliberate "no" and returns without setting a note or running any fallback.

### Final-CTA enquiry form

`PropertyFinalCta`'s "Next step / Ready to explore" section presents an enquiry **form** rather than enquiry links. Because both routes render the same `PropertyPageView`, the form appears identically on `/properties/{propertyId}` and `/property/{trackingToken}/view`.

**Fields, in order:**

1. `Name` — required.
2. `Phone number` — required, `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`. Validated as 10–15 digits after stripping spaces, dashes, brackets and a leading `+`, so `+91 98765 43210` passes.
3. `Description` — **optional**, a 3-row textarea spanning the full width and placed last so the two required answers come first. It carries an inline `Optional` marker in the label row and an `aria-describedby` hint. It is never validated.

**Behavior:** `noValidate` with custom validation so the messages match the page's voice rather than the browser's locale-dependent bubbles. A field's error clears as soon as it is edited. Errors are rendered as text and wired with `aria-invalid` plus `aria-describedby`; ids come from `useId`. Fields and errors reset when `property.id` changes. The submission note is announced through `role="status"`.

**Two submission paths, as alternatives.** The form posts either a callback request to `POST /api/leads` or a booking to `POST /api/site-visits`. They are alternatives rather than steps, because `/api/site-visits` itself creates or reuses the visitor and their existing lead for the property — so chaining both would create two interactions for one visitor. Each path has independent status and message state.

- **Callback** — `createPublicLead` in `src/services/leadsService.ts`, with `X-Visitor-Code`. `Phone number` maps to `mobile`, `Description` to `message`, `email` and `unit_id` are always `null`, and `property_id` is sent only when `isPropertyUuid(property.id)` so a catalogue slug becomes `null` rather than triggering `404 PROPERTY_NOT_FOUND`.
- **Site visit** — `bookPublicSiteVisit` in `src/services/siteVisitsService.ts`. `property_id` is **required** there, so both the slot picker and the button render only when `isPropertyUuid(property.id)`. The `datetime-local` picker is a normal full-width field inside the form, positioned after the description, because it reuses the name and phone entered above it; the button is the second child of `.pd-form__submit`. `scheduled_at` is converted from the local wall-clock value with `toISOString()`, and re-checked in the future client-side even though the control's `min` already floors it. `Description` is reused as `notes`. `X-Visitor-Code` is optional for this endpoint, so it is sent only when one already exists.

`apiFetch` throws on non-2xx, so both success messages are reachable only after `201 Created`. Both buttons are `disabled` with `aria-busy` while in flight, and both preserve the draft on failure. Full detail in `docs/features/property-enquiry-form.md`.

**Removed controls.** The section no longer renders `WhatsApp enquiry`, `Email site visit` (`siteVisitMailto`), `I'm interested`, or the former `WhatsApp site visit` link — the last replaced by the booking button. The `ila-interested-{id}` localStorage key is no longer written. `Save to wishlist` and `Share property` remain. `whatsappUrl` and `waVisitText` were dropped from this component; `PropertyHero` and `StickyBottomCta` still use them. `.pd-final__actions` was removed from the stylesheet because nothing renders it any more.

New classes, all in `PropertyDetail.css`: `.pd-form`, `.pd-form__row`, `.pd-form__field`, `.pd-form__field--wide`, `.pd-form__label`, `.pd-form__hint`, `.pd-form__input`, `.pd-form__textarea`, `.pd-form__error`, `.pd-form__submit`, `.pd-form__status`, `.pd-form__status--sent`, `.pd-form__status--error`. The form uses the page tokens (`--pd-line`, `--pd-soft`, `--pd-surface`, `--pd-ink`, `--pd-gold`) and the same two-layer shadow as the other lifted surfaces. `.pd-form__row` is single-column by default and becomes two columns at `min-width: 760px`, matching the existing breakpoint. There is no separate wrapper class for the booking control: the slot picker is an ordinary `.pd-form__field--wide` and the booking button is the second child of `.pd-form__submit`.

## 37a. Tracked property share

`ShareButton` renders as a panel directly below `.pd-hero__price-row` in `PropertyHero`'s copy column — **not** as a third member of `.pd-hero__actions`. At the wide breakpoint `.pd-hero__price-row` becomes a row (`flex-direction: row`) with `.pd-hero__price-block` as a sibling, so a wide share element inside the CTA row competes with the price block for space and squeezes the price into a multi-line wrap. It is also distinct from `PropertyFinalCta`'s `share`, which shares `window.location.href` directly through the Web Share API with no backend call and no tracking.

### Availability

The control renders only when `isPropertyUuid(property.id)` is true. Tracked sharing requires the property's real `property_id`, which only properties served by `GET /api/properties` carry — `apiPropertyToRecord` sets `id` to the API UUID. The static catalogue's `LayoutId` values are slugs and are not valid entity ids, so local records show no share control. This differs from `PropertyFinalCta`, which renders for every property.

### Behavior

1. Idle: a `Share {propertyName}` ghost button. No request has been made yet — minting a share on mount would record a share nobody asked for.
2. Pressed: `createPropertyShare` posts to `/api/shares` (see §16). The button shows "Creating link…" and is disabled with `aria-busy`.
3. Ready: the panel appears with a `Tracked link` caption, the tracked URL, and `Copy link` / `Share on WhatsApp`. The URL **is** the link — an `<a>` to `shareUrl` with `target="_blank"` and `title={shareUrl}`, so clicking the address opens it. There is no separate view button; viewing and sharing are the same string. Copy uses `navigator.clipboard.writeText`, falls back silently when the clipboard is blocked, and confirms with a "Copied" label for 2s; the URL text remains selectable by hand as a fallback. `Share on WhatsApp` opens `whatsappUrl(`${message}\n${shareUrl}`)`, which is why the share is created with `share_channel: "WHATSAPP"`. The response's `share_id` is not displayed — a raw UUID reads as clutter to a visitor.
4. Error: the button becomes `Retry share` and a `role="alert"` message explains that the link could not be created.

Every press mints a fresh token, so a shared link always reflects the click that produced it.

### Link construction

`buildShareUrl(trackingToken, origin)` returns:

```text
{origin}/property/{tracking_token}/view
```

`origin` is `window.location.origin` — the domain the page is being viewed on. This deliberately avoids `NEXT_PUBLIC_API_URL`, which may be a transient ngrok tunnel in development and would produce unshareable links.

The tracking token is not a property id, so it gets its own `/property/{token}/view` path rather than the catalogue's `/properties/{propertyId}`. The `/api/` prefix is never exposed to a visitor: an `/api/shares/{token}` link reads as a machine endpoint and invites callers who then bypass the page that records the visit. The response's relative `tracking_url` field is not used — the token is, per the specified URL shape.

### States and reset

`status` is `idle | loading | ready | error`. An effect resets to `idle` and clears any minted link when `propertyId` changes, so a link for one property is never shown against another. A second effect clears the copy-confirmation timer on unmount. Only `status`, `shareUrl` and `copied` are held as state; the `ShareResult` is not retained once the URL has been built from it.

### Styling

`.pd-share` is a bordered panel with a translucent surface: caption, then the URL, then the two actions stacked vertically. `.pd-share--bare` strips the border, padding and background for the idle and error states, since a single pill inside an empty box reads as a broken layout.

Supporting classes: `.pd-share--bare`, `.pd-share__label`, `.pd-share__link`, `.pd-share__actions`, `.pd-share__error`, `.pd-btn--sm` (compact buttons for the panel, so they do not need full CTA height), and a `.pd-btn:disabled` rule. All are in `PropertyDetail.css`.

`.pd-share__link` is an anchor, so it carries `overflow: hidden`, `white-space: nowrap` and `text-overflow: ellipsis` to truncate the long token rather than reflow the panel, `text-decoration: none` so it does not read as underlined body copy, a hover state, and a `:focus-visible` gold outline so it is reachable by keyboard. `.pd-share__label` is a `<span>`, not a `<label>` — there is no form control to associate it with, so `useId` was dropped with the input.

## 37b. Tracked share landing route

**Exact path:** `/property/{tracking_token}/view`
**Source:** `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\property\[trackingToken]\view\page.tsx`

This route exists so a link produced by `ShareButton` resolves to the standard property page. It is a tracked *entry point*, not a second property page.

### Flow

```text
/property/{tracking_token}/view
  → GET /api/shares/{tracking_token}        (fetchSharePropertyId)
  → data.property.id
  → <ApiPropertyView id={propertyId} />
  → GET /api/properties/{id}, /documents, /life-stage-fit
  → apiPropertyToRecord(property, lifeStage, documents)
  → <PropertyPageView property={record} />
```

The token is never treated as a property id, and property content is never read from the share response. That response is a summary — `id`, `name`, `price`, `property_type`, `status` — so only `data.property.id` is used; the property itself is fetched from `GET /api/properties/{id}`, exactly as the existing route does. The share endpoint answers only "which property is this share for?"; everything after that is the existing property pipeline, unchanged.

Note that the property detail endpoint is `GET /api/properties/{id}` — plural, the path the existing route uses — not `/api/property/{id}`. Reusing it is what guarantees the tracked page renders identical data to the catalogue page.

### Response logging

Because this endpoint's response body is not confirmed, `fetchSharePropertyId` logs to the browser console so the actual shape is visible:

- `[share] GET /api/shares response` — the raw `{ success, data }` envelope, exactly as received.
- `[share] resolved tracking token to property` — `{ trackingToken, propertyId, propertyName }` on success.
- `[share] response had no data.property.id; received data = …` — a warning carrying the received `data`, so a differently shaped payload shows what actually arrived instead of just failing.
- `[share] GET /api/shares/{tracking_token} with X-Tenant-Domain = …` — the resolved tenant, logged before the request.

These are diagnostic logs for an unconfirmed contract and should be removed once the endpoint's response is verified.

### Tenant header

The token request carries `X-Tenant-Domain` because every `apiFetch` call attaches it; `TENANT_HEADER` is `"X-Tenant-Domain"` and `apiFetch` sets it from `tenantDomain ?? resolveTenantDomain()` before spreading caller headers. `resolveTenantDomain()` returns `window.location.hostname` in the browser and `SITE_DOMAIN` server-side, and throws rather than sending an empty value. The route is a client component, so the tenant is the hostname the visitor is actually browsing — for example `192.168.29.7` on a LAN address, or `localhost` in local development. Note that `hostname` excludes the port, so a `:3000` site sends `localhost`, not `localhost:3000`.

`fetchSharePropertyId` does not pass a `tenantDomain` override, so it cannot accidentally replace the resolved value with a stale or wrong tenant.

### UI sharing

Both routes converge on the same `PropertyPageView`:

- `/properties/{propertyId}` renders `PropertyPageView` directly for a local static record, or `ApiPropertyView` for an API UUID.
- `/property/{tracking_token}/view` renders `ApiPropertyView` with the resolved id.

`ApiPropertyView` owns the property request, documents and Buyer Fit, and calls `apiPropertyToRecord`. This route contributes **no** property formatting, imports no detail section, and adds no CSS. Layout, typography, colors, spacing, hero, gallery, amenities, Buyer Fit, Future Neighbourhood, Location Story, documents, Buying Journey, Similar Properties, enquiry CTAs, sticky CTA, icons, animations and responsive behaviour are identical by construction, because the same component tree renders them.

No detail component is duplicated or forked. The only new files are the route and one service function.

### Loading and error behavior

The route owns only the token resolution:

- **Resolving:** `Loading property…`, identical wording to `ApiPropertyView`'s own loading state.
- **Unresolvable or failed:** an in-page `Not found` / `Property unavailable` state with a link back to `/properties`, using the same classes and copy as `ApiPropertyView`'s error state so a dead share link looks like any other failed property load.
- The token request is abortable via `AbortController` and its result ignored after abort.

The route deliberately does not call `notFound()`; there is no `not-found.tsx` in this application, so the in-page state matches the rest of the property detail experience.

### Known unknowns

- Whether `GET /api/shares/{tracking_token}` records the visit as a side effect of being read is UNKNOWN — needs verification. If it does, the request must not be prefetched or cached, or the share will be counted more than once.
- Whether the endpoint requires a visitor cookie before it will resolve a token is UNKNOWN — needs verification. The request does not gate on one.
- The route is a client component so the token request runs where tenant resolution uses the browser hostname, consistent with every other data load in the application. It therefore provides no `generateMetadata`; the shared page has no route-level title. The share response does carry `data.property.name`, so a title could be set from it if link previews matter.

## 38. Brochure/document behavior

The Property Details page has no confirmed brochure-specific component or `#brochure` target. `LegalDocuments` is the confirmed document behavior and uses API `/documents` for UUID properties. The map `PropertySheet` has a `#brochure` fragment link but does not fetch a brochure. Whether a `#brochure` element exists on the current Property Details page is UNKNOWN — needs verification.

## 39. Navigation and internal anchors

Confirmed Property Details anchors are `documents`, `document-build-rules` (link target only), `pd-match-title`, `pd-future-title`, `pd-life-title`, `pd-emi-title`, `pd-legal-title`, `pd-sat-title`, `pd-journey-title`, `pd-similar-title`, and `pd-final-title`. The map popup links to `#brochure` and `#loan-calculator`; exact target elements for those two ids are UNKNOWN — needs verification. Internal links also include `/`, `/properties`, and similar-property `/properties/{id}` routes.

## 40. Relationship with Property Popup / PropertySheet

There is no standalone `PropertyPopup`; the map equivalent is `PropertySheet` inside `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`. Its `View Project` link can navigate to this route when it has a `PropertyRecord`. Its `#brochure` and `#loan-calculator` links are fragment links only. `PropertySheet` does not render `PropertyPageView` and does not call the documents or life-stage-fit endpoints.

## 41. Relationship with Map feature

The map can resolve API properties by UUID and can open the summary sheet/layout. The Property Details page is a separate route and uses the API property id passed by map/list links. Its `FutureNeighbourhoodMap` and `SatelliteBeforeAfter` use MapLibre independently of the home `MapSection`; map implementation details remain in `map.md`.

## 42. Relationship with Property List

`/properties` renders `PropertiesIndexPage` and `PropertiesList`, which loads live catalogue data. Clicking a list item produces `/properties/{property.id}`. A local id selects the static branch; a UUID selects the API branch. `generateStaticParams` only covers local ids, while API UUIDs are handled client-side by `ApiPropertyView`.

## 43. Loading states

The main API route shows `Loading property…` in a centered `min-h-[70vh]` page while `state === "loading"`. Documents independently show `Loading the latest property documents…` and a “Loading documents” row. Buyer Fit uses pending placeholders and does not block the page. Future Neighbourhood can show `Loading nearby landmarks…`; map loading itself has no separate confirmed user-facing spinner beyond the list state.

## 44. Error states

Invalid/non-UUID API ids and failed detail requests show “Not found”, “Property unavailable”, explanatory copy, and a `/properties` “← Back to properties” link. Document failure shows “Documents could not be loaded right now. Please try again later.” Buyer-fit failure becomes unavailable rather than an endless spinner. Map failures show the relevant fallback copy while list/story content remains usable.

## 45. Empty/missing-data states

Missing API cover image falls back to the shared gallery through `getPropertyGallery`. Missing API amenities fall back to shared lifestyle data. Missing API timeline/neighbourhood/connectivity details use empty/placeholder values. No documents shows “No documents have been published for this property yet.” No similar properties causes `SimilarProperties` to render nothing. Missing exact brochure/loan-calculator targets are UNKNOWN — needs verification.

## 46. Mobile behavior

The Property Details components use responsive CSS classes and `PropertyDetail.css`; `PropertyHero` changes gallery image sizing at the 900px breakpoint. The gallery, section layouts, calculator tables, document rows, CTA groups, and maps are designed to remain usable in narrow layouts. Exact pixel-by-pixel mobile behavior is defined by CSS and is otherwise UNKNOWN — needs verification.

## 47. Desktop behavior

Desktop presentation is provided by the same components and `PropertyDetail.css`, with wider hero/gallery, two-column content layouts, map/list layouts, and expanded calculator tables. `PropertyHero` uses `42vw` gallery sizing and lifestyle uses `56vw` image sizing in `next/image` hints. Exact breakpoint behavior beyond the source CSS is UNKNOWN — needs verification.

## 48. External integrations

- API requests use the existing `apiFetch` client, `NEXT_PUBLIC_API_URL`, and tenant configuration.
- MapLibre GL renders Future Neighbourhood and satellite maps; the worker is `/maplibre/maplibre-gl-worker.mjs`.
- Esri World Imagery supplies the satellite raster tiles.
- OpenFreeMap’s Liberty style is used by Future Neighbourhood.
- `next/image` renders remote/local property images.
- WhatsApp uses `https://wa.me/?text=...`.
- Site visits use `mailto:hello@ilahomes.example`.
- Web Share API and Clipboard API are used by `PropertyFinalCta.share`. That path has no chat-app fallback.
- `POST /api/shares` with `X-Visitor-Code` mints tracked share links; the Clipboard API and `whatsappUrl` are used by `ShareButton`.
- `localStorage` stores `ila-wishlist-{id}` and `ila-interested-{id}`.
- Analytics uses `trackEvent` through `useTrackPropertyView` and CTA data attributes.

## 49. Dependencies

Relevant dependencies are Next.js (`next/link`, `next/image`), React, `maplibre-gl`, GeoJSON types, the internal API client/services, property data/mapping modules, analytics tracker, and `WhatsAppBudgetModal`. Tracked sharing adds `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\shareService.ts` and the visitor readiness/cookie helpers it awaits. Styling uses `PropertyDetail.css` plus existing utility classes. No separate property-popup or modal library is used for the page.

## 50. Known issues

- API properties are normalized into a static-oriented record, so several sections use placeholders or shared defaults.
- API `developerExperience` and `projectsCompleted` are currently `"—"`.
- API properties without `cover_url` do not have an API-specific gallery and use shared gallery fallback behavior.
- The `#brochure`, `#loan-calculator`, and `#document-build-rules` targets are not confirmed in the inspected Property Details render tree.
- Similar properties are local/static only; API-backed properties are not included in the similarity source.
- `FutureNeighbourhoodMap` uses a fixed sample UUID for local properties and labels the Gachibowli proximity value as demo/non-GPS.
- Satellite imagery is approximate demo context, not surveyed boundaries.
- The exact API response fields beyond the typed subset in `ApiProperty` are UNKNOWN — needs verification.
- Tracked sharing is unavailable on static/local properties, because `isPropertyUuid` gates the control and local records carry slugs rather than a `property_id`. `PropertyFinalCta` still offers an untracked share for those.
- `buildShareUrl` produces `{origin}/property/{token}/view`, served by `src/app/property/[trackingToken]/view/page.tsx`, which resolves the token through `GET /api/shares/{tracking_token}` and then renders the existing `ApiPropertyView`. See §37b.
- The tracked route performs two sequential requests (token resolution, then the property). A token that resolves to a property with no accessible detail still renders the unavailable state.
- `fetchSharePropertyId` reads only `data.property.id`. If the endpoint ever returns the property under a different key, that single accessor is the only thing that needs to change; the UI layer is unaffected.
- The tracked route resolves client-side and so has no `generateMetadata`; the shared URL carries no route-level title or description.
- Every press of the share button mints a new share server-side. There is no reuse of a previously minted token, so repeated presses inflate the property's share count.
- `ShareButton` has no analytics `data-track` attributes. Adding an event name that the tracker's allow-list does not contain would produce dropped-event warnings, and the share is already recorded server-side.
- The final-CTA enquiry form posts to `POST /api/leads`. `apiFetch` sends no `credentials`, so the `visitor_code` cookie does not reach the endpoint and identification relies entirely on the `X-Visitor-Code` header — the same as every other visitor-scoped call here. If that endpoint specifically requires the cookie, `apiFetch` needs a `credentials` option.
- `property_id` is only attached when `isPropertyUuid(property.id)`. Local catalogue properties send `null`, so those leads reach the team without a property reference.
- Clipboard copying depends on `navigator.clipboard`, which can be blocked by permissions or in an insecure context. The field stays selectable as a fallback, but no user-facing message is shown when copying fails.

## 51. Important constraints

- Do not treat an API UUID as a local `LayoutId`; route dispatch depends on `getPropertyById` first and `isPropertyUuid` for API loading.
- API detail/document/life-stage requests must use the property UUID, not the slug.
- Preserve the shared `PropertyRecord` contract or update `apiPropertyToRecord` and every rendered child together.
- Preserve the `PropertyPageView` render order and component prop contracts unless the intended page structure changes.
- Preserve `apiFetch` so API base URL, tenant headers, abort signals, and existing error behavior remain intact.
- Keep API document and life-stage requests independent of the main property request; they are intentionally non-blocking.
- Keep fragment-link behavior distinct from confirmed integrations: `#brochure` and `#loan-calculator` do not themselves fetch or render those features.
- Keep map coordinates in `[longitude, latitude]` order.
- Do not interpret demo satellite tiles or Gachibowli distance as surveyed or device-geolocation data.
- Keep `entity_id` in `POST /api/shares` equal to the property's `property_id`, and keep the control gated behind `isPropertyUuid` so a slug is never posted as an entity id.
- Do not mint a share on mount or otherwise outside a user gesture; the share count must reflect intent.
- Keep anonymous visitor identity for `POST /api/shares` on `X-Visitor-Code` via `whenVisitorReady()`, distinct from optional bearer-token auth and tenant identity.
- Preserve the `ShareResult` shape and the throw-on-missing-`tracking_token` behaviour: without a token there is no link, and silently succeeding would show an empty field.
- `/property/{tracking_token}/view` must keep resolving its content through the existing property detail path (`ApiPropertyView` → `apiPropertyToRecord` → `PropertyPageView`). Do not render property data straight from the share response, and do not add a second property detail template — the tracked route differs only in which URL resolved the property.
- Keep the tracked route's token resolution independent of `X-Visitor-Code` availability; a recipient's visitor code is not the creator's.
- Do not prefetch or cache `GET /api/shares/{tracking_token}` until it is confirmed whether reading it records the share as viewed.
- Unrelated existing working-tree changes must be preserved.