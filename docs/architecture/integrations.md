# Integrations Architecture

This document describes only integrations confirmed in the current source under `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src`, project configuration, and completed feature documentation. Installed packages without active source usage are not treated as integrations.

## 1. Integration architecture overview

The Next.js App Router frontend uses client-side service modules to call a tenant-aware external ILA API. MapLibre renders maps and consumes normalized API/static geometry. Browser facilities provide anonymous identity, session state, local flags, sharing, navigation, and engagement tracking. A single server Route Handler proxies presigned S3 layout images because the bucket is not browser-readable. Static property/layout data and explanatory homepage content remain local and are not external integrations.

## 2. Backend/API integration

**Service:** ILA backend API. **Purpose:** properties, units/plots, locations, documents, Buyer Fit, nearby places, visitors, sessions, favourites, and analytics. **Where:** `src/services/apiClient.ts`, `propertiesService.ts`, `locationsService.ts`, `favoritesService.ts`, `visitorService.ts`, `services/analytics/tracker.ts`, `MapSection.tsx`, `GrowthCorridors.tsx`, `PropertiesList.tsx`, and `ApiPropertyView.tsx`.

**Base/config:** `NEXT_PUBLIC_API_URL` is required; trailing slashes are removed. Requests are `${NEXT_PUBLIC_API_URL}${path}`. Confirmed paths are `GET /api/properties`, `GET /api/properties/{id}`, `GET /api/properties/{id}/units?limit=all`, `GET /api/properties/{id}/documents`, `GET /api/properties/{id}/life-stage-fit`, `GET /api/properties/{id}/nearby-places`, `GET /api/locations`, location-filtered `GET /api/properties`, visitor/session POSTs, favourites GET/POST/DELETE, and `POST /api/events/batch`.

`apiFetch` sends `Accept: application/json`, `ngrok-skip-browser-warning: true`, `X-Tenant-Domain`, optional JSON content type, and optional `Authorization: Bearer ...`. It supports abort signals and keepalive, parses JSON or returns `{ raw }`, and throws `ApiError` for non-OK responses. Missing data is normalized by service functions; callers own loading/error/fallback states. API UUID path ids are URL-encoded; slugs are not accepted for property detail. Backend authorization semantics and complete schemas are UNKNOWN — needs verification. Calls are primarily client-side.

## 3. Next.js frontend integration

**Service/package:** Next.js `16.3.8`, React `19.2.8`, App Router. **Where:** `src/app`, `next/link`, `next/navigation`, `next/image`, and `src/app/api/layout-image/route.ts`. Next supplies routes, client/server boundaries, image handling, and the same-origin proxy. `next.config.ts` allows development origins `192.168.29.7`/`192.168.*.*` and HTTPS `**.amazonaws.com` remote images. No auth plugin is configured. Route-level loading/error/not-found files are absent; exact failed-image presentation is UNKNOWN — needs verification.

## 4. MapLibre integration

**Service/package:** `maplibre-gl` `^6.12.0`. **Purpose:** property/plot, location, Future Neighbourhood, and satellite maps. **Files:** `MapSection.tsx`, `GrowthCorridors.tsx`, `PropertyDetail/FutureNeighbourhoodMap.tsx`, `PropertyDetail/SatelliteBeforeAfter.tsx`. The worker is `/maplibre/maplibre-gl-worker.mjs`, copied by `scripts/copy-maplibre-worker.cjs`. MapLibre consumes service-loaded data, GeoJSON, markers, and raster/image sources; it does not call the API itself. Missing coordinates omit markers, missing units omit polygons, and map/request errors are component-owned. No MapLibre token is used. Client-side only.

## 5. OpenFreeMap integration

**Service:** OpenFreeMap Liberty style at `https://tiles.openfreemap.org/styles/liberty`. **Purpose/where:** vector basemap for `MapSection`, `GrowthCorridors`, and `FutureNeighbourhoodMap`. It is consumed by MapLibre; no SDK, token, environment variable, or authentication is used. MapLibre map-error behavior applies, with a technical default viewport while locations load. External-style attribution compliance is UNKNOWN — needs verification. Client-side only.

## 6. Satellite imagery integration

**Service:** Esri World Imagery raster tiles by default. **Where:** `src/lib/satelliteTiles.ts`, `MapSection.tsx`, and `SatelliteBeforeAfter.tsx`. `NEXT_PUBLIC_SATELLITE_TILES_URL` overrides the MapSection template; fallback is `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`. No token is used. It is a raster layer separate from vector plots; Location Story changes text/zoom, not imagery. Failed imagery has no confirmed feature-specific UI: UNKNOWN — needs verification. The source identifies the default as evaluation/development use; production licensing is UNKNOWN — needs verification. Client-side only.

## 7. Property data integration

