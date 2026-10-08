/**
 * Shared API wrapper.
 *
 * EVERY request to the backend must go through apiFetch so the tenant header is
 * always attached. Never call raw fetch against the API base URL.
 *
 * Tenant identification:
 * - The tenant is derived from the site's own hostname, never hardcoded and
 *   never the API host. Do not send the tenant UUID.
 * - In the browser we use window.location.hostname, which is exactly the domain
 *   the user is on, so local dev automatically sends "localhost".
 * - On the server (SSR / route handlers) window is undefined, so we fall back to
 *   SITE_DOMAIN from the environment.
 * - Never set Origin or Host; browsers manage those and forbid overriding them.
 */

import { ILA_API_BASE_URL } from "@/lib/ilaApiConfig";

export const TENANT_HEADER = "X-Tenant-Domain";

type ApiErrorBody = {
  success?: boolean;
  error?: { code?: string; message?: string } | string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Resolves the tenant domain for the current environment.
 *
 * Throws rather than silently sending an empty header: a request with no tenant
 * is rejected by the backend anyway, and a clear error here is far easier to
 * diagnose than a 403 with no explanation.
 */
export function resolveTenantDomain(): string {
  if (typeof window !== "undefined" && window.location.hostname) {
    return window.location.hostname;
  }

  const fromEnv = process.env.SITE_DOMAIN;
  if (fromEnv) return fromEnv;

  throw new Error(
    "Cannot resolve tenant domain: window is unavailable and SITE_DOMAIN is not set. " +
      "Set SITE_DOMAIN in the environment for server-side requests.",
  );
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Explicit bearer token. Falls back to localStorage when omitted. */
  authToken?: string;
  /** Overrides tenant resolution. Rarely needed. */
  tenantDomain?: string;
  signal?: AbortSignal;
  keepalive?: boolean;
};

/** Reads a bearer token if one exists. Null for anonymous visitors. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("token");
  } catch {
    // localStorage can throw in private mode / blocked cookies.
    return null;
  }
}

/**
 * ngrok free tunnels serve an interstitial warning page before the app. This
 * header skips it.
 */
function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
    ...extra,
  };
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers,
    authToken,
    tenantDomain,
    signal,
    keepalive,
  } = options;

  const token = authToken ?? getStoredToken();

  const requestHeaders = baseHeaders({
    [TENANT_HEADER]: tenantDomain ?? resolveTenantDomain(),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    // A token whose tenant does not match the site's tenant gets a 403.
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  });

  // Absolute URL from NEXT_PUBLIC_API_URL. Relative paths would hit the site's
  // own domain instead of the API host.
  const response = await fetch(`${ILA_API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
    ...(keepalive ? { keepalive } : {}),
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    const parsed = json as ApiErrorBody | null;
    const message =
      typeof parsed?.error === "string"
        ? parsed.error
        : parsed?.error?.message ?? `Request failed: ${response.status}`;
    const code =
      typeof parsed?.error === "object" ? parsed.error?.code : undefined;

    throw new ApiError(response.status, message, code);
  }

  return json as T;
}

/** Convenience helper for the units endpoint used by the map. */
export async function fetchUnits(
  propertyId: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const result = await apiFetch<{ success?: boolean; data?: unknown }>(
    `/api/properties/${encodeURIComponent(propertyId)}/units?limit=all`,
    { signal },
  );

  return result?.data ?? result;
}