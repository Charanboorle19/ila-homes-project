import type { PropertyLayoutCords } from "@/services/propertiesService";
import {
  layoutCordsToBounds,
  layoutCordsToCoordinates,
  type LayoutRaster,
  type LayoutRasterImage,
} from "@/data/projects/layoutRasters";

/**
 * The estate master-plan preview (`layout_preview_url` / `tif_url` on units).
 *
 * Format priority (highest → lowest):
 *   1. SVG  — rasterized to ImageBitmap → MapLibre image source
 *   2. TIFF — decoded via `@/lib/layoutTiff` → MapLibre image source
 *   3. PNG  — (also JPEG/WebP) decoded bitmap → MapLibre image source
 *
 * Georeference uses `property_layout_cords` in EPSG:4326 (WGS84 lon/lat
 * degrees), corners NW→NE→SE→SW as [lng, lat] — same as a MapLibre `image`
 * source (`[WEST,NORTH]…[WEST,SOUTH]`). The decoded bitmap is uploaded as-is
 * (no mercator letterboxing); QGIS/EPSG:4326 exports already match those corners.
 * Bytes come through `/api/layout-image` because the bucket has no CORS headers.
 */

/** Accepts virtual-hosted and path-style presigned S3 URLs, CloudFront, DigitalOcean Spaces, or API host. */
const ALLOWED_HOST =
  /^(?:(?:[a-z0-9][a-z0-9.-]*\.)?(?:s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com|cloudfront\.net|digitaloceanspaces\.com)|realestate\.sperow\.in)$/i;

const CACHE_TTL_MS = 45 * 60 * 1000;
/** Align with TIFF path — MapLibre texture upload (see resolveLayoutMaxDecodedEdge). */
const HARD_MAX_DECODED_EDGE = 8192;

export type LayoutImageFormat = "svg" | "tiff" | "png";

/**
 * Unit status palette used for layout rendering.
 * AVAILABLE keeps its vibrant emerald tone while non-available statuses
 * (BOOKED, SOLD, BLOCKED) use pure black/dark shades.
 */
export const UNIT_STATUS_COLORS = {
  AVAILABLE: "#10B981", // vibrant, attractive emerald green
  BOOKED: "#000000",    // black shade
  SOLD: "#000000",      // black shade
  BLOCKED: "#000000",   // black shade
} as const;

export type UnitStatus = keyof typeof UNIT_STATUS_COLORS;

export function getUnitStatusColor(status?: string | null): string {
  const normalized = (status || "").trim().toUpperCase();
  if (normalized === "AVAILABLE") return UNIT_STATUS_COLORS.AVAILABLE;
  if (normalized === "BOOKED") return UNIT_STATUS_COLORS.BOOKED;
  if (normalized === "SOLD") return UNIT_STATUS_COLORS.SOLD;
  if (normalized === "BLOCKED") return UNIT_STATUS_COLORS.BLOCKED;
  return UNIT_STATUS_COLORS.BLOCKED; // fallback to black shade for any non-available/unknown status
}


/** How a candidate should be loaded. */
export type LayoutImageLoader = "svg-html" | "tiff" | "raster";

export type LayoutImageCandidate = {
  url: string;
  format: LayoutImageFormat;
  loader: LayoutImageLoader;
};

type CacheEntry = { kind: "image"; image: LayoutRasterImage; cachedAt: number };

const previewCache = new Map<string, CacheEntry>();

export function isProxyableLayoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function layoutImageProxyUrl(layoutUrl: string): string {
  return `/api/layout-image?url=${encodeURIComponent(layoutUrl)}`;
}

function pathFromUrl(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Detect layout image format from the URL path (query string ignored).
 * Unknown extensions default to PNG-family raster (last priority).
 */
export function detectLayoutImageFormat(url: string): LayoutImageFormat {
  const path = pathFromUrl(url);
  if (path.endsWith(".svg") || path.endsWith(".svgz") || /\.svgz?(?:$|\?)/i.test(url)) {
    return "svg";
  }
  if (path.endsWith(".tif") || path.endsWith(".tiff") || /\.tiff?(?:$|\?)/i.test(url)) {
    return "tiff";
  }
  // .png, .jpg, .jpeg, .webp, or extension-less presigned objects → PNG priority tier
  return "png";
}

function loaderForFormat(format: LayoutImageFormat): LayoutImageLoader {
  if (format === "svg") return "svg-html";
  if (format === "tiff") return "tiff";
  return "raster";
}

const FORMAT_PRIORITY: Record<LayoutImageFormat, number> = {
  svg: 0,
  tiff: 1,
  png: 2,
};

/**
 * Build the ordered list of layout URLs to try: SVG first, then TIFF, then PNG.
 * Both `layout_preview_url` and `tif_url` are considered; duplicates are dropped.
 */
export function resolveLayoutImageCandidates(
  layoutPreviewUrl: string | null | undefined,
  tifUrl: string | null | undefined,
): LayoutImageCandidate[] {
  const seen = new Set<string>();
  const candidates: LayoutImageCandidate[] = [];

  for (const raw of [layoutPreviewUrl, tifUrl]) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    const format = detectLayoutImageFormat(raw);
    candidates.push({
      url: raw,
      format,
      loader: loaderForFormat(format),
    });
  }

  candidates.sort(
    (a, b) => FORMAT_PRIORITY[a.format] - FORMAT_PRIORITY[b.format],
  );
  return candidates;
}

