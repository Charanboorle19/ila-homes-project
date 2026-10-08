import { getVisitorCode } from "@/lib/visitor";
import { whenVisitorReady } from "@/lib/visitorReady";
import {
  apiFetch,
  resolveTenantDomain,
  TENANT_HEADER,
} from "@/services/apiClient";

/**
 * Tracked shares.
 *
 * POST /api/shares registers a share event against an entity and mints a
 * tracking token. The token identifies that share, so the same link can be
 * attributed back to the property whenever it is opened or forwarded.
 *
 * Anonymous identity comes from the `visitor_code` cookie, sent as
 * `X-Visitor-Code`, exactly as favourites and analytics do. There is no
 * logged-in flow, so a missing visitor code is a hard failure rather than
 * something to work around.
 */

/** The share kinds the backend accepts. `SYSTEMATIC` is share-by-the-tenant. */
export type ShareType = "SYSTEMATIC";
export type ShareChannel = "WHATSAPP";
export type ShareEntityType = "PROPERTY";

/** Wire body for POST /api/shares. */
type CreateShareRequest = {
  share_type: ShareType;
  share_channel: ShareChannel;
  entity_id: string;
  entity_type: ShareEntityType;
  message: string;
};

/** Shape of `data` in the POST /api/shares response. */
export type ShareResult = {
  share_id?: string;
  tracking_token?: string;
  tracking_url?: string;
  share_type?: string;
};

type SharesResponse = {
  success: boolean;
  data?: ShareResult;
};

/**
 * Registers a share and returns the minted share record.
 *
 * `entityId` is the property id the share is about, and must be the same
 * `property_id` the catalogue uses — a UUID for anything served by
 * GET /api/properties. Local static records carry slugs and are not valid
 * entity ids, so callers must not offer sharing for them.
 *
 * Throws when the visitor code is unavailable or the response carries no
 * tracking token; both mean there is no link to hand back.
 */
export async function createPropertyShare(input: {
  entityId: string;
  message: string;
  signal?: AbortSignal;
}): Promise<ShareResult> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  if (!visitorCode) {
    throw new Error("Visitor code not found");
  }

  const body: CreateShareRequest = {
    share_type: "SYSTEMATIC",
    share_channel: "WHATSAPP",
    entity_id: input.entityId,
    entity_type: "PROPERTY",
    message: input.message,
  };

  const response = await apiFetch<SharesResponse>("/api/shares", {
    method: "POST",
    headers: { "X-Visitor-Code": visitorCode },
    body,
    signal: input.signal,
  });

  const data = response.data;
  if (!data?.tracking_token) {
    throw new Error("Share response contained no tracking_token");
  }

  return data;
}

/** Creates one tracked share for each API property UUID in a shortlist. */
export async function createPropertyShares(input: {
  entityIds: string[];
  message: string;
  signal?: AbortSignal;
}): Promise<ShareResult[]> {
  return Promise.all(
    [...new Set(input.entityIds)].map((entityId) =>
      createPropertyShare({ entityId, message: input.message, signal: input.signal }),
    ),
  );
}

/**
 * Turns a tracking token into the public share URL a visitor pastes or forwards.
 *
 * Shape: `{domain}/property/{tracking_token}/view`.
 *
 * The token is the share's identity, but the tracking token is not a property
 * id, so it gets its own `/property/{token}/view` path rather than the
 * catalogue's `/properties/{propertyId}`. The domain is the origin the page is
 * being viewed on, which stays correct on a LAN IP or a preview domain. It is
 * deliberately NOT built from NEXT_PUBLIC_API_URL, which may point at a
 * transient tunnel in development, and the `/api/...` prefix is never exposed:
 * an `/api/shares/{token}` link reads as a machine endpoint and invites
 * callers who then bypass the page that records the visit.
 */
export function buildShareUrl(trackingToken: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/property/${encodeURIComponent(
    trackingToken,
  )}/view`;
}

/** `data.property` of the GET /api/shares/{tracking_token} response. */
export type ShareViewProperty = {
  /** The property id. This is the value the tracked route renders. */
  id: string;
  name?: string | null;
  price?: number | null;
  property_type?: string | null;
  status?: string | null;
};

/** `data` of the GET /api/shares/{tracking_token} response. */
export type ShareViewData = {
  /** The property this share points at. */
  property?: ShareViewProperty | null;
};

export type ShareViewResponse = {
  success?: boolean;
  data?: ShareViewData;
};

/**
 * Resolves a share's tracking token to the property id it refers to.
 *
 * `/property/{tracking_token}/view` resolves the token to an id and then hands
 * that id to the existing `ApiPropertyView`, so the tracked route reuses the
 * property detail API, the mapper and every detail section unchanged. The
 * token is only ever an entry point; it is never a property id itself.
 *
 * The share response is a summary — id, name, price, type, status — not the
 * full property payload. Only `data.property.id` is used, and the property
 * itself is loaded from the existing `GET /api/properties/{id}`.
 *
 * Throws when the response carries no `data.property.id`, because there is
 * nothing to render.
 */
export async function fetchSharePropertyId(
  trackingToken: string,
  signal?: AbortSignal,
): Promise<string> {
  const visitor = await whenVisitorReady();
  const visitorCode = getVisitorCode() ?? visitor.code;

  // apiFetch attaches X-Tenant-Domain to every request (see apiClient), so
  // this call already carries it. Resolving it here as well only to log it
  // keeps the tenant visible when diagnosing the tracked route; it does not
  // feed the request, so it cannot drift from what apiFetch sends.
  console.log(
    `[share] GET /api/shares/{tracking_token} with ${TENANT_HEADER} = ${resolveTenantDomain()}`,
  );

  const response = await apiFetch<ShareViewResponse>(
    `/api/shares/${encodeURIComponent(trackingToken)}`,
    {
      headers: visitorCode ? { "X-Visitor-Code": visitorCode } : undefined,
      signal,
    },
  );

  // The share payload is a summary that can change independently of this route,
  // so the resolved id is logged alongside it.
  console.log("[share] GET /api/shares response", response);

  const propertyId = response.data?.property?.id;
  if (!propertyId) {
    console.warn(
      "[share] response had no data.property.id; received data =",
      response.data,
    );
    throw new Error("Share response contained no data.property.id");
  }

  console.log("[share] resolved tracking token to property", {
    trackingToken,
    propertyId,
    propertyName: response.data?.property?.name ?? null,
  });

  return propertyId;
}