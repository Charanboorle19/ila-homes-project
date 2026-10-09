# Compare Properties feature

## Scope and terminology

This document is a **proposed feature specification** for a Compare Properties capability. It is written against the confirmed architecture documented in [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md), and complements [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md), [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md), [`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md), and [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md).

**Compare Properties is not implemented.** No comparison route, component, service, or selection store exists in the confirmed source described by the documentation above. Every component path, route, state variable, event emission, and API call in this document is **proposed**, unless it is explicitly labelled *existing*.

A terminology note, because the existing docs are strict about this: "compare" here is a **distinct** capability from the three already-documented systems that superficially resemble it. Per [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §1 and §35, these must not be conflated:

| System | Documented in | Identity | Storage |
|---|---|---|---|
| API favourites | `wishlist.md` §6, `api.md` §16 | Visitor-scoped `X-Visitor-Code` | Backend |
| Wishlist / Interested flags | `wishlist.md` §14–15 | Per-property flag | `localStorage` `ila-wishlist-{id}` / `ila-interested-{id}` |
| Homepage Shortlist | `wishlist.md` §14 | In-memory `pinned` array | React memory only |
| **Compare Properties (proposed)** | this document | Ordered selection of API property UUIDs | See §10 |

## 1. Feature purpose

Allow a visitor to select multiple properties and compare their important characteristics side by side, so the visitor can make an informed purchasing decision without opening each property page individually.

The existing application offers no way to see two properties at once. [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §17 confirms `PropertiesList` has "no in-list selected-card state, active card state, comparison selection, or map selection state", and [`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §29 confirms the catalogue shares no state with `MapSection`. `SimilarProperties` ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §36) scores only the local `properties` array, is one-directional, and is not a comparison view.

## 2. Where it would appear

Proposed surfaces, each confirmed to exist today:

