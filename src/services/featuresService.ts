import { apiFetch, ApiError } from "@/services/apiClient";

/**
 * Public property-feature APIs.
 *
 * Three public endpoints, none of which require a bearer authentication token.
 * Requests still go through `apiFetch` so the tenant header is attached and they
 * are routed to the configured API host rather than the site's own domain.
 *
 * Behaviours of the matching endpoint that drive the calling code, all taken
 * from the endpoint guide:
 *
 * **Matching is AND, not OR.** A property must carry a score for *every*
 * requested key to come back, so each extra chip narrows the result set. With
 * `total: 0` a common and legitimate outcome rather than a failure.
 *
 * **`match_score` is on a 0-10 scale**, being the mean of the requested feature
 * scores rounded to two decimals. It is not a percentage and must be scaled
 * before being shown as one.
 *
 * **A score of `0` is a real score**, not a missing value. Nothing here treats
 * falsy scores as absent.
 */

/** A feature that may be offered as a filter chip. */
export type PropertyFeature = {
  id: string;
  /** Stable key submitted to `/api/match-properties`. */
  key: string;
  /** Display name for the frontend. */
  name: string;
  description: string | null;
  /** Always `true` for rows returned by this endpoint. */
  active: boolean;
  /** Display/order priority. */
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** One property's score against one feature. */
export type FeatureScore = {
  feature_id: string;
  feature_key: string;
  /**
   * On `/api/match-properties` this holds the feature **key**, not a display
   * name, and `feature_id` comes back as an empty string. Map `feature_key`
   * against `PropertyFeature` to show a real name. On
   * `/api/properties/{id}/feature-scores` the same fields are populated.
   */
  feature_name: string;
  /** Between 0 and 10 inclusive. `0` is valid and must not be treated as missing. */
  score: number;
};

/** One matching property, as summary data only. */
export type PropertyMatch = {
  property_id: string;
  property_name: string;
  slug: string;
  /** Mean of the requested feature scores, 0-10. Null when unscored. */
  match_score: number | null;
  feature_scores: FeatureScore[];
};

export type PropertyMatchResponse = {
  items: PropertyMatch[];
  total: number;
};

type FeaturesResponse = { success?: boolean; data?: PropertyFeature[] };
type MatchResponse = { success?: boolean; data?: PropertyMatchResponse };
type FeatureScoresResponse = { success?: boolean; data?: FeatureScore[] };

/**
 * The guide's own example calls pass `credentials: "include"`, and it is set on
 * all three requests below to match. See the note on `RequestOptions.credentials`
 * in `apiClient.ts` before changing it: `"include"` requires the API to answer
 * with `Access-Control-Allow-Credentials`, otherwise the browser rejects the
 * request outright. Both endpoints are public and need no identity, so if a CORS
 * failure appears here, removing these three lines is the fix.
 */
const CREDENTIALS: RequestCredentials = "include";

/**
 * Loads the active features to render as filter chips.
 *
 * The endpoint returns only `active = true` rows, already ordered by `sort_order`
 * then `name`, so no client-side filtering or sorting is applied.
 */
export async function fetchActiveFeatures(
  signal?: AbortSignal,
): Promise<PropertyFeature[]> {
  const response = await apiFetch<FeaturesResponse>("/api/features", {
    credentials: CREDENTIALS,
    signal,
  });

  return response.data ?? [];
}

/**
 * Finds active properties scored against every one of `featureKeys`.
 *
 * The body is `{ features: string[] }` — feature **keys**, never display names
 * or ids. The backend removes duplicates, so the caller does not have to.
 *
 * An empty selection is answered locally rather than over the network: the guide
 * is explicit that an empty array returns no matches rather than all
 * properties, so a request would cost a round trip to learn something already
 * known here. Callers should not reach this with no selection anyway.
 */
export async function findPropertiesByFeatures(
  featureKeys: string[],
  signal?: AbortSignal,
): Promise<PropertyMatchResponse> {
  if (featureKeys.length === 0) {
    return { items: [], total: 0 };
  }

  const response = await apiFetch<MatchResponse>("/api/match-properties", {
    method: "POST",
    body: { features: featureKeys },
    credentials: CREDENTIALS,
    signal,
  });

  return response.data ?? { items: [], total: 0 };
}

/**
 * Loads the active feature scores for one property.
 *
 * Only scores belonging to active features are returned, so a property with no
 * active scores yields an empty array rather than a `404`.
 */
export async function fetchPropertyFeatureScores(
  propertyId: string,
  signal?: AbortSignal,
): Promise<FeatureScore[]> {
  const response = await apiFetch<FeatureScoresResponse>(
    `/api/properties/${encodeURIComponent(propertyId)}/feature-scores`,
    { credentials: CREDENTIALS, signal },
  );

  return response.data ?? [];
}

/** HTTP statuses the endpoint guide asks the frontend to handle. */
export const FEATURE_API_STATUS = {
  notFound: 404,
  invalidBody: 422,
  serverError: 500,
} as const;

/**
 * Turns a failed feature request into something worth showing a visitor.
 *
 * The guide documents three statuses worth distinguishing. `422` in particular
 * is not a generic server problem — it means the request body did not match the
 * expected schema, which is a bug here rather than anything the visitor did, so
 * it should not be phrased as if they caused it.
 *
 * Any status without documented meaning falls back to the backend's own
 * `error.message`, which `ApiError` already carries.
 */
export function featureApiErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Could not reach the service. Please try again.";
  }

  switch (error.status) {
    case FEATURE_API_STATUS.invalidBody:
      return "The search could not be sent correctly. Please try again.";
    case FEATURE_API_STATUS.serverError:
      return "Our service is having trouble. Please try again shortly.";
    case FEATURE_API_STATUS.notFound:
      return "That property could not be found.";
    default:
      return error.message || "Please try again.";
  }
}