function mimeLooksLikeSvg(blobType?: string): boolean {
  return Boolean(blobType && /svg/i.test(blobType));
}

function textLooksLikeSvg(text: string): boolean {
  return /^\s*(?:<\?xml\b[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(text);
}

function urlLooksLikeSvg(url: string): boolean {
  return detectLayoutImageFormat(url) === "svg";
}

/**
 * Fetches a layout preview and returns a MapLibre image-source entry.
 *
 * SVG → rasterized `ImageBitmap` (no HTML DOM overlay).
 * PNG/JPEG/WebP → decoded `ImageBitmap` for the native MapLibre `image` source
 *   (`estate-layout-image`), georeferenced with NW→NE→SE→SW corners — pan/zoom
 *   stay locked to the WebGL pipeline under GeoJSON plots.
 * TIFF must be loaded via `@/lib/layoutTiff` (`loadLayoutRaster`), not this helper.
 */
export async function loadLayoutPreviewRaster(options: {
  propertyId: string;
  previewUrl: string;
  cords: PropertyLayoutCords;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const { propertyId, previewUrl, cords, opacity = 0.9, signal } = options;

  const geometry = {
    coordinates: layoutCordsToCoordinates(cords),
    bounds: layoutCordsToBounds(cords),
  };

  if (!isProxyableLayoutUrl(previewUrl)) {
    console.warn("[ILA map] layout preview url is not an S3 object", previewUrl);
    return undefined;
  }

  // TIFF must not go through the raster/SVG decoder.
  if (detectLayoutImageFormat(previewUrl) === "tiff") {
    console.warn(
      "[ILA map] loadLayoutPreviewRaster called with a TIFF URL — use loadLayoutRaster",
      previewUrl,
    );
    return undefined;
  }

  const cached = previewCache.get(propertyId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log("[ILA map] reusing the cached layout preview", {
      propertyId,
      kind: cached.kind,
      coordinates: geometry.coordinates,
    });
    return {
      id: `${propertyId}-layout`,
      image: cached.image,
      opacity,
      ...geometry,
    };
  }

  const fetched = await fetchLayoutPreview(previewUrl, signal);
  if (!fetched) return undefined;
  if (signal?.aborted) return undefined;

  const image = fetched.image;
  previewCache.set(propertyId, {
    kind: "image",
    image,
    cachedAt: Date.now(),
  });
  console.log("[ILA map] layout preview registered for MapLibre image source", {
    propertyId,
    size: `${image.width}x${image.height}`,
    coordinates: geometry.coordinates,
  });
  return {
    id: `${propertyId}-layout`,
    image,
    opacity,
    ...geometry,
  };
}

type FetchedPreview = { kind: "image"; image: LayoutRasterImage };

/**
 * Prints the S3 layout asset itself in DevTools (image thumbnail + metadata).
 * Uses a blob object URL so Chrome/Edge show the picture inline in the console.
 */
function logS3LayoutImageToConsole(
  label: string,
  data: Blob | ArrayBuffer | string,
  meta: { previewUrl?: string; contentType?: string },
): void {
  const contentType =
    meta.contentType ||
    (data instanceof Blob ? data.type : "") ||
    (typeof data === "string" ? "image/svg+xml" : "application/octet-stream");

  const blob =
    data instanceof Blob
      ? data
      : new Blob([typeof data === "string" ? data : data], { type: contentType });

  const objectUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const previewH = Math.min(160, img.naturalHeight || 160);
    const previewW =
      img.naturalWidth && img.naturalHeight
        ? Math.max(40, Math.round((previewH * img.naturalWidth) / img.naturalHeight))
        : 160;
    console.log(`[ILA map] ${label}`, {
      previewUrl: meta.previewUrl,
      contentType: blob.type || contentType,
      sizeBytes: blob.size,
      width: img.naturalWidth,
      height: img.naturalHeight,
      objectUrl,
    });
    console.log(
      `%c `,
      `font-size:1px;padding:${previewH}px ${previewW}px;background:url(${JSON.stringify(objectUrl)}) center / contain no-repeat;`,
    );
    console.log("[ILA map] S3 layout <img>", img);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };
  img.onerror = () => {
    // TIFF / odd types often fail in <img>; still expose the blob for inspection.
    console.log(`[ILA map] ${label} (blob — browser could not preview as <img>)`, {
      previewUrl: meta.previewUrl,
      contentType: blob.type || contentType,
      sizeBytes: blob.size,
      objectUrl,
      blob,
    });
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };
  img.src = objectUrl;
}

async function fetchLayoutPreview(
  previewUrl: string,
  signal?: AbortSignal,
): Promise<FetchedPreview | null> {
  const proxied = layoutImageProxyUrl(previewUrl);

  try {
    const response = await fetch(proxied, { signal });
    if (!response.ok) {
      console.warn(
        "[ILA map] layout preview fetch failed",
        response.status,
        response.statusText,
      );
      return null;
    }

    const blob = await response.blob();
    if (signal?.aborted) return null;
    logS3LayoutImageToConsole("S3 layout image (cold fetch)", blob, {
      previewUrl,
      contentType: blob.type,
    });

    const preferSvg =
      mimeLooksLikeSvg(blob.type) || urlLooksLikeSvg(previewUrl);

    if (preferSvg) {
      const text = await blob.text();
      if (!textLooksLikeSvg(text)) {
        console.warn("[ILA map] layout URL looked like SVG but bytes were not");
        return null;
      }
      const image = await rasterizeSvgToImageBitmap(text);
      if (signal?.aborted) return null;
      return { kind: "image", image };
    }

    const head = await blob.slice(0, 512).text();
    if (textLooksLikeSvg(head)) {
      const text = await blob.text();
      const image = await rasterizeSvgToImageBitmap(text);
      if (signal?.aborted) return null;
      return { kind: "image", image };
    }

    try {
      const image = await decodeRasterPreview(blob);
      return { kind: "image", image };
    } catch (decodeErr) {
      if (signal?.aborted) return null;
      console.warn("[ILA map] layout preview decode failed", decodeErr);
      return null;
    }
  } catch (error) {
    if (signal?.aborted) return null;
    console.warn("[ILA map] layout preview fetch failed", error);
    return null;
  }
}

/**
 * Ensure xmlns. Use `preserveAspectRatio="none"` so the SVG fills the bitmap
 * edge-to-edge; MapLibre then maps those edges to EPSG:4326 corners (same as
 * a georeferenced PNG overlay).
 */
export function prepareSvgMarkup(svgText: string): string {
  let text = svgText.trim();

  if (/<svg\b/i.test(text) && !/<svg\b[^>]*xmlns=/i.test(text)) {
    text = text.replace(
      /<svg\b/i,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }

  text = text.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let next = String(attrs).replace(
      /\spreserveAspectRatio\s*=\s*["'][^"']*["']/gi,
      "",
    );
    return `<svg${next} preserveAspectRatio="none">`;
  });

  // Inject CSS rules to enforce solid black shade on non-available statuses
  // (BOOKED, SOLD, BLOCKED) while leaving AVAILABLE bright.
  const statusStyles = `
    <style id="ila-status-shades">
      .status-available, [data-status="available" i], [data-status="AVAILABLE"], .available { fill: ${UNIT_STATUS_COLORS.AVAILABLE} !important; fill-opacity: 1 !important; stroke: #047857 !important; stroke-width: 1.5px !important; }
      .status-booked, [data-status="booked" i], [data-status="BOOKED"], .booked { fill: ${UNIT_STATUS_COLORS.BOOKED} !important; fill-opacity: 0.35 !important; }
      .status-sold, [data-status="sold" i], [data-status="SOLD"], .sold { fill: ${UNIT_STATUS_COLORS.SOLD} !important; fill-opacity: 0.35 !important; }
      .status-blocked, [data-status="blocked" i], [data-status="BLOCKED"], .blocked { fill: ${UNIT_STATUS_COLORS.BLOCKED} !important; fill-opacity: 0.35 !important; }
    </style>
  `.trim();

  if (text.includes("</svg>")) {
    text = text.replace("</svg>", `${statusStyles}</svg>`);
  }

  return text;
}

/**
 * Rasterize SVG markup to an ImageBitmap for MapLibre's GPU image source.
 * Avoids injecting raw SVG into the HTML overlay DOM.
 */
async function rasterizeSvgToImageBitmap(
  svgText: string,
): Promise<LayoutRasterImage> {
  const prepared = prepareSvgMarkup(svgText);
  const svgBlob = new Blob([prepared], { type: "image/svg+xml" });
  const blobUrl = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = blobUrl;
    await img.decode();
    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(img);
    }
    // Fallback: keep a clone that does not depend on the revoked blob URL.
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return img;
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode layout image"));
    img.src = url;
  });
}

