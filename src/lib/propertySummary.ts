/**
 * Card-level facts for a property, derived from its unit rows.
 *
 * Pure and synchronous: it takes the `items` array from
 * GET /api/properties/{id}/units and returns only what a teaser card renders,
 * so nothing here touches the network, the DOM or React. Everything a card
 * shows — the available count, the plot size range, the facing chips and the
 * "from" price — is computed in one pass so the component never re-walks the
 * payload during render.
 */

/**
 * The unit fields a teaser reads. Kept structural rather than importing
 * `PropertyUnit` so a card never receives geometry it will not use.
 */
export type PlotUnitTeaser = {
  status?: string | null;
  area_sq_yards?: number | null;
  price?: number | null;
  facing?: string | null;
  is_corner?: boolean | null;
};

export type PropertyPlotFacts = {
  /** Plots whose status is AVAILABLE. */
  availableCount: number;
  /** Smallest available plot in sq yd, or null when no available plot has one. */
  minSize: number | null;
  /** Largest available plot in sq yd, or null when no available plot has one. */
  maxSize: number | null;
  /** Whether any available plot is flagged as a corner plot. */
  hasCorner: boolean;
  /** Unique primary directions across available plots, in first-seen order. */
  facings: string[];
  /**
   * Whether every available plot includes East.
   *
   * Derived from the plots rather than from `facings`: a single plot facing
   * "East / South" still counts as East-facing, but it puts South into the
   * union, so `facings` alone cannot answer this.
   */
  allEastFacing: boolean;
  /** Lowest non-zero price across available plots, or null when there is none. */
  priceFrom: number | null;
};

/** The status the API uses for a sellable plot. */
const AVAILABLE_STATUS = "AVAILABLE";

/** Coerces an API number field, rejecting null, empty strings and NaN. */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Primary directions on one plot.
 *
 * The API sends compound values such as "East / South" or "West / North", and
 * a plot counts toward every direction it lists, so the string is split on "/"
 * and each part trimmed.
 */
export function splitFacings(facing: string | null | undefined): string[] {
  if (!facing) return [];
  return facing
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function summariseAvailablePlots(
  items: readonly PlotUnitTeaser[],
): PropertyPlotFacts {
  const available = items.filter(
    (item) => (item.status ?? "").trim().toUpperCase() === AVAILABLE_STATUS,
  );

  let minSize: number | null = null;
  let maxSize: number | null = null;
  let priceFrom: number | null = null;
  let hasCorner = false;
  let allEastFacing = true;
  const facings: string[] = [];

  for (const item of available) {
    const size = toFiniteNumber(item.area_sq_yards);
    if (size !== null && size > 0) {
      minSize = minSize === null ? size : Math.min(minSize, size);
      maxSize = maxSize === null ? size : Math.max(maxSize, size);
    }

    // A zero price means "not published", so it is skipped rather than
    // becoming the floor of the range.
    const price = toFiniteNumber(item.price);
    if (price !== null && price > 0) {
      priceFrom = priceFrom === null ? price : Math.min(priceFrom, price);
    }

    if (item.is_corner === true) hasCorner = true;

    const directions = splitFacings(item.facing);
    if (!directions.some((direction) => direction.toLowerCase() === "east")) {
      allEastFacing = false;
    }
    for (const direction of directions) {
      if (!facings.includes(direction)) facings.push(direction);
    }
  }

  return {
    availableCount: available.length,
    minSize,
    maxSize,
    hasCorner,
    facings,
    allEastFacing,
    priceFrom,
  };
}

/**
 * Plot size as a card shows it: "200–1,558 sq yd", or "200 sq yd" when every
 * available plot is the same size. Returns null when no available plot carries
 * a usable area, so the caller can render its own fallback instead of printing
 * "NaN".
 */
export function formatSizeRange(
  minSize: number | null,
  maxSize: number | null,
): string | null {
  if (minSize === null || maxSize === null) return null;

  const format = (value: number) =>
    value.toLocaleString("en-IN", { maximumFractionDigits: 1 });

  if (minSize === maxSize) return `${format(minSize)} sq yd`;
  return `${format(minSize)}–${format(maxSize)} sq yd`;
}