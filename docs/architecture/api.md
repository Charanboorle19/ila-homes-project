# API Architecture

This document describes the API architecture currently implemented in the repository. It is based on the inspected source under `src/`; feature documentation was used only to identify feature areas to trace. It does not describe planned or inferred endpoints.

## 1. API architecture purpose

The application uses a browser-oriented service layer over an external ILA API. The service layer provides property catalogue/detail data, units and plot geometry, locations, documents, Buyer Fit, nearby places, tracked property shares, anonymous visitor/session identity, favourites, and analytics. Static property records remain a separate source for local property ids and fallback presentation.

The application also exposes one same-origin Next.js route, `/api/layout-image`, which proxies validated presigned S3 layout images for browser/MapLibre use.

## 2. API base URL configuration

External API requests are joined to `ILA_API_BASE_URL`, loaded from `NEXT_PUBLIC_API_URL` by `src/lib/ilaApiConfig.ts`. Trailing slashes are removed. There is no fallback; a missing value throws `Missing required environment variable NEXT_PUBLIC_API_URL` during module initialization.

The external request form is `${NEXT_PUBLIC_API_URL}${path}`, where `path` is an `/api/...` path. The same-origin layout proxy uses the application origin and is not joined to the external base URL.

## 3. API client / fetch wrapper

`src/services/apiClient.ts` exports `apiFetch<T>(path, options)`. It defaults to `GET`, serializes a defined body as JSON, passes `signal` and optional `keepalive`, and parses the response by reading text then attempting JSON parsing. Non-JSON successful responses are returned as `{ raw: text }`; empty responses return `null`.

`fetchUnits` is also exported from this module as a convenience wrapper for `/api/properties/{id}/units?limit=all`; the main property service has its own units helper for paged requests.

## 4. Authentication

There is no confirmed login or server-session authentication flow in the inspected client. `apiFetch` optionally sends `Authorization: Bearer {token}` from the explicit `authToken` option or browser `localStorage.getItem("token")`. Missing or unreadable local storage means no bearer header is sent. Authentication/authorization behavior at the backend is UNKNOWN — needs verification.

Anonymous visitor identity uses a `visitor_code` browser cookie, not the bearer token. Favourites and analytics send that identity as `X-Visitor-Code`.

## 5. Tenant handling

Every `apiFetch` request sends `X-Tenant-Domain`. In a browser it is `window.location.hostname`; in server-side code it is `SITE_DOMAIN`. A caller may override it with `tenantDomain`. If neither browser hostname nor `SITE_DOMAIN` is available, `resolveTenantDomain()` throws before the request.

The tenant is the site hostname, not the API hostname and not a tenant UUID. Exact backend tenant resolution and cross-tenant authorization semantics are UNKNOWN — needs verification.

## 6. Request headers

Common headers from `apiFetch` are:

- `Accept: application/json`.
- `ngrok-skip-browser-warning: true`.
- `X-Tenant-Domain: {resolved or overridden tenant}`.
- `Content-Type: application/json` when a body is supplied.
- `Authorization: Bearer {token}` when a token exists.

Endpoint-specific headers are `X-Visitor-Code` for favourites, visitor sessions, analytics, and share creation. Share resolution (`GET /api/shares/{tracking_token}`) sends it opportunistically but does not require it. Callers can override common values through `options.headers`. `Origin` and `Host` are not set by the client.

## 7. Response structure

The external services generally expect an envelope of `{ success?: boolean, data?: ... }`. List responses use `data.items`, `data.total`, `data.page`, and `data.per_page`. Detail responses use `data` for the property or endpoint-specific object. The wrapper does not validate `success` on successful HTTP responses; service functions apply defaults and shape checks.

The exact backend response schema beyond the typed fields below is UNKNOWN — needs verification.

## 8. Error handling

`apiFetch` throws `ApiError(status, message, code)` for non-2xx responses. It extracts `error.message`, `error.code`, or a string `error`; otherwise it uses `Request failed: {status}`. Invalid JSON is represented as `{ raw }` before error extraction.

Service consumers decide whether to surface or absorb failures. Property detail displays an unavailable state; documents and Buyer Fit become independent error/unavailable states; map anchor failures skip pins; locations/properties show their component error states; favourites update UI only after success; analytics logs and drops failed batches. Network errors, aborts, and malformed successful payloads can have endpoint-specific behavior; where not explicit below, this is UNKNOWN — needs verification.

## 9. Property APIs

### `GET /api/properties`

