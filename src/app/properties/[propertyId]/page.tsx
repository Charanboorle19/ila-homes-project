import type { Metadata } from "next";
import PropertyPageView from "@/components/PropertyDetail/PropertyPageView";
import ApiPropertyView from "@/components/PropertyDetail/ApiPropertyView";
import {
  getPropertyById,
  listPropertyIds,
} from "@/data/properties";

type PageProps = {
  params: Promise<{ propertyId: string }>;
};

export function generateStaticParams() {
  return listPropertyIds().map((propertyId) => ({ propertyId }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { propertyId } = await params;
  const property = getPropertyById(propertyId);

  // API-backed properties have no local record; ApiPropertyView renders them.
  if (!property) {
    return { title: `${propertyId.replace(/-/g, " ")} · ILA Homes` };
  }

  return {
    title: `${property.name} · ILA Homes`,
    description: property.tagline,
  };
}

export default async function PropertyDetailPage({ params }: PageProps) {
  const { propertyId } = await params;
  const property = getPropertyById(propertyId);

  if (property) {
    return <PropertyPageView property={property} />;
  }

  // Properties served by GET /api/properties have UUID ids that never match the
  // local static data. Render them from the API rather than redirecting away
  // from a valid link.
  return <ApiPropertyView id={propertyId} />;
}