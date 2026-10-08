import { getVisitorCode } from "@/lib/visitor";
import { whenVisitorReady } from "@/lib/visitorReady";
import { apiFetch } from "@/services/apiClient";

export type FavoriteItem = {
  property_id: string;
  name: string;
  property_type: string;
  price_from: number;
  status: string;
};

export type FavoritesResponse = {
  success: boolean;
  data?: {
    items?: FavoriteItem[];
    total?: number;
  };
};

/** Returns the properties saved by the current anonymous visitor. */
export async function fetchFavorites(signal?: AbortSignal): Promise<FavoriteItem[]> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  const response = await apiFetch<FavoritesResponse>("/api/favorites", {
    headers: { "X-Visitor-Code": visitorCode },
    signal,
  });

  return response.data?.items ?? [];
}

/** Saves a property for the current anonymous visitor. */
export async function saveFavorite(propertyId: string): Promise<void> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  await apiFetch("/api/favorites", {
    method: "POST",
    headers: { "X-Visitor-Code": visitorCode },
    body: { property_id: propertyId },
  });
}

/** Removes a property from the current anonymous visitor's favourites. */
export async function removeFavorite(propertyId: string): Promise<void> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  await apiFetch(`/api/favorites/${encodeURIComponent(propertyId)}`, {
    method: "DELETE",
    headers: { "X-Visitor-Code": visitorCode },
  });
}