# Routing Architecture

This document describes the routing implementation currently present in the project. It is based on the source under `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app` and the components that create navigation to those routes. Feature documentation was used as context only; routes are included here only when confirmed in source.

## 1. Routing architecture overview

The project uses the Next.js App Router. The application has one root layout, four page routes, and one Route Handler:

| URL | Source | Kind |
|---|---|---|
| `/` | `src/app/page.tsx` | Static route |
| `/properties` | `src/app/properties/page.tsx` | Static route |
| `/properties/[propertyId]` | `src/app/properties/[propertyId]/page.tsx` | Dynamic route |
| `/property/[trackingToken]/view` | `src/app/property/[trackingToken]/view/page.tsx` | Dynamic route |
| `/api/layout-image` | `src/app/api/layout-image/route.ts` | Route Handler |

There are no confirmed additional page routes for search, wishlist, calculators, locations, maps, or individual feature sections. Those experiences are rendered inside the confirmed pages or use fragment/external navigation.

## 2. Next.js App Router structure

The relevant structure is:

```text
src/app/
├── layout.tsx
├── loading.tsx
├── error.tsx
├── not-found.tsx
├── page.tsx
├── properties/
│   ├── page.tsx
│   └── [propertyId]/
│       └── page.tsx
├── property/
│   └── [trackingToken]/
│       └── view/
│           └── page.tsx
└── api/
    └── layout-image/
        └── route.ts
```

`src/app/layout.tsx` is the root application layout. It wraps every page with the document shell, global CSS, font, visitor/session/analytics initializers, `Navbar`, a `<main>` element, and `Footer`.

Application-wide route boundaries:
- `src/app/loading.tsx` renders a centered shared `ila-loader` (`ila-loader--light`) while server/route chunks load.
- `src/app/error.tsx` catches runtime page errors and provides a retry button and navigation back to `/`.
- `src/app/not-found.tsx` provides a branded 404 message and navigation back to `/`.

## 3. Root route

**Exact path:** `/`
**Type:** Static page route
**Main page:** `src/app/page.tsx`, default export `Home`
**Layout:** Root layout from `src/app/layout.tsx`

The page renders one section: `MapSection`. The components `Hero`, `WhoWeAre`, `GrowthCorridors`, `FindYourPlot`, `CompareProperties`, `BuyingJourney`, `ShortlistShare`, `EmiAppreciation`, `FromTheField`, `PlotsWithPulse`, `Faq`, and `HomeReadyToVisit` still exist under `src/components` but are no longer imported or rendered by this route.

- **Dynamic parameters:** None.
- **Query parameters:** None are read or written by the page implementation.
- **How users reach it:** The logo in `Navbar`, the `Home` breadcrumb in `PropertyHero`, direct navigation to `/`, and links such as `/#projects`. `Footer` still links to `/#faq`, `/#about`, and `/#contact`, but no element with those ids is rendered on `/`, so those fragments have no target.
- **Navigation behavior:** The page is a single short document containing the map section. `MapSection` renders `id="projects"` on its root `<section>`, so `/#projects` still resolves.
- **Data/API dependencies:** `MapSection` fetches API data. The page itself does not fetch route data on the server.
- **Loading/error/not-found:** No route-level loading, error, or not-found file exists. `MapSection` owns its client-managed request states; exact copy for every state is `UNKNOWN — needs verification`.
- **Route-specific logic:** `MapSection` owns its own plot filters and search query as local UI state. The previous section fragment ids — `contact`, `services`, `buying-journey`, `shortlist-share`, `emi-appreciation`, and `faq` — are no longer rendered on `/`.

## 4. Property listing route

**Exact path:** `/properties`
**Type:** Static page route
**Main page:** `src/app/properties/page.tsx`, default export `PropertiesIndexPage`
**Layout:** Root layout from `src/app/layout.tsx`; the page also imports `src/components/PropertyDetail/PropertyDetail.css`

The page renders the catalogue heading and the client component `PropertiesList`.