- **Path parameters:** none.
- **Query parameters:** `status`, `page`, `per_page`; the main list uses `status=ALL&page=1&per_page=100`. Location browsing uses `location_slug={slug}&page=1&per_page=10`. The generic service defaults status `ALL`, page `1`, per-page `100`.
- **Request body:** none.
- **Required headers:** common `apiFetch` headers; no endpoint-specific header.
- **Response:** `{ success?: boolean, data?: { items?: PropertyListItem[]; total?: number; page?: number; per_page?: number } }` for the generic list, and `PropertySummary[]` fields for the location query.
- **Transformation:** missing items become `[]`; total defaults to item count (generic) or `0` (location); echoed pagination values fall back to request values; generic service derives `totalPages` with `ceil(total/perPage)` and a minimum of 1.
- **Consumers:** `MapSection`, `PropertiesList`, `GrowthCorridors` through `fetchPropertiesByLocation`.
- **Errors:** propagated by the service; callers set list error state. Empty/missing data is normalized to an empty list.

### `GET /api/properties/{id}`

- **Path parameters:** `id`, URL-encoded API property UUID.
- **Query parameters/body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ success?: boolean, data?: ApiProperty }`.
- **Transformation:** `fetchPropertyById` returns `response.data`; `apiPropertyToRecord` converts the typed API fields into the shared `PropertyRecord`, coercing inconsistent money/metadata values and supplying placeholders/defaults for missing static-oriented sections.
- **Consumers:** `ApiPropertyView`, property-list enrichment, `MapSection` anchor resolution, and API property navigation.
- **Errors:** non-UUID ids are rejected locally; API/client errors propagate. `ApiPropertyView` renders `Property unavailable`; enrichment catches individual failures and retains the list item.

## 10. Property detail API

The detail endpoint is the `GET /api/properties/{id}` operation above. It is not a separate path from the property API family. API UUID validation is performed by `isPropertyUuid`; slugs are not accepted for this request. The route `/properties/[propertyId]` first checks static data, then renders `ApiPropertyView` for an API UUID.

`ApiPropertyView` fetches the main property, documents, and life-stage fit independently with separate `AbortController`s. The main property gates page rendering; the other two do not block it.

## 11. Units / plots APIs

### `GET /api/properties/{id}/units`

- **Path parameters:** `id`, URL-encoded property UUID.
- **Query parameters:** the map convenience helper uses exact `limit=all`. The property service uses its units request with the query constructed from its options; the confirmed map request is `limit=all`. Exact optional paged-query defaults beyond this are UNKNOWN — needs verification.
- **Request body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** a `UnitsResponse` envelope containing unit/plot records and layout metadata such as `property_layout_cords`, `layout_preview_url`, and `tif_url`; exact complete response shape is UNKNOWN — needs verification.
- **Transformation:** `fetchUnits` returns `result.data ?? result`; property/map code converts unit geometry and status into `EstateProject`/plot polygons, normalizing plot status to available/sold according to the consuming builder.
- **Consumers:** `MapSection`, `PropertySheet`, layout preview/TIFF loaders.
- **Errors:** propagated for the selected-property request; absent/failed unit geometry can leave a property pin/sheet visible without polygons. Layout-image failures are non-fatal to vector plots.

## 12. Locations APIs

### `GET /api/locations`

- **Path parameters:** none.
- **Query parameters:** `page` and `per_page`; `fetchLocations` clamps both to at least 1 and the homepage starts with `page=1&per_page=20`.
- **Request body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ success?: boolean, data?: { items?: LocationRecord[]; total?: number; page?: number; per_page?: number } }`.
- **Transformation:** missing items become `[]`; total defaults to item count; echoed page/per-page values are preferred; `totalPages`, `hasNextPage`, and `hasPreviousPage` are derived.
- **Consumers:** `GrowthCorridors`.
- **Errors:** propagated to the component's locations error state. Locations with invalid/non-finite coordinates remain list items but are excluded from map placement by `hasCoordinates`.

## 13. Location-property APIs

### `GET /api/properties?location_slug={slug}&page={page}&per_page={perPage}`

