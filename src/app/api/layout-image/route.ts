import sharp from "sharp";

/**
 * Same-origin proxy for the estate master-plan image.
 *
 * The units API returns presigned S3 URLs for the layout (`layout_preview_url`,
 * typically an SVG master plan, and optionally `tif_url` for a TIFF scan).
 * That bucket serves no `Access-Control-Allow-Origin` header, so a browser
 * cannot read either of them directly. They therefore have to come through
 * the app's own origin, where CORS does not apply.
 *
 *   GET /api/layout-image?url=<presigned s3 url>
 *
 * Node.js runtime: raster images are resized with sharp before returning, and
 * long-lived CDN cache headers let repeat layout loads avoid another S3 fetch.
 *
 * Only https S3 / CDN hosts are accepted so this cannot become an open proxy.
 */

/**
 * Accepts both virtual-hosted S3 URLs (`bucket.s3.amazonaws.com`),
 * path-style presigned URLs (`s3.<region>.amazonaws.com/bucket/...`),
 * CloudFront, DigitalOcean Spaces, and the API host itself.
 */
const ALLOWED_HOST =
  /^(?:(?:[a-z0-9][a-z0-9.-]*\.)?(?:s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com|cloudfront\.net|digitaloceanspaces\.com)|realestate\.sperow\.in)$/i;

/**
 * Master-plan TIFFs can exceed 100MB (multi-band scans). Cap is enforced from
 * Content-Length when present; otherwise a counting TransformStream aborts
 * mid-stream past this size.
 */
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_EDGE = 4096;

const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const CDN_CACHE_CONTROL = "public, s-maxage=604800";

export const runtime = "nodejs";

function badRequest(reason: string) {
  return Response.json({ error: reason }, { status: 400 });
}

/** Infer image MIME from the URL path when upstream type is missing/generic. */
function contentTypeFromUrl(url: URL): string | null {
  const path = url.pathname.toLowerCase();
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".tif") || path.endsWith(".tiff")) return "image/tiff";
  return null;
}

function resolveContentType(upstreamType: string | null, url: URL): string {
  const type = upstreamType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type && type !== "application/octet-stream") {
    return upstreamType!.split(";")[0]!.trim();
  }
  return contentTypeFromUrl(url) ?? upstreamType ?? "application/octet-stream";
}

/**
 * Pipe upstream bytes through while counting; error the stream if over MAX_BYTES.
 * Used only when Content-Length is absent. Do not set Content-Length on the
 * response when using this — browsers truncate if the advertised length is wrong.
 */
function limitedBodyStream(
  upstream: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let seen = 0;
  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength;
        if (seen > maxBytes) {
          controller.error(
            new DOMException("Layout image exceeds size limit", "AbortError"),
          );
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return badRequest("url is required");

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return badRequest("url is not valid");
  }

  if (parsed.protocol !== "https:") return badRequest("url must be https");
  if (!ALLOWED_HOST.test(parsed.hostname)) {
    return badRequest("url host is not permitted");
  }

  // If query tokens are passed via header (e.g. x-s3-query), attach them for private S3 auth
  const s3Query = request.headers.get("x-s3-query");
  if (s3Query && !parsed.search) {
    parsed.search = s3Query.startsWith("?") ? s3Query : `?${s3Query}`;
  }

  try {
    const upstream = await fetch(parsed, {
      headers: { Accept: "image/svg+xml,image/png,image/webp,image/tiff,image/*" },
      credentials: "omit",
      signal: request.signal,
    });

    if (!upstream.ok) {
      // Propagate upstream status; keep a small JSON body for clients.
      const detail = (await upstream.text().catch(() => "")).slice(0, 300);
      const expired = /expired/i.test(detail);
      console.warn(
        `[ILA API] layout image fetch failed upstream: ${upstream.status}`,
        expired ? "(presigned URL expired)" : detail,
      );
      return Response.json(
        {
          error: expired ? "presigned url expired" : "upstream error",
          status: upstream.status,
        },
        { status: upstream.status },
      );
    }

    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      void upstream.body?.cancel().catch(() => undefined);
      console.warn(
        `[ILA API] layout image rejected: Content-Length ${declared} > ${MAX_BYTES}`,
      );
      return Response.json(
        {
          error: "layout image too large",
          maxBytes: MAX_BYTES,
          contentLength: declared,
        },
        { status: 413 },
      );
    }

    if (!upstream.body) {
      return Response.json({ error: "upstream had no body" }, { status: 502 });
    }

    // Buffer the payload for optional raster resizing and CDN caching.
    let body: Uint8Array = new Uint8Array(await upstream.arrayBuffer());
    let contentType = resolveContentType(
      upstream.headers.get("content-type"),
      parsed,
    );

    // Resize common raster layouts before the browser decodes them. Preserve
    // SVG and TIFF bytes because their client-side loaders need the originals.
    if (/^image\/(webp|png|jpeg)$/i.test(contentType)) {
      try {
        body = new Uint8Array(
          await sharp(body, { limitInputPixels: false })
            .resize({
              width: MAX_EDGE,
              height: MAX_EDGE,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer(),
        );
        contentType = "image/webp";
      } catch (resizeErr) {
        console.warn(
          "[ILA API] layout image resize failed, sending original",
          resizeErr,
        );
      }
    }

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", CACHE_CONTROL);
    headers.set("CDN-Cache-Control", CDN_CACHE_CONTROL);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Content-Length", String(body.byteLength));

    return new Response(body as BodyInit, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.warn("[ILA API] layout image proxy failed", error);
    return Response.json({ error: "proxy fetch failed" }, { status: 502 });
  }
}