- **Dynamic parameters:** None.
- **Query parameters:** The page does not read URL query parameters. `PropertiesList` makes an internal API request with `status=ALL`, `page=1`, and `per_page=100`; those are API request parameters, not page URL parameters.
- **How users reach it:** `Navbar`, `Footer`, the `Properties` breadcrumb on property detail pages, the API property-card links from the homepage/list experiences, and the API-property error-state link.
- **Navigation behavior:** Property cards use Next.js `Link` elements to `/properties/{property.id}`. Favourite controls are buttons and do not navigate. **Every route change is preceded by an explicit `window.scrollTo(0, 0)` from `ScrollToTop` — see §27.**
- **Data/API dependencies:** `PropertiesList` loads `GET /api/properties?status=ALL&page=1&per_page=100`, optionally enriches items with `GET /api/properties/{id}`, and separately uses the favourites endpoints. Requests go through the internal API client with tenant configuration.
- **Loading/error/not-found:** `PropertiesList` has client-managed `loading`, `ready`, and `error` states. It renders a loading status and an error message when the list request fails. No route-level error or not-found file exists. Exact complete list-error presentation is `UNKNOWN — needs verification`.
- **Route-specific logic:** The list is client-side because tenant identity is resolved in the browser. It requests only page 1 with up to 100 items and has no URL-backed filtering, sorting, search, or pagination controls.

## 5. Property detail route

**Exact path:** `/properties/[propertyId]`
**Type:** Dynamic page route
**Main page:** `src/app/properties/[propertyId]/page.tsx`, default export `PropertyDetailPage`
**Shared rendered view:** `src/components/PropertyDetail/PropertyPageView.tsx`
**Layout:** Root layout from `src/app/layout.tsx`; `PropertyPageView` imports `PropertyDetail.css`

The route first resolves the parameter against local static property data. A local match renders `PropertyPageView` directly. If there is no local match, it renders `ApiPropertyView`, which validates and loads API-backed UUID properties and then renders the same `PropertyPageView` template.

- **Dynamic parameters:** `propertyId`.
- **Query parameters:** None are read or written by the page.
- **How users reach it:** `PropertiesList`, `GrowthCorridors` property links, `SimilarProperties`, the map `PropertySheet` when a `PropertyRecord` is available, and direct deep links.
- **Navigation behavior:** Internal property links use `next/link`. The detail hero breadcrumb links to `/` and `/properties`. Similar-property cards navigate to another `/properties/{id}` path. **Every route change is preceded by an explicit `window.scrollTo(0, 0)` from `ScrollToTop`, mounted in the root layout — see §27.**
- **Data/API dependencies:** Local ids use `src/data/properties.ts`. API ids use `GET /api/properties/{propertyId}`, with independent requests for documents and life-stage fit. Child sections may additionally request nearby places and use map/image integrations.
- **Loading/error/not-found:** Local records render without a page data-loading state. API-backed records show `Loading property…` while loading. Invalid/non-UUID or failed API records render an in-page `Property unavailable` state with a link back to `/properties`. No `not-found.tsx` or `error.tsx` is present, and the route does not call `notFound()`.
- **Route-specific logic:** `generateStaticParams()` returns local property ids. `generateMetadata()` uses local property metadata when available and a derived `${propertyId} · ILA Homes` title for ids without local records. API detail, documents, and life-stage requests are independently cancellable.

## 6. Tracked share landing route

**Exact path:** `/property/[trackingToken]/view`
**Type:** Dynamic page route, two segments plus a literal `view`
**Main page:** `src/app/property/[trackingToken]/view/page.tsx`, default export `SharedPropertyViewPage`
**Shared rendered view:** `src/components/PropertyDetail/ApiPropertyView.tsx`, which renders `src/components/PropertyDetail/PropertyPageView.tsx`

This route is the destination for links minted by the property share control. It exists to resolve a share's tracking token to a property, then hand that property to the **existing** property detail UI. It is not a second property page.

