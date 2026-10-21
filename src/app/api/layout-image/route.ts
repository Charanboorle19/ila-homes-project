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
 * App Router: the upstream body is **streamed** to the client (not buffered
 * into an ArrayBuffer), so large TIFFs do not blow server memory.
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function badRequest(reason: string) {
  return Response.json({ error: reason }, { status: 400 });
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

  try {
    const upstream = await fetch(parsed, {
      headers: { Accept: "image/svg+xml,image/png,image/tiff,image/*" },
      // Presigned URLs carry their own auth; never forward browser cookies.
      credentials: "omit",
      // Propagate client abort so an abandoned tab stops the S3 download.
      signal: request.signal,
    });

    if (!upstream.ok) {
      // 403 is almost always "Request has expired" on a stale presigned URL.
      // Read only a small error body — do not buffer success payloads here.
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
        { status: upstream.status === 403 ? 403 : upstream.status === 404 ? 404 : 502 },
      );
    }

    const declared = Number(upstream.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      // Do not await cancel — draining a rejected multi-hundred-MB S3 body
      // can block the route for minutes and surface as a slow 413.
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

    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("content-type") ?? "image/png",
    );
    // Presigned URL expires — never cache long-term. no-transform avoids
    // intermediary recompression that would buffer the whole object.
    headers.set("Cache-Control", "private, no-store, no-transform");
    headers.set("X-Accel-Buffering", "no");

    // Known size under the cap: pass the upstream stream through untouched
    // (most reliable with Next.js / undici). Keep Content-Length so the
    // browser can show download progress.
    if (declared > 0) {
      headers.set("Content-Length", String(declared));
      return new Response(upstream.body, {
        status: 200,
        headers,
      });
    }

    // Unknown size: count while streaming; omit Content-Length.
    return new Response(limitedBodyStream(upstream.body, MAX_BYTES), {
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
