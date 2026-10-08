import type {
  LifeStageKey,
  LifeStageMatchEntry,
  LifestyleItem,
  NeighbourhoodItem,
  PropertyDocument,
  PropertyRecord,
  TimelineEntry,
} from "@/data/properties";
import {
  type ApiLifeStageFit,
  type ApiProperty,
} from "@/services/propertiesService";

/**
 * Maps an API property onto the PropertyRecord shape so it can be rendered by
 * the existing PropertyPageView template.
 *
 * The API and the static catalogue do not overlap, so the API has no gallery,
 * lifestyle, timeline or documents in the catalogue's sense. What it does
 * publish — amenities, plot-size ranges, approval and RERA detail, inventory,
 * connectivity — is mapped onto the sections that carry those ideas, and the
 * rest falls back to neutral placeholders so the page keeps the same design
 * and section order as /properties/{slug}.
 */

const PLACEHOLDER_CONNECTIVITY: { label: string; time: string }[] = [];
const PLACEHOLDER_TIMELINE: TimelineEntry[] = [];
const PLACEHOLDER_NEARBY: {
  name: string;
  type: string;
  distanceKm: number;
}[] = [];
const PLACEHOLDER_NEIGHBOURHOOD: NeighbourhoodItem[] = [];

/** Shown while GET /api/properties/{id}/life-stage-fit is still in flight. */
const PENDING_MATCH: Record<LifeStageKey, LifeStageMatchEntry> = {
  family: { score: 0, reason: "Working out how this fits…", pending: true },
  investment: { score: 0, reason: "Working out how this fits…", pending: true },
  building: { score: 0, reason: "Working out how this fits…", pending: true },
  retirement: { score: 0, reason: "Working out how this fits…", pending: true },
};

/**
 * No score exists — the request failed, or the API omitted this persona.
 * Rendering 0% would be a lie, so the section shows a placeholder instead.
 */
const UNAVAILABLE_MATCH: Record<LifeStageKey, LifeStageMatchEntry> = {
  family: {
    score: 0,
    reason: "No fit score published for this property yet.",
    unavailable: true,
  },
  investment: {
    score: 0,
    reason: "No fit score published for this property yet.",
    unavailable: true,
  },
  building: {
    score: 0,
    reason: "No fit score published for this property yet.",
    unavailable: true,
  },
  retirement: {
    score: 0,
    reason: "No fit score published for this property yet.",
    unavailable: true,
  },
};

/**
 * How the buyer-fit data was obtained.
 *
 * `pending` and `unavailable` are deliberately different: a failed request must
 * not be shown as an eternal "still calculating", and neither may claim a 0%
 * fit.
 */
export type LifeStageSource = {
  status: "pending" | "ready" | "unavailable";
  fit?: ApiLifeStageFit | null;
};

/**
 * The API names its personas; the page's goals have their own ids. Every alias
 * for a goal is listed so a renamed persona still lands on the right card
 * rather than silently disappearing.
 */
const PERSONA_ALIASES: Record<string, LifeStageKey> = {
  starting_a_family: "family",
  startingafamily: "family",
  family: "family",
  investment_first: "investment",
  investmentfirst: "investment",
  investment: "investment",
  building_my_home: "building",
  buildingmyhome: "building",
  building: "building",
  quiet_retirement: "retirement",
  quietretirement: "retirement",
  retirement: "retirement",
};

function normalizePersonaKey(persona: string): LifeStageKey | null {
  return (
    PERSONA_ALIASES[
      persona.trim().toLowerCase().replace(/[\s-]+/g, "_")
    ] ?? null
  );
}

/**
 * Turns GET /api/properties/{id}/life-stage-fit into the
 * `lifeStageMatch` record the property page renders.
 *
 * Personas the API omits fall back to "Not scored yet." rather than being
 * invented, and every goal keeps its own entry, so selecting a different goal
 * always swaps in different content.
 */
