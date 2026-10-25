import type { PropertyRecord } from "@/data/properties";

const GACHIBOWLI: [number, number] = [78.351, 17.44];

/** URL segment from a property name when the API slug is missing. */
export function toPropertySlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PROPERTY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detail-page href. Prefers the API/name slug so the address bar shows
 * `/properties/sark-green` rather than a UUID.
 */
export function propertyDetailPath(property: {
  id: string;
  slug?: string | null;
  name?: string | null;
}): string {
  const slug = property.slug?.trim();
  if (slug) return `/properties/${encodeURIComponent(slug)}`;
  // Local static ids are already slug-shaped; keep them in the URL.
  if (property.id && !PROPERTY_UUID_RE.test(property.id)) {
    return `/properties/${encodeURIComponent(property.id)}`;
  }
  if (property.name?.trim()) {
    return `/properties/${encodeURIComponent(toPropertySlug(property.name))}`;
  }
  return `/properties/${encodeURIComponent(property.id)}`;
}

export function formatInr(amount: number): string {
  if (amount >= 1_00_00_000) {
    const crore = amount / 1_00_00_000;
    return `₹${crore.toFixed(crore >= 10 ? 1 : 2)} Cr`;
  }
  if (amount >= 1_00_000) {
    const lakh = amount / 1_00_000;
    return `₹${lakh.toFixed(lakh >= 10 ? 0 : 1)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function computeConnectivityScore(property: PropertyRecord): number {
  // A published score beats an estimate from data the record does not carry.
  if (typeof property.connectivityScore === "number") {
    return Math.max(0, Math.min(100, Math.round(property.connectivityScore)));
  }

  const amenityBoost = Math.min(property.nearbyAmenities.length * 4, 20);
  const highwayScore = Math.max(0, 30 - property.highwayKm * 3);
  const featureBoost = Math.min(property.features.length * 3, 18);
  const base = 48 + amenityBoost + highwayScore + featureBoost;
  return Math.max(55, Math.min(96, Math.round(base)));
}

export function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Fixed demo origin — not device geolocation. */
export function distanceFromGachibowliKm(property: PropertyRecord): number {
  return haversineKm(GACHIBOWLI, property.coordinates);
}

export function calcEmi(
  principal: number,
  annualRate = 0.085,
  years = 20,
): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  const factor = (r * (1 + r) ** n) / ((1 + r) ** n - 1);
  return principal * factor;
}

export function futureValue(price: number, years: number, annualRate = 0.11): number {
  return price * (1 + annualRate) ** years;
}

export const DEFAULT_WHATSAPP_PHONE = "919160464809";

export function whatsappUrl(text: string, phone: string = DEFAULT_WHATSAPP_PHONE): string {
  const normalizedPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

export function siteVisitMailto(property: PropertyRecord): string {
  const subject = encodeURIComponent(`Site visit — ${property.name}`);
  const body = encodeURIComponent(
    `Hi ILA Homes,\n\nI'd like to schedule a site visit for ${property.name} (${property.location}).\n\nThanks`,
  );
  return `mailto:hello@ilahomes.example?subject=${subject}&body=${body}`;
}
