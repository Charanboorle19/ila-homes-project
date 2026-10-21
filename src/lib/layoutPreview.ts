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
 *   1. SVG  — native markup → HTML overlay (sharp under GeoJSON plots)
 *   2. TIFF — decoded via `@/lib/layoutTiff` → MapLibre image source
 *   3. PNG  — (also JPEG/WebP) decoded bitmap → MapLibre image source
 *
 * Georeference uses `property_layout_cords` (NW→NE→SE→SW). Bytes come through
 * `/api/layout-image` because the bucket has no CORS headers.
 */

/** Accepts virtual-hosted and path-style presigned S3 URLs, CloudFront, DigitalOcean Spaces, or API host. */
const ALLOWED_HOST =
  /^(?:(?:[a-z0-9][a-z0-9.-]*\.)?(?:s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com|cloudfront\.net|digitaloceanspaces\.com)|realestate\.sperow\.in)$/i;

const CACHE_TTL_MS = 45 * 60 * 1000;
/** Align with TIFF path — MapLibre texture upload (see resolveLayoutMaxDecodedEdge). */
const HARD_MAX_DECODED_EDGE = 8192;

export type LayoutImageFormat = "svg" | "tiff" | "png";

/** How a candidate should be loaded. */
export type LayoutImageLoader = "svg-html" | "tiff" | "raster";

export type LayoutImageCandidate = {
  url: string;
  format: LayoutImageFormat;
  loader: LayoutImageLoader;
};

type CacheEntry =
  | { kind: "svg"; markup: string; cachedAt: number }
  | { kind: "image"; image: LayoutRasterImage; cachedAt: number };

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
 * Fetches a layout preview and returns a MapLibre / HTML-overlay entry.
 *
 * SVG → `svgMarkup` (HTML overlay).
 * PNG/JPEG/WebP → decoded `ImageBitmap` for the native MapLibre `image` source
 *   (`estate-layout-image`), georeferenced with NW→NE→SE→SW corners — no DOM
 *   wrapper, so pan/zoom stay locked to the WebGL pipeline under GeoJSON plots.
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
    if (cached.kind === "svg") {
      return {
        id: `${propertyId}-layout`,
        svgMarkup: cached.markup,
        opacity,
        ...geometry,
      };
    }
    return {
      id: `${propertyId}-layout`,
      image: cached.image,
      opacity,
      ...geometry,
    };
  }

  const fetched = await fetchLayoutPreview(previewUrl, signal);
  if (!fetched) return undefined;

  if (fetched.kind === "svg") {
    previewCache.set(propertyId, {
      kind: "svg",
      markup: fetched.markup,
      cachedAt: Date.now(),
    });
    console.log("[ILA map] layout SVG ready for HTML overlay", {
      propertyId,
      coordinates: geometry.coordinates,
      bounds: geometry.bounds,
    });
    return {
      id: `${propertyId}-layout`,
      svgMarkup: fetched.markup,
      opacity,
      ...geometry,
    };
  }

  previewCache.set(propertyId, {
    kind: "image",
    image: fetched.image,
    cachedAt: Date.now(),
  });
  console.log("[ILA map] layout PNG registered for MapLibre image source", {
    propertyId,
    size: `${fetched.image.width}x${fetched.image.height}`,
    coordinates: geometry.coordinates,
  });
  return {
    id: `${propertyId}-layout`,
    image: fetched.image,
    opacity,
    ...geometry,
  };
}

type FetchedPreview =
  | { kind: "svg"; markup: string }
  | { kind: "image"; image: LayoutRasterImage };

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
    console.log(
      `[ILA map] layout preview fetched — ${blob.size} bytes, ${blob.type || "unknown type"}, ${new URL(previewUrl).host}`,
    );

    const preferSvg =
      mimeLooksLikeSvg(blob.type) || urlLooksLikeSvg(previewUrl);

    if (preferSvg) {
      const text = await blob.text();
      if (!textLooksLikeSvg(text)) {
        console.warn("[ILA map] layout URL looked like SVG but bytes were not");
        return null;
      }
      return { kind: "svg", markup: prepareSvgMarkup(text) };
    }

    const head = await blob.slice(0, 512).text();
    if (textLooksLikeSvg(head)) {
      const text = await blob.text();
      return { kind: "svg", markup: prepareSvgMarkup(text) };
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
 * Normalize root `<svg>` so it fills the georeferenced HTML box
 * (`preserveAspectRatio="none"` matches MapLibre image-source stretch).
 */
function prepareSvgMarkup(svgText: string): string {
  let text = svgText.trim();

  if (/<svg\b/i.test(text) && !/<svg\b[^>]*xmlns=/i.test(text)) {
    text = text.replace(
      /<svg\b/i,
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
  }

  text = text.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let next = String(attrs)
      .replace(/\spreserveAspectRatio\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sstyle\s*=\s*["'][^"']*["']/gi, "");
    return `<svg${next} preserveAspectRatio="none" style="display:block;width:100%;height:100%">`;
  });

  return text;
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
 * Pixels per metre at a latitude / MapLibre zoom — available for callers that
 * prefer a scale transform over `map.project`.
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  const latRad = (latitude * Math.PI) / 180;
  return (156543.03392 * Math.cos(latRad)) / 2 ** zoom;
}
