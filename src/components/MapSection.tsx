"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import PropertyBlock from "@/components/property-block";
import Wishlist from "@/components/wishlist";
import FeatureTutorial from "@/components/FeatureTutorial";
import HomeReadyToVisit from "@/components/HomeReadyToVisit";

const CompareProperties = dynamic(() => import("@/components/CompareProperties"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 z-300 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      aria-label="Loading comparison"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#c9a84c]" />
    </div>
  ),
});
import {
  LngLatBounds,
  Map as MapLibreMap,
  setWorkerUrl,
  type FilterSpecification,
  type GeoJSONSource,
  type ImageSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type SymbolLayerSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlotStatus } from "@/data/plots";
import {
  getProjectById,
  type Bounds,
  type EstateProject,
  type LayoutRaster,
  type ProjectId,
} from "@/data/projects";
import {
  estateFromUnitsApi,
  estatePlaceholderFromProperty,
  propertyAnchor,
} from "@/data/projects/fromApi";
import { layoutCordsToBounds } from "@/data/projects/layoutRasters";
import { getPropertyById, type PropertyRecord } from "@/data/properties";
import {
  fetchProperties,
  fetchPropertyAnchors,
  formatPrice,
  type ApiProperty,
  type PropertyAnchor,
  type PropertyLayoutCords,
  type PropertyListItem,
} from "@/services/propertiesService";
import {
  clearEstateCache,
  getEstateData,
  getLayoutAsset,
  peekLayoutAsset,
  prefetchEstate,
} from "@/lib/estatePrefetch";
import {
  fetchActiveFeatures,
  findPropertiesByFeatures,
  type PropertyFeature,
} from "@/services/featuresService";

const PriceEmiFuture = dynamic(
  () => import("@/components/PropertyDetail/PriceEmiFuture"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center" aria-label="Loading calculator">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#c9a84c]" />
      </div>
    ),
  },
);
import { allowAnalyticsFlush, trackEvent } from "@/services/analytics/tracker";
import { formatInr } from "@/lib/propertyUtils";
import {
  loadLayoutPreviewFromPrefetch,
  loadLayoutPreviewRaster,
  resolveLayoutImageCandidates,
} from "@/lib/layoutPreview";
import {
  setLayoutSvgOverlayContent,
  syncLayoutSvgOverlayPosition,
} from "@/lib/layoutSvgHtmlOverlay";
import {
  loadLayoutRaster,
  loadLayoutRasterFromBuffer,
} from "@/lib/layoutTiff";
import {
  SATELLITE_ATTRIBUTION,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
  SATELLITE_TILES_URL,
} from "@/lib/satelliteTiles";
import { loadPrunedLibertyStyle } from "@/lib/pruneLibertyStyle";
import {
  ILA_PIN_COMPARE_IMAGE_ID,
  ILA_PIN_HIGHLIGHT_IMAGE_ID,
  ILA_PIN_IMAGE_ID,
  ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID,
  ILA_PIN_LABEL_BG_IMAGE_ID,
  ILA_PIN_PIXEL_RATIO,
  loadIlaPinImages,
} from "@/lib/ilaMapPinImage";
import { ILA_API_BASE_URL } from "@/lib/ilaApiConfig";
import MapVersion, { type MapViewMode } from "@/components/map-version";
import {
  LAYOUT_DESIGN,
  LAYOUT_LAYER_IDS,
  PLOT_STATUS_EDGE_COLOR,
  PLOT_STATUS_FILL_COLOR,
  initLayoutLayers,
  setLayoutData,
  syncLayoutRaster,
} from "@/components/map-section-layouts";
import {
  PLOT_STATUS_LABEL,
  plotStatusDisplayLabel,
} from "@/lib/plotStatus";

type FilterKey = "all" | PlotStatus;

const PLOT_STATUS_PILL_CLASS: Record<PlotStatus, string> = {
  available: "bg-[#10B981] text-white font-semibold",
  booked: "bg-[#111111] text-white",
  sold: "bg-[#111111] text-white",
  blocked: "bg-[#111111] text-white",
};

const PLOT_STATUS_SWATCH: Record<PlotStatus, string> = {
  available: LAYOUT_DESIGN.available,
  booked: LAYOUT_DESIGN.booked,
  sold: LAYOUT_DESIGN.sold,
  blocked: LAYOUT_DESIGN.blocked,
};
type SheetTab = "about" | "plots" | "features" | "location";

// Next/Turbopack cannot resolve MapLibre's bundled worker sibling imports.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

/** WebGL property pins — GeoJSON source + branded ILA icon/symbol layers (no HTML Markers). */
const PROPERTY_PINS_SOURCE_ID = "property-pins";
const PROPERTY_PINS_ICON_LAYER_ID = "property-pins-icon";
const PROPERTY_PINS_LABEL_LAYER_ID = "property-pins-label";

/**
 * Shared catalogue fetch so React StrictMode remounts (and unstable callback
 * deps) reuse one in-flight GET /api/properties instead of aborting a duplicate.
 */
type SharedPropertiesListFetch = {
  key: string;
  controller: AbortController;
  promise: Promise<Awaited<ReturnType<typeof fetchProperties>>>;
};

let sharedPropertiesListFetch: SharedPropertiesListFetch | null = null;

/**
 * Plot feature properties the layout search box matches against.
 *
 * Every one of these is already mapped from `GET /api/properties/{id}/units` by
 * `fromApi.ts`, so the search adds no new field to the client contract. The
 * richer unit fields the API also returns -- `dimensions`, `road_info`,
 * `plot_colour`, `special_notes`, `is_corner` -- are deliberately absent: they
 * are not mapped today, so including them here would search for values the
 * client never receives.
 *
 * `plotNo` and `label` carry the plot number, `status` the raw API state and
 * `statusNorm` the normalised one, so a visitor can type either spelling.
 */
const PLOT_SEARCH_FIELDS = [
  "plotNo",
  "label",
  "facing",
  "sq_yards",
  "sq_ft",
  "price",
  "per_sq_yard_price",
  "per_sq_ft_price",
  "dimensions",
  "status",
  "statusNorm",
] as const;

const EMPTY_FC = {
  type: "FeatureCollection" as const,
  features: [],
};

/** Estate master-plan design tokens imported from map-section-layouts.tsx */
const LAYOUT = LAYOUT_DESIGN;

/** Keep the estate GeoJSON visible so plot polygons remain selectable on the map. */
const SHOW_ESTATE_GEOJSON = true;

/** Ceiling for the layout fit, so an estate always fills the frame. */
const LAYOUT_MAX_ZOOM = 17.2;



/**
 * Everything the map needs to place a pin. Deliberately not an EstateProject:
 * a pin exists for every listed property, while only the selected property has
 * a loaded layout.
 */
export type MapPin = {
  id: string;
  name: string;
  /** Locality, when the listing gives us one. */
  location?: string;
  center: [number, number];
  price?: number | null;
  formattedPrice?: string | null;
};

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        fill="currentColor"
        opacity="0.95"
      />
      <circle cx="12" cy="10" r="2.5" fill="#1a1a1a" />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ExpandIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MinimizeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FamilyIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 5.3a3 3 0 0 1 0 5.4M18 14.2A4.5 4.5 0 0 1 20.5 18.5V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TreeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5 6.5 9.5h11L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 7 5 16h14L12 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 16v5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.5 4.5 5.8v5.6c0 4.5 3.1 8.2 7.5 10.1 4.4-1.9 7.5-5.6 7.5-10.1V5.8L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GrowthIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.5 16.5 9 11l3.5 3.5L20.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.5 6.5h5v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function featureIcon(key: string, className = "h-4 w-4"): React.ReactNode {
  const k = key.toLowerCase();

  if (/famil|child|kid|play/.test(k)) {
    return <FamilyIcon className={className} />;
  }
  if (/tree|green|park|nature|lake|garden|palm/.test(k)) {
    return <TreeIcon className={className} />;
  }
  if (/shiel|secur|safe|gated|cctv|guard|boundary/.test(k)) {
    return <ShieldIcon className={className} />;
  }
  if (/growth|grow|appreciat|return|invest|yield|profit|future/.test(k)) {
    return <GrowthIcon className={className} />;
  }
  return null;
}


/**
 * One row of the "Our Developments" list: a row straight from
 * GET /api/properties. The richer fields (locality, inventory, RERA) are only
 * known for the property that is currently open, so they are passed in when
 * `detail` matches.
 */
function parseUnitsEnvelope(units: unknown): {
  unitsJson: unknown;
  unitCount: number;
  layoutPreviewUrl: string | null;
  tifUrl: string | null;
  layoutCords: PropertyLayoutCords | null;
} {
  const data =
    units && typeof units === "object" ? (units as Record<string, unknown>) : null;

  const items = Array.isArray(data?.items)
    ? data.items
    : Array.isArray(units)
      ? units
      : [];

  const layoutPreviewUrl =
    typeof data?.layout_preview_url === "string" && data.layout_preview_url
      ? data.layout_preview_url
      : null;
  const tifUrl =
    typeof data?.tif_url === "string" && data.tif_url ? data.tif_url : null;

  let layoutCords: PropertyLayoutCords | null = null;
  const rawCords = data?.property_layout_cords;
  if (rawCords && typeof rawCords === "object") {
    const c = rawCords as Partial<PropertyLayoutCords>;
    const { east, west, north, south } = c;
    if (
      [east, west, north, south].every(
        (n) => typeof n === "number" && Number.isFinite(n),
      ) &&
      east !== west &&
      north !== south
    ) {
      layoutCords = {
        east: east as number,
        west: west as number,
        north: north as number,
        south: south as number,
      };
    }
  }

  return {
    unitsJson: units ?? items,
    unitCount: items.length,
    layoutPreviewUrl,
    tifUrl,
    layoutCords,
  };
}