**Service:** ILA property/detail/units APIs plus local `src/data/properties.ts` and `propertyLayouts.ts`. **Where:** property services, `propertyMapper.ts`, `MapSection`, `PropertiesList`, `ApiPropertyView`, and `PropertyPageView`. API records are normalized to `PropertyRecord`; `cover_url` becomes a one-image gallery, amenities become lifestyle items, and units become plot/layout geometry. Missing API images use the shared gallery; failed anchor enrichment skips a pin; failed detail enrichment retains the list record; main detail failure shows an in-page unavailable state. Local and API records are separate sources. Common `apiFetch` tenant/token behavior applies. Client-side API loading; local data is synchronous.

## 8. Location data integration

**Service:** ILA locations API. **Where:** `GrowthCorridors.tsx` and `locationsService.ts`. **Endpoints:** `GET /api/locations?page={page}&per_page={perPage}` and `GET /api/properties?location_slug={slug}&page=1&per_page=10`. Responses normalize to `LocationRecord`; finite coordinates are mapped and others remain list-only. A fixed technical viewport is used before data; there is no local location dataset. Request errors set component error state; exact copy is UNKNOWN — needs verification. Browser client calls through `apiFetch`; no geolocation/search provider is used.

## 9. Documents/legal document integration

**Service:** ILA documents API. **Where:** `ApiPropertyView.tsx`, `propertiesService.ts`, `propertyMapper.ts`, `PropertyDetail/LegalDocuments.tsx`. **Endpoint:** `GET /api/properties/{id}/documents`, encoded UUID, no body. API documents map into `PropertyRecord.documents`; rows with `href` link externally and rows with `detail` are facts without links. Static properties use static records. API errors show an error state without retry; mapper fallback verification rows may be used. `visibility` is displayed, not enforced. The meaning of `storage_reference` is UNKNOWN — needs verification. Client-side and independent of main property loading.

## 10. Buyer Fit / Life-stage integration

**Service:** ILA life-stage-fit API plus static local fit records. **Where:** `ApiPropertyView.tsx`, `propertiesService.ts`, `propertyMapper.ts`, `LifeStageMatch.tsx`, and `properties.ts`. **Endpoint:** `GET /api/properties/{propertyId}/life-stage-fit`, encoded UUID, no query. API personas map to `PropertyRecord.lifeStageMatch`; the UI selects among four goals but does not calculate or rank scores. Static records bypass the API. Failure/unusable data produces pending/unavailable presentation without removing the page. Backend `fit_percentage` formula is UNKNOWN — needs verification. Client-side API usage.

## 11. Analytics integration

**Service:** ILA analytics batch API. **Purpose:** property/search/map/persona/shortlist/WhatsApp/EMI/conversion/session/revisit/time/dwell events. **Files:** `services/analytics/events.ts`, `tracker.ts`, `usePropertyView.ts`, `useClickTracking.ts`, `useSectionDwell.ts`, and instrumented components. **Endpoint:** `POST /api/events/batch` with `{ events }`; queue flushes every 10 seconds, max queue 100, max batch 50, and on `pagehide` using keepalive.

Events require a visitor code, use `X-Visitor-Code`, common tenant headers, optional property/session ids, metadata, and client event ids. Event vocabulary and batch-sendable allow-lists are enforced client-side. Delegated tracking reads `data-track` attributes; section dwell emits `SESSION_SECTION_SUMMARY`. Missing visitor codes make tracking inert; unsupported events are dropped with warnings; batch failures are warned and not shown in UI. Full backend response behavior is UNKNOWN — needs verification. Client-side only.

## 12. WhatsApp integration

**Service:** direct WhatsApp web links. **Where:** `PropertyHero`, `PropertyFinalCta`, `StickyBottomCta`, `WhatsAppBudgetModal`, `ShortlistShare`, and `propertyUtils.ts`. **URL:** `https://wa.me/?text=${encodeURIComponent(text)}`. Messages are generated locally for enquiry, site visit, calculator budget, or static shortlist sharing. No SDK, token, login, lead API, booking, or reservation exists. Links may open a new tab and applicable actions emit analytics. Popup blocking or unavailable WhatsApp behavior is UNKNOWN — needs verification. Client-side only.

## 13. Email integration

**Service:** browser `mailto`. **Where:** property enquiry CTA components and `propertyUtils.ts`. **Endpoint:** `mailto:hello@ilahomes.example` with encoded subject/body. There is no SMTP client, email API, server submission, or auth. Missing mail client/error behavior is UNKNOWN — needs verification. Client-side only.

## 14. LocalStorage/session/browser integrations

