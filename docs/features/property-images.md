# Property Images / Gallery feature

This document describes the current property image/gallery implementation used by the Property Details page. It complements [`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md`](C:\Users\surya\Desktop\ILA-HOMES-PROJECT\docs\features\property-details.md) and documents only gallery-specific behavior.

## 1. Feature purpose

The gallery presents property imagery in the Property Details hero. It provides one active main image, a position/count indicator, and selectable thumbnail images. It supports static catalogue galleries and API properties normalized into the same page view.

## 2. Where the gallery appears

The gallery appears in the hero section of `/properties/{propertyId}`, beside the property copy on wider screens and in the normal hero flow on narrower screens. The relevant markup is the `pd-hero__gallery` block in `PropertyHero`.

## 3. How the gallery is initialized

`PropertyPageView` computes the gallery with:

```ts
const gallery = useMemo(() => getPropertyGallery(property), [property]);
```

The initial active state is:

```ts
const [activeGalleryId, setActiveGalleryId] = useState(gallery[0]?.id ?? "");
```

Therefore the first gallery item is initially active when one exists. An effect resets the active id to the first item whenever `[property.id, gallery]` changes.

## 4. Image data source

There are two current sources:

- Local/static properties: the optional `PropertyRecord.gallery` field in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.
- API properties: the API `cover_url` field, mapped by `apiPropertyToRecord` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts`.

If a local record has no gallery, or an API record has no usable `cover_url`, `getPropertyGallery` supplies the shared default gallery.

## 5. Gallery data structure

`GalleryItem[]` is the gallery structure. `PropertyRecord.gallery` is optional:

```ts
type GalleryItem = {
  id: string;
  src: string;
  alt: string;
};

