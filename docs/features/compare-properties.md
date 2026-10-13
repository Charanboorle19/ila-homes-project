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

- **Loading** — the comparison view's initial state, mirroring the `Loading property…` / `Loading properties…` wording already in use ([`property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) §43, [`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §23). `role="status"` as the catalogue uses, with the shared `ila-loader ila-loader--sm` animation beside the text ([`loading.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\loading.md)).
- **Empty — nothing selected** — the primary state on a cold visit to `/compare`. Must state how to add properties and link to `/properties`. This is the most likely first impression of the route.
- **Empty — one selected** — below the minimum; explain how many more are needed.
- **Empty — a selection that cannot be resolved** — all stored ids unavailable; clear the stale selection and fall back to the empty state (§10).
- **Partial** — render the resolvable columns and drop the rest (§10).
- **Error** — a failed comparison request must surface a message with a retry affordance, following the catalogue's pattern of an explanatory message rather than a silent empty table. Exact copy is `UNKNOWN — needs verification`; the documented precedents are `Properties are unavailable right now. Please try again shortly.` ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §24) and `Developments could not be loaded. Try again shortly.` ([`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §23).

## 13. Responsive design (proposed)

Follow the existing Tailwind breakpoints: base, `sm` (`640px`), `md` (`768px`), `lg` (`1024px`) — the set used by the catalogue ([`property-list.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-list.md) §34) and the map ([`search.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\search.md) §34).

- **Desktop (`lg` and above / 1024px+)** — **Two-Column Grid running edge to edge**. Neither column carries an outer gutter: the picker is flush left and bottom, the results card flush right and top and bottom.
  ```
  0px                                                   viewport edge
  ┌──────────────────────────────────────────────────────────┐  ↑
  │ eyebrow / heading / intro │  │  results card            │  │
  │         (row 1)          │  │  (row 1 / row 2 span)    │  │
  ├─────────────────────────┤  │                          │  │
  │ property picker          │  │                          │  │
  │         (row 2)          │  │                          │  ↓
  └─────────────────────────┴──┴──────────────────────────┘
  ```
  - **The section is the grid.** `lg:grid lg:h-[104dvh] lg:grid-cols-[480px_minmax(0,1fr)] xl:grid-cols-[500px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-0 lg:gap-y-5 lg:overflow-hidden`. Row 1 is the heading's natural height; row 2 takes the remainder.
  - **Left column widened to `480px` / `500px`** from `440px` / `460px`. The picker carries two 180px tiles per row; at 440px those came to 194px — tall and narrow, with most development names wrapping to two lines. The extra 40px takes them to 218px. Nothing in the results column moves: its `w-64` cells and `w-52` label column are fixed, so the table's geometry is untouched and the extra width comes entirely out of the results column.
  - **`lg:gap-x-0` — the columns touch.** The picker's `border-r` is the seam, and the dark table starts the instant the white panel ends. A column gap here would break the single uninterrupted surface the edge-to-edge layout is for.
  - **No outer gutters.** Neither column has `lg:px-*`, and neither has `lg:pb-*`; the results column has no `lg:pt-*` either. Type is held off the viewport edges by the panels' own internal padding — `px-4` on the picker list, `px-5` on the heading, `px-4` on the table cells — not by a wrapper inset.
  - **Heading and sub-heading in the left column**, at `lg:col-start-1 lg:row-start-1` with `lg:px-5 lg:pt-5 lg:pb-0`. They previously spanned the full width above both columns, which cost the results table roughly 150px of height for no reason. `lg:pb-0` hands the space below to the section's `lg:gap-y-5` so the gap is not doubled.
  - **Heading type retuned for the column measure.** `lg:text-[24px] lg:leading-[1.15]` on the `h2` (was `lg:text-[2rem]`) and `lg:text-[13px] lg:leading-[1.55]` on the intro (was `lg:text-[16px]`). At 32px the sentence ran to three lines in the available width and pushed the picker down. The mobile steps are unchanged; this is the `lg` pass.
  - **Results column spans both rows** — `lg:col-start-2 lg:row-start-1 lg:row-span-2` — so the table starts level with the heading and runs to the section's bottom edge. Nothing sits above it.
  - **Both columns keep their own vertical scroll**: the picker through its `overflow-y-auto` list, the results card through its table's `overflow-auto` wrapper.
  - **No rounded corners on either panel, and no shadow.** A panel that runs to the viewport edge cannot round: the `#eceef2` section surface shows through the corner and the card reads as clipped rather than deliberate. Both desktop panels are square; the picker's `border-r` and the dark surface itself carry the definition. The **loading, idle and error status cards** lost their `rounded-2xl` and `shadow-sm` on the same grounds, and the **ready card** also lost its `border` — the dark surface is the edge. Mobile and tablet cards keep their rounding; they are inset, not flush.
  - **Picker header compacted to one row.** The `Available Properties` `h3` and the `Select 2 to 5 developments below…` paragraph are deleted: the section heading directly above already carries that copy, and in this column two stacked headings plus a paragraph cost a whole tile row. Only the `N total` count survives, because it is the one thing the section heading does not say.
  - **Picker footer is flush.** `shrink-0 border-t border-black/10 p-4` — no `mt-*`, no `pt-*`. The list above takes the slack, so the action never drifts as the selection changes.
  - **`lg:contents` bridges the markup to the grid.** The block wrapper and the old desktop grid are both `lg:contents`, which drops their boxes so the two panels become direct grid items and can each take a cell. Below `lg` they are ordinary blocks and the mobile/tablet flow is unchanged.
  - **`content-slot` moved onto the panels themselves.** `.content-slot` is `position: relative; z-index: 1`, which keeps the panels above the `.compare-plots-bg` dot layer. `display: contents` discards a box's own positioning, so the two wrapper elements no longer supply it and each panel now carries the class.
  - **`min-h-0` is load-bearing at every level.** A flex or grid item defaults to `min-height: auto`, which floors it at its content height; without `min-h-0` on both columns, the picker, the results block and the ready card, their contents push past the section and `overflow-hidden` clips them. The property list and the table wrapper already carried it.
  - **Section height is `104dvh`, not `100dvh`.** **The trade is a short page scroll at `lg`** — return to `lg:h-[100dvh]` to remove it. `dvh` rather than `vh` either way, so the browser's own chrome is not counted.
  - **`overflow-hidden` at `lg` only.** Safe on the desktop branch because nothing there is sticky against an ancestor scrollport — the metric label column sticks against the table's own `overflow-auto` wrapper, which sits between it and the section. The mobile branch, whose sticky Compare row *does* resolve against this section, keeps `overflow-x-clip`.
  - **Status card floors lowered** to `min-h-[360px]` (loading, idle) and `min-h-[280px]` (error), from `min-h-[580px]` / `min-h-[360px]`. The old floors were taller than the space a short desktop viewport leaves for the panels and would have been clipped.
  - **Left Block (Properties Selector)**: Dedicated selection panel (`lg:w-[480px] xl:w-[500px]`) containing the available developments in a 2-column scrollable grid (custom slim scrollbar `ila-search-scroll`), property cards with cover image, dark gradient scrim, type tags, selection order indicators (1 to 5), selection counter, "Clear all" button, and prominent "Compare now" CTA button. The card is `flex h-full min-h-0 flex-col` and the grid is `min-h-0 flex-1` with `content-start`, so it absorbs the row height instead of carrying a `max-h`.
  - **Right Block (Results & Intelligence)**:
    - **Ready State**: A **single dark surface** — `#141519`, square, flush right/top/bottom — with the title, copy-link control and category filter pills (`All metrics`, `Overview`, `Location & connectivity`, `Inventory & approvals`, `Growth & running cost`) as a hairline-separated header band on that same surface, then the side-by-side comparison table below it. The table has a sticky left metric label column (`w-52 sticky left-0`), property columns with "Best match" / "Pinned" micro-labels, winning values in gold text with no badge, visual score bars for 0–100 metrics, RERA verification indicators, and one gold "Enquire" CTA per column on the same track as the columns. There are no thumbnails and no header price line — the header carries only the micro-label, the name and the locality, and price is already a row in the table.
    - **Idle / Loading / Error States — blueprint background**: see below.

