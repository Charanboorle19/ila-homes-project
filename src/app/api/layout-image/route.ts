/**
 * Same-origin proxy for the estate master-plan image.
 *
 * The units API returns presigned S3 URLs for the layout (`layout_preview_url`,
 * a PNG preview, and `tif_url`, the raw survey scan). That bucket serves no
 * `Access-Control-Allow-Origin` header, so a browser cannot read either of them
 * directly — the request fails before any bytes arrive — and MapLibre cannot
 * put them on the map. They therefore have to come through the app's own
 * origin, where CORS does not apply.
 *
 *   GET /api/layout-image?url=<presigned s3 url>
 *
 * Only https S3 hosts are accepted: this handler fetches whatever URL it is
 * given, so it must not become an open proxy.
 */

/**
 * Accepts both virtual-hosted S3 URLs (`bucket.s3.amazonaws.com`) and
 * path-style presigned URLs (`s3.<region>.amazonaws.com/bucket/...`).
 */
const S3_HOST = /^(?:[a-z0-9][a-z0-9.-]*\.s3(?:[.-][a-z0-9-]+)?|s3(?:[.-][a-z0-9-]+)?)\.amazonaws\.com$/i;

/** Master plans are scans or previews of them; anything larger is not one. */
const MAX_BYTES = 60 * 1024 * 1024;

export const dynamic = "force-dynamic";

function badRequest(reason: string) {
  return Response.json({ error: reason }, { status: 400 });
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
  if (!S3_HOST.test(parsed.hostname)) {
    return badRequest("url must be an S3 object");
  }

  try {
    const upstream = await fetch(parsed, {
      headers: { Accept: "image/png,image/tiff,image/*" },
      // Presigned URLs carry their own auth; never forward browser cookies.
      credentials: "omit",
    });

    if (!upstream.ok) {
      // 403 is almost always "Request has expired" on a stale presigned URL,
      // which is recoverable by asking the API for a fresh one. Pass it through
      // rather than flattening everything to 502.
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
      return new Response(null, { status: 413 });
    }

    // Buffered rather than streamed: a master plan is a few megabytes, and
    // handing the upstream stream straight to the response is unreliable
    // behind the dev proxy.
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) {
      return new Response(null, { status: 413 });
    }

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Content-Length": String(bytes.byteLength),
        // The presigned URL expires, so this must never be cached long-term.
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}