import type { PlotStatus } from "@/data/plots";

/** Customer-facing short labels drawn on plot polygons. */
export const PLOT_STATUS_SHORT: Record<PlotStatus, string> = {
  available: "Open",
  booked: "Held",
  sold: "Sold",
  blocked: "Locked",
};

/** Full labels for legend chips and detail pills. */
export const PLOT_STATUS_LABEL: Record<PlotStatus, string> = {
  available: "Available",
  booked: "Booked",
  sold: "Sold",
  blocked: "Blocked",
};

/** Prefer the most actionable status when a plot has duplicate features. */
const STATUS_PRIORITY: PlotStatus[] = [
  "available",
  "booked",
  "sold",
  "blocked",
];

export function preferPlotStatus(statuses: PlotStatus[]): PlotStatus {
  for (const status of STATUS_PRIORITY) {
    if (statuses.includes(status)) return status;
  }
  return "sold";
}

/**
 * Maps API / GeoJSON status strings onto the four inventory states.
 * Empty values use `emptyAs` (estate configs often default empty → available).
 */
export function normalizePlotStatus(
  status: unknown,
  emptyAs: PlotStatus = "sold",
): PlotStatus {
  const value = String(status ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!value) return emptyAs;

  if (
    value === "AVL" ||
    value === "AVAILABLE" ||
    value === "OPEN" ||
    value === "UNSOLD" ||
    value === "VACANT" ||
    value === "FOR_SALE" ||
    value === "READY" ||
    value === "ACTIVE"
  ) {
    return "available";
  }

  if (
    value === "BOOKED" ||
    value === "RESERVED" ||
    value === "RESERVE" ||
    value === "HOLD" ||
    value === "ON_HOLD" ||
    value === "TOKEN" ||
    value === "TOKENED"
  ) {
    return "booked";
  }

  if (
    value === "BLOCKED" ||
    value === "LOCKED" ||
    value === "HOLD_BACK" ||
    value === "HOLDBACK" ||
    value === "NOT_FOR_SALE" ||
    value === "UNAVAILABLE" ||
    value === "NA"
  ) {
    return "blocked";
  }

  if (
    value === "SOLD" ||
    value === "OUT" ||
    value === "CLOSED" ||
    value === "SOLD_OUT"
  ) {
    return "sold";
  }

  return "sold";
}

export function plotStatusShortLabel(status: PlotStatus): string {
  return PLOT_STATUS_SHORT[status];
}

export function plotStatusDisplayLabel(status: PlotStatus): string {
  return PLOT_STATUS_LABEL[status];
}
