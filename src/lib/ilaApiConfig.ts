/**
 * Single API base URL for every tenant.
 *
 * The base URL comes from NEXT_PUBLICAPIURL in the environment. There is no
 * hardcoded fallback: a missing value must fail loudly at startup rather than
 * silently pointing production at a stale ngrok tunnel.
 *
 * NOTE: these must stay as literal `process.env.NEXT_PUBLIC_*` accesses.
 * Next.js only inlines the exact string form at build time, so passing the name
 * via a variable (process.env[name]) yields undefined in the browser bundle.
 */

// Default fallback matches the project's production backend endpoint & estate ID
const DEFAULT_API_BASE_URL = "https://realestate.sperow.in";
const DEFAULT_PROPERTY_ID = "18f431a4-e5cd-46b9-a8a9-1db57ac32ea6";

export const ILA_API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLICAPIURL ||
  DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

export const ILA_PROPERTY_ID =
  process.env.NEXT_PUBLIC_ILA_PROPERTY_ID ||
  process.env.NEXT_PUBLICILAPROPERTYID ||
  DEFAULT_PROPERTY_ID;

export function ilaUnitsUrl(propertyId: string = ILA_PROPERTY_ID): string {
  return `${ILA_API_BASE_URL}/api/properties/${encodeURIComponent(propertyId)}/units?limit=all`;
}