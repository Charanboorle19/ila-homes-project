# Loading animation feature

## 1. Feature purpose

Every asynchronous state in the application renders one shared indeterminate loader instead of a bespoke spinner or a bare text line. The animation is defined in exactly one file so it can be changed globally without touching components.

## 2. Where it appears

`src/app/loading.css` is imported once in `C:\Users\surya\Desktop\ILA-HOMES-PROJECT\src\app\layout.tsx` immediately after `globals.css`, so the classes are available on every route. The component `<Hero/>` is not involved; this is a pure CSS feature.

## 3. The class contract

| Class | Purpose |
| --- | --- |
| `.ila-loader` | The animation. Box size `55px` by default. |
| `.ila-loader--sm` | Compact size, `30px`, for loaders beside text or inside a pill. |
| `.ila-loader--light` | Light stroke (`#f4f1ea`) for dark surfaces. |

Modifiers compose:

```html
<span class="ila-loader ila-loader--sm ila-loader--light" aria-hidden />
```

A loader is always decorative and always carries `aria-hidden`; the surrounding element keeps `role="status"` or `aria-live` so the text remains the announced content.

## 4. Sizing model — do not "tidy up"

The animation paints eight `25x25` conic-gradient patches in a `55x55` box, so **the box must be roughly `2.2x` the patch size**. At a box smaller than that the four corner patches overlap and the shape degrades into a solid blob instead of the four-corner motion.

The CSS therefore derives the patch from the public size knob:

```css
--ila-loader-size: 55px;                         /* the only knob */
--ila-loader-patch: calc(var(--ila-loader-size) / 2.2);
```

and the keyframes are written as multiples of the patch rather than fixed pixels. The original `35px`/`15px` keyframe values against the original `25px` patch are expressed as `1.4` and `0.6`. Replacing these calcs with literal pixel values is what previously broke the small sizes.

Override the size per instance with a Tailwind arbitrary property:

```html
<span class="ila-loader [--ila-loader-size:40px]" aria-hidden />
```

## 5. Colour

`--ila-loader-color` defaults to `#171717`, intended for light surfaces. Use `.ila-loader--light` for dark ones. Sites currently using the light variant:

- `.emi-appreciation` — `background: #111111`
- `.find-your-plot` — `bg-[#1c1f24]`

`.pd-match` (`src\components\PropertyDetail\PropertyDetail.css`) is also a dark gradient surface and needs `ila-loader--light` if a loading state is ever added there.

## 6. Accessibility

Under `prefers-reduced-motion: reduce` the animation is set to `none`. The loader freezes in its resting pose rather than disappearing, so the state still reads as "working" and the surrounding text still announces. This preserves the earlier `motion-safe:animate-spin` behaviour that `MapSection` relied on.

## 7. Current call sites

| Component | Count | Size | Variant |
| --- | --- | --- | --- |
| `GrowthCorridors` | 3 | `--sm` | default |
| `MapSection` | 2 | `--sm` | default |
| `PropertiesList` | 1 | `--sm` | default |
| `CompareProperties` | 1 | `--sm` | default |
| `FindYourPlot` | 1 | `--sm` | light |
| `EmiAppreciation` | 1 | `--sm` | light |
| `ShortlistShare` | 1 | `--sm` | default |
| `PlotsWithPulse` | 1 | `--sm` | default |
| `FromTheField` | 1 | `--sm` | default |
| `ApiPropertyView` | 1 | `--sm` | default |
| `LegalDocuments` | 2 | `--sm` | default |
| `FutureNeighbourhoodMap` | 1 | `--sm` | default |
| `app/property/[trackingToken]/view/page.tsx` | 1 | `--sm` | default |

Every site keeps its original wording and renders the loader beside the text; no message copy was removed.

## 8. Known issues and constraints

- The old `.ila-map-loader` class was removed from `src/app/globals.css`. Docs that previously listed it — `docs\features\property-popup.md` — have been corrected to reference `.ila-loader`.
- `src/south-hyderabad-growth-corridors.md` still describes a `View on map` control on corridor cards. That file describes a separate corridor UI and was not changed; the header button it describes was removed from `GrowthCorridors` only.
- Exact reduced-motion rendering across browsers is UNKNOWN — needs verification.