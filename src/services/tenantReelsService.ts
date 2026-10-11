import { apiFetch } from "@/services/apiClient";

export type TenantReel = {
  id: string;
  reel_url: string;
  is_active: boolean;
  title?: string;
  thumbnail_url?: string;
  location?: string;
  duration?: string;
};

type ActiveTenantReelsResponse = {
  success?: boolean;
  data?: TenantReel | TenantReel[] | null;
};

/** Loads active Instagram reel(s) configured for the current tenant from the API. */
export async function fetchActiveTenantReels(
  signal?: AbortSignal,
): Promise<TenantReel[]> {
  try {
    const response = await apiFetch<ActiveTenantReelsResponse>(
      "/api/tenant/reels/active",
      {
        // The endpoint is public and does not require visitor authentication.
        authToken: "",
        signal,
      },
    );

    if (Array.isArray(response?.data)) {
      return response.data.filter((item) => item && item.is_active !== false);
    }

    if (response?.data && response.data.is_active !== false) {
      return [response.data];
    }

    return [];
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return [];
  }
}

/** Loads the single active Instagram reel configured for the current tenant. */
export async function fetchActiveTenantReel(
  signal?: AbortSignal,
): Promise<TenantReel | null> {
  const reels = await fetchActiveTenantReels(signal);
  return reels[0] ?? null;
}