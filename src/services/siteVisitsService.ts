import { getVisitorCode } from "@/lib/visitor";
import { apiFetch } from "@/services/apiClient";

/**
 * Public site-visit booking.
 *
 * POST /api/site-visits schedules a visit to a property. It is a public
 * endpoint: no bearer token is required, and the visitor identity is optional.
 *
 * The endpoint does the lead work itself — it creates or reuses the visitor
 * profile, reuses the visitor's existing lead for that property instead of
 * creating a duplicate, and creates a lead with `source = PUBLIC_FORM` and
 * `status = SITE_VISIT` only when none exists. A visitor who books a visit
 * therefore never ends up with two leads.
 *
 * Because of that, this is an alternative to `POST /api/leads`, not a
 * follow-up to it. Callers should use one or the other, not both, unless they
 * specifically want a lead and a booking from one interaction.
 */

/** Request body for a public site-visit booking. */
export type BookPublicSiteVisitRequest = {
  /** Required. Must be an active property UUID. */
  property_id: string;
  /** ISO 8601 datetime, which must be in the future. */
  scheduled_at: string;
  visitor: {
    name: string;
    mobile: string;
    email?: string | null;
  };
  unit_id?: string | null;
  notes?: string | null;
};

/**
 * The created booking. The endpoint may populate property, unit and agent
 * display fields depending on available data; confirmation UI should rely on
 * `id`, `scheduled_at`, `status` and `property_name`.
 */
export type SiteVisit = {
  id: string;
  status?: string | null;
  scheduled_at?: string | null;
  property_name?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  visitor_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type SiteVisitsResponse = {
  success?: boolean;
  data?: SiteVisit;
};

/** Backend error codes this client reacts to differently. */
export const SITE_VISIT_ERROR_CODES = {
  validation: "VALIDATION_ERROR",
  propertyNotFound: "PROPERTY_NOT_FOUND",
  tenantMissing: "TENANT_ID_MISSING",
} as const;

/**
 * Books a public site visit and returns it.
 *
 * `apiFetch` throws `ApiError` on any non-2xx response and the endpoint
 * answers `201 Created`, so a returned booking means it was created.
 *
 * `X-Visitor-Code` is optional here — when omitted the API identifies or
 * creates the visitor from the submitted name and mobile — so it is sent only
 * when one already exists, rather than being awaited as a precondition.
 */
export async function bookPublicSiteVisit(
  booking: BookPublicSiteVisitRequest,
  signal?: AbortSignal,
): Promise<SiteVisit> {
  const visitorCode = getVisitorCode();

  const response = await apiFetch<SiteVisitsResponse>("/api/site-visits", {
    method: "POST",
    headers: visitorCode ? { "X-Visitor-Code": visitorCode } : undefined,
    body: booking,
    signal,
  });

  const created = response.data;
  if (!created?.id) {
    throw new Error("Site visit response contained no id");
  }

  return created;
}