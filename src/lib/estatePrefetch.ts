/**
 * Client-side in-memory prefetch cache for estate detail/units and layout assets.
 *
 * Uses the same-origin aggregators:
 *   GET /api/estates/{id}          → { property, units }
 *   GET /api/layout-image?url=…    → SVG text or binary raster body
 *
 * Failed fetches are removed from the cache so a later call can retry.
 * Layout asset keys strip presigned query strings so token rotation does not
 * bust the in-memory cache.
 */

import {
  resolveTenantDomain,
  TENANT_HEADER,
} from "@/services/apiClient";

export type EstatePayload = {
  property: any;
  units: any;
};

export type LayoutAssetPayload = {
  data: string | ArrayBuffer;
  contentType: string;
};

const estateCache = new Map<string, Promise<EstatePayload>>();
const layoutAssetCache = new Map<string, Promise<LayoutAssetPayload>>();

/** Origin + pathname only — drops expiring S3/query tokens. */
export function getAssetCacheKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function isSvgOrXmlContentType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return lower.includes("svg") || lower.includes("xml");
}

function tenantHeaders(): HeadersInit {
  try {
    return { [TENANT_HEADER]: resolveTenantDomain() };
  } catch {
    return {};
  }
}

/**
 * Prefetch property + units for an estate id. Dedupes in-flight/resolved
 * promises by id. When units include `layout_preview_url`, kicks off a
 * layout asset prefetch without blocking the estate promise.
 */
export function prefetchEstate(id: string): Promise<EstatePayload> {
  const cached = estateCache.get(id);
  if (cached) return cached;

  const promise = (async (): Promise<EstatePayload> => {
    const res = await fetch(`/api/estates/${encodeURIComponent(id)}`, {
      headers: tenantHeaders(),
    });
    if (!res.ok) {
      estateCache.delete(id);
      throw new Error(`Failed to fetch estate ${id}: ${res.status}`);
    }

    const json = (await res.json()) as EstatePayload;
    const { property, units } = json;

    const layoutPreviewUrl =
      units && typeof units === "object" && "layout_preview_url" in units
        ? (units as { layout_preview_url?: unknown }).layout_preview_url
        : undefined;

    if (typeof layoutPreviewUrl === "string" && layoutPreviewUrl.length > 0) {
      void prefetchLayoutAsset(layoutPreviewUrl).catch((err) => {
        console.warn("[estatePrefetch] layout asset prefetch failed", err);
      });
    }

    return { property, units };
  })().catch((error) => {
    estateCache.delete(id);
    throw error;
  });

  estateCache.set(id, promise);
  return promise;
}

/**
 * Prefetch a layout asset through the same-origin image proxy.
 * SVG/XML → text; PNG/TIFF/other → ArrayBuffer.
 */
export function prefetchLayoutAsset(url: string): Promise<LayoutAssetPayload> {
  const key = getAssetCacheKey(url);
  const cached = layoutAssetCache.get(key);
  if (cached) {
    return cached;
  }

  const promise = (async (): Promise<LayoutAssetPayload> => {
    const cleanUrl = url.split("?")[0];
    const query = url.includes("?") ? url.split("?")[1] : "";
    const headers = new Headers(tenantHeaders());
    if (query) headers.set("x-s3-query", query);

    const res = await fetch(
      `/api/layout-image?url=${encodeURIComponent(cleanUrl)}`,
      { headers },
    );
    if (!res.ok) {
      layoutAssetCache.delete(key);
      console.warn("[ILA map] layout asset request failed", {
        key,
        status: res.status,
      });
      throw new Error(`Failed to fetch layout asset: ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    const data = isSvgOrXmlContentType(contentType)
      ? await res.text()
      : await res.arrayBuffer();
    return { data, contentType };
  })().catch((error) => {
    layoutAssetCache.delete(key);
    console.warn("[ILA map] layout asset fetch errored", {
      key,
      error,
    });
    throw error;
  });

  layoutAssetCache.set(key, promise);
  return promise;
}

/** Return cached estate data, or start a prefetch if missing. */
export function getEstateData(id: string): Promise<EstatePayload> {
  return estateCache.get(id) ?? prefetchEstate(id);
}

/** Return cached layout asset, or start a prefetch if missing. */
export function getLayoutAsset(url: string): Promise<LayoutAssetPayload> {
  const key = getAssetCacheKey(url);
  return layoutAssetCache.get(key) ?? prefetchLayoutAsset(url);
}

/**
 * Peek the in-flight/resolved layout asset promise without starting a fetch.
 * Used by `attachLayoutImage` for a warm-cache fast path.
 */
export function peekLayoutAsset(
  url: string,
): Promise<LayoutAssetPayload> | undefined {
  return layoutAssetCache.get(getAssetCacheKey(url));
}

/** Clear one estate entry, or the entire estate cache when `id` is omitted. */
export function clearEstateCache(id?: string): void {
  if (id !== undefined) {
    estateCache.delete(id);
    return;
  }
  estateCache.clear();
}
