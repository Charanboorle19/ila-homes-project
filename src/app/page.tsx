import HomeClientView from "@/components/HomeClientView";
import type { PropertyListItem } from "@/services/propertiesService";

async function getInitialCatalogue(): Promise<PropertyListItem[]> {
  const backendBase = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLICAPIURL ||
    "https://realestate.sperow.in"
  ).replace(/\/+$/, "");

  const tenantDomain =
    process.env.NEXT_PUBLIC_TENANT_DOMAIN ||
    process.env.SITE_DOMAIN ||
    "192.168.29.7";

  try {
    const res = await fetch(
      `${backendBase}/api/properties?status=ALL&page=1&per_page=100`,
      {
        headers: {
          Accept: "application/json",
          "X-Tenant-Domain": tenantDomain,
          "ngrok-skip-browser-warning": "true",
        },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      console.warn("[page.tsx] initial catalogue upstream error", res.status);
      return [];
    }

    const json = await res.json();
    return Array.isArray(json?.data?.items) ? json.data.items : [];
  } catch (error) {
    console.warn("[page.tsx] failed to fetch initial catalogue", error);
    return [];
  }
}

export default async function HomePage() {
  const initialProperties = await getInitialCatalogue();

  return <HomeClientView initialProperties={initialProperties} />;
}