- **Path parameters:** none.
- **Query parameters:** URLSearchParams fields `location_slug`, `page`, `per_page`; `GrowthCorridors` requests page 1 and per-page 10.
- **Request body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ success?: boolean, data?: { items?: PropertySummary[]; total?: number; page?: number; per_page?: number } }`.
- **Transformation:** the service returns `{ items, total, page, perPage }`, defaulting missing values. An empty slug returns an empty result without a request.
- **Consumers:** `GrowthCorridors` locality Explore flow.
- **Errors:** propagated to the locality property error state; there is no property pagination UI in this flow.

## 14. Documents APIs

### `GET /api/properties/{id}/documents`

- **Path parameters:** `id`, URL-encoded property UUID.
- **Query parameters/body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ success?: boolean, data?: { items?: ApiPropertyDocument[]; total?: number } }`.
- **Transformation:** the service returns items and total with defaults. `apiDocumentsToRecords` maps `id`, `name`, `storage_reference`, `document_type`, `size_bytes`, `visibility`, and `created_at` to `PropertyDocument` fields.
- **Consumers:** `ApiPropertyView` and `LegalDocuments`.
- **Errors:** the independent request sets document state to `error` and renders the document error path; it does not fail the main property page. Static/API fallback verification rows may be used by the mapper.

## 15. Life-stage / Buyer Fit APIs

### `GET /api/properties/{id}/life-stage-fit`