- **Dynamic parameters:** `trackingToken`, the opaque share token. It is not a property id and is never used as one. The token resolves to a property summary; only `data.property.id` is used, and the property itself is loaded from the existing property detail endpoint.
- **Query parameters:** none.
- **How users reach it:** links produced by `ShareButton` via `buildShareUrl`, and any forwarded copy of one.
- **Navigation behavior:** resolves client-side, then renders the standard property detail experience. The breadcrumb and CTAs inside that UI link to `/` and `/properties` as usual; the tracked URL itself is not rewritten or redirected.
- **Data/API dependencies:** `GET /api/shares/{tracking_token}` resolves `data.property.id`, after which `ApiPropertyView` issues the existing `GET /api/properties/{id}`, `/documents` and `/life-stage-fit` requests. Tenant resolution therefore runs in the browser, matching every other data load in the application.
- **Loading/error/not-found:** `Loading property…` while the token resolves; an in-page `Not found` / `Property unavailable` state with a link back to `/properties` when it does not. It does not call `notFound()` and there is no `not-found.tsx`, matching `/properties/[propertyId]`.
- **Route-specific logic:** the page is a client component that unwraps `params` with React `use`, so it defines no `generateStaticParams` and no `generateMetadata`. The tracked URL therefore carries no route-level title or description.

### Shared UI

The route contributes no property markup, imports no detail section, and adds no CSS. It renders `ApiPropertyView`, which is the same component `/properties/[propertyId]` uses for API-backed ids, so both paths converge on `PropertyPageView` and are identical in layout, typography, colour, imagery, sections, CTAs, animation and responsive behaviour. The only difference is which URL produced the property id.

## 7. Dynamic route parameters

The confirmed page dynamic segments are `[propertyId]` in `/properties/[propertyId]` and `[trackingToken]` in `/property/[trackingToken]/view`.

- `/properties/[propertyId]` receives `params` as `Promise<{ propertyId: string }>` and awaits it. Local static ids are resolved with `getPropertyById(propertyId)`; API-backed loading is gated by `isPropertyUuid(propertyId)`; API requests URL-encode the id and require a UUID rather than a slug. `generateStaticParams()` covers ids returned by `listPropertyIds()`; API UUIDs are handled at runtime by `ApiPropertyView`.
- `/property/[trackingToken]/view` receives `params` as `Promise<{ trackingToken: string }>` and unwraps it with React `use`. The token is URL-encoded and passed to `GET /api/shares/{tracking_token}`. It is opaque and is not a property id, so it is never passed to the property API and never validated as a UUID.

No other dynamic page segment is confirmed.

## 8. Query parameters

No page route uses confirmed URL query parameters for rendering, filtering, or pagination.

The confirmed Route Handler `/api/layout-image` reads one query parameter, `url`. API service calls elsewhere construct query strings for backend requests, including:

- `/api/properties?status=ALL&page=1&per_page=100`
- `/api/locations?page=1&per_page=20`
- `/api/properties?location_slug={slug}&page=1&per_page=10`

These are internal API request parameters and are not documented as browser page-route query state.

## 9. Hash / anchor navigation

The application uses fragment navigation inside the property-detail UI and a single fragment target on the homepage. Confirmed targets include:

- Homepage: `#projects`, which `MapSection` renders as the id of its root `<section>`.
- Property/map links use `#contact` for enquiry-oriented navigation. **No `id="contact"` is rendered on `/` any more** — `FindYourPlot` used to carry it and is no longer mounted — so this fragment has no target on the homepage. The map's `PropertySheet` also links to `#brochure` (no target anywhere in the current render tree) and to `/properties/{id}#affordability-financing`, which does resolve on the property detail page.
- `Footer` links to `/#faq`, `/#about`, and `/#contact`; none of those ids is rendered on `/` any more, because `Faq`, `WhoWeAre`, and `FindYourPlot` are no longer part of the homepage.
- `LegalDocuments` links to `#document-build-rules`; the target is `UNKNOWN — needs verification`.

`Hero` — the component that used to call `document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" })` and fall back to `router.push("/#projects")` — is no longer rendered on `/`. Fragment links do not create separate routes or query state.

## 10. Internal navigation patterns

Internal navigation is implemented with:

