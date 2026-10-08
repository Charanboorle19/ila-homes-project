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

export type FeelTagId =
  | "quiet"
  | "kids"
  | "temple"
  | "resale"
  | "corner"
  | "gated"
  | "main-road"
  | "school"
  | "early"
  | "weekend";

export const FEEL_TAGS: { id: FeelTagId; label: string }[] = [
  { id: "quiet", label: "Away from traffic" },
  { id: "kids", label: "Kids can play outside" },
  { id: "temple", label: "Walk to a temple" },
  { id: "resale", label: "Good resale in 5 yrs" },
  { id: "corner", label: "Corner plot" },
  { id: "gated", label: "Gated community" },
  { id: "main-road", label: "Near a main road" },
  { id: "school", label: "School within 2km" },
  { id: "early", label: "No builders nearby yet" },
  { id: "weekend", label: "Weekend drive only" },
];

/** Demo scores 0–100 per preference. */
export const FEEL_SCORES: Record<LayoutId, Partial<Record<FeelTagId, number>>> =
  {
    "sark-green-plains": {
      quiet: 78,
      kids: 88,
      temple: 72,
      resale: 92,
      corner: 80,
      gated: 90,
      "main-road": 85,
      school: 82,
      early: 70,
      weekend: 65,
    },
    "singapore-township": {
      quiet: 70,
      kids: 86,
      temple: 60,
      resale: 75,
      corner: 68,
      gated: 88,
      "main-road": 72,
      school: 80,
      early: 55,
      weekend: 60,
    },
    "nallagandla-enclave": {
      quiet: 74,
      kids: 90,
      temple: 68,
      resale: 78,
      corner: 70,
      gated: 76,
      "main-road": 70,
      school: 94,
      early: 50,
      weekend: 58,
    },
    "kokapet-heights": {
      quiet: 55,
      kids: 62,
      temple: 50,
      resale: 90,
      corner: 66,
      gated: 70,
      "main-road": 88,
      school: 72,
      early: 48,
      weekend: 52,
    },
    "khajaguda-residency": {
      quiet: 86,
      kids: 70,
      temple: 75,
      resale: 72,
      corner: 74,
      gated: 68,
      "main-road": 60,
      school: 68,
      early: 62,
      weekend: 70,
    },
    "patancheru-gateway": {
      quiet: 58,
      kids: 60,
      temple: 55,
      resale: 84,
      corner: 72,
      gated: 64,
      "main-road": 92,
      school: 66,
      early: 70,
      weekend: 75,
    },
    "mansanpally-meadows": {
      quiet: 88,
      kids: 76,
      temple: 70,
      resale: 80,
      corner: 78,
      gated: 72,
      "main-road": 68,
      school: 64,
      early: 82,
      weekend: 84,
    },
  };

export type LifeStageId =
  | "building"
  | "investment"
  | "family"
  | "exploring";

export type LifeStage = {
  id: LifeStageId;
  title: string;
  description: string;
  countLabel: string;
  matchIds: LayoutId[];
  reasons: Partial<Record<LayoutId, string>>;
};

export const LIFE_STAGES: LifeStage[] = [
  {
    id: "building",
    title: "Build a home",
    description: "A place to call your own.",
    countLabel: "12 properties match",
    matchIds: [
      "sark-green-plains",
      "singapore-township",
      "khajaguda-residency",
      "nallagandla-enclave",
    ],
    reasons: {
      "sark-green-plains":
        "Clear plot geometry, 40 ft road, sewerage and power planned — ready to start your build.",
      "singapore-township":
        "Township framework that simplifies approvals and utilities.",
      "khajaguda-residency":
        "Build-ready parcels in a calmer residential pocket.",
      "nallagandla-enclave":
        "Practical plot sizes for independent homes near daily needs.",
    },
  },
  {
    id: "investment",
    title: "Invest & grow",
    description: "For long-term appreciation.",
    countLabel: "8 properties match",
    matchIds: [
      "sark-green-plains",
      "kokapet-heights",
      "patancheru-gateway",
      "mansanpally-meadows",
    ],
    reasons: {
      "sark-green-plains":
        "Tukkuguda growth corridor with ORR and airport spillover — open for booking now.",
      "kokapet-heights":
        "Financial District belt exposure with strong resale narratives.",
      "patancheru-gateway":
        "NH-65 corridor play with improving connectivity.",
      "mansanpally-meadows":
        "Early-cycle southern pocket before full price discovery.",
    },
  },
  {
    id: "family",
    title: "For my family",
    description: "Space for what’s ahead.",
    countLabel: "10 properties match",
    matchIds: [
      "sark-green-plains",
      "nallagandla-enclave",
      "mansanpally-meadows",
      "singapore-township",
    ],
    reasons: {
      "sark-green-plains":
        "HMDA-approved Sark Green Plains at Tukkuguda — Plot 203, east facing, family-ready road and utilities.",
      "nallagandla-enclave":
        "Near campuses and schools — a practical base for growing households.",
      "mansanpally-meadows":
        "Quieter southern belt with room for outdoor play and open sky.",
      "singapore-township":
        "Township amenities that support everyday family routines.",
    },
  },
  {
    id: "exploring",
    title: "Just exploring",
    description: "Show me what’s available.",
    countLabel: "24 properties match",
    matchIds: [
      "sark-green-plains",
      "singapore-township",
      "nallagandla-enclave",
      "kokapet-heights",
      "khajaguda-residency",
      "patancheru-gateway",
      "mansanpally-meadows",
    ],
    reasons: {
      "sark-green-plains":
        "HMDA-approved plains living at Tukkuguda — open for booking now.",
      "singapore-township":
        "Planned township fabric with community amenities.",
      "nallagandla-enclave":
        "Family-oriented pocket near schools and campuses.",
      "kokapet-heights":
        "High-growth belt near employment hubs.",
      "khajaguda-residency":
        "Lower density living with a calmer streetscape.",
      "patancheru-gateway":
        "Corridor play along NH-65 with improving access.",
      "mansanpally-meadows":
        "Emerging southern belt with quieter surroundings.",
    },
  },
];