gallery?: GalleryItem[];
```

The rendered gallery is always obtained as a `GalleryItem[]` from `getPropertyGallery`.

## 6. Exact image fields

Each image has exactly these fields:

- `id`: string used for React keys, active selection, and lookup.
- `src`: string passed directly to `next/image` as `src`.
- `alt`: string used as the main image alternative text and in each thumbnail button's accessible label.

Thumbnail `<Image>` elements intentionally use `alt=""`; the surrounding button has `aria-label={\`Show ${item.alt}\`}`.

## 7. Local/static image behavior

Local records may provide `gallery` directly. The current explicit local override is `SARK_GALLERY`, assigned to the `sark-green-plains` record. Other records with no `gallery` use `DEFAULT_GALLERY` through `getPropertyGallery`.

Local image paths in the inspected gallery data are public-root paths such as `/hero-image.png` and `/assets/property/hero-property.jpg`.

## 8. API property image behavior

The API property type exposes `cover_url: string | null` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`.

`apiPropertyToRecord` maps a non-empty `cover_url` to exactly one gallery item:

```ts
[{ id: "cover", src: property.cover_url, alt: property.name }]
```

It does not map an API image array. API properties currently have a one-image gallery when `cover_url` is present.

## 9. Default/fallback gallery behavior

`getPropertyGallery(property)` returns:

```ts
property.gallery ?? DEFAULT_GALLERY
```

`DEFAULT_GALLERY` contains four items:

| id | src | alt |
| --- | --- | --- |
| `g1` | `/hero-image.png` | `Property aerial view` |
| `g2` | `/assets/property/extra-image-3.png` | `Plot approach road` |
| `g3` | `/assets/property/extra-image-5.png` | `Layout vista` |
| `g4` | `/assets/property/extra-image-6.png` | `Neighbourhood setting` |

Because the operator is `??`, an explicitly empty array is not replaced by `DEFAULT_GALLERY`; only `null`/`undefined` gallery values fall back.

## 10. Active image behavior

`PropertyPageView` derives the active image with:

```ts
gallery.find((item) => item.id === activeGalleryId) ?? gallery[0]
```

It passes that value as `activeImage` to `PropertyHero`. If the active id is not found, the first gallery item is used as the displayed image. If the gallery is empty, `activeImage` is `undefined`.

## 11. Thumbnail behavior

`PropertyHero` maps every gallery item to a button with class `pd-hero__thumb`. The selected button additionally has `is-active`, `aria-pressed={true}`, and an accessible label based on the image alt text. Each thumbnail uses `next/image` with `fill`, `sizes="96px"`, and class `pd-hero__thumb-img`.

Thumbnails are laid out by `.pd-hero__thumbs` as three equal grid columns. There is no separate thumbnail carousel, scrolling control, lazy selection control, or pagination control in the inspected implementation.

## 12. Image selection behavior

Clicking a thumbnail calls:

```tsx
onClick={() => onSelectGallery(item.id)}
```

`PropertyPageView` passes `setActiveGalleryId` as `onSelectGallery`. Selection is therefore id-based and updates the main stage immediately through React state.

## 13. Image count behavior

`PropertyHero` computes `activeIndex` with `gallery.findIndex((item) => item.id === activeImage?.id)`. When the index is non-negative, it renders `.pd-hero__count` as:

```text
{activeIndex + 1} / {gallery.length}
```

The count is not rendered when no active image matches. It uses the current gallery array length, including the one-item API gallery or the four-item default gallery.

## 14. Main image behavior

The main image is rendered inside `.pd-hero__stage` only when `activeImage` exists. It uses `next/image` with the active item's `src` and `alt`, `fill`, `priority`, `sizes="(max-width: 900px) 100vw, 42vw"`, and class `pd-hero__stage-img`.

The stage has `aspect-ratio: 16 / 10`, `position: relative`, `overflow: hidden`, a rounded border, and a background color. `.pd-hero__stage-img` uses `object-fit: cover`.

## 15. Mobile behavior

At widths below the desktop layout breakpoint, `.pd-hero__grid` has no explicit column template and therefore uses the default single-column grid. The property copy and gallery appear in normal document order, with the gallery after the copy.

The main image `sizes` hint treats widths at or below `900px` as `100vw`. Thumbnails remain a three-column grid. Exact device-specific behavior beyond these CSS rules is `UNKNOWN — needs verification`.

## 16. Desktop behavior

At `@media (min-width: 760px)`, `.pd-hero__grid` uses `grid-template-columns: 1.15fr 0.85fr`, with a `2rem` gap. The property copy occupies the wider column and the gallery occupies the narrower column. The stage has `max-height: 20rem` at this breakpoint.

## 17. Responsive behavior

The relevant responsive rules are:

- Base `.pd-hero__grid`: CSS grid with `gap: 1.5rem`; no explicit columns, so it is effectively one column before `760px`.
- `@media (min-width: 760px)`: two columns, `1.15fr 0.85fr`, `gap: 2rem`.
- Main `next/image` `sizes`: `(max-width: 900px) 100vw, 42vw`.
- Thumbnail `next/image` `sizes`: `96px` at all widths.
- Stage: `aspect-ratio: 16 / 10`; desktop `max-height: 20rem`.

No separate gallery-specific `max-width: 640px` rule was found. Exact rendered pixel sizes at intermediate widths are `UNKNOWN — needs verification`.

## 18. Exact component/file paths

- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyPageView.tsx`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyHero.tsx`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\components\PropertyDetail\PropertyDetail.css`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertyMapper.ts`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\services\propertiesService.ts`
- `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\next.config.ts`

## 19. Component names

- `PropertyPageView`: computes and owns gallery selection state.
- `PropertyHero`: renders the gallery stage, count, and thumbnails.
- `ApiPropertyView`: fetches/maps API property data before rendering `PropertyPageView`.

There is no separate `PropertyGallery` component in the inspected implementation.

## 20. Component props

`PropertyPageView` accepts:

```ts
{
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
}
```

Its gallery-specific child props to `PropertyHero` are:

```ts
{
  property: PropertyRecord;
  gallery: GalleryItem[];
  activeImage: GalleryItem | undefined;
  onSelectGallery: (id: string) => void;
  connectivityScore: number;
  whatsappHref: string;
  siteVisitHref: string;
  priceLabel: string;
}
```

`PropertyHero` is exported as a `forwardRef<HTMLElement, PropertyHeroProps>`.

## 21. State variables

The gallery-specific state variable is:

- `activeGalleryId`: React state in `PropertyPageView`.
- `setActiveGalleryId`: its state setter, passed to `PropertyHero` as `onSelectGallery`.

`PropertyHero` itself has no gallery state; it is controlled by the parent.

## 22. Derived values

The gallery-related derived values are:

- `gallery`: `useMemo(() => getPropertyGallery(property), [property])` in `PropertyPageView`.
- `activeImage`: matching gallery item or `gallery[0]` in `PropertyPageView`.
- `activeIndex`: `gallery.findIndex(...)` in `PropertyHero`.
- `selected`: whether a thumbnail item's id equals `activeImage?.id`.
- Count text: `activeIndex + 1` and `gallery.length`.

## 23. Functions

Gallery-related functions are:

- `getPropertyGallery(property)` in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\data\properties.ts`.
- `setActiveGalleryId` from React state in `PropertyPageView`.
- The inline thumbnail handler `() => onSelectGallery(item.id)` in `PropertyHero`.
- The `activeIndex` `findIndex` callback and active-image `find` callback.

No next/previous gallery functions exist in the inspected source.

## 24. Hooks

`PropertyPageView` uses:

- `useMemo` for `gallery`.
- `useState` for `activeGalleryId`.
- `useEffect` to reset the selected id when `[property.id, gallery]` changes.

`PropertyHero` uses `forwardRef` from React, but no state/effect hook.

## 25. `next/image` configuration/usage

`PropertyHero` imports `Image` from `next/image`.

- Main image: `fill`, `priority`, `sizes="(max-width: 900px) 100vw, 42vw"`, `className="pd-hero__stage-img"`.
- Thumbnail image: `fill`, `sizes="96px"`, `className="pd-hero__thumb-img"`, `alt=""`.
- Both images rely on a positioned parent (`.pd-hero__stage` or `.pd-hero__thumb`).
- Both use CSS `object-fit: cover` through the shared selector.

No `unoptimized` prop is used by `PropertyHero`.

## 26. Image URLs and remote image handling

Static gallery URLs are public-root relative paths. API `cover_url` is passed through unchanged as the `src` string; there is no URL transformation, proxy function, or gallery-specific validation in the mapper.

`C:\Users\surya\Desktop\ILA-HOMES-PROJECT\next.config.ts` allows Next remote images matching HTTPS hosts under `**.amazonaws.com`. Other remote host behavior is `UNKNOWN — needs verification`. The gallery does not set `unoptimized` for API URLs.

## 27. API/data mapping related to images

`ApiPropertyView` obtains the API property and passes it through `apiPropertyToRecord`. The mapper reads `property.cover_url`, checks it with the local `text(...)` helper, and produces either the one-item gallery or `undefined`.

The API list endpoint also exposes `cover_url`, but the Property Details gallery is initialized from the detail record mapped by `apiPropertyToRecord`; no API image list endpoint is used by this gallery.

## 28. Relationship with `PropertyRecord.gallery`

`PropertyRecord.gallery` is optional and is the local normalized contract consumed by the page. `getPropertyGallery` is the only gallery accessor used by `PropertyPageView`; callers should not read `property.gallery` directly when they need the effective gallery because direct reads do not apply `DEFAULT_GALLERY`.

## 29. Relationship with `PropertyPageView`

`PropertyPageView` is the gallery controller. It obtains the effective gallery, initializes/resets `activeGalleryId`, derives `activeImage`, and passes both data and the selection callback to `PropertyHero`. The same component path is used for local and API-backed records after normalization.

## 30. Relationship with `PropertyHero`

`PropertyHero` is the gallery renderer. It does not fetch images or choose a data source. It renders the supplied active image, count, and all supplied thumbnails, and sends selected item ids back through `onSelectGallery`.

## 31. Relationship with Property Details

The gallery is the image portion of the Property Details hero and is rendered before the other Property Details sections. Its property id reset behavior is tied to the shared page's `property` input. Other Property Details sections do not provide or mutate gallery state.

## 32. Loading behavior

There is no gallery-specific loading state, skeleton, placeholder spinner, or image-loading callback. API property loading occurs in `ApiPropertyView` before the normalized `PropertyPageView` is rendered; the gallery itself renders once the `PropertyRecord` is available.

## 33. Error behavior

There is no gallery-specific `onError` handler or image error UI in `PropertyHero`. API fetch/mapping errors are handled by the surrounding API property flow, not by the gallery. Exact browser/Next image failure presentation is `UNKNOWN — needs verification`.

## 34. Missing-image behavior

For API data, a null/empty `cover_url` maps `gallery` to `undefined`, which causes `getPropertyGallery` to return `DEFAULT_GALLERY`. For local data, an undefined/null `gallery` has the same fallback. A non-empty but invalid `src` is not detected or replaced by gallery code.

## 35. Empty-gallery behavior

An explicitly empty `gallery: []` is preserved because `getPropertyGallery` uses `??`, not a length check. In that case, `activeGalleryId` is `""`, `activeImage` is `undefined`, the main `<Image>` and count are omitted, and the thumbnail list is empty. No separate empty-gallery message is rendered.

## 36. Dependencies

The gallery directly depends on React (`useEffect`, `useMemo`, `useState`, `forwardRef`), Next.js `next/image`, the `PropertyRecord`/`GalleryItem` types, `getPropertyGallery`, and `PropertyDetail.css`. API-backed galleries additionally depend on the property service types and `apiPropertyToRecord`.

## 37. External integrations

The gallery integrates with Next.js image optimization and the configured remote image allowlist. It does not use a third-party carousel, lightbox, CDN SDK, image API, upload service, or image metadata service.

## 38. Known issues

- API properties support only the single `cover_url` image; additional API property images are not mapped by the current implementation.
- API properties without `cover_url` display shared default property photography, which may not depict that API property.
- `gallery: []` produces a blank stage area with no explicit empty-state message.
- Invalid image URLs have no gallery-level error fallback.
- Remote hosts outside the configured `**.amazonaws.com` HTTPS pattern are `UNKNOWN — needs verification`.
- Exact browser behavior when a remote image fails Next image validation or network loading is `UNKNOWN — needs verification`.

## 39. Important constraints

- Preserve the `GalleryItem` fields and id-based selection contract unless all consumers are updated together.
- Use `getPropertyGallery` when resolving the effective gallery so the current default behavior is retained.
- Keep `activeGalleryId` reset behavior tied to property changes; it currently resets to the first effective gallery item.
- Keep `PropertyHero` controlled through `gallery`, `activeImage`, and `onSelectGallery`.
- Keep the `next/image` parent containers positioned when using `fill`.
- Keep `sizes="(max-width: 900px) 100vw, 42vw"` and `sizes="96px"` aligned with the current responsive layout unless the CSS layout changes too.
- API `cover_url` is currently a scalar string/null field, not an image array; do not assume more API image fields are available.
- Do not treat `gallery: []` as equivalent to missing gallery unless the fallback contract is intentionally changed.
- This documentation reflects the current implementation only; planned gallery functionality is not documented.