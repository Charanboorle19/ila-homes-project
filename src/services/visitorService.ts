import { getVisitorCode } from "@/lib/visitor";
import { apiFetch } from "@/services/apiClient";

export type CreateVisitorResponse = {
  data?: {
    visitor_code?: string;
    is_new?: boolean;
  };
};

export async function createVisitor(): Promise<CreateVisitorResponse> {
  return apiFetch<CreateVisitorResponse>("/api/visitors", {
    method: "POST",
    body: {},
  });
}

export type StartSessionResponse = {
  data?: {
    session_id?: string;
    started_at?: string;
    reused?: boolean;
  };
};

/**
 * Starts (or reuses) a visitor session.
 *
 * POST /api/visitors already starts a session server-side, so on a first visit
 * this returns the same session with `reused: true` rather than creating a new
 * one. That is the intended way to recover the active session_id, since
 * POST /api/visitors does not return it.
 */
export async function startVisitorSession(): Promise<StartSessionResponse> {
  const visitorCode = getVisitorCode();

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  return apiFetch<StartSessionResponse>("/api/sessions", {
    method: "POST",
    headers: { "X-Visitor-Code": visitorCode },
    body: {
      landing_page: window.location.href,
      referrer: document.referrer || null,
      utm: {},
    },
  });
}