- `next/link` for page paths such as `/`, `/properties`, and `/properties/{id}`.
- Plain anchors for some fragment links, especially in `Footer` and detail sections.
- Programmatic router navigation from the hero search fallback in `Hero.tsx`, which is no longer mounted on `/`.
- Browser scrolling for an already-rendered homepage anchor (`#projects`, supplied by `MapSection`).

There is no shared route registry or central navigation service.

## 11. External navigation patterns

External navigation is implemented with ordinary anchors or browser APIs, not Next.js routes. Confirmed examples include:

- WhatsApp URLs generated as `https://wa.me/?text=...`.
- Site-visit email links using `mailto:hello@ilahomes.example`.
- Property sharing fallback to WhatsApp.
- `navigator.share`, clipboard, and `window.open` in client-side sharing flows.
- External map tile/style URLs and remote image URLs, which are resource dependencies rather than application routes.

Exact behavior when mail clients, popup windows, sharing, or clipboard APIs are unavailable is `UNKNOWN — needs verification`.

## 12. Navigation components

- `Navbar` is a client component mounted by the root layout. It links to `/properties` and to homepage fragments `#about`, `#projects`, `#services`, and `#contact`. Only `#projects` has a target on `/` now that the homepage renders just `MapSection`; the other three resolve nowhere. Its mobile menu is local state and closes after link selection.
- `Footer` is mounted by the root layout. It uses `next/link` for `/properties` and plain anchors for `/#projects`, `/#faq`, `/#about`, and `/#contact`.
- `PropertyHero` provides breadcrumbs to `/` and `/properties` and renders external WhatsApp/mailto actions.
- `PropertiesList` renders property-detail `Link` elements and separate favourite buttons.
- `SimilarProperties` renders property-detail `Link` elements.
- `PropertySheet` in `MapSection.tsx` renders property-detail and fragment links when the required property record is present.

## 13. Route-specific layouts

No route-specific layout exists. All confirmed page routes are wrapped by the single root layout, which supplies the HTML document, Montserrat font, global styles, visitor/session/analytics initializers, navbar, main wrapper, and footer.

## 14. Route-specific loading states

No App Router `loading.tsx` file exists.

- `/`: loading states are owned by client sections that fetch data — now only `MapSection`.
- `/properties`: `PropertiesList` initially uses `loading` state and renders a status message.
- `/properties/[propertyId]`: `ApiPropertyView` renders `Loading property…` while the API property request is pending. Documents and life-stage fit load independently and do not block the main property render once it arrives.
- `/property/[trackingToken]/view`: the route renders its own `Loading property…` while the tracking token resolves, then delegates to `ApiPropertyView`, which owns the property/Buyer Fit loading states from that point.

Loading lines on these routes render the shared `ila-loader ila-loader--sm` animation beside the text — see `docs\features\loading.md`.
- `/api/layout-image`: the handler performs an upstream fetch and has no UI loading state.

Exact visual loading behavior for every client subsection is `UNKNOWN — needs verification`.

## 15. Route-specific error handling

No App Router `error.tsx` file exists.

- `/`: `MapSection` catches or represents its own API/map errors. The page has no single route-level error boundary confirmed in source.
- `/properties`: `PropertiesList` represents list-load failure in client state; favourite failures are shown separately and do not fail the route.
- `/properties/[propertyId]`: invalid API ids and failed API property loads render an in-page unavailable state rather than throwing to a route error boundary. Documents and life-stage-fit failures are isolated from the main property view.
- `/property/[trackingToken]/view`: a failed or unresolved token renders an in-page unavailable state using the same classes and copy as `ApiPropertyView`'s own error state, with a link back to `/properties`. Aborted token requests are ignored.
- `/api/layout-image`: returns `400` for missing/invalid/non-HTTPS/non-S3 `url`, passes through `403`/`404` classes of upstream failures, returns `413` for oversized data, and returns `502` for other upstream/fetch failures.

Exact handling of unexpected render exceptions is `UNKNOWN — needs verification` because no route-level error file is present.

## 16. Not-found handling

No `not-found.tsx` file and no call to `notFound()` were found.

For `/properties/[propertyId]`, a non-local id is treated as a possible API UUID. If it is invalid or cannot be loaded, `ApiPropertyView` renders the in-page `Property unavailable` state labelled `Not found`; it does not return a confirmed Next.js 404 page.

