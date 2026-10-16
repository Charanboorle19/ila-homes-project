"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropertyBlock from "@/components/property-block";
import Wishlist from "@/components/wishlist";
import CompareProperties from "@/components/CompareProperties";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type FilterSpecification,
  type GeoJSONSource,
  type ImageSource,
  type MapMouseEvent,
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
  fetchPropertyById,
  fetchPropertyUnits,
  formatPrice,
  type ApiProperty,
  type PropertyAnchor,
  type PropertyLayoutCords,
  type PropertyListItem,
} from "@/services/propertiesService";
import {
  fetchActiveFeatures,
  findPropertiesByFeatures,
  type PropertyFeature,
} from "@/services/featuresService";

import PriceEmiFuture from "@/components/PropertyDetail/PriceEmiFuture";
import EmiAppreciation from "@/components/EmiAppreciation";
import { trackEvent } from "@/services/analytics/tracker";
import { formatInr } from "@/lib/propertyUtils";
import { loadLayoutPreviewRaster } from "@/lib/layoutPreview";
import { loadLayoutRaster } from "@/lib/layoutTiff";
import {
  SATELLITE_ATTRIBUTION,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
  SATELLITE_TILES_URL,
} from "@/lib/satelliteTiles";
import { ILA_API_BASE_URL } from "@/lib/ilaApiConfig";

type FilterKey = "all" | PlotStatus;
type SheetTab = "about" | "plots" | "features" | "location";

// Next/Turbopack cannot resolve MapLibre's bundled worker sibling imports.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
  "status",
  "statusNorm",
] as const;

const EMPTY_FC = {
  type: "FeatureCollection" as const,
  features: [],
};

/** Estate master-plan palette */
const LAYOUT = {
  siteFill: "#EFE6D6",
  siteEdge: "#C6A46C",
  openArea: "#7CB342",
  openAreaEdge: "#E8F5C8",
  available: "#1F8A68",
  sold: "#8A8178",
  plotEdge: "#FFFFFF",
  selected: "#D4A84B",
  selectedEdge: "#FFFFFF",
  road: "#0B0B0B",
  roadLine: "#FFFFFF",
  roadCasing: "#2A2A2A",
} as const;

const LAYOUT_LAYER_IDS = [
  "estate-site-pad-fill",
  "estate-site-pad-edge",
  "estate-open-fill",
  "estate-open-edge",
  "estate-plots-fill",
  "estate-plots-outline",
  "estate-plots-label",
  "estate-roads-fill",
  "estate-roads-casing",
  "estate-roads-edge",
  "estate-roads-center",
] as const;

/** Keep the estate GeoJSON visible so plot polygons remain selectable on the map. */
const SHOW_ESTATE_GEOJSON = true;

/** Ceiling for the layout fit, so an estate always fills the frame. */
const LAYOUT_MAX_ZOOM = 17.2;

const LAYOUT_RASTER_SOURCE_ID = "estate-layout-image";
const LAYOUT_RASTER_LAYER_ID = "estate-layout-raster";

function syncLayoutRaster(
  map: MapLibreMap,
  raster: LayoutRaster | undefined,
  layoutVisible: boolean,
) {
  const source = map.getSource(LAYOUT_RASTER_SOURCE_ID) as ImageSource | undefined;
  if (!source || !map.getLayer(LAYOUT_RASTER_LAYER_ID)) {
    console.warn("[ILA map] layout image source/layer missing", {
      source: Boolean(source),
      layer: Boolean(map.getLayer(LAYOUT_RASTER_LAYER_ID)),
    });
    return;
  }

  const showRaster = Boolean(layoutVisible && raster);

  if (raster) {
    console.log("[ILA map] applying layout image", {
      id: raster.id,
      coordinates: raster.coordinates,
      // A preview arrives already decoded from a bucket with no CORS headers;
      // the TIFF fallback is handed over as a PNG data URL instead.
      imageKind: raster.image ? "decoded" : "url",
      dataUrlKb: raster.url ? Math.round(raster.url.length / 1024) : 0,
      opacity: raster.opacity,
    });
    // Exactly one of the two: a decoded image skips the network, a URL is
    // fetched by the map itself.
    if (raster.image) {
      source.updateImage({
        image: raster.image,
        coordinates: raster.coordinates,
      });
    } else if (raster.url) {
      source.updateImage({
        url: raster.url,
        coordinates: raster.coordinates,
      });
    }
    map.setPaintProperty(
      LAYOUT_RASTER_LAYER_ID,
      "raster-opacity",
      raster.opacity,
    );
  }

  map.setLayoutProperty(
    LAYOUT_RASTER_LAYER_ID,
    "visibility",
    showRaster ? "visible" : "none",
  );

  console.log(
    `[ILA map] layout image ${showRaster ? "shown" : "hidden"} at zoom ${map.getZoom().toFixed(2)}`,
  );

  // Hide beige site pad when GeoJSON is off or a layout image is showing.
  const showPad = Boolean(SHOW_ESTATE_GEOJSON && layoutVisible && !raster);
  if (map.getLayer("estate-site-pad-fill")) {
    map.setLayoutProperty(
      "estate-site-pad-fill",
      "visibility",
      showPad ? "visible" : "none",
    );
  }
  if (map.getLayer("estate-site-pad-edge")) {
    map.setLayoutProperty(
      "estate-site-pad-edge",
      "visibility",
      showPad ? "visible" : "none",
    );
  }
}

