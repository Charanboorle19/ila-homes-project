# Verification / Legal Documents feature

This document describes the current Verification / Legal Documents implementation on the Property Details page. It complements, rather than duplicates, [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\amenities.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\amenities.md).

## 1. Feature purpose

The feature renders a Property Details section headed `Verification` that lists published legal/verification records, exposes links when a record has an `href`, and shows possession/status context. The implementation component is named `LegalDocuments`, not `Amenities` and not a separately confirmed component named `Verification`.

## 2. Where it appears on the Property Details page

It appears in the shared Property Details page as a section with `id="documents"`. The visible heading is `Legal documents for {property.name}` and the kicker is `Verification`.

## 3. Exact section position/order

`PropertyPageView` renders the relevant sequence in this order:

1. `Lifestyle`
2. `PriceEmiFuture`
3. `LegalDocuments`
4. `SatelliteBeforeAfter`

Thus Verification is the sixth major rendered component after the hero in the complete `PropertyPageView` tree, immediately after pricing/EMI and immediately before Location Story. The full parent sequence is `PropertyHero`, `LifeStageMatch`, `FutureNeighbourhoodMap`, `Lifestyle`, `PriceEmiFuture`, `LegalDocuments`, `SatelliteBeforeAfter`, `BuyingJourneySteps`, `SimilarProperties`, `PropertyFinalCta`, and `StickyBottomCta`.

## 4. Component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\LegalDocuments.tsx` — feature component.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx` — shared page composition and `documentsState` forwarding.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\ApiPropertyView.tsx` — API property/document loading.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` — `PropertyDocument`, `PropertyRecord`, and static documents.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts` — API document type and request.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts` — API-to-record document mapping and fallback verification rows.
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css` — shared Property Details styling.

## 5. Component names

The implementation is the default-exported function `LegalDocuments` in `LegalDocuments.tsx`. It is imported by `PropertyPageView` and rendered as `<LegalDocuments property={property} documentsState={documentsState} />`. No component named `Verification` or `Amenities` implements this section.

## 6. Component props

`LegalDocuments` accepts:

```ts
{
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
}
```

`documentsState` defaults to `"ready"`. `PropertyPageView` accepts the same `property` plus optional `documentsState`, also defaulting to `"ready"`. `ApiPropertyView` accepts `{ id: string }` and passes the resulting document status to `PropertyPageView`.

## 7. Data sources

The component reads `property.documents` from the normalized `PropertyRecord`. Static properties obtain that array from `src/data/properties.ts`. API properties obtain documents from `fetchPropertyDocuments`, map them with `apiDocumentsToRecords`, and pass the mapped array through `apiPropertyToRecord` into the same `PropertyRecord` shape.

## 8. Local/static property behavior

The local catalogue uses the shared `DEFAULT_DOCUMENTS` array. Current local records assign `documents: DEFAULT_DOCUMENTS`. These are static `PropertyDocument` rows, not fetched files. Their links are same-document fragment URLs: `#document-title`, `#document-ec`, `#document-layout`, and `#document-conversion`.

## 9. API property behavior

API properties are loaded by `ApiPropertyView` when the route id is a UUID. The property request and document request are independent. The document request starts with `documents` state `{ status: "loading", items: [] }`, maps successful API items to `PropertyDocument[]`, or changes to `{ status: "error", items: [] }` on failure. The page still renders when the main property request succeeds; document loading does not block the page.

## 10. Document data structure

The normalized structure is `PropertyRecord.documents: PropertyDocument[]`:

```ts
type PropertyDocument = {
  id: string;
  label: string;
  href?: string;
  detail?: string;
  documentType?: string;
  sizeBytes?: number;
  visibility?: string;
  createdAt?: string;
};
```

`href` is omitted for rows that are stated facts rather than file links.

## 11. Exact document fields

The exact normalized fields are `id`, `label`, optional `href`, optional `detail`, optional `documentType`, optional `sizeBytes`, optional `visibility`, and optional `createdAt`. The component displays `label`; it displays `documentType`, `visibility`, and formatted `sizeBytes` when available, otherwise `detail`, otherwise `Published verification document`.