### The results panel's blueprint background

While **no comparison is on screen** — `idle`, `loading` or `error` — the right column is backed by the blueprint tile in `.compare-results-bg` (`globals.css`), a conditional `absolute inset-0` layer gated on `compareStatus !== "ready"`. Once a comparison exists the ready state paints an opaque `#141519` surface over the whole column, so the pattern would be invisible anyway and rendering it would cost a full-panel gradient stack for nothing.

The source pattern, retinted to this section:

| Source | Here | Why |
|---|---|---|
| `background-color: #E5E5F7` | `#eceef2` | The section surface. This panel sits directly on it, so a different fill would read as a faint rectangle inside a larger one. |
| `#444CF7` line work | `#c9a84c` | The section's own gold. The blue is not in this palette, and a blue grid behind gold-accented copy reads as a second accent. |
| `#444CF755` (alpha `0x55`) | `#c9a84c33` (alpha `0x33`) | Same retint, with the alpha reduced to match the lower opacity below. |
| `opacity: 0.8` | **`0.35`** | The source is sized for a hero panel with no copy over it. Here the idle copy, the four feature cards and the loading text all sit on top, so the pattern has to stay a texture behind them. Same reasoning as the drop to `0.16` on the dark Find Your Plot surface and the `0.4` on `.growth-corridors-bg` — matched to the surface, not carried across sections. |

**The fill appears twice and must stay equal to `background-color`.** It is both the `background-color` *and* the stop inside every gradient, because the gradients paint over the fill rather than being composited with it. Changing one without the other leaves a second, misaligned copy of the pattern painted on top — the same constraint `.growth-corridors-bg` documents.

**The status cards are transparent and sit above it.** Each carries `relative z-10`. An absolutely positioned box paints *after* in-flow content, so without `z-10` the pattern would cover the copy rather than sit behind it. Their backgrounds went to `bg-transparent` (idle and loading) and `bg-rose-50/40` (error, reduced from `/60`) — an opaque card would hide the very pattern the panel is showing.

### The idle state's four capability cards

Four cards naming what a comparison will cover, below the idle copy and above the CTA. They were four hand-written `<div>`s; they are now rendered from one module-level `FEATURE_HINTS` array, so the tile, the type scale and the border can only be defined once. Written out separately, the four had already drifted apart.

**The icon is a tile, not a glyph inside the title.** The original was `💰 Pricing & Rates` on one line, which put the glyph on the text baseline: it rendered at the 12px bold weight, sat optically low against the cap height, and made all four titles begin at a different `x` depending on how wide each glyph happened to be. An `h-8 w-8` tile puts every title on the same line and rhymes with the `rounded-2xl bg-[#c9a84c]/15` `CompareIcon` tile directly above it.

