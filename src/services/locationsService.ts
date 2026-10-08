import { apiFetch } from "@/services/apiClient";

/**
 * Localities served by the locations API.
 *
 * Fetched from the browser via apiFetch so the tenant header is attached;
 * a server-side fetch cannot resolve the tenant.
 *
 * Pagination uses page / per_page. The response echoes `page` and `per_page`
 * rather than limit / offset.
 */

export type LocationRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  cover_url: string | null;
};

export type LocationsPage = {
  items: LocationRecord[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** False once the visitor pages past the last page. */
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type LocationsResponse = {
  success?: boolean;
  data?: {
    items?: LocationRecord[];
    total?: number;
    page?: number;
    per_page?: number;
  };
};

export async function fetchLocations(options: {
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}): Promise<LocationsPage> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.max(1, options.perPage ?? 20);

  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });

  const response = await apiFetch<LocationsResponse>(
    `/api/locations?${query.toString()}`,
    { signal: options.signal },
  );

  const items = response?.data?.items ?? [];
  const total = response?.data?.total ?? items.length;

  // Trust the echoed values when present, otherwise derive from the request.
  const resolvedPage = response?.data?.page ?? page;
  const resolvedPerPage = response?.data?.per_page ?? perPage;

  const totalPages = Math.max(1, Math.ceil(total / resolvedPerPage));

  return {
    items,
    total,
    page: resolvedPage,
    perPage: resolvedPerPage,
    totalPages,
    hasNextPage: resolvedPage < totalPages,
    hasPreviousPage: resolvedPage > 1,
  };
}

/** Locales without coordinates cannot be placed on the map. */
export function hasCoordinates(
  location: LocationRecord,
): location is LocationRecord & { latitude: number; longitude: number } {
  return (
    typeof location.latitude === "number" &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude)
  );
}