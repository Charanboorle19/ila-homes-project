import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "ALL";
  const page = searchParams.get("page") ?? "1";
  const perPage = searchParams.get("per_page") ?? "100";
  const locationSlug = searchParams.get("location_slug");

  const backendBase =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLICAPIURL ??
    "https://realestate.sperow.in";

  const tenantDomain =
    request.headers.get("x-tenant-domain") ||
    process.env.NEXT_PUBLIC_TENANT_DOMAIN ||
    "192.168.29.7";

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Tenant-Domain": tenantDomain,
    "ngrok-skip-browser-warning": "true",
  };

  const query = new URLSearchParams({
    status,
    page,
    per_page: perPage,
  });

  if (locationSlug) {
    query.set("location_slug", locationSlug);
  }

  try {
    const upstream = await fetch(`${backendBase}/api/properties?${query.toString()}`, {
      headers,
    });

    if (!upstream.ok) {
      console.warn("[api/properties] upstream catalogue failure", {
        status: upstream.status,
        tenantDomain,
      });
      return NextResponse.json(
        { error: "Failed to fetch properties from upstream" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();

    // Do not cache property metadata or prices at the edge; always serve fresh.
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Vary": "X-Tenant-Domain",
      },
    });
  } catch (error) {
    console.warn("[api/properties] fetch failed", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 502 },
    );
  }
}