`visitor_code` is a one-year `SameSite=Lax` cookie, `Secure` in production, created/read by `src/lib/visitor.ts`, and used for anonymous API identity. `localStorage["token"]` is optionally read by `apiFetch` for a bearer token; storage errors are ignored. Property Details writes `ila-wishlist-{id}` and `ila-interested-{id}` as `"1"`/`"0"`. `sessionStorage["visitor_session_id"]` stores the active session id. The homepage shortlist is in-memory only.

`navigator.share` and `navigator.clipboard` are used by Property Details sharing, with WhatsApp as the share fallback. `window.open` is used for WhatsApp shortlist sharing. IntersectionObserver controls the sticky CTA and engagement, MutationObserver rescans tracked sections, and visibility/activity/timer/scroll APIs drive dwell and active-session behavior. Storage, popup, clipboard, and share failures have limited or no user-visible handling; exact behavior is UNKNOWN — needs verification. These are client-side integrations.

## 15. External assets/CDN integrations

Confirmed remote resources are OpenFreeMap styles, Esri satellite tiles, presigned Amazon S3 layout preview/TIFF URLs, API `cover_url` image URLs, and direct WhatsApp/mailto destinations. Local images are imported from `src/app/assets` and public paths. Next remote image handling allows only HTTPS `**.amazonaws.com` hosts in `next.config.ts`; no CDN SDK, upload service, image search service, or external asset-management API is implemented. Behavior for remote hosts outside that allowlist is UNKNOWN — needs verification.

## 16. Environment variables used by integrations

- `NEXT_PUBLIC_API_URL` — required external ILA API base URL; no fallback, and module initialization throws if missing.
- `SITE_DOMAIN` — server-side tenant hostname fallback when `window.location.hostname` is unavailable; missing server-side tenant resolution throws.
- `NEXT_PUBLIC_ILA_PROPERTY_ID` — required configured property id used by `ilaApiConfig.ts`, units URL helper, and related shortlist analytics/static configuration.
- `NEXT_PUBLIC_SATELLITE_TILES_URL` — optional satellite tile template; defaults to Esri World Imagery.
- `NODE_ENV` — controls production cookie `Secure` and non-production analytics diagnostics.

No `MAPBOX_ACCESS_TOKEN` or other map token is used by the active source. Values that are syntactically present but invalid are not comprehensively validated: UNKNOWN — needs verification.

## 17. Authentication/token integrations

There is no confirmed login or user-account flow. `apiFetch` accepts an explicit bearer token or reads `localStorage["token"]` and sends `Authorization: Bearer {token}`. Anonymous visitor identity is separate: `POST /api/visitors` creates/obtains a visitor code stored in the `visitor_code` cookie, and favourites/session/analytics send `X-Visitor-Code`. Every API request sends `X-Tenant-Domain` from the browser hostname or `SITE_DOMAIN` server-side. Backend token validity, tenant authorization, CORS, and permission semantics are UNKNOWN — needs verification.

## 18. Third-party packages/services

Active integration packages/services confirmed by source are Next.js/React, `maplibre-gl`, and `geotiff`. `geotiff` is used by `src/lib/layoutTiff.ts` to decode the fallback layout TIFF in the browser. Active external services are the ILA API, OpenFreeMap, Esri imagery, Amazon S3 presigned objects, WhatsApp web links, and browser mail handling. Tailwind/PostCSS/TypeScript/ESLint support the application but are not external runtime integrations. No unused package is documented as active.

## 19. Client-side integrations

Client components perform API calls, MapLibre rendering, OpenFreeMap/Esri tile loading, S3 layout proxy fetches, image decoding, browser storage/cookie access, analytics queuing, Web Share/Clipboard/WhatsApp/email navigation, and engagement observation. `PropertiesList`, `MapSection`, `GrowthCorridors`, `ApiPropertyView`, visitor/session initializers, and analytics initializers are client flows. The client does not directly authenticate to S3; it uses presigned URLs through the same-origin proxy.

## 20. Server-side integrations

The confirmed server-side integration is `src/app/api/layout-image/route.ts`. It accepts `GET /api/layout-image?url=...`, validates an HTTPS Amazon S3 hostname, fetches upstream with `credentials: "omit"` and an image Accept header, buffers up to 60 MB, and returns the bytes with content type and `Cache-Control: private, no-store`. No browser cookies are forwarded. Other API calls are not confirmed as server-side application proxies. Exact hosting/runtime behavior is UNKNOWN — needs verification.

## 21. Data flow between integrations

1. The root client initializers create/obtain anonymous visitor identity, start/reuse a session, and start analytics.
2. Property/location components call `apiFetch`, which combines `NEXT_PUBLIC_API_URL`, tenant identity, common headers, optional token, and request path.
3. API responses are normalized by service helpers and `propertyMapper` into component-facing records.
4. MapLibre consumes coordinates, GeoJSON, units, nearby places, and raster sources. OpenFreeMap supplies the vector style; Esri supplies satellite tiles.
5. Units data supplies presigned S3 preview/TIFF URLs and layout coordinates. The browser requests the same-origin layout proxy; the server fetches S3; the client decodes the result or lets MapLibre load the proxied URL.
6. User interactions update local component/browser state and queue analytics events, which flush to the ILA batch endpoint with visitor/session identity.
7. Enquiry/share actions leave the application through WhatsApp, mailto, Web Share, Clipboard, or ordinary internal links.