| Element | Specification |
|---|---|
| Grid | `mt-6 grid w-full max-w-xl grid-cols-2 gap-2.5 text-left` |
| Card | `flex items-start gap-2.5 rounded-xl border border-black/10 bg-white/80 p-3 shadow-xs` |
| Icon tile | `h-8 w-8 shrink-0 rounded-lg border border-[#c9a84c]/25 bg-[#c9a84c]/15 text-[#8a6a12]` |
| Icon glyph | `h-[18px] w-[18px]`, `currentColor` |
| Title | `text-[12px] leading-tight font-bold text-[#0f1114]` |
| Body | `mt-1 line-clamp-2 text-[11px] leading-[1.4] text-[#5b6270]` |

**The icons are hand-drawn line glyphs, not emoji.** These were `💰 📍 🏛️ 📈` and they had three faults on this surface:

1. **Emoji are rendered by the platform, not by us.** They cannot be sized or aligned to the tile — the same glyph lands at a different optical size and baseline across Windows, macOS, Android and iOS, which is why the original row looked ragged.
2. **Emoji present at full colour** beside a single-hue palette read as clip-art rather than as part of the drawing.
3. **Two of the four were near-duplicates.** `📍` and `🏛️` are both "a landmark you point at", so half the row said the same thing.

The replacements are `TagIcon`, `PinIcon`, `ShieldCheckIcon` and `TrendIcon` — components defined next to `ArrowIcon`, `CloseIcon`, `PlusIcon` and `CompareIcon`, on the same `24` viewBox with `fill="none"`, `stroke="currentColor"`, `strokeWidth="1.8"` and round caps and joins, so they sit at the same optical weight as the rest of the file and scale from `className` alone. Each is `aria-hidden` individually rather than through a wrapper, matching the other glyphs.

| Card | Was | Now | Why |
|---|---|---|---|
| Pricing & Rates | `💰` | `TagIcon` — a price tag | A money bag is generic; a tag is the shape a rate is quoted on |
| Connectivity Score | `📍` | `PinIcon` — a map pin with a centre ring | Now purely *proximity*, which is what the ORR/metro/schools copy measures |
| Approvals & Legal | `🏛️` | `ShieldCheckIcon` — a shield with a tick inside | The tick is what makes it "verified" rather than merely "protective" — which is the claim the RERA copy makes. Also no longer duplicates the pin |
| Est. Growth & Fit | `📈` | `TrendIcon` — a rising line under an arrow head | Same meaning as the emoji, but now in the file's stroke weight |

**`FEATURE_HINTS.icon` holds a component, typed as `ComponentType<{ className?: string }>`.** The array is declared after the four icons so the component values are in scope.

**`h-[18px]` inside an `h-8 w-8` tile.** 16px reads thin against a 32px box; 20px crowds the border. 18px is roughly what the 15px emoji was contributing, so the tile reads at the same density it did before — the change is in *what* the glyph is, not in how loud it is. The tile sets no font size, because the icon is an SVG sized purely by `className` and coloured by `currentColor` — neither a platform font nor an emoji presentation applies.

**The gold is a wash, not the solid accent.** `bg-[#c9a84c]/15` is the same tile treatment the `CompareIcon` above already uses, so the five read as a set. Four *solid* gold tiles would spend the section's only accent on decoration and compete with **Run Comparison**, the one gold element in this state that is an action.

**`items-start`, and `mt-1` under the title.** With `items-center` the tile would drift lower on the cards whose body wraps to two lines and sit high on the ones whose body does not — the four would not agree. Top-aligned, the tile stays put and a two-line body simply hangs off its title.

**`line-clamp-2` bounds the height, and that is load-bearing.** The idle card lives in a `min-h-[360px] flex-1` box inside a section capped at `104dvh`. Four cards each running to three lines would push the copy under the CTA and the section's `lg:overflow-hidden` would clip it.

**`max-w-xl`, up from `max-w-lg`.** The results column is 544px at `lg` with 32px of padding, so the old 512px cap was already inert there; at `xl` the wider cap buys the cards enough measure that most bodies fit two lines instead of three.

The `bg-white/80` is unchanged and still required: it is what keeps these reading as cards sitting *over* the blueprint tile rather than dissolving into it.
- **Mobile & Tablet (below `lg` / <1024px)**:
  - **Mobile (below `sm`)**: Dedicated full-screen **Comparison Results Dialog**:
    - **Launcher Card**: When comparison is generated, a high-contrast card (`bg-[#16181d]`, gold border) replaces the inline table on mobile, with a top match summary and an "Open comparison table" button.
    - **Dialog**: `fixed inset-0`, square and flush on all four edges, with no backdrop and no drag handle. See below.
    - **Header band**: Title, "Comparing N developments · Top match: …" line, a 44px close button, and the category pills.
    - **Category Filter Pills**: Fast category switcher (`All metrics`, `Overview`, `Location & connectivity`, `Inventory & approvals`, `Growth & running cost`), in a full-bleed horizontal strip.
    - **Comparison table**: The **same table the desktop card renders** — sticky metric caption column, one column per property, `Best match` / `Pinned` micro-labels, gold winning values, score bars, RERA ticks, a data-availability row, and one Enquire CTA per column. Columns are **sized to their own content**, so a value like `3` or `₹85 L` occupies a narrow cell instead of a 335px one, and the table only scrolls sideways when it genuinely overflows.
    - **Share bar**: Full-width "Copy shareable comparison link" with an inline clipboard confirmation, mounted only when the backend returned a `share_url`.
  - **Tablet (`sm` to `lg`)**: Inline comparison table below the property carousel.

### One left gutter on mobile: 20px

