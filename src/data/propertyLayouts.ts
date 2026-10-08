export type LayoutId =
  | "sark-green-plains"
  | "singapore-township"
  | "nallagandla-enclave"
  | "kokapet-heights"
  | "khajaguda-residency"
  | "patancheru-gateway"
  | "mansanpally-meadows";

export type PropertyLayout = {
  id: LayoutId;
  label: string;
  location: string;
  tag: string;
  plotSizes: string;
  priceRange: string;
  highlight: string;
  status: string;
  available: boolean;
  image: string;
};

/** Sark Green Plains, forced to the top of any result set that contains it. */
export const FEATURED_MATCH_ID: LayoutId = "sark-green-plains";

export const propertyLayouts: PropertyLayout[] = [
  {
    id: "sark-green-plains",
    label: "Sark Green Plains",
    location: "Tukkuguda · Hyderabad",
    tag: "HMDA Approved Layout",
    plotSizes: "435 sq yards",
    priceRange: "₹48,000 / sq yard · Negotiable",
    highlight: "HMDA-approved plains living with clear roads and utilities.",
    status: "Open for Booking",
    available: true,
    image: "/hero-image.png",
  },
  {
    id: "singapore-township",
    label: "Singapore Township",
    location: "Isnapur, West Hyderabad",
    tag: "Township Living",
    plotSizes: "200–400 sq yards",
    priceRange: "Adding soon",
    highlight: "Planned township fabric with community amenities.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
  {
    id: "nallagandla-enclave",
    label: "Nallagandla Enclave",
    location: "Near University of Hyderabad",
    tag: "Education Belt",
    plotSizes: "250–350 sq yards",
    priceRange: "Adding soon",
    highlight: "Family-oriented pocket near schools and campuses.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
  {
    id: "kokapet-heights",
    label: "Kokapet Heights",
    location: "Kokapet – Financial District Belt",
    tag: "Growth Corridor",
    plotSizes: "200–300 sq yards",
    priceRange: "Adding soon",
    highlight: "High-growth belt near employment hubs.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
  {
    id: "khajaguda-residency",
    label: "Khajaguda Residency",
    location: "Khajaguda, Rajendra Nagar",
    tag: "Quiet Pocket",
    plotSizes: "300–450 sq yards",
    priceRange: "Adding soon",
    highlight: "Lower density living with a calmer streetscape.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
  {
    id: "patancheru-gateway",
    label: "Patancheru Gateway",
    location: "Patancheru, NH-65 Corridor",
    tag: "Highway Access",
    plotSizes: "200–400 sq yards",
    priceRange: "Adding soon",
    highlight: "Corridor play along NH-65 with improving access.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
  {
    id: "mansanpally-meadows",
    label: "Mansanpally Meadows",
    location: "Mansanpally, Shamshabad Belt",
    tag: "Airport Belt",
    plotSizes: "250–400 sq yards",
    priceRange: "Adding soon",
    highlight: "Emerging southern belt with quieter surroundings.",
    status: "Updating Soon",
    available: false,
    image: "/hero-image.png",
  },
];

export function getLayoutById(id: string): PropertyLayout | undefined {
  return propertyLayouts.find((layout) => layout.id === id);
}

/*
 * FEEL_TAGS and FEEL_SCORES used to live here: a hard-coded list of ten
 * "feelings" and invented 0–100 scores per layout, used only by FindYourPlot's
 * preference mode. They were removed when that mode became API-backed, so the
 * chips come from `GET /api/features` and the results from
 * `POST /api/match-properties` — no local tags to name, no local scores to
 * invent.
 *
 * LIFE_STAGES, which followed, described the section's four life-stage cards:
 * a curated funnel with its own copy, hand-picked match ids and per-layout
 * reasons. It was removed for the same reason and because no API corresponds to
 * a life stage — the feature APIs key off feature keys, and mapping a stage onto
 * those would mean inventing a correspondence the backend never documented.
 * FindYourPlot is now driven entirely by the two feature endpoints.
 *
 * `propertyLayouts`, `getLayoutById` and `LayoutId` remain: they are still the
 * source for PlotsWithPulse, ShortlistShare and data/properties.ts, and for the
 * property page's local fallback records.
 */
