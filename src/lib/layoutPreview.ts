import type { PropertyLayoutCords } from "@/services/propertiesService";
import {
  layoutCordsToBounds,
  layoutCordsToCoordinates,
  type LayoutRaster,
  type LayoutRasterImage,
} from "@/data/projects/layoutRasters";

/**
 * The estate master-plan preview (`layout_preview_url` on the units response).
 *
 * The API hands back a presigned PNG: the same master plan the TIFF scan holds,
 * pre-rendered at screen resolution. That makes it the image the map should
 * draw — no geotiff decode, no 2048px resampling, a fraction of the bytes.
 *
 * The bucket serves no `Access-Control-Allow-Origin`, so the bytes cannot be
 * read from the browser directly and MapLibre cannot fetch them either. They
 * come through this app's own origin instead (src/app/api/layout-image/route.ts),
 * are decoded once here, and are handed to the map as an already-decoded image.
 * Doing the fetch in this module rather than letting MapLibre do it is what
 * makes a failure visible: a stale presigned URL answers 403, which the caller
 * needs to know about so it can ask the API for a fresh one.
 */

/** Accepts virtual-hosted and path-style presigned S3 URLs. */
const S3_HOST = /^(?:[a-z0-9][a-z0-9.-]*\.s3(?:[.-][a-z0-9-]+)?|s3(?:[.-][a-z0-9-]+)?)\.amazonaws\.com$/i;

/**
 * Decoded previews are cached: re-opening a property should not re-download a
 * master plan that is already in memory. The cache key is the property id, so a
 * cached image never depends on a presigned URL that may since have expired.
 *
 * A replaced entry is dropped rather than closed, because the map may still be
 * sampling the texture it was uploaded from.
 */
const CACHE_TTL_MS = 45 * 60 * 1000;

/**
 * Decoded previews are capped on both axes, for the same reason the TIFF decode
 * is: the image becomes a WebGL texture, and mobile GPUs commonly cap textures
 * at 2048px per side. The estate is a few hundred metres across, so 2048px is
 * still several pixels per metre once the map is framed on it — and the plot
 * outlines and labels drawn over it are vectors, so they stay sharp regardless.
 */
const MAX_DECODED_EDGE = 2048;

type CacheEntry = { image: LayoutRasterImage; cachedAt: number };

const previewCache = new Map<string, CacheEntry>();

/**
 * Only S3 objects are worth asking the proxy for. Anything else is rejected here
 * rather than by the proxy, so a malformed URL never becomes a request.
 */
export function isProxyableLayoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && S3_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Same-origin URL for a presigned layout URL. MapLibre can load this itself,
 * because CORS does not apply to the site's own origin.
 */
export function layoutImageProxyUrl(layoutUrl: string): string {
  return `/api/layout-image?url=${encodeURIComponent(layoutUrl)}`;
}

/**
 * Fetches a layout preview and returns a MapLibre image-source entry.
 *
 * Returns undefined when the URL will not load — the vector plots are still
 * usable without a master plan, so this is never fatal. A caller holding a
 * presigned URL that may have expired should refetch the units response and try
 * once more with the fresh one.
 */
export async function loadLayoutPreviewRaster(options: {
  /** Cache key, normally the property id. */
  propertyId: string;
  /** Presigned `layout_preview_url` from the units response. */
  previewUrl: string;
  /** Extent of the preview, i.e. `property_layout_cords`. */
  cords: PropertyLayoutCords;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const { propertyId, previewUrl, cords, opacity = 0.85, signal } = options;

  const geometry = {
    coordinates: layoutCordsToCoordinates(cords),
    bounds: layoutCordsToBounds(cords),
  };

  if (!isProxyableLayoutUrl(previewUrl)) {
    console.warn("[ILA map] layout preview url is not an S3 object", previewUrl);
    return undefined;
  }

  const cached = previewCache.get(propertyId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    console.log("[ILA map] reusing the cached layout preview", { propertyId });
    return { id: `${propertyId}-layout`, image: cached.image, opacity, ...geometry };
  }

  const fetched = await fetchLayoutPreview(previewUrl, signal);
  if (!fetched) return undefined;

  if (fetched.kind === "image") {
    previewCache.set(propertyId, {
      image: fetched.image,
      cachedAt: Date.now(),
    });
    return {
      id: `${propertyId}-layout`,
      image: fetched.image,
      opacity,
      ...geometry,
    };
  }

  // No ImageBitmap support: the map loads the preview itself, from the proxy.
  return { id: `${propertyId}-layout`, url: fetched.url, opacity, ...geometry };
}

/** What a successful fetch produced: decoded bytes, or a URL for the map to load. */
type FetchedPreview =
  | { kind: "image"; image: LayoutRasterImage }
  | { kind: "url"; url: string };

/**
 * Reads the proxied preview and decodes it.
 *
 * Decoding here rather than inside MapLibre keeps the bytes off the wire once,
 * and it is why the raster carries an `image` instead of a `url`.
 */
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

    if (typeof createImageBitmap !== "function") {
      console.warn(
        "[ILA map] createImageBitmap unavailable — passing the preview URL to the map instead",
      );
      return { kind: "url", url: proxied };
    }

    const image = await decodePreview(blob);
    console.log(
      `[ILA map] layout preview decoded — ${image.width}x${image.height}`,
    );
    return { kind: "image", image };
  } catch (error) {
    if (signal?.aborted) return null;
    console.warn("[ILA map] layout preview decode failed", error);
    return null;
  }
}

/** Decodes the preview, downscaling anything past the texture-safe size. */
async function decodePreview(blob: Blob): Promise<ImageBitmap> {
  const full = await createImageBitmap(blob);
  const longEdge = Math.max(full.width, full.height);

  // Previews are rendered at screen resolution, so this is the rare case.
  if (longEdge <= MAX_DECODED_EDGE) return full;

  const scale = MAX_DECODED_EDGE / longEdge;
  const resized = await createImageBitmap(full, {
    resizeWidth: Math.max(1, Math.round(full.width * scale)),
    resizeHeight: Math.max(1, Math.round(full.height * scale)),
    resizeQuality: "high",
  });
  console.log(
    `[ILA map] layout preview downscaled — ${full.width}x${full.height} to ${resized.width}x${resized.height}`,
  );
  // The full-size decode is never handed to the map, so release it now.
  full.close();
  return resized;
}