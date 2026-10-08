# Property-detail page template

## Purpose and scope

This document describes the reusable property-detail page used for every
property in the catalogue. It is not a specification for Singapore Township
only. The route is:

```text
/properties/:propertyId
```

`PropertyPage.jsx` resolves `propertyId` with `getPropertyById()` and passes the
resulting property record to the shared section components. Consequently, the
page structure and interaction model remain consistent while the displayed
name, location, pricing, plot details, match scores, amenities, documents,
neighbourhood data, timeline, testimonial, and enquiry text change according to
the selected property.

The current catalogue contains these property IDs:

| ID | Display name |
| --- | --- |
| `singapore-township` | Singapore Township |
| `nallagandla-enclave` | Nallagandla Enclave |
| `kokapet-heights` | Kokapet Heights |
| `khajaguda-residency` | Khajaguda Residency |
| `patancheru-gateway` | Patancheru Gateway |
| `mansanpally-meadows` | Mansanpally Meadows |
| `sark-green-plains` | Sark Green Plains |

An unknown ID is redirected to `/properties` rather than rendering an empty
detail page.

## Page structure

All sections below are rendered in this order as one long page. They are not
separate routes or separate HTML pages. Links and actions that leave the page
are called out in [Routes and destinations](#routes-and-destinations).

```text
PropertyHero
LifeStageMatch
FutureNeighbourhoodMap
Lifestyle
PriceEmiFuture
LegalDocuments
SatelliteBeforeAfter
BuyingJourneySteps
SimilarProperties
PropertyFinalCta
StickyBottomCta
```

The complete composition is implemented in
[`src/pages/PropertyPage.jsx`](../src/pages/PropertyPage.jsx).

## Property-driven content model

The canonical source is
[`src/data/properties.js`](../src/data/properties.js). Each record supplies
the values consumed by the shared template.

| Data group | Fields used by the page | Where it appears |
| --- | --- | --- |
| Identity | `id`, `name`, `location`, `locationKey` | Breadcrumb, headings, labels, enquiry/share messages |
| Marketing copy | `tagline`, `description` | Hero |
| Plot details | `sqYards`, `areaSqFt`, `areaCents`, `facing`, `dimensions`, `roadWidth`, `propertyType` | Hero, similar-property cards |
| Commercial/status | `price`, `approval`, `possession`, `status`, `bankEligible`, `reraRegistered` | Hero, cards, legal/availability context |
| Site attributes | `corner`, `parkFacing`, `features`, `highwayKm` | Matching and similar-property logic |
| Social proof | `viewingCount`, `enquiryCount` | Hero |
| Buyer fit | `lifeStageMatch.family`, `.investment`, `.building`, `.retirement` | Life-stage match |
| Connectivity | `connectivity`, `nearbyAmenities`, `connectivityScore` | Location data and matching inputs |
| Verification | `documents` | Legal documents |
| Future context | `neighbourhood` | Future neighbourhood map |
| Location history | `coordinates`, `zoom`, `timeline` | Satellite timeline |
| Social proof detail | `testimonial` | Data available for property-specific content |

`getPropertyById()` also merges the matching entry from
[`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js), adding map
coordinates, zoom, and the layout image when available.

### Example of the variation

The following values are examples of one record, not page-wide constants:

```js
{
  id: 'singapore-township',
  name: 'Singapore Township',
  location: 'Isnapur, West Hyderabad',
  sqYards: '200 sq yd',
  facing: 'East',
  price: 3200000,
  approval: 'HMDA',
  lifeStageMatch: { /* property-specific percentages and reasons */ },
  nearbyAmenities: [ /* property-specific places and distances */ ],
  neighbourhood: { /* property-specific existing/proposed infrastructure */ },
  timeline: [ /* property-specific location-story entries */ ]
}
```

For example, Sark Green Plains has a different name, location, plot size,
price, match scores, connectivity list, neighbourhood data, and testimonial.
The components should read those fields from `property` rather than copying
Singapore Township values into shared markup.

## Sections in top-to-bottom order

### 1. Property hero and gallery

**Source:** [`PropertyHero.jsx`](../src/components/PropertyDetail/PropertyHero.jsx)

The hero introduces the current property and provides the primary enquiry
actions. Its dynamic content includes:

- Breadcrumb: `Home / Properties / {property.location}`.
- `{property.name}`, tagline, and description.
- Size, facing, dimensions, and road-width specifications.
- Formatted `{property.price}` and `{property.approval} Approved`.
- A calculated location score from `computeConnectivityScore(property)`.
- Viewing and enquiry counts from the current record.
- WhatsApp text containing the current property name and location.
- A mailto site-visit action.

The gallery is interactive: selecting a thumbnail changes the large image. The
default gallery is shared by most property IDs. `sark-green-plains` currently
uses its own three-image gallery from the Sark Green Plains assets. This is an
asset selection override, not a different page template.

### 2. Life-stage match

**Source:** [`LifeStageMatch.jsx`](../src/components/PropertyDetail/LifeStageMatch.jsx)

The shared section offers four goals: starting a family, investment first,
building my home, and quiet retirement. Selecting a goal updates the percentage
and reason from the current property’s `lifeStageMatch` object. The labels and
descriptions of the four goals are shared; the score and explanation vary by
property.

### 3. Future neighbourhood

**Source:** [`FutureNeighbourhoodMap.jsx`](../src/components/PropertyDetail/FutureNeighbourhoodMap.jsx)

This section presents current and proposed infrastructure surrounding the
selected property. The Today/In 2029 toggle switches between
`property.neighbourhood.existing` and `property.neighbourhood.proposed`.

The infrastructure list, distances, statuses, details, map origin, map label,
and location badge are property-driven. The **Near by me** control calculates a
distance from the fixed demo location `Gachibowli (demo)` to the selected
property; it is not device geolocation.

### 4. Lifestyle gallery

**Source:** [`Lifestyle.jsx`](../src/components/PropertyDetail/Lifestyle.jsx)

The section presents lifestyle captions and images with automatic rotation and
manual selection. Most properties currently use the shared default item set;
Sark Green Plains uses a property-specific set. Captions and images should be
treated as content that can be changed per property, even though the current
implementation selects them with a property-ID override.

### 5. Affordability and future value

**Source:** [`PriceEmiFuture.jsx`](../src/components/PropertyDetail/PriceEmiFuture.jsx)

The section uses the current property name, location, and price to show a
10–40% down-payment slider, down payment, loan amount, indicative monthly EMI,
and illustrative 2028/2030 values. The calculations change when
`property.price` changes. The interest rate (8.5%), tenure (20 years),
appreciation assumptions, and disclaimer are shared demo constants, not
property-specific financial offers or guarantees.

### 6. Legal documents

**Source:** [`LegalDocuments.jsx`](../src/components/PropertyDetail/LegalDocuments.jsx)

The component maps over `property.documents`, so document labels and links can
vary by property. It also renders a shared build-rules action and verification
callout. The current demo data uses shared/default document records, and some
targets are fragment links; document availability should be verified before
production use.

### 7. Location story and satellite timeline

**Source:** [`SatelliteBeforeAfter.jsx`](../src/components/PropertyDetail/SatelliteBeforeAfter.jsx)

The map is centred on the selected property’s coordinates. Selecting a year
updates the active timeline item and map zoom. Year labels and story text come
from `property.timeline`, while the property name and location appear in the
map overlay. Without a valid `MAPBOX_ACCESS_TOKEN`, the component shows a
fallback message instead of the live satellite map.

### 8. Buying journey

**Source:** [`BuyingJourneySteps.jsx`](../src/components/PropertyDetail/BuyingJourneySteps.jsx)

This shared explanatory section describes the purchase process. Its step
labels and interaction are currently the same for every property; it does not
receive a property object.

### 9. Similar properties

**Source:** [`SimilarProperties.jsx`](../src/components/SimilarProperties/SimilarProperties.jsx)

`PropertyPage.jsx` derives up to six alternatives using
[`src/lib/similar.js`](../src/lib/similar.js). Candidates are scored using
locality, price, area, property type, shared features, facing, corner/park
status, saved filters, viewed state, and wishlist state. Only available
properties with a sufficient score are shown.

Each card displays the candidate’s approval, name, location, size, facing,
price, and matching reasons. Each card links to that candidate’s own
`/properties/{id}` route, where the same template is populated with the new
record.

### 10. Final property CTA

**Source:** [`PropertyFinalCta.jsx`](../src/components/PropertyDetail/PropertyFinalCta.jsx)

The final CTA includes the current property name and provides property-specific
WhatsApp enquiry and site-visit messages, wishlist and Interested toggles stored
per property ID in local storage, and sharing through Web Share, clipboard, or
a WhatsApp fallback.

### 11. Conditional sticky CTA

**Source:** [`StickyBottomCta.jsx`](../src/components/PropertyDetail/StickyBottomCta.jsx)

After the hero leaves the viewport, an IntersectionObserver displays a sticky
site-visit bar. It uses the current property in the WhatsApp message and can be
dismissed for the current page view. It is not a separate route.

## Routes and destinations

| Element | Destination/behavior |
| --- | --- |
| Home breadcrumb | `/` |
| Properties breadcrumb | `/properties` |
| Similar-property card | Another `/properties/{propertyId}` detail route |
| Hero WhatsApp | External `https://wa.me/` URL in a new tab |
| Hero site visit | `mailto:hello@ilahomes.example` |
| Final CTA WhatsApp/site visit | External WhatsApp URLs in a new tab |
| Sticky CTA site visit | Mailto action |
| Legal document View | `property.documents[*].href`; current demo targets may be fragments |
| Build rules View Details | `#document-build-rules` fragment |
| Share property | Web Share, clipboard, or WhatsApp fallback |

## Responsive and accessibility behavior

Shared property-detail CSS controls desktop, tablet, and mobile layouts. Grids
collapse into stacked layouts at narrower widths, image galleries remain
selectable, and CTA controls remain touch-friendly. The implementation uses
semantic headings, breadcrumb navigation, labelled sections, button controls,
`aria-pressed` for selectable controls, live regions for changing results,
descriptive image alt text, and keyboard-operable links/buttons.

## Assets and runtime dependencies

- Default hero gallery: `src/assets/G1.webp`, `extra-image-3.png`,
  `extra-image-4.png`, and `extra-image-5.png`.
- Default lifestyle gallery: `extra-image-6.png` through `extra-image-9.png`.
- Sark Green Plains overrides: `Sark Green Plains-1.png` through `-3.png`.
- Layout card/map images: assets referenced by `propertyLayouts.js`.
- Map rendering: Mapbox GL and `react-map-gl/mapbox` when
  `MAPBOX_ACCESS_TOKEN` is configured.
- Browser APIs: localStorage, sessionStorage, clipboard, Web Share API, and
  IntersectionObserver.

## Known limitations and content rules

- Map coordinates, infrastructure, future development, and satellite overlays
  are demo/approximate data and are not surveyed boundaries.
- The “Near by me” feature uses the fixed Gachibowli demo coordinate.
- EMI and appreciation figures are illustrative and must not be presented as a
  loan quote, investment guarantee, or property-specific financial promise.
- The current legal-document catalogue contains shared/default records and
  incomplete demo destinations; each property should receive verified targets.
- Hero and lifestyle asset handling is partly based on ID conditionals. A
  future data-driven gallery field would make it easier to add properties
  without changing components.
- `Connectivity.jsx` exists but is not mounted by `PropertyPage.jsx`; the
  visible location sections are the hero score, Future Neighbourhood map, and
  satellite timeline.

## Verification checklist

Test at least one default-gallery property and Sark Green Plains, plus a mobile
viewport:

1. Open `/properties/{id}` for each catalogue ID and confirm the name, location,
   plot details, price, and CTA messages change.
2. Confirm an unknown ID redirects to `/properties`.
3. Select hero thumbnails and life-stage goals.
4. Toggle Today/In 2029 and Near by me for each property.
5. Confirm lifestyle rotation and manual selection.
6. Move the down-payment slider and open the budget modal.
7. Select satellite timeline years with and without `MAPBOX_ACCESS_TOKEN`.
8. Verify similar-property cards open their own property routes.
9. Test wishlist, Interested, share, WhatsApp, mailto, and legal links.
10. Scroll beyond the hero, dismiss the sticky CTA, and verify its visibility.
11. Check keyboard access, readable labels, image alternatives, and stacked
    layouts at mobile widths.
12. Run `npm run build` from `C:\Users\surya\Desktop\ILA-HOMES(DEMO)`.

## Source files

- [`src/pages/PropertyPage.jsx`](../src/pages/PropertyPage.jsx)
- [`src/data/properties.js`](../src/data/properties.js)
- [`src/data/propertyLayouts.js`](../src/data/propertyLayouts.js)
- [`src/components/PropertyDetail/PropertyHero.jsx`](../src/components/PropertyDetail/PropertyHero.jsx)
- [`src/components/PropertyDetail/LifeStageMatch.jsx`](../src/components/PropertyDetail/LifeStageMatch.jsx)
- [`src/components/PropertyDetail/FutureNeighbourhoodMap.jsx`](../src/components/PropertyDetail/FutureNeighbourhoodMap.jsx)
- [`src/components/PropertyDetail/Lifestyle.jsx`](../src/components/PropertyDetail/Lifestyle.jsx)
- [`src/components/PropertyDetail/PriceEmiFuture.jsx`](../src/components/PropertyDetail/PriceEmiFuture.jsx)
- [`src/components/PropertyDetail/LegalDocuments.jsx`](../src/components/PropertyDetail/LegalDocuments.jsx)
- [`src/components/PropertyDetail/SatelliteBeforeAfter.jsx`](../src/components/PropertyDetail/SatelliteBeforeAfter.jsx)
- [`src/components/PropertyDetail/BuyingJourneySteps.jsx`](../src/components/PropertyDetail/BuyingJourneySteps.jsx)
- [`src/components/SimilarProperties/SimilarProperties.jsx`](../src/components/SimilarProperties/SimilarProperties.jsx)
- [`src/components/PropertyDetail/PropertyFinalCta.jsx`](../src/components/PropertyDetail/PropertyFinalCta.jsx)
- [`src/components/PropertyDetail/StickyBottomCta.jsx`](../src/components/PropertyDetail/StickyBottomCta.jsx)
- [`src/lib/similar.js`](../src/lib/similar.js)