function resolvePngMaxDecodedEdge(): number {
  let gpuMax = 4096;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
    if (gl) {
      const reported = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (typeof reported === "number" && reported > 0) gpuMax = reported;
    }
  } catch {
    // Keep the conservative default.
  }
  return Math.min(gpuMax, HARD_MAX_DECODED_EDGE);
}

async function decodeRasterPreview(blob: Blob): Promise<LayoutRasterImage> {
  if (typeof createImageBitmap !== "function") {
    return loadHtmlImage(URL.createObjectURL(blob));
  }

  const full = await createImageBitmap(blob);
  const maxEdge = resolvePngMaxDecodedEdge();
  const longEdge = Math.max(full.width, full.height);
  if (longEdge <= maxEdge) return full;

  const scale = maxEdge / longEdge;
  const resized = await createImageBitmap(full, {
    resizeWidth: Math.max(1, Math.round(full.width * scale)),
    resizeHeight: Math.max(1, Math.round(full.height * scale)),
    resizeQuality: "high",
  });
  full.close();
  return resized;
}

/**
 * Build a LayoutRaster from a prefetched `/api/layout-image` payload
 * (SVG text or PNG-family ArrayBuffer). TIFF must use `loadLayoutRasterFromBuffer`.
 * SVG is rasterized to ImageBitmap — never returned as `svgMarkup` for DOM injection.
 */