function PropertyCard({
  item,
  detail,
  plotCount,
  active,
  onSelect,
  onPrefetch,
}: {
  item: PropertyListItem;
  detail: ApiProperty | null;
  plotCount: number;
  active: boolean;
  onSelect: () => void;
  onPrefetch?: () => void;
}) {
  const location =
    detail?.locality || detail?.city || detail?.address || detail?.location_name || "";
  const total = detail?.total_inventory ?? null;
  const available = detail?.available_inventory ?? null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onPrefetch}
      aria-pressed={active}
      className={`group flex w-full items-center gap-3 border-x-0 border-t-0 border-b border-black/10 p-3 text-left transition hover:bg-[#cfc8bc] ${
        active ? "bg-[#cfc3a8]" : "bg-transparent"
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-none bg-[#bdb5a8]">
        <Image
          src={item.cover_url || "/hero-image.png"}
          alt=""
          fill
          sizes="64px"
          unoptimized={Boolean(item.cover_url)}
          className="object-cover object-center"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-[#7a5c28] uppercase">
          {detail?.property_type || item.property_type || "Development"}
          {detail?.rera_registered ? " · RERA" : ""}
        </p>
        <h3 className="mt-0.5 text-sm leading-snug font-semibold wrap-break-word text-[#171717]">
          {item.name}
        </h3>
        <p className="mt-0.5 text-xs font-semibold text-[#171717]">
          {formatPrice(item.price)}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs font-medium text-[#3f3a34]">
            {total !== null || available !== null
              ? `${available ?? 0} available · ${total ?? 0} total`
              : plotCount > 0
                ? `${plotCount} plots`
                : "No plot layout yet"}
          </p>
        ) : null}
        {location ? (
          <p className="mt-1 flex items-start gap-1 text-xs font-medium text-[#3f3a34]">
            <PinIcon className="mt-[0.15em] h-3.5 w-3.5 shrink-0 text-[#5c5348]" />
            <span className="min-w-0 wrap-break-word">{location}</span>
          </p>
        ) : null}
      </div>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[#4a453e] text-white transition group-hover:bg-accent group-hover:text-[#171717]">
        <ArrowIcon className="h-4 w-4" />
      </span>
    </button>
  );
}

// Desktop sidebar geometry. The panel is `w-[22rem]` (shown from md up) and sits inside a map
// frame that is inset by 12px with 12px of its own left padding, so it covers
// 352 + 24px of the canvas. fitBounds reserves the same amount so estate
// bounds never land underneath it.
const DESKTOP_PANEL_WIDTH = 352;
const DESKTOP_PANEL_RESERVED = DESKTOP_PANEL_WIDTH + 24;

function fitBounds(
  map: MapLibreMap,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
  padding = 60,
  maxZoom = 17.2,
  reserveSidebar = false,
) {
  const box = new LngLatBounds(
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
  );
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  map.fitBounds(box, {
    padding: {
      top: padding,
      // The extra 140px on mobile keeps the estate clear of the property
      // sheet, which floats over the bottom of the map.
      bottom: padding + (isMobile ? 140 : 40),
      left:
        padding +
        (isMobile ? 20 : reserveSidebar ? DESKTOP_PANEL_RESERVED : 280),
      right: padding,
    },
    duration: 900,
    maxZoom,
  });
}

type PinVisualState = {
  activeProjectId: string | null;
  compareSelectingMode: boolean;
  compareSelectedIds: string[];
  emiSelectingProperty: boolean;
  selectedFeatureKeys: string[];
  featureMatchedPropertyIds: string[];
};

/**
 * Candidate chip sides for `text-variable-anchor-offset`.
 * Anchor name follows MapLibre: "left" places the label to the *right* of the point.
 *
 * Pin tip is at the geographic point (`icon-anchor: bottom`); the circular head sits
 * ~5.2em above it at default icon-size. Offsets are from the tip and must clear:
 *   - head radius (~1.6em at icon-size 0.82)
 *   - pill overhang left of the text (~1.5em: stretchable content inset + icon-text-fit-padding)
 *   - a small visual gap (~0.5em)
 * → side chips need ~3.45em horizontal, not just head radius.
 * dir is the geographic direction the label occupies (for neighbor scoring).
 */
const PIN_LABEL_ANCHORS = [
  { anchor: "left", offset: [3.45, -5.2], dirX: 1, dirY: 0 },
  { anchor: "right", offset: [-3.45, -5.2], dirX: -1, dirY: 0 },
  { anchor: "top-left", offset: [2.85, -6.8], dirX: 0.7, dirY: -0.7 },
  { anchor: "top-right", offset: [-2.85, -6.8], dirX: -0.7, dirY: -0.7 },
  { anchor: "bottom", offset: [0, -8.6], dirX: 0, dirY: -1 },
] as const;

/** Neighbors farther apart than this (degrees) do not influence chip side. */
const PIN_LABEL_NEIGHBOR_DEG = 0.045;

/**
 * Prefer chip sides away from nearby pins so labels do not sit on top of
 * another pin. Returns a flat [anchor, [x, y], ...] list for MapLibre.
 */
function buildPinLabelPlacement(
  pin: MapPin,
  pins: MapPin[],
): Array<string | [number, number]> {
  const scores = PIN_LABEL_ANCHORS.map((slot) => {
    let blocked = 0;
    for (const other of pins) {
      if (other.id === pin.id) continue;
      const dx = other.center[0] - pin.center[0];
      const dy = other.center[1] - pin.center[1];
      const dist = Math.hypot(dx, dy);
      if (dist < 1e-12 || dist > PIN_LABEL_NEIGHBOR_DEG) continue;
      const ndx = dx / dist;
      const ndy = dy / dist;
      const alignment = ndx * slot.dirX + ndy * slot.dirY;
      if (alignment <= 0.15) continue;
      blocked += (alignment * alignment) / dist;
    }
    return { slot, blocked };
  });

  scores.sort((a, b) => a.blocked - b.blocked);

  const placement: Array<string | [number, number]> = [];
  for (const { slot } of scores) {
    placement.push(slot.anchor, [slot.offset[0], slot.offset[1]]);
  }
  return placement;
}

/** Builds a GeoJSON FeatureCollection for GPU circle/symbol pin layers. */
function pinsToGeoJSON(
  pins: MapPin[],
  state: PinVisualState,
): GeoJSON.FeatureCollection {
  const hasFeatureFilter = state.selectedFeatureKeys.length > 0;
  const isComparing = state.compareSelectingMode;

  return {
    type: "FeatureCollection",
    features: pins.map((pin) => {
      const compareIndex = isComparing
        ? state.compareSelectedIds.indexOf(pin.id)
        : -1;
      const compareSelected = compareIndex >= 0;
      const isCompareDimmed = isComparing && !compareSelected;
      const isMatch =
        hasFeatureFilter && state.featureMatchedPropertyIds.includes(pin.id);
      const isDimmed =
        isCompareDimmed || (!isComparing && hasFeatureFilter && !isMatch);
      const isHighlighted = !isComparing && hasFeatureFilter && isMatch;
      const hidden = Boolean(
        state.activeProjectId && pin.id === state.activeProjectId,
      );
      const priceLabel =
        pin.formattedPrice ||
        (pin.price ? `From ${formatPrice(pin.price)}` : "Price on request");

      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: pin.center,
        },
        properties: {
          id: pin.id,
          name: pin.name,
          priceLabel,
          labelPlacement: buildPinLabelPlacement(pin, pins),
          hidden: hidden ? 1 : 0,
          dimmed: isDimmed ? 1 : 0,
          highlighted: isHighlighted ? 1 : 0,
          compareSelected: compareSelected ? 1 : 0,
          compareIndex: compareSelected ? compareIndex + 1 : 0,
          emiPulse: state.emiSelectingProperty ? 1 : 0,
        },
      };
    }),
  };
}

async function ensurePropertyPinLayers(map: MapLibreMap) {
  const images = await loadIlaPinImages();
  const imageOpts = { pixelRatio: ILA_PIN_PIXEL_RATIO } as const;
  // Label chips stretch around text. Coords are in raw image pixels (64×28 @ 2× = 128×56).
  const labelBgOpts = {
    pixelRatio: ILA_PIN_PIXEL_RATIO,
    stretchX: [[28, 100]] as [number, number][],
    stretchY: [[20, 36]] as [number, number][],
    content: [16, 10, 112, 46] as [number, number, number, number],
  };

  if (!map.hasImage(ILA_PIN_IMAGE_ID)) {
    map.addImage(ILA_PIN_IMAGE_ID, images.default, imageOpts);
  }
  if (!map.hasImage(ILA_PIN_HIGHLIGHT_IMAGE_ID)) {
    map.addImage(ILA_PIN_HIGHLIGHT_IMAGE_ID, images.highlight, imageOpts);
  }
  if (!map.hasImage(ILA_PIN_COMPARE_IMAGE_ID)) {
    map.addImage(ILA_PIN_COMPARE_IMAGE_ID, images.compare, imageOpts);
  }
  if (map.hasImage(ILA_PIN_LABEL_BG_IMAGE_ID)) {
    map.removeImage(ILA_PIN_LABEL_BG_IMAGE_ID);
  }
  map.addImage(ILA_PIN_LABEL_BG_IMAGE_ID, images.labelBg, labelBgOpts);
  if (map.hasImage(ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID)) {
    map.removeImage(ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID);
  }
  map.addImage(ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID, images.labelBgCompare, labelBgOpts);

  const visibleFilter: FilterSpecification = ["!=", ["get", "hidden"], 1];

  /**
   * Price chips use per-feature `labelPlacement` (neighbor-aware side order).
   * Collision is on: when chips would overlap (common when zoomed out), MapLibre
   * keeps one in front and hides the rest — no mixed unreadable stack. Pin icons
   * stay fully visible on their own layer. Zooming in frees space and more chips
   * appear. Do not set icon-offset with icon-text-fit or the pill drifts off text.
   */
  const labelLayout = {
    "icon-image": [
      "case",
      [">", ["get", "compareIndex"], 0],
      ILA_PIN_LABEL_BG_COMPARE_IMAGE_ID,
      ILA_PIN_LABEL_BG_IMAGE_ID,
    ],
    "icon-text-fit": "both" as const,
    "icon-text-fit-padding": [3, 7, 3, 7] as [number, number, number, number],
    // Collision: one chip wins crowded space; others stay hidden behind it.
    "icon-allow-overlap": false,
    "icon-ignore-placement": false,
    "icon-padding": 2,
    "icon-offset": [0, 0] as [number, number],
    "icon-pitch-alignment": "viewport" as const,
    "icon-rotation-alignment": "viewport" as const,
    "text-field": [
      "case",
      [">", ["get", "compareIndex"], 0],
      ["to-string", ["get", "compareIndex"]],
      ["get", "priceLabel"],
    ],
    "text-size": [
      "case",
      [">", ["get", "compareIndex"], 0],
      12,
      11,
    ],
    // Per-pin side order from pinsToGeoJSON — not fixed to the right.
    "text-variable-anchor-offset": ["get", "labelPlacement"],
    "text-justify": "auto" as const,
    "text-pitch-alignment": "viewport" as const,
    "text-rotation-alignment": "viewport" as const,
    "text-optional": false,
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "text-padding": 2,
    "text-font": [
      "Open Sans Bold",
      "Open Sans Regular",
      "Arial Unicode MS Regular",
    ],
    "text-letter-spacing": 0.015,
    "text-max-width": 14,
    // Lower sort key places first and wins collisions (compare / highlight first).
    "symbol-z-order": "source" as const,
    "symbol-sort-key": [
      "case",
      [">", ["get", "compareIndex"], 0],
      0,
      ["==", ["get", "highlighted"], 1],
      1,
      2,
    ],
  };

  const labelPaint = {
    "text-color": [
      "case",
      [">", ["get", "compareIndex"], 0],
      "#141519",
      "#24231f",
    ],
    "text-halo-width": 0,
    "icon-opacity": [
      "case",
      ["==", ["get", "dimmed"], 1],
      0.28,
      0.98,
    ],
    "text-opacity": [
      "case",
      ["==", ["get", "dimmed"], 1],
      0.35,
      1,
    ],
  };

  const pinIconLayout = {
    "icon-image": [
      "case",
      ["==", ["get", "compareSelected"], 1],
      ILA_PIN_COMPARE_IMAGE_ID,
      ["==", ["get", "highlighted"], 1],
      ILA_PIN_HIGHLIGHT_IMAGE_ID,
      ["==", ["get", "emiPulse"], 1],
      ILA_PIN_HIGHLIGHT_IMAGE_ID,
      ILA_PIN_IMAGE_ID,
    ],
    "icon-size": [
      "case",
      ["==", ["get", "compareSelected"], 1],
      0.92,
      ["==", ["get", "emiPulse"], 1],
      0.9,
      ["==", ["get", "highlighted"], 1],
      0.88,
      0.82,
    ],
    "icon-anchor": "bottom" as const,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  };

  const pinIconPaint = {
    "icon-opacity": [
      "case",
      ["==", ["get", "dimmed"], 1],
      0.32,
      1,
    ],
  };

  const addOrReplacePinLayers = () => {
    if (map.getLayer(PROPERTY_PINS_LABEL_LAYER_ID)) {
      map.removeLayer(PROPERTY_PINS_LABEL_LAYER_ID);
    }
    if (map.getLayer(PROPERTY_PINS_ICON_LAYER_ID)) {
      map.removeLayer(PROPERTY_PINS_ICON_LAYER_ID);
    }
    map.addLayer({
      id: PROPERTY_PINS_ICON_LAYER_ID,
      type: "symbol",
      source: PROPERTY_PINS_SOURCE_ID,
      filter: visibleFilter,
      layout: pinIconLayout as SymbolLayerSpecification["layout"],
      paint: pinIconPaint as SymbolLayerSpecification["paint"],
    });
    map.addLayer({
      id: PROPERTY_PINS_LABEL_LAYER_ID,
      type: "symbol",
      source: PROPERTY_PINS_SOURCE_ID,
      filter: visibleFilter,
      layout: labelLayout as SymbolLayerSpecification["layout"],
      paint: labelPaint as SymbolLayerSpecification["paint"],
    });
  };

  if (map.getSource(PROPERTY_PINS_SOURCE_ID)) {
    // Recreate layers so stale text-offset / fixed-anchor props cannot linger.
    addOrReplacePinLayers();
    return;
  }

  map.addSource(PROPERTY_PINS_SOURCE_ID, {
    type: "geojson",
    data: EMPTY_FC,
  });

  addOrReplacePinLayers();
}

export type MapSectionProps = {
  propertyId?: string;
  className?: string;
  hideDetails?: boolean;
  hideSearch?: boolean;
  highlightAvailable?: boolean;
  initialProperties?: PropertyListItem[];
  onMapLoaded?: () => void;
};

export default function MapSection({
  propertyId: singlePropertyId,
  className,
  hideDetails = false,
  hideSearch = false,
  highlightAvailable = false,
  initialProperties,
  onMapLoaded,
}: MapSectionProps = {}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const layoutSvgBoxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsByIdRef = useRef<Map<string, MapPin>>(new Map());
  const pinHandlersRef = useRef<{
    selectProperty: (id: string, options: { openSheet?: boolean; openDesktopCard?: boolean; openLayout?: boolean }) => void;
    toggleCompareId: (id: string) => void;
    setEmiSelectedProperty: (prop: { id: string; name: string; price: number; location?: string } | null) => void;
    setEmiSelectingProperty: (val: boolean) => void;
    setEmiOpen: (val: boolean) => void;
    propertyList: PropertyListItem[];
  }>({
    selectProperty: () => {},
    toggleCompareId: () => {},
    setEmiSelectedProperty: () => {},
    setEmiSelectingProperty: () => {},
    setEmiOpen: () => {},
    propertyList: [],
  });
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<ProjectId | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(null);
  const [mobilePlotExpanded, setMobilePlotExpanded] = useState(false);
  const [propertySheetExpanded, setPropertySheetExpanded] = useState(false);
  const [propertySheetTab, setPropertySheetTab] = useState<SheetTab>("about");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapFullscreenRef = useRef(false);
  mapFullscreenRef.current = mapFullscreen;
  const applyInteractionsRef = useRef<() => void>(() => {});
  const [desktopScrollHint, setDesktopScrollHint] = useState(false);
  const desktopScrollHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [userMapViewMode, setUserMapViewMode] = useState<MapViewMode>("default");
  const [maxZoomNotice, setMaxZoomNotice] = useState(false);
  const maxZoomNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const fittedPinsRef = useRef("");
  /** Coalesces the auto-fit while pins stream in, so the camera moves once. */
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRegionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnchorsRef = useRef<Record<string, PropertyAnchor>>({});
  const anchorRafRef = useRef<number | null>(null);
  const selectAbortRef = useRef<AbortController | null>(null);
  /** Layout finished before `setRemoteProject(estate)` — merge on estate commit. */
  const pendingLayoutRef = useRef<{
    propertyId: string;
    raster: LayoutRaster;
  } | null>(null);
  /** A camera request for a property with no plot geometry to frame. The nonce
   *  makes repeated clicks on the same property distinct. */
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const showZoomHintRef = useRef<() => void>(() => {});
  const [remoteProject, setRemoteProject] = useState<EstateProject | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [propertiesRetryCount, setPropertiesRetryCount] = useState(0);
  // The phone property sheet is portalled to <body> so it overlays the whole
  // page instead of being clipped by the map section's `overflow-hidden`.
  // A portal needs a real DOM, so hold off until after the client mount —
  // rendering one during SSR would throw on `document`.
  const [portalReady, setPortalReady] = useState(false);

  // Only the selected live property is shown. The static ESTATE_PROJECTS entries
  // (Sark Green, Green Meadows) are demo/reference layouts and are excluded.
  const projects = useMemo(() => {
    return remoteProject ? [remoteProject] : [];
  }, [remoteProject]);
  const projectsRef = useRef<EstateProject[]>([]);
  projectsRef.current = projects;

  const projectsBounds = useMemo<Bounds>(() => {
    // Neutral fallback until the API projects arrive, so the map never frames
    // the static reference layouts.
    if (projects.length === 0) {
      return { minLng: 78.34, minLat: 17.1, maxLng: 78.52, maxLat: 17.26 };
    }
    return projects.reduce(
      (acc, project) => ({
        minLng: Math.min(acc.minLng, project.bounds.minLng),
        minLat: Math.min(acc.minLat, project.bounds.minLat),
        maxLng: Math.max(acc.maxLng, project.bounds.maxLng),
        maxLat: Math.max(acc.maxLat, project.bounds.maxLat),
      }),
      {
        minLng: Infinity,
        minLat: Infinity,
        maxLng: -Infinity,
        maxLat: -Infinity,
      },
    );
  }, [projects]);

  // Property picker: GET /api/properties, then the selected property.
  //  1. list properties            GET /api/properties
  //  2. click a property           GET /api/properties/{id}
  //  3. draw its plots             GET /api/properties/{id}/units?limit=all
  //
  // Seeded directly from server-passed initialProperties when available.
  const [propertyList, setPropertyList] = useState<PropertyListItem[]>(() =>
    Array.isArray(initialProperties) ? initialProperties : [],
  );
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [activePropertyDetail, setActivePropertyDetail] = useState<ApiProperty | null>(
    null,
  );
  const [unitsCount, setUnitsCount] = useState(0);
  // Coordinates for every listed property, so all of them can be pinned.
  const [propertyAnchors, setPropertyAnchors] = useState<
    Record<string, PropertyAnchor>
  >(() => {
    if (!Array.isArray(initialProperties) || initialProperties.length === 0) return {};
    const seeded: Record<string, PropertyAnchor> = {};
    for (const item of initialProperties) {
      const anchor = propertyAnchor(item);
      if (anchor) seeded[item.id] = anchor;
    }
    return seeded;
  });

  // Feature preferences (Find Your Plot tags)
  const [features, setFeatures] = useState<PropertyFeature[]>([]);
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<string[]>([]);
  const tagsScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch active features for the bottom chips after the map is ready so
  // /api/features does not compete with first paint / tile decode.
  useEffect(() => {
    if (!mapReady) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchActiveFeatures(controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return;
          setFeatures(data);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          console.warn("[MapSection] could not load features", err);
        });
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mapReady]);

  const checkTagsScroll = useCallback(() => {
    const el = tagsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    checkTagsScroll();
    const el = tagsScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkTagsScroll, { passive: true });
    window.addEventListener("resize", checkTagsScroll);
    return () => {
      el.removeEventListener("scroll", checkTagsScroll);
      window.removeEventListener("resize", checkTagsScroll);
    };
  }, [features, checkTagsScroll]);

  const scrollTags = (direction: "left" | "right") => {
    const el = tagsScrollRef.current;
    if (!el) return;
    const amount = direction === "left" ? -240 : 240;
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  const toggleFeatureKey = (key: string) => {
    setSelectedFeatureKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // IDs of properties that match the selected features (from API or local amenities)
  const [featureMatchedPropertyIds, setFeatureMatchedPropertyIds] = useState<string[]>([]);

  useEffect(() => {
    if (selectedFeatureKeys.length === 0) {
      setFeatureMatchedPropertyIds([]);
      return;
    }

    const controller = new AbortController();
    findPropertiesByFeatures(selectedFeatureKeys, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        const apiIds = (res.items ?? []).map((item) => item.property_id);
        
        // Also fallback/augment with local amenities matching for demo/offline resilience
        const localMatches = propertyList
          .filter((item) => {
            const propAmenities = (item.amenities || []).map((a) => a.toLowerCase());
            const propRec = getPropertyById(
              item.id === "sark-green" ? "sark-green-plains" : item.id,
            );
            const propFeatures = (propRec?.features || []).map((f) => f.toLowerCase());
            const allTags = [...propAmenities, ...propFeatures];

            return selectedFeatureKeys.some((fKey) => {
              const k = fKey.toLowerCase();
              return allTags.some((tag) => tag.includes(k) || k.includes(tag));
            });
          })
          .map((item) => item.id);

        const combined = Array.from(new Set([...apiIds, ...localMatches]));
        setFeatureMatchedPropertyIds(combined);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn("[MapSection] findPropertiesByFeatures error, falling back to local amenities:", err);

        // Fallback to local amenities & features check
        const localMatches = propertyList
          .filter((item) => {
            const propAmenities = (item.amenities || []).map((a) => a.toLowerCase());
            const propRec = getPropertyById(
              item.id === "sark-green" ? "sark-green-plains" : item.id,
            );
            const propFeatures = (propRec?.features || []).map((f) => f.toLowerCase());
            const allTags = [...propAmenities, ...propFeatures];

            return selectedFeatureKeys.some((fKey) => {
              const k = fKey.toLowerCase();
              return allTags.some((tag) => tag.includes(k) || k.includes(tag));
            });
          })
          .map((item) => item.id);

        setFeatureMatchedPropertyIds(localMatches);
      });

    return () => controller.abort();
  }, [selectedFeatureKeys, propertyList]);

  // Wishlist and EMI calculator overlays
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [emiOpen, setEmiOpen] = useState(false);
  const [emiSelectingProperty, setEmiSelectingProperty] = useState(false);
  const emiSelectingPropertyRef = useRef(false);
  emiSelectingPropertyRef.current = emiSelectingProperty;
  const [emiSelectedProperty, setEmiSelectedProperty] = useState<{
    id: string;
    name: string;
    price: number;
    location?: string;
  } | null>(null);
  const [desktopPropertyCardOpen, setDesktopPropertyCardOpen] = useState(false);
  const [plotEnquiryModalOpen, setPlotEnquiryModalOpen] = useState(false);

  // Compare mode state (selecting properties on map & viewing comparison table)
  const [compareSelectingMode, setCompareSelectingMode] = useState(false);
  const compareSelectingModeRef = useRef(false);
  compareSelectingModeRef.current = compareSelectingMode;
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);


  const startCompareMode = useCallback((initialId?: string) => {
    // Close any open property cards, layout, or mobile bottom-sheets
    setActiveProjectId(null);
    setSelectedProjectId(null);
    setSelectedId(null);
    setDesktopPropertyCardOpen(false);
    setPropertySheetExpanded(false);
    setMobilePlotExpanded(false);
    setPanelOpen(false);

    // Activate compare mode and auto-select initialId
    setCompareSelectingMode(true);
    if (initialId) {
      setCompareSelectedIds((prev) =>
        prev.includes(initialId) ? prev : [...prev, initialId],
      );
    }
  }, []);

  const toggleCompareId = useCallback((id: string) => {
    setCompareSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }, []);


  /**
   * Attaches the master plan to the open estate.
   *
   * Format priority (from `resolveLayoutImageCandidates` in layoutPreview):
   *   1. SVG  — ImageBitmap → MapLibre `estate-layout-image`
   *   2. TIFF — MapLibre image via geotiff decode
   *   3. PNG  — (also JPEG/WebP) MapLibre image bitmap
   *
   * Both `layout_preview_url` and `tif_url` are scanned; URLs are tried in that
   * order until one loads. Presigned links expire (~1h); on total failure the
   * units payload is refreshed once for fresh signatures, then we give up.
   *
   * Paints the WebGL image source on the current frame via `syncLayoutRaster`
   * before React state updates, so the master plan does not wait on reconcile.
   */
  const applyLayoutRaster = useCallback(
    (propertyId: string, raster: LayoutRaster) => {
      pendingLayoutRef.current = { propertyId, raster };
      const map = mapRef.current;
      if (map) {
        syncLayoutRaster(map, raster, true);
      }
      setRemoteProject((current) => {
        if (!current || current.id !== propertyId) return current;
        // Already merged via pendingLayoutRef on estate commit — skip a no-op render.
        if (current.layoutRaster === raster) return current;
        return { ...current, layoutRaster: raster };
      });
    },
    [],
  );

  const attachLayoutImage = useCallback(
    async (input: {
      propertyId: string;
      layoutPreviewUrl: string | null;
      tifUrl: string | null;
      cords: PropertyLayoutCords;
      signal: AbortSignal;
    }) => {
      let { layoutPreviewUrl, tifUrl, cords } = input;

      const decodeAsset = async (
        candidateUrl: string,
        loader: "tiff" | "svg-html" | "raster",
        assetData: string | ArrayBuffer,
        contentType: string,
      ): Promise<LayoutRaster | undefined> => {
        if (loader === "tiff" && assetData instanceof ArrayBuffer) {
          return loadLayoutRasterFromBuffer({
            propertyId: input.propertyId,
            buffer: assetData,
            cords,
            signal: input.signal,
          });
        }
        return loadLayoutPreviewFromPrefetch({
          propertyId: input.propertyId,
          previewUrl: candidateUrl,
          cords,
          data: assetData,
          contentType,
          signal: input.signal,
        });
      };

      // Fast path: warm layoutAssetCache hit → decode and apply, skip refresh loop.
      {
        const warmCandidates = resolveLayoutImageCandidates(
          layoutPreviewUrl,
          tifUrl,
        );
        for (const candidate of warmCandidates) {
          if (input.signal.aborted) return;
          const cachedPromise = peekLayoutAsset(candidate.url);
          if (!cachedPromise) continue;
          try {
            const { data: assetData, contentType } = await cachedPromise;
            if (input.signal.aborted) return;
            const raster = await decodeAsset(
              candidate.url,
              candidate.loader,
              assetData,
              contentType,
            );
            if (raster) {
              console.log("[ILA map] layout image fast-path (warm cache)", {
                propertyId: input.propertyId,
                format: candidate.format,
                loader: candidate.loader,
              });
              applyLayoutRaster(input.propertyId, raster);
              return;
            }
          } catch {
            // Fall through to full candidate / refresh path.
          }
        }
      }

      const tryCandidates = async () => {
        const candidates = resolveLayoutImageCandidates(layoutPreviewUrl, tifUrl);
        if (candidates.length === 0) return undefined;

        console.log("[ILA map] layout image candidates (SVG → TIFF → PNG)", {
          propertyId: input.propertyId,
          candidates: candidates.map((c) => ({ format: c.format, loader: c.loader })),
        });

        for (const candidate of candidates) {
          if (input.signal.aborted) return undefined;

          let raster: LayoutRaster | undefined;

          try {
            const { data: assetData, contentType } = await getLayoutAsset(
              candidate.url,
            );
            if (input.signal.aborted) return undefined;
            raster = await decodeAsset(
              candidate.url,
              candidate.loader,
              assetData,
              contentType,
            );
          } catch (prefetchErr) {
            console.warn(
              "[ILA map] layout prefetch miss — falling back to cold load",
              prefetchErr,
            );
          }

          if (!raster) {
            raster =
              candidate.loader === "tiff"
                ? await loadLayoutRaster({
                    propertyId: input.propertyId,
                    tifUrl: candidate.url,
                    cords,
                    signal: input.signal,
                  })
                : await loadLayoutPreviewRaster({
                    propertyId: input.propertyId,
                    previewUrl: candidate.url,
                    cords,
                    signal: input.signal,
                  });
          }

          if (raster) {
            console.log("[ILA map] layout image loaded", {
              propertyId: input.propertyId,
              format: candidate.format,
              loader: candidate.loader,
            });
            return raster;
          }

          console.warn("[ILA map] layout candidate failed, trying next format", {
            propertyId: input.propertyId,
            format: candidate.format,
          });
        }
        return undefined;
      };

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const raster = await tryCandidates();
        if (input.signal.aborted) return;

        if (raster) {
          applyLayoutRaster(input.propertyId, raster);
          return;
        }

        if (attempt === 2) {
          console.warn("[ILA map] giving up on the layout image", {
            propertyId: input.propertyId,
          });
          return;
        }

        console.warn(
          "[ILA map] layout image failed — re-requesting estate for a fresh presigned URL",
        );
        clearEstateCache(input.propertyId);
        try {
          const refreshed = await getEstateData(input.propertyId);
          if (input.signal.aborted) return;
          const parsed = parseUnitsEnvelope(refreshed.units);
          if (!parsed.layoutPreviewUrl && !parsed.tifUrl) return;
          layoutPreviewUrl = parsed.layoutPreviewUrl ?? layoutPreviewUrl;
          tifUrl = parsed.tifUrl ?? tifUrl;
          if (parsed.layoutCords) cords = parsed.layoutCords;
        } catch (refreshErr) {
          console.warn("[ILA map] estate refresh for layout URL failed", refreshErr);
          return;
        }
      }
    },
    [applyLayoutRaster],
  );

  /**
   * Loads one property via `/api/estates/{id}` (cached by estatePrefetch),
   * builds plot GeoJSON, then attaches the layout image.
   *
   * `openLayout`/`openSheet` are for pin taps and list taps alike: the map
   * already knows which property was chosen, so the master plan (desktop) or
   * the compact property sheet (mobile) opens — zoomed to the plots — as soon
   * as the geometry arrives, instead of waiting for a second click.
   *
   * `silent` marks the mount-time warm-up. It neither raises the loading state
   * nor lowers it on failure, because the visitor did not request it and the
   * portfolio pins are already rendered behind it.
   */
  const selectProperty = useCallback(
    async (
      propertyId: string,
      options: { openLayout?: boolean; openSheet?: boolean; openDesktopCard?: boolean; silent?: boolean } = {},
    ) => {
      // Any in-flight selection is now stale; abort it rather than racing it.
      selectAbortRef.current?.abort();
      const controller = new AbortController();
      selectAbortRef.current = controller;
      pendingLayoutRef.current = null;

      setActivePropertyId(propertyId);

      // A silent selection is the background warm-up that opens the first
      // property on mount. The visitor did not ask for it, so it must not dim
      // the map behind a spinner while their own data is already on screen.
      if (!options.silent) setRemoteStatus("loading");

      setRemoteProject(null);
      setActiveProjectId(null);
      setSelectedProjectId(null);
      setSelectedId(null);
      setActivePropertyDetail(null);
      setUnitsCount(0);

      try {
        // Check if propertyId maps to a static project (e.g. sark-green-plains, singapore-township, green-meadows)
        const staticProjectId =
          propertyId === "sark-green-plains" ? "sark-green" : propertyId;
        const staticProject = getProjectById(staticProjectId) ?? getProjectById(propertyId);

        if (staticProject) {
          setRemoteProject(staticProject);
          setRemoteStatus("ready");
          setSelectedId(null);
          setPanelOpen(true);
          setFilter("all");
          setMobilePlotExpanded(false);
          setPropertySheetExpanded(false);
          setUnitsCount(staticProject.plots.length);

          if (options.openLayout) setActiveProjectId(staticProject.id);
          if (options.openSheet) setSelectedProjectId(staticProject.id);
          if (options.openDesktopCard) setDesktopPropertyCardOpen(true);

          console.info(
            `[ILA Static] loaded ${staticProject.plots.length} plots`,
            staticProject.name,
          );
          return;
        }

        // Cached estate aggregate (pre-warmed / hover-prefetched when available).
        const { property: propDetail, units: unitsData } =
          await getEstateData(propertyId);
        if (controller.signal.aborted) return;

        console.log("[ILA API] property click — response", {
          propertyId,
          property: propDetail,
          units: unitsData,
        });

        const detail = propDetail as ApiProperty;
        setActivePropertyDetail(detail);

        const {
          unitsJson,
          unitCount,
          layoutPreviewUrl,
          tifUrl,
          layoutCords,
        } = parseUnitsEnvelope(unitsData);
        setUnitsCount(unitCount);

        // Start the layout image as soon as cords + URL exist — concurrent with
        // vector plot geometry work (pending raster merges when estate commits).
        let layoutAttachStarted = false;
        if (layoutCords && (layoutPreviewUrl || tifUrl)) {
          layoutAttachStarted = true;
          void attachLayoutImage({
            propertyId,
            layoutPreviewUrl,
            tifUrl,
            cords: layoutCords,
            signal: controller.signal,
          });
        }

        // Coordinates come from the property detail or fallback to the list row
        const listItem = propertyList.find((item) => item.id === propertyId);
        const anchor =
          propertyAnchor(detail) ??
          (listItem ? propertyAnchor(listItem) : null);
        setPropertyAnchors((prev) =>
          anchor ? { ...prev, [propertyId]: anchor } : prev,
        );

        const locationLabel =
          [detail.locality, detail.city].filter(Boolean).join(", ") ||
          "Hyderabad";

        let estate: EstateProject | null = null;
        // Build vector plots when units exist; otherwise fall through to placeholder.
        if (unitsData != null) {
          try {
            estate = estateFromUnitsApi({
              propertyId,
              name: detail.name,
              location: locationLabel,
              anchor,
              layoutCords,
              unitsJson,
            });
          } catch (geomErr) {
            console.warn(
              "[ILA API] could not build vector plots from units, checking layout image",
              geomErr,
            );
          }
        }

        // If units are null / have no geometries, create a fallback estate
        // georeferenced to layoutCords or the property anchor so the layout
        // raster can still render (estate-plots-* stay empty).
        if (!estate) {
          if (anchor) {
            estate = estatePlaceholderFromProperty({
              propertyId,
              name: detail.name,
              location: locationLabel,
              anchor,
            });
            if (layoutCords) {
              estate.bounds = layoutCordsToBounds(layoutCords);
            }
          }
        }

        if (!estate) {
          setRemoteProject(null);
          setRemoteStatus("ready");
          setSelectedId(null);
          setPanelOpen(true);
          setFilter("all");
          if (options.openSheet) setSelectedProjectId(propertyId);
          if (options.openDesktopCard) setDesktopPropertyCardOpen(true);
          console.info(
            "[ILA API] property has no units and no coordinates",
            detail.name,
          );
          return;
        }

        // Layout may have finished concurrently — merge before the first commit
        // so React and the map open with one paint (applyLayoutRaster may already
        // have pushed the texture via syncLayoutRaster).
        const pending = pendingLayoutRef.current;
        if (pending && (pending as { propertyId: string; raster: LayoutRaster }).propertyId === propertyId) {
          estate.layoutRaster = (pending as { propertyId: string; raster: LayoutRaster }).raster;
        }

        setRemoteProject(estate);
        setRemoteStatus("ready");
        setSelectedId(null);
        setPanelOpen(true);
        setFilter("all");
        setMobilePlotExpanded(false);
        setPropertySheetExpanded(false);

        // Fallback: no API layoutCords — derive from plot bounds and attach late.
        if (!layoutAttachStarted) {
          const effectiveCords: PropertyLayoutCords | null =
            layoutCords ??
            (estate.bounds
              ? {
                  west: estate.bounds.minLng,
                  east: estate.bounds.maxLng,
                  north: estate.bounds.maxLat,
                  south: estate.bounds.minLat,
                }
              : null);

          if (effectiveCords && (layoutPreviewUrl || tifUrl)) {
            void attachLayoutImage({
              propertyId,
              layoutPreviewUrl,
              tifUrl,
              cords: effectiveCords,
              signal: controller.signal,
            });
          } else {
            console.warn("[ILA map] units response had no layout image to draw", {
              propertyId,
              hasLayoutPreviewUrl: Boolean(layoutPreviewUrl),
              hasTifUrl: Boolean(tifUrl),
              hasLayoutCords: Boolean(effectiveCords),
            });
          }
        }

        // The layout can only be opened once its geometry is loaded.
        if (options.openLayout) setActiveProjectId(estate.id);
        if (options.openSheet) setSelectedProjectId(estate.id);
        if (options.openDesktopCard) setDesktopPropertyCardOpen(true);

        console.info(
          `[ILA API] loaded ${estate.plots.length} plots`,
          estate.name,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        // A failed warm-up is not a failed map: the list and its pins are
        // already on screen, so it must not replace them with an error state.
        if (!options.silent) setRemoteStatus("error");
        console.warn("[ILA API] property load failed", error);
      }
    },
    [attachLayoutImage, propertyList],
  );

  // Keep pin click handlers in a ref so WebGL layer listeners stay stable across renders.
  useEffect(() => {
    pinHandlersRef.current = {
      selectProperty,
      toggleCompareId,
      setEmiSelectedProperty,
      setEmiSelectingProperty,
      setEmiOpen,
      propertyList,
    };
  }, [
    selectProperty,
    toggleCompareId,
    setEmiSelectedProperty,
    setEmiSelectingProperty,
    setEmiOpen,
    propertyList,
  ]);

  // Keep latest selectProperty for post-list open without re-fetching the catalogue.
  const selectPropertyRef = useRef(selectProperty);
  selectPropertyRef.current = selectProperty;

  // Pre-warm the first few catalogue estates (and their layout assets) after list load.
  useEffect(() => {
    if (!propertyList || propertyList.length === 0) return;

    console.log(
      "⚡ [MapSection] Triggering pre-warm for:",
      propertyList.slice(0, 4).map((p) => p.id),
    );

    const timer = setTimeout(() => {
      propertyList.slice(0, 4).forEach((prop) => {
        void prefetchEstate(prop.id).catch((err) => {
          // Background warm-up is best-effort; one bad estate must not surface
          // as an uncaught rejection (e.g. upstream 502 for a single UUID).
          console.warn("[MapSection] estate pre-warm failed", prop.id, err);
        });
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [propertyList]);

  // Step 1: list every property — one shared controller/promise per fetch key.
  useEffect(() => {
    // If initialProperties was already provided by the server and we are not retrying,
    // we already seeded the state synchronously, so skip the redundant network call.
    if (
      Array.isArray(initialProperties) &&
      initialProperties.length > 0 &&
      propertiesRetryCount === 0 &&
      !singlePropertyId
    ) {
      setRemoteStatus("ready");
      return;
    }

    const fetchKey = `${singlePropertyId ?? ""}:${propertiesRetryCount}`;
    let ignore = false;

    if (!sharedPropertiesListFetch || sharedPropertiesListFetch.key !== fetchKey) {
      sharedPropertiesListFetch?.controller.abort();
      const controller = new AbortController();
      console.log(
        `[ILA API] GET ${ILA_API_BASE_URL}/api/properties?status=ALL&page=1&per_page=100`,
      );
      sharedPropertiesListFetch = {
        key: fetchKey,
        controller,
        promise: fetchProperties({
          status: "ALL",
          page: 1,
          perPage: 100,
          signal: controller.signal,
        }),
      };
    }

    const { controller, promise } = sharedPropertiesListFetch;
    setRemoteStatus("loading");

    promise
      .then((result) => {
        if (ignore || controller.signal.aborted) return;
        setRemoteStatus("ready");

        console.log("[ILA API] properties list — response", {
          returned: result.items.length,
          total: result.total,
          totalPages: result.totalPages,
          items: result.items,
        });

        setPropertyList(result.items);

        // Seed pins from the rows that already carry coordinates. This is
        // synchronous, so those pins render on the very next frame with no
        // detail call involved at all. Missing anchors are backfilled only
        // after the map's first idle (see effect below).
        const seeded: Record<string, PropertyAnchor> = {};
        for (const item of result.items) {
          const anchor = propertyAnchor(item);
          if (anchor) seeded[item.id] = anchor;
        }
        if (Object.keys(seeded).length > 0) setPropertyAnchors(seeded);

        // When a single property is requested (e.g. on /properties/{id}),
        // immediately open that property's layout.
        if (singlePropertyId) {
          void selectPropertyRef.current(singlePropertyId, {
            openLayout: true,
            openSheet: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (ignore || controller.signal.aborted) return;
        if (singlePropertyId) {
          // In single property mode, also try selecting directly via getEstateData
          void selectPropertyRef.current(singlePropertyId, {
            openLayout: true,
            openSheet: false,
          });
        } else {
          setRemoteStatus("error");
        }
        console.warn("[ILA API] properties list failed", error);
      });

    return () => {
      // Ignore results from this effect instance. Do not abort the shared
      // controller here — StrictMode remounts reuse the same in-flight request.
      ignore = true;
    };
  }, [singlePropertyId, propertiesRetryCount]);

  // Latest anchors for missing-item filtering without re-running this effect
  // on every progressive pin update (which would abort the in-flight backfill).
  const propertyAnchorsRef = useRef(propertyAnchors);
  propertyAnchorsRef.current = propertyAnchors;

  // Backfill missing property coordinates only after the basemap has settled,
  // so detail GETs do not compete with OpenFreeMap style/tile/sprite downloads.
  useEffect(() => {
    if (!mapReady || propertyList.length === 0) return;
    const map = mapRef.current;
    if (!map) return;

    const missingItems = propertyList.filter(
      (item) => !propertyAnchor(item) && !propertyAnchorsRef.current[item.id],
    );
    if (missingItems.length === 0) return;

    let cancelled = false;
    let started = false;
    const controller = new AbortController();

    const flushPendingAnchors = () => {
      anchorRafRef.current = null;
      const batch = pendingAnchorsRef.current;
      if (Object.keys(batch).length === 0) return;
      pendingAnchorsRef.current = {};
      setPropertyAnchors((previous) => ({ ...previous, ...batch }));
    };

    const startAnchorBackfill = () => {
      if (cancelled || started) return;
      started = true;

      fetchPropertyAnchors(missingItems, {
        signal: controller.signal,
        concurrency: 2,
        onAnchor: (propertyId, anchor) => {
          if (cancelled || controller.signal.aborted) return;
          pendingAnchorsRef.current[propertyId] = anchor;
          if (anchorRafRef.current === null) {
            anchorRafRef.current = window.requestAnimationFrame(flushPendingAnchors);
          }
        },
      }).then((anchors) => {
        if (cancelled || controller.signal.aborted) return;
        if (anchorRafRef.current !== null) {
          window.cancelAnimationFrame(anchorRafRef.current);
          anchorRafRef.current = null;
        }
        pendingAnchorsRef.current = {};
        setPropertyAnchors((previous) => ({ ...previous, ...anchors }));
      });
    };

    // Wait until the camera settles and basemap vector tiles are painted.
    map.once("idle", startAnchorBackfill);

    return () => {
      cancelled = true;
      controller.abort();
      map.off("idle", startAnchorBackfill);
      if (anchorRafRef.current !== null) {
        window.cancelAnimationFrame(anchorRafRef.current);
        anchorRafRef.current = null;
      }
      pendingAnchorsRef.current = {};
    };
  }, [mapReady, propertyList]);

  /**
   * One pin per listed property, so the whole portfolio is on the map before
   * anything is clicked. A property only gets a pin once its coordinates are
   * known; the selected property's pin comes from the loaded layout, which is
   * the authoritative position for it.
   */
  const pins = useMemo<MapPin[]>(() => {
    const byId = new Map<string, MapPin>();

    for (const item of propertyList) {
      const anchor = propertyAnchor(item) ?? propertyAnchors[item.id];
      if (!anchor) continue;

      const itemAny = item as Record<string, unknown>;
      const staticProp =
        getPropertyById(item.id === "sark-green" ? "sark-green-plains" : item.id) ||
        (item.slug ? getPropertyById(item.slug) : undefined);

      const rawNum = (val: unknown): number | null => {
        if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
        if (typeof val === "string") {
          const parsed = Number(val.trim());
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
        }
        return null;
      };

      const parsedMin = rawNum(itemAny.minimum_price);
      const parsedTarget = rawNum(itemAny.target_price);
      const parsedPrice = rawNum(item.price) ?? rawNum(staticProp?.price);

      let displayPrice: string | null = null;
      if (item.price_label && item.price_label.trim() && !item.price_label.toLowerCase().includes("request")) {
        displayPrice = item.price_label.trim().replace(/\s+-\s+/g, " – ");
        if (!/^(from|starting|₹)/i.test(displayPrice)) {
          displayPrice = `From ${displayPrice}`;
        }
      } else if (staticProp?.priceLabel && !staticProp.priceLabel.toLowerCase().includes("request")) {
        displayPrice = staticProp.priceLabel.trim().replace(/\s+-\s+/g, " – ");
        if (!/^(from|starting|₹)/i.test(displayPrice)) {
          displayPrice = `From ${displayPrice}`;
        }
      } else if (parsedMin && parsedTarget && parsedTarget > parsedMin) {
        displayPrice = `${formatPrice(parsedMin)} – ${formatPrice(parsedTarget)}`;
      } else if (parsedMin) {
        displayPrice = `From ${formatPrice(parsedMin)}`;
      } else if (parsedPrice) {
        displayPrice = `From ${formatPrice(parsedPrice)}`;
      } else if (staticProp?.price) {
        displayPrice = `From ${formatInr(staticProp.price)}`;
      }

      byId.set(item.id, {
        id: item.id,
        name: item.name,
        location: [item.locality, item.city].filter(Boolean).join(", ") || undefined,
        center: [anchor.longitude, anchor.latitude],
        price: parsedPrice ?? parsedMin ?? null,
        formattedPrice: displayPrice,
      });
    }

    for (const project of projects) {
      if (!byId.has(project.id)) {
        const prop = getPropertyById(project.id === "sark-green" ? "sark-green-plains" : project.id);
        const displayPrice = prop?.priceLabel
          ? (prop.priceLabel.toLowerCase().startsWith("from") ? prop.priceLabel : `From ${prop.priceLabel}`)
          : prop?.price
            ? `From ${formatInr(prop.price)}`
            : null;
        byId.set(project.id, {
          id: project.id,
          name: project.name,
          location: project.location,
          center: project.center,
          price: prop?.price ?? null,
          formattedPrice: displayPrice,
        });
      }
    }

    const resultPins = [...byId.values()];
    const filteredPins = singlePropertyId
      ? resultPins.filter(
          (p) =>
            p.id === singlePropertyId ||
            (singlePropertyId === "sark-green-plains" && p.id === "sark-green"),
        )
      : resultPins;

    if (filteredPins.length > 0) {
      console.info(
        "[ILA map] Pointers placed from API coordinates:",
        filteredPins.map((p) => ({
          name: p.name,
          latitude: p.center[1],
          longitude: p.center[0],
        })),
      );
    }
    return filteredPins;
  }, [propertyAnchors, propertyList, projects, singlePropertyId]);

  // Keep pinsByIdRef in sync with latest pins data for click handlers and label updates
  useEffect(() => {
    pinsByIdRef.current = new Map(pins.map((p) => [p.id, p]));
  }, [pins]);

  /** Frames every pin, so "reset view" shows the whole portfolio. */
  const pinsBounds = useMemo<Bounds>(() => {
    if (pins.length === 0) return projectsBounds;
    return pins.reduce(
      (acc, pin) => ({
        minLng: Math.min(acc.minLng, pin.center[0]),
        minLat: Math.min(acc.minLat, pin.center[1]),
        maxLng: Math.max(acc.maxLng, pin.center[0]),
        maxLat: Math.max(acc.maxLat, pin.center[1]),
      }),
      {
        minLng: Infinity,
        minLat: Infinity,
        maxLng: -Infinity,
        maxLat: -Infinity,
      },
    );
  }, [pins, projectsBounds]);

  // Steps 2 and 3: detail then units for the selected property.

  // Show the zoom hint once the first time the map scrolls into view on mobile
  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.45) return;
        showZoomHintRef.current();
        observer.disconnect();
      },
      { threshold: [0.45, 0.6] },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedProperty = useMemo<PropertyRecord | undefined>(() => {
    if (!selectedProject) return undefined;

    // The map's local estate id predates the property catalogue id.
    const propertyId =
      selectedProject.id === "sark-green" ? "sark-green-plains" : selectedProject.id;
    return getPropertyById(propertyId);
  }, [selectedProject]);

  // The sidebar keeps showing the property card even once a plot is picked,
  // so it needs the record for whichever project is currently open.
  const activeProperty = useMemo<PropertyRecord | undefined>(() => {
    if (!activeProject) return undefined;

    const propertyId =
      activeProject.id === "sark-green" ? "sark-green-plains" : activeProject.id;
    return getPropertyById(propertyId);
  }, [activeProject]);

  // The catalogue response can already contain popup-ready fields such as
  // price_label, amenities, total_plots, and area_range. Merge that row with
  // the richer detail response so the sheet displays whichever API response
  // supplied each field.
  const activePopupApiProperty = useMemo<ApiProperty | null>(() => {
    if (!activePropertyId) return null;
    const detail =
      activePropertyDetail?.id === activePropertyId
        ? activePropertyDetail
        : null;
    const listItem = propertyList.find((item) => item.id === activePropertyId);
    if (!detail) return null;

    return {
      ...detail,
      ...(listItem?.price_label !== undefined
        ? { price_label: listItem.price_label }
        : {}),
      ...(listItem?.amenities !== undefined
        ? { amenities: listItem.amenities }
        : {}),
      ...(listItem?.total_plots !== undefined
        ? { total_plots: listItem.total_plots }
        : {}),
      ...(listItem?.available_plots_count !== undefined
        ? { available_plots_count: listItem.available_plots_count }
        : {}),
      ...(listItem?.area_range !== undefined
        ? { area_range: listItem.area_range }
        : {}),
    };
  }, [activePropertyDetail, activePropertyId, propertyList]);

  const layoutOpen = Boolean(activeProject);

  /**
   * Detail-page target for the sidebar CTA. `PropertySheet` resolves its own
   * "View Project" link the same way (local record first, API UUID second); the
   * sidebar footer reads it from here so both point at the same property.
   */
  const activePropertyHref = useMemo(() => {
    const id =
      activeProperty?.id ??
      activePopupApiProperty?.id ??
      activePropertyDetail?.id ??
      activePropertyId;
    return id ? `/properties/${id}` : null;
  }, [
    activePopupApiProperty?.id,
    activeProperty?.id,
    activePropertyDetail?.id,
    activePropertyId,
  ]);

  const counts = useMemo(() => {
    const plots = activeProject
      ? activeProject.plots
      : projects.flatMap((project) => project.plots);
    return {
      all: plots.length,
      available: plots.filter((p) => p.status === "available").length,
      booked: plots.filter((p) => p.status === "booked").length,
      sold: plots.filter((p) => p.status === "sold").length,
      blocked: plots.filter((p) => p.status === "blocked").length,
    };
  }, [activeProject, projects]);

  // "Our Developments" renders the GET /api/properties catalogue. The list
  // endpoint returns trimmed rows, so the search matches on the fields it has:
  // name, type, description and slug.
  const filteredProperties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return propertyList;
    return propertyList.filter((item) =>
      [item.name, item.property_type, item.slug, item.description]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q)),
    );
  }, [propertyList, query]);

  /**
   * Plot numbers in the open layout that match the search box, or null when
   * there is nothing to search.
   *
   * The development list is hidden while a layout is open, so until this existed
   * the query only swapped the placeholder and matched nothing. With a layout
   * open it now narrows the plotted polygons instead.
   *
   * Reads the feature properties rather than the `Plot` display records because
   * the raw values are the searchable ones: `facing` is the API's own
   * "East  South" before `formatFacing` tidies it, and `plotNo` is the zero
   * padded number a visitor would actually type. Matching is the same trimmed,
   * lowercased, substring rule as the property matcher, so the two inputs cannot
   * disagree about what a query means.
   */
  const matchedPlotNumbers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !activeProject) return null;

    const matched = new Set<string>();
    for (const feature of activeProject.plotsGeo.features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const haystack = PLOT_SEARCH_FIELDS.map((field) => properties[field])
        .filter((value) => value != null && value !== "")
        .join(" ")
        .toLowerCase();

      if (haystack.includes(q)) matched.add(String(properties.plotNo));
    }

    return matched;
  }, [activeProject, query]);

  const selectedPlot = useMemo(
    () => activeProject?.plots.find((p) => p.id === selectedId) ?? null,
    [activeProject, selectedId],
  );

  const [hoveredPlotId, setHoveredPlotId] = useState<string | null>(null);
  const hoveredPlot = useMemo(
    () => (hoveredPlotId ? activeProject?.plots.find((p) => p.id === hoveredPlotId) ?? null : null),
    [activeProject, hoveredPlotId],
  );

  // Floating tags: display compact floating tags for available plots when zoomed in,
  // and ALWAYS display the tag for whichever plot is clicked/selected (available, booked, sold, or blocked).
  const displayPlotsForTags = useMemo(() => {
    if (!activeProject?.plots) return [];
    const list: typeof activeProject.plots = [];
    const seen = new Set<string>();

    for (const p of activeProject.plots) {
      if (!Number.isFinite(p.lng) || !Number.isFinite(p.lat)) continue;

      if (p.status === "available" || p.id === selectedId) {
        list.push(p);
        seen.add(p.id);
      }
    }

    return list;
  }, [activeProject, selectedId]);

  const [plotTagPositions, setPlotTagPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Update floating tag screen coordinates as map pans, zooms, or layout opens.
  // Only display tags when map is zoomed in (zoom >= 16.5) to keep zoomed-out portfolio view clean.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen || displayPlotsForTags.length === 0) {
      setPlotTagPositions({});
      return;
    }

    const updatePositions = () => {
      try {
        if (map.getZoom() < 16.5) {
          setPlotTagPositions({});
          return;
        }

        const bounds = map.getBounds();
        const nextPositions: Record<string, { x: number; y: number }> = {};

        for (const p of displayPlotsForTags) {
          // Check if within bounds with small buffer to prevent popping at edges
          if (bounds.contains([p.lng, p.lat])) {
            const point = map.project([p.lng, p.lat]);
            nextPositions[p.id] = { x: point.x, y: point.y };
          }
        }

        setPlotTagPositions(nextPositions);
      } catch {
        setPlotTagPositions({});
      }
    };

    updatePositions();
    map.on("move", updatePositions);
    map.on("zoom", updatePositions);
    return () => {
      map.off("move", updatePositions);
      map.off("zoom", updatePositions);
    };
  }, [displayPlotsForTags, layoutOpen, mapReady]);

  const openProject = (projectId: ProjectId, plotId?: string | null) => {
    setPanelOpen(true);
    setActiveProjectId(projectId);
    setFilter("all");
    // Keep query only when jumping into a specific plot; otherwise clear for a full list.
    if (plotId) {
      setSelectedId(plotId);
      setMobilePlotExpanded(false);
      setPropertySheetExpanded(false);
      // A plot takes visual priority over the property summary card.
      setSelectedProjectId(null);
    } else {
      setQuery("");
      setSelectedId(null);
      setMobilePlotExpanded(false);
      setPropertySheetExpanded(false);
      // Show the property summary in place of the panel heading.
      setSelectedProjectId(projectId);
    }
  };

  const closeLayout = () => {
    setActiveProjectId(null);
    setSelectedProjectId(null);
    setSelectedId(null);
    setDesktopPropertyCardOpen(false);
    setMobilePlotExpanded(false);
    setPropertySheetExpanded(false);
    setFilter("all");
    setQuery("");
    setFocusRequest(null);
    // Closing a popup must return the map to its regular zoomed-out portfolio
    // view. Clearing the fitted-signature guard and immediately fitting bounds.
    fittedPinsRef.current = "";
    const map = mapRef.current;
    if (map) {
      fitBounds(map, pinsBounds, 50, 13.2, panelOpen);
    }
  };

  const closePanel = () => {
    closeLayout();
    setPanelOpen(false);
  };

  const openPanel = () => {
    setPanelOpen(true);
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Keep map height CSS-stable on mobile (svh). Avoid JS height locking —
  // resizing on scroll/chrome show-hide looks unprofessional.
  useEffect(() => {
    const onOrient = () => {
      window.setTimeout(() => mapRef.current?.resize(), 120);
    };
    window.addEventListener("orientationchange", onOrient);
    return () => {
      window.removeEventListener("orientationchange", onOrient);
      if (desktopScrollHintTimerRef.current) clearTimeout(desktopScrollHintTimerRef.current);
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement ||
          (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
      );
      setMapFullscreen(isFs);
      window.requestAnimationFrame(() => {
        applyInteractionsRef.current();
        mapRef.current?.resize();
      });
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleNativeFullscreen = () => {
    const el = sectionRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        void el.requestFullscreen().catch(() => setMapFullscreen(true));
      } else if ((el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen) {
        void (el as unknown as { webkitRequestFullscreen: () => Promise<void> }).webkitRequestFullscreen();
      } else {
        setMapFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        void document.exitFullscreen().catch(() => setMapFullscreen(false));
      } else if ((document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen) {
        void (document as unknown as { webkitExitFullscreen: () => Promise<void> }).webkitExitFullscreen();
      } else {
        setMapFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      applyInteractionsRef.current();
      mapRef.current?.resize();
    });
    return () => {
      window.cancelAnimationFrame(id);
    };
  }, [mapFullscreen]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Absolute worker URL so MapLibre loads correctly when opened via LAN IP
    const workerUrl = new URL(
      "/maplibre/maplibre-gl-worker.mjs",
      window.location.origin,
    ).toString();
    setWorkerUrl(workerUrl);

    let cancelled = false;
    let map: MapLibreMap | undefined;
    let mobileQuery: MediaQueryList | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let clearMobileTouchListeners = () => {};
    let applyMobileInteractions = () => {};
    let onWheel: (() => void) | undefined;
    let canvas: HTMLElement | undefined;
    let resizeMap = () => {};
    let onOrientationChange = () => {};

    const isMobileScreen =
      typeof window !== "undefined" &&
      !window.matchMedia("(min-width: 768px)").matches;
    const enableCooperativeGestures = Boolean(singlePropertyId) && isMobileScreen;

    void (async () => {
      let prunedStyle;
      try {
        prunedStyle = await loadPrunedLibertyStyle(MAP_STYLE);
      } catch (error) {
        if (cancelled) return;
        console.error("Unable to load the pruned OpenFreeMap style", error);
        setMapError(true);
        return;
      }
      if (cancelled || !mapContainerRef.current) return;

      try {
        map = new MapLibreMap({
          container: mapContainerRef.current,
          // Pruned Liberty JSON (rail / 3D buildings / footpaths / shields / airport POIs removed)
          // so MapLibre never requests unused glyphs or builds buckets for those layers.
          style: prunedStyle,
          center: [78.42, 17.17],
          zoom: 11.4,
          pitch: 0,
          maxZoom: 18.5,
          // Cap offscreen tile retention and skip wrapped world copies so OpenFreeMap
          // sprites/glyphs compete less with the first viewport's tile decode.
          maxTileCacheSize: 15,
          renderWorldCopies: false,
          fadeDuration: 0,
          attributionControl: { compact: true },
          dragRotate: true,
          pitchWithRotate: true,
          touchPitch: true,
          cooperativeGestures: enableCooperativeGestures,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Unable to initialize the developments map", error);
        setMapError(true);
        return;
      }

      if (!map || cancelled) {
        map?.remove();
        return;
      }

      // Const captures so nested handlers see a definite MapLibre instance.
      const liveMap = map;
      mobileQuery = window.matchMedia("(max-width: 767px)");
      const liveMq = mobileQuery;

      mapRef.current = liveMap;
      liveMap.on("error", (event) => {
        console.error("Developments map error", event.error);
        if (!mapReadyRef.current) setMapError(true);
      });

    // Mobile: native vertical page scroll + horizontal map pan + pinch zoom
    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    let gestureAxis: "pending" | "horizontal" | "vertical" | "pinch" =
      "pending";
    canvas = liveMap.getCanvasContainer();
    const glCanvas = liveMap.getCanvas();

    const setMobileTouchAction = (enabled: boolean) => {
      if (!canvas) return;
      const value = enabled ? "pan-y" : "";
      canvas.style.touchAction = value;
      glCanvas.style.touchAction = value;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (mapFullscreenRef.current) return;
      if (event.touches.length === 1) {
        lastTouchX = event.touches[0].clientX;
        lastTouchY = event.touches[0].clientY;
        gestureAxis = "pending";
        showZoomHintRef.current();
      } else {
        lastTouchX = null;
        lastTouchY = null;
        gestureAxis = "pinch";
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!liveMq.matches || mapFullscreenRef.current) return;

      if (event.touches.length !== 1) {
        gestureAxis = "pinch";
        lastTouchX = null;
        lastTouchY = null;
        return;
      }

      if (lastTouchX === null || lastTouchY === null) return;
      if (gestureAxis === "vertical" || gestureAxis === "pinch") return;

      const touch = event.touches[0];
      const dx = touch.clientX - lastTouchX;
      const dy = touch.clientY - lastTouchY;

      if (gestureAxis === "pending") {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        gestureAxis =
          Math.abs(dx) > Math.abs(dy) * 1.15 ? "horizontal" : "vertical";
        if (gestureAxis === "vertical") return;
      }

      if (gestureAxis !== "horizontal") return;

      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      event.preventDefault();
      liveMap.panBy([-dx, 0], { animate: false });
    };

    const onTouchEnd = () => {
      lastTouchX = null;
      lastTouchY = null;
      gestureAxis = "pending";
    };

    clearMobileTouchListeners = () => {
      canvas?.removeEventListener("touchstart", onTouchStart);
      canvas?.removeEventListener("touchmove", onTouchMove);
      canvas?.removeEventListener("touchend", onTouchEnd);
      canvas?.removeEventListener("touchcancel", onTouchEnd);
    };

    applyMobileInteractions = () => {
      clearMobileTouchListeners();
      const isMobile = liveMq.matches;
      const isPropertyPage = Boolean(singlePropertyId);

      if (isPropertyPage && isMobile && !mapFullscreenRef.current) {
        // Enforce restriction to use two fingers on property pages:
        liveMap.cooperativeGestures?.enable();
        liveMap.scrollZoom.disable();
        liveMap.dragPan.enable();
        liveMap.touchZoomRotate.enable();
        liveMap.touchZoomRotate.enableRotation();
        liveMap.dragRotate.enable();
        setMobileTouchAction(true);
      } else {
        // Unrestricted full interaction on desktop or homepage:
        liveMap.cooperativeGestures?.disable();
        liveMap.scrollZoom.enable();
        liveMap.dragPan.enable();
        liveMap.touchZoomRotate.enable();
        liveMap.touchZoomRotate.enableRotation();
        liveMap.dragRotate.enable();
        setMobileTouchAction(false);
      }
    };

    onWheel = () => {
      if (mapFullscreenRef.current || liveMq.matches) return;
      setDesktopScrollHint(true);
      if (desktopScrollHintTimerRef.current) clearTimeout(desktopScrollHintTimerRef.current);
      desktopScrollHintTimerRef.current = setTimeout(() => {
        setDesktopScrollHint(false);
        desktopScrollHintTimerRef.current = null;
      }, 2500);
    };
    canvas.addEventListener("wheel", onWheel, { passive: true });

    applyInteractionsRef.current = applyMobileInteractions;
    applyMobileInteractions();
    liveMq.addEventListener("change", applyMobileInteractions);

    resizeMap = () => {
      liveMap.resize();
    };
    resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            liveMap.resize();
          })
        : null;
    onOrientationChange = () => liveMap.resize();
    resizeObserver?.observe(mapContainerRef.current);
    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("resize", resizeMap);
    window.requestAnimationFrame(() => liveMap.resize());

    liveMap.on("load", () => {
      liveMap.resize();
      window.requestAnimationFrame(() => liveMap.resize());
      if (liveMq.matches) setMobileTouchAction(true);

      const updateZoomClass = () => {
        if (!mapContainerRef.current) return;
        const currentZoom = liveMap.getZoom();
        if (currentZoom >= 12.5) {
          mapContainerRef.current.classList.add("map--zoomed-in");
        } else {
          mapContainerRef.current.classList.remove("map--zoomed-in");
        }

        if (currentZoom >= 18.2) {
          setMaxZoomNotice(true);
          if (maxZoomNoticeTimerRef.current) clearTimeout(maxZoomNoticeTimerRef.current);
          maxZoomNoticeTimerRef.current = setTimeout(() => {
            setMaxZoomNotice(false);
            maxZoomNoticeTimerRef.current = null;
          }, 3200);
        }
      };
      updateZoomClass();
      liveMap.on("zoom", updateZoomClass);

      // MAP_ZOOM_REGION: report the viewport the visitor settled on, so we can
      // tell which part of the layout they are exploring. Debounced by 800ms
      // so active pan/zoom gestures do not flood the analytics queue.
      let lastZoomRegion = "";
      liveMap.on("moveend", () => {
        updateZoomClass();
        const center = liveMap.getCenter();
        const region = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}@${liveMap
          .getZoom()
          .toFixed(1)}`;
        if (region === lastZoomRegion) return;
        lastZoomRegion = region;

        if (zoomRegionTimerRef.current) clearTimeout(zoomRegionTimerRef.current);
        zoomRegionTimerRef.current = setTimeout(() => {
          zoomRegionTimerRef.current = null;
          trackEvent({
            event_type: "MAP_ZOOM_REGION",
            property_id: activePropertyId ?? undefined,
            metadata: {
              center_lat: Number(center.lat.toFixed(5)),
              center_lng: Number(center.lng.toFixed(5)),
              zoom: Number(liveMap.getZoom().toFixed(2)),
              section_type: "hero_map",
            },
          });
        }, 800);
      });

      liveMap.addSource("estate-site-pad", { type: "geojson", data: EMPTY_FC });
      liveMap.addSource("estate-open-areas", { type: "geojson", data: EMPTY_FC });
      liveMap.addSource("estate-plots", { type: "geojson", data: EMPTY_FC });
      liveMap.addSource("estate-roads", { type: "geojson", data: EMPTY_FC });
      liveMap.addSource("estate-road-centers", { type: "geojson", data: EMPTY_FC });

      liveMap.addSource(SATELLITE_SOURCE_ID, {
        type: "raster",
        tiles: [SATELLITE_TILES_URL],
        tileSize: 256,
        maxzoom: 19,
        attribution: SATELLITE_ATTRIBUTION,
      });
      liveMap.addLayer({
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        layout: { visibility: "none" },
        paint: { "raster-fade-duration": 0 },
      });

      void (async () => {
        // Branded ILA pins first so estate layout layers stack above them.
        await ensurePropertyPinLayers(liveMap);
        if (cancelled || mapRef.current !== liveMap) return;

        // Master Plan Layout sources, raster image layer, and vector plot/road layers
        // configured cleanly in map-section-layouts.tsx
        initLayoutLayers(liveMap);

        const selectPropertyPin = (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const pinId = feature?.properties?.id as string | undefined;
          if (!pinId) return;

          const currentPin = pinsByIdRef.current.get(pinId);
          if (!currentPin) return;

          const isMobile = window.matchMedia("(max-width: 767px)").matches;
          trackEvent({
            event_type: "MAP_MARKER_CLICK",
            property_id: currentPin.id,
            metadata: { source: "map_pin", section_type: "hero_map" },
          });

          const handlers = pinHandlersRef.current;

          if (compareSelectingModeRef.current) {
            handlers.toggleCompareId(currentPin.id);
            return;
          }

          if (emiSelectingPropertyRef.current) {
            const matchedItem = handlers.propertyList.find((p) => p.id === currentPin.id);
            const effectivePrice =
              currentPin.price ?? matchedItem?.price ?? 5000000;
            handlers.setEmiSelectedProperty({
              id: currentPin.id,
              name: currentPin.name,
              price: effectivePrice,
              location:
                currentPin.location ||
                [matchedItem?.locality, matchedItem?.city].filter(Boolean).join(", ") ||
                undefined,
            });
            handlers.setEmiSelectingProperty(false);
            handlers.setEmiOpen(true);
            return;
          }

          void handlers.selectProperty(currentPin.id, {
            openSheet: true,
            openDesktopCard: !isMobile,
            openLayout: true,
          });
        };

        liveMap.on("click", PROPERTY_PINS_ICON_LAYER_ID, selectPropertyPin);
        liveMap.on("mouseenter", PROPERTY_PINS_ICON_LAYER_ID, (event: MapLayerMouseEvent) => {
          liveMap.getCanvas().style.cursor = "pointer";
          const pinId = event.features?.[0]?.properties?.id;
          if (typeof pinId === "string" && pinId.length > 0) {
            void prefetchEstate(pinId).catch(() => {
              // Hover prefetch is best-effort.
            });
          }
        });
        liveMap.on("mouseleave", PROPERTY_PINS_ICON_LAYER_ID, () => {
          liveMap.getCanvas().style.cursor = "";
        });

        const selectRenderedPlot = (event: MapMouseEvent) => {
          const feature = liveMap.queryRenderedFeatures(event.point, {
            layers: ["estate-plots-fill"],
          })[0];
          const id = feature?.properties?.id as string | undefined;
          if (!id) return;

          const project = projectsRef.current.find((candidate) =>
            candidate.plots.some((plot) => plot.id === id),
          );
          if (!project) return;

          const clickedPlot = project.plots.find((plot) => plot.id === id);

          // If clicked again and it is NOT an available plot (e.g. booked, sold, or blocked),
          // toggle/unselect it rather than keeping it selected.
          if (selectedIdRef.current === id && clickedPlot?.status !== "available") {
            setSelectedId(null);
            return;
          }

          openProject(project.id, id);

          trackEvent({
            event_type: "MAP_MARKER_CLICK",
            property_id: activePropertyId ?? undefined,
            metadata: {
              plot_id: id,
              project_id: project.id,
              section_type: "hero_map",
            },
          });
        };
        liveMap.on("click", selectRenderedPlot);
        liveMap.on("mousemove", "estate-plots-fill", (e: MapMouseEvent) => {
          liveMap.getCanvas().style.cursor = "pointer";
          const feature = liveMap.queryRenderedFeatures(e.point, {
            layers: ["estate-plots-fill"],
          })[0];
          const id = feature?.properties?.id as string | undefined;
          setHoveredPlotId(id || null);
        });
        liveMap.on("mouseleave", "estate-plots-fill", () => {
          liveMap.getCanvas().style.cursor = "";
          setHoveredPlotId(null);
        });

        // panelOpen starts true, and the effect below re-fits whenever the
        // panel is toggled, so the first framing already reserves the sidebar.
        fitBounds(liveMap, projectsBounds, 50, 13.2, true);
        mapReadyRef.current = true;
        setMapReady(true);
        setMapError(false);

        // Release analytics batch flush only after the first idle (tiles painted),
        // so POST /api/events/batch does not contend with OpenFreeMap downloads.
        liveMap.once("idle", () => {
          allowAnalyticsFlush();
        });
      })();
    });
    })();

    return () => {
      cancelled = true;
      if (zoomRegionTimerRef.current) {
        clearTimeout(zoomRegionTimerRef.current);
        zoomRegionTimerRef.current = null;
      }
      mobileQuery?.removeEventListener("change", applyMobileInteractions);
      clearMobileTouchListeners();
      if (canvas && onWheel) {
        canvas.removeEventListener("wheel", onWheel);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("resize", resizeMap);
      if (map) {
        map.remove();
      }
      mapRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
  }, []);

  // Defer FeatureTutorial mount so logo/map register as LCP before the walkthrough card.
  useEffect(() => {
    if (!mapReady) return;

    const timer = setTimeout(() => {
      setShowTutorial(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [mapReady]);

  // Sync property pins into the WebGL GeoJSON source (GPU symbol layers with ILA icons).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let cancelled = false;

    void (async () => {
      await ensurePropertyPinLayers(map);
      if (cancelled || mapRef.current !== map) return;

      const source = map.getSource(PROPERTY_PINS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      if (!source) return;

      source.setData(
        pinsToGeoJSON(pins, {
          activeProjectId,
          compareSelectingMode,
          compareSelectedIds,
          emiSelectingProperty,
          selectedFeatureKeys,
          featureMatchedPropertyIds,
        }),
      );

      if (!activeProjectId) {
        const signature = `${panelOpen}|${pins
          .map((pin) => `${pin.id}:${pin.center[0]},${pin.center[1]}`)
          .join("|")}`;

        if (signature !== fittedPinsRef.current) {
          fittedPinsRef.current = signature;
          if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
          fitTimerRef.current = setTimeout(() => {
            fitTimerRef.current = null;
            const liveMap = mapRef.current;
            if (liveMap) fitBounds(liveMap, pinsBounds, 50, 13.2, panelOpen);
          }, 120);
        }
      }

      if (pins.length > 0) {
        onMapLoaded?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    mapReady,
    pins,
    pinsBounds,
    panelOpen,
    activeProjectId,
    compareSelectingMode,
    compareSelectedIds,
    emiSelectingProperty,
    selectedFeatureKeys,
    featureMatchedPropertyIds,
    onMapLoaded,
  ]);

  // A property with no plot geometry still gets the camera, just without a layout.
  useEffect(() => {
    const map = mapRef.current;
    const focusId = focusRequest?.id ?? null;
    if (!map || !mapReady || !focusId || activeProjectId) return;

    const project = projects.find((p) => p.id === focusId);
    const item = propertyList.find((p) => p.id === focusId);
    const anchor = (item ? propertyAnchor(item) : null) ?? propertyAnchors[focusId];
    const center =
      project?.center ??
      (anchor ? ([anchor.longitude, anchor.latitude] as [number, number]) : null);
    if (!center) return;

    map.easeTo({ center, zoom: Math.max(map.getZoom(), 15.5), duration: 900 });
  }, [
    activeProjectId,
    focusRequest,
    mapReady,
    pins,
    projects,
    propertyAnchors,
    propertyList,
  ]);

  // Load active project layout into shared sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("estate-plots-fill")) return;

    setLayoutData(map, activeProject);

    for (const layerId of LAYOUT_LAYER_IDS) {
      if (map.getLayer(layerId)) {
        // Do not display yellow dotted site boundary on the layout
        const isVisible =
          layerId !== "estate-site-pad-edge" &&
          Boolean(activeProject && SHOW_ESTATE_GEOJSON);
        map.setLayoutProperty(
          layerId,
          "visibility",
          isVisible ? "visible" : "none",
        );
      }
    }

    syncLayoutRaster(map, activeProject?.layoutRaster, Boolean(activeProject));
    setLayoutSvgOverlayContent(
      layoutSvgBoxRef.current,
      activeProject ? activeProject.layoutRaster : undefined,
    );
    syncLayoutSvgOverlayPosition(
      map,
      layoutSvgBoxRef.current,
      activeProject ? activeProject.layoutRaster : undefined,
    );

    if (activeProject) {
      // Zoom to the estate the units API just returned. Estate plots span a
      // couple of hundred metres, so this always lands on a close read of the
      // layout rather than the wider portfolio view.
      fitBounds(map, activeProject.bounds, 60, LAYOUT_MAX_ZOOM, panelOpen);
    }
  }, [activeProject, mapReady, panelOpen]);

  /**
   * Keep the HTML SVG layout locked to property_layout_cords while the map
   * pans/zooms. pointer-events: none lets GeoJSON plot hits reach the canvas.
   */
  useEffect(() => {
    const map = mapRef.current;
    const box = layoutSvgBoxRef.current;
    if (!map || !mapReady || !box) return;

    const raster = activeProject?.layoutRaster;
    const sync = () => syncLayoutSvgOverlayPosition(map, box, raster);

    sync();
    map.on("move", sync);
    map.on("zoom", sync);
    map.on("resize", sync);
    return () => {
      map.off("move", sync);
      map.off("zoom", sync);
      map.off("resize", sync);
    };
  }, [activeProject?.layoutRaster, activeProject?.id, mapReady]);

  /**
   * Switches to satellite imagery if either the user explicitly toggled
   * "satellite" mode, or while an active estate master plan layout is open.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(SATELLITE_LAYER_ID)) return;

    const showSatellite = userMapViewMode === "satellite" || layoutOpen;

    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      showSatellite ? "visible" : "none",
    );
  }, [layoutOpen, mapReady, userMapViewMode]);

  // Highlight selected plot + status hierarchy (available strongest)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen || !map.getLayer("estate-plots-fill")) {
      return;
    }

    const active = selectedId || "";
    const scale = activeProject?.layoutRaster ? 0.5 : 1;

    // Selected plot:
    // - If available: translucent emerald green fill (#10B981 at 0.55) with green outline (#047857)
    // - If booked/sold/blocked: dark shade fill (#1f1f1f at 0.65) with dark outline (#111111)
    // Unselected plots:
    // - Available: solid green (#10B981 at 1.0)
    // - Booked/sold/blocked: 0 fill (transparent, no dark shade obscuring layout)
    map.setPaintProperty("estate-plots-fill", "fill-color", [
      "case",
      ["==", ["get", "id"], active],
      [
        "match",
        ["get", "statusNorm"],
        "available",
        "#10B981",
        "#1f1f1f", // dark shade when booked/sold/blocked plot is clicked
      ],
      PLOT_STATUS_FILL_COLOR,
    ]);
    map.setPaintProperty("estate-plots-fill", "fill-opacity", [
      "case",
      ["==", ["get", "id"], active],
      [
        "match",
        ["get", "statusNorm"],
        "available",
        0.55,
        0.65, // noticeable dark fill on the clicked booked/sold plot
      ],
      [
        "match",
        ["get", "statusNorm"],
        "available",
        1.0,
        0, // transparent when unclicked
      ],
    ]);
    map.setPaintProperty("estate-plots-outline", "line-color", "transparent");
    map.setPaintProperty("estate-plots-outline", "line-width", 0);
    map.setPaintProperty("estate-plots-outline", "line-opacity", 0);

    // Hide labels inside plots — info is displayed in the floating tag instead
    if (map.getLayer("estate-plots-label")) {
      map.setLayoutProperty("estate-plots-label", "visibility", "none");
    }

    if (map.getLayer("estate-plots-dimensions")) {
      map.setLayoutProperty("estate-plots-dimensions", "visibility", "none");
    }
  }, [
    selectedId,
    layoutOpen,
    mapReady,
    activeProject?.id,
    activeProject?.plots.length,
    activeProject?.layoutRaster,
  ]);

  /** Soft breathing glow on available plot edges while a layout is open. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen || !map.getLayer("estate-plots-pulse")) {
      return;
    }

    let frame = 0;
    let raf = 0;
    const tick = (now: number) => {
      if (!map.getLayer("estate-plots-pulse")) return;
      const t = (now % 2200) / 2200;
      const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
      map.setPaintProperty(
        "estate-plots-pulse",
        "line-opacity",
        0.28 + wave * 0.5,
      );
      map.setPaintProperty(
        "estate-plots-pulse",
        "line-width",
        2.4 + wave * 2.2,
      );
      frame = raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf || frame);
      if (map.getLayer("estate-plots-pulse")) {
        map.setPaintProperty("estate-plots-pulse", "line-opacity", 0.45);
        map.setPaintProperty("estate-plots-pulse", "line-width", 3.2);
      }
    };
  }, [layoutOpen, mapReady, activeProject?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen || !selectedPlot) return;
    if (
      !Number.isFinite(selectedPlot.lng) ||
      !Number.isFinite(selectedPlot.lat)
    ) {
      return;
    }

    map.easeTo({
      center: [selectedPlot.lng, selectedPlot.lat],
      zoom: Math.max(map.getZoom(), 16.8),
      duration: 800,
    });
  }, [selectedPlot, layoutOpen, mapReady]);

  /**
   * Narrows the plotted polygons by plot status and by the search box.
   *
   * Both predicates must reach all three plot layers, not just the fill:
   * filtering the fill alone would leave outlines and plot numbers floating
   * over nothing. They are combined into a single `all` rather than applied in
   * turn, because a second `setFilter` would overwrite the first instead of
   * narrowing it, and an inactive predicate is left out entirely rather than
   * filtered to everything.
   *
   * The search predicate tests membership of the resolved plot numbers rather
   * than doing its own substring test: MapLibre filter expressions have no
   * case-insensitive matching, so the query is resolved in React where the same
   * trim/lowercase rule as the property matcher applies.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("estate-plots-fill")) return;

    const predicates: FilterSpecification[] = [];

    if (filter !== "all") {
      predicates.push(["==", ["get", "statusNorm"], filter]);
    }

    if (matchedPlotNumbers) {
      predicates.push([
        "in",
        // `plotNo` is a zero padded string, but the expression is guarded so a
        // numeric value from an older payload still compares correctly.
        ["to-string", ["get", "plotNo"]],
        ["literal", Array.from(matchedPlotNumbers)],
      ]);
    }

    const plotLayers = [
      "estate-plots-fill",
      "estate-plots-outline",
      "estate-plots-label",
      "estate-plots-pulse",
    ] as const;

    if (predicates.length === 0) {
      for (const layerId of plotLayers) {
        if (!map.getLayer(layerId)) continue;
        // Pulse stays available-only even when status/search filters are clear.
        map.setFilter(
          layerId,
          layerId === "estate-plots-pulse"
            ? (["==", ["get", "statusNorm"], "available"] as FilterSpecification)
            : null,
        );
      }
      return;
    }

    const expression = (
      predicates.length === 1 ? predicates[0] : ["all", ...predicates]
    ) as FilterSpecification;

    for (const layerId of plotLayers) {
      if (!map.getLayer(layerId)) continue;
      map.setFilter(
        layerId,
        layerId === "estate-plots-pulse"
          ? (["all", ["==", ["get", "statusNorm"], "available"], expression] as FilterSpecification)
          : expression,
      );
    }
  }, [filter, matchedPlotNumbers, mapReady]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
  };

  const resetView = () => {
    if (singlePropertyId && activeProject) {
      const map = mapRef.current;
      if (map) {
        fitBounds(map, activeProject.bounds, 60, LAYOUT_MAX_ZOOM, panelOpen);
        setSelectedId(null);
        return;
      }
    }
    closeLayout();
  };



  const loading = remoteStatus === "loading";

  /** Names what the map is waiting for, so the spinner is never anonymous. */
  const loadingLabel = useMemo(() => {
    const name = activePropertyId
      ? (propertyList.find((item) => item.id === activePropertyId)?.name ??
        activePropertyDetail?.name)
      : null;
    return name
      ? { title: "Loading layout", detail: name }
      : { title: "Loading developments", detail: "" };
  }, [activePropertyDetail?.name, activePropertyId, propertyList]);

  return (
    <section data-section="hero_map"
      ref={sectionRef}
      id="projects"
      className={
        mapFullscreen
          ? "fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-neutral-200"
          : className
            ? `relative flex w-full flex-col overflow-hidden bg-neutral-200 ${className}`
            : "relative flex h-[calc(100vh-var(--nav-h))] min-h-[calc(100vh-var(--nav-h))] w-full flex-col overflow-hidden bg-neutral-200"
      }
      aria-label="ILA Homes developments map"
      aria-busy={remoteStatus === "loading"}
    >
      {/* Mobile heading. Suppressed when hideDetails is true or fullscreen. */}
      {!hideDetails && !mapFullscreen ? (
        <header className="shrink-0 px-3 pt-3 pb-2 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold tracking-[0.22em] text-[#7a5c28] uppercase">
                {singlePropertyId ? "Master Plan & Layout" : "Our Developments"}
              </p>
              <h2 className="mt-1 text-lg leading-tight font-semibold tracking-tight text-[#171717]">
                {singlePropertyId
                  ? (activeProject?.name ?? "Plot Layout")
                  : "Find Your Place in Hyderabad."}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#3f3a34]">
                {singlePropertyId
                  ? "Tap any plot to view dimensions, facing and availability."
                  : "Tap a project pin to open its estate layout on the map."}
              </p>
            </div>
          </div>
        </header>
      ) : null}

      <div
        ref={mapFrameRef}
        className={
          mapFullscreen
            ? "ila-map-frame ila-map-frame--fullscreen relative min-h-0 flex-1 overflow-hidden bg-neutral-200"
            : singlePropertyId
              ? "ila-map-frame relative mx-2 mb-2 min-h-72 flex-1 overflow-hidden rounded-xl border border-black/10 bg-neutral-200 shadow-[0_12px_36px_rgba(15,23,42,0.14)] md:absolute md:inset-3 md:m-0 md:min-h-0 md:rounded-xl"
              : "ila-map-frame relative h-full min-h-100 flex-1 overflow-hidden bg-neutral-200 md:absolute md:inset-0 md:m-0"
        }
      >
        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full min-h-full" />

        {/* Native SVG master plan — georeferenced HTML overlay under UI chrome.
            pointer-events: none so plot GeoJSON stays clickable on the canvas. */}
        <div className="ila-layout-html-root pointer-events-none absolute inset-0" aria-hidden>
          <div ref={layoutSvgBoxRef} className="ila-layout-svg-box" hidden />
        </div>

        {mapError ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#ebe6de]/95 px-6 text-center">
            <p className="max-w-sm text-sm font-medium leading-relaxed text-[#3f3a34]">
              The map could not load on this device. Check that the phone is on
              the same network as this site and reload the page.
            </p>
          </div>
        ) : null}

        {/* Loading the property detail + /units layout. Kept non-blocking so
            the map stays pannable and another pin can be tapped to supersede
            this request. */}
        {loading ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-black/8"
              aria-hidden
            >
              <span className="ila-map-progress" />
            </div>
            <div
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#ebe6de]/45 backdrop-blur-[1.5px]"
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/12 bg-[#f7f5f1]/95 px-6 py-5 shadow-[0_12px_36px_rgba(15,23,42,0.18)]">
                <span
                  className="ila-loader ila-loader--sm"
                  aria-hidden
                />
                <p className="text-xs font-semibold tracking-[0.14em] text-[#171717] uppercase">
                  {loadingLabel.title}
                </p>
                {loadingLabel.detail ? (
                  <p className="max-w-60 truncate text-[11px] font-medium text-[#5c5348]">
                    {loadingLabel.detail}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {mapFullscreen ? (
          <button
            type="button"
            aria-label="Exit fullscreen map"
            onClick={toggleNativeFullscreen}
            className="pointer-events-auto absolute top-3 left-3 z-30 flex items-center gap-2 rounded-lg bg-[#171717] px-3 py-2.5 text-xs font-semibold tracking-[0.12em] text-white uppercase shadow-[0_8px_24px_rgba(15,23,42,0.28)] transition hover:bg-[#333333]"
          >
            ← Back
          </button>
        ) : null}

        {/* Floating Tags for All Available Plots & Active Plot (Short & Neat) */}
        {layoutOpen &&
          displayPlotsForTags.map((plot) => {
            const pos = plotTagPositions[plot.id];
            if (!pos) return null;
            const isSelected = selectedId === plot.id;
            const isHovered = hoveredPlotId === plot.id;

            return (
              <div
                key={plot.id}
                className={`pointer-events-none absolute transition-transform duration-75 ease-out select-none ${
                  isSelected || isHovered ? "z-30" : "z-25"
                }`}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: "translate(-50%, -100%) translateY(-8px)",
                }}
              >
                {plot.status === "available" ? (
                  /* Original tag design for Available plots: Plot No · Size */
                  <div
                    className={`relative flex items-center gap-1.5 rounded-md border px-2 py-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
                      isSelected
                        ? "border-[#047857] bg-white ring-2 ring-[#10B981]/50"
                        : "border-black/10 bg-white/98"
                    }`}
                  >
                    <span className="text-[10px] font-bold text-neutral-900 tracking-tight whitespace-nowrap">
                      Plot {plot.title.replace(/^Plot\s*/i, "")}
                    </span>

                    {plot.area && plot.area !== "Area TBA" ? (
                      <>
                        <span className="text-neutral-300 text-[9px] leading-none">·</span>
                        <span className="text-[9.5px] font-semibold text-neutral-600 whitespace-nowrap">
                          {plot.area.replace(/\s*sq\.?yd/i, " sq yd")}
                        </span>
                      </>
                    ) : null}

                    {/* Minimal bottom pointer stem */}
                    <div
                      className="absolute left-1/2 top-full -translate-x-1/2 -mt-px h-0 w-0 border-x-[3.5px] border-x-transparent border-t-[4px] border-t-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]"
                      aria-hidden
                    />
                  </div>
                ) : (
                  /* Booked / Sold / Blocked: Status indication only */
                  <div className="relative flex items-center rounded-full bg-[#171717] text-white border border-black/30 px-2 py-0.5 shadow-[0_4px_12px_rgba(0,0,0,0.25)] ring-1 ring-black/40">
                    <span className="text-[9px] font-bold tracking-wider uppercase whitespace-nowrap px-0.5">
                      {plotStatusDisplayLabel(plot.status)}
                    </span>
                    <div
                      className="absolute left-1/2 top-full -translate-x-1/2 -mt-px h-0 w-0 border-x-[3.5px] border-x-transparent border-t-[4px] border-t-[#171717] drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]"
                      aria-hidden
                    />
                  </div>
                )}
              </div>
            );
          })}




        {/* Top Left: Map Version Switcher (Default View / Satellite Version) */}
        {/* Hidden when a property is clicked/open */}
        {!compareSelectingMode && !activeProjectId && !selectedProjectId && !desktopPropertyCardOpen ? (
          <div className={`absolute z-30 transition-all ${
            mapFullscreen
              ? "top-3 left-28 sm:left-32"
              : !hideDetails && panelOpen
                ? "top-3 left-3 sm:top-4 md:left-94"
                : !hideDetails
                  ? "top-3 left-3 sm:top-4 md:left-40"
                  : hideDetails && (activeProject?.name || activeProperty?.name)
                    ? "top-3 left-3 sm:top-4 md:left-56"
                    : "top-3 left-3 sm:top-4 sm:left-4"
          }`}>
            <MapVersion
              currentMode={userMapViewMode}
              onModeChange={(mode) => setUserMapViewMode(mode)}
            />
          </div>
        ) : null}



        {!hideDetails && panelOpen && !compareSelectingMode && !activeProject ? (
          <aside className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-88 flex-col py-3 pl-3 md:flex sm:py-4">
            <div className="pointer-events-auto relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/15 bg-[#d9d2c7] shadow-[8px_0_28px_rgba(15,23,42,0.14)]">
              <div className="shrink-0 border-b border-black/10 px-3 pt-4 pr-11 pb-3 sm:px-4 sm:pt-5 sm:pr-12">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#7a5c28] uppercase">
                  Our Developments
                </p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-[#171717] sm:text-2xl">
                  Find Your Place in Hyderabad.
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#3f3a34] sm:text-sm">
                  Tap a project pin to open its estate layout on the map.
                </p>
              </div>

              <div className="ila-scroll min-h-0 flex-1 space-y-0 overflow-y-auto">
                {filteredProperties.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm font-medium text-[#3f3a34]">
                    {remoteStatus === "loading" ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="ila-loader ila-loader--sm" aria-hidden />
                        Loading developments…
                      </span>
                    ) : remoteStatus === "error" ? (
                      <div className="flex flex-col items-center gap-3">
                        <p>Developments could not be loaded. Try again shortly.</p>
                        <button
                          type="button"
                          onClick={() => setPropertiesRetryCount((c) => c + 1)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#333333] active:scale-95"
                        >
                          Retry
                        </button>
                      </div>
                    ) : query.trim() ? (
                      <p>No developments match your search.</p>
                    ) : (
                      <p>No developments published yet.</p>
                    )}
                  </div>
                ) : (
                  filteredProperties.map((item) => (
                    <PropertyCard
                      key={item.id}
                      item={item}
                      detail={
                        item.id === activePropertyId ? activePropertyDetail : null
                      }
                      plotCount={item.id === activePropertyId ? unitsCount : 0}
                      active={item.id === activePropertyId}
                      onPrefetch={() => {
                        // Warm estates outside the top-4 idle pre-warm as soon
                        // as the visitor hovers a list row.
                        void prefetchEstate(item.id).catch(() => {
                          // Hover prefetch is best-effort.
                        });
                      }}
                      onSelect={() => {
                        void selectProperty(item.id, { openLayout: true, openDesktopCard: true });
                        trackEvent({
                          event_type: "PROPERTY_VIEW",
                          property_id: item.id,
                          metadata: { source: "homepage_developments_list" },
                        });
                      }}
                    />
                  ))
                )}
              </div>

              <div className="shrink-0 border-t border-black/10 p-3 sm:p-4">
                <Link
                  href={
                    singlePropertyId
                      ? "#next-step"
                      : layoutOpen && activePropertyHref
                        ? activePropertyHref
                        : "#contact"
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
                >
                  {singlePropertyId
                    ? "Book Site Visit"
                    : layoutOpen && activePropertyHref
                      ? "Visit Property"
                      : "View All Properties"}
                  <ArrowIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </aside>
        ) : !hideDetails && !compareSelectingMode && !activeProject ? (
          <button
            type="button"
            aria-label="Open developments panel"
            onClick={openPanel}
            className="pointer-events-auto absolute top-3 left-3 z-20 hidden h-10 items-center gap-2 rounded-lg bg-[#d9d2c7] px-3 text-xs font-semibold tracking-wide text-[#171717] uppercase shadow-[4px_0_16px_rgba(15,23,42,0.14)] transition hover:bg-[#cfc3a8] md:flex sm:top-4"
          >
            Developments
            <ArrowIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}



        {/* Integrated Desktop & Mobile Property Block */}
        <PropertyBlock
          desktopOpen={desktopPropertyCardOpen}
          onCloseDesktop={closeLayout}
          portalReady={portalReady}
          selectedPlot={selectedPlot}
          mapFullscreen={mapFullscreen}
          mobileExpanded={propertySheetExpanded}
          onToggleMobileExpand={() => setPropertySheetExpanded((open) => !open)}
          onCloseMobile={() => {
            closeLayout();
            setPropertySheetExpanded(false);
          }}
          project={activeProject ?? selectedProject}
          property={activeProperty ?? selectedProperty}
          apiProperty={activePopupApiProperty}
          tab={propertySheetTab}
          onTabChange={setPropertySheetTab}
          onOpenCompare={(propId) => {
            const idToCompare = propId || activePropertyId || selectedProject?.id || selectedProperty?.id;
            startCompareMode(idToCompare);
          }}
          onOpenEmi={(propertyInfo) => {
            setEmiSelectedProperty(propertyInfo);
            setEmiOpen(true);
            setEmiSelectingProperty(false);
          }}
          hideMobile={Boolean(singlePropertyId)}
        />
        {/* Plot Details Popup (Styled exactly like property-block when minimized) */}
        {selectedPlot ? (
          <>
            {/* Mobile Bottom Popup */}
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center justify-end md:hidden">
              <div className="pointer-events-auto flex w-full max-h-[85vh] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-x border-t border-[#ded9cf] bg-[#f9f7f2] px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_36px_rgba(36,35,31,0.22)] animate-in fade-in slide-in-from-bottom-6 duration-200">
                {/* Top Controls Row */}
                <div className="flex shrink-0 items-center justify-between gap-2 pb-1">
                  <button
                    type="button"
                    aria-label="Close plot details"
                    onClick={() => {
                      setSelectedId(null);
                      setMobilePlotExpanded(false);
                      if (activeProjectId) {
                        setSelectedProjectId(activeProjectId);
                        setDesktopPropertyCardOpen(true);
                        setPropertySheetExpanded(false);
                      }
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#24231f] border border-[#ded9cf] shadow-xs transition active:scale-95"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>

                  {/* Handle Bar */}
                  <div className="flex h-6 w-24 items-center justify-center">
                    <span className="h-1 w-10 rounded-full bg-[#c9c3b6]" />
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                      selectedPlot.status === "available"
                        ? "bg-[#10B981] text-white"
                        : "bg-[#111111] text-white"
                    }`}
                  >
                    {plotStatusDisplayLabel(selectedPlot.status)}
                  </span>
                </div>

                {/* Minimized Content Body */}
                <div className="flex w-full flex-col justify-center select-none py-1">
                  <h3 className="truncate text-base font-extrabold tracking-tight text-[#141414]">
                    {selectedPlot.title}
                  </h3>

                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#5c5549]">
                    <svg className="h-3.5 w-3.5 shrink-0 text-[#c6a46c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="truncate">{selectedPlot.location}</span>
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-lg bg-[#c6a46c]/15 px-2.5 py-1 text-xs font-black text-[#876527]">
                      {selectedPlot.price}
                    </span>
                    <span className="rounded-lg bg-black/[0.05] border border-black/10 px-2.5 py-1 text-xs font-bold text-[#2a2824]">
                      {selectedPlot.area}
                    </span>
                    {selectedPlot.facing ? (
                      <span className="rounded-lg bg-black/[0.05] border border-black/10 px-2.5 py-1 text-xs font-bold text-[#2a2824]">
                        {selectedPlot.facing}
                      </span>
                    ) : null}
                  </div>

                  {/* Actions: Enquiry & View Property */}
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#ded9cf]/70">
                    <button
                      type="button"
                      onClick={() => setPlotEnquiryModalOpen(true)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d4b57e] via-[#c6a46c] to-[#b38e52] py-2.5 text-xs font-black tracking-wider uppercase text-[#141414] shadow-xs transition hover:brightness-105 active:scale-[0.98] cursor-pointer"
                    >
                      Enquiry
                    </button>
                    {activePropertyHref ? (
                      <Link
                        href={activePropertyHref}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white py-2.5 text-xs font-black text-[#141414] shadow-xs transition hover:bg-[#faf7f0] active:scale-[0.98] whitespace-nowrap"
                      >
                        View Property
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Bottom-Left Popup Card */}
            <div
              className="pointer-events-auto absolute bottom-4 z-30 hidden w-[340px] max-w-[calc(100%-2rem)] max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-[#ded9cf] bg-[#f9f7f2] p-4 shadow-[0_16px_40px_rgba(36,35,31,0.18)] animate-in fade-in zoom-in-95 md:block"
              style={{
                left: panelOpen ? `min(calc(100% - 356px), ${DESKTOP_PANEL_RESERVED + 12}px)` : 16,
                maxHeight: "calc(100% - 2rem)",
              }}
            >
              {/* Header / Top Controls */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#ded9cf]">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                    selectedPlot.status === "available"
                      ? "bg-[#10B981] text-white"
                      : "bg-[#111111] text-white"
                  }`}
                >
                  {plotStatusDisplayLabel(selectedPlot.status)}
                </span>
                <button
                  type="button"
                  aria-label="Close plot details"
                  onClick={() => {
                    setSelectedId(null);
                    if (activeProjectId) {
                      setSelectedProjectId(activeProjectId);
                      setDesktopPropertyCardOpen(true);
                    }
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#5c5348] border border-[#ded9cf] shadow-xs transition hover:bg-[#eae5db] active:scale-95"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Minimized Content Body */}
              <div className="flex w-full flex-col justify-center select-none pt-2.5">
                <h3 className="truncate text-base font-extrabold tracking-tight text-[#141414]">
                  {selectedPlot.title}
                </h3>

                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#5c5549]">
                  <svg className="h-3.5 w-3.5 shrink-0 text-[#c6a46c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="truncate">{selectedPlot.location}</span>
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <span className="rounded-lg bg-[#c6a46c]/15 px-2.5 py-1 text-xs font-black text-[#876527]">
                    {selectedPlot.price}
                  </span>
                  <span className="rounded-lg bg-black/[0.05] border border-black/10 px-2.5 py-1 text-xs font-bold text-[#2a2824]">
                    {selectedPlot.area}
                  </span>
                  {selectedPlot.facing ? (
                    <span className="rounded-lg bg-black/[0.05] border border-black/10 px-2.5 py-1 text-xs font-bold text-[#2a2824]">
                      {selectedPlot.facing}
                    </span>
                  ) : null}
                </div>

                {/* Actions: Enquiry & View Property */}
                <div className="mt-3.5 flex items-center gap-2 pt-2.5 border-t border-[#ded9cf]">
                  <button
                    type="button"
                    onClick={() => setPlotEnquiryModalOpen(true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#d4b57e] via-[#c6a46c] to-[#b38e52] py-2.5 text-xs font-black tracking-wider uppercase text-[#141414] shadow-xs transition hover:brightness-105 active:scale-[0.98] cursor-pointer"
                  >
                    Enquiry
                  </button>
                  {activePropertyHref ? (
                    <Link
                      href={activePropertyHref}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-black/15 bg-white py-2.5 text-xs font-black text-[#141414] shadow-xs transition hover:bg-[#faf7f0] active:scale-[0.98] whitespace-nowrap"
                    >
                      View Property
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* FindYourPlot feature cards side-by-side at the bottom of the map */}
        {features.length > 0 && !selectedPlot && !compareSelectingMode && !emiSelectingProperty && !singlePropertyId ? (
          <div
            id="tutorial-target-find-your-plot"
            className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex items-center gap-1.5 sm:left-4 sm:right-4 md:right-24"
          >
            {/* Left arrow (mobile/touch only) */}
            <button
              type="button"
              aria-label="Scroll tags left"
              disabled={!canScrollLeft}
              onClick={() => scrollTags("left")}
              className={`pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#171717]/90 text-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md transition md:hidden ${
                canScrollLeft
                  ? "hover:border-[#c6a46c]/50 hover:bg-[#202020] active:scale-95"
                  : "cursor-not-allowed opacity-30"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Scrollable cards strip */}
            <div
              ref={tagsScrollRef}
              className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scroll-smooth scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {features.map((feature) => {
                const isOn = selectedFeatureKeys.includes(feature.key);
                return (
                  <button
                    key={feature.key}
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggleFeatureKey(feature.key)}
                    className={`group relative flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 text-left backdrop-blur-md transition-all duration-200 select-none active:scale-[0.98] ${
                      isOn
                        ? "border-[#c6a46c] bg-[#1a1814]/95 text-white ring-1 ring-[#c6a46c]/40 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                        : "border-white/10 bg-[#171717]/90 text-[#d9d5cd] hover:border-white/25 hover:bg-[#202020] hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isOn
                          ? "bg-[#c6a46c] text-[#141519] shadow-xs"
                          : "bg-white/5 text-[#c6a46c] ring-1 ring-white/10 group-hover:bg-[#c6a46c]/20"
                      }`}
                    >
                      {featureIcon(feature.key, "h-3.5 w-3.5") ?? (
                        <CheckIcon className="h-2.5 w-2.5" />
                      )}
                    </span>
                    <span className={`whitespace-nowrap text-[12px] tracking-tight ${
                      isOn ? "font-bold text-white" : "font-medium"
                    }`}>
                      {feature.name}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all ${
                        isOn
                          ? "bg-[#c6a46c] text-[#141519] scale-105 shadow-xs"
                          : "border border-white/20 text-transparent group-hover:border-white/40"
                      }`}
                    >
                      {isOn ? (
                        <CheckIcon className="h-2.5 w-2.5 stroke-3" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Clear filter button when any tags are active */}
            {selectedFeatureKeys.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFeatureKeys([])}
                aria-label="Clear selected filters"
                title={`Clear filters (${selectedFeatureKeys.length})`}
                className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/50 bg-[#3a1518] text-red-400 shadow-[0_4px_16px_rgba(239,68,68,0.2)] backdrop-blur-md transition hover:border-red-400 hover:bg-red-900/80 hover:text-red-200 active:scale-95"
              >
                <CloseIcon className="h-4 w-4 stroke-[2.5]" />
              </button>
            )}


            {/* Right arrow (mobile/touch only) - exactly in original position */}
            <button
              type="button"
              aria-label="Scroll tags right"
              disabled={!canScrollRight}
              onClick={() => scrollTags("right")}
              className={`pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#171717]/90 text-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md transition md:hidden ${
                canScrollRight
                  ? "hover:border-[#c6a46c]/50 hover:bg-[#202020] active:scale-95"
                  : "cursor-not-allowed opacity-30"
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}

        {/* Maximize map button when singlePropertyId is active (since bottom feature bar is hidden) */}
        {singlePropertyId && !mapFullscreen ? (
          <button
            type="button"
            aria-label="Maximize map to full screen"
            title="Maximize map"
            onClick={toggleNativeFullscreen}
            className="pointer-events-auto absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#171717]/90 text-white/90 shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:border-[#c6a46c]/60 hover:bg-[#202020] hover:text-[#c6a46c] active:scale-95 sm:bottom-4 sm:right-4"
          >
            <ExpandIcon className="h-4 w-4" />
          </button>
        ) : null}

        {/* Right center quick actions: Wishlist, EMI Calculator & Compare (hidden when maximized, in compare mode, or on single property page) */}
        {!compareSelectingMode && !mapFullscreen && !singlePropertyId ? (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2.5 sm:right-4">
            {/* Wishlist Component - hidden when selecting property for EMI */}
            {!emiSelectingProperty ? (
              <Wishlist
                isOpen={wishlistOpen}
                onOpen={() => setWishlistOpen(true)}
                onClose={() => setWishlistOpen(false)}
                properties={propertyList}
              />
            ) : null}

            {/* EMI Calculator Button */}
            <button
              id="tutorial-target-emi"
              type="button"
              aria-label="Open EMI loan calculator"
              onClick={() => {
                setEmiOpen(false);
                setEmiSelectingProperty((prev) => !prev);
              }}
              className={`pointer-events-auto group relative flex items-center justify-start gap-2 rounded-full border p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all active:scale-95 sm:h-10 sm:w-36 sm:px-3 sm:py-2 ${
                emiSelectingProperty
                  ? "border-[#c6a46c] bg-[#c6a46c] text-[#171717] ring-4 ring-[#c6a46c]/30"
                  : "border-white/15 bg-[#171717]/90 text-[#f2f0ea] hover:border-[#c6a46c] hover:bg-[#222222]"
              }`}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <svg
                  className={`h-5.5 w-5.5 transition-transform group-hover:scale-110 ${
                    emiSelectingProperty ? "text-[#171717]" : "text-[#c6a46c]"
                  }`}
                  viewBox="0 0 100 120"
                  aria-hidden="true"
                >
                  <defs>
                    <mask id="map-calc-cutout">
                      <rect x="0" y="0" width="100" height="120" fill="#ffffff" />
                      <g fill="#000000">
                        <rect x="27.5" y="29" width="45" height="13.5" rx="3" />
                        <rect x="27" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="63.2" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="27" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="63.2" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="27" y="89.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="89.5" width="27.9" height="9.5" rx="2.8" />
                      </g>
                    </mask>
                  </defs>
                  <rect
                    x="17.5"
                    y="14"
                    width="65"
                    height="92"
                    rx="8.5"
                    fill="currentColor"
                    mask="url(#map-calc-cutout)"
                  />
                </svg>
              </div>
              <span className="hidden text-xs font-semibold tracking-wide sm:inline">
                {emiSelectingProperty ? "Select on map" : "EMI Calculator"}
              </span>
            </button>

            {/* Compare Properties Button - hidden when selecting property for EMI */}
            {!emiSelectingProperty ? (
              <button
                id="tutorial-target-compare"
                type="button"
                aria-label="Compare properties on map"
                onClick={() => {
                  if (compareSelectingMode) {
                    setCompareSelectingMode(false);
                  } else {
                    setEmiSelectingProperty(false);
                    setCompareSelectingMode(true);
                    setDesktopPropertyCardOpen(false);
                    setPropertySheetExpanded(false);
                  }
                }}
                className="pointer-events-auto group relative flex items-center justify-start gap-2 rounded-full border border-white/15 bg-[#171717]/90 p-2.5 text-[#f2f0ea] shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all hover:border-[#c6a46c] hover:bg-[#222222] active:scale-95 sm:h-10 sm:w-36 sm:px-3 sm:py-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <svg
                    className="h-5.5 w-5.5 text-[#c6a46c] transition-transform group-hover:scale-110"
                    viewBox="0 0 100 100"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="18" y="22" width="26" height="26" rx="5.5" />
                    <rect x="64" y="22" width="26" height="26" rx="5.5" />
                    <rect x="18" y="53" width="72" height="5.5" rx="2.75" />
                    <path d="M 48 56 H 60 L 70.5 76.5 A 5.5 5.5 0 0 1 65.6 84.5 H 42.4 A 5.5 5.5 0 0 1 37.5 76.5 Z" />
                  </svg>
                </div>
                <span className="hidden text-xs font-semibold tracking-wide sm:inline">
                  Compare
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Maximum zoom reached notification popup note */}
        {maxZoomNotice ? (
          <div className="pointer-events-none absolute top-4 inset-x-0 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-500/50 bg-[#141519]/95 px-4 py-2.5 text-xs text-[#f2f0ea] shadow-[0_12px_36px_rgba(0,0,0,0.65)] backdrop-blur-md ila-banner-animate">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">Maximum Zoom Reached</span>
                <span className="font-medium text-white/90">Higher satellite resolution is not available for this area</span>
              </div>
              <button
                type="button"
                onClick={() => setMaxZoomNotice(false)}
                className="ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                aria-label="Dismiss notice"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}

        {/* Floating guidance popup note centered at top middle when EMI Calculator is awaiting property selection */}
        {emiSelectingProperty ? (
          <div className="pointer-events-none absolute top-4 inset-x-0 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#c6a46c]/60 bg-[#141519]/95 px-4 py-3 text-xs text-[#f2f0ea] shadow-[0_12px_36px_rgba(0,0,0,0.65)] backdrop-blur-md ila-banner-animate">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c6a46c] text-[#141519] shadow-sm">
                <svg className="h-5 w-5" viewBox="0 0 100 120" aria-hidden="true">
                  <defs>
                    <mask id="map-banner-calc-cutout">
                      <rect x="0" y="0" width="100" height="120" fill="#ffffff" />
                      <g fill="#000000">
                        <rect x="27.5" y="29" width="45" height="13.5" rx="3" />
                        <rect x="27" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="63.2" y="53" width="9.8" height="9.5" rx="2.8" />
                        <rect x="27" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="63.2" y="71.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="27" y="89.5" width="9.8" height="9.5" rx="2.8" />
                        <rect x="45.1" y="89.5" width="27.9" height="9.5" rx="2.8" />
                      </g>
                    </mask>
                  </defs>
                  <rect
                    x="17.5"
                    y="14"
                    width="65"
                    height="92"
                    rx="8.5"
                    fill="currentColor"
                    mask="url(#map-banner-calc-cutout)"
                  />
                </svg>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold tracking-wider text-[#c6a46c] uppercase">EMI Calculate</span>
                <span className="font-semibold text-white">Select a property on the map to EMI calculate</span>
              </div>
              <button
                type="button"
                onClick={() => setEmiSelectingProperty(false)}
                className="ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                aria-label="Cancel property selection"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}



        {/* ======================================================== */}
        {/* COMPARE MODE: Top Guidance Notice (Gold/Yellow BG, Black text) */}
        {/* ======================================================== */}
        {compareSelectingMode ? (
          <div className="pointer-events-none absolute top-3 inset-x-0 z-40 flex justify-center px-3 sm:px-4">
            <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#b38e52] bg-linear-to-r from-[#c6a46c] to-[#b38e52] px-3.5 py-2 text-xs text-[#141519] shadow-[0_10px_28px_rgba(0,0,0,0.3)] backdrop-blur-md ila-banner-animate">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#141519] text-[#c6a46c] shadow-sm">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="18" y="22" width="26" height="26" rx="5.5" />
                  <rect x="64" y="22" width="26" height="26" rx="5.5" />
                  <rect x="18" y="53" width="72" height="5.5" rx="2.75" />
                  <path d="M 48 56 H 60 L 70.5 76.5 A 5.5 5.5 0 0 1 65.6 84.5 H 42.4 A 5.5 5.5 0 0 1 37.5 76.5 Z" />
                </svg>
              </span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-extrabold tracking-wider text-[#141519]/80 uppercase">Compare Properties</span>
                <span className="text-xs sm:text-[13px] font-extrabold tracking-tight text-[#141519]">Tap pins on the map to select up to 5 properties</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompareSelectingMode(false);
                  setCompareSelectedIds([]);
                }}
                className="ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/20 bg-[#141519] text-white shadow-sm transition hover:bg-black hover:scale-105 active:scale-95"
                aria-label="Cancel compare mode"
                title="Exit compare mode"
              >
                <CloseIcon className="h-3 w-3 stroke-[2.5]" />
              </button>
            </div>
          </div>
        ) : null}

        {/* ======================================================== */}
        {/* COMPARE MODE: Bottom Drawer Selection Strip (cards on top, actions below) */}
        {/* ======================================================== */}
        {compareSelectingMode ? (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 z-50 flex justify-center">
            <div className="pointer-events-auto flex w-full flex-col border-t border-black/15 bg-[#faf6ee]/95 px-3 pt-2.5 pb-3 sm:px-6 shadow-[0_-8px_32px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5">
                {/* Upper Row: Selected Property Cards & Empty Slots */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {/* Render selected property chips */}
                  {compareSelectedIds.map((id) => {
                    const propItem = propertyList.find((p) => p.id === id);
                    const propRec = getPropertyById(id === "sark-green" ? "sark-green-plains" : id);
                    const name = propItem?.name || propRec?.name || id;
                    const cover = propItem?.cover_url || propRec?.gallery?.[0]?.src || "/hero-image.png";

                    return (
                      <div
                        key={id}
                        className="group relative flex h-14 w-44 shrink-0 items-center gap-2 overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-xs transition hover:border-[#c6a46c]/60 hover:shadow-sm"
                      >
                        {/* Image Thumbnail */}
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-black/10">
                          <Image
                            src={cover}
                            alt={name}
                            fill
                            sizes="44px"
                            unoptimized
                            className="object-cover"
                          />
                        </div>

                        {/* Property name */}
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="truncate text-xs font-semibold text-[#171717]">
                            {name}
                          </p>
                          <p className="text-[10px] text-[#7a7469]">
                            Selected
                          </p>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => toggleCompareId(id)}
                          aria-label={`Remove ${name} from comparison`}
                          className="absolute top-1.5 right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/5 text-[#7a7469] transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                        >
                          <CloseIcon className="h-2.5 w-2.5 stroke-[2.5]" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Empty slot placeholders up to 5 */}
                  {Array.from({ length: Math.max(0, 5 - compareSelectedIds.length) }).map((_, idx) => (
                    <div
                      key={`empty-slot-${idx}`}
                      className="flex h-14 w-32 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-black/15 bg-black/2 px-2 text-[11px] text-[#8a8275]"
                    >
                      <svg className="h-3.5 w-3.5 text-[#c6a46c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      <span>Slot {compareSelectedIds.length + idx + 1}</span>
                    </div>
                  ))}
                </div>

                {/* Lower Row: Count, Compare Button & Close Button */}
                <div className="flex items-center justify-between gap-3 border-t border-black/10 pt-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#5c5348]">
                    <span className="flex h-2 w-2 rounded-full bg-[#c6a46c]" />
                    <strong className="text-[#171717]">{compareSelectedIds.length} of 5</strong>
                    <span>properties selected</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={compareSelectedIds.length < 2}
                      onClick={() => setCompareModalOpen(true)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold tracking-wider uppercase transition shadow-md whitespace-nowrap ${
                        compareSelectedIds.length >= 2
                          ? "bg-linear-to-r from-[#c6a46c] to-[#b38e52] text-[#171717] hover:brightness-105 active:scale-[0.99]"
                          : "cursor-not-allowed bg-black/10 text-black/40"
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Compare</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCompareSelectingMode(false);
                        setCompareSelectedIds([]);
                      }}
                      aria-label="Close compare mode"
                      title="Close compare mode"
                      className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 shadow-xs transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 active:scale-95"
                    >
                      <CloseIcon className="h-4 w-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* CompareProperties Modal Popup Table */}
        {compareModalOpen && (
          <CompareProperties
            initialSelectedIds={compareSelectedIds}
            isModalOpen={compareModalOpen}
            onCloseModal={() => {
              setCompareModalOpen(false);
              setCompareSelectingMode(false);
              setCompareSelectedIds([]);
            }}
            modalOnly
          />
        )}

        {/* EMI Calculator / EmiAppreciation Popup Modal Overlay */}
        {emiOpen ? (
          <div
            className="fixed inset-0 z-300 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm ila-modal-backdrop"
            onClick={() => setEmiOpen(false)}
          >
            <div
              className="relative flex w-full sm:max-w-4xl max-h-[92vh] flex-col rounded-t-3xl sm:rounded-2xl border-t border-x-0 sm:border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden ila-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#c6a46c]">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="4" y="2" width="16" height="20" rx="3" />
                      <line x1="8" y1="6" x2="16" y2="6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      EMI &amp; Appreciation: {emiSelectedProperty?.name || activeProject?.name || activePropertyDetail?.name || "Selected Property"}
                    </h3>
                    <p className="text-xs text-[#9a9388]">
                      {emiSelectedProperty?.location || activePropertyDetail?.locality || activePropertyDetail?.city || "Hyderabad"} · {formatPrice(emiSelectedProperty?.price || activePropertyDetail?.price || 5000000)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close EMI calculator"
                  onClick={() => setEmiOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <PriceEmiFuture
                  property={{
                    name: emiSelectedProperty?.name || activeProject?.name || activePropertyDetail?.name || "Selected Property",
                    price: emiSelectedProperty?.price || activePropertyDetail?.price || 5000000,
                  }}
                  showAmortizationSchedule={true}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* Plot Enquiry Form Modal Popup */}
        {plotEnquiryModalOpen && selectedPlot && (
          <div
            className="fixed inset-0 z-300 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm ila-modal-backdrop animate-in fade-in duration-200"
            onClick={() => setPlotEnquiryModalOpen(false)}
          >
            <div
              className="relative flex w-full sm:w-[96vw] max-w-6xl max-h-[92vh] my-auto flex-col rounded-t-3xl sm:rounded-2xl border-t border-x-0 sm:border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden ila-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 bg-[#1a1c21]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c6a46c]/20 text-[#c6a46c]">
                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      Enquire: {selectedPlot.title}
                    </h3>
                    <p className="text-xs text-[#9a9388]">
                      {activeProject?.name || activeProperty?.name || "ILA Homes"} &middot; {selectedPlot.area} &middot; {selectedPlot.price}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close enquiry form"
                  title="Close"
                  onClick={() => setPlotEnquiryModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c6a46c]/50 bg-[#c6a46c]/20 text-[#c6a46c] shadow-md transition hover:bg-[#c6a46c] hover:text-[#17191d] hover:border-[#c6a46c] active:scale-95"
                >
                  <CloseIcon className="h-4.5 w-4.5 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Body: HomeReadyToVisit Enquiry Form */}
              <div className="flex-1 overflow-y-auto">
                <HomeReadyToVisit
                  propertyName={`${activeProject?.name || activeProperty?.name || "Property"} - ${selectedPlot.title}`}
                  propertyId={activePropertyId || activeProject?.id || activeProperty?.id}
                  onSuccess={() => setPlotEnquiryModalOpen(false)}
                />
              </div>
            </div>
          </div>
        )}


        {/* map zoom + fullscreen controls - hidden during compare mode */}
        {!compareSelectingMode ? (
          <div
            className={`pointer-events-none absolute right-3 z-20 flex flex-col gap-1.5 sm:right-4 ${
              mapFullscreen
                ? "bottom-6"
                : activeProject
                  ? "bottom-14"
                  : "bottom-4"
            }`}
          >
          {!mapFullscreen ? (
            <button
              type="button"
              aria-label="Open map fullscreen"
              title="Maximize map to full screen"
              onClick={toggleNativeFullscreen}
              className="pointer-events-auto ila-fullscreen-hint hidden md:flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 bg-[#d9d2c7] text-[#171717] shadow-[0_8px_20px_rgba(15,23,42,0.14)] transition hover:bg-[#cfc3a8]"
            >
              <ExpandIcon className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Reset map view"
            onClick={resetView}
            className="pointer-events-auto hidden md:flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 bg-[#d9d2c7] text-sm font-semibold text-[#171717] shadow-[0_8px_20px_rgba(15,23,42,0.14)] transition hover:bg-[#cfc3a8]"
          >
            ⌖
          </button>
          <div className="pointer-events-auto hidden md:block overflow-hidden rounded-lg border border-black/15 bg-[#d9d2c7] shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(1)}
              className="flex h-10 w-10 items-center justify-center border-b border-black/10 text-lg font-medium text-[#171717] transition hover:bg-[#cfc3a8]"
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(-1)}
              className="flex h-10 w-10 items-center justify-center text-lg font-medium text-[#171717] transition hover:bg-[#cfc3a8]"
            >
              −
            </button>
          </div>
        </div>
        ) : null}

        {/* Feature onboarding tutorial for first-time visitors */}
        {showTutorial && !singlePropertyId ? <FeatureTutorial /> : null}
      </div>
    </section>
  );
}
