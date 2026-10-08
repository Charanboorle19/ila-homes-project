import { getLayoutById, type LayoutId } from "@/data/propertyLayouts";

export type LifeStageKey = "family" | "investment" | "building" | "retirement";

export type LifeStageMatchEntry = {
  score: number;
  reason: string;
  /**
   * True while a live fit is still being fetched. The section renders a
   * placeholder instead of a misleading 0%.
   */
  pending?: boolean;
  /** True when there is no score to show at all — never render a 0% for this. */
  unavailable?: boolean;
};

export type NeighbourhoodItem = {
  id: string;
  name: string;
  kind: string;
  distanceKm: number;
  status: string;
  detail: string;
  coordinates: [number, number];
};

export type PropertyDocument = {
  id: string;
  label: string;
  /** A file to open. Omitted for rows that are stated facts, not documents. */
  href?: string;
  /** Supporting line shown under the label. */
  detail?: string;
};

export type TimelineEntry = {
  year: string;
  title: string;
  story: string;
  zoom: number;
};

export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
};

export type LifestyleItem = {
  id: string;
  caption: string;
  /**
   * Omitted when there is no photograph for this item — an API property lists
   * amenities, not moments, and has no imagery to go with them. The section
   * renders a typographic panel instead of a broken image.
   */
  src?: string;
  alt: string;
};

export type PropertyRecord = {
  id: LayoutId;
  name: string;
  location: string;
  locationKey: string;
  tagline: string;
  description: string;
  sqYards: string;
  areaSqFt: string;
  areaCents: string;
  facing: string;
  dimensions: string;
  roadWidth: string;
  propertyType: string;
  price: number;
  approval: string;
  possession: string;
  status: "available" | "coming-soon" | "sold";
  bankEligible: boolean;
  reraRegistered: boolean;
  corner: boolean;
  parkFacing: boolean;
  features: string[];
  highwayKm: number;
  viewingCount: number;
  enquiryCount: number;
  lifeStageMatch: Record<LifeStageKey, LifeStageMatchEntry>;
  connectivity: { label: string; time: string }[];
  nearbyAmenities: { name: string; type: string; distanceKm: number }[];
  documents: PropertyDocument[];
  neighbourhood: {
    mapLabel: string;
    badge: string;
    existing: NeighbourhoodItem[];
    proposed: NeighbourhoodItem[];
  };
  coordinates: [number, number];
  zoom: number;
  timeline: TimelineEntry[];
  testimonial: { quote: string; author: string; role: string };
  gallery?: GalleryItem[];
  lifestyle?: LifestyleItem[];
  /** Overrides the hero price line, e.g. an API price range like "₹11.97 L – ₹31.77 L". */
  priceLabel?: string;
  /**
   * Hero spec cells. Properties that publish structured fields (plot size range,
   * project area, plot count) replace the fixed Size/Facing/Dimensions/Road row.
   */
  specs?: { label: string; value: string }[];
  /** A published connectivity score, used in place of the computed estimate. */
  connectivityScore?: number;
  popupSample?: {
    pricePerSqYard: string;
    startingPrice: string;
    approvalLabel: string;
    totalPlots: number;
    availablePlots: number;
    projectExtent: string;
    plotSizes: string;
    statusLabel: string;
    developer: string;
    developerExperience: string;
    projectsCompleted: string;
    locationHighlights: string[];
    amenities: string[];
  };
};

const DEFAULT_DOCUMENTS: PropertyDocument[] = [
  { id: "title", label: "Parent title deed summary", href: "#document-title" },
  { id: "ec", label: "Encumbrance certificate (EC)", href: "#document-ec" },
  {
    id: "layout",
    label: "Sanctioned layout approval",
    href: "#document-layout",
  },
  {
    id: "conversion",
    label: "Land-use / conversion certificate",
    href: "#document-conversion",
  },
];