export async function loadLayoutPreviewFromPrefetch(options: {
  propertyId: string;
  previewUrl: string;
  cords: PropertyLayoutCords;
  data: string | ArrayBuffer;
  contentType?: string;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const {
    propertyId,
    previewUrl,
    cords,
    data,
    contentType = "",
    opacity = 0.9,
    signal,
  } = options;

  if (signal?.aborted) return undefined;
  if (detectLayoutImageFormat(previewUrl) === "tiff") {
    console.warn(
      "[ILA map] loadLayoutPreviewFromPrefetch called with a TIFF URL — use loadLayoutRasterFromBuffer",
      previewUrl,
    );
    return undefined;
  }

  const geometry = {
    coordinates: layoutCordsToCoordinates(cords),
    bounds: layoutCordsToBounds(cords),
  };

  logS3LayoutImageToConsole("S3 layout image (prefetch)", data, {
    previewUrl,
    contentType,
  });

  const preferSvg =
    typeof data === "string" ||
    mimeLooksLikeSvg(contentType) ||
    urlLooksLikeSvg(previewUrl);

  if (preferSvg) {
    const text =
      typeof data === "string"
        ? data
        : new TextDecoder().decode(data);
    if (!textLooksLikeSvg(text)) {
      console.warn("[ILA map] prefetched layout looked like SVG but bytes were not");
      return undefined;
    }
    try {
      const image = await rasterizeSvgToImageBitmap(text);
      if (signal?.aborted) return undefined;
      previewCache.set(propertyId, {
        kind: "image",
        image,
        cachedAt: Date.now(),
      });
      return {
        id: `${propertyId}-layout`,
        image,
        opacity,
        ...geometry,
      };
    } catch (svgErr) {
      if (signal?.aborted) return undefined;
      console.warn("[ILA map] prefetched SVG rasterize failed", svgErr);
      return undefined;
    }
  }

  try {
    const blob = new Blob(
      [typeof data === "string" ? data : new Uint8Array(data)],
      { type: contentType || "application/octet-stream" },
    );
    const image = await decodeRasterPreview(blob);
    if (signal?.aborted) return undefined;
    previewCache.set(propertyId, {
      kind: "image",
      image,
      cachedAt: Date.now(),
    });
    return {
      id: `${propertyId}-layout`,
      image,
      opacity,
      ...geometry,
    };
  } catch (decodeErr) {
    if (signal?.aborted) return undefined;
    console.warn("[ILA map] prefetched layout raster decode failed", decodeErr);
    return undefined;
  }
}

/**
 * Pixels per metre at a latitude / MapLibre zoom — available for callers that
 * prefer a scale transform over `map.project`.
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / 2 ** zoom;
}