Below `sm` every piece of content **in the page flow** starts at **x = 20px** (`px-5`).

| Element | Specification |
|---|---|
| Heading block | `px-5` → 20px |
| Selection card | `px-5` → 20px |
| Property tiles | `-mr-5 pr-5` right bleed |
| Action row | `px-5` sticky on mobile |
| Results launcher | `px-5` rounded card |
| Comparison dialog | **exempt** — see below |

**The comparison dialog is exempt because it is not in the page flow.** It is `fixed inset-0`, flush to both viewport edges with no outer gutter at all, exactly as the desktop card is flush to the right edge of the section. A 20px inset on a full-bleed dialog would frame it as a card sitting inside a screen, which is what the old bottom sheet already looked like and is not what a full-screen surface should look like.

Its spacing is per block instead, and deliberately so:

| Block | Specification |
|---|---|
| Header band | `px-4` → 16px |
| Category pill strip | `-mx-4 px-4` → bleeds to both edges, content starts on the header's 16px line |
| Table caption column | `w-[116px]` with `px-3` → caption text starts at 12px |
| Table value cells | `px-3` → value text starts at 12px, same line as the captions |
| Table property columns | `max-content`, capped by `max-w-[220px]` on the header cell — content-sized, not gutter-driven |
| Share bar | `px-4` → 16px |

The header's 16px and the table's 12px are close enough to read as one alignment group rather than as two unrelated indents — the old sheet had a 20px header, a 16px scroller and a 16px card all disagreeing.

### Background: a dot grid

```html
<section class="relative overflow-x-clip bg-[#eceef2] lg:grid lg:gap-x-0 …">
  <div aria-hidden class="compare-plots-bg pointer-events-none absolute inset-0 z-0" />
  <div class="content-slot lg:col-start-1 lg:row-start-1">…heading…</div>
  <div class="content-slot lg:col-start-1 lg:row-start-2">…picker…</div>
  <div class="content-slot lg:col-start-2 lg:row-span-2">…results…</div>
</section>
```

`.compare-plots-bg` lives in `globals.css` with a 0.8px dot on a `25px 10px` tile. At `lg` the two panels run over it edge to edge and cover most of it; what remains visible is the sliver above the heading and the gutter between the columns is zero, so the pattern reads mainly on mobile. The right column's own blueprint tile, `.compare-results-bg`, is a separate layer described below and is only mounted when no comparison is on screen.

### Mobile Comparison Dialog & Results Block

When `runComparison()` completes, `mobileModalOpen` is automatically set to `true` on any viewport under 1024px. When closed, the mobile view keeps a launcher card that re-opens it at any time.

#### 0. The launcher card — what a closed dialog leaves behind

Below `sm` the table is not in the page flow at all; it lives in the dialog. So when the dialog is closed there is nothing on the page showing that a comparison exists, and the launcher card is the whole mobile result surface until it is re-opened.

`mt-6 block sm:hidden` on a `rounded-2xl border border-[#c9a84c]/30 bg-[#16181d] p-5` card. `p-5` matches the section's own 20px mobile gutter, so its content edge is the same line as the heading, the property carousel and the Compare button above it.

| Element | Treatment |
|---|---|
| Badge row | `items-center` — badge left, `N developments` right at 12px `shrink-0`, so a long name in the match row below cannot push the count around |
| State badge | Pulsing gold dot + `Comparison ready`, 11px, `rounded-full border border-[#c9a84c]/30 bg-[#c9a84c]/10` |
| Heading | `text-[18px] leading-[1.25]`, `Side-by-side comparison is ready` |
| Body | `text-[13px] leading-relaxed text-white/70` — names what the table holds: one row per metric, one column per development. It no longer promises a sideways swipe, which only applies when the columns overflow |
| Top match row | `mt-4`, `rounded-xl border border-white/10 bg-white/5 p-3`: `Top overall match` micro-label in gold, name truncated at 13px, `View` link at `min-h-9 shrink-0` |
| CTA | `mt-4 min-h-12` full-width gold, `Open comparison table` |

Two changes from the previous card. The CTA is `min-h-12` (48px) rather than a 32px label-height bar, and it says **"table"** rather than "Popup" — the destination is a full-screen dialog with nothing behind it to pop over, and calling it a popup described a pattern the component no longer implements.

#### Full screen, square, and without a backdrop

`fixed inset-0 z-[100] flex flex-col bg-[#141519] text-white lg:hidden`. Square, flush top, bottom, left and right.

It was a 94vh bottom sheet: `justify-end` on the wrapper, `h-[94vh] max-h-[94vh]` with `rounded-t-[26px]`, a `border-t border-white/15` reading as a lid, and a `bg-black/75 backdrop-blur-sm` button filling the space above it. A full-screen dialog has no sheet to peek over, so **all of that is gone** — including the backdrop button. An opaque surface covering the whole viewport has nothing behind it to tap to dismiss; the close button and `Escape` are the ways out, and keeping a full-viewport backdrop button under an opaque panel would have left a dead 75%-black layer in the tree doing nothing.

There is no drag handle either, for the same reason: it was a bottom-sheet affordance and there is no edge to drag from.

#### 1. Header band — `shrink-0`

`px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3` on `bg-[#17191e]`.

- **Title** `text-[18px] leading-[1.25] font-bold tracking-tight text-white`.
- **Sub-line** `text-[12px] leading-snug`: `Comparing N developments · Top match: {name}`, in the same colours as the desktop card's header (`#8a909e`, `#e8e6e1` for the count, `#c9a84c` for the name).
- **Close button** `h-11 w-11` — **44px, up from the sheet's 32px.** With the drag handle gone this is the only visible dismissal on the surface, so it has to be a real touch target. `rounded-full border border-white/12 bg-white/8`, `aria-label="Close comparison"`.
- The text column carries `min-w-0` so a long top-match name wraps inside its own line instead of pushing the close button off the band.