- **Path parameters:** `id`, URL-encoded property UUID.
- **Query parameters/body:** none.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ success?: boolean, data?: { property_id?: string | null; personas?: ApiLifeStagePersona[] } }`; service normalization returns `{ propertyId, personas }`.
- **Transformation:** persona aliases map API names to the page's four life-stage keys. Finite `fit_percentage` values are rounded and clamped to 0–100; invalid/missing values become unavailable. `apiPropertyToRecord` supplies pending or unavailable entries when needed.
- **Consumers:** `ApiPropertyView`, `propertyMapper`, `LifeStageMatch`.
- **Errors:** independent failure becomes `unavailable`; the rest of the detail page remains usable. The backend scoring formula and exact property-id validation are UNKNOWN — needs verification.

## 16. Analytics APIs

### `POST /api/visitors`

- **Path parameters/query:** none.
- **Request body:** `{}`.
- **Required headers:** common `apiFetch` headers.
- **Response:** `{ data?: { visitor_code?: string; is_new?: boolean } }`.
- **Transformation:** `VisitorInitializer` stores `visitor_code` in a one-year `visitor_code` cookie and marks visitor readiness.
- **Consumer:** `VisitorInitializer` via `createVisitor`.
- **Errors:** logged; visitor readiness is marked failed and dependent session/analytics work may be skipped.

### `POST /api/sessions`

- **Path parameters/query:** none.
- **Request body:** `{ landing_page: window.location.href, referrer: document.referrer || null, utm: {} }`.
- **Required headers:** common headers plus `X-Visitor-Code`.
- **Response:** `{ data?: { session_id?: string; started_at?: string; reused?: boolean } }`.
- **Transformation:** `SessionInitializer` stores `session_id` in `sessionStorage`.
- **Consumer:** `SessionInitializer` via `startVisitorSession`.
- **Errors:** logged; no session id is stored. Missing visitor code skips the request.

### `POST /api/events/batch`

- **Path parameters/query:** none.
- **Request body:** `{ events: EventPayload[] }`, with `event_type`, optional `property_id`, `session_id`, `metadata`, and `client_event_id`.
- **Required headers:** common headers plus `X-Visitor-Code`; `keepalive: true` is used for normal and pagehide flushes.
- **Response:** accepted response is not transformed or consumed by the tracker; individual event result type is `EventCreateResult` but batch response shape is UNKNOWN — needs verification.
- **Transformation:** events are validated against the closed vocabulary, unsupported batch events are dropped, required property ids are filled from metadata/fallback where applicable, events are queued, capped at 100, and sent in batches of 50 every 10 seconds or on pagehide.
- **Consumers:** `trackEvent`, delegated click tracking, section/session tracking, map/property/calculator features.
- **Errors:** batch failures are caught and logged; pagehide failures are ignored. `SECTION_ENTER`, `SECTION_EXIT`, `SECTION_CLICK`, `COMPARE_ADD`, `ENQUIRY_SUBMIT`, and `SITE_VISIT_REQUEST` are not sent by the batch transport despite some being in the broader event vocabulary.

No direct `POST /api/events` call was found in the current source; the tracker comment mentions it, but the implementation sends `/api/events/batch` only.

### `GET /api/favorites`

- **Path parameters/query:** none.
- **Request body:** none.
- **Required headers:** common `apiFetch` headers plus `X-Visitor-Code`.
- **Response:** `{ success: boolean, data?: { items?: FavoriteItem[]; total?: number } }`.
- **Transformation:** `fetchFavorites` returns `data.items ?? []`; `PropertiesList` stores the returned `property_id` values in its local saved-id set.
- **Consumer:** `PropertiesList` through `favoritesService.fetchFavorites`.
- **Errors:** missing visitor code throws before the request; API errors propagate to the list loader and do not prevent the rest of the list from being rendered according to the component's independent loading/error handling.

### `POST /api/favorites`

- **Path parameters/query:** none.
- **Request body:** `{ property_id: string }`.
- **Required headers:** common `apiFetch` headers plus `X-Visitor-Code`.
- **Response:** not read or transformed by `saveFavorite`; exact successful response structure is UNKNOWN — needs verification.
- **Transformation:** none. The caller updates its local saved-id state only after the promise resolves.
- **Consumer:** `PropertiesList` through `favoritesService.saveFavorite`.
- **Errors:** missing visitor code throws; API errors propagate and the caller retains the previous saved state.

### `DELETE /api/favorites/{id}`

- **Path parameters:** `id`, URL-encoded API property id.
- **Query parameters/body:** none.
- **Required headers:** common `apiFetch` headers plus `X-Visitor-Code`.
- **Response:** not read or transformed by `removeFavorite`; exact successful response structure is UNKNOWN — needs verification.
- **Transformation:** none. The caller removes the id from local state only after success.
- **Consumer:** `PropertiesList` through `favoritesService.removeFavorite`.
- **Errors:** missing visitor code throws; API errors propagate and the caller retains the previous saved state.

### `POST /api/shares`

- **Path parameters/query:** none.
- **Request body:** `{ share_type: "SYSTEMATIC", share_channel: "WHATSAPP", entity_id: "{property_id}", entity_type: "PROPERTY", message: string }`.
- **Required headers:** common `apiFetch` headers plus `X-Visitor-Code`.
- **Response:** `{ success?: boolean, data?: { share_id?: string; tracking_token?: string; tracking_url?: string; share_type?: string } }`.
- **Transformation:** `createPropertyShare` in `shareService.ts` returns `response.data` and throws when `tracking_token` is absent. `buildShareUrl` turns the token into `{origin}/property/{tracking_token}/view`; the returned `tracking_url` field is not used for display.
- **Consumers:** `ShareButton` in the property detail hero.
- **Errors:** missing visitor code throws before the request. The response's relative `tracking_url` value is `/api/shares/{token}`, which suggests a read path exists, but that is a path only — see the entry below.

### `GET /api/shares/{tracking_token}`

- **Path parameters:** `tracking_token`, the opaque share token, URL-encoded.
- **Query parameters/body:** none.
- **Required headers:** common `apiFetch` headers. `X-Visitor-Code` is sent when a visitor code is available but is **not** required: a visitor opening a link they were sent is normally not the visitor who created the share, so gating on a matching code would break the flow.
- **Response:** confirmed as `{ success?: boolean, data?: { property?: { id: string; name?: string | null; price?: number | null; property_type?: string | null; status?: string | null } | null } }`. `data.property` is a property summary, not the full `ApiProperty` payload.
- **Transformation:** `fetchSharePropertyId` returns `data.property.id` and throws when it is absent. The token is only an entry point: the resolved id is then passed to the existing `GET /api/properties/{id}`, `apiPropertyToRecord` and `PropertyPageView`. The share response's `name`, `price`, `property_type` and `status` are never rendered directly.
- **Consumer:** the page route `/property/[trackingToken]/view`.
- **Errors:** a missing `data.property.id`, a failed request, or an aborted request renders the route's in-page unavailable state. Aborted results are ignored.
- **UNKNOWN — needs verification:** whether the endpoint records the share as viewed as a side effect of being read, which is why the request must not be prefetched or cached; and whether it requires a prior visitor cookie before resolving a token.

### `GET /api/layout-image?url={presignedS3Url}` (same-origin Next.js route)

- **Path parameters:** none.
- **Query parameters:** required `url`, containing a presigned URL. The handler accepts only HTTPS S3 hosts matching its Amazon S3 hostname pattern.
- **Request body:** none.
- **Required headers:** the browser request has no feature-specific required header. The server-side upstream fetch sends `Accept: image/png,image/tiff,image/*` and `credentials: omit`.
- **Response:** successful requests return the upstream image bytes with `Content-Type`, `Content-Length`, and `Cache-Control: private, no-store`.
- **Transformation:** the route validates/parses the URL, fetches the S3 object server-side, buffers it, and returns it. `layoutPreview.ts` may decode the response as an image; `layoutTiff.ts` may decode it into a PNG data URL.
- **Consumers:** `loadLayoutPreviewRaster` and `decodeTiffToPngDataUrl`, used by `MapSection` layout imagery.
- **Errors:** missing/invalid/non-HTTPS/non-S3 URLs return 400; upstream 403/404 are passed as 403/404 with an error JSON body, other upstream failures return 502; content over 60 MB returns 413; fetch failures return 502. Expired presigned URLs are identified in the error message where possible.

## 17. Service files

- `src/services/apiClient.ts` — base request wrapper, tenant resolution, bearer token handling, response parsing, `ApiError`, and units convenience helper.
- `src/services/propertiesService.ts` — property lists, location-property lists, property detail, documents, units, Buyer Fit, nearby places, anchors, and price formatting.
- `src/services/locationsService.ts` — locations request and pagination/coordinate helpers.
- `src/services/favoritesService.ts` — visitor-scoped favourite operations.
- `src/services/shareService.ts` — tracked share creation (`POST /api/shares`), tracking-token resolution (`GET /api/shares/{tracking_token}`), and the public share-URL builder.
- `src/services/visitorService.ts` — visitor creation and session start.
- `src/services/propertyMapper.ts` — API-to-`PropertyRecord` normalization.
- `src/services/analytics/events.ts` — event vocabulary and sendability rules.
- `src/services/analytics/tracker.ts` — event queue and batch transport.

## 18. Data types / interfaces

Primary API types include `PropertyListItem`, `PropertySummary`, `ApiProperty`, `ApiPropertyDocument`, `ApiLifeStagePersona`, `ApiLifeStageFit`, `ApiNearbyPlace`, `LocationRecord`, `LocationsPage`, `FavoriteItem`, `FavoritesResponse`, `EventPayload`, and `EventCreateResult`. Map units/layout types include `PropertyUnit`, `UnitsResponse`, `PropertyLayoutCords`, `PropertyAnchor`, and related project/plot structures in `propertiesService.ts` and data modules.

The shared rendering contract is `PropertyRecord` in `src/data/properties.ts`; API data is deliberately normalized into it rather than rendered directly by most Property Details sections.

Tracked shares do not introduce a second rendering contract. `GET /api/shares/{tracking_token}` yields a property summary whose only consumed field is `data.property.id`, which is then fed to the existing property detail API and the existing `apiPropertyToRecord` mapper.

## 19. Response normalization / mapping

Normalization occurs at service boundaries and in `propertyMapper.ts`: envelope data is unwrapped, absent arrays become empty arrays, pagination values are defaulted/derived, coordinates are converted to MapLibre `[longitude, latitude]`, property money fields are coerced, amenities become lifestyle/features, documents become `PropertyDocument`, life-stage personas become `LifeStageMatchEntry`, and missing static-oriented fields receive placeholders/defaults. API properties without `cover_url`, timeline, or neighbourhood data use shared fallback behavior.

The client does not perform a general runtime schema validation pass. Exact handling of unexpected field types outside explicit coercions is UNKNOWN — needs verification.

## 20. Pagination conventions

Pagination is page-based with `page` and `per_page`, not cursor-based. Locations and property list helpers trust echoed `page`/`per_page` when present and derive total pages using `Math.ceil(total/perPage)`. The main catalogue requests page 1 with 100 items and has no pagination controls. Location-property results request page 1 with 10 items and have no child pagination controls. Units pagination is separate and the map's confirmed request uses `limit=all`; complete units pagination semantics are UNKNOWN — needs verification.

## 21. Abort / cancellation behavior

`apiFetch` passes an optional `AbortSignal` to `fetch`. `ApiPropertyView`, `GrowthCorridors`, and `MapSection` create controllers and abort during effect cleanup or dependency changes. Aborted results are ignored by consumers. Anchor resolution checks the signal and limits detail calls to a configurable concurrency, defaulting to 4. Layout preview/TIFF same-origin fetches also accept signals and return non-fatal null/undefined on abort.

Favourites mutations do not expose an `AbortSignal` in their service signatures. Analytics batch sends use `keepalive`, not abort cancellation.

## 22. Environment variables

Confirmed API-related variables are:

- `NEXT_PUBLIC_API_URL` — required external API base URL.
- `NEXT_PUBLIC_ILA_PROPERTY_ID` — required configured property id used by `ilaUnitsUrl` and related analytics/static configuration.
- `SITE_DOMAIN` — server-side fallback tenant hostname when `window` is unavailable.
- `NEXT_PUBLIC_SATELLITE_TILES_URL` — optional map imagery URL; it is not an API request base URL.
- `NODE_ENV` — controls the `Secure` visitor cookie attribute and development analytics diagnostics.

The effective values in the deployment environment are UNKNOWN — needs verification.

## 23. Client-side vs server-side API usage

The external service calls are used primarily from client components/effects because tenant resolution uses the browser hostname. `PropertiesList`, `MapSection`, `GrowthCorridors`, `ApiPropertyView`, the tracked share page route, visitor/session initializers, favourites, and analytics all run from client-side flows. The property detail route page itself is an async Next.js server component, but it only resolves static records before delegating API UUID rendering to the client `ApiPropertyView`. The tracked share route at `/property/[trackingToken]/view` is a client page component for the same tenant-resolution reason.

The `/api/layout-image` handler is server-side and performs its upstream S3 fetch on the application server. No other confirmed Next.js API route handler was found.

## 24. API dependencies

The application depends on the external ILA API configured by `NEXT_PUBLIC_API_URL`, tenant-aware CORS/authorization behavior, presigned Amazon S3 layout objects returned by units data, and the browser's cookie/localStorage/sessionStorage facilities. MapLibre consumes the normalized property/location/unit data. Analytics depends on backend event allow-lists and visitor/session identifiers. OpenFreeMap/Esri tile services are map integrations, not application API endpoints.

## 25. Known issues

- The frontend relies on typed subsets of responses; the complete backend schemas are UNKNOWN — needs verification.
- There is no client fallback when `NEXT_PUBLIC_API_URL` is missing.
- API properties are mapped into a static-oriented record, so some sections use placeholders or shared defaults.
- API property detail, documents, and Buyer Fit requests are independent; partial failure can produce a partially populated page.
- The `GET /api/shares/{tracking_token}` response body is confirmed as a property summary under `data.property`, of which only `id` is used. Whether reading the endpoint records a share view, and whether it requires a prior visitor cookie, are UNKNOWN — needs verification.
- Local/static properties can trigger a fixed sample UUID nearby-places request through Future Neighbourhood; the sample UUID's backend meaning is UNKNOWN — needs verification.
- Units query semantics beyond the confirmed `limit=all` map request are UNKNOWN — needs verification.
- The public analytics batch response shape is not consumed and is UNKNOWN — needs verification.
- The layout proxy buffers up to 60 MB and returns non-cacheable data; upstream S3 availability and presigned URL semantics are external dependencies.
- The source contains comments about `POST /api/events`, but no direct implementation call was found; whether that endpoint exists server-side is UNKNOWN — needs verification.

## 26. Important constraints

- All external API requests must continue through `apiFetch` so base URL, tenant headers, common headers, token behavior, JSON serialization, abort signals, and error conversion remain consistent.
- Property detail/document/life-stage/nearby-place paths require URL-encoded UUID ids; slugs are not interchangeable with API UUIDs.
- Preserve the envelope shapes and query names currently used: `data`, `items`, `total`, `page`, `per_page`, `location_slug`, `status`, and `limit`.
- Preserve `[longitude, latitude]` coordinate order when mapping API coordinates to MapLibre.
- Keep anonymous visitor identity (`visitor_code` cookie / `X-Visitor-Code`) distinct from optional bearer-token authentication and from tenant identity. `POST /api/shares` requires that visitor code; `GET /api/shares/{tracking_token}` must not, because share recipients are normally different visitors.
- Keep the tracked share route on the existing property pipeline. Do not introduce a second property-detail data model, mapper, or view, and do not render property content taken directly from the share response.
- Do not prefetch or cache `GET /api/shares/{tracking_token}` until it is confirmed whether reading it records the share as viewed.
- Keep API favourites distinct from Property Details localStorage wishlist flags and homepage in-memory shortlist state.
- Keep documents and Buyer Fit independent from the main detail request and retain their current partial-failure behavior.
- Do not treat API `visibility`, `fit_percentage`, proposed nearby places, presigned URLs, or analytics event names as stronger backend guarantees than the inspected client establishes.
- The `/api/layout-image` proxy must remain restricted to HTTPS Amazon S3 object hosts, omit browser cookies upstream, enforce the 60 MB limit, and return `Cache-Control: private, no-store` as currently implemented.
- Do not infer undocumented endpoints, request bodies, authentication guarantees, pagination models, or backend formulas; those items are `UNKNOWN — needs verification` unless confirmed in source.