const DEFAULT_GALLERY: GalleryItem[] = [
  {
    id: "g1",
    src: "/hero-image.png",
    alt: "Property aerial view",
  },
  {
    id: "g2",
    src: "/assets/property/extra-image-3.png",
    alt: "Plot approach road",
  },
  {
    id: "g3",
    src: "/assets/property/extra-image-5.png",
    alt: "Layout vista",
  },
  {
    id: "g4",
    src: "/assets/property/extra-image-6.png",
    alt: "Neighbourhood setting",
  },
];

const DEFAULT_LIFESTYLE: LifestyleItem[] = [
  {
    id: "l1",
    caption: "Morning walks under open sky",
    src: "/assets/property/family-dreams.png",
    alt: "Family walking through a green community",
  },
  {
    id: "l2",
    caption: "Evenings that feel like arrival",
    src: "/assets/property/golden-family.png",
    alt: "Golden-hour family homecoming",
  },
  {
    id: "l3",
    caption: "A township cadence, not a rush hour",
    src: "/assets/property/cityscape.png",
    alt: "Planned cityscape at golden hour",
  },
  {
    id: "l4",
    caption: "Room to grow with the corridor",
    src: "/assets/property/growth.png",
    alt: "Real estate growth vista",
  },
];

const SARK_GALLERY: GalleryItem[] = [
  {
    id: "sg1",
    src: "/assets/property/hero-property.jpg",
    alt: "Sark Green Plains layout view",
  },
  {
    id: "sg2",
    src: "/assets/property/extra-image-8.png",
    alt: "Sark Green Plains approach",
  },
  {
    id: "sg3",
    src: "/assets/property/image-6.png",
    alt: "Sark Green Plains open plots",
  },
];

function baseMatch(
  family: LifeStageMatchEntry,
  investment: LifeStageMatchEntry,
  building: LifeStageMatchEntry,
  retirement: LifeStageMatchEntry,
): Record<LifeStageKey, LifeStageMatchEntry> {
  return { family, investment, building, retirement };
}

