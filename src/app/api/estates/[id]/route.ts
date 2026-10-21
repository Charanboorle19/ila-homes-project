import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const backendBase =
    process.env.NEXT_PUBLIC_API_URL ?? "https://realestate.sperow.in";

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
    const [propRes, unitsRes] = await Promise.all([
      fetch(`${backendBase}/api/properties/${id}`, { headers }),
      fetch(`${backendBase}/api/properties/${id}/units?limit=all`, {
        headers,
      }),
    ]);

    // Property detail is required; units may be missing for some catalogue rows.
    if (!propRes.ok) {
      console.warn("[api/estates] property upstream failure", {
        id,
        tenantDomain,
        propertyStatus: propRes.status,
        unitsStatus: unitsRes.status,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch estate details",
          propertyStatus: propRes.status,
          unitsStatus: unitsRes.status,
        },
        { status: 502 },
      );
    }

    const propJson = await propRes.json();

    let units: unknown = null;
    if (unitsRes.ok) {
      const unitsJson = await unitsRes.json();
      units = unitsJson.data ?? null;
    } else {
      console.warn("[api/estates] units missing or failed — returning property only", {
        id,
        tenantDomain,
        unitsStatus: unitsRes.status,
      });
    }

    return NextResponse.json({
      property: propJson.data,
      units,
    });
  } catch (error) {
    console.warn("[api/estates] proxy fetch failed", { id, error });
    return NextResponse.json(
      { error: "Failed to fetch estate details or units" },
      { status: 502 },
    );
  }
}