**Safe-area top inset, with a floor.** `calc(env(safe-area-inset-top) + 0.75rem)`, not a bare `env()`. The root layout sets no `viewport-fit=cover`, so `env(safe-area-inset-top)` resolves to `0px` in every current browser and a bare inset would leave the title flush against the screen edge. The `calc` guarantees 12px and adds the inset where it *is* honoured — the same shape `MapSection`'s sheet uses for its bottom inset. This is the only element on the surface that reaches the status bar, which is why the inset moved here when the dialog became full-screen.

#### 2. Category pill strip — full-bleed, snapping

`-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-none`.

`-mx-4 px-4` bleeds the strip to both edges of the header while its pills still start on the header's own 16px line — the same treatment the property carousel gets from `-mr-5 pr-5`, and the reason the strip can scroll without the pills appearing to detach from the band.

`snap-x` **without** `snap-mandatory`. Proximity lets a pill settle between two stops, which matters when a category label is wider than half the viewport; mandatory would fight a slow drag.

Pills are `min-h-9` (36px) at 12px. The 44px minimum is reserved for the close control, the per-column Enquire buttons and the share button — the actions, not the filters.

#### 3. The comparison table

**The same object the desktop card renders.** Sticky metric caption column, one column per property, `Best match` / `Pinned` micro-labels, gold winning values with no badge, score bars, RERA ticks, the data-availability row, and one Enquire CTA per column — all off the same `visibleRows`, `availability`, `showAvailability`, `formatValue`, `SCORE_METRICS` and `bestMatchId` the desktop table uses. A phone and a desktop are reading one comparison, not two renderings of it.

Removed with the card layout, because the table carries their content: the property-thumbnail carousel and its per-property "View property details" links, and the grouped metric cards with their `★ {first word}` winner tags. The columns carry the identity instead — micro-label, name, locality, the price row and the Enquire CTA.

**Geometry.**

| Element | Specification |
|---|---|
| Scrollport | `ila-search-scroll min-h-0 flex-1 overflow-auto overscroll-contain scroll-pl-[116px] snap-x` |
| Column track | `grid w-max`, with `gridTemplateColumns: 116px repeat(N, minmax(0, max-content))` set inline from `compared.length` |
| Caption column | `w-[116px] sticky left-0` — `w-52` on desktop, but it has to share the row with a phone-width value column |
| Property column | `minmax(0, max-content)` — **content-sized**, bounded by `max-w-[220px]` on the header cell |
| Cell padding | `px-3` |
| Row floor | `min-h-[56px]` on the caption and the value cells, matching the desktop row |

**One grid, not a stack of flex rows.** Every cell belongs to a single `w-max grid` whose tracks are declared once. That is what keeps a value in row 12 in the same column as the value in row 3 — a per-row `flex` container with content-sized children would size each row independently and the columns would visibly disagree from row to row. Because a grid row has no element of its own, each row is emitted as a `Fragment`, and `border-b` / `min-h-[56px]` move onto the cells.

**The property tracks are `minmax(0, max-content)` — a column is exactly as wide as its widest cell needs.** They were `w-[86vw]`, which on a 390px phone is **335px to hold a value like `3` or `₹85 L`**: over 300px of empty cell to the right of every number, with the property name in the header the only thing that ever used the width. `max-content` measures the real content instead — the longest name, the longest formatted value, the score bar's own cap.

Three guards keep a single long string from setting the width for every row under it:

| Guard | On | Why |
|---|---|---|
| `max-w-[220px]` | **every property cell** — header, values, availability | `max-width` clamps a cell's max-content contribution. It is the single bound that stops one long string from widening its column: a long name, a `line-clamp-2` locality (whose max-content is its whole string), a full property name in the availability row. The CTA cell needs no bound — its label is `Enquire` |
| `break-words` | property name, locality, availability name | `line-clamp-2` clips an overlong word rather than wrapping it, so a name with no spaces would otherwise be cut mid-word |
| `max-w-[120px]` | score bar | Down from the desktop's 180px. A 3px bar has no business setting a content-sized column's width |

**Text wraps to a second line rather than being clipped.** Nothing in this table carries `truncate` — not a value, not a locality, not a name. When a content-sized column is too narrow for what it holds, the line wraps and the row grows taller instead:

| Element | Clamp |
|---|---|
| Property name (header) | `line-clamp-2 break-words` |
| Locality (header) | `line-clamp-2 break-words` |
| Availability property name | `line-clamp-2 break-words` |
| Missing-field list | `line-clamp-2` |
| Value | no clamp — wraps freely |
| Metric caption | no clamp — the caption column is a fixed 116px and wraps as far as it needs |

The locality and the availability name were the two that ellipsised. Both routinely outrun a content-sized column, and an ellipsis loses the half a visitor actually reads — "Shadnagar, Hyd…" — where a second line keeps all of it. The availability cell also became `flex-col` rather than `justify-between`, so when its name takes a second line the count moves under it instead of being squeezed into a one-digit-per-line column.

**The CTA label is `Enquire`, not `Enquire on {name}`.** Desktop can afford the long form because its column is a fixed `w-64`. Here the column is `max-content`, and a `truncate`d label is `white-space: nowrap`, so its max-content is the full string — every column would be sized by its CTA rather than by its data. The property name is directly above in the header, and `aria-label="Enquire on {name}"` carries the full phrasing for a screen reader.