const PIN_ICON = `
  <span class="ila-project-pin__anchor" aria-hidden="true">
    <span class="ila-project-pin__halo"></span>
    <span class="ila-project-pin__core">
      <svg viewBox="0 0 24 24" class="ila-project-pin__icon" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-5H10v5H5a1 1 0 0 1-1-1v-8.5Z" fill="currentColor"/>
      </svg>
    </span>
    <span class="ila-project-pin__needle"></span>
    <span class="ila-project-pin__point"></span>
  </span>
`;

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
function PropertyCard({
  item,
  detail,
  plotCount,
  active,
  onSelect,
}: {
  item: PropertyListItem;
  detail: ApiProperty | null;
  plotCount: number;
  active: boolean;
  onSelect: () => void;
}) {
  const location =
    detail?.locality || detail?.city || detail?.address || detail?.location_name || "";
  const total = detail?.total_inventory ?? null;
  const available = detail?.available_inventory ?? null;

  return (
    <button
      type="button"
      onClick={onSelect}
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

/**
 * A pin is the marker only — the name is carried by the accessible label and
 * the native tooltip, not rendered as a tag on the map. With no visible tags,
 * pins are placed at their exact coordinates instead of being nudged apart to
 * stop labels colliding.
 */
function createProjectPin(
  project: MapPin,
  options?: {
    isHighlighted?: boolean;
    isDimmed?: boolean;
    compareSelected?: boolean;
    compareIndex?: number;
  },
) {
  const el = document.createElement("button");
  el.type = "button";
  let classes = "ila-project-pin group";
  if (options?.compareSelected) {
    classes += " ila-project-pin--compare-selected";
  } else if (options?.isHighlighted) {
    classes += " ila-project-pin--highlighted";
  } else if (options?.isDimmed) {
    classes += " ila-project-pin--dimmed";
  }
  el.className = classes;
  el.setAttribute(
    "aria-label",
    project.location ? `${project.name}, ${project.location}` : project.name,
  );

  const priceHtml = project.formattedPrice
    ? `<span class="ila-pin-tooltip__price">${project.formattedPrice}</span>`
    : "";
  const locationHtml = project.location
    ? `<span class="ila-pin-tooltip__loc">${project.location}</span>`
    : "";

  const badgeHtml =
    typeof options?.compareIndex === "number"
      ? `<span class="ila-project-pin__badge">${options.compareIndex}</span>`
      : "";

  el.innerHTML = `
    ${badgeHtml}
    ${PIN_ICON}
    <div class="ila-pin-tooltip" aria-hidden="true">
      <span class="ila-pin-tooltip__eyebrow">Development</span>
      <strong class="ila-pin-tooltip__name">${project.name}</strong>
      ${locationHtml}
      ${priceHtml}
      <span class="ila-pin-tooltip__arrow"></span>
    </div>
  `;
  return el;
}

function setLayoutData(map: MapLibreMap, project: EstateProject | null) {
  const set = (id: string, data: object) => {
    const source = map.getSource(id) as GeoJSONSource | undefined;
    source?.setData(data as GeoJSON.FeatureCollection);
  };

  if (!project) {
    set("estate-site-pad", EMPTY_FC);
    set("estate-open-areas", EMPTY_FC);
    set("estate-plots", EMPTY_FC);
    set("estate-roads", EMPTY_FC);
    set("estate-road-centers", EMPTY_FC);
    return;
  }

  set("estate-site-pad", project.sitePadGeo);
  set("estate-open-areas", project.openAreasGeo);
  set("estate-plots", project.plotsGeo);
  set("estate-roads", project.roadsGeo);
  set("estate-road-centers", project.roadCenterlinesGeo);
}

export type MapSectionProps = {
  propertyId?: string;
  className?: string;
  hideDetails?: boolean;
  hideSearch?: boolean;
  highlightAvailable?: boolean;
};

export default function MapSection({
  propertyId: singlePropertyId,
  className,
  hideDetails = false,
  hideSearch = false,
  highlightAvailable = false,
}: MapSectionProps = {}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const projectMarkersRef = useRef<Marker[]>([]);
  const mapReadyRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<ProjectId | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const fittedPinsRef = useRef("");
  /** Coalesces the auto-fit while pins stream in, so the camera moves once. */
  const fitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectAbortRef = useRef<AbortController | null>(null);
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
  // All browser-side: the tenant is identified by a header the server
  // cannot send.
  const [propertyList, setPropertyList] = useState<PropertyListItem[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [activePropertyDetail, setActivePropertyDetail] = useState<ApiProperty | null>(
    null,
  );
  const [unitsCount, setUnitsCount] = useState(0);
  // Coordinates for every listed property, so all of them can be pinned.
  const [propertyAnchors, setPropertyAnchors] = useState<
    Record<string, PropertyAnchor>
  >({});

  // Feature preferences (Find Your Plot tags)
  const [features, setFeatures] = useState<PropertyFeature[]>([]);
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<string[]>([]);
  const tagsScrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Fetch active features for the bottom chips
  useEffect(() => {
    const controller = new AbortController();
    fetchActiveFeatures(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setFeatures(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.warn("[MapSection] could not load features", err);
      });
    return () => controller.abort();
  }, []);

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

  // Compare mode state (selecting properties on map & viewing comparison table)
  const [compareSelectingMode, setCompareSelectingMode] = useState(false);
  const compareSelectingModeRef = useRef(false);
  compareSelectingModeRef.current = compareSelectingMode;
  const [compareSelectedIds, setCompareSelectedIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const startCompareMode = useCallback((initialId?: string) => {
    setCompareSelectingMode(true);
    setDesktopPropertyCardOpen(false);
    setPropertySheetExpanded(false);
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
   * The units payload carries two images: `layout_preview_url`, a PNG of the
   * plan already rendered at screen resolution, and `tif_url`, the survey scan
   * itself. The preview is preferred — it needs no decode and is far smaller —
   * and the TIFF is decoded only for properties that have no preview.
   *
   * Both are presigned S3 links that die an hour after they are minted, so a
   * cached units payload can hand back a URL that is already expired (S3
   * answers 403 "Request has expired") while the plot geometry — which never
   * expires — still draws. On that failure the units payload is fetched once
   * more to obtain a freshly signed URL, and only then is the layout given up on.
   */
  const attachLayoutImage = useCallback(
    async (input: {
      propertyId: string;
      layoutPreviewUrl: string | null;
      tifUrl: string | null;
      cords: PropertyLayoutCords;
      signal: AbortSignal;
    }) => {
      let { layoutPreviewUrl, tifUrl, cords } = input;

      // Prefer the TIFF supplied by the API. It is the authoritative layout
      // image and is decoded locally before being handed to MapLibre. The
      // preview is a fallback for properties without TIFF or where TIFF decode fails.
      // If layoutPreviewUrl itself points to a .tif/.tiff, treat it as a TIFF scan.
      const previewIsTiff = Boolean(
        layoutPreviewUrl &&
          /\.tiff?(?:$|\?)/i.test(layoutPreviewUrl),
      );
      const effectiveTifUrl = tifUrl ?? (previewIsTiff ? layoutPreviewUrl : null);
      const effectivePreviewUrl = previewIsTiff ? null : layoutPreviewUrl;

      let imageUrl: string | null = effectiveTifUrl ?? effectivePreviewUrl;
      let useTiff = Boolean(effectiveTifUrl);
      if (!imageUrl) return;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const currentImageUrl: string | null = imageUrl;
        if (!currentImageUrl) return;
        let raster = useTiff
          ? await loadLayoutRaster({
              propertyId: input.propertyId,
              tifUrl: currentImageUrl,
              cords,
              signal: input.signal,
            })
          : await loadLayoutPreviewRaster({
              propertyId: input.propertyId,
              previewUrl: currentImageUrl,
              cords,
              signal: input.signal,
            });

        // If TIFF decoding failed on the first attempt but layoutPreviewUrl is available,
        // immediately fall back to the PNG layout preview.
        if (!raster && useTiff && layoutPreviewUrl && layoutPreviewUrl !== currentImageUrl) {
          console.warn("[ILA map] layout TIFF decode failed, falling back to layoutPreviewUrl");
          useTiff = false;
          imageUrl = layoutPreviewUrl;
          raster = await loadLayoutPreviewRaster({
            propertyId: input.propertyId,
            previewUrl: layoutPreviewUrl,
            cords,
            signal: input.signal,
          });
        }

        if (input.signal.aborted) return;

        if (raster) {
          setRemoteProject((current) =>
            current && current.id === input.propertyId
              ? { ...current, layoutRaster: raster }
              : current,
          );
          return;
        }

        if (attempt === 2) {
          console.warn("[ILA map] giving up on the layout image", {
            propertyId: input.propertyId,
          });
          return;
        }

        console.warn(
          "[ILA map] layout image failed — re-requesting units for a fresh presigned URL",
        );
        const refreshed = await fetchPropertyUnits(input.propertyId, input.signal);
        if (input.signal.aborted) return;
        if (!refreshed.layoutPreviewUrl && !refreshed.tifUrl) return;
        layoutPreviewUrl = refreshed.layoutPreviewUrl ?? layoutPreviewUrl;
        tifUrl = refreshed.tifUrl ?? tifUrl;
        if (refreshed.layoutCords) cords = refreshed.layoutCords;
        // If TIFF failed previously, prefer previewUrl in the retry
        if (!useTiff && layoutPreviewUrl) {
          imageUrl = layoutPreviewUrl;
        } else {
          imageUrl = tifUrl ?? layoutPreviewUrl;
          useTiff = Boolean(tifUrl);
        }
      }
    },
    [],
  );

  /**
   * Loads one property: detail, then `/units` for its layout, then draws it.
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
          const propertyRecord =
            getPropertyById(propertyId) ??
            getPropertyById(propertyId === "sark-green" ? "sark-green-plains" : propertyId);
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

        const detail = await fetchPropertyById(propertyId, controller.signal);
        setActivePropertyDetail(detail);

        // Coordinates come from the property detail or fallback to the list row
        const listItem = propertyList.find((item) => item.id === propertyId);
        const anchor = propertyAnchor(detail) ?? (listItem ? propertyAnchor(listItem) : null);
        setPropertyAnchors((prev) =>
          anchor ? { ...prev, [propertyId]: anchor } : prev,
        );

        const { units, layoutPreviewUrl, tifUrl, layoutCords } = await fetchPropertyUnits(
          propertyId,
          controller.signal,
        );
        setUnitsCount(units.length);

        let estate: EstateProject | null = null;
        try {
          if (units.length > 0) {
            estate = estateFromUnitsApi({
              propertyId,
              name: detail.name,
              location:
                [detail.locality, detail.city].filter(Boolean).join(", ") ||
                "Hyderabad",
              anchor,
              layoutCords,
              unitsJson: units,
            });
          }
        } catch (geomErr) {
          console.warn("[ILA API] could not build vector plots from units, checking layout image", geomErr);
        }

        // If no vector polygons exist (or units was empty), create a fallback estate project
        // georeferenced to layoutCords or the property anchor so the layout raster can still render.
        if (!estate) {
          if (anchor) {
            estate = estatePlaceholderFromProperty({
              propertyId,
              name: detail.name,
              location:
                [detail.locality, detail.city].filter(Boolean).join(", ") ||
                "Hyderabad",
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
          console.info("[ILA API] property has no units and no coordinates", detail.name);
          return;
        }

        setRemoteProject(estate);
        setRemoteStatus("ready");
        setSelectedId(null);
        setPanelOpen(true);
        setFilter("all");
        setMobilePlotExpanded(false);
        setPropertySheetExpanded(false);

        // If layoutCords is missing from the units response, derive
        // layout coordinates from the unit bounds so the master plan image can still be drawn.
        const effectiveCords: PropertyLayoutCords | null =
          layoutCords ??
          (estate?.bounds
            ? {
                west: estate.bounds.minLng,
                east: estate.bounds.maxLng,
                north: estate.bounds.maxLat,
                south: estate.bounds.minLat,
              }
            : null);

        // The master plan is attached after the estate is on the map, so a
        // slow or failed download never delays the view itself.
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
    [attachLayoutImage],
  );

  // Step 1: list every property.
  useEffect(() => {
    const controller = new AbortController();

    // The searchable catalogue. Only failures were logged before, so a
    // successful-but-wrong payload was indistinguishable from a silent one.
    console.log(
      `[ILA API] GET ${ILA_API_BASE_URL}/api/properties?status=ALL&page=1&per_page=100`,
    );

    fetchProperties({ status: "ALL", page: 1, perPage: 100, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;

        console.log("[ILA API] properties list — response", {
          returned: result.items.length,
          total: result.total,
          totalPages: result.totalPages,
          items: result.items,
        });

        setPropertyList(result.items);

        // Seed pins from the rows that already carry coordinates. This is
        // synchronous, so those pins render on the very next frame with no
        // detail call involved at all.
        const seeded: Record<string, PropertyAnchor> = {};
        for (const item of result.items) {
          const anchor = propertyAnchor(item);
          if (anchor) seeded[item.id] = anchor;
        }
        if (Object.keys(seeded).length > 0) setPropertyAnchors(seeded);

        // Resolve the rest, publishing each anchor as it arrives instead of
        // waiting for the slowest detail call in the batch. Pins appear
        // progressively rather than all at once at the end.
        fetchPropertyAnchors(result.items, {
          signal: controller.signal,
          concurrency: 4,
          onAnchor: (propertyId, anchor) => {
            if (controller.signal.aborted) return;
            setPropertyAnchors((previous) =>
              previous[propertyId]
                ? previous
                : { ...previous, [propertyId]: anchor },
            );
          },
        }).then((anchors) => {
          if (controller.signal.aborted) return;
          setPropertyAnchors((previous) => ({ ...previous, ...anchors }));
        });

        // When a single property is requested (e.g. on /properties/{id}),
        // immediately open that property's layout.
        if (singlePropertyId) {
          void selectProperty(singlePropertyId, { openLayout: true, openSheet: false });
        } else {
          // Open the first property that actually has plots, so the map is
          // not empty on first paint. Most listings have no geometry yet.
          // Silent: this is a convenience warm-up, not a visitor request, so it
          // runs behind the pins rather than dimming the map with a spinner.
          const first = result.items[0];
          if (first) selectProperty(first.id, { silent: true });
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (singlePropertyId) {
          // In single property mode, also try selecting directly via fetchPropertyById
          void selectProperty(singlePropertyId, { openLayout: true, openSheet: false });
        } else {
          setRemoteStatus("error");
        }
        console.warn("[ILA API] properties list failed", error);
      });

    return () => controller.abort();
    // Runs once: the map is populated from the API on mount.
  }, [selectProperty, singlePropertyId]);

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
      const displayPrice = item.price_label || (item.price ? formatPrice(item.price) : null);
      byId.set(item.id, {
        id: item.id,
        name: item.name,
        location: [item.locality, item.city].filter(Boolean).join(", ") || undefined,
        center: [anchor.longitude, anchor.latitude],
        price: item.price,
        formattedPrice: displayPrice,
      });
    }

    for (const project of projects) {
      if (!byId.has(project.id)) {
        const prop = getPropertyById(project.id === "sark-green" ? "sark-green-plains" : project.id);
        const displayPrice = prop?.price ? formatInr(prop.price) : null;
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
      sold: plots.filter((p) => p.status === "sold").length,
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
    // Closing a popup must return the map to its regular zoomed-out portfolio
    // view. Clearing the fitted-signature guard forces the pins effect to
    // re-fit (and drop the satellite basemap) even though the pins themselves
    // have not moved.
    fittedPinsRef.current = "";
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

    let map: MapLibreMap;
    try {
      const isMobileScreen =
        typeof window !== "undefined" &&
        !window.matchMedia("(min-width: 768px)").matches;
      map = new MapLibreMap({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [78.42, 17.17],
        zoom: 11.4,
        pitch: 0,
        attributionControl: { compact: true },
        dragRotate: true,
        pitchWithRotate: true,
        touchPitch: true,
        cooperativeGestures: false,
      });
    } catch (error) {
      console.error("Unable to initialize the developments map", error);
      setMapError(true);
      return;
    }

    mapRef.current = map;
    map.on("error", (event) => {
      console.error("Developments map error", event.error);
      if (!mapReadyRef.current) setMapError(true);
    });

    // Mobile: native vertical page scroll + horizontal map pan + pinch zoom
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    let lastTouchX: number | null = null;
    let lastTouchY: number | null = null;
    let gestureAxis: "pending" | "horizontal" | "vertical" | "pinch" =
      "pending";
    const canvas = map.getCanvasContainer();
    const glCanvas = map.getCanvas();

    const setMobileTouchAction = (enabled: boolean) => {
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
      if (!mobileQuery.matches || mapFullscreenRef.current) return;

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
      map.panBy([-dx, 0], { animate: false });
    };

    const onTouchEnd = () => {
      lastTouchX = null;
      lastTouchY = null;
      gestureAxis = "pending";
    };

    const clearMobileTouchListeners = () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };

    const applyMobileInteractions = () => {
      clearMobileTouchListeners();
      // Unrestricted full interaction on both desktop and mobile:
      map.cooperativeGestures?.disable();
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.touchZoomRotate.enableRotation();
      map.dragRotate.enable();
      setMobileTouchAction(false);
    };

    const onWheel = () => {
      if (mapFullscreenRef.current || mobileQuery.matches) return;
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
    mobileQuery.addEventListener("change", applyMobileInteractions);

    const resizeMap = () => {
      map.resize();
    };
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            map.resize();
          })
        : null;
    const onOrientationChange = () => map.resize();
    resizeObserver?.observe(mapContainerRef.current);
    window.addEventListener("orientationchange", onOrientationChange);
    window.addEventListener("resize", resizeMap);
    window.requestAnimationFrame(() => map.resize());

    map.on("load", () => {
      map.resize();
      window.requestAnimationFrame(() => map.resize());
      if (mobileQuery.matches) setMobileTouchAction(true);

      // MAP_ZOOM_REGION: report the viewport the visitor settled on, so we can
      // tell which part of the layout they are exploring.
      let lastZoomRegion = "";
      map.on("moveend", () => {
        const center = map.getCenter();
        const region = `${center.lat.toFixed(2)},${center.lng.toFixed(2)}@${map
          .getZoom()
          .toFixed(1)}`;
        if (region === lastZoomRegion) return;
        lastZoomRegion = region;

        trackEvent({
          event_type: "MAP_ZOOM_REGION",
          property_id: activePropertyId ?? undefined,
          metadata: {
            center_lat: Number(center.lat.toFixed(5)),
            center_lng: Number(center.lng.toFixed(5)),
            zoom: Number(map.getZoom().toFixed(2)),
            section_type: "hero_map",
          },
        });
      });

      map.addSource("estate-site-pad", { type: "geojson", data: EMPTY_FC });
      map.addSource("estate-open-areas", { type: "geojson", data: EMPTY_FC });
      map.addSource("estate-plots", { type: "geojson", data: EMPTY_FC });
      map.addSource("estate-roads", { type: "geojson", data: EMPTY_FC });
      map.addSource("estate-road-centers", { type: "geojson", data: EMPTY_FC });

      // Satellite imagery, hidden until a layout is open. Added before the
      // estate layers so plots and labels stay on top of it.
      map.addSource(SATELLITE_SOURCE_ID, {
        type: "raster",
        tiles: [SATELLITE_TILES_URL],
        tileSize: 256,
        maxzoom: 19,
        attribution: SATELLITE_ATTRIBUTION,
      });
      map.addLayer({
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        layout: { visibility: "none" },
        paint: { "raster-fade-duration": 0 },
      });

      // Created without a url: a layout preview is only known once a property
      // is opened, and an image source left empty draws nothing until
      // `updateImage` hands it one. The coordinates are the placeholder quad,
      // replaced by the property's own extent on every load.
      map.addSource(LAYOUT_RASTER_SOURCE_ID, {
        type: "image",
        coordinates: [
          [78.37881930400647, 17.136994933863203], // NW
          [78.3822802855224, 17.136994933863203], // NE
          [78.3822802855224, 17.13329363718222], // SE
          [78.37881930400647, 17.13329363718222], // SW
        ],
      });

      map.addLayer({
        id: LAYOUT_RASTER_LAYER_ID,
        type: "raster",
        source: LAYOUT_RASTER_SOURCE_ID,
        layout: { visibility: "none" },
        paint: {
          "raster-opacity": 0.85,
          "raster-fade-duration": 0,
        },
      });

      map.addLayer({
        id: "estate-site-pad-fill",
        type: "fill",
        source: "estate-site-pad",
        layout: { visibility: "none" },
        paint: {
          "fill-color": LAYOUT.siteFill,
          "fill-opacity": 0.72,
        },
      });
      map.addLayer({
        id: "estate-site-pad-edge",
        type: "line",
        source: "estate-site-pad",
        layout: { visibility: "none" },
        paint: {
          "line-color": LAYOUT.siteEdge,
          "line-width": 2,
          "line-opacity": 0.85,
          "line-dasharray": [1.5, 1.2],
        },
      });

      map.addLayer({
        id: "estate-open-fill",
        type: "fill",
        source: "estate-open-areas",
        layout: { visibility: "none" },
        paint: {
          "fill-color": LAYOUT.openArea,
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "estate-open-edge",
        type: "line",
        source: "estate-open-areas",
        layout: { visibility: "none" },
        paint: {
          "line-color": LAYOUT.openAreaEdge,
          "line-width": 1.4,
        },
      });

      map.addLayer({
        id: "estate-plots-fill",
        type: "fill",
        source: "estate-plots",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "match",
            ["get", "statusNorm"],
            "available",
            LAYOUT.available,
            LAYOUT.sold,
          ],
          "fill-opacity": 0.82,
        },
      });
      map.addLayer({
        id: "estate-plots-outline",
        type: "line",
        source: "estate-plots",
        layout: { visibility: "none", "line-join": "miter" },
        paint: {
          "line-color": LAYOUT.plotEdge,
          "line-width": 1.15,
          "line-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "estate-plots-label",
        type: "symbol",
        source: "estate-plots",
        layout: {
          visibility: "none",
          "text-field": ["get", "plotNo"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15.5,
            8,
            17,
            11,
            18.5,
            13,
          ],
          "text-allow-overlap": false,
          "text-padding": 2,
          "symbol-placement": "point",
        },
        paint: {
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
          "text-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15.8,
            0,
            16.2,
            1,
          ],
        },
      });

      map.addLayer({
        id: "estate-roads-fill",
        type: "fill",
        source: "estate-roads",
        layout: { visibility: "none" },
        paint: {
          "fill-color": LAYOUT.road,
          "fill-opacity": 1,
        },
      });
      map.addLayer({
        id: "estate-roads-casing",
        type: "line",
        source: "estate-roads",
        layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
        paint: {
          "line-color": LAYOUT.roadCasing,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            4,
            16.5,
            8,
            18,
            14,
          ],
        },
      });
      map.addLayer({
        id: "estate-roads-edge",
        type: "line",
        source: "estate-roads",
        layout: { visibility: "none", "line-cap": "butt", "line-join": "miter" },
        paint: {
          "line-color": LAYOUT.roadLine,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            2,
            16.5,
            4.5,
            18,
            8,
          ],
          "line-opacity": 1,
        },
      });
      map.addLayer({
        id: "estate-roads-center",
        type: "line",
        source: "estate-road-centers",
        layout: { visibility: "none", "line-cap": "butt", "line-join": "round" },
        paint: {
          "line-color": LAYOUT.roadLine,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            1.2,
            16.5,
            2.6,
            18,
            4.5,
          ],
          "line-opacity": 1,
          "line-dasharray": [2.2, 1.8],
        },
      });

      const selectRenderedPlot = (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ["estate-plots-fill"],
        })[0];
        const id = feature?.properties?.id as string | undefined;
        if (!id) return;

        const project = projectsRef.current.find((candidate) =>
          candidate.plots.some((plot) => plot.id === id),
        );
        if (!project) return;

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
      map.on("click", selectRenderedPlot);
      map.on("mouseenter", "estate-plots-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "estate-plots-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // panelOpen starts true, and the effect below re-fits whenever the
      // panel is toggled, so the first framing already reserves the sidebar.
      fitBounds(map, projectsBounds, 50, 13.2, true);
      mapReadyRef.current = true;
      setMapReady(true);
      setMapError(false);
    });

    return () => {
      mobileQuery.removeEventListener("change", applyMobileInteractions);
      clearMobileTouchListeners();
      resizeObserver?.disconnect();
      window.removeEventListener("orientationchange", onOrientationChange);
      window.removeEventListener("resize", resizeMap);
      projectMarkersRef.current.forEach((m) => m.remove());
      projectMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []);

  // Keep every property pinned on the map; hide only the active project's pin
  // while its layout is open.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    projectMarkersRef.current.forEach((m) => m.remove());
    projectMarkersRef.current = [];

    const visiblePins = activeProjectId
      ? pins.filter((pin) => pin.id !== activeProjectId)
      : pins;

    const hasFeatureFilter = selectedFeatureKeys.length > 0;
    const isComparing = compareSelectingMode;

    visiblePins.forEach((project) => {
      // Compare mode takes priority for pin appearance
      const compareIndex = isComparing
        ? compareSelectedIds.indexOf(project.id)
        : -1;
      const compareSelected = compareIndex >= 0;
      const isCompareDimmed = isComparing && !compareSelected;

      // Determine if pin matches active FindYourPlot selected features
      const isMatch = hasFeatureFilter && featureMatchedPropertyIds.includes(project.id);
      const isDimmed = isCompareDimmed || (!isComparing && hasFeatureFilter && !isMatch);
      const isHighlighted = !isComparing && hasFeatureFilter && isMatch;

      const el = createProjectPin(project, {
        isHighlighted,
        isDimmed,
        compareSelected,
        compareIndex: compareSelected ? compareIndex + 1 : undefined,
      });

      if (emiSelectingProperty) {
        el.classList.add("ila-project-pin--pulse");
      }
      el.addEventListener("click", (event) => {
        event.stopPropagation();

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        trackEvent({
          event_type: "MAP_MARKER_CLICK",
          property_id: project.id,
          metadata: { source: "map_pin", section_type: "hero_map" },
        });

        // If user is currently in Compare Selection mode:
        if (compareSelectingModeRef.current) {
          toggleCompareId(project.id);
          return;
        }

        // If user is selecting a property specifically for EMI calculation:
        // Do not zoom in or load the estate layout; only set the selection and open the popup.
        if (emiSelectingPropertyRef.current) {
          const matchedItem = propertyList.find((p) => p.id === project.id);
          const effectivePrice =
            project.price ??
            matchedItem?.price ??
            5000000;
          setEmiSelectedProperty({
            id: project.id,
            name: project.name,
            price: effectivePrice,
            location: project.location || [matchedItem?.locality, matchedItem?.city].filter(Boolean).join(", ") || undefined,
          });
          setEmiSelectingProperty(false);
          setEmiOpen(true);
          return;
        }

        // Normal mode: Pins are shown for every property, so a tap has to load that
        // property. Desktop gets a floating property block on left center;
        // mobile gets the minimized popup bottom sheet.
        void selectProperty(project.id, {
          openSheet: true,
          openDesktopCard: !isMobile,
          openLayout: true,
        });
      });
      const marker = new Marker({
        element: el,
        anchor: "bottom",
      })
        .setLngLat(project.center)
        .addTo(map);
      projectMarkersRef.current.push(marker);
    });

    if (!activeProjectId) {
      // Only re-frame when the pins themselves moved (or the sidebar resized
      // the usable area). Selecting a property must not yank the camera back
      // out to the portfolio view — `focusRequest` handles that instead.
      const signature = `${panelOpen}|${pins
        .map((pin) => `${pin.id}:${pin.center[0]},${pin.center[1]}`)
        .join("|")}`;

      if (signature !== fittedPinsRef.current) {
        fittedPinsRef.current = signature;
        // Pins now stream in one at a time as their coordinates resolve, so an
        // immediate fit would restart a 900ms camera move on every arrival.
        // Coalescing lets the burst settle into a single framing pass.
        if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
        fitTimerRef.current = setTimeout(() => {
          fitTimerRef.current = null;
          fitBounds(map, pinsBounds, 50, 13.2, panelOpen);
        }, 120);
      }
    }
  }, [
    activeProjectId,
    compareSelectedIds,
    compareSelectingMode,
    emiSelectingProperty,
    featureMatchedPropertyIds,
    mapReady,
    panelOpen,
    pins,
    pinsBounds,
    selectProperty,
    selectedFeatureKeys,
    toggleCompareId,
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
        map.setLayoutProperty(
          layerId,
          "visibility",
          activeProject && SHOW_ESTATE_GEOJSON ? "visible" : "none",
        );
      }
    }

    syncLayoutRaster(map, activeProject?.layoutRaster, Boolean(activeProject));

    if (activeProject) {
      // Zoom to the estate the units API just returned. Estate plots span a
      // couple of hundred metres, so this always lands on a close read of the
      // layout rather than the wider portfolio view.
      fitBounds(map, activeProject.bounds, 60, LAYOUT_MAX_ZOOM, panelOpen);
    }
  }, [activeProject, mapReady, panelOpen]);

  /**
   * A layout is read against the ground it sits on, so the basemap switches to
   * satellite imagery while a master plan is open and back to the vector style
   * when it closes. Only toggles layer visibility, so nothing is re-requested
   * unless the layer is actually on screen.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer(SATELLITE_LAYER_ID)) return;

    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      layoutOpen ? "visible" : "none",
    );
  }, [layoutOpen, mapReady]);

  // Highlight selected plot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen || !map.getLayer("estate-plots-fill")) {
      return;
    }

    const active = selectedId || "";

    map.setPaintProperty("estate-plots-fill", "fill-color", [
      "case",
      ["==", ["get", "id"], active],
      LAYOUT.selected,
      [
        "match",
        ["get", "statusNorm"],
        "available",
        LAYOUT.available,
        LAYOUT.sold,
      ],
    ]);
    // The master plan under the plots is the point of drawing it, so the fills
    // go translucent while an image is showing and opaque without one — the
    // outlines and labels stay solid either way, so plots remain readable and
    // selectable.
    const baseOpacity = activeProject?.layoutRaster ? 0.4 : 0.82;
    map.setPaintProperty("estate-plots-fill", "fill-opacity", [
      "case",
      ["==", ["get", "id"], active],
      0.95,
      ["==", active, ""],
      baseOpacity,
      0.45,
    ]);
    map.setPaintProperty("estate-plots-outline", "line-color", [
      "case",
      ["==", ["get", "id"], active],
      LAYOUT.selectedEdge,
      LAYOUT.plotEdge,
    ]);
    map.setPaintProperty("estate-plots-outline", "line-width", [
      "case",
      ["==", ["get", "id"], active],
      3.2,
      1.15,
    ]);

    // When highlightAvailable is active and no single plot is picked,
    // run a smooth, noticeable pulsing animation on all available plots.
    if (highlightAvailable && !active) {
      let animFrameId: number;
      const startTime = performance.now();
      const baseFill = activeProject?.layoutRaster ? 0.45 : 0.72;

      // Pulse between emerald green and bright mint-green glow
      const animatePulse = (currentTime: number) => {
        const elapsed = (currentTime - startTime) / 1000;
        // Smooth sine wave oscillating between 0 and 1 over ~2.0 seconds
        const t = (Math.sin(elapsed * 3.14) + 1) / 2;
        const availableOpacity = baseFill + t * 0.35;
        const availableLineWidth = 1.3 + t * 2.2;
        // Interpolate between deep emerald (#1F8A68) and vibrant glowing green (#34D399)
        const pulseR = Math.round(31 + t * (52 - 31));
        const pulseG = Math.round(138 + t * (211 - 138));
        const pulseB = Math.round(104 + t * (153 - 104));
        const pulseColor = `rgb(${pulseR}, ${pulseG}, ${pulseB})`;

        if (map.getLayer("estate-plots-fill")) {
          map.setPaintProperty("estate-plots-fill", "fill-color", [
            "case",
            ["==", ["get", "id"], active],
            LAYOUT.selected,
            [
              "match",
              ["get", "statusNorm"],
              "available",
              pulseColor,
              LAYOUT.sold,
            ],
          ]);
          map.setPaintProperty("estate-plots-fill", "fill-opacity", [
            "match",
            ["get", "statusNorm"],
            "available",
            Math.min(availableOpacity, 0.98),
            baseOpacity * 0.7,
          ]);
        }

        if (map.getLayer("estate-plots-outline")) {
          map.setPaintProperty("estate-plots-outline", "line-width", [
            "match",
            ["get", "statusNorm"],
            "available",
            availableLineWidth,
            1.15,
          ]);
          map.setPaintProperty("estate-plots-outline", "line-color", [
            "match",
            ["get", "statusNorm"],
            "available",
            t > 0.5 ? "#E6FFFA" : "#FFFFFF",
            LAYOUT.plotEdge,
          ]);
        }

        animFrameId = requestAnimationFrame(animatePulse);
      };

      animFrameId = requestAnimationFrame(animatePulse);
      return () => {
        cancelAnimationFrame(animFrameId);
      };
    }
  }, [
    selectedId,
    layoutOpen,
    mapReady,
    activeProject?.id,
    activeProject?.plots.length,
    activeProject?.layoutRaster,
    highlightAvailable,
  ]);

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

    if (predicates.length === 0) {
      map.setFilter("estate-plots-fill", null);
      map.setFilter("estate-plots-outline", null);
      map.setFilter("estate-plots-label", null);
      return;
    }

    const expression = (
      predicates.length === 1 ? predicates[0] : ["all", ...predicates]
    ) as FilterSpecification;

    map.setFilter("estate-plots-fill", expression);
    map.setFilter("estate-plots-outline", expression);
    map.setFilter("estate-plots-label", expression);
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

  const filters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "available", label: "Available", count: counts.available },
    { key: "sold", label: "Sold", count: counts.sold },
  ];

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
              : "ila-map-frame relative h-full min-h-[400px] flex-1 overflow-hidden bg-neutral-200 md:absolute md:inset-0 md:m-0"
        }
      >
        <div ref={mapContainerRef} className="absolute inset-0 h-full w-full min-h-full" />

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

        {/* Desktop top-left corner: property name tag when hideDetails is true (e.g. on /properties/{id}) */}
        {!mapFullscreen && hideDetails && (activeProject?.name || activeProperty?.name) ? (
          <div className="pointer-events-none absolute top-3 left-3 z-20 hidden md:flex items-center gap-2 rounded-xl border border-black/15 bg-[#eae4da]/95 px-3.5 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.14)] backdrop-blur-md">
            <div>
              <p className="text-[9px] font-semibold tracking-[0.2em] text-[#7a5c28] uppercase">
                Estate Layout &amp; Plots
              </p>
              <h3 className="text-sm font-semibold tracking-tight text-[#171717]">
                {activeProject?.name ?? activeProperty?.name}
              </h3>
            </div>
          </div>
        ) : null}



        {!hideDetails && panelOpen ? (
          <aside className="pointer-events-none absolute inset-y-0 left-0 z-20 hidden w-88 flex-col py-3 pl-3 md:flex sm:py-4">
            <div className="pointer-events-auto relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/15 bg-[#d9d2c7] shadow-[8px_0_28px_rgba(15,23,42,0.14)]">
              {activeProject && !singlePropertyId ? (
                <button
                  type="button"
                  aria-label="Back to all developments"
                  onClick={closeLayout}
                  className="absolute top-2 left-2 z-30 flex items-center gap-1.5 rounded-lg bg-[#171717] px-2.5 py-1.5 text-xs font-semibold tracking-wide text-white shadow-sm transition hover:bg-[#333333]"
                >
                  <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
                  <span>Back</span>
                </button>
              ) : null}

              {activeProject ? (
                // The property card replaces both the heading and the plot
                // list while a layout is open on the desktop sidebar.
                <div className="ila-scroll min-h-0 max-h-full shrink overflow-y-auto overscroll-contain border-b border-black/10 px-3 pt-12 pb-4 sm:px-4 sm:pt-12">
                  <PropertyBlock
                    desktopOpen={true}
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
                    project={activeProject}
                    property={activeProperty}
                    apiProperty={activePopupApiProperty}
                    tab={propertySheetTab}
                    onTabChange={setPropertySheetTab}
                    onOpenCompare={(propId) => {
                      const idToCompare = propId || activePropertyId || activeProject?.id || activeProperty?.id;
                      startCompareMode(idToCompare);
                    }}
                  />
                </div>
              ) : (
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
              )}

              {activeProject ? null : (
                <div className="ila-scroll min-h-0 flex-1 space-y-0 overflow-y-auto">
                  {filteredProperties.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm font-medium text-[#3f3a34]">
                      {remoteStatus === "loading" ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="ila-loader ila-loader--sm" aria-hidden />
                        Loading developments…
                      </span>
                    ) : remoteStatus === "error" ? (
                      "Developments could not be loaded. Try again shortly."
                    ) : query.trim() ? (
                      "No developments match your search."
                    ) : (
                      "No developments published yet."
                    )}
                    </p>
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
                        onSelect={() => {
                          void selectProperty(item.id, { openLayout: true });
                          setPanelOpen(true);
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
              )}

              <div className="shrink-0 border-t border-black/10 p-3 sm:p-4">
                {/* A selected property must reach its own detail page, so the
                    CTA switches from the contact anchor to /properties/{id}.
                    In single-property mode, the visitor is already on the page,
                    so point to the site-visit booking section (#next-step). */}
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
        ) : !hideDetails ? (
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
          onCloseDesktop={() => setDesktopPropertyCardOpen(false)}
          portalReady={portalReady}
          selectedPlot={selectedPlot}
          mapFullscreen={mapFullscreen}
          mobileExpanded={propertySheetExpanded}
          onToggleMobileExpand={() => setPropertySheetExpanded((open) => !open)}
          onCloseMobile={() => {
            closeLayout();
            setPropertySheetExpanded(false);
          }}
          project={selectedProject}
          property={selectedProperty}
          apiProperty={activePopupApiProperty}
          tab={propertySheetTab}
          onTabChange={setPropertySheetTab}
          onOpenCompare={(propId) => {
            const idToCompare = propId || activePropertyId || selectedProject?.id || selectedProperty?.id;
            startCompareMode(idToCompare);
          }}
        />
        {/* Mobile bottom-sheet plot details — compact first, expandable on demand */}
        {selectedPlot ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-60 md:hidden">
            <div className="pointer-events-auto max-h-[42vh] overflow-y-auto animate-sheet-up rounded-t-2xl border-t border-black/10 bg-[#d9d2c7] shadow-[0_-12px_40px_rgba(15,23,42,0.28)] pb-[env(safe-area-inset-bottom)]">
              <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
                <span className="h-1 w-10 rounded-full bg-black/20" />
              </div>
              <div className="relative px-3 pb-3">
                <button
                  type="button"
                  aria-label="Close plot details"
                  onClick={() => {
                    setSelectedId(null);
                    setMobilePlotExpanded(false);
                  }}
                  className="absolute top-1 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] text-white transition hover:bg-[#333333]"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
                <div className="pr-10">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-[#171717]">
                      {selectedPlot.title}
                    </h3>
                    <span className="shrink-0 rounded-full bg-[#1f5c45] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase">
                      {selectedPlot.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#3f3a34]">
                    {selectedPlot.area} · {selectedPlot.price}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#5c5348]">
                    {selectedPlot.location}
                  </p>
                </div>

                <button
                  type="button"
                  aria-expanded={mobilePlotExpanded}
                  onClick={() => setMobilePlotExpanded((expanded) => !expanded)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-black/15 bg-black/5 px-3 py-2 text-xs font-semibold text-[#171717] transition hover:bg-black/10"
                >
                  {mobilePlotExpanded ? "Show less" : "View plot details"}
                  <span aria-hidden>{mobilePlotExpanded ? "⌃" : "⌄"}</span>
                </button>

                {mobilePlotExpanded ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/10 pt-3 text-xs text-[#3f3a34]">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#756c60]">
                        Facing
                      </span>
                      <strong className="font-semibold text-[#171717]">{selectedPlot.facing}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide text-[#756c60]">
                        Location
                      </span>
                      <strong className="font-semibold text-[#171717]">{selectedPlot.location}</strong>
                    </div>
                    <Link
                      href="#contact"
                      className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                    >
                      Enquire about this plot
                      <ArrowIcon className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Desktop plot read-out. The mobile bottom sheet above is md:hidden,
            so desktop needs its own card or a selected plot has no detail. */}
        {selectedPlot ? (
          <div
            className="pointer-events-auto absolute bottom-3 z-30 hidden w-80 overflow-hidden rounded-xl border border-black/15 bg-[#d9d2c7] shadow-[0_12px_36px_rgba(15,23,42,0.22)] md:block"
            style={{ left: panelOpen ? DESKTOP_PANEL_RESERVED + 12 : 12 }}
          >
            <div className="relative px-3 pt-3 pb-3">
              <button
                type="button"
                aria-label="Close plot details"
                onClick={() => setSelectedId(null)}
                className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] text-white transition hover:bg-[#333333]"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
              <div className="pr-9">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-[#171717]">
                    {selectedPlot.title}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white uppercase ${
                      selectedPlot.status === "sold"
                        ? "bg-[#736b60]"
                        : "bg-[#1f5c45]"
                    }`}
                  >
                    {selectedPlot.status}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#3f3a34]">
                  {selectedPlot.area} · {selectedPlot.price}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#5c5348]">
                  {selectedPlot.location}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-black/10 pt-3 text-xs text-[#3f3a34]">
                <div>
                  <span className="block text-[10px] tracking-wide text-[#756c60] uppercase">
                    Facing
                  </span>
                  <strong className="font-semibold text-[#171717]">
                    {selectedPlot.facing}
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] tracking-wide text-[#756c60] uppercase">
                    Location
                  </span>
                  <strong className="font-semibold text-[#171717]">
                    {selectedPlot.location}
                  </strong>
                </div>
              </div>
              <Link
                href="#contact"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                Enquire about this plot
                <ArrowIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : null}

        {/* FindYourPlot feature cards side-by-side at the bottom of the map */}
        {features.length > 0 && !selectedPlot && !compareSelectingMode ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 flex items-center gap-1.5 sm:left-4 sm:right-4 md:right-24">
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
              className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                        <CheckIcon className="h-2.5 w-2.5 stroke-[3]" />
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

            {/* Right arrow (mobile/touch only) */}
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

        {/* Right center quick actions: Wishlist & EMI Calculator */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-end gap-2.5 sm:right-4">
          {/* Wishlist Component */}
          <Wishlist
            isOpen={wishlistOpen}
            onOpen={() => setWishlistOpen(true)}
            onClose={() => setWishlistOpen(false)}
          />

          {/* EMI Calculator Button */}
          <button
            type="button"
            aria-label="Open EMI loan calculator"
            onClick={() => {
              setEmiOpen(false);
              setEmiSelectingProperty((prev) => !prev);
            }}
            className={`pointer-events-auto group relative flex items-center gap-2 rounded-full border p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all active:scale-95 sm:px-3 sm:py-2 ${
              emiSelectingProperty
                ? "border-[#c6a46c] bg-[#c6a46c] text-[#171717] ring-4 ring-[#c6a46c]/30"
                : "border-white/15 bg-[#171717]/90 text-[#f2f0ea] hover:border-[#c6a46c] hover:bg-[#222222]"
            }`}
          >
            <svg
              className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${
                emiSelectingProperty ? "text-[#171717]" : "text-[#c6a46c]"
              }`}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect x="4" y="2" width="16" height="20" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <line x1="8" y1="6" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="8" cy="11" r="1" fill="currentColor" />
              <circle cx="12" cy="11" r="1" fill="currentColor" />
              <circle cx="16" cy="11" r="1" fill="currentColor" />
              <circle cx="8" cy="15" r="1" fill="currentColor" />
              <circle cx="12" cy="15" r="1" fill="currentColor" />
              <circle cx="16" cy="15" r="1" fill="currentColor" />
              <circle cx="8" cy="18" r="1" fill="currentColor" />
              <circle cx="12" cy="18" r="1" fill="currentColor" />
              <circle cx="16" cy="18" r="1" fill="currentColor" />
            </svg>
            <span className="hidden text-xs font-semibold tracking-wide sm:inline">
              {emiSelectingProperty ? "Select on map" : "EMI Calculator"}
            </span>
          </button>

          {/* Compare Properties Button */}
          <button
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
            className={`pointer-events-auto group relative flex items-center gap-2 rounded-full border p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all active:scale-95 sm:px-3 sm:py-2 ${
              compareSelectingMode
                ? "border-[#c6a46c] bg-[#c6a46c] text-[#171717] ring-4 ring-[#c6a46c]/30"
                : "border-white/15 bg-[#171717]/90 text-[#f2f0ea] hover:border-[#c6a46c] hover:bg-[#222222]"
            }`}
          >
            <svg
              className={`h-4.5 w-4.5 transition-transform group-hover:scale-110 ${
                compareSelectingMode ? "text-[#171717]" : "text-[#c6a46c]"
              }`}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect x="3" y="4" width="7.5" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <rect x="13.5" y="4" width="7.5" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M6.75 9h0M17.25 9h0M6.75 14h0M17.25 14h0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span className="hidden text-xs font-semibold tracking-wide sm:inline">
              {compareSelectingMode ? (
                <span>Selecting ({compareSelectedIds.length})</span>
              ) : (
                <span>Compare</span>
              )}
            </span>
          </button>
        </div>

        {/* Floating guidance banner when EMI Calculator is awaiting property selection */}
        {emiSelectingProperty ? (
          <div className="pointer-events-none absolute top-4 inset-x-0 z-40 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#c6a46c]/50 bg-[#141519]/95 px-4 py-2.5 text-xs text-[#f2f0ea] shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c6a46c] text-[#141519] shadow-sm">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
                  <circle cx="12" cy="10" r="2.5" fill="currentColor" />
                </svg>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <strong className="font-semibold text-[#c6a46c]">Select a property on the map</strong>
                <span className="text-white/60 hidden sm:inline">to calculate EMI &amp; returns</span>
              </span>
              <button
                type="button"
                onClick={() => setEmiSelectingProperty(false)}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                aria-label="Cancel property selection"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}



        {/* ======================================================== */}
        {/* COMPARE MODE: Top Header Bar (matches user image)          */}
        {/* ======================================================== */}
        {compareSelectingMode ? (
          <div className="pointer-events-none absolute top-4 inset-x-0 z-50 flex justify-center px-3 sm:px-4">
            <div className="pointer-events-auto flex items-center justify-between gap-3 w-full max-w-md rounded-2xl border border-black/10 bg-[#faf6ee]/95 px-4 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  setCompareSelectingMode(false);
                  setCompareSelectedIds([]);
                }}
                aria-label="Close compare mode"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5 text-[#171717] transition hover:bg-black/10 active:scale-95"
              >
                <CloseIcon className="h-4 w-4" />
              </button>

              <div className="flex-1 text-center">
                <h3 className="text-sm font-bold tracking-tight text-[#171717] sm:text-base">
                  Compare properties
                </h3>
                <p className="text-[11px] font-medium text-[#7a7469]">
                  Tap pins to select up to 5
                </p>
              </div>

              {/* Invisible spacer so the title is optically centered */}
              <div className="h-9 w-9 shrink-0" aria-hidden="true" />
            </div>
          </div>
        ) : null}

        {/* ======================================================== */}
        {/* COMPARE MODE: Bottom Drawer Selection Strip (matches user image) */}
        {/* ======================================================== */}
        {compareSelectingMode ? (
          <div className="pointer-events-none absolute bottom-0 inset-x-0 z-50 flex justify-center px-2 pb-3 sm:px-4 sm:pb-4">
            <div className="pointer-events-auto flex w-full max-w-2xl flex-col rounded-3xl border border-black/10 bg-[#faf6ee] p-4 shadow-[0_-12px_44px_rgba(0,0,0,0.22)] backdrop-blur-md">
              {/* Drag handle */}
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-black/20" aria-hidden="true" />

              {/* Selected / Empty Slots List */}
              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
                {/* Render selected property cards */}
                {compareSelectedIds.map((id) => {
                  const propItem = propertyList.find((p) => p.id === id);
                  const propRec = getPropertyById(id === "sark-green" ? "sark-green-plains" : id);
                  const name = propItem?.name || propRec?.name || id;
                  const cover = propItem?.cover_url || propRec?.gallery?.[0]?.src || "/hero-image.png";

                  return (
                    <div
                      key={id}
                      className="group relative flex h-28 w-28 shrink-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm transition hover:shadow-md"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative h-16 w-full overflow-hidden bg-black/10">
                        <Image
                          src={cover}
                          alt={name}
                          fill
                          sizes="112px"
                          unoptimized
                          className="object-cover"
                        />
                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => toggleCompareId(id)}
                          aria-label={`Remove ${name} from comparison`}
                          className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/95 text-red-600 shadow-md transition hover:bg-red-50 hover:text-red-700 active:scale-95"
                        >
                          <CloseIcon className="h-3 w-3 stroke-[2.5]" />
                        </button>
                      </div>

                      {/* Property name */}
                      <div className="flex flex-1 items-center px-2 py-1">
                        <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[#171717]">
                          {name}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Empty slot placeholders up to 5 */}
                {Array.from({ length: Math.max(0, 5 - compareSelectedIds.length) }).map((_, idx) => (
                  <div
                    key={`empty-slot-${idx}`}
                    className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/15 bg-black/[0.02]"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-[#8a6a12]">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action Row: count, compare now button, clear all */}
              <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-black/10">
                <span className="text-xs font-semibold text-[#5c5348] whitespace-nowrap">
                  <strong className="text-[#171717]">{compareSelectedIds.length} of 5</strong> selected
                </span>

                <button
                  type="button"
                  disabled={compareSelectedIds.length < 2}
                  onClick={() => setCompareModalOpen(true)}
                  className={`flex flex-1 max-w-xs items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold tracking-wider uppercase transition shadow-md ${
                    compareSelectedIds.length >= 2
                      ? "bg-gradient-to-r from-[#c6a46c] to-[#b38e52] text-[#171717] hover:brightness-105 active:scale-[0.99]"
                      : "cursor-not-allowed bg-black/10 text-black/40"
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Compare now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCompareSelectedIds([])}
                  disabled={compareSelectedIds.length === 0}
                  className="text-xs font-semibold text-[#8a6a12] underline underline-offset-4 transition hover:text-[#171717] disabled:opacity-40 disabled:no-underline whitespace-nowrap"
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* CompareProperties Modal Popup Table */}
        {compareModalOpen && (
          <CompareProperties
            initialSelectedIds={compareSelectedIds}
            isModalOpen={compareModalOpen}
            onCloseModal={() => setCompareModalOpen(false)}
            modalOnly
          />
        )}

        {/* EMI Calculator / EmiAppreciation Popup Modal Overlay */}
        {emiOpen ? (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in"
            onClick={() => setEmiOpen(false)}
          >
            <div
              className="relative flex w-full max-w-4xl max-h-[92vh] flex-col rounded-2xl border border-white/15 bg-[#17191d] text-[#f2f0ea] shadow-2xl overflow-hidden"
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

        {/* map zoom + fullscreen controls */}
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
      </div>
    </section>
  );
}