`/property/[trackingToken]/view` follows the same convention: an unresolvable token renders the in-page unavailable state and does not call `notFound()`. Root and listing routes have no custom not-found implementation.

## 17. Client vs server components involved in routing

- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/properties/page.tsx`, and `src/app/properties/[propertyId]/page.tsx` do not declare `"use client"` and are server components by default.
- `src/app/property/[trackingToken]/view/page.tsx` **does** declare `"use client"`. It is the only page route that is a client component, because its token request must run where tenant resolution uses the browser hostname, and because it unwraps `params` with React `use` before rendering the shared `ApiPropertyView`.
- `Navbar`, `PropertiesList`, `ApiPropertyView`, `PropertyPageView`, and many interactive child components declare `"use client"`. `Hero` also declares it, though it is no longer mounted on `/`.
- Server page components select the route and compose the tree; client components perform browser navigation, API requests requiring browser tenant context, scrolling, local state, and interactive error/loading presentation.
- The Route Handler is server-side and runs the upstream image proxy logic.

## 18. Programmatic navigation

The only confirmed Next.js programmatic navigation is in `Hero.tsx`:

```ts
router.push("/#projects");
```

It is used only when the current document does not contain an element with id `projects`. The same component otherwise uses `scrollIntoView` without changing the URL. **`Hero` is no longer rendered on `/`** (see §3), so this navigation is currently dormant: nothing in the mounted tree triggers it, and `id="projects"` is still supplied by `MapSection`. No confirmed use of `router.replace`, `router.back`, `router.prefetch`, redirect helpers, or the `scroll` option exists in application source.

`ScrollToTop` (see §27) is the only other code that moves scroll position on a route change.

## 19. Link-based navigation

`next/link` is used for:

- Logo to `/`.
- Navbar and footer page links.
- Property breadcrumbs to `/` and `/properties`.
- Property list cards to `/properties/{property.id}`.
- Similar-property cards to `/properties/{property.id}`.
- Map/property-sheet links when a property record is available.
- Error-state recovery link back to `/properties`.
- Homepage available-match link to `/#projects`.

Plain `<a>` is used for fragment links and external WhatsApp/mailto links where source uses ordinary anchor behavior.

## 20. Route redirects, if any

No route redirect is confirmed. The property detail page explicitly renders an API-backed view for a valid UUID instead of redirecting. No `redirect()` call, redirect configuration, or redirecting middleware was found.

## 21. Middleware, if any

No project middleware file was found. The only middleware-like files discovered were Next.js files inside `node_modules`, not application code. Tenant selection is handled by the internal API client and request headers, not by confirmed Next.js middleware.

## 22. Environment-dependent routing, if any

No environment variable changes the set of page routes. Environment/configuration affects dependencies used after navigation:

- `NEXT_PUBLIC_API_URL` controls the API base URL used by client data requests.
- Tenant resolution uses the browser hostname and the API client's tenant-header behavior; server-side `SITE_DOMAIN` is also referenced by that configuration.
- `NEXT_PUBLIC_SATELLITE_TILES_URL` affects map imagery, not page routing.
- `next.config.ts` allows configured development origins and restricts remote image patterns to HTTPS `**.amazonaws.com` hosts.

The exact behavior when required environment values are absent or invalid is `UNKNOWN — needs verification`.

## 23. Deep-link behavior

`/` and `/properties` are direct page routes. `/properties/{propertyId}` supports direct deep links for:

- Local static property ids returned by `listPropertyIds()`.
- API property UUIDs, which are loaded at runtime by `ApiPropertyView` even when not present in static params.

For a valid API UUID, the route displays a loading state, then the shared property template. For an invalid or unavailable id, it displays the in-page unavailable state with a link to `/properties`.

`/property/{tracking_token}/view` also supports direct deep links, because that is the point of it — a shared link opened cold, with no prior session in this tab. It resolves the token client-side and then displays the same shared property template. Whether `GET /api/shares/{tracking_token}` requires a prior visitor cookie, and whether reading it records the share as viewed, is `UNKNOWN — needs verification`.