**What was given up: the old "one property per swipe" guarantee.** At content width, two or three columns frequently fit a phone outright, and a table that fits needs no scrolling — which is the correct outcome, not a regression. Where the table still overflows (long names, five properties) the horizontal scroll and the snapping behave exactly as before. The earlier `86vw` sizing existed to *force* an overflow so a swipe was always available; that is no longer the goal, because the column no longer has empty space to swipe through.

**`scroll-pl-[116px]` is what makes the sideways scroll land correctly.** Snapping a value cell with `snap-start` parks its left edge on the scrollport's left edge — which is *underneath* the sticky caption column, hiding the first 116px of every value. Scroll padding reserves exactly that column, so a snapped cell stops flush against the caption column instead of under it. The caption cell itself carries **no** `snap-start`, so the position that would hide the first property is not a stop the browser aims for; proximity snapping still lets the visitor rest anywhere.

**`overscroll-contain`** because the dialog is `fixed` over a page that is still in the scroll tree. Without it, a fling reaching either end of the table scrolls the section behind, which reads as the dialog itself jumping.

**`.ila-search-scroll`** rather than a bare overflow: the gold scrollbar is the only affordance saying there is more table to the right, and it is the same one the desktop card's scrollport uses, so the two surfaces scroll the same way.

**No group headers.** The dialog renders `visibleRows`, the same flattened list as the desktop and tablet tables, so all three read identically. `groupedMetrics` still drives the category pills and `bestMatchId`; only the visible band is gone.

#### 4. Share bar

`shrink-0 border-t border-white/10 bg-[#17191e] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`, full-width `min-h-11` button reading `Copy shareable comparison link`.

**Rendered only when the backend returned a `share_url`.** Otherwise it would be a strip of `#17191e` pinned under the table with no content in it, which on a full-screen dialog reads as a broken layout rather than as an absent feature.

**The label is the confirmation.** The button owns `copiedShare`, so `Link copied` lands where the tap was. A toast would have needed a timer, an icon and its own stacking context.

**There is no separate Enquire bar.** The gold CTA is the per-column button inside the table's own footer row, which travels with its property exactly as the desktop card's does — the same action available for all five properties, rather than one best-match-only shortcut duplicating a column that is already on screen.

#### `overflow-x-clip`, not `overflow-hidden`

On the desktop results card and on the section below `lg`. `overflow: hidden` creates a scroll container, and every sticky layer above resolves against its nearest scrollport — so under `hidden` the pinned captions would have had nothing to resolve against and would not have moved. `clip` is not a scroll container.

On the desktop card this is no longer doing any rounding — the panel is square. It is retained purely to stop the table's scrollport painting past the surface. On the section it is retained for the mobile branch, whose sticky Compare row resolves against it.

#### Group bars — removed from all three tables

The desktop, tablet and mobile-dialog tables render **rows only**: a metric caption and its values, with no group band. `Overview`, `Location & connectivity`, `Inventory & approvals` and `Growth & running cost` no longer appear inside any of them.

The grouping is still computed. `groupedMetrics` groups by `MetricSpec.group` in canonical order, `filteredGroups` filters that by the active category pill, and `bestMatchId` tallies `best_property_id` across every row. All three render `filteredGroups.flatMap(({ rows }) => rows)`, which flattens the groups away while keeping the canonical group order and the backend order inside each group — so removing the visible heading changed no ordering and no filtering.

The mobile dialog used to keep its own category section headers over the metric cards. Those cards are gone, and with them the headers: the dialog is a table now, and a group band inside a table is exactly the bar the other two tables had already dropped. The category pills are the only group-level control, on all three surfaces.

### Adaptive height — filling the card from the data

The results card is `flex-1` inside a column that spans both grid rows, so it fills the section's height rather than whatever the heading and the picker left over. A comparison that returns few metrics — or a category pill that narrows the table to three or four rows — would still leave a large area of bare `#141519` below the last row. Three layers now absorb it, and between them there is no case where the card shows dead surface:

| Layer | Classes | What it does |
|---|---|---|
| Scrollport | `flex min-h-0 flex-1 flex-col overflow-auto` | Takes all height left by the header and footer bands, and **is** the results panel's vertical scroll. `overflow-auto`, not `overflow-x-auto`, because the rows both grow and scroll. |
| Metric rows | `flex-1 min-h-[56px] max-h-[92px]` | Spread into the spare height. Floor at 56px, ceiling at 92px. A long table floors and scrolls; a short one breathes. |
| Availability row | `flex-1 min-h-[64px] max-h-[160px]` | Takes whatever the metric rows could not use. |
| CTA footer | `shrink-0` | Pinned to the card floor, so the bottom edge does not move as the row count changes. |

`min-w-max` on the inner column keeps every row on one shared `w-52` + `w-64` track, which is what the sticky label column and the per-property cells rely on.

The picker matches this: its card is `flex h-full min-h-0 flex-col` and its list is `min-h-0 flex-1 overflow-y-auto`, so it is the left column's vertical scroll. Both columns scroll independently and neither grows the section.

**Why no dead space remains.** With 9+ rows the rows alone fill the height (`n × 56px` floors below the available height, and `flex-1` grows them back up to the 92px ceiling). With 8 rows or fewer, `showAvailability` is always true, so the availability row is present and shares the remainder. With zero rows — a pill landing on a group the backend returned nothing for — a full-width `flex-1` line reads `No metrics were returned for this category.`

