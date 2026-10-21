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
 * MapLibre cannot decode TIFF natively, so the file is decoded with geotiff.js
 * into an ImageBitmap and handed to the MapLibre image source. Georeference
 * uses `property_layout_cords` in EPSG:4326 (not GeoTIFF tags).
 *
 * Format priority (SVG → TIFF → PNG) lives in `@/lib/layoutPreview`.
 */

const LAYOUT_IMAGE_PROXY = "/api/layout-image";

/**
 * MapLibre uploads the layout as a single WebGL texture. Soft-capping at 2048
 * made estate TIFFs look pixelated when zoomed in; we decode up to the GPU's
 * MAX_TEXTURE_SIZE (capped at 8192 to bound RGBA memory ≈ 256MB).
 */
const HARD_MAX_DECODED_EDGE = 8192;
/** Busts in-memory entries from the old 2048px decode path. */
const CACHE_GEN = "hires-v1";
const CACHE_TTL_MS = 45 * 60 * 1000;

type CacheEntry = { image: LayoutRasterImage; cachedAt: number };

const rasterCache = new Map<string, CacheEntry>();

function cacheKey(propertyId: string): string {
  return `${propertyId}:${CACHE_GEN}`;
}

/** Longest edge we will decode for the MapLibre image source. */
export function resolveLayoutMaxDecodedEdge(): number {
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

/**
 * Fetches a layout TIFF, decodes it, and returns a MapLibre image-source entry.
 * Returns undefined when the file is missing or will not decode.
 */
export async function loadLayoutRaster(options: {
  propertyId: string;
  tifUrl: string;
  cords: PropertyLayoutCords;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const { propertyId, tifUrl, cords, opacity = 0.85, signal } = options;
  const key = cacheKey(propertyId);

  const cached = rasterCache.get(key);
  let image: LayoutRasterImage;

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    image = cached.image;
    console.log("[ILA map] reusing cached layout TIFF", {
      propertyId,
      size: `${image.width}x${image.height}`,
    });
  } else {
    const decoded = await decodeTiffToDisplayImage(tifUrl, signal);
    if (!decoded) return undefined;
    image = decoded;
    rasterCache.set(key, { image, cachedAt: Date.now() });
  }

  return {
    id: `${propertyId}-layout`,
    image,
    coordinates: layoutCordsToCoordinates(cords),
    opacity,
    bounds: layoutCordsToBounds(cords),
  };
}

/**
 * Decode a prefetched TIFF ArrayBuffer into a MapLibre layout raster entry.
 */
export async function loadLayoutRasterFromBuffer(options: {
  propertyId: string;
  buffer: ArrayBuffer;
  cords: PropertyLayoutCords;
  opacity?: number;
  signal?: AbortSignal;
}): Promise<LayoutRaster | undefined> {
  const { propertyId, buffer, cords, opacity = 0.85, signal } = options;
  const key = cacheKey(propertyId);

  const cached = rasterCache.get(key);
  let image: LayoutRasterImage;

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    image = cached.image;
  } else {
    const page = await decodeTiffBufferToCanvas(buffer, 0, signal);
    if (!page) return undefined;
    try {
      image = await createImageBitmap(page.canvas);
    } catch {
      image = page.canvas;
    }
    rasterCache.set(key, { image, cachedAt: Date.now() });
  }

  return {
    id: `${propertyId}-layout`,
    image,
    coordinates: layoutCordsToCoordinates(cords),
    opacity,
    bounds: layoutCordsToBounds(cords),
  };
}

/** @deprecated Prefer decodeTiffToImageBitmap — kept for any callers that want a canvas. */
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

async function decodeTiffToDisplayImage(
  url: string,
  signal?: AbortSignal,
): Promise<LayoutRasterImage | null> {
  const page = await decodeTiffPageToCanvas(url, 0, signal);
  if (!page) return null;

  try {
    // MapLibre ImageSource is most reliable with ImageBitmap (see MapLibre docs).
    return await createImageBitmap(page.canvas);
  } catch (error) {
    console.warn(
      "[ILA map] createImageBitmap failed for TIFF canvas — using canvas directly",
      error,
    );
    return page.canvas;
  }
}

/**
 * Decodes a specific page of a TIFF onto an HTML canvas.
 */
export async function decodeTiffPageToCanvas(
  url: string,
  pageIndex = 0,
  signal?: AbortSignal,
): Promise<DecodedTiffPage | null> {
  try {
    const cleanUrl = url.split("?")[0];
    const query = url.includes("?") ? url.split("?")[1] : "";
    const headers: Record<string, string> = {};
    if (query) headers["x-s3-query"] = query;

    const proxied = `${LAYOUT_IMAGE_PROXY}?url=${encodeURIComponent(cleanUrl)}`;
    console.log("[ILA map] fetching layout TIFF via proxy…");
    const response = await fetch(proxied, { headers, signal });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 200);
      } catch {
        // ignore
      }
      console.warn(
        "[ILA map] layout TIFF fetch failed",
        response.status,
        response.statusText,
        detail || undefined,
      );
      return null;
    }
    const declared = Number(response.headers.get("content-length") ?? 0);
    console.log(
      `[ILA map] layout TIFF download started${declared > 0 ? ` — ${Math.round(declared / (1024 * 1024))} MB declared` : ""}`,
    );
    const buffer = await response.arrayBuffer();
    if (signal?.aborted) return null;
    console.log(`[ILA map] layout TIFF bytes received — ${buffer.byteLength} bytes`);
    return decodeTiffBufferToCanvas(buffer, pageIndex, signal);
  } catch (error) {
    console.warn("[ILA map] layout TIFF page decode failed", error);
    return null;
  }
}