Server/deployment behavior for deep links when the hosting platform is not configured for Next.js routing is `UNKNOWN — needs verification`.

## 24. URL structure conventions

- The homepage uses `/`.
- The catalogue uses the plural collection path `/properties`.
- Property details use `/properties/{propertyId}` with one dynamic segment.
- Tracked share views use `/property/{trackingToken}/view` — singular `property`, a different segment name, and a trailing literal `view`.
- The detail segment is called `propertyId`, but API detail requests use UUID ids rather than API slugs.
- A tracking token is not a property id and is never used in the `/properties/{propertyId}` segment.
- Section navigation uses `/#fragment` for homepage targets and `#fragment` for same-document targets.
- API route handlers use `/api/{resource}`; the confirmed image proxy is `/api/layout-image`.
- No confirmed trailing-slash, locale, versioned-route, or query-state convention exists beyond these paths.

## 25. Dependencies related to routing

Confirmed routing-related dependencies and project facilities are:

- Next.js `16.3.8` App Router.
- `next/link` for internal links.
- `next/navigation` `useRouter` for the hero search fallback (in `Hero.tsx`, no longer mounted on `/`).
- React client components and browser history/scroll APIs.
- Next `Image` for navigation-adjacent images and configured remote image handling.
- The internal API client/services for data needed by listing/detail views, including `fetchSharePropertyId` for the tracked share route.
- `maplibre-gl` and external map resources for the `MapSection` map on the homepage, not for route resolution.

## 26. Known issues

- There is no custom route-level `loading.tsx`, `error.tsx`, or `not-found.tsx` handling.
- Property detail failures use an in-page unavailable state rather than a confirmed Next.js 404 response.
- The hero and several feature documents reference `#projects`; the target is confirmed — `MapSection` renders `id="projects"` — but the component that scrolls to it (`Hero`) is no longer mounted on `/`.
- `Footer` links to `/#faq`, `/#about`, and `/#contact`, and the map's `PropertySheet` and plot read-out link to `#contact` and `#brochure`. None of these ids is rendered on `/` now that `Faq`, `WhoWeAre`, and `FindYourPlot` are no longer part of the homepage, so those fragments have no target. `#loan-calculator` and `#document-build-rules` remain `UNKNOWN — needs verification` in the current inspected render tree.
- Page routes do not use URL query state for search, filters, or catalogue pagination.
- API-backed property detail loading is client-side after the page route resolves, so the initial route page can show a loading state.
- `/property/[trackingToken]/view` is a client page route and the only route that is; it therefore has no `generateMetadata`, so a shared link carries no route-level title or description.
- The tracked share route issues two sequential requests (token resolution, then property detail). The token-resolution response is a property summary of which only `id` is consumed.
- The exact behavior of all client section errors and all unexpected render exceptions is `UNKNOWN — needs verification`.
- No automated routing test coverage was confirmed; `UNKNOWN — needs verification`.

## 27. Scroll position on navigation

**Every route change sends the window to the top of the document.** This is not Next.js default behaviour on this site; it is enforced explicitly.

### What Next.js does by default

Per the bundled App Router docs (`01-app/03-api-reference/02-components/link.md`), `<Link>`'s `scroll` prop defaults to `true`, but the described behaviour is to **maintain scroll position**, similar to back/forward navigation: "scroll position will stay the same as long as the Page is visible in the viewport."

The mechanism is documented in the same file's note on `scroll`. Next.js walks the top-level elements, bypassing sticky/fixed elements and anything without rendered HTML, until it identifies **a scrollable element that is visible in the viewport** — and scrolls *that* element rather than the window.

`use-router.md` describes the same default from the other direction ("Next.js will scroll to the top of the page when navigating to a new route"), with `scroll: false` as the opt-out.

### Why that fails here

On a conventional site — a handful of short pages — that walk resolves to the window and lands correctly.

This homepage **was** a single very long document with many independently scrollable regions. The table below is the composition that produced the bug; since `/` was reduced to `MapSection` alone (see §3), only the MapLibre frame row still applies:

