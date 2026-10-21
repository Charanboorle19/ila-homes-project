import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? "all";

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

  try {
    const upstream = await fetch(
      `${backendBase}/api/properties/${encodeURIComponent(id)}/units?limit=${encodeURIComponent(limit)}`,
      { headers },
    );

    if (!upstream.ok) {
      console.warn("[api/properties/[id]/units] upstream failure", {
        id,
        status: upstream.status,
        tenantDomain,
      });
      return NextResponse.json(
        { error: "Failed to fetch units from upstream" },
        { status: upstream.status },
      );
    }

    const data = await upstream.json();

    // Do not cache unit polygons or plot statuses; every request gets live availability.
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Vary": "X-Tenant-Domain",
      },
    });
  } catch (error) {
    console.warn("[api/properties/[id]/units] fetch failed", { id, error });
    return NextResponse.json(
      { error: "Failed to fetch property units" },
      { status: 502 },
    );
  }
}