/** Decode an already-fetched TIFF buffer onto a canvas. */
export async function decodeTiffBufferToCanvas(
  buffer: ArrayBuffer,
  pageIndex = 0,
  signal?: AbortSignal,
): Promise<DecodedTiffPage | null> {
  try {
    if (signal?.aborted) return null;

    const { fromArrayBuffer } = await import("geotiff");
    const tiff = await fromArrayBuffer(buffer);
    const totalPages = await tiff.getImageCount();
    const targetIndex = Math.max(0, Math.min(pageIndex, totalPages - 1));
    const image = await tiff.getImage(targetIndex);

    const width = image.getWidth();
    const height = image.getHeight();
    if (!width || !height) {
      console.warn("[ILA map] layout TIFF page has no dimensions", {
        width,
        height,
        pageIndex: targetIndex,
      });
      return null;
    }

    const maxEdge = resolveLayoutMaxDecodedEdge();
    const maxPixels = maxEdge * maxEdge;
    const scale = Math.min(
      1,
      maxEdge / width,
      maxEdge / height,
      Math.sqrt(maxPixels / (width * height)),
    );
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const resample = outW !== width || outH !== height;

    console.log("[ILA map] decoding layout TIFF", {
      native: `${width}x${height}`,
      target: `${outW}x${outH}`,
      maxEdge,
      downscaled: resample,
      pages: totalPages,
      samplesPerPixel: image.getSamplesPerPixel?.() ?? "?",
    });

    const pixels = await readTiffPixels(image, {
      signal,
      width: resample ? outW : undefined,
      height: resample ? outH : undefined,
    });
    if (!pixels) return null;

    const pixelCount = outW * outH;
    const rgba = toRgba(pixels, pixelCount);
    if (!rgba) {
      console.warn("[ILA map] layout TIFF channel layout unsupported", {
        bytes: pixels.length,
        pixelCount,
        stride: pixels.length / pixelCount,
      });
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[ILA map] no 2d canvas context available for TIFF");
      return null;
    }

    const imageData = ctx.createImageData(outW, outH);
    imageData.data.set(rgba);
    ctx.putImageData(imageData, 0, 0);

    console.info(
      `[ILA map] layout TIFF decoded successfully: ${outW}x${outH} (page ${targetIndex + 1}/${totalPages})`,
    );

    return {
      canvas,
      width: outW,
      height: outH,
      pageIndex: targetIndex,
      totalPages,
    };
  } catch (error) {
    console.warn("[ILA map] layout TIFF buffer decode failed", error);
    return null;
  }
}

type GeoTiffImage = {
  getSamplesPerPixel?: () => number;
  readRGB: (options: {
    interleave: boolean;
    enableAlpha?: boolean;
    width?: number;
    height?: number;
    signal?: AbortSignal;
  }) => Promise<unknown>;
  readRasters: (options: {
    interleave?: boolean;
    width?: number;
    height?: number;
    signal?: AbortSignal;
    samples?: number[];
  }) => Promise<unknown>;
};

async function readTiffPixels(
  image: GeoTiffImage,
  options: { signal?: AbortSignal; width?: number; height?: number },
): Promise<Uint8ClampedArray | null> {
  const sizeOpts = {
    ...(options.width && options.height
      ? { width: options.width, height: options.height }
      : {}),
    signal: options.signal,
  };

  // 1) Prefer readRGB when the file is photometric RGB.
  try {
    const raw = (await image.readRGB({
      interleave: true,
      enableAlpha: true,
      ...sizeOpts,
    })) as ArrayLike<number>;
    return copySamplesToUint8(raw);
  } catch (rgbErr) {
    console.warn(
      "[ILA map] layout TIFF readRGB failed — falling back to readRasters",
      rgbErr,
    );
  }

  // 2) Generic rasters (greyscale, palette, CMYK-ish multi-band, etc.).
  try {
    const rasters = await image.readRasters({
      interleave: true,
      ...sizeOpts,
    });
    if (rasters && typeof rasters === "object" && "length" in (rasters as object)) {
      return copySamplesToUint8(rasters as ArrayLike<number>);
    }
    // Planar: array of bands
    if (Array.isArray(rasters)) {
      const width = options.width;
      const height = options.height;
      if (!width || !height) {
        console.warn("[ILA map] planar TIFF fallback needs explicit width/height");
        return null;
      }
      return planarBandsToInterleaved(rasters as ArrayLike<number>[], width, height);
    }
  } catch (rasterErr) {
    console.warn("[ILA map] layout TIFF readRasters failed", rasterErr);
  }

  return null;
}

function sampleToByte(val: number): number {
  if (!Number.isFinite(val)) return 0;
  // Normalized float imagery
  if (val >= 0 && val <= 1) return Math.round(val * 255);
  // 16-bit
  if (val > 255 && val <= 65535) return Math.round((val / 65535) * 255);
  // Already 8-bit (or slightly out of range)
  return Math.max(0, Math.min(255, Math.round(val)));
}

function copySamplesToUint8(raw: ArrayLike<number>): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    pixels[i] = sampleToByte(raw[i] as number);
  }
  return pixels;
}

function planarBandsToInterleaved(
  bands: ArrayLike<number>[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixelCount = width * height;
  const numBands = Math.min(bands.length, 4);
  const out = new Uint8ClampedArray(pixelCount * numBands);
  for (let p = 0; p < pixelCount; p += 1) {
    for (let b = 0; b < numBands; b += 1) {
      out[p * numBands + b] = sampleToByte(bands[b][p] ?? 0);
    }
  }
  return out;
}

function toRgba(pixels: Uint8ClampedArray, pixelCount: number) {
  if (!pixelCount) return null;

  const stride = pixels.length / pixelCount;
  if (!Number.isInteger(stride) || stride < 1 || stride > 4) {
    return null;
  }

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