export const properties: PropertyRecord[] = [
  {
    id: "singapore-township",
    name: "Singapore Township",
    location: "Isnapur, West Hyderabad",
    locationKey: "isnapur",
    tagline: "Township living with room to grow west",
    description:
      "A planned township fabric in Isnapur with community amenities, clear plot geometry, and improving western-corridor access — built for families who want structure without giving up openness.",
    sqYards: "200 sq yd",
    areaSqFt: "1,800 sq ft",
    areaCents: "4.13 cents",
    facing: "East",
    dimensions: "30 × 60 ft",
    roadWidth: "40 ft",
    propertyType: "Residential plot",
    price: 3200000,
    approval: "HMDA",
    possession: "Immediate",
    status: "available",
    bankEligible: true,
    reraRegistered: true,
    corner: false,
    parkFacing: true,
    features: ["Gated township", "Park facing", "Underground drainage", "Street lighting"],
    highwayKm: 4.2,
    viewingCount: 186,
    enquiryCount: 74,
    lifeStageMatch: baseMatch(
      {
        score: 88,
        reason:
          "Township amenities and east-facing parks make everyday family routines easier — school runs, evening walks, and neighbourly open spaces.",
      },
      {
        score: 72,
        reason:
          "Western Hyderabad spillover continues toward Isnapur; early township inventory tends to firm as connectivity projects land.",
      },
      {
        score: 84,
        reason:
          "Clear plot sizes, 40 ft roads, and utility corridors simplify independent home construction without waiting on stitches of village roads.",
      },
      {
        score: 76,
        reason:
          "Quieter township cadence with planned parks — calmer than inner-city pockets while staying linked to west Hyderabad.",
      },
    ),
    connectivity: [
      { label: "ORR west side", time: "18–22 min" },
      { label: "Patancheru / NH-65", time: "12–15 min" },
      { label: "Gachibowli", time: "35–45 min" },
      { label: "Miyapur Metro", time: "30–35 min" },
    ],
    nearbyAmenities: [
      { name: "Isnapur market", type: "Daily needs", distanceKm: 1.4 },
      { name: "Primary health centre", type: "Healthcare", distanceKm: 2.1 },
      { name: "Nearby schools cluster", type: "Education", distanceKm: 3.0 },
      { name: "Temple precinct", type: "Community", distanceKm: 1.8 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Singapore Township · Isnapur",
      badge: "West Hyderabad growth pocket",
      existing: [
        {
          id: "e1",
          name: "40 ft internal roads",
          kind: "Roads",
          distanceKm: 0.1,
          status: "Live",
          detail: "Primary township spines with drainage lines.",
          coordinates: [78.2112, 17.5385],
        },
        {
          id: "e2",
          name: "Community park",
          kind: "Open space",
          distanceKm: 0.3,
          status: "Live",
          detail: "Central green with walking path.",
          coordinates: [78.2124, 17.5392],
        },
        {
          id: "e3",
          name: "Neighbourhood shops",
          kind: "Retail",
          distanceKm: 1.4,
          status: "Live",
          detail: "Isnapur daily-needs belt.",
          coordinates: [78.218, 17.542],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Corridor road widening",
          kind: "Roads",
          distanceKm: 1.2,
          status: "Proposed · 2029",
          detail: "Approach corridor upgrades feeding western ORR links.",
          coordinates: [78.209, 17.536],
        },
        {
          id: "p2",
          name: "Township club & sports court",
          kind: "Lifestyle",
          distanceKm: 0.4,
          status: "Proposed · 2028",
          detail: "Shared recreation block inside the gated fabric.",
          coordinates: [78.2131, 17.538],
        },
        {
          id: "p3",
          name: "Local bus bay upgrade",
          kind: "Transit",
          distanceKm: 1.6,
          status: "Proposed · 2029",
          detail: "Improved last-mile pickup near the township gate.",
          coordinates: [78.2165, 17.5405],
        },
      ],
    },
    coordinates: [78.2118, 17.5388],
    zoom: 15.2,
    timeline: [
      {
        year: "2015",
        title: "Agricultural fringe",
        story:
          "Isnapur still read as peri-urban farmland with limited plotted inventory and soft approach roads.",
        zoom: 13.8,
      },
      {
        year: "2019",
        title: "Township stitching begins",
        story:
          "Early layout approvals and western corridor spillover start defining a residential fabric beyond Patancheru.",
        zoom: 14.4,
      },
      {
        year: "2023",
        title: "Community form takes shape",
        story:
          "Internal roads, parks, and gated clusters make the pocket feel like a place — not just parcels on a survey sketch.",
        zoom: 15,
      },
      {
        year: "2026",
        title: "Today",
        story:
          "Singapore Township sits in an active enquiry belt — families and end-users shortlisting east-facing, park-side plots.",
        zoom: 15.4,
      },
      {
        year: "2029",
        title: "Corridor maturity",
        story:
          "Illustrative outlook: approach upgrades and amenity density deepen daily convenience for west Hyderabad living.",
        zoom: 15.6,
      },
    ],
    testimonial: {
      quote:
        "We wanted a township feel without losing open sky. The east-facing park side made the decision simple.",
      author: "Ananya & Rohit",
      role: "Homebuilders · Isnapur",
    },
  },
  {
    id: "sark-green-plains",
    name: "Green Valley Estates",
    location: "Shadnagar, Telangana",
    locationKey: "tukkuguda",
    tagline: "HMDA plains living on the ORR spillover",
    description:
      "HMDA-approved plains living with clear roads and utilities in the Tukkuguda growth corridor — open for booking now.",
    sqYards: "150 – 500 sq yd",
    areaSqFt: "1,350 – 4,500 sq ft",
    areaCents: "3.1 – 10.3 cents",
    facing: "East",
    dimensions: "45 × 87 ft",
    roadWidth: "40 ft",
    propertyType: "Residential plot",
    price: 845000,
    approval: "DTCP",
    possession: "Immediate",
    status: "available",
    bankEligible: true,
    reraRegistered: true,
    corner: true,
    parkFacing: false,
    features: ["DTCP Approved", "RERA Registered", "Residential plots", "Available"],
    highwayKm: 3.5,
    viewingCount: 312,
    enquiryCount: 141,
    lifeStageMatch: baseMatch(
      {
        score: 90,
        reason: "Family-ready road geometry and utilities with HMDA clarity.",
      },
      {
        score: 92,
        reason: "ORR and airport spillover keep Tukkuguda in the appreciation narrative.",
      },
      {
        score: 88,
        reason: "Build-ready parcels with sewerage and power planned.",
      },
      {
        score: 70,
        reason: "Open plains feel with improving southern connectivity.",
      },
    ),
    connectivity: [
      { label: "ORR", time: "10–15 min" },
      { label: "RGIA", time: "25–30 min" },
      { label: "Financial District", time: "35–40 min" },
    ],
    nearbyAmenities: [
      { name: "Shadnagar Highway", type: "Connectivity", distanceKm: 5 },
      { name: "Shadnagar Town", type: "Daily needs", distanceKm: 10 },
      { name: "Rajiv Gandhi International Airport", type: "Airport", distanceKm: 25 },
    ],
    documents: DEFAULT_DOCUMENTS,
    popupSample: {
      pricePerSqYard: "₹6,499 / sq. yd.",
      startingPrice: "Starting from ₹8.45 L",
      approvalLabel: "DTCP Approved · RERA Registered",
      totalPlots: 186,
      availablePlots: 72,
      projectExtent: "12.5 Acres",
      plotSizes: "150 – 500 sq. yd.",
      statusLabel: "Available",
      developer: "Green Valley Developers Pvt. Ltd.",
      developerExperience: "12+ Years",
      projectsCompleted: "35+",
      locationHighlights: [
        "5 mins from Shadnagar Highway",
        "10 mins from Shadnagar Town",
        "25 mins from Rajiv Gandhi International Airport",
        "Close to major road connectivity",
      ],
      amenities: [
        "Entrance Arch",
        "BT Roads",
        "Street Lighting",
        "Electricity",
        "Underground Drainage",
        "Avenue Plantation",
        "Children's Play Area",
        "Open Spaces",
        "Security",
      ],
    },
    neighbourhood: {
      mapLabel: "Sark Green Plains · Tukkuguda",
      badge: "ORR southern belt",
      existing: [
        {
          id: "e1",
          name: "Layout spines",
          kind: "Roads",
          distanceKm: 0.1,
          status: "Live",
          detail: "Primary 40 ft roads with plot access.",
          coordinates: [78.455, 17.205],
        },
        {
          id: "e2",
          name: "ORR access",
          kind: "Highway",
          distanceKm: 3.5,
          status: "Live",
          detail: "Southern ring connectivity.",
          coordinates: [78.46, 17.21],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Neighbourhood retail strip",
          kind: "Retail",
          distanceKm: 0.8,
          status: "Proposed · 2028",
          detail: "Convenience retail along the approach.",
          coordinates: [78.452, 17.208],
        },
        {
          id: "p2",
          name: "Park & play court",
          kind: "Open space",
          distanceKm: 0.3,
          status: "Proposed · 2029",
          detail: "Shared recreation within the plains fabric.",
          coordinates: [78.456, 17.206],
        },
      ],
    },
    coordinates: [78.4545, 17.2062],
    zoom: 15,
    timeline: [
      {
        year: "2016",
        title: "Southern fringe",
        story: "Tukkuguda still early in the ORR story — soft pricing, thin amenity cover.",
        zoom: 13.5,
      },
      {
        year: "2020",
        title: "Corridor discovery",
        story: "Airport and ORR narratives pull plotted demand south of the city.",
        zoom: 14.2,
      },
      {
        year: "2024",
        title: "HMDA plains inventory",
        story: "Approved layouts with clearer roads become shortlist staples for end-users and investors.",
        zoom: 15,
      },
      {
        year: "2026",
        title: "Today",
        story: "Sark Green Plains is open for booking with active site visits.",
        zoom: 15.3,
      },
      {
        year: "2030",
        title: "Maturing belt",
        story: "Illustrative outlook: denser daily amenities and firmer resale conversations.",
        zoom: 15.5,
      },
    ],
    testimonial: {
      quote: "Clear HMDA papers and a walkable road made the site visit feel decisive.",
      author: "Karthik R.",
      role: "Investor · Tukkuguda",
    },
    gallery: SARK_GALLERY,
    lifestyle: [
      {
        id: "sl1",
        caption: "Plains light, plotted pace",
        src: "/assets/property/hero-property.jpg",
        alt: "Sark Green Plains",
      },
      {
        id: "sl2",
        caption: "Evenings on open approaches",
        src: "/assets/property/growth.png",
        alt: "Growth corridor vista",
      },
      {
        id: "sl3",
        caption: "Space to build without squeeze",
        src: "/assets/property/extra-image-8.png",
        alt: "Open plot setting",
      },
    ],
  },
  {
    id: "nallagandla-enclave",
    name: "Nallagandla Enclave",
    location: "Near University of Hyderabad",
    locationKey: "nallagandla",
    tagline: "Family pocket near campuses",
    description:
      "A family-oriented enclave near schools and university campuses — practical plot sizes for independent homes.",
    sqYards: "300 sq yd",
    areaSqFt: "2,700 sq ft",
    areaCents: "6.2 cents",
    facing: "North",
    dimensions: "36 × 75 ft",
    roadWidth: "30 ft",
    propertyType: "Residential plot",
    price: 7800000,
    approval: "GHMC",
    possession: "12 months",
    status: "coming-soon",
    bankEligible: true,
    reraRegistered: false,
    corner: false,
    parkFacing: false,
    features: ["Near campuses", "Family pocket", "School belt"],
    highwayKm: 6.0,
    viewingCount: 98,
    enquiryCount: 41,
    lifeStageMatch: baseMatch(
      { score: 91, reason: "School and campus adjacency suits growing households." },
      { score: 74, reason: "Steady western residential demand with education-led stickiness." },
      { score: 80, reason: "Practical sizes for independent homes near daily needs." },
      { score: 68, reason: "Active neighbourhood — calmer lanes exist, but not a quiet fringe." },
    ),
    connectivity: [
      { label: "Gachibowli", time: "15–20 min" },
      { label: "Financial District", time: "20–25 min" },
    ],
    nearbyAmenities: [
      { name: "University campuses", type: "Education", distanceKm: 2.5 },
      { name: "Nallagandla lake belt", type: "Open space", distanceKm: 1.8 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Nallagandla Enclave",
      badge: "Education belt",
      existing: [
        {
          id: "e1",
          name: "Campus approach",
          kind: "Education",
          distanceKm: 2.5,
          status: "Live",
          detail: "University and school cluster.",
          coordinates: [78.325, 17.46],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Internal parklet",
          kind: "Open space",
          distanceKm: 0.2,
          status: "Proposed · 2028",
          detail: "Pocket green for residents.",
          coordinates: [78.328, 17.458],
        },
      ],
    },
    coordinates: [78.327, 17.459],
    zoom: 14.8,
    timeline: [
      { year: "2018", title: "Western residential rise", story: "Nallagandla firms as a family belt.", zoom: 13.8 },
      { year: "2026", title: "Today", story: "Enclave inventory preparing for release.", zoom: 14.8 },
      { year: "2029", title: "Amenity fill", story: "Illustrative denser daily convenience.", zoom: 15.2 },
    ],
    testimonial: {
      quote: "Being near campuses mattered more than a longer drive to the ORR.",
      author: "Meera S.",
      role: "Parent · Nallagandla",
    },
  },
  {
    id: "kokapet-heights",
    name: "Kokapet Heights",
    location: "Kokapet – Financial District Belt",
    locationKey: "kokapet",
    tagline: "High-growth belt near employment hubs",
    description:
      "Growth-corridor plots with Financial District exposure and strong resale narratives.",
    sqYards: "240 sq yd",
    areaSqFt: "2,160 sq ft",
    areaCents: "4.96 cents",
    facing: "West",
    dimensions: "30 × 72 ft",
    roadWidth: "40 ft",
    propertyType: "Residential plot",
    price: 6800000,
    approval: "HMDA",
    possession: "Immediate",
    status: "coming-soon",
    bankEligible: true,
    reraRegistered: true,
    corner: true,
    parkFacing: false,
    features: ["FD belt", "Corner option", "High resale narrative"],
    highwayKm: 2.8,
    viewingCount: 154,
    enquiryCount: 67,
    lifeStageMatch: baseMatch(
      { score: 64, reason: "Employment proximity helps dual-income households; quieter family parks are thinner." },
      { score: 90, reason: "Financial District belt exposure supports appreciation conversations." },
      { score: 72, reason: "Buildable parcels near growth — verify noise and approach before committing." },
      { score: 55, reason: "Busier belt — less ideal if quiet retirement is the primary filter." },
    ),
    connectivity: [
      { label: "Financial District", time: "12–18 min" },
      { label: "ORR", time: "8–12 min" },
    ],
    nearbyAmenities: [
      { name: "Office clusters", type: "Employment", distanceKm: 4.0 },
      { name: "Retail hubs", type: "Retail", distanceKm: 3.2 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Kokapet Heights",
      badge: "FD growth corridor",
      existing: [
        {
          id: "e1",
          name: "ORR link",
          kind: "Highway",
          distanceKm: 2.8,
          status: "Live",
          detail: "Primary ring access.",
          coordinates: [78.34, 17.39],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Local arterial upgrade",
          kind: "Roads",
          distanceKm: 1.0,
          status: "Proposed · 2029",
          detail: "Approach capacity improvements.",
          coordinates: [78.338, 17.392],
        },
      ],
    },
    coordinates: [78.339, 17.391],
    zoom: 14.6,
    timeline: [
      { year: "2017", title: "FD spillover", story: "Kokapet enters the investor shortlist.", zoom: 13.6 },
      { year: "2026", title: "Today", story: "Heights inventory updating for release.", zoom: 14.6 },
      { year: "2030", title: "Densified belt", story: "Illustrative firmer commercial adjacency.", zoom: 15 },
    ],
    testimonial: {
      quote: "We bought the narrative — proximity to work, not a finished township vibe.",
      author: "Vikram N.",
      role: "IT professional · Kokapet",
    },
  },
  {
    id: "khajaguda-residency",
    name: "Khajaguda Residency",
    location: "Khajaguda, Rajendra Nagar",
    locationKey: "khajaguda",
    tagline: "Lower density, calmer streetscape",
    description:
      "Build-ready parcels in a quieter residential pocket with a lower-density feel.",
    sqYards: "350 sq yd",
    areaSqFt: "3,150 sq ft",
    areaCents: "7.23 cents",
    facing: "South",
    dimensions: "40 × 78 ft",
    roadWidth: "30 ft",
    propertyType: "Residential plot",
    price: 9200000,
    approval: "HMDA",
    possession: "Immediate",
    status: "coming-soon",
    bankEligible: true,
    reraRegistered: false,
    corner: false,
    parkFacing: true,
    features: ["Quiet pocket", "Park side", "Lower density"],
    highwayKm: 5.5,
    viewingCount: 76,
    enquiryCount: 29,
    lifeStageMatch: baseMatch(
      { score: 78, reason: "Calmer lanes suit families who want space over buzz." },
      { score: 70, reason: "Steady western residential demand without FD heat." },
      { score: 86, reason: "Build-ready parcels in a residential pocket." },
      { score: 82, reason: "Quieter streetscape supports a softer long-term pace." },
    ),
    connectivity: [
      { label: "Gachibowli", time: "20–25 min" },
      { label: "ORR", time: "15–20 min" },
    ],
    nearbyAmenities: [
      { name: "Hills & trails", type: "Open space", distanceKm: 2.0 },
      { name: "Local temples", type: "Community", distanceKm: 1.5 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Khajaguda Residency",
      badge: "Quiet western pocket",
      existing: [
        {
          id: "e1",
          name: "Hill approach",
          kind: "Open space",
          distanceKm: 2.0,
          status: "Live",
          detail: "Weekend outdoor access.",
          coordinates: [78.36, 17.41],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Lane lighting upgrade",
          kind: "Utilities",
          distanceKm: 0.2,
          status: "Proposed · 2028",
          detail: "Safer evening walks.",
          coordinates: [78.362, 17.412],
        },
      ],
    },
    coordinates: [78.361, 17.4115],
    zoom: 14.8,
    timeline: [
      { year: "2019", title: "Quiet discovery", story: "Khajaguda stays lower density than FD belts.", zoom: 13.8 },
      { year: "2026", title: "Today", story: "Residency plots preparing for listing.", zoom: 14.8 },
      { year: "2029", title: "Settled pocket", story: "Illustrative amenity fill without high-rise pressure.", zoom: 15.1 },
    ],
    testimonial: {
      quote: "We traded buzz for birdsong — the park side sealed it.",
      author: "Leela & Arun",
      role: "Homebuilders · Khajaguda",
    },
  },
  {
    id: "patancheru-gateway",
    name: "Patancheru Gateway",
    location: "Patancheru, NH-65 Corridor",
    locationKey: "patancheru",
    tagline: "Highway access with corridor upside",
    description:
      "Corridor play along NH-65 with improving access — positioned for logistics-adjacent residential demand.",
    sqYards: "280 sq yd",
    areaSqFt: "2,520 sq ft",
    areaCents: "5.79 cents",
    facing: "East",
    dimensions: "32 × 78 ft",
    roadWidth: "40 ft",
    propertyType: "Residential plot",
    price: 4500000,
    approval: "HMDA",
    possession: "18 months",
    status: "coming-soon",
    bankEligible: true,
    reraRegistered: false,
    corner: true,
    parkFacing: false,
    features: ["NH-65 access", "Corner option", "Corridor play"],
    highwayKm: 1.2,
    viewingCount: 112,
    enquiryCount: 48,
    lifeStageMatch: baseMatch(
      { score: 60, reason: "Highway adjacency helps travel; everyday quiet is mixed." },
      { score: 86, reason: "NH-65 corridor narrative with improving connectivity." },
      { score: 74, reason: "Buildable sizes once approach and utilities settle." },
      { score: 58, reason: "Corridor energy may feel busy for a quiet retirement filter." },
    ),
    connectivity: [
      { label: "NH-65", time: "3–6 min" },
      { label: "ORR west", time: "15–20 min" },
    ],
    nearbyAmenities: [
      { name: "Highway services", type: "Transit", distanceKm: 1.2 },
      { name: "Industrial belt edges", type: "Employment", distanceKm: 4.5 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Patancheru Gateway",
      badge: "NH-65 corridor",
      existing: [
        {
          id: "e1",
          name: "NH-65",
          kind: "Highway",
          distanceKm: 1.2,
          status: "Live",
          detail: "Primary western highway.",
          coordinates: [78.26, 17.53],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Service road polish",
          kind: "Roads",
          distanceKm: 0.6,
          status: "Proposed · 2029",
          detail: "Safer local access off the highway.",
          coordinates: [78.262, 17.532],
        },
      ],
    },
    coordinates: [78.261, 17.531],
    zoom: 14.5,
    timeline: [
      { year: "2015", title: "Industrial edge", story: "Patancheru known more for industry than plotted living.", zoom: 13.4 },
      { year: "2026", title: "Today", story: "Gateway inventory updating along NH-65.", zoom: 14.5 },
      { year: "2030", title: "Corridor fill", story: "Illustrative residential thickening along the highway belt.", zoom: 15 },
    ],
    testimonial: {
      quote: "We wanted highway access first — the rest of the amenity story can catch up.",
      author: "Suresh P.",
      role: "Investor · Patancheru",
    },
  },
  {
    id: "mansanpally-meadows",
    name: "Mansanpally Meadows",
    location: "Mansanpally, Shamshabad Belt",
    locationKey: "mansanpally",
    tagline: "Airport belt with open sky",
    description:
      "Emerging southern belt with quieter surroundings and early-cycle pricing before full discovery.",
    sqYards: "320 sq yd",
    areaSqFt: "2,880 sq ft",
    areaCents: "6.61 cents",
    facing: "East",
    dimensions: "36 × 80 ft",
    roadWidth: "30 ft",
    propertyType: "Residential plot",
    price: 5400000,
    approval: "HMDA",
    possession: "Immediate",
    status: "coming-soon",
    bankEligible: true,
    reraRegistered: false,
    corner: false,
    parkFacing: true,
    features: ["Airport belt", "Open sky", "Early cycle"],
    highwayKm: 4.8,
    viewingCount: 89,
    enquiryCount: 36,
    lifeStageMatch: baseMatch(
      { score: 80, reason: "Quieter southern belt with room for outdoor play." },
      { score: 84, reason: "Early-cycle southern pocket before full price discovery." },
      { score: 76, reason: "Open parcels suited to phased home building." },
      { score: 79, reason: "Open sky and softer pace support a quieter long horizon." },
    ),
    connectivity: [
      { label: "RGIA", time: "20–25 min" },
      { label: "ORR south", time: "15–20 min" },
    ],
    nearbyAmenities: [
      { name: "Village services", type: "Daily needs", distanceKm: 2.4 },
      { name: "Open farmland edges", type: "Open space", distanceKm: 0.8 },
    ],
    documents: DEFAULT_DOCUMENTS,
    neighbourhood: {
      mapLabel: "Mansanpally Meadows",
      badge: "Shamshabad belt",
      existing: [
        {
          id: "e1",
          name: "Village road",
          kind: "Roads",
          distanceKm: 0.5,
          status: "Live",
          detail: "Primary approach from the belt road.",
          coordinates: [78.42, 17.18],
        },
      ],
      proposed: [
        {
          id: "p1",
          name: "Meadow park",
          kind: "Open space",
          distanceKm: 0.3,
          status: "Proposed · 2029",
          detail: "Shared green for residents.",
          coordinates: [78.4215, 17.181],
        },
      ],
    },
    coordinates: [78.4208, 17.1805],
    zoom: 14.7,
    timeline: [
      { year: "2018", title: "Airport shadow", story: "Southern belt starts appearing on investor maps.", zoom: 13.5 },
      { year: "2026", title: "Today", story: "Meadows inventory preparing quietly.", zoom: 14.7 },
      { year: "2030", title: "Discovery phase", story: "Illustrative amenity and approach improvements.", zoom: 15.1 },
    ],
    testimonial: {
      quote: "We wanted sky and silence — Mansanpally still has both.",
      author: "Divya K.",
      role: "Weekend home seeker",
    },
  },
];

export function getPropertyById(id: string): PropertyRecord | undefined {
  const property = properties.find((item) => item.id === id);
  if (!property) return undefined;

  const layout = getLayoutById(id);
  if (!layout) return property;

  return {
    ...property,
    name: property.name || layout.label,
    location: property.location || layout.location,
  };
}

export function getPropertyGallery(property: PropertyRecord): GalleryItem[] {
  return property.gallery ?? DEFAULT_GALLERY;
}

export function getPropertyLifestyle(property: PropertyRecord): LifestyleItem[] {
  return property.lifestyle ?? DEFAULT_LIFESTYLE;
}

export function listPropertyIds(): LayoutId[] {
  return properties.map((property) => property.id);
}