## 12. Document types

Static labels currently identify: `Parent title deed summary`, `Encumbrance certificate (EC)`, `Sanctioned layout approval`, and `Land-use / conversion certificate`. API `document_type` is copied as the normalized `documentType` string without an application-side enum or whitelist. API fallback verification rows use `Approval details`, `Land use`, `RERA registration`, `Possession`, and `Listing source`; these are facts and do not necessarily represent files.

## 13. Document visibility behavior

API `visibility` is copied from `ApiPropertyDocument.visibility` to `PropertyDocument.visibility` and displayed as text. There is no confirmed filtering, authorization check, visibility whitelist, or visibility-based hiding in `LegalDocuments` or `apiDocumentsToRecords`. Static documents do not specify `visibility`.

## 14. Document status behavior

The section-level status is `documentsState` with exactly `"loading"`, `"ready"`, or `"error"`. Individual documents have no separate status field in `PropertyDocument`. `visibility` is metadata, not a status. Property status is separately shown in the callout after replacing the first hyphen with a space.

## 15. Document links

Every document with a truthy `doc.href` renders a `View` anchor. Documents without `href` render no action link. The static links are fragment links; API links come from `storage_reference`. The `View build rules` link always uses `href="#document-build-rules"`.

## 16. API endpoint

Documents use `GET /api/properties/{id}/documents`, implemented by `fetchPropertyDocuments` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`. The id is URL-encoded with `encodeURIComponent`.

## 17. API request structure

`fetchPropertyDocuments(propertyId, signal?)` calls `apiFetch` with the path `/api/properties/${encodeURIComponent(propertyId)}/documents` and `{ signal }`. The request is made only when `isPropertyUuid(id)` is true. Tenant/base-URL behavior is handled by the existing `apiFetch` client. No request body is supplied.

## 18. API response structure

The typed response is:

```ts
{
  success?: boolean;
  data?: {
    items?: ApiPropertyDocument[];
    total?: number;
  };
}
```

`ApiPropertyDocument` fields are `id`, `name`, `document_type`, `size_bytes`, `visibility`, `storage_reference`, optional `metadata`, optional `created_at`, and optional `updated_at`. The service uses `data.items` when it is an array, otherwise `[]`, and returns `total: data.total ?? items.length`.

## 19. API-to-local document mapping

`apiDocumentsToRecords(documents)` maps each item as follows:

| API field | `PropertyDocument` field |
| --- | --- |
| `id` | `id` |
| `name` | `label` |
| `storage_reference ?? undefined` | `href` |
| `document_type ?? undefined` | `documentType` |
| `size_bytes ?? undefined` | `sizeBytes` |
| `visibility ?? undefined` | `visibility` |
| `created_at ?? undefined` | `createdAt` |

`metadata` and `updated_at` are not copied. The mapper does not create a download URL or transform `storage_reference`.

## 20. State variables

`LegalDocuments` owns no React state. In `ApiPropertyView`, the document-specific state variable is:

```ts
const [documents, setDocuments] = useState<{
  status: "loading" | "ready" | "error";
  items: ReturnType<typeof apiDocumentsToRecords>;
}>({ status: "loading", items: [] });
```

The parent `PropertyPageView` receives the derived `documentsState` prop and does not own document state.

## 21. Derived values

`LegalDocuments` derives the lead text from `documentsState` and `property.documents.length`. For each row it derives the metadata line from `[doc.documentType, doc.visibility, formatBytes(doc.sizeBytes)].filter(Boolean).join(" · ") || doc.detail || "Published verification document"`. It also derives formatted possession/status callout text. `formatBytes` derives KB or MB text.

## 22. Functions

The component defines the local function `formatBytes(bytes?: number)`. It returns `null` for missing, zero, or negative values; values below 1 MB are rounded to `${(bytes / 1024).toFixed(0)} KB`; larger values are rounded to `${(bytes / (1024 * 1024)).toFixed(1)} MB`. Related service/mapper functions are `fetchPropertyDocuments`, `apiDocumentsToRecords`, `verificationRows`, and `apiPropertyToRecord`.

## 23. Hooks

`LegalDocuments` uses no hooks. `ApiPropertyView` uses `useState` and two relevant `useEffect` flows: one for `fetchPropertyDocuments` and one for the main property request. The document effect creates an `AbortController`, ignores results after abort, and aborts on cleanup. `PropertyPageView` uses no document-specific hook; its general page hooks are outside this feature.

## 24. Loading behavior

During `documentsState === "loading"`, the lead says `Loading the latest property documents…`. The list contains one item with heading `Loading documents` and a `role="status"` paragraph saying `Fetching the verification files for this property…`. The normal document map is not rendered in this branch. API property/page loading is separate: the main page may render while documents are still loading.

## 25. Error behavior

When the document request rejects, `ApiPropertyView` logs `console.warn("[property] documents fetch failed", error)` and sets `{ status: "error", items: [] }`. `LegalDocuments` then shows `Documents could not be loaded right now. Please try again later.` The list maps the empty `property.documents` array, so no document rows or retry control are rendered. A main property-request failure is separate and renders the `Property unavailable` page in `ApiPropertyView`.

## 26. Empty-document behavior

When status is `"ready"` and `property.documents` is empty, the lead says `No documents have been published for this property yet.` The `<ul className="pd-legal__list">` remains empty. The `View build rules` link and possession/status callout still render. API response items default to an empty array when `data.items` is absent or not an array.

## 27. Missing-document-field behavior

Missing `document_type`, `size_bytes`, and `visibility` are normalized to `undefined`. The metadata line omits missing values; if all three are absent it falls back to `detail`, then `Published verification document`. Missing `storage_reference` means no `View` link. Missing `detail` does not remove the row. Missing `name` is not accommodated by the typed mapping and is `UNKNOWN — needs verification` at runtime beyond the TypeScript contract.

## 28. Link/download/open behavior

Document `View` links are plain `<a>` elements with `className="pd-btn pd-btn--ghost"`, `target="_blank"`, and `rel="noreferrer"`. They open the `href` in a new tab/window; there is no `download` attribute, download handler, preview modal, blob handling, or explicit file-type handling. Static fragment links therefore also receive the new-tab behavior when rendered by `LegalDocuments`.

## 29. External integrations

The feature uses the existing `apiFetch` client and the browser’s normal anchor navigation. API document storage or signing behavior behind `storage_reference` is not implemented in this repository. No document viewer, download library, upload service, PDF library, or third-party legal-document integration is confirmed.

## 30. Relationship with PropertyRecord

`PropertyRecord` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts` requires `documents: PropertyDocument[]`. `LegalDocuments` consumes this field directly. The record also supplies `name`, `possession`, and `status` for the heading and callout. `PropertyDocument` is the normalized contract shared by static data, API document rows, and API fallback verification rows.