- **`/properties` catalogue** — `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertiesList.tsx`. The strongest candidate for Add to Compare: it already renders a per-card control (the favourite button) positioned over the card independently of the link, and already holds an id-keyed set of selected ids (`savedIds`). See [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §12, §19.
- **Homepage developments map** — `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`, sidebar `PropertyCard` rows. See [`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §5, §20.
- **Property detail page** — `PropertyFinalCta` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyFinalCta.tsx`, alongside the existing `Save to wishlist` and `Share property` chips. See [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §37, §48.

Whether all three entry points are implemented in the first increment, and their order, is a product decision — see §27.

## 3. Proposed route

**`/compare` is proposed, not existing.** [`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §1 confirms the application has exactly four page routes (`/`, `/properties`, `/properties/[propertyId]`, `/property/[trackingToken]/view`) and one Route Handler. There is no compare route.

A proposed static route `src/app/compare/page.tsx` fits the documented conventions:

- Plural collection path, matching `/properties` ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §24).
- It requires no dynamic segment, so it avoids the `generateStaticParams` / `generateMetadata` concerns described for `/properties/[propertyId]` ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §6).
- It inherits the single root layout automatically; no route-specific layout is needed ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §13).

### Query-parameter encoding — requires a decision

If the selection is encoded in the URL (for example `/compare?ids={uuid},{uuid}`), that would be the **first** page route in the application to use URL query state. [`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §8 states: "No page route uses confirmed URL query parameters for rendering, filtering, or pagination", and §26 repeats it as a known issue. This would be a deliberate, documented departure. Whether the selection should live in the URL at all — as opposed to browser storage per §10 — is `UNKNOWN — needs verification` as a product decision.

If the selection is **not** in the URL, `/compare` is share-hostile: a copied link carries no selection. The existing share precedent ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §37b) solves the analogous problem with a server-minted opaque token, so a token approach would be consistent — but it would require a new backend capability. See §12.

## 4. Proposed component/file paths

None of these exist. Proposed, following the existing `src/components` + `src/services` split:

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\compare\page.tsx` — proposed route, server component composing the client view (matching `src/app/properties/page.tsx`).
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\CompareTray.tsx` — proposed global selection indicator and "Compare N" entry point.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\CompareView.tsx` — proposed comparison table.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\CompareButton.tsx` — proposed reusable Add/Remove control for property surfaces.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\compareService.ts` — proposed data access.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\lib\useCompareSelection.ts` — proposed selection store (§10).

A single shared hook rather than React Context matches the project's existing preference for local state and small `src/lib` helpers. **However**, the existing documentation explicitly warns against assuming shared state: [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §27 and §38, and [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §34, record that `PropertiesList`, `MapSection`, and `PropertyFinalCta` currently have **no** shared favourites state. Compare selection must therefore be an explicitly new, deliberate cross-component mechanism rather than an assumption that one exists.

## 5. User journey (proposed)

1. The visitor discovers properties through the `/properties` catalogue, the homepage developments map, or a property detail page.
2. The visitor activates **Add to Compare** on a property. The control reflects the selected state.
3. The interface indicates which properties are currently selected — on the card itself and in a persistent tray showing the selection count.
4. The visitor activates the control again, or a Remove control on a selected property, to remove it. A **Clear all** action empties the selection.
5. The visitor opens the comparison view, typically via a "Compare N properties" call to action.
6. The selected properties are displayed side by side, one column per property.
7. From the comparison view the visitor navigates to an individual property's detail page at `/properties/{propertyId}`, or continues their enquiry via the existing WhatsApp / site-visit / lead paths.

## 6. Property selection behavior (proposed)

### Maximum

**A configurable maximum of 3 properties initially**, per the feature brief. The limit must be a named constant in the comparison module rather than a literal repeated in each component, so raising it later is a one-line change.

Note a conflict to resolve: `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\explanational-file` — a documentation file present in the repository but **not** part of the `docs/` architecture documentation and **not** reflected in `api.md` — describes a backend comparison API that accepts **2 to 5** property ids. If that API is used (§12), the client maximum of 3 must stay within the server's bounds. Whether the backend limit is 2–5, whether the client cap should instead be 5, and whether the file describes a deployed backend at all, are `UNKNOWN — needs verification`.

### Rules

- **Duplicate prevention.** A property already in the selection cannot be added twice. Selection is a set of API property UUIDs; re-activating Add on a selected property is either a no-op or a remove, and must be decided explicitly so the control's two states are unambiguous. Proposed: the control is a toggle with `aria-pressed`, so re-activation removes.
- **Selection count.** Always visible from the first selection onward, including a `0` / `N of M` form once at least one property is selected.
- **Exceeding the maximum.** Unselected properties beyond the maximum are visually de-emphasised and their control disabled, and the tray explains the cap. An alternative — enabling the control and showing an error on activation — is worse, because it offers an action that cannot succeed. This is proposed, not existing.
- **Clear all.** One action emptying the selection and dismissing any comparison result. Note [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §21 confirms **no clear-all control currently exists** in any of the three existing selection systems, so this is new.
- **Consistency across entry points.** The same ids, the same maximum, the same tray, and the same selected/unselected visuals in every surface. Because the three candidate surfaces are separate components with separate state today (§2), this requires the shared store in §10 rather than three copies of the logic.

### Selection scope

Proposed selection unit is the **API property UUID**, consistent with every existing visitor-scoped system: API favourites post `{ property_id }` as a UUID ([`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §7), and the homepage Shortlist selects "API property UUID values" ([`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §7).

This has a consequence for the property detail page. Per [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §37a, `ShareButton` is gated on `isPropertyUuid(property.id)` because local static records carry `LayoutId` slugs rather than `property_id` values. Add to Compare on a **local static** property therefore has no comparable id and must either be hidden, or the selection must be widened to accept slugs. Given the proposed maximum of 3, a mixed id space is defensible but complicates the comparison data source. **Recommendation:** gate the control on `isPropertyUuid(property.id)` exactly as `ShareButton` does, and hide it on local records. Whether that is acceptable product behavior is `UNKNOWN — needs verification`.

## 7. Comparison view (proposed)

Layout: one row per comparable attribute, one column per selected property. With a maximum of 3 this fits side by side at desktop widths.

### Attribute availability and mapping

Availability is confirmed against the two documented list/detail types. **`PropertyListItem`** is the `GET /api/properties` row type ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §10, [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §9). **`ApiProperty`** is the `GET /api/properties/{id}` type ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §17).

| Attribute | `PropertyListItem` | `ApiProperty` | Source / mapping requirement |
|---|---|---|---|
| Image | `cover_url` | `cover_url` | Direct. Fall back per §9. |
| Name | `name` | `name` | Direct |
| Location | — | `locality`, `city`, `location_name`, `address` | **Detail request required.** `PropertiesList` derives locality by joining non-empty `locality` and `city` with `, ` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §11, §20); `MapSection` joins with `, ` and falls back to `address`, then `location_name`, then `Hyderabad`. Pick one order and share it. |
| Property type | `property_type` | `property_type` | Direct |
| Plot / property size | optional `area_range` (`min`/`max`) | `area` | **Unit-sensitive. See §9.** `area_range` values are formatted as square yards in the map popup per [`property-popup.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-popup.md) §11; `ApiProperty.area` is described as acres in the same document. Whether `area` and `area_range` describe the same quantity is `UNKNOWN — needs verification`. |
| Price | `price`, optional `price_label` | `price`, `price_label`, `minimum_price`, `target_price` | Direct. `formatPrice` ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §9) already maps null / non-finite / non-positive to `Price on request` — reuse it, do not reimplement. |
| Price per sq.ft | — | `price_per_sqft` | **Detail request required.** If absent, it is calculable as `price / area_sqft`, but only if `area_sqft` exists — `area_sqft` is **not** in the confirmed `ApiProperty` field list ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §17). Calculation therefore may not be possible; see §9. |
| Availability / status | — | `status`, `availability_status`, `available_inventory`, `total_inventory`, `sold_inventory` | **Detail request required.** Note the catalogue request uses the fixed server filter `status=ALL` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §13), so a list row carries no lifecycle status of its own. |
| Amenities | — | `amenities` | **Detail request required.** Compare as a set; render count plus the differing entries. Do not assume identical lengths. |
| Nearby connectivity | — | `connectivity_score` | **Detail request required.** `connectivityScore` on `PropertyPageView` is a **derived** value from local data ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §8, §21), so a comparison must use the API field, never the local derivation. |
| Legal / verification | — | — | **Separate endpoint.** `GET /api/properties/{id}/documents` returns `ApiPropertyDocument[]`. Document count and availability flags only; do not render document contents. |
| Buyer Fit | — | — | **Separate endpoint.** `GET /api/properties/{id}/life-stage-fit` returns personas with `fit_percentage`, normalized by `apiPropertyToRecord` into the four keys `family`, `investment`, `building`, `retirement` ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §14). Compare those four keys. |
| RERA / approval | — | `rera_registered`, `rera_number`; approval from `metadata` | **Detail request required.** Existing UI wording is `Registered` / `Not listed` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §11); reuse it rather than inventing copy. |

**The central data finding:** `PropertyListItem` does not carry location, status, amenities, connectivity score, RERA, or price per square foot. A comparison built solely from the list endpoint can show only image, name, property type, and price. Every other comparable attribute requires either a detail request per selected property or a dedicated comparison endpoint (§12).

## 8. Additional attributes already available

Beyond the brief's list, these confirmed fields could be compared and are worth considering, subject to the same detail-request caveat:

- `possession`, `facing`, `minimum_price`, `target_price`, `negotiable`, `listing_type`, `configuration`, `short_description`, `landmark`, `state`, `pincode`.
- `available_inventory` / `total_inventory` as a plotted-inventory comparison, which is directly relevant to a plotted-developments catalogue.
- `total_plots`, `available_plots_count`, `area_range` — documented as present on `PropertyListItem` on some API deployments ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §10), i.e. optional and deployment-dependent. Render as unavailable when absent (§9).

Do not add an attribute whose value would have to be invented. The brief's instruction is explicit: do not fabricate property details.

## 9. Missing data behavior (proposed)

### Placeholder

Use **one** consistent placeholder string for an absent value. `—` is the established placeholder in the Property Details sections — [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §31 records `LifeStageMatch` displaying `—` for pending/unavailable scores, and [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §11 records the `Plots` row rendering `—` when falsy. Proposed: reuse `—` rather than introducing "N/A", "Not available", and "Price on request" as competing placeholders. Where `formatPrice` already owns the wording (`Price on request`), that wording wins.

### Rules

- **Never treat a missing value as zero.** A property with `null` price is not priced at `₹0`, and a property with `null` `available_inventory` has zero plots available only if the API says so.
- **Never fabricate.** Do not substitute another property's value, a placeholder image carrying invented content, or a copy-derived attribute as though it were recorded data.
- **Do not compare incompatible units.** This is the highest-risk rule in the feature. Confirmed unit heterogeneity: `ApiProperty.area` is treated as acres ([`property-popup.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-popup.md) §11, `Project extent` renders `${area} acres`), `PropertyListItem.area_range` is formatted as square yards in the same document, and `sqYards`, `areaSqFt`, and `areaCents` are three separate normalized record fields ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §13). Two columns labelled "Area" may be in different units. Required mitigations:
  1. Carry the unit alongside every numeric area value rather than inferring it.
  2. Render the unit in the row label or the cell, not only in a header.
  3. If the unit cannot be established for a value, render the placeholder instead of a bare number.
  4. Do not compute a ratio — such as price per unit area — across values whose units are not both known and identical.
  5. Whether the API's `area_unit`/unit metadata is present on these responses is `UNKNOWN — needs verification`; `ApiProperty`'s confirmed field list ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §17) does not include one.

### Partial availability within a row

An attribute present for one property and absent for another is **normal, not an error**. The row still renders; the absent column shows the placeholder. The row is not dropped, because dropping it would silently hide a real difference.

Consequently, any "best value" or difference highlighting must be computed only across non-null values, and must not run at all when fewer than two properties in that row have a value. Whether to highlight a best value per row is itself a design decision — it risks implying a meaningful comparison for rows like `Total plots`, where more is not obviously better. **Recommendation:** do not auto-highlight "best" on qualitative rows; highlight only where direction is unambiguous. `UNKNOWN — needs verification` as a product decision.

## 10. State and persistence (proposed)

### Does the architecture support this?

Yes, without new infrastructure. The project already uses all three browser facilities: `localStorage` for Wishlist/Interested flags ([`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §14–15), `sessionStorage` for `session_id` ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §16), and backend persistence keyed by the anonymous `visitor_code` cookie ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §4).

### Recommendation

The simplest approach consistent with the current implementation is **`localStorage`, mirroring the existing Wishlist pattern** — not a backend store and not a visitor-scoped API entity.

Rationale:

1. The comparison selection is a **view concern**, not user-authored data. It is not an enquiry, a lead, a favourite, or a share. Persisting it server-side would create a fourth visitor-scoped entity alongside the three [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §35 requires be kept distinct, for no confirmed consumer.
2. No backend comparison-selection endpoint is confirmed anywhere in `api.md` (§12). Inventing one would violate [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §27.
3. `localStorage` already survives refresh and navigation, which is the whole requirement.

Proposed storage contract, following the established `ila-` prefix:

- Key: `ila-compare-ids`
- Value: a JSON array of API property UUID strings, **order-preserving** — order defines comparison column order, and it must not be re-sorted on read
- All access wrapped in `try/catch`, matching [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §14, which records that storage failures are ignored
- Writes on every add/remove/clear; reads once per mount

This is **proposed**, and the key name is a new convention — the two documented existing keys are `ila-wishlist-{id}` and `ila-interested-{id}`, so `ila-compare-ids` does not yet exist.

### Lifecycle

- **Selection state:** an ordered array of property UUIDs, shared across the entry points in §2 via a single hook so the tray, the cards, and the comparison view cannot disagree.
- **Duplicate prevention:** check membership before appending; the toggle semantics in §6 make this implicit.
- **Maximum:** enforced at the single mutation point, not per control.
- **Across navigation and refresh:** `localStorage` covers both, for the same browser storage context. Note [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §16 records this caveat for the Wishlist: persistence is subject to browser storage availability.
- **Guests:** the comparison feature has no authentication dependency, so guests are fully supported — the same as the catalogue itself. [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §4 confirms there is no confirmed login flow; anonymous identity is the `visitor_code` cookie. **The comparison selection must not be gated on `whenVisitorReady()`**, or the control would be unavailable on first paint.
- **Cross-device / cross-visitor:** not supported by this recommendation. A selection is browser-local.
- **Saved property no longer available:** if a stored id no longer resolves — deleted, deactivated, or never returned by the API — drop it silently from the selection rather than failing the view, and if the remaining count falls below the minimum for comparison, show the empty state (§13). Do not display a column for a property that cannot be loaded, and do not display a fabricated name for it. If the dropped id's name was cached for display, the cached name is a stale label and must be marked or refreshed. **Exact backend behavior when a previously available property no longer exists is `UNKNOWN — needs verification`** — [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §34 records the equivalent gap for favourites.
- **Clear all:** remove the storage key's contents, reset in-memory state, and dismiss any current comparison result. Proposed to also **remove** the key rather than write an empty array, unlike the Wishlist which writes `"0"` and leaves the key ([`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §21) — removal leaves a smaller storage footprint. Whether consistency with the Wishlist behavior matters more is a minor open question.
- **Corrupt or unexpected stored value:** treat as empty and overwrite. Do not crash the page; a malformed key must not be able to break `/properties`.

## 11. Routing and navigation (proposed)

### Entry

- The tray's "Compare N properties" call to action navigates to `/compare`.
- The tray should be visible on `/`, `/properties`, and `/properties/[propertyId]` so a selection is never stranded. Placing it in the root layout alongside `Navbar` and `Footer` ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §2) is the proposed location — but note that doing so mounts it on every page, and `Navbar`'s mobile menu is local state whose interaction with a fixed tray is `UNKNOWN — needs verification`.

### Exit

- Each property column links to `/properties/{propertyId}` — the same target the catalogue cards, `SimilarProperties`, and the map `PropertySheet` already use ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §3). Use the API UUID, per [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §18.
- Each column offers a Remove control so the visitor can narrow the comparison without going back.
- Each column continues the enquiry through the **existing** paths only — WhatsApp `https://wa.me/?text=...`, `mailto:hello@ilahomes.example` site visit, or `POST /api/leads`. The comparison view must not implement its own enquiry form; [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §37 warns that `POST /api/site-visits` already creates or reuses the visitor's lead, so presenting both a lead form and a booking control for one interaction would duplicate the enquiry. A single per-column "Enquire" affordance that links to the property page is the safer proposal, letting the existing form own submission.
- "Back to properties" links to `/properties`, matching the recovery-link convention in [`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §19.

### Route-level states

No `loading.tsx`, `error.tsx`, or `not-found.tsx` exists anywhere in the application ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §2, §26), and `notFound()` is never called ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §16). The comparison view must therefore own its own in-page states, following the `ApiPropertyView` pattern of an in-page unavailable state with a recovery link ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §44).

## 12. API and data requirements

### Confirmed existing sources

There is **no comparison endpoint in `api.md`.** The document states in §3 that it "does not describe planned or inferred endpoints", and its §9–§16 endpoint inventory contains no compare operation. Comparison data must therefore be assembled from existing, confirmed endpoints:

| Purpose | Endpoint | Header | Notes |
|---|---|---|---|
| Candidate properties / ids | `GET /api/properties?status=ALL&page=1&per_page=100` | common | Already used by `PropertiesList`, `MapSection`, `ShortlistShare` ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §9) |
| All comparable attributes (§7) | `GET /api/properties/{id}` | common | UUID required; `fetchPropertyById` rejects non-UUIDs locally |
| Legal/verification row | `GET /api/properties/{id}/documents` | common | Per property |
| Buyer Fit row | `GET /api/properties/{id}/life-stage-fit` | common | Per property |

All requests must go through `apiFetch` ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §26), which supplies `X-Tenant-Domain`, `Accept`, the ngrok header, and any stored bearer token, and which throws `ApiError(status, message, code)` on non-2xx.

### Unverified comparison endpoint

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\explanational-file` documents a backend comparison API: `GET /api/properties/compare`, `POST /api/favorites/compare`, and `GET /api/favorites/compare`, with `property_ids`, grouped `metrics` carrying `key`/`better`/`values`/`best_property_id`, and `share_url`. **This endpoint family is not recorded in `api.md` and is therefore not confirmed.** It is also not reachable from `PropertiesList`, the map, or any confirmed consumer. Treat it as a lead to verify, not as a contract.

Whether these endpoints exist in the deployed backend, whether they return the documented shape, and whether the tenant resolves for them the same way are all **`UNKNOWN — needs verification`**. Per the brief and [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §27, this document does not claim they exist.

### Recommended first implementation: assemble from confirmed endpoints

With a maximum of 3, this is at most **3 detail requests**, plus optionally 3 documents and 3 life-stage-fit requests. That is the same order of magnitude as `PropertiesList`'s existing enrichment, which issues up to three concurrent detail requests ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §8) — so it introduces no new traffic pattern.

- **Bound the concurrency** as `PropertiesList` does, and **abort superseded requests** with `AbortController`, since [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §21 records that this pattern is the project's convention.
- **Treat documents and Buyer Fit as independent and non-blocking**, exactly as `ApiPropertyView` does ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §9). A failed documents request must not empty the comparison.
- Consider fetching life-stage fit once per property for all four personas rather than treating personas as separate requests.

### Future backend requirement

If a purpose-built comparison endpoint is later confirmed, the comparison view should consume its grouped metrics and stop issuing per-property detail requests. It must remain correct without one, so the endpoint is an optimization, not a dependency. Marked as a **future requirement — not confirmed to exist**.

### Normalization requirements

- Envelope unwrapping and defaults, following existing services (`data.items ?? []`, `total ?? items.length`).
- Price formatting via the existing `formatPrice`, never a second implementation.
- Unit normalization before any cross-property comparison (§9).
- `null`, absent, and empty-string values all become the single placeholder — not `0`.
- Preserve the API's property order as the column order; do not re-sort.

### Loading, empty, and error states (proposed)

- **Loading** — the comparison view's initial state, mirroring the `Loading property…` / `Loading properties…` wording already in use ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §43, [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §23). `role="status"` as the catalogue uses.
- **Empty — nothing selected** — the primary state on a cold visit to `/compare`. Must state how to add properties and link to `/properties`. This is the most likely first impression of the route.
- **Empty — one selected** — below the minimum; explain how many more are needed.
- **Empty — a selection that cannot be resolved** — all stored ids unavailable; clear the stale selection and fall back to the empty state (§10).
- **Partial** — render the resolvable columns and drop the rest (§10).
- **Error** — a failed comparison request must surface a message with a retry affordance, following the catalogue's pattern of an explanatory message rather than a silent empty table. Exact copy is `UNKNOWN — needs verification`; the documented precedents are `Properties are unavailable right now. Please try again shortly.` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §24) and `Developments could not be loaded. Try again shortly.` ([`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §23).

## 13. Responsive design (proposed)

Follow the existing Tailwind breakpoints: base, `sm` (`640px`), `md` (`768px`), `lg` (`1024px`) — the set used by the catalogue ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §34) and the map ([`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §34).

- **Desktop (`lg` and above)** — side-by-side columns, all properties visible at once. With a maximum of 3 this is comfortable. The attribute label column stays fixed-width and the property columns share the remainder.
- **Tablet (`sm` to `md`)** — compact comparison layout: reduce type scale and padding rather than dropping columns. Do **not** stack columns vertically, which destroys the side-by-side purpose.
- **Mobile (below `sm`)** — the side-by-side table does not fit, and stacking vertically loses the comparison. **Proposed pattern:** horizontal scrolling, with the attribute label column sticky at the left edge and property columns scrolling beneath it. This is the established horizontal-scroll convention in the project — `GrowthCorridors` uses horizontal overflow for locality cards on mobile ([`map.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md) §20) and `MapSection`'s amenities list uses `overflow-x-auto` ([`property-popup.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-popup.md) §16).

Sticky-column behavior and whether it degrades gracefully without JavaScript is `UNKNOWN — needs verification`. An alternative pattern — one property per scroll-snap screen with per-property attribute lists — is mobile-friendly but is a different information model and is not recommended unless the sticky column proves unworkable.

Styling must reuse the existing palette and card conventions: `rounded-2xl`, `border`, the documented gold `#c6a46c` hover treatment, `focus-visible:outline-2` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §35). Do not introduce a new visual system. Whether the comparison view needs its own stylesheet alongside `PropertyDetail.css` is a minor open question; a component using Tailwind utilities alone is consistent with `PropertiesList`.

## 14. Accessibility (proposed)

- **Selection controls** must be native `<button type="button">` with `aria-pressed`, matching the existing favourite, wishlist, and shortlist controls ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §36, [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §32). `aria-pressed` is the established way selection is exposed in this codebase — use it rather than inventing a new pattern.
- **Disabled controls at the maximum** must have an accessible explanation. `disabled` alone removes the control from the tab order and gives a screen reader nothing to explain; a visible reason in the tray plus `aria-describedby` on the control is needed.
- **Action labels** must name the property and the action, as the existing favourite button's labels do (`Save as favourite` / `Saved as favourite` / `Saving…` / `Removing…`, [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §17). Proposed: `Add {name} to comparison` / `Remove {name} from comparison`, and `Remove {name} from comparison` on the tray chip.
- **Selection state must not be conveyed by color alone** — a border or fill change alone fails WCAG 1.4.1. Add a checkmark icon or visible text, as `ShortlistShare` does with an `is-selected` class plus `aria-pressed`.
- **Focus** must be visible on every control, including the tray and the table's links. `focus-visible:outline-2` is the project convention.
- **Semantic comparison markup.** A comparison is tabular data: `<table>` with `<caption>`, `<th scope="row">` for attribute labels, `<th scope="col">` for property names, and `<td>` for values. This is what lets a screen reader announce "Price, row header, ₹85 L, ₹92 L" while navigating. Using nested divs with CSS Grid — a common shortcut for sticky columns — loses the row/column relationship entirely. If CSS Grid is required for the sticky-column behavior, the table must still carry the semantics, or a parallel `role`-based structure must be provided. **Recommendation:** real table markup, with sticky positioning applied to the `th` elements.
- **Live regions** — the existing convention is a polite screen-reader-only `aria-live="polite"` paragraph for errors ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §36) and `role="status"` for loading ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §23). Announce the selection count changes and comparison errors this way.
- **Keyboard** — every action reachable and operable by Tab and Enter/Space natively. Do not require hover. Do not implement custom roving-tabindex behavior; the project has no precedent for it, and [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §50 notes that `MapSection`'s custom touch/wheel handoff has unverified keyboard behavior.
- **Images** — the catalogue uses `alt=""` and treats covers as decorative, letting the name carry meaning ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §36). Follow that, or provide a meaningful `alt`; do not mix conventions in one view.
- **Horizontal scroll affordance** — on mobile, ensure the comparison is discoverable as scrollable. Exact screen-reader announcement behavior for the sticky column is `UNKNOWN — needs verification`.

## 15. Analytics

### Existing events that could be reused

Confirmed in [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §23 and `events.ts` as documented by `api.md`:

- `PROPERTY_COMPARE` — **confirmed existing and batch-sendable.** Already used by the map for `MAP_MARKER_CLICK` adjacency. This is the correct event for opening or completing a comparison.
- `SHORTLIST_ADD` / `SHORTLIST_REMOVE` — **confirmed existing and batch-sendable**, but they require a top-level `property_id` and semantically describe the homepage shortlist. Reusing them for comparison would conflate two documented systems that [`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §35 requires stay distinct. **Recommendation: do not reuse.**
- `PROPERTY_VIEW` — confirmed existing and batch-sendable; appropriate for a click-through from a comparison column to `/properties/{propertyId}`, matching how the catalogue tags its cards ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §26).
- `ENQUIRY_CLICK` / `WHATSAPP_CHAT_CLICK` — confirmed existing, if a column carries an enquiry affordance.

### Proposed events

**`COMPARE_ADD` and `COMPARE_REMOVE` already exist in the event vocabulary** but are recorded by [`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §16 as **not sent by the batch transport**, and `events.ts` documents `COMPARE_ADD` as requiring the same 2–5 id shape as `PROPERTY_COMPARE` and as "better expressed through `PROPERTY_COMPARE`". So both names are available but effectively unusable through the current transport — emitting them produces client-side drop warnings.

Therefore, **proposed analytics uses existing, sendable events only**: `PROPERTY_COMPARE` when a comparison is opened or completed, and `PROPERTY_VIEW` on a column click-through. **No new event name is required**, and none should be invented — `api.md` §26 constrains inventing event names.

`PROPERTY_COMPARE` is constrained by the tracker: it requires `metadata.property_ids` with 2–5 ids and a top-level `property_id`, and is dropped client-side otherwise. With a client maximum of 3 that range is satisfied. The metadata should include the selected ids and a count, plus a `section_type` discriminator in the established style (`"compare_plots"` is a confirmed section name in the `SECTION_NAMES` vocabulary per `events.ts`).

Whether `COMPARE_ADD` / `COMPARE_REMOVE` should instead be enabled in the batch transport so selection changes are measurable is a **proposed backend/analytics change**, not a frontend one. Marked as proposed.

## 16. Related features and components

- `/properties` — `PropertiesList`, primary entry point (§2).
- Homepage developments map — `MapSection` sidebar cards (§2).
- Property detail — `PropertyPageView` / `PropertyFinalCta` (§2).
- `GrowthCorridors` — homepage locality property results, an additional possible entry point; it renders property links to `/properties/{propertyId}` ([`map.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\map.md) §21).
- `SimilarProperties` — adjacent but **not** a comparison; it is one-directional and local-only ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §36, §50).
- `ShortlistShare` — functional precedent for multi-select of API property UUIDs with a visible count and a disabled action at zero; not a shared store.
- `LifeStageMatch` and `LegalDocuments` — the Buyer Fit and verification comparison sources.

## 17. Dependencies

- **Data:** `GET /api/properties`, `GET /api/properties/{id}`, `GET /api/properties/{id}/documents`, `GET /api/properties/{id}/life-stage-fit` — all existing, all through `apiFetch`.
- **Types:** `PropertyListItem`, `ApiProperty`, `ApiPropertyDocument`, `ApiLifeStagePersona`, `ApiLifeStageFit`.
- **Normalization:** `apiPropertyToRecord` in `src/services/propertyMapper.ts` is the existing boundary, but see §18 — it may not be suitable here.
- **State:** browser `localStorage`; no new state library. The project uses React hooks and no external store.
- **Routing:** Next.js App Router; `next/link`; the single root layout.
- **Analytics:** `trackEvent`, plus the delegated `data-track` mechanism (`useClickTracking`).
- **Styling:** Tailwind CSS 4; `PropertyDetail.css` for detail-page conventions.
- **Not required:** MapLibre, geotiff, a comparison table library, a modal library. The project has no component library beyond React and Next built-ins.

## 18. Important constraints

- Do not claim Compare Properties exists. This document is a specification.
- Keep the comparison selection **distinct** from API favourites, the Property Details localStorage Wishlist/Interested flags, and the homepage Shortlist ([`wishlist.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\wishlist.md) §35).
- Do not add a compare endpoint, response field, or event name that is not already confirmed. Mark additions as future requirements or proposals.
- All external requests must go through `apiFetch`; never call raw `fetch` against the API base URL ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §26).
- Property detail/document/life-stage requests require URL-encoded **UUIDs**. Slugs are not interchangeable ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §26).
- Keep `X-Visitor-Code` distinct from bearer auth and from tenant identity. The comparison selection must not require a visitor code (§10).
- Never render a missing value as `0`, and never fabricate a value (§9).
- Never compare values across unestablished units (§9).
- Use `<table>` semantics for the comparison (§14).
- Preserve the single root layout; add no route-specific layout.
- Add no `notFound()`, route-level error boundary, or redirect — none exist ([`routing.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\routing.md) §20, §26).
- Do not prefetch or cache `GET /api/shares/{tracking_token}`; the same caution applies to any future comparison share URL until its read side effects are confirmed.
- Reuse `formatPrice` and existing placeholder copy; do not introduce parallel formatters or a competing "unavailable" string.
- Abort superseded requests; ignore results after abort.
- Preserve the confirmed Tailwind breakpoints and the existing design tokens.

## 19. Known issues and open questions

- **No confirmed comparison API.** The only candidate is the undocumented `explanational-file`; `api.md` records none. Until verified, plan to assemble from existing endpoints.
- **`PropertyListItem` is too thin for a comparison** (§7). Every attribute beyond image, name, type, and price needs a detail request. If that proves too slow, a backend endpoint becomes the real requirement.
- **Maximum is unresolved.** Client maximum of 3 (per the brief) versus the 2–5 range in `explanational-file`.
- **Unit heterogeneity is the highest correctness risk** (§9). `area` and `area_range` are not confirmed to describe the same quantity, and no confirmed unit field exists on `ApiProperty`.
- **N+1 request shape.** Three properties means up to nine requests if documents and Buyer Fit are included. Bounded and acceptable, but it must be concurrent and abortable.
- **`ApiPropertyToRecord` may be the wrong tool here.** It normalizes into `PropertyRecord`, which is static-oriented and supplies placeholders and shared defaults ([`api.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\architecture\api.md) §25, [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §50). A comparison must show API values as recorded, including `null`, so it should likely read `ApiProperty` directly and format for display itself — accepting some duplication of `formatPrice`-adjacent logic. **Recommendation:** read `ApiProperty` directly; do not route comparison data through `apiPropertyToRecord`, because its placeholders would be indistinguishable from real API values in a comparison table.
- **Shared-state mechanism is new.** Three components must agree on one selection; nothing like this exists today, and the project's history is of *not* sharing state across these surfaces.
- **Cross-component tray placement is unresolved** (§11).
- **Selection scope is unresolved** for local static properties, which have slugs rather than UUIDs (§6).
- **"Best value" highlighting is unresolved** and risks implying meaning on qualitative rows (§9).
- **No URL encoding means no shareable comparison** (§3); adding it breaks the documented "no query state" convention.
- **Analytics for selection changes is unavailable** through the current transport (§15).

## 20. Unknowns requiring verification

- Whether a backend comparison endpoint exists, and its exact request and response shape. `UNKNOWN — needs verification`
- The backend's permitted comparison size (2, 3, or 5 ids). `UNKNOWN — needs verification`
- Whether `GET /api/properties/compare` and `/api/favorites/compare` resolve the tenant the same way as other endpoints, and whether the favorites routes require cookie credentials under CORS. `UNKNOWN — needs verification`
- Whether `ApiProperty.area` (treated as acres) and `PropertyListItem.area_range` (treated as square yards) describe the same quantity, and whether any unit metadata is returned. `UNKNOWN — needs verification`
- Whether `area_sqft` is available on the property responses, and therefore whether price per square foot is ever calculable client-side. `UNKNOWN — needs verification`
- The complete `ApiProperty` schema beyond the typed subset. `UNKNOWN — needs verification` per [`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §50
- Backend behavior when a previously available property is deleted or deactivated. `UNKNOWN — needs verification`
- Whether `COMPARE_ADD` / `COMPARE_REMOVE` can be enabled in the batch transport. `UNKNOWN — needs verification`
- Whether the project accepts a URL-encoded selection at `/compare`, given the documented "no page route uses query parameters" convention. `UNKNOWN — needs verification` as a product decision
- Whether a fixed comparison tray interacts acceptably with `Navbar`'s local mobile-menu state. `UNKNOWN — needs verification`
- Whether sticky-column behavior on mobile is acceptable to assistive technology. `UNKNOWN — needs verification`
- Which entry points ship in the first increment. `UNKNOWN — needs verification`
- No automated test coverage is confirmed for any of the relevant surfaces. `UNKNOWN — needs verification`

---

**Documentation task only.** No application code was created, modified, or removed for this document. The only file created by this task is `docs/features/compare-properties.md`. Unrelated existing working-tree changes must be preserved.