export function lifeStageFitToMatch(
  source: LifeStageSource | null | undefined,
): Record<LifeStageKey, LifeStageMatchEntry> {
  if (!source || source.status === "pending") return { ...PENDING_MATCH };
  if (source.status === "unavailable") return { ...UNAVAILABLE_MATCH };

  const fit = source.fit;
  if (!fit) return { ...UNAVAILABLE_MATCH };

  const byGoal = new Map<LifeStageKey, LifeStageMatchEntry>();

  for (const persona of fit.personas) {
    const goal = normalizePersonaKey(String(persona.persona ?? ""));
    if (!goal) {
      console.warn(
        "[ILA API] unknown life-stage persona",
        persona.persona,
      );
      continue;
    }

    const raw = persona.fit_percentage;
    const score =
      typeof raw === "number" && Number.isFinite(raw)
        ? Math.max(0, Math.min(100, Math.round(raw)))
        : null;

    const reason =
      typeof persona.reason === "string" ? persona.reason.trim() : "";

    // First persona for a goal wins, so a duplicate cannot overwrite it.
    if (byGoal.has(goal)) continue;
    byGoal.set(goal, {
      score: score ?? 0,
      reason: reason || "No fit score published for this property yet.",
      // A persona with no usable percentage is not a 0% fit.
      unavailable: score === null,
    });
  }

  return {
    family: byGoal.get("family") ?? UNAVAILABLE_MATCH.family,
    investment: byGoal.get("investment") ?? UNAVAILABLE_MATCH.investment,
    building: byGoal.get("building") ?? UNAVAILABLE_MATCH.building,
    retirement: byGoal.get("retirement") ?? UNAVAILABLE_MATCH.retirement,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? value : "—";
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The API is not consistent about numbers: `price` arrives as a number while
 * `minimum_price` / `target_price` arrive as strings ("1197000.00"). Both are
 * read here so a quoted price is never dropped over its encoding.
 */
function money(value: unknown): number | undefined {
  const direct = num(value);
  if (direct !== undefined) return direct;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/** "133–353" from a pair of bounds, "133" from one, "—" from neither. */
function range(min: unknown, max: unknown): string {
  const lo = num(min);
  const hi = num(max);
  if (lo !== undefined && hi !== undefined) {
    return lo === hi ? String(lo) : `${lo}–${hi}`;
  }
  if (lo !== undefined) return String(lo);
  if (hi !== undefined) return String(hi);
  return "—";
}

/** Thousands separators, for values shown verbatim (acreage, plot counts). */
function count(value: unknown): string {
  const n = num(value);
  return n === undefined ? "—" : n.toLocaleString("en-IN");
}

/** "Residential villa plots" from "RESIDENTIAL_VILLA_PLOTS". */
function titleCase(value: unknown): string {
  return text(value)
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word, index) =>
      index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
    )
    .join(" ");
}

/**
 * Exact money for a quoted figure.
 *
 * `formatPrice` rounds to whole or half lakhs, which is right for a card that
 * only sets a ballpark, but "₹12 L" for a plot the listing quotes as ₹11.97 L
 * reads as a rounding bug. This keeps the published precision.
 */
function exactPrice(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

/** "1 Dec 2019" from "2019-12-01". Unparseable input is passed through. */
function formatDate(value: unknown): string {
  const raw = text(value).trim();
  if (!raw) return "";
  // A bare YYYY-MM-DD is read as UTC midnight by Date, which renders as the
  // previous day for anyone west of Greenwich — so the parts are read directly.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const parsed = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * First non-empty value among several metadata spellings.
 *
 * The API has shipped more than one name for the same fact across records
 * (`plot_size_sqyd_approx_min` on some, `plot_size_min_sqyd` on others), so a
 * record is read through all of them rather than showing a dash for data it
 * does have.
 */
function metaNumber(
  meta: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (value == null || value === "") continue;
    const n = num(value);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** The same lookup as metaNumber, for text values. */
function metaText(
  meta: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

/**
 * The development's amenities become the Lifestyle section's points.
 *
 * This is the one section with a natural home for them: the API publishes
 * seventeen of them ("Gated Community", "Landscaped Park", "Rainwater
 * Harvesting"), which is far more than a chip row elsewhere could carry, and
 * they describe what daily life here is like. No photographs are invented for
 * them — items are left without a `src`, which the section renders as a
 * typographic panel.
 */
function amenitiesToLifestyle(amenities: string[]): LifestyleItem[] {
  const seen = new Set<string>();
  const items: LifestyleItem[] = [];

  amenities.forEach((raw, index) => {
    const caption = typeof raw === "string" ? raw.trim() : "";
    if (!caption) return;
    // Case-insensitive dedupe: "Black Top Roads" and "black top roads" are one.
    const key = caption.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ id: `amenity-${index}`, caption, alt: "" });
  });

  return items;
}

function approvalStatus(property: ApiProperty): PropertyRecord["status"] {
  const status = text(property.status).toUpperCase();
  if (status.includes("SOLD") || status.includes("OUT")) return "sold";
  if (status.includes("SOON") || status.includes("COMING")) return "coming-soon";
  return "available";
}

/**
 * Verification rows from the fields the API publishes.
 *
 * The static catalogue links to document files; an API property has none of
 * those URLs, so its rows are stated facts (RERA number, approval, possession)
 * with no link to a file that does not exist.
 */
function verificationRows(
  property: ApiProperty,
  meta: Record<string, unknown>,
): PropertyDocument[] {
  const rows: PropertyDocument[] = [];

  const approvalDetail =
    text(property.approval_details) ||
    metaText(meta, ["approval", "approval_details"]) ||
    "";
  if (approvalDetail) {
    rows.push({ id: "approval", label: "Approval details", detail: approvalDetail });
  }

  const hmda = metaText(meta, ["hmda_status", "hmda_layout", "layout_status"]);
  // Only worth its own row when the approval sentence does not already say it.
  if (hmda && !approvalDetail.toLowerCase().includes(hmda.toLowerCase())) {
    rows.push({ id: "layout", label: "Land use", detail: hmda });
  }

  if (property.rera_registered) {
    rows.push({
      id: "rera",
      label: "RERA registration",
      detail: property.rera_number
        ? `${property.rera_number} · registered`
        : "Registered · number not published",
    });
  }

  const possession = [titleCase(property.possession_status), formatDate(property.possession_date)]
    .filter(Boolean)
    .join(" · ");
  if (possession) {
    rows.push({ id: "possession", label: "Possession", detail: possession });
  }

  const verified = metaText(meta, ["source_status"]);
  if (verified) {
    rows.push({
      id: "source",
      label: "Listing source",
      detail: titleCase(verified),
    });
  }

  return rows;
}

export function apiPropertyToRecord(
  property: ApiProperty,
  /** Buyer fit from /life-stage-fit and whether it has resolved. */
  lifeStage?: LifeStageSource | null,
): PropertyRecord {
  const meta = (property.metadata ?? {}) as Record<string, unknown>;

  // Locality first, then the landmark that narrows it (Pulimamidi →
  // Maheshwaram), with the city as the last resort.
  const locationParts = [
    property.locality ?? property.location_name,
    property.landmark,
    property.city,
  ].filter((part): part is string => Boolean(part && part.trim()));
  const location =
    [...new Set(locationParts.map((part) => part.trim()))].join(", ") ||
    text(property.address).split(",")[0] ||
    "Hyderabad";

  const sqYardsMin = metaNumber(meta, [
    "plot_size_sqyd_approx_min",
    "plot_size_sqyd_min",
    "plot_size_min_sqyd",
    "min_plot_size_sqyd",
  ]);
  const sqYardsMax = metaNumber(meta, [
    "plot_size_sqyd_approx_max",
    "plot_size_sqyd_max",
    "plot_size_max_sqyd",
    "max_plot_size_sqyd",
  ]);
  const sqftMin = metaNumber(meta, [
    "plot_size_sqft_min",
    "plot_size_min_sqft",
    "min_plot_size_sqft",
  ]);
  const sqftMax = metaNumber(meta, [
    "plot_size_sqft_max",
    "plot_size_max_sqft",
    "max_plot_size_sqft",
  ]);

  const sqYards = range(sqYardsMin, sqYardsMax);
  // 1 sq yd is exactly 9 sq ft, so a listing that publishes only the yard range
  // converts exactly. Never relabel the yard figures as square feet.
  const areaSqFt =
    sqftMin !== undefined || sqftMax !== undefined
      ? range(sqftMin, sqftMax)
      : range(
          sqYardsMin === undefined ? undefined : Math.round(sqYardsMin * 9),
          sqYardsMax === undefined ? undefined : Math.round(sqYardsMax * 9),
        );

  const projectAcres = metaNumber(meta, ["project_area_acres", "area_acres"]) ?? num(property.area);

  const hasCoordinates =
    typeof property.latitude === "number" &&
    typeof property.longitude === "number";

  const reraLabel = property.rera_registered
    ? property.rera_number
      ? `RERA ${property.rera_number}`
      : "RERA registered"
    : "RERA not listed";

  // The hero badge reads "<approval> Approved", so this has to stay short. The
  // API's approval_details is a sentence with a caveat in it and belongs in the
  // verification list instead.
  const approvalLabel =
    metaText(meta, ["hmda_status", "approval", "layout_approval"]) ||
    (text(property.approval_details).split(/[;·]/)[0] ?? "");
  const approvalText = approvalLabel.trim() || "Approval on request";

  // The brochure figure is what the layout shows, which is what a buyer is
  // reading this page for; the live inventory count can lag behind it.
  const totalPlots =
    metaNumber(meta, ["brochure_plot_count", "total_plots"]) ??
    num(property.total_inventory) ??
    0;
  const availablePlots =
    num(property.available_inventory) ?? metaNumber(meta, ["available_plots"]) ?? 0;

  const priceValue = money(property.price) ?? 0;
  const priceFloor = money(property.minimum_price);
  const priceCeiling = money(property.target_price);
  // The API's own label wins — it is already formatted for buyers and carries
  // the currency symbol the rest of the page uses. Its " - " range separator is
  // swapped for the en dash used elsewhere on the page.
  const priceLabel =
    text(property.price_label).replace(/\s+-\s+/g, " – ") ||
    (priceCeiling && priceCeiling > (priceFloor ?? priceValue)
      ? `${exactPrice(priceFloor ?? priceValue)} – ${exactPrice(priceCeiling)}`
      : "");

  const possessionParts = [
    titleCase(property.possession_status),
    formatDate(property.possession_date),
  ].filter(Boolean);

  const connectivityScore = num(property.connectivity_score);
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];
  const lifestyle = amenitiesToLifestyle(amenities);

  // Spec cells replace the static Size/Facing/Dimensions/Road row, which has
  // nothing to show for a record that publishes neither facing nor dimensions.
  const specs: { label: string; value: string }[] = [];
  if (sqYards !== "—") {
    specs.push({ label: "Plot size", value: `${sqYards} sq yd` });
  }
  if (areaSqFt !== "—") {
    specs.push({ label: "Plot size (sq ft)", value: `${areaSqFt} sq ft` });
  }
  if (projectAcres !== undefined) {
    specs.push({ label: "Project area", value: `${count(projectAcres)} acres` });
  }
  if (totalPlots > 0) {
    specs.push({ label: "Plots", value: count(totalPlots) });
  }
  if (text(property.configuration)) {
    specs.push({
      label: "Configuration",
      value: titleCase(property.configuration),
    });
  }

  return {
    id: property.id as PropertyRecord["id"],
    name: property.name,
    location,
    locationKey: (property.slug || property.id).toLowerCase(),
    tagline: property.short_description || property.description || property.name,
    description:
      property.description ||
      property.short_description ||
      "Details for this property are available on request.",
    sqYards,
    areaSqFt,
    areaCents: "—",
    facing: text(property.facing) || "—",
    dimensions: "—",
    roadWidth: "—",
    propertyType: optionalText(property.property_type),
    price: priceValue,
    priceLabel: priceLabel || undefined,
    approval: approvalText,
    possession: possessionParts.join(" · ") || "—",
    status: approvalStatus(property),
    bankEligible: Boolean(meta.bank_eligible),
    reraRegistered: Boolean(property.rera_registered),
    corner: false,
    parkFacing: false,
    features: amenities,
    highwayKm: num(meta.highway_km) ?? 0,
    viewingCount: 0,
    enquiryCount: 0,
    lifeStageMatch: lifeStageFitToMatch(lifeStage),
    connectivity:
      connectivityScore === undefined
        ? PLACEHOLDER_CONNECTIVITY
        : [
            {
              label: "Connectivity score",
              time: `${Math.round(connectivityScore)}/100`,
            },
          ],
    connectivityScore,
    nearbyAmenities: PLACEHOLDER_NEARBY,
    documents: verificationRows(property, meta),
    neighbourhood: {
      mapLabel: location,
      badge: "Locality",
      existing: PLACEHOLDER_NEIGHBOURHOOD,
      proposed: PLACEHOLDER_NEIGHBOURHOOD,
    },
    coordinates: hasCoordinates
      ? [property.longitude as number, property.latitude as number]
      : [78.44, 17.17],
    zoom: hasCoordinates ? 13.5 : 11.35,
    timeline: PLACEHOLDER_TIMELINE,
    testimonial: { quote: "", author: "", role: "" },
    // No cover image means no gallery at all, which falls back to the shared
    // property photography rather than a stage rendering an empty `src`.
    gallery: text(property.cover_url)
      ? [{ id: "cover", src: property.cover_url as string, alt: property.name }]
      : undefined,
    // Undefined rather than an empty list, so a property with no amenities
    // published still gets the shared lifestyle moments instead of a blank
    // section.
    lifestyle: lifestyle.length ? lifestyle : undefined,
    specs: specs.length ? specs.slice(0, 5) : undefined,
    popupSample: {
      pricePerSqYard:
        priceValue && sqYardsMin
          ? `₹${Math.round(priceValue / sqYardsMin).toLocaleString("en-IN")}`
          : "—",
      startingPrice: priceFloor
        ? exactPrice(priceFloor)
        : priceValue
          ? exactPrice(priceValue)
          : "On request",
      approvalLabel: reraLabel,
      totalPlots,
      availablePlots,
      projectExtent:
        projectAcres !== undefined ? `${count(projectAcres)} acres` : "—",
      plotSizes: sqYards === "—" ? "—" : `${sqYards} sq yd`,
      statusLabel: titleCase(property.status) || "Active",
      developer: metaText(meta, ["developer"]) || "ILA Homes",
      developerExperience: "—",
      projectsCompleted: "—",
      locationHighlights: [
        location,
        ...(property.pincode ? [`PIN ${property.pincode}`] : []),
      ],
      amenities,
    },
  };
}