## 31. Relationship with PropertyPageView

`PropertyPageView` imports `LegalDocuments`, accepts optional `documentsState?: "loading" | "ready" | "error"`, defaults it to `"ready"`, and renders `<LegalDocuments property={property} documentsState={documentsState} />` in the fixed page sequence. It does not transform document data or provide callbacks.

## 32. Relationship with ApiPropertyView

`ApiPropertyView({ id })` independently calls `fetchPropertyDocuments(id, controller.signal)`. On success it maps `result.items` with `apiDocumentsToRecords`; on failure it keeps `items: []` and marks the status `error`. Once the main property is ready, it calls `apiPropertyToRecord(property, lifeStage, documents.items)` and renders `PropertyPageView` with `documentsState={documents.status}`. The document request is non-blocking and uses an `AbortController`.

## 33. Relationship with Property Popup

There is no standalone component named `PropertyPopup` confirmed in the source. The map equivalent is `PropertySheet` inside `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\MapSection.tsx`. `PropertySheet` displays property/project summary and action links, but it does not render `LegalDocuments`, read `property.documents`, call `fetchPropertyDocuments`, or open an API document.

## 34. Relationship with the `#brochure` link

`PropertySheet` has a `Brochure` link with `href="#brochure"`. It is a same-document fragment link and does not fetch, download, or open a brochure. `LegalDocuments` has no `#brochure` link; its section anchor is `id="documents"`, and its known static document hrefs are `#document-title`, `#document-ec`, `#document-layout`, and `#document-conversion`. A rendered element with exact `id="brochure"` is not confirmed: `UNKNOWN — needs verification`.