## 22. Integration-specific fallbacks

- Missing API property coordinates: detail anchor requests can fill them; failures leave the property unpinned.
- Missing property detail/units: list/detail or property sheet can still render partial information; no units means no plot polygons.
- API property image missing: shared default gallery.
- API amenities missing: shared default lifestyle data.
- API documents fail: document error/fallback verification state.
- API life-stage fit fails: pending/unavailable goal state while the page remains.
- Nearby places fail or are empty: static neighbourhood fallback.
- API property timeline: empty placeholder timeline; no timeline endpoint is used.
- Satellite tile URL missing: Esri default.
- Layout preview/TIFF fails or expires: vector plots remain usable and units can be refetched for a fresh signed URL.
- `createImageBitmap` unavailable: MapLibre receives the proxied image URL instead of a decoded bitmap.
- Visitor/token/storage unavailable: anonymous/no-token behavior where supported; specific backend outcome UNKNOWN — needs verification.
- WhatsApp/Web Share/Clipboard/mail client unavailable: no confirmed application replacement beyond the implemented share fallback.

## 23. Error handling

`apiFetch` converts non-OK API responses to `ApiError`, preserving status and backend message/code when available. Requests commonly use `AbortController`; aborted results are ignored. Components maintain independent loading/ready/error states so documents, Buyer Fit, nearby places, layout imagery, and list enrichment can fail without always removing the main page.

The layout proxy returns 400 for missing/invalid/non-HTTPS/non-S3 URLs, passes 403/404 semantics for upstream failures, returns 502 for other upstream/network failures, and returns 413 over 60 MB. Analytics drops invalid or non-batch-sendable events and warns on failed flushes. Browser storage exceptions and several external navigation failures are intentionally silent or console-only. Unexpected render exceptions and complete browser error presentation are UNKNOWN — needs verification.

## 24. Dependencies

The integration architecture depends on `NEXT_PUBLIC_API_URL`, tenant hostname resolution, the ILA API envelope/endpoint contracts, API UUID ids, visitor cookie/session storage, MapLibre worker availability, OpenFreeMap style availability, satellite tile availability, presigned S3 URL validity, S3 CORS/proxy behavior, Next remote image configuration, and browser support for storage, canvas/ImageBitmap, timers, observers, and sharing APIs. It also depends on `maplibre-gl` and `geotiff` versions in `package.json`.

## 25. Known issues

- Backend authorization, complete response schemas, exact analytics response behavior, and production tenant semantics are UNKNOWN — needs verification.
- API records are normalized into a static-oriented `PropertyRecord`, so some fields/sections use placeholders or shared defaults.
- API detail, documents, and Buyer Fit are independent requests and can produce partial pages.
- Local properties can issue a fixed sample nearby-place request through Future Neighbourhood.
- Satellite imagery is approximate context and the default Esri licensing is not a confirmed production arrangement.
- The public analytics endpoint response is not consumed by the client.
- Documents can contain fragment or storage references whose ultimate file behavior is UNKNOWN — needs verification.
- There is no confirmed authentication UI, saved-favourites page, unified wishlist store, enquiry API, email service, WhatsApp SDK, geolocation integration, or CDN SDK.
- Automated integration test coverage is UNKNOWN — needs verification.

## 26. Important constraints

- Route all ILA API requests through `apiFetch` to preserve base URL, tenant header, common headers, token behavior, JSON parsing, abort signals, and error conversion.
- Preserve URL-encoded API UUID ids, current endpoint paths/query names, response envelope handling, and `[longitude, latitude]` coordinate order.
- Keep visitor cookie identity, optional bearer authentication, tenant identity, session storage, API favourites, Property Details localStorage flags, and homepage in-memory shortlist state distinct.
- Preserve `/api/layout-image` S3-only HTTPS validation, omitted upstream cookies, 60 MB limit, and private no-store response.
- Keep MapLibre’s worker at `/maplibre/maplibre-gl-worker.mjs`; preserve OpenFreeMap Liberty and the configured/default satellite tile behavior.
- Keep documents, Buyer Fit, nearby places, layout images, and property detail requests independently cancellable and partially failure-tolerant.
- Do not treat static explanatory content, demo activity values, local recommendations, or default imagery as live external integrations.
- Do not infer authentication guarantees, backend formulas, service licensing, response fields, or unsupported fallbacks; use `UNKNOWN — needs verification` when source cannot confirm them.