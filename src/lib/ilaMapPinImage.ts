/**
 * Renders the branded ILA map pin (monogram + needle) to MapLibre images.
 * Paths match `src/components/logos/ILA-ICON.html` / the former HTML marker SVG.
 */

export const ILA_PIN_IMAGE_ID = "ila-pin";
export const ILA_PIN_HIGHLIGHT_IMAGE_ID = "ila-pin-highlight";
export const ILA_PIN_COMPARE_IMAGE_ID = "ila-pin-compare";
/** Stretchable pill behind pin price labels (`icon-text-fit`). */
export const ILA_PIN_LABEL_BG_IMAGE_ID = "ila-pin-label-bg";
/** Gold pill for compare-index badges on pins. */
export const ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID = "ila-pin-label-bg-compare";

type PinVariant = "default" | "highlight" | "compare";
type LabelBgVariant = "default" | "compare";

const PIN_W = 72;
const PIN_H = 100;
/** Retina density for crisp pins on mobile. */
const PIXEL_RATIO = 2;

function pinColors(variant: PinVariant) {
  if (variant === "highlight") {
    return {
      core: "#c6a46c",
      icon: "#111111",
      ring: "#111111",
      outer: "#ffffff",
      needle: "#111111",
      tipStroke: "#111111",
    };
  }
  if (variant === "compare") {
    return {
      core: "#c6a46c",
      icon: "#111111",
      ring: "#ffffff",
      outer: "#111111",
      needle: "#111111",
      tipStroke: "#c6a46c",
    };
  }
  return {
    core: "#111111",
    icon: "#c6a46c",
    ring: "#c6a46c",
    outer: "#ffffff",
    needle: "#111111",
    tipStroke: "#c6a46c",
  };
}

/** Gold-and-charcoal teardrop pin with the I–L–A mark from ILA-ICON.html. */
export function buildIlaPinSvg(variant: PinVariant = "default"): string {
  const c = pinColors(variant);
  const w = PIN_W * PIXEL_RATIO;
  const h = PIN_H * PIXEL_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${PIN_W} ${PIN_H}">
  <circle cx="36" cy="30" r="21" fill="${c.outer}" fill-opacity="0.92"/>
  <circle cx="36" cy="30" r="20" fill="${c.outer}"/>
  <circle cx="36" cy="30" r="17" fill="${c.core}" stroke="${c.ring}" stroke-width="3"/>
  <g transform="translate(36 30) scale(0.068) translate(-390 -272.5)" fill="${c.icon}">
    <rect x="311" y="216" width="19" height="112"/>
    <path d="M 339 216 H 358 V 300 H 405 V 328 H 361 Q 339 328 339 306 Z"/>
    <path fill-rule="evenodd" d="M 378 296 L 414 216 H 434 L 470 296 H 449 L 441 278 H 406 L 398 296 Z M 412 262 H 435 L 424 236 Z"/>
  </g>
  <rect x="34" y="46" width="4" height="14" fill="${c.needle}" stroke="${c.outer}" stroke-width="1"/>
  <g transform="translate(36 64) rotate(45)">
    <rect x="-5" y="-5" width="10" height="10" rx="1" fill="${c.needle}" stroke="${c.tipStroke}" stroke-width="2"/>
  </g>
</svg>`;
}

/**
 * Rounded price-tag sprite for MapLibre `icon-text-fit: both`.
 *
 * A warm ivory card with a gold hairline, a short gold accent rule on the left
 * and a soft baked drop shadow, so tags stay legible over satellite imagery
 * without looking like a generic white pill. The 76×36 canvas leaves room for
 * the shadow; `MapSection` maps the `[26, 14, 126, 62]` content box to the text.
 */
export function buildIlaPinLabelBgSvg(variant: LabelBgVariant = "default"): string {
  const isCompare = variant === "compare";
  const fill = isCompare ? "#c6a46c" : "#fffdf8";
  const stroke = isCompare ? "#111111" : "#c6a46c";
  const strokeOpacity = isCompare ? 0.35 : 1;
  const w = 76 * PIXEL_RATIO;
  const h = 36 * PIXEL_RATIO;
  const accent = isCompare
    ? ""
    : `<rect x="11" y="13.5" width="2.5" height="11" rx="1.25" fill="#c6a46c"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 76 36">
  <defs>
    <filter id="ilaPinTagShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="1.2" stdDeviation="1.3" flood-color="#0b0d0c" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect x="6" y="4" width="64" height="28" rx="5" ry="5" fill="${fill}" fill-opacity="0.98" stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="1.25" filter="url(#ilaPinTagShadow)"/>
  ${accent}
</svg>`;
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode ILA pin SVG"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export type IlaPinImages = {
  default: HTMLImageElement;
  highlight: HTMLImageElement;
  compare: HTMLImageElement;
  labelBg: HTMLImageElement;
  labelBgCompare: HTMLImageElement;
};

let pinImagesPromise: Promise<IlaPinImages> | null = null;

export function loadIlaPinImages(): Promise<IlaPinImages> {
  if (!pinImagesPromise) {
    pinImagesPromise = Promise.all([
      loadSvgImage(buildIlaPinSvg("default")),
      loadSvgImage(buildIlaPinSvg("highlight")),
      loadSvgImage(buildIlaPinSvg("compare")),
      loadSvgImage(buildIlaPinLabelBgSvg("default")),
      loadSvgImage(buildIlaPinLabelBgSvg("compare")),
    ]).then(([defaultImg, highlight, compare, labelBg, labelBgCompare]) => ({
      default: defaultImg,
      highlight,
      compare,
      labelBg,
      labelBgCompare,
    }));
  }
  return pinImagesPromise;
}

export const ILA_PIN_PIXEL_RATIO = PIXEL_RATIO;
