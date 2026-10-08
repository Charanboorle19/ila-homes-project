import { getVisitorCode } from "@/lib/visitor";
import { whenVisitorReady } from "@/lib/visitorReady";
import { apiFetch } from "@/services/apiClient";

/**
 * Public lead capture.
 *
 * POST /api/leads records a visitor's contact request. It is the same endpoint
 * staff use, but a public submission carries no assignee: the backend fixes
 * `source = PUBLIC_FORM` and `status = NEW`, and rejects an attempt to set
 * `assigned_to` with 403.
 *
 * Anonymous identity comes from the `visitor_code` cookie, sent as
 * `X-Visitor-Code`, exactly as favourites and tracked shares do.
 */

/** Request body for a public lead. Only `name` and `mobile` are required. */
export type CreatePublicLeadRequest = {
  name: string;
  mobile: string;
  email?: string | null;
  message?: string | null;
  /** Must be an active property UUID. Omit or null when there is not one. */
  property_id?: string | null;
  unit_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * The created lead. The endpoint may return further fields depending on the
 * response schema; consumers should rely on `id`, `status` and `name` only.
 */
export type Lead = {
  id: string;
  name?: string | null;
  status?: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  created_at?: string | null;
};

type LeadsResponse = {
  success?: boolean;
  data?: Lead;
};

/** Backend error codes this client reacts to differently. */
export const LEAD_ERROR_CODES = {
  visitorCodeRequired: "VISITOR_CODE_REQUIRED",
  validation: "VALIDATION_ERROR",
  invalidMobile: "INVALID_MOBILE",
  propertyNotFound: "PROPERTY_NOT_FOUND",
  rateLimited: "RATE_LIMIT_EXCEEDED",
} as const;

/**
 * Creates a public lead and returns it.
 *
 * `apiFetch` throws `ApiError` for any non-2xx response, and the endpoint
 * answers `201 Created` on success — so a returned lead means the backend
 * accepted it. The backend is the final authority on validation, so a
 * `VALIDATION_ERROR` or `INVALID_MOBILE` here means the frontend accepted
 * something the server rejected.
 *
 * `assigned_to` is never sent: public submissions may not choose an assignee.
 */
export async function createPublicLead(
  lead: CreatePublicLeadRequest,
  signal?: AbortSignal,
): Promise<Lead> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  const response = await apiFetch<LeadsResponse>("/api/leads", {
    method: "POST",
    headers: { "X-Visitor-Code": visitorCode },
    body: lead,
    signal,
  });

  const created = response.data;
  if (!created?.id) {
    throw new Error("Lead response contained no id");
  }

  return created;
}