## 35. Relationship with any other document-related features

The section has a `View build rules` link to `#document-build-rules`, but no element with that id was confirmed in the inspected Property Details render tree: `UNKNOWN — needs verification`. The map popup also has a separate `#loan-calculator` fragment link; it is not a document feature. No brochure component, document modal, download manager, or document upload UI is confirmed.

## 36. Desktop behavior

`LegalDocuments` uses the shared `.pd-section`, `.pd-section__inner`, `.pd-legal__list`, `.pd-legal__list li`, `.pd-legal__list h3`, `.pd-legal__list p`, `.pd-legal__extras`, `.pd-legal__callout`, `.pd-btn`, and `.pd-btn--ghost` classes. The row is a flex layout with wrapping, allowing the text and `View` action to share a row when space permits. There is no confirmed LegalDocuments-specific desktop breakpoint or desktop-only interaction.

## 37. Mobile behavior

The same markup and controls are used on mobile. The legal list row flex layout can wrap, and the shared section spacing/button styles remain active. There is no separate mobile component, mobile state, mobile download behavior, or mobile-only document interaction. Exact rendered wrapping at a particular viewport is `UNKNOWN — needs verification`.

## 38. Responsive behavior

Responsive behavior comes primarily from shared `PropertyDetail.css` rules: fluid section padding, `clamp()` heading sizing, the shared max-width container, and flex wrapping in `.pd-legal__list li`. The inspected CSS has broad Property Details breakpoints, including `@media (min-width: 760px)`, but no confirmed LegalDocuments-specific media-rule override. Exact pixel behavior beyond those shared rules is `UNKNOWN — needs verification`.

## 39. Dependencies

Direct dependencies are the `PropertyRecord` type from `@/data/properties` and the CSS imported by `PropertyPageView` from `./PropertyDetail.css`. API-backed behavior additionally depends on React `useEffect`/`useState`, `apiFetch` through `propertiesService`, `fetchPropertyDocuments`, `apiDocumentsToRecords`, `apiPropertyToRecord`, and the existing `AbortController` browser API. No separate UI, document, or download library is used.

## 40. Known issues

- Static document hrefs point to fragment targets, not confirmed document files.
- `LegalDocuments` always adds `target="_blank"` and `rel="noreferrer"`, including for static fragment hrefs.
- API document errors show an error lead but no retry action and no document rows.
- API `visibility` is displayed but does not control visibility/filtering in this UI.
- API fallback verification rows are stated facts without file links when no mapped document array is supplied.
- The `#document-build-rules` target is a link target only in the inspected tree; its destination is `UNKNOWN — needs verification`.
- The popup’s `#brochure` target is not connected to `LegalDocuments`; whether an exact `id="brochure"` target exists is `UNKNOWN — needs verification`.
- The exact behavior of a `storage_reference` supplied by the API (for example, whether it is presigned or requires another service) is `UNKNOWN — needs verification`.

## 41. Important constraints

- Preserve the component name `LegalDocuments` and its prop contract unless all `PropertyPageView` usage is updated.
- Preserve `PropertyRecord.documents: PropertyDocument[]` and the normalized field names unless the static data, mapper, and component are changed together.
- Keep API document loading independent from the main property request and preserve abort cleanup behavior.
- Keep the exact API endpoint `GET /api/properties/{id}/documents` and UUID-based request gating unless the API contract intentionally changes.
- Do not treat `visibility` as an authorization mechanism; current code only displays it.
- Preserve the distinction between file-backed rows (`href`) and stated facts without links (`detail`).
- Preserve the current loading, error, and empty-state text/structure unless the user-facing behavior is intentionally changed.
- Do not assume `#brochure`, `#document-build-rules`, or any static document fragment is backed by a rendered target unless that target is confirmed.
- Do not assume every document is a brochure; the implementation identifies the section as Verification and the rows as legal/verification documents.
- Preserve the existing shared CSS classes and page order unless the intended Property Details structure changes.