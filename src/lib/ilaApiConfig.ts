/**
 * Single API base URL for every tenant.
 *
 * The base URL comes from NEXT_PUBLIC_API_URL in the environment. There is no
 * hardcoded fallback: a missing value must fail loudly at startup rather than
 * silently pointing production at a stale ngrok tunnel.
 *
 * NOTE: these must stay as literal `process.env.NEXT_PUBLIC_*` accesses.
 * Next.js only inlines the exact string form at build time, so passing the name
 * via a variable (process.env[name]) yields undefined in the browser bundle.
 */

function requireValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        "Set it in .env.local — do not rely on a code fallback.",
    );
  }

  // Strip trailing slashes so `${base}${path}` never produces "//api/...".
  return value.replace(/\/+$/, "");
}

export const ILA_API_BASE_URL = requireValue(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL,
);

export const ILA_PROPERTY_ID = requireValue(
  "NEXT_PUBLIC_ILA_PROPERTY_ID",
  process.env.NEXT_PUBLIC_ILA_PROPERTY_ID,
);

export function ilaUnitsUrl(propertyId: string = ILA_PROPERTY_ID): string {
  return `${ILA_API_BASE_URL}/api/properties/${encodeURIComponent(propertyId)}/units?limit=all`;
}