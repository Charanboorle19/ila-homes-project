import { apiFetch } from "@/services/apiClient";

export type TenantReel = {
  id: string;
  reel_url: string;
  is_active: boolean;
};

type ActiveTenantReelResponse = {
  success?: boolean;
  data?: TenantReel | null;
};

/** Loads the one active Instagram reel configured for the current tenant. */
export async function fetchActiveTenantReel(
  signal?: AbortSignal,
): Promise<TenantReel | null> {
  const response = await apiFetch<ActiveTenantReelResponse>(
    "/api/tenant/reels/active",
    {
      // The endpoint is public and does not require visitor authentication.
      authToken: "",
      signal,
    },
  );

  return response.data?.is_active ? response.data : null;
}