| Region | Scroll container | Still on `/`? |
|---|---|---|
| FindYourPlot results panel | `.ila-scroll-dark` | No |
| CompareProperties metric table | `.ila-search-scroll` | No |
| GrowthCorridors card carousel | `overflow-x-auto` snap row | No |
| GrowthCorridors / MapSection map frames | MapLibre containers | MapSection only |
| Mobile results sheet | `overflow-y-auto` dialog | No |

Tapping a property card from inside one of those regions let the scroll target resolve against the section rather than the document, so the destination route opened at whatever offset that section was sitting at. This was the reported symptom: navigating to `/properties` or `/properties/{id}` from a scrolled section landed mid-page.

### The fix

`src/components/ScrollToTop.tsx` — a client component mounted in `src/app/layout.tsx` above `<Navbar>`:

```tsx
const pathname = usePathname();

useEffect(() => {
  if (window.location.hash) return;
  window.scrollTo(0, 0);
}, [pathname]);
```

Three decisions in that shape:

| Decision | Reason |
|---|---|
| Root layout, not per-link | Property links exist in eight components (Navbar, Footer, PropertiesList, SimilarProperties, GrowthCorridors, MapSection `PropertySheet`, FindYourPlot, CompareProperties detail columns). Per-link handling is eight chances to miss one, and every new property card would silently inherit the bug. The root layout is the only element that survives every navigation. |
| `useEffect`, not `useLayoutEffect` | A layout effect avoids a visible jump but also runs during server rendering, where React warns it is a no-op. The jump is not observable here: the effect lands in the same commit as the navigation and the destination pages are short at first paint. |
| Bail on `window.location.hash` | `/#faq` and `/#contact` also change the pathname when followed from another route. Bailing hands those back to the browser's own fragment scroll instead of racing it. Same-page fragment links never change the pathname and so never reach the effect. |

### What this does not change

- **Same-page fragment scrolling is untouched.** `Hero`'s `scrollIntoView` (in the component itself, which is no longer mounted on `/`), and every in-document anchor, still behave as before — the effect does not run when the pathname is unchanged.
- **Browser back/forward still restores position**, because that is browser and App Router behaviour rather than anything this component overrides.
- **Scroll positions *within* a section's own scroller are not reset** by this. `ScrollToTop` moves the window only; it does not reach into `.ila-scroll-dark` or `.ila-search-scroll`. If a preserved inner scroll offset is ever reported, that is a separate concern.
- Whether `cacheComponents` is enabled is **false** — `next.config.ts` does not set it — so Next.js's `<Activity>`-based route preservation and its scroll-position side effect are **not** in play here. That guide's behaviour must not be assumed for this project.

## 28. Important constraints

- Document and preserve only the confirmed routes: `/`, `/properties`, `/properties/[propertyId]`, `/property/[trackingToken]/view`, and `/api/layout-image`.
- Keep local static property ids distinct from API UUIDs; the detail route intentionally supports both through different branches.
- Preserve `/properties/{propertyId}` rather than substituting a slug-based route.
- Keep `/property/[trackingToken]/view` resolving content through the existing property detail path (`ApiPropertyView` → `apiPropertyToRecord` → `PropertyPageView`). Do not add a second property detail template, do not render property data straight from the share response, and do not redirect, so a tracked link and a catalogue link produce the identical page.
- Never treat a tracking token as a property id, and never validate a token with `isPropertyUuid`.
- Preserve the single root layout and its global navigation shell unless the actual application structure changes.
- Do not treat homepage sections or fragment targets as separate routes.
- Do not treat internal API request paths as browser page routes.
- Do not infer a redirect, middleware, route-level 404, route-level error boundary, or route-level loading UI where none is present.
- Preserve the current client/server split: route files compose pages, while client components own browser interactions and most data loading.
- Preserve the `/api/layout-image?url=` validation boundary if documenting or relying on the current route handler: HTTPS S3 hosts only, no forwarded cookies, 60 MB maximum, and private no-store responses.
- If a behavior cannot be confirmed from source, retain the exact wording `UNKNOWN — needs verification` rather than inferring it.