**Bounded by the section.** The "spare height" this fills is only the section's: it is capped at `104dvh` and the scrollport scrolls once the rows plus the header and footer bands exceed it. The rows never grow the card past the fold — they only distribute height that is already available.

### The availability row

A table row like any other, on the same `w-52` + `w-64` track, so it reads as part of the table rather than a footer bolted under it. Caption cell: **`Data availability`**. One cell per property, each carrying the property name, an `available/total` count, a proportion bar, and either the list of absent field labels or `Every metric returned a value`.

It renders when **either** trigger fires:

1. any compared property is missing a value on a visible row, or
2. `visibleRows.length <= AVAILABILITY_ROW_THRESHOLD` (8) — roughly where stretching the rows alone stops covering the card.

With a full table and no gaps there is nothing to explain, so the row stays out of the way rather than padding the card with "all available".

**What it reports.** Nothing is substituted for a missing value and no score is inferred from a partial row. The count is a tally over `visibleRows` — not over `result.metrics` — so narrowing the category pills narrows the table and the denominator together, and the two can never disagree. A value counts as available only when it is neither `null`, `undefined` nor an empty string, the same test the table cell uses.

**The bar is `#8a8f98`, not gold.** Unlike the score bars, which mark a row winner, this marks a data gap, and gold is reserved for the former. Both terms of the proportion are counted integers from the rows directly above, so unlike a bar against an invented maximum the proportion is exact.

#### The retired group bars

`bg-[#1b1d22]` with `text-[#c9a84c]`.

`#1b1d22` is a half-step off the `#141519` table surface, so the groups read as bands within the card rather than as headings floating over it. The gold is the same `#c9a84c` used for best values and the CTA — one accent, three jobs, which is why the section only reads as having one highlight colour.

Two earlier attempts are worth recording: `bg-[#0f1114]` was the darkest element in the entire light section, and `#fbf1da`/`#7a5c28` was correct for the light table but wrong here — a cream bar on a near-black card is a light source, not a label.

#### Dark surface

| Role | Value |
|---|---|
| Table card | `#141519` — square, no border, no shadow, flush right/top/bottom |
| Group band | `#1b1d22` — retired, no longer rendered in either table |
| Hairline rule / cell divider | `rgba(242,240,234,0.08)` |
| Card border | `rgba(242,240,234,0.12)` — retired everywhere. The desktop card has no border because the dark surface is the edge; the mobile dialog has none either, because a full-screen surface cannot have a border |
| Property name | `#f2f0ea` |
| Value | `#e8e6e1` |
| Metric caption, locality | `#8a909e` |
| Value, missing | `#6b7280` |
| Best value, group bar, CTA | `#c9a84c` |
| CTA ink | `#0f1114` |

**Gold is reserved.** It appears only on the winning value in a row, the best-match header label, the score bars for a winning score, the RERA tick, and the footer CTA. Any one of those uses is a claim about the data; using it for anything decorative would spend the accent. The availability bar is the clearest case — it reports a data gap, not a winner, so it takes `#8a8f98`.

The best value also gets `bg-[rgba(201,168,76,0.05)]` on its cell and the best-match column `bg-[rgba(201,168,76,0.08)]`. Both are far below the 4.5:1 contrast floor as a *text* background — they are behind 15px bold text, so they are decoration on top of the `#141519` card, not the surface the text is read against.

#### Header micro-labels

Each property column carries a 10px uppercase label: **`Best match`** in gold, **`Pinned`** in grey.

`bestMatchId` is computed by **tallying `best_property_id` across every row**, not by comparing a price or a score. This means the label describes what the table itself highlights rather than a metric picked separately — a property that wins nothing simply falls through to "Pinned", which is the honest outcome rather than a wrong claim.

Below it: the property name at 15px bold, then `metrics.locality ?? metrics.location` at 12px in `#8a909e`, omitted entirely when the backend returned neither.

#### Score bars

Only `connectivity_score` and `estimated_appreciation` get a 3px bar under the number, in `SCORE_METRICS`.

Both are genuinely bounded and already expressed out of 100, so the bar is a true proportion. Every other metric would need a maximum invented for it, and a bar drawn against an invented maximum misrepresents the data it is supposed to be clarifying. Clamped with `Math.max(0, Math.min(100, score))` so an out-of-range backend value cannot overflow the track. Winning scores are gold, the rest `#8a8f98`. The track is `aria-hidden` — the number above it is the accessible value.

#### RERA tick

A `&#10003;` under the value **only** on `approval_status`, and only when the string actually matches `/rera/i`.

A tick is a claim about registration, so it is drawn where the value says RERA and nowhere else. Written as a numeric character reference rather than a literal `✓` to keep the file ASCII-clean.

#### Footer CTAs

One gold "Enquire on {name}" button per column, on the **same snap track as the columns** so each button travels with its own property instead of detaching from it.

`min-h-11`, so the button is a 44px touch target despite its 13px label. `max-w-[220px]` stops the text running the full 46% column width on a wide screen.

The mobile dialog uses the same per-column footer, but the label is **`Enquire`**, not `Enquire on {name}` — see the table section above for why a `truncate`d label would otherwise size the column. `aria-label="Enquire on {name}"` keeps the full phrasing accessible. `min-h-11` is unchanged.

#### Row height and type scale

Every value cell is `min-h-[56px]` and `flex-col justify-center` — the bar and the tick need a second line under the number, which `items-center` on a single-line cell could not give. Side padding is `px-4` (16px), up from 12px to match the wider dark surface.

This table is the **desktop card's** scale. The mobile dialog shares the same row floor, colours, treatments, `tabular-nums` and missing-value rules, and steps the type down one notch for a phone-width column:

| Element | Desktop | Mobile dialog |
|---|---|---|
| Header micro-label | 10px | 9px |
| Property name (header) | 15px | 14px |
| Locality (header) | 12px | 11px — `line-clamp-2`, wraps rather than truncating |
| Metric caption | 12px | 11px |
| Value | 15px | 14px |
| Value, missing | 12px | 12px |
| Footer CTA | 13px | 12px, label `Enquire` |
| Cell padding | `px-4` | `px-3` |
| Property cell cap | `w-64` fixed | `max-w-[220px]` on a `max-content` track |

| Element | Size | Weight / treatment |
|---|---|---|
| Header micro-label | 10px | `font-bold`, `tracking-[0.14em]`, `uppercase`; gold when best match, `#6b7280` otherwise |
| Property name (header) | 15px | `font-bold tracking-tight`, `#f2f0ea` |
| Locality (header) | 12px | `#8a909e`, `truncate` |
| Metric caption | 12px | `font-medium`, `#8a909e` |
| Value | 15px | `font-semibold` `#e8e6e1`; `font-bold` `#c9a84c` when it is the best in the row |
| Value, missing | 12px | `#6b7280`, no italic |
| Group bar | — | Removed from all three tables; see above. Retired spec was 11px `uppercase`, `tracking-[0.16em]`, `#c9a84c` on `#1b1d22` |
| Availability bar | 3px | `#8a8f98` on `white/10`, `aria-hidden`; deliberately not gold — it marks a gap, not a winner |
| Footer CTA | 13px | `font-semibold`, `#0f1114` on `#c9a84c` |

**The 12px "Best" badge is gone.** The reference shows the winning value as gold text and nothing else. On a dark card a filled gold pill next to every winning number was a second, louder mark for the same fact — and at 12px it was competing with the value itself. Gold text plus a 5%-opacity cell tint is one signal, not two.

**`tabular-nums` on every value.** Prices, areas and plot counts are read column against column, so the digits have to sit on the same width. In the default proportional figures a `1` is far narrower than a `9` and the columns read as ragged rather than as numbers.

**The missing-value case drops the italic.** Italic was doing the "this is absent" job that the grey already does, and it was also competing with the metric caption directly above it.

### Property card internals

| Element | Treatment |
|---|---|
| Tap target | The **entire card**. It is a single `<button>`; the `+` and the selection circle are `aria-hidden` decoration inside it, not separate controls |
| Card min height | `min-h-[11rem` (176px) |
| Name | `text-[16px] font-semibold`, `line-clamp-2` |
| Location | `text-[12px] text-white/70`, `truncate`, under the name |
| Price | `text-[14px] font-semibold text-white/85`, `mt-auto` so it sits on the card floor |
| Selection circle | Top-right, `h-6 w-6`. `+` while unselected, the selection number once chosen, filled gold |
| Scrim | `from-black/90 via-black/62 to-black/45`, **always rendered**, `pointer-events-none` |

**The selection order moved inside the card.** It was a badge at `-top-2 -left-2`, overhanging the corner — clipped by the carousel's own edges on the first and last cards, and cut in half on any card near the viewport edge. It is now the top-right circle: `+` when unselected, `1` / `2` / … in a filled gold circle when selected. The `CheckIcon` that used to occupy that circle when selected is deleted; the number carries both the state and the order in one glyph.

**The scrim is unconditional.** It used to live inside the `cover_url` branch, so the 4.5:1 contrast guarantee for white text held only while every property happened to have a cover image. Over the card's own `#1b1d22` it is invisible, so rendering it always costs nothing and means a photo can be added later without revisiting this.

**The location line needs a join.** `GET /api/properties` returns a trimmed row with `location_id` but **no `location_name`** — `location_name` only exists on `ApiProperty`, the ~71-field single-property type. So the section now also fetches `GET /api/locations` once and keys it by `id`. A failure there is logged, not surfaced: cards stay selectable and comparable, they just lose the location line.

Only the locality is available this way. A second segment such as the `DTCP` in "Shadnagar · DTCP" is a layout or approval name and would need the per-property endpoint — one request per card, which is why it is not done.

### Carousel bleed: right edge only

The tiles `<ul>` is `-mr-5 pr-5`. Its box starts on the card's content edge — the 20px gutter — and runs out to the screen's right edge, so tiles scroll off the right and never off the left.

It was `-mx-5 px-5`, which pulled the box to x = 0 as well: two bleed edges, and the strip read as detached from the card rather than starting on its gutter.

**There is deliberately no `scroll-pl-5` here.** The container's left edge *is* the 20px gutter now, so `snap-start` already parks each tile on it. Adding scroll padding on top would push the snap to 40px — a gutter of double the intended width, visible every time the strip settles. `scroll-pl-*` is only needed when the container's own left edge is at 0 and the padding is inside it.

`pr-5` keeps the last tile off the screen edge at the end of the scroll.

### Vertical rhythm, mobile

| Gap | Value | Made of |
|---|---|---|
| Viewport edge → eyebrow | **48px** | wrapper `pt-12` |
| Intro paragraph → card block | **24px** | wrapper `pb-6` |
| Compare button → next section | **32px** | card `py-4` (16px) + block wrapper `pb-4` (16px) |

The bottom gap previously did not exist at all: the unified block's wrapper carried `sm:pb-12` but **no** mobile bottom padding, so the next section followed the button after only the card's own 16px.

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