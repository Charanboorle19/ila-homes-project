import {
  layoutCordsToBounds,
  layoutCordsToCoordinates,
  type LayoutRaster,
  type LayoutRasterImage,
} from "@/data/projects/layoutRasters";
import type { PropertyLayoutCords } from "@/services/propertiesService";

/**
 * Inline TIFF support for the estate master plan.
 *
 * MapLibre cannot decode TIFF, and browsers cannot display one either, so the
 * file is decoded in the browser (geotiff.js) and handed to the map as a canvas
 * on an image source. The image is georeferenced with the extent the
 * units API returns (`property_layout_cords`) rather than GeoTIFF tags, which
 * keeps this independent of how the survey was exported.
 *
 * The API's `layout_preview_url` (SVG) is preferred — see @/lib/layoutPreview.
 * This module is only used when a URL is actually a `.tif`/`.tiff`.
 */

/**
 * The presigned TIFF host sends no CORS headers, so the scan is fetched through
 * this app's own origin. See src/app/api/layout-image/route.ts.
 */
const LAYOUT_IMAGE_PROXY = "/api/layout-image";

/**
 * Decoded scans are capped on both axes: WebGL textures are commonly limited to
 * 2048px per side, and a long thin layout export would otherwise slip past an
 * area-only cap.
 */
const MAX_DECODED_EDGE = 2048;
const MAX_DECODED_PIXELS = MAX_DECODED_EDGE * MAX_DECODED_EDGE;

/**
 * The presigned TIFF expires (X-Amz-Expires=3600), so decoded results are
 * cached briefly and re-fetched once the signed URL is likely stale.
 */
const CACHE_TTL_MS = 45 * 60 * 1000;

type CacheEntry = { image: LayoutRasterImage; cachedAt: number };

const rasterCache = new Map<string, CacheEntry>();

/**
 * Fetches a layout TIFF, decodes it and returns a MapLibre image source entry.
 * Returns null when the file is missing or will not decode — the vector plots
 * are still usable without it, so this is never fatal.
 */
export async function loadLayoutRaster(options: {
  /** Cache key, normally the property id. */
  propertyId: string;
  tifUrl: string;
  cords: PropertyLayoutCords;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const { propertyId, tifUrl, cords, opacity = 0.85, signal } = options;

  const cached = rasterCache.get(propertyId);
  let image: LayoutRasterImage;

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    image = cached.image;
  } else {
    const decoded = await decodeTiffToCanvas(tifUrl, signal);
    if (!decoded) return undefined;
    image = decoded;
    rasterCache.set(propertyId, { image, cachedAt: Date.now() });
  }

  return {
    id: `${propertyId}-layout`,
    // The image source is created without a URL in MapSection. Supplying the
    // decoded canvas makes updateImage({ image }) upload it directly instead
    // of asking MapLibre to perform a second URL load.
    image,
    coordinates: layoutCordsToCoordinates(cords),
    opacity,
    bounds: layoutCordsToBounds(cords),
  };
}

/** Decodes a TIFF into a canvas that MapLibre can upload directly. Decodes page 0 by default. */
export async function decodeTiffToCanvas(
  url: string,
  signal?: AbortSignal,
  pageIndex = 0,
): Promise<HTMLCanvasElement | null> {
  const page = await decodeTiffPageToCanvas(url, pageIndex, signal);
  return page ? page.canvas : null;
}

export type DecodedTiffPage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pageIndex: number;
  totalPages: number;
};

/**
 * Inspects a TIFF and returns metadata along with the total page/image count.
 */
export async function getTiffPageCount(
  url: string,
  signal?: AbortSignal,
): Promise<number> {
  try {
    const proxied = `${LAYOUT_IMAGE_PROXY}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxied, { signal });
    if (!response.ok) return 0;
    const buffer = await response.arrayBuffer();
    const { fromArrayBuffer } = await import("geotiff");
    const tiff = await fromArrayBuffer(buffer);
    return await tiff.getImageCount();
  } catch (error) {
    console.warn("[ILA map] getTiffPageCount failed", error);
    return 0;
  }
}

/**
 * Decodes a specific page of a multi-page or standard TIFF onto an HTML5 Canvas.
 */
export async function decodeTiffPageToCanvas(
  url: string,
  pageIndex = 0,
  signal?: AbortSignal,
): Promise<DecodedTiffPage | null> {
  try {
    // Same-origin, because the S3 bucket allows no cross-origin reads.
    const proxied = `${LAYOUT_IMAGE_PROXY}?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxied, { signal });
    if (!response.ok) {
      console.warn(
        "[ILA map] layout TIFF fetch failed",
        response.status,
        response.statusText,
      );
      return null;
    }
    const buffer = await response.arrayBuffer();
    if (signal?.aborted) return null;

    // Loaded on demand: geotiff.js is only needed once a layout is opened.
    const { fromArrayBuffer } = await import("geotiff");
    const tiff = await fromArrayBuffer(buffer);
    const totalPages = await tiff.getImageCount();
    const targetIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    const image = await tiff.getImage(targetIndex);

    const width = image.getWidth();
    const height = image.getHeight();
    if (!width || !height) {
      console.warn("[ILA map] layout TIFF page has no image", {
        width,
        height,
        pageIndex: targetIndex,
      });
      return null;
    }

    // Large scans are resampled during decode; a full-resolution read stays as
    // a fallback for exports the resampler cannot handle.
    const scale = Math.min(
      1,
      MAX_DECODED_EDGE / width,
      MAX_DECODED_EDGE / height,
      Math.sqrt(MAX_DECODED_PIXELS / (width * height)),
    );
    const scaled = {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
    const wantsResample = scale < 1;

    let decoded: { pixels: Uint8ClampedArray; width: number; height: number };

    try {
      decoded = wantsResample
        ? {
            pixels: await readChannels(image, {
              signal,
              width: scaled.width,
              height: scaled.height,
            }),
            width: scaled.width,
            height: scaled.height,
          }
        : {
            pixels: await readChannels(image, { signal }),
            width,
            height,
          };
    } catch (error) {
      console.warn(
        "[ILA API] layout TIFF resample failed, reading full size",
        error,
      );
      try {
        decoded = { pixels: await readChannels(image, { signal }), width, height };
      } catch (fullError) {
        console.warn("[ILA API] layout TIFF readChannels fallback with readRasters", fullError);
        const rasters = (await image.readRasters({ signal })) as unknown;
        const normalized = normalizeRastersToUint8(rasters, width, height);
        decoded = { pixels: normalized, width, height };
      }
    }

    const rgba = toRgba(decoded.pixels, decoded.width * decoded.height);
    if (!rgba) {
      console.warn(
        "[ILA map] layout TIFF has an unsupported channel layout",
        decoded.pixels.length,
        "pixelCount:",
        decoded.width * decoded.height,
      );
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[ILA map] no 2d canvas context available");
      return null;
    }

    const raster = ctx.createImageData(decoded.width, decoded.height);
    raster.data.set(rgba);
    ctx.putImageData(raster, 0, 0);

    console.info(
      `[ILA map] layout TIFF decoded successfully: ${decoded.width}x${decoded.height} (page ${targetIndex + 1}/${totalPages})`,
    );

    return {
      canvas,
      width: decoded.width,
      height: decoded.height,
      pageIndex: targetIndex,
      totalPages,
    };
  } catch (error) {
    console.warn("[ILA map] layout TIFF page decode failed", error);
    return null;
  }
}

/**
 * Handles planar (array of typed arrays) or interleaved raster buffers, converting
 * any sample format (Uint8, Uint16, Float32, etc.) to 8-bit bytes.
 */
function normalizeRastersToUint8(
  rasters: unknown,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixelCount = width * height;
  if (!rasters || pixelCount <= 0) return new Uint8ClampedArray(0);

  // Case 1: Separate bands / planar: Array of TypedArrays [R, G, B] or [R, G, B, A]
  if (Array.isArray(rasters) && rasters.length > 0 && "length" in (rasters[0] || {})) {
    const bands = rasters as ArrayLike<number>[];
    const numBands = Math.min(bands.length, 4);
    const out = new Uint8ClampedArray(pixelCount * numBands);

    for (let p = 0; p < pixelCount; p += 1) {
      for (let b = 0; b < numBands; b += 1) {
        const val = bands[b][p] ?? 0;
        out[p * numBands + b] = val > 255 ? Math.round(val / 256) : val;
      }
    }
    return out;
  }

  // Case 2: Interleaved TypedArray
  const raw = rasters as ArrayLike<number>;
  const out = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    const val = raw[i];
    out[i] = val > 255 ? Math.round(val / 256) : val;
  }
  return out;
}

/**
 * Normalises geotiff output to RGBA.
 *
 * `readRGB` does not always return four channels: `enableAlpha` only adds an
 * alpha channel when the file actually carries one, so an opaque RGB layout
 * scan comes back with three samples per pixel. ImageData is fixed at RGBA, so
 * the stride is measured and expanded here — assuming 4 would silently drop a
 * quarter of every scan.
 */
function toRgba(pixels: Uint8ClampedArray, pixelCount: number) {
  if (!pixelCount) return null;

  const stride = pixels.length / pixelCount;
  if (
    !Number.isInteger(stride) ||
    stride < 1 ||
    stride > 4
  ) {
    return null;
  }

  // Already RGBA.
  if (stride === 4) return pixels;

  const out = new Uint8ClampedArray(pixelCount * 4);

  if (stride === 3) {
    for (let p = 0; p < pixelCount; p += 1) {
      const s = p * 3;
      const d = p * 4;
      out[d] = pixels[s];
      out[d + 1] = pixels[s + 1];
      out[d + 2] = pixels[s + 2];
      out[d + 3] = 255;
    }
    return out;
  }

  // 1 = grey, 2 = grey + alpha.
  for (let p = 0; p < pixelCount; p += 1) {
    const s = p * stride;
    const d = p * 4;
    const grey = pixels[s];
    out[d] = grey;
    out[d + 1] = grey;
    out[d + 2] = grey;
    out[d + 3] = stride === 2 ? pixels[s + 1] : 255;
  }
  return out;
}

/**
 * Reads the scan's channels as bytes. geotiff types its output as a union of
 * typed arrays, so the values are copied into a plain byte array; the channel
 * count is whatever the file actually carries and is resolved by toRgba.
 */
async function readChannels(
  image: {
    readRGB: (options: {
      interleave: boolean;
      enableAlpha?: boolean;
      width?: number;
      height?: number;
      signal?: AbortSignal;
    }) => Promise<unknown>;
  },
  options: {
    signal?: AbortSignal;
    width?: number;
    height?: number;
  },
) {
  const raw = (await image.readRGB({
    interleave: true,
    enableAlpha: true,
    ...options,
  })) as ArrayLike<number>;

  // Preallocated rather than `.from()` so the result is backed by a plain
  // ArrayBuffer, which is what ImageData accepts.
  const pixels = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i += 1) pixels[i] = raw[i];
  return pixels;
}