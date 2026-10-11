"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  fetchLocations,
  hasCoordinates,
  type LocationRecord,
} from "@/services/locationsService";
import {
  fetchProperties,
  fetchPropertiesByLocation,
  formatPrice,
  type PropertySummary,
} from "@/services/propertiesService";
import { trackEvent } from "@/services/analytics/tracker";

/**
 * Page requested for properties. Verified against the live API: every current
 * locality has 1-2 properties, so with per_page=10 there is only one page and
 * page=2 would always come back empty.
 */
const PROPERTIES_PAGE = 1;
const PROPERTIES_PER_PAGE = 10;

/**
 * The worker URL is set inside the map effect rather than at module scope.
 *
 * MapLibre needs an absolute worker URL: resolved relative to the document it
 * fails when the site is opened via a LAN IP (e.g. phone testing on
 * 192.168.x.x), which is where a blank map came from. `MapSection` resolves it
 * the same way for the same reason.
 */

/**
 * OpenFreeMap "liberty" -- the same basemap `MapSection` uses.
 *
 * Both maps sit on the homepage, so they share one style: switching corridors
 * from positron to liberty (or the other way round) would leave the page with
 * two visibly different maps stacked a few sections apart.
 */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const GOLD = "#c9a84c";

/**
 * Section eyebrow, shared by both views.
 *
 * Map mode replaces the whole heading block, so the eyebrow is repeated above
 * the sidebar and map. Held in one constant so the two views cannot drift.
 */
const SECTION_EYEBROW = "South Hyderabad \u00b7 Growth corridors";

/**
 * Fallback viewport, used only until the API locations arrive so the map has
 * somewhere sensible to open. Not displayed as content.
 */
const DEFAULT_VIEW = { longitude: 78.44, latitude: 17.17, zoom: 11.35 };
const LOCATION_ZOOM = 13.2;

function MapIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13L15.5 6.5 9 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 4.5v13M15.5 6.5v13"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Fullscreen corners glyph, identical to `MapSection`'s `ExpandIcon`. */
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

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * The address with the locality name removed from the front.
 *
 * The card already shows the name as its heading, and the API address tends to
 * open with that same name -- so the unedited address showed it twice on one
 * card. Only a leading occurrence is dropped; a name appearing later in the
 * string is part of the address and is kept. Falls back to the original address
 * if stripping would leave nothing behind.
 */
function addressWithoutName(location: LocationRecord): string | null {
  const address = location.address?.trim();
  if (!address) return null;

  const name = location.name?.trim();
  if (!name) return address;

  const stripped = address.toLowerCase().startsWith(name.toLowerCase())
    ? address.slice(name.length)
    : address;

  const cleaned = stripped.replace(/^[\s,\u00b7\u2022|/\\-\u2013\u2014]+/, "").trim();
  return cleaned || address;
}

/**
 * The description, unless it merely restates the address.
 *
 * The API writes descriptions such as "Locality in Maheshwaram Mandal,
 * Ranga Reddy - 500058", which repeat the address the map detail card already
 * shows directly above it, so the same line reads twice. Returns null when
 * either string contains the other, compared on letters and digits only so
 * punctuation and casing differences cannot hide a duplicate.
 */
function descriptionIfDistinct(location: LocationRecord): string | null {
  const description = location.description?.trim();
  if (!description) return null;

  const normalise = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fromDescription = normalise(description);
  const fromAddress = normalise(location.address ?? "");
  if (!fromAddress) return description;

  return fromDescription.includes(fromAddress) || fromAddress.includes(fromDescription)
    ? null
    : description;
}

export default function GrowthCorridors() {
  const [mapMode, setMapMode] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /**
   * One marker per mappable locality, keyed by location id.
   *
   * A map of "where we operate" should show every locality at once, so the
   * markers are held in a map and reused across renders. Creating them once
   * per selection would tear down and rebuild all of them each time, which
   * resets their internal state and visibly flickers.
   */
  const markersRef = useRef<Map<string, Marker>>(new Map());
  /** The horizontally scrolling locality card row, watched for the counter. */
  const cardRowRef = useRef<HTMLDivElement | null>(null);
  /**
   * The map-mode locality strip, scrolled so the selected row is in view.
   *
   * The selection can change from three places -- the strip itself, a map
   * marker, or opening the map from a card -- so the follow behaviour is keyed
   * on `activeLocationId` rather than on any one control.
   */
  const sidebarListRef = useRef<HTMLUListElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  /** Mirrors mapReady in a ref so the error handler can ignore late tile noise. */
  const mapReadyRef = useRef(false);

  /**
   * Fullscreen map, mirroring `MapSection`.
   *
   * The whole section becomes a fixed overlay rather than the map frame alone,
   * so the sidebar and the section background drop away and the map takes the
   * whole viewport -- the same treatment the developments map gets.
   */
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const mapFullscreenRef = useRef(false);
  mapFullscreenRef.current = mapFullscreen;
  /**
   * Holds the interaction-mode switcher set up inside the map effect.
   *
   * Fullscreen changes which gestures the map accepts, and that switcher is
   * built once when the map is created. Rather than duplicate it, the fullscreen
   * effect calls back through this ref to re-apply it, exactly as `MapSection`
   * does.
   */
  const applyInteractionsRef = useRef<(() => void) | null>(null);

  // Every visible value comes from GET /api/locations. No local demo data.
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationsState, setLocationsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

  /** Property count per locality id, keyed off the real properties response. */
  const [propertyCounts, setPropertyCounts] = useState<Record<string, number>>(
    {},
  );
  /**
   * True once the counts request has settled either way.
   *
   * A locality with no properties has no entry in `propertyCounts`, so the map
   * cannot tell "zero properties" from "not loaded yet" on its own -- without
   * this the count line was skipped on some cards and not others, leaving an
   * empty gap above those cards' buttons.
   */
  const [countsLoaded, setCountsLoaded] = useState(false);

  /**
   * Zero-based index of the locality card currently in view.
   *
   * The card row is a horizontal carousel below `lg`, so this is derived from
   * its scroll offset rather than set by a click -- the visitor moves between
   * cards by swiping.
   */
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  // Properties for the locality opened via the card's Explore action.
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [propertiesTotal, setPropertiesTotal] = useState(0);
  const [propertiesState, setPropertiesState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");

  const [propertiesSlug, setPropertiesSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!propertiesSlug) return;

    const controller = new AbortController();

    fetchPropertiesByLocation({
      locationSlug: propertiesSlug,
      page: PROPERTIES_PAGE,
      perPage: PROPERTIES_PER_PAGE,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setProperties(result.items);
        setPropertiesTotal(result.total);
        setPropertiesState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPropertiesState("error");
        console.warn("[properties] fetch failed", error);
      });

    return () => controller.abort();
  }, [propertiesSlug]);

  /** Returns from the property list to the locality list. */
  const closeProperties = () => {
    setPropertiesSlug(null);
    setPropertiesState("idle");
    setProperties([]);
    setPropertiesTotal(0);
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchLocations({ page, perPage, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;

        setLocations(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setHasNextPage(result.hasNextPage);
        setHasPreviousPage(result.hasPreviousPage);
        setLocationsState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLocationsState("error");
        console.warn("[locations] fetch failed", error);
      });

    return () => controller.abort();
  }, [page, perPage]);

  // No cleanup effect needed: activeLocation is derived from the current page's
  // items, so a selection from a previous page simply stops resolving.

  /**
   * Property counts shown under each locality's address.
   *
   * One request covers the whole page: every row of `GET /api/properties`
   * carries `location_id`, so the counts are grouped here instead of issuing
   * one request per card -- which on a free tunnel this project talks to means
   * dropped connections rather than a slow section.
   *
   * `per_page` is capped at 100, so a tenant with more properties than that
   * would show undercounts rather than a wrong-but-plausible total.
   */
  useEffect(() => {
    if (locations.length === 0) return;

    const controller = new AbortController();

    fetchProperties({
      status: "ALL",
      page: 1,
      perPage: 100,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        const counts: Record<string, number> = {};
        for (const property of result.items) {
          if (!property.location_id) continue;
          counts[property.location_id] =
            (counts[property.location_id] ?? 0) + 1;
        }
        setPropertyCounts(counts);
        setCountsLoaded(true);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Counts are supporting detail, not the card's content: a failure here
        // leaves the card exactly as it was before the line existed.
        console.warn("[locations] property counts unavailable", error);
        // Settled regardless -- every card still shows its fallback line rather
        // than a hole where the count should be.
        setCountsLoaded(true);
      });

    return () => controller.abort();
  }, [locations]);

  /**
   * Keeps the carousel counter in step with the scroll position.
   *
   * The advance per card is measured from the rendered row rather than
   * recomputed from the width rules: the card is `80vw` with a fixed gap below
   * `lg` and a third-of-the-row grid at `lg`, so a hardcoded stride would drift
   * at the breakpoint. `round` means the counter advances when a card is more
   * than half scrolled rather than on the first pixel of movement.
   */
  useEffect(() => {
    const row = cardRowRef.current;
    if (!row) return;

    const syncToScroll = () => {
      const first = row.firstElementChild as HTMLElement | null;
      if (!first || locations.length === 0) return;

      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const advance = first.offsetWidth + gap;
      if (advance <= 0) return;

      const index = Math.round(row.scrollLeft / advance);
      setActiveCardIndex(Math.min(Math.max(index, 0), locations.length - 1));
    };

    // Run once immediately: a restored scroll position or a page change can
    // leave the counter showing a card other than the first.
    syncToScroll();

    row.addEventListener("scroll", syncToScroll, { passive: true });
    window.addEventListener("resize", syncToScroll);
    return () => {
      row.removeEventListener("scroll", syncToScroll);
      window.removeEventListener("resize", syncToScroll);
    };
  }, [locations]);

  /**
   * Keeps the selected locality visible in the map-mode strip.
   *
   * Below `lg` the strip is a horizontal carousel, so selecting a locality
   * from the map left its row off-screen -- or half cut off, since the row is
   * wider than a third of the viewport. `inline: "center"` brings it to the
   * middle of the strip rather than merely nudging it inside the edge, and
   * `block: "nearest"` stops the page itself being scrolled. At `lg` the strip
   * is a vertical list and the same call scrolls it down instead.
   */
  useEffect(() => {
    const list = sidebarListRef.current;
    if (!list || !mapMode || !activeLocationId) return;

    const selected = list.querySelector<HTMLElement>('[aria-pressed="true"]');
    selected?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeLocationId, mapMode]);

  /** Page changes set the loading state here so the effect stays pure. */
  const goToPage = (next: number) => {
    setLocationsState("loading");
    setPage(Math.min(Math.max(1, next), Math.max(1, totalPages)));
  };

  const goToNextPage = () => {
    if (hasNextPage) goToPage(page + 1);
  };

  const goToPreviousPage = () => {
    if (hasPreviousPage) goToPage(page - 1);
  };

  const activeLocation = useMemo(
    () => locations.find((item) => item.id === activeLocationId) ?? null,
    [locations, activeLocationId],
  );

  const mappableLocations = useMemo(
    () => locations.filter(hasCoordinates),
    [locations],
  );

  /**
   * Localities that have listings come first; "Coming soon" ones go last.
   *
   * `Array.prototype.sort` is stable, so the API's own ordering survives
   * inside each group -- the list is partitioned, not reshuffled. Until the
   * counts request answers there is nothing to partition on, so the list is
   * returned untouched and the cards appear in API order. When it settles the
   * grid reorders once, which will move the carousel's scroll position; the
   * counter effect re-reads `scrollLeft` on that same render.
   */
  const sortedLocations = useMemo(() => {
    if (!countsLoaded) return locations;

    return [...locations].sort((a, b) => {
      const aComingSoon = (propertyCounts[a.id] ?? 0) > 0 ? 0 : 1;
      const bComingSoon = (propertyCounts[b.id] ?? 0) > 0 ? 0 : 1;
      return aComingSoon - bComingSoon;
    });
  }, [locations, propertyCounts, countsLoaded]);

  /**
   * Pagination only earns its place once there is more than one page. Every
   * current locality fits inside `perPage`, so the block used to render
   * "Page 1 / 1" with both arrows disabled -- a dead control that read as a
   * bug. Below `lg` the locality list is a horizontal carousel, so the control
   * that survives is a compact counter with arrows, not a per-page selector.
   */
  const hasMultiplePages = total > perPage;

  /**
   * True when every locality in the list carries the same, "active" status.
   *
   * The status pill repeats the word on each card, so when all of them are
   * active it is noise that competes with the name. The pill is then dropped
   * from every card; on a mixed list it stays and carries each card's own
   * value, which is the only way to tell them apart.
   */
  const allLocationsActive = locations.every(
    (item) => item.status?.toUpperCase() === "ACTIVE",
  );

  // Opens the map centred on the first usable location rather than a hardcoded
  // point, so there is no demo coordinate anywhere in this section.
  // Opens the map, defaulting to the first mappable locality so the map and
  // marker are never empty.
  const openMap = (location?: LocationRecord) => {
    const next = location ?? mappableLocations[0] ?? null;
    setActiveLocationId(next ? next.id : null);
    setMapMode(true);
  };

  /**
   * Opens the map with nothing selected, for the header's "View all on map".
   *
   * `openMap()` would highlight the first locality, which is wrong for an
   * action that claims to show all of them. The map effect still falls back to
   * the first mappable location for its centre, but with no active location
   * there is no marker highlight and no overlay card -- the whole layout reads
   * as available.
   */
  const openMapAll = () => {
    setActiveLocationId(null);
    setMapMode(true);
  };

  /**
   * Fullscreen bookkeeping, mirroring `MapSection`.
   *
   * Three things have to happen together: the page behind the overlay must
   * stop scrolling, the map has to accept full gestures (a fullscreen map is
   * the one place free panning makes sense), and MapLibre must be told the
   * container changed size or it keeps painting the old box.
   *
   * The Escape listener is an addition beyond `MapSection`, which has none.
   * Without it a keyboard visitor can enter fullscreen and have no way out
   * except hunting for a small icon.
   */
  useEffect(() => {
    if (!mapFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    const id = window.requestAnimationFrame(() => {
      applyInteractionsRef.current?.();
      mapRef.current?.resize();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(id);
    };
  }, [mapFullscreen]);

  /**
   * Leaving map mode leaves fullscreen too.
   *
   * The section renders as a fixed full-viewport overlay while fullscreen is
   * on, so a fullscreen flag left on while the list view comes back would trap
   * the list inside an overlay with no way out. "View properties" on the detail
   * card is the path that does exactly that.
   */
  useEffect(() => {
    if (!mapMode) setMapFullscreen(false);
  }, [mapMode]);

  useEffect(() => {
    if (!mapMode || !mapContainerRef.current || mapRef.current) return;

    const container = mapContainerRef.current;

    // Absolute worker URL so MapLibre loads correctly when opened via LAN IP.
    // Only reachable here because the effect is client-side, after mount.
    const workerUrl = new URL(
      "/maplibre/maplibre-gl-worker.mjs",
      window.location.origin,
    ).toString();
    setWorkerUrl(workerUrl);

    const focus = activeLocation ?? mappableLocations[0] ?? null;
    const center =
      focus && hasCoordinates(focus)
        ? ([focus.longitude, focus.latitude] as [number, number])
        : ([DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude] as [number, number]);

    // Options mirror `MapSection` so the two homepage maps behave alike:
    // rotation and pitch are switched off (neither map uses a 3D or rotated
    // view, and leaving them on means a stray two-finger drag rotates a map
    // that has no compass to undo it), and the attribution is attached by the
    // constructor rather than added by hand. OpenStreetMap data is
    // ODbL-licensed and requires visible credit; `compact` keeps it to the
    // small collapsed form, sized down by `.maplibregl-ctrl-attrib` in
    // globals.css.
    const map = new MapLibreMap({
      container,
      style: MAP_STYLE,
      center,
      zoom: focus && hasCoordinates(focus) ? LOCATION_ZOOM : DEFAULT_VIEW.zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapRef.current = map;

    // Mobile gestures, matching `MapSection`: while the map is embedded the
    // page keeps its native vertical scroll and the map only claims the
    // horizontal axis. Left alone, MapLibre captures both, so a vertical swipe
    // over the map drags the map sideways-ish instead of scrolling the page and
    // a phone visitor cannot get past the section at all.
    //
    // `touch-action: pan-y` (`.ila-corridor-map-frame` in globals.css) hands
    // vertical panning back to the browser. The listeners below then pan
    // horizontally by hand, because enabling `dragPan` would take both axes
    // back. Fullscreen is the one place free panning is right, so it flips the
    // whole thing back on.
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

      // The axis is settled once, on the first move out of the 8px dead zone,
      // and held for the rest of the gesture. The 1.15 bias keeps a near
      // diagonal swipe from flip-flopping between the two and stuttering.
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

    const clearTouchListeners = () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };

    const applyInteractions = () => {
      clearTouchListeners();
      const isMobile = mobileQuery.matches;
      const fullscreen = mapFullscreenRef.current;

      if (isMobile && !fullscreen) {
        // Embedded on a phone: the page scrolls, the map pans sideways.
        map.dragPan.disable();
        map.touchZoomRotate.enable();
        map.touchZoomRotate.disableRotation();
        map.dragRotate.disable();
        map.touchPitch.disable();
        setMobileTouchAction(true);
        canvas.addEventListener("touchstart", onTouchStart, { passive: true });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd, { passive: true });
        canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
        return;
      }

      // Desktop, or fullscreen on a phone: the map behaves freely again.
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.dragRotate.disable();
      map.touchPitch.disable();
      if (isMobile) {
        map.touchZoomRotate.disableRotation();
      } else {
        map.touchZoomRotate.enableRotation();
      }
      setMobileTouchAction(false);
    };

    applyInteractionsRef.current = applyInteractions;
    applyInteractions();
    mobileQuery.addEventListener("change", applyInteractions);

    // A style or worker failure leaves an empty canvas with no visual signal,
    // which is indistinguishable from "still loading". Surface it instead.
    map.on("error", (event) => {
      console.error("[ILA map] growth corridors map error", event.error);
      if (!mapReadyRef.current) setMapError(true);
    });

    map.on("load", () => {
      mapReadyRef.current = true;
      setMapReady(true);
      setMapError(false);
      map.resize();
    });

    /**
     * MapLibre measures its container once, at construction, and then keeps
     * that pixel size for its canvas. On mobile this container is sized by a
     * `flex-1`/`min-h-[46vh]` column that has often not settled by the time
     * the effect runs, so the map can be built at zero height and stay
     * invisible. These listeners re-measure whenever the box actually changes:
     * late layout, the mobile URL bar collapsing, orientation, and the desktop
     * sidebar appearing. Mirrors the handling in `MapSection`.
     */
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => map.resize())
        : null;
    resizeObserver?.observe(container);

    const onWindowResize = () => map.resize();
    const onOrientationChange = () => {
      window.setTimeout(() => map.resize(), 120);
    };

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onOrientationChange);
    window.requestAnimationFrame(() => map.resize());

    return () => {
      clearTouchListeners();
      mobileQuery.removeEventListener("change", applyInteractions);
      applyInteractionsRef.current = null;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onOrientationChange);
      for (const marker of markersRef.current.values()) marker.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
      setMapReady(false);
    };
    // Intentionally runs only when the map is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode]);

  /**
   * Keeps a marker on the map for every mappable locality, marks the selected
   * one, and frames or zooms depending on how the map was opened.
   *
   * Markers are created once and then only have their active class toggled, so
   * a selection change costs no DOM work. `textContent` sets the label rather
   * than interpolating into `innerHTML`, which would parse the API's name as
   * markup.
   *
   * "View all on map" leaves nothing selected, so the view frames every
   * locality; opening from a card selects that locality and zooms to it.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapMode) return;

    const seen = new Set<string>();

    for (const location of mappableLocations) {
      if (!hasCoordinates(location)) continue;
      seen.add(location.id);

      let marker = markersRef.current.get(location.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "ila-corridor-marker";
        el.innerHTML =
          '<span class="ila-corridor-marker__dot"></span><span class="ila-corridor-marker__label"></span>';
        const label = el.querySelector(".ila-corridor-marker__label");
        if (label) label.textContent = location.name;

        el.addEventListener("click", () => setActiveLocationId(location.id));

        marker = new Marker({ element: el, anchor: "bottom" })
          .setLngLat([location.longitude, location.latitude])
          .addTo(map);

        markersRef.current.set(location.id, marker);
      }

      marker
        .getElement()
        ?.classList.toggle(
          "ila-corridor-marker--active",
          location.id === activeLocationId,
        );
    }

    // Drop markers for localities no longer in the response.
    for (const [id, marker] of markersRef.current) {
      if (seen.has(id)) continue;
      marker.remove();
      markersRef.current.delete(id);
    }

    if (!activeLocation) {
      // Nothing selected: frame every locality rather than opening on one.
      const bounds = new LngLatBounds();
      let hasAny = false;
      for (const location of mappableLocations) {
        if (!hasCoordinates(location)) continue;
        bounds.extend([location.longitude, location.latitude]);
        hasAny = true;
      }

      if (hasAny) {
        map.fitBounds(bounds, {
          padding: 64,
          maxZoom: DEFAULT_VIEW.zoom,
          duration: 900,
        });
      }
      return;
    }

    if (!hasCoordinates(activeLocation)) return;

    map.easeTo({
      center: [activeLocation.longitude, activeLocation.latitude],
      zoom: LOCATION_ZOOM,
      duration: 900,
    });
  }, [activeLocation, mapReady, mapMode, mappableLocations]);

  const selectLocation = (location: LocationRecord) => {
    setActiveLocationId(location.id);

    trackEvent({
      event_type: "MAP_MARKER_CLICK",
      metadata: {
        location_id: location.id,
        location_slug: location.slug,
        section_type: "growth_corridors",
      },
    });

    // Fetch the locality's properties and show them in place of the list.
    setPropertiesState("loading");
    setPropertiesSlug(location.slug);
  };

  /**
   * Leaves the map and shows this locality's properties.
   *
   * The map has no listing of its own, so this reuses the card view's flow
   * rather than building a second one: `selectLocation` loads the properties
   * and tracks the click, and the map is closed so the result is actually
   * visible.
   */
  const viewProperties = (location: LocationRecord) => {
    selectLocation(location);
    setMapMode(false);
  };

  /**
   * Zoom step, matching `MapSection`: an eased one-step move rather than
   * MapLibre's built-in NavigationControl, so both homepage maps zoom at the
   * same rate and animate the same way.
   */
  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 250 });
  };

  /**
   * Map detail card content, resolved once per render.
   *
   * `detail` drops a description that merely repeats the address.
   * `directionsUrl` is null for a locality with no usable coordinates, which
   * is also why the marker cannot exist for it.
   */
  const detail = activeLocation ? descriptionIfDistinct(activeLocation) : null;
  const directionsUrl =
    activeLocation && hasCoordinates(activeLocation)
      ? `https://www.google.com/maps/dir/?api=1&destination=${activeLocation.latitude},${activeLocation.longitude}`
      : null;

  return (
    <section
      data-section="growth_corridors"
      id="services"
      className={
        mapFullscreen
          ? "growth-corridors fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-[#eceef2]"
          : "growth-corridors relative w-full overflow-hidden bg-[#eceef2]"
      }
      aria-label="Hyderabad growth corridors"
      style={{ ["--gc-gold" as string]: GOLD }}
    >
      {/* Decorative background grid. See `.growth-corridors-bg` in
          globals.css, where the opacity lives so it fades this layer only
          and never the heading, cards or buttons. */}
      <div
        aria-hidden="true"
        className="growth-corridors-bg pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

        {/* Map mode goes edge to edge: the list and map manage their own insets.

          List mode uses one side margin at every breakpoint rather than the
          24/32/48 ramp, so the heading, the "x localities" line and the card
          row all start on the same left edge and stay there when the viewport
          changes. Vertical padding is symmetric and larger than before -- the
          old 40px left the section feeling crowded against its neighbours. */}
        {/* Desktop: the whole section is sized to one screen and the grid absorbs
          whatever is left, so all seven localities plus the map tile are
          visible without scrolling. `min-h` rather than `h`, so a short
          viewport grows the section and scrolls the page instead of clipping
          content. `--nav-h` keeps the bottom clear of the fixed nav.

          Left-aligned: the column starts from the left edge rather than floating in
          the middle of a wide screen. The `max-w-7xl` cap (1280px) stays, so
          the leftover space falls on the right only -- the two views share this
          container, which is what makes the sidebar and card row line up when
          the user switches.

          The nav is `sticky`, not fixed, so it stays in flow and this height is
          `100svh` minus the nav -- the section ends flush with the viewport
          bottom rather than reserving space for an overlay. List mode keeps a
          generous top and a small bottom, handing the extra height to the grid
          so all seven localities and the map tile fit without scrolling.

          Map mode drops the `max-w-7xl` cap so the map takes the full width
          available rather than stopping at the cap and leaving a dead strip on
          the right. The left gutter (`px-6 sm:px-10`) is unchanged, so the
          sidebar still starts on the same line as the card view's heading and
          grid even though the two views now end at different edges. */}
      <div
        className={
          mapMode
            ? mapFullscreen
              // Fullscreen drops the gutter and the screen-height min-height:
              // the section is already a fixed overlay, so the slot just needs
              // to fill it and let the map take what is left.
              ? "content-slot relative flex w-full flex-1 flex-col"
              : "content-slot relative w-full px-6 sm:px-10 lg:flex lg:min-h-[calc(100svh-var(--nav-h))] lg:flex-col"
            : "content-slot relative w-full max-w-7xl px-6 py-16 sm:px-10 sm:py-24 lg:flex lg:min-h-[calc(100svh-var(--nav-h))] lg:flex-col lg:justify-center lg:pt-10 lg:pb-6 xl:pt-12"
        }
      >
        {!mapMode ? (
          <>
            {/* Two columns on desktop: the heading block on the left, and the locality
                count plus a map action on the right, bottom-aligned to the
                heading's baseline so the row reads as one band rather than a
                heading with something floating beside it. Mobile keeps the
                single-column stack. */}
            <header className="lg:flex lg:items-end lg:justify-between lg:gap-12 lg:shrink-0">
              <div className="max-w-xl">
                <p className="text-[10px] font-bold tracking-[0.22em] text-[#8A6A1F] uppercase">
                  {SECTION_EYEBROW}
                </p>
                <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.01em] text-balance text-[#0f1114] lg:text-[32px]">
                  Explore the locations shaping Hyderabad&rsquo;s next phase
                </h2>
              </div>

              {/* Desktop only -- on mobile the same count and the carousel
                  counter sit above the card row instead. */}
              {locations.length > 0 ? (
                <div className="mt-6 hidden items-center gap-5 lg:flex lg:shrink-0">
                  <p className="text-[13px] font-medium text-[#4a5060]">
                    {locations.length}{" "}
                    {locations.length === 1 ? "locality" : "localities"}
                  </p>
                  <button
                    type="button"
                    onClick={openMapAll}
                    data-track="MAP_MARKER_CLICK"
                    data-track-meta={`{"section_type":"growth_corridors","surface":"header"}`}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-[#8A6A1F] bg-transparent px-4 text-[13px] font-bold tracking-[0.02em] text-[#0f1114] uppercase transition hover:bg-[#8A6A1F]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F] active:scale-[0.98]"
                  >
                    <MapIcon className="h-4 w-4 shrink-0" />
                    View all on map
                  </button>
                </div>
              ) : null}
            </header>

            {propertiesSlug ? (
              <div className="mt-8" aria-live="polite">
                <button
                  type="button"
                  onClick={closeProperties}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0f1114] px-4 py-2.5 text-[10px] font-semibold tracking-[0.14em] text-white uppercase transition hover:bg-[#2a2e38]"
                >
                  &larr; Back to localities
                </button>

                <p className="mt-5 text-[10px] font-semibold tracking-[0.18em] text-[#8A6A1F] uppercase">
                  Properties in {locations.find((l) => l.slug === propertiesSlug)?.name ?? propertiesSlug}
                </p>

                {propertiesState === "loading" ? (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#4a5060]">
                    <span className="ila-loader ila-loader--sm" aria-hidden />
                    Loading properties&hellip;
                  </p>
                ) : null}

                {propertiesState === "error" ? (
                  <p className="mt-3 text-sm text-[#4a5060]">
                    Properties are unavailable right now. Please try again shortly.
                  </p>
                ) : null}

                {propertiesState === "ready" && properties.length === 0 ? (
                  <p className="mt-3 text-sm text-[#4a5060]">
                    No properties listed in this locality yet.
                  </p>
                ) : null}

                {properties.length > 0 ? (
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {properties.map((property) => (
                      <li key={property.id}>
                        <Link
                          href={`/properties/${property.id}`}
                          data-track="PROPERTY_VIEW"
                          data-track-property={property.id}
                          data-track-meta={`{"source":"growth_corridors","location_slug":"${propertiesSlug}"}`}
                          className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1b1d22] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[#c9a84c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
                        >
                          {/* Property cover image from the location-filtered properties
                              response. Only rendered when the API supplies
                              one. */}
                          {property.cover_url ? (
                            <div aria-hidden className="absolute inset-0 z-0">
                              <Image
                                src={property.cover_url}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                unoptimized
                                onError={(event) => {
                                event.currentTarget.parentElement?.style.setProperty(
                                  "display",
                                  "none",
                                );
                              }}
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/62 to-black/45" />
                            </div>
                          ) : null}

                          <div className="relative z-10 flex flex-1 flex-col">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-base font-semibold tracking-tight text-white">
                                {property.name}
                              </h3>
                              {property.property_type ? (
                                <span className="shrink-0 rounded-full bg-white/20 px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-white uppercase">
                                  {property.property_type}
                                </span>
                              ) : null}
                            </div>

                            {property.description ? (
                              <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/85">
                                {property.description}
                              </p>
                            ) : null}

                            <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/20 pt-4">
                              <span className="text-[9px] font-semibold tracking-[0.16em] text-white/70 uppercase">
                                Price
                              </span>
                              <span className="shrink-0 text-base font-semibold text-[#c9a84c]">
                                {formatPrice(property.price)}
                              </span>
                            </div>

                            <span className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] text-white uppercase transition group-hover:gap-2.5">
                              View details
                              <ArrowIcon className="h-3 w-3" />
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {propertiesState === "ready" ? (
                  <p className="mt-4 text-[10px] font-semibold tracking-[0.18em] text-[#4a5060] uppercase">
                    Showing {properties.length} of {propertiesTotal} properties
                  </p>
                ) : null}
              </div>
            ) : null}

            {!propertiesSlug && locationsState === "loading" ? (
              <p className="mt-8 inline-flex items-center gap-2 text-sm text-[#4a5060]">
                <span className="ila-loader ila-loader--sm" aria-hidden />
                Loading localities&hellip;
              </p>
            ) : null}

            {!propertiesSlug && locationsState === "error" ? (
              <p className="mt-8 text-sm text-[#4a5060]">
                Localities are unavailable right now. Please try again shortly.
              </p>
            ) : null}

            {!propertiesSlug && locationsState === "ready" && locations.length === 0 ? (
              <p className="mt-8 text-sm text-[#4a5060]">
                No localities to show right now.
              </p>
            ) : null}

            {!propertiesSlug && locations.length > 0 ? (
              <>
                {/* Count on the left, carousel position on the right. The old
                    "Showing 7 of 7 localities &middot; Page 1 of 1" repeated itself
                    and asserted a page number for a carousel that does not
                    paginate. */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#4a5060]">
                    {locations.length}{" "}
                    {locations.length === 1 ? "locality" : "localities"}
                  </p>
                  <p className="text-[13px] font-medium tabular-nums text-[#4a5060] lg:hidden">
                    {activeCardIndex + 1} / {locations.length}
                  </p>
                </div>

                {/* Location cards -- all fields from the API response.
                    mt-8 matches the heading-to-meta gap above; the row used
                    to sit at mt-3, which read as a tighter break between two
                    blocks that belong together. */}
                <div
                  ref={cardRowRef}
                  className="-mx-6 mt-12 flex items-stretch gap-6 overflow-x-auto px-6 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:mt-8 lg:min-h-0 lg:flex-1 lg:auto-rows-fr lg:grid-cols-3 xl:grid-cols-4"
                >
                  {sortedLocations.map((location, index) => {
                    const isActive = location.id === activeLocationId;
                    const mappable = hasCoordinates(location);
                    const displayAddress = addressWithoutName(location);
                    const propertyCount = propertyCounts[location.id];
                    // No count yet, or none to show: the card has nothing
                    // behind Explore, so the gold primary is withheld.
                    const isComingSoon = !countsLoaded || !propertyCount;

                    return (
                      <article
                        key={location.id}
                        className={`group relative flex w-[80vw] min-h-64 shrink-0 flex-col overflow-hidden rounded-2xl border p-6 text-left transition duration-300 sm:w-auto lg:min-h-0 lg:h-full lg:p-5 ${
                          isActive
                            ? "border-[#c9a84c] bg-[#241f14]"
                            : "border-white/15 bg-[#1b1d22] hover:-translate-y-1 hover:border-[#c9a84c]"
                        }`}
                      >
                        {/* Locality cover image from GET /api/locations, used as the
                            card background. Rendered only when the API supplies
                            one -- most localities return cover_url: null, and
                            those cards fall back to their own dark surface
                            rather than a stock image. The article already
                            clips its own rounded corners, so no extra wrapper
                            is needed. */}
                        {location.cover_url ? (
                          <div aria-hidden className="absolute inset-0 z-0">
                            <Image
                              src={location.cover_url}
                              alt=""
                              fill
                              sizes="(min-width: 1024px) 33vw, 80vw"
                              // Presigned cover URLs expire, so they are loaded
                              // directly rather than through the optimizer cache.
                              unoptimized
                              // A presigned URL past its 3600s expiry answers 403.
                              // The whole layer goes, not just the <img>: the
                              // scrim below is a sibling, so hiding only the
                              // image left from-black/90 sitting over the card's
                              // own dark surface -- a near-black hole that read
                              // as a broken card rather than the intended
                              // fallback.
                              onError={(event) => {
                                event.currentTarget.parentElement?.style.setProperty(
                                  "display",
                                  "none",
                                );
                              }}
                              className="object-cover"
                            />
                            {/* Dark scrim keeps the card copy above 4.5:1 over
                                any photo. */}
                            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/62 to-black/45" />
                          </div>
                        ) : null}

                        {/* Gold rail marks the selected locality. */}
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 z-20 w-[3px] transition-opacity ${
                            isActive ? "bg-[#c9a84c] opacity-100" : "opacity-0"
                          }`}
                        />

                        <div className="relative z-10 flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c9a84c] text-[11px] font-bold tabular-nums tracking-wide text-[#c9a84c]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {/* Status is not surfaced on mobile: the card already reads
                            index, name, address and the action, and the pill
                            competes with the enlarged heading. It is also
                            dropped entirely when every locality shares the
                            same active status, since a repeated word on every
                            card is noise rather than information. */}
                            {!allLocationsActive && location.status ? (
                              <span className="hidden rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white uppercase sm:inline-block">
                                {location.status}
                              </span>
                            ) : null}
                          </div>

                          {/* Card titles are set heavier and larger than the section
                              heading -- 700 at 26px against 600 at 24px -- so the
                              locality reads as the card's anchor. Both sizes are
                              fixed rather than responsive: a ramp would make
                              the section heading the larger text again at `lg`. */}
                          <h3 className="mt-4 text-[26px] font-bold tracking-tight text-white">
                            {location.name}
                          </h3>

                          {/* Address is supporting detail, so it is regular
                              weight at 14px and held back to 70% opacity. It
                              wraps to two lines rather than running to four,
                              which kept the card far taller than its
                              neighbours in the grid. The locality name is
                              stripped from the front by `addressWithoutName`,
                              since the heading above already states it. */}
                          {displayAddress ? (
                            <p className="mt-2.5 flex items-start gap-1.5 text-[14px] leading-relaxed font-normal text-white/70">
                              <PinIcon className="mt-1 h-4 w-4 shrink-0 text-[#c9a84c]" />
                              <span className="line-clamp-2 min-w-0">{displayAddress}</span>
                            </p>
                          ) : null}

                          {/* Real count from the properties response, not a
                              placeholder. Always rendered so every card
                              reserves the same line; the count itself appears
                              once the request settles. Sentence case at 13px
                              with no tracking: the number carries 700 gold and
                              the word 500 white/60, so the figure reads first
                              without the whole line shouting. */}
                          <p className="mt-1.5 flex items-baseline gap-1.5 text-[13px]">
                            {!isComingSoon ? (
                              <>
                                <span className="font-bold text-[#c9a84c]">
                                  {propertyCount}
                                </span>
                                <span className="font-medium text-white/60">
                                  {propertyCount === 1
                                    ? "property"
                                    : "properties"}
                                </span>
                              </>
                            ) : (
                              <span className="font-medium text-white/60">
                                Coming soon
                              </span>
                            )}
                          </p>

                          {/* Actions stay compact against the 24px card title: a short gold primary plus a quieter map control beside
                              it, instead of one oversized full-width button.
                              Both buttons share `h-11 px-2 rounded-full` so they
                              are the same 44px tall with identical padding and
                              corners. `mt-auto` pins the row to the bottom so
                              every card's actions align, and pt-5 guarantees a
                              gap above them -- mt-auto alone collapses to zero
                              once the card has no free space left, which is what
                              made the button collide with the address.

                              Width: Explore is `flex-1` and takes whatever the
                              row leaves over; Map is `shrink-0` and keeps to its
                              own label plus icon. `whitespace-nowrap` on both
                              stops the label breaking or ellipsising -- the card
                              used to clip "Explore" because the two buttons
                              together were wider than the card's inner width.
                              Explore drops `min-w-0` so it can no longer be
                              squeezed below the width its own text needs. */}
                          <div className="mt-auto flex items-center gap-3 pt-5">
                            <button
                              type="button"
                              onClick={() => selectLocation(location)}
                              disabled={!mappable}
                              aria-label={`View ${location.name} on map`}
                              data-track="MAP_MARKER_CLICK"
                              data-track-meta={`{"location_id":"${location.id}","location_slug":"${location.slug}","section_type":"growth_corridors"}`}
                              className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-bold tracking-[0.02em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:cursor-not-allowed ${
                                isComingSoon
                                  ? "border border-white/30 bg-transparent text-white hover:bg-white/10 focus-visible:outline-[#c9a84c] disabled:border-white/15 disabled:text-white/60"
                                  : "bg-[#c9a84c] text-[#0f1114] hover:bg-[#d4b57e] focus-visible:outline-[#0f1114] disabled:bg-white/15 disabled:text-white/60"
                              }`}
                            >
                              <span>
                                {mappable ? "Explore" : "No map location"}
                              </span>
                              {mappable ? (
                                <ArrowIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                              ) : null}
                            </button>

                            {/* Rendered only for mappable localities so the row
                                never shows a dead control, and the primary takes
                                the full width when the map control is absent. */}
                            {mappable ? (
                              <button
                                type="button"
                                onClick={() => openMap(location)}
                                aria-label={`Show ${location.name} on the map`}
                                data-track="MAP_MARKER_CLICK"
                                data-track-meta={`{"location_id":"${location.id}","location_slug":"${location.slug}","section_type":"growth_corridors","surface":"card_map"}`}
                                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 bg-transparent px-4 text-[13px] font-bold tracking-[0.02em] text-white uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c] active:scale-[0.98]"
                              >
                                <MapIcon className="h-4 w-4 shrink-0" />
                                Map
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {/* Eighth tile. At four columns a set of seven localities
                      leaves one empty cell and a ragged half row; this fills
                      it and doubles as a second way into map mode, next to
                      the header's "View all on map". Always rendered rather
                      than only when the count happens to leave a gap -- which
                      columns the grid is using is a CSS decision, and a
                      JS-computed fill would be wrong at every breakpoint but
                      one. */}
                  <button
                    type="button"
                    onClick={openMapAll}
                    data-track="MAP_MARKER_CLICK"
                    data-track-meta={`{"section_type":"growth_corridors","surface":"grid_cta"}`}
                    className="group flex min-h-64 w-[80vw] shrink-0 flex-col items-center justify-center gap-4 rounded-2xl border border-[#1b1d22]/25 bg-transparent p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-[#8A6A1F] hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F] active:scale-[0.98] sm:w-auto lg:min-h-0 lg:h-full lg:p-5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#1b1d22]/20 transition group-hover:border-[#8A6A1F]">
                      <MapIcon className="h-5 w-5 text-[#1b1d22] transition group-hover:text-[#8A6A1F]" />
                    </span>
                    <span className="max-w-56 text-[13px] font-bold uppercase leading-relaxed tracking-[0.02em] text-[#0f1114]">
                      See all corridors on the map
                    </span>
                    <ArrowIcon className="h-4 w-4 shrink-0 text-[#8A6A1F] transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                {/* Pagination. Hidden entirely on a single page, where the old
                    block always showed "Page 1 / 1" with both arrows disabled.
                    Retained as a centred carousel counter so it stays reachable
                    if a tenant ever exceeds `perPage` localities. */}
                {hasMultiplePages ? (
                  <nav
                    className="mt-6 flex items-center justify-center gap-3"
                    aria-label="Localities pagination"
                  >
                    <button
                      type="button"
                      onClick={goToPreviousPage}
                      disabled={!hasPreviousPage || locationsState === "loading"}
                      aria-label="Previous page"
                      className="rounded-full border border-black/12 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#0f1114] transition hover:border-[#8A6A1F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      &larr; Previous
                    </button>

                    <span className="text-[11px] font-semibold tabular-nums text-[#4a5060]">
                      {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={goToNextPage}
                      disabled={!hasNextPage || locationsState === "loading"}
                      aria-label="Next page"
                      className="rounded-full border border-black/12 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#0f1114] transition hover:border-[#8A6A1F] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next &rarr;
                    </button>
                  </nav>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          // Map mode swaps out the whole heading block, which left the visitor with no
          // indication of which section they were in. The eyebrow is repeated
          // above the sidebar and map -- the heading itself stays out of the way
          // because the map needs the vertical room.
          <>
            <p
              className={
                mapFullscreen
                  ? "hidden"
                  : "pb-4 pt-6 text-[10px] font-bold tracking-[0.22em] text-[#8A6A1F] uppercase lg:shrink-0 lg:pb-4 lg:pt-8"
              }
            >
              {SECTION_EYEBROW}
            </p>

            {/* Owns its own insets because the section padding is dropped in map
          mode. Its old `lg:px-12` is gone: the centred container above now
          carries the side gutter, and both together doubled it on desktop.
          `lg:flex-1 lg:min-h-0` lets the map fill the screen-height section
          instead of sitting at a fixed 75vh inside it. `pb-4 lg:pb-6` keeps
          both the sidebar and the map off the section's bottom edge, so
          neither panel runs flush into the footer. */}
            {/* `gap-4` (16px) between every block here -- eyebrow to strip, strip to
          map on mobile, sidebar to map on desktop. It previously stepped 10 /
          12 / 20px across breakpoints, which read as an uneven column. */}
            <div
            className={
              mapFullscreen
                ? "flex min-h-0 flex-1 flex-row"
                : "flex min-h-[62vh] flex-col gap-4 pb-4 sm:pb-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:pb-6"
            }
          >
            {/* Locations list -- left on desktop, full-bleed strip on mobile */}
            {/* Full-bleed on mobile: `-mx-6` cancels the container's own side padding so
                  the strip runs to the screen edge instead of stopping short of
                  it, which made it read as a box with the next card sliced in
                  half. The 24px gutter moves onto the strip itself, so cards
                  still start on the same line as the top bar. */}
              <aside
              className={
                mapFullscreen
                  ? "hidden"
                  : "shrink-0 -mx-6 lg:mx-0 lg:flex lg:w-75 lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-black/8 lg:bg-white lg:px-0 lg:shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
              }
              aria-label="Localities"
            >
              {/* Mobile bar: back + count */}
              <div className="flex items-center justify-between gap-3 px-6 pb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMapMode(false)}
                  className="-ml-1 inline-flex items-center gap-1.5 rounded-full bg-black/6 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase"
                >
                  <ArrowIcon className="h-3 w-3 rotate-180" />
                  Back
                </button>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#4a5060] uppercase">
                  {mappableLocations.length} localities
                </p>
              </div>

              {/* Desktop header */}
              <div className="hidden items-center justify-between gap-3 border-b border-black/8 px-5 py-4 lg:flex">
                <h3 className="text-base font-semibold tracking-tight text-[#0f1114]">
                  Localities
                </h3>
                <span className="shrink-0 rounded-full bg-[#0f1114]/6 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#4a5060] uppercase">
                  {mappableLocations.length}
                </span>
              </div>

              {/* Edge-to-edge horizontal strip on mobile, vertical list on desktop.
                  `scroll-pl-6` mirrors the `px-6` gutter: without it the
                  snap positions are measured from the raw scrollport edge, so
                  `snap-mandatory` parks the first card flush against the
                  screen and the left margin disappears the moment the strip is
                  touched. Reset at `lg`, where the list scrolls vertically and
                  the panel's own `px-5` does the insetting. */}
              <ul
                ref={sidebarListRef}
                className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-6 pb-1 scrollbar-none lg:flex-col lg:divide-y lg:divide-black/6 lg:overflow-y-auto lg:px-0 lg:pb-0 scroll-pl-6 lg:scroll-pl-0"
              >
                {mappableLocations.map((location) => {
                  const isActive = location.id === activeLocationId;

                  return (
                    <li
                      key={location.id}
                      className="w-[68vw] max-w-[230px] shrink-0 snap-start sm:w-[46vw] sm:max-w-65 lg:w-auto lg:max-w-none lg:shrink"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveLocationId(location.id)}
                        aria-pressed={isActive}
                        data-track="MAP_MARKER_CLICK"
                        data-track-meta={`{"location_id":"${location.id}","location_slug":"${location.slug}","section_type":"growth_corridors","surface":"map_sidebar"}`}
                        className={`relative flex h-full w-full flex-col gap-1.5 overflow-hidden rounded-2xl p-3.5 text-left transition active:scale-[0.98] lg:flex-row lg:items-baseline lg:gap-3 lg:rounded-none lg:p-0 lg:px-5 lg:py-4 lg:active:scale-100 ${
                          isActive
                            ? "bg-[#0f1114] text-white shadow-[0_8px_20px_rgba(15,17,20,0.18)]"
                            : "bg-white text-[#0f1114] shadow-[0_2px_10px_rgba(15,17,20,0.06)] hover:bg-black/4 lg:bg-transparent lg:text-inherit lg:shadow-none lg:hover:bg-black/5"
                        }`}
                      >
                        {/* Same 3px gold rail the locality cards use, so the
                            selected state reads identically in both views.
                            Inside the button so `overflow-hidden` keeps it
                            inside the rounded corners on mobile, and the
                            desktop rule drops the radius so it sits flush
                            against the panel edge. */}
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 z-10 w-[3px] bg-[#c9a84c] transition-opacity ${
                            isActive ? "opacity-100" : "opacity-0"
                          }`}
                        />

                        <span className="flex w-full items-center justify-between gap-2 lg:contents">
                          <span
                            className={`truncate text-sm font-semibold tracking-tight ${
                              isActive ? "text-white" : "text-[#0f1114]"
                            }`}
                          >
                            {location.name}
                          </span>

                          {/* Marks the selected locality and nothing else. It
                              previously rendered on every row in the same
                              gold, so it carried no information. */}
                          {isActive ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[#c9a84c] lg:order-last lg:self-center"
                              aria-hidden
                            />
                          ) : null}
                        </span>

                        {/* Property count from the real counts response,
                            replacing the raw "17.31065, 78.53988" pair.
                            Coordinates meant nothing to a buyer and read as
                            low-contrast noise; the count is the same figure
                            the card view shows, so the two views agree. */}
                        <span
                          className={`truncate text-[10px] tracking-wide ${
                            isActive ? "text-white/60" : "text-[#4a5060]"
                          }`}
                        >
                          {propertyCounts[location.id]
                            ? `${propertyCounts[location.id]} ${
                                propertyCounts[location.id] === 1
                                  ? "property"
                                  : "properties"
                              }`
                            : "Coming soon"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop only. The list is shorter than the panel, so this
                  takes the empty space at the bottom and gives the map view
                  the same way out the card view's "&larr; Back" row provides. */}
              <div className="hidden shrink-0 border-t border-black/8 p-5 lg:block">
                <button
                  type="button"
                  onClick={() => setMapMode(false)}
                  className="inline-flex min-h-11 items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#4a5060] uppercase transition hover:text-[#8A6A1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F]"
                >
                  <ArrowIcon className="h-3 w-3 rotate-180" />
                  Back to localities
                </button>
              </div>
            </aside>

            {/* Map -- full-bleed on mobile, inset card beside the list on desktop.
                MapLibre adds `position: relative` to its container, which beats
                the `absolute` utility, so this frame needs a definite height for
                the container's `h-full` to resolve. In the mobile auto-height
                column `flex-1` + `min-h` left it indefinite and the map built at
                zero height; an explicit height fixes it while desktop keeps the
                stretched flex item. */}
            {/* Same radius and the same shadow as the sidebar, so the two panels read as
                one pair rather than one raised card beside one outlined one.
                Previously the sidebar had the soft shadow and the map had a
                border only. */}
            {/* On mobile this frame is a column: the map fills the top and the selected
                locality's details sit below it as their own block. The card
                used to overlay the bottom of the map, where on a ~340px tall
                map it covered about 40% and pushed the marker up against its
                own edge. At `lg` the frame goes back to a plain block and the
                card re-attaches as an overlay, where there is room for it. */}
            <div
              className={
                mapFullscreen
                  ? "ila-corridor-map-frame ila-corridor-map-frame--fullscreen relative block flex-1 overflow-hidden bg-[#dfe3ea]"
                  : "ila-corridor-map-frame relative flex flex-col overflow-hidden rounded-[18px] bg-[#dfe3ea] lg:block lg:h-auto lg:flex-1 lg:min-h-0 lg:border lg:border-black/8 lg:shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
              }
            >
              <div
              className={
                mapFullscreen
                  ? "relative h-full w-full"
                  : "relative h-[58vh] flex-none lg:absolute lg:inset-0 lg:h-full"
              }
            >
              {/* Desktop only. Below `lg` the sidebar's own top bar carries the same
                  action beside the locality count, so a second Back floating
                  over the map was redundant -- and it sat on top of the map
                  surface the visitor came to look at. Fullscreen is the
                  exception: the sidebar is hidden there, so this becomes the
                  only way out and has to show at every width. */}
              <button
                type="button"
                onClick={() =>
                  mapFullscreen ? setMapFullscreen(false) : setMapMode(false)
                }
                className={`absolute left-3 top-3 z-20 items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase shadow-[0_4px_16px_rgba(15,17,20,0.14)] backdrop-blur-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F] ${mapFullscreen ? "inline-flex" : "hidden lg:inline-flex"}`}
                aria-label={
                  mapFullscreen ? "Exit fullscreen map" : "Back to locations"
                }
              >
                <span aria-hidden>&larr;</span>
                Back
              </button>

              <div
                ref={mapContainerRef}
                className="absolute inset-0 h-full w-full"
              />

              {/* Zoom controls, styled to match `MapSection` exactly: 40px
                  squares, `#d9d2c7` panel, `#171717` glyphs, `#cfc3a8` hover.
                  Only the corner differs -- `MapSection` sits them bottom-right
                  and lifts them above its project card, whereas here the
                  selected locality's card owns bottom-right from `lg` up, so
                  they stay top-right where nothing can collide with them. */}
              <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col gap-1.5 sm:right-4">
                {!mapFullscreen ? (
                  <button
                    type="button"
                    aria-label="Open map fullscreen"
                    onClick={() => setMapFullscreen(true)}
                    className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-black/15 bg-[#d9d2c7] text-[#171717] shadow-[0_8px_20px_rgba(15,23,42,0.14)] transition hover:bg-[#cfc3a8]"
                  >
                    <ExpandIcon className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="pointer-events-auto overflow-hidden rounded-lg border border-black/15 bg-[#d9d2c7] shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
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
                    &minus;
                  </button>
                </div>
              </div>

              {/* Loading and failure states. Without these a worker or style
                  failure leaves an empty grey box that reads as "still
                  loading" and can never be diagnosed from the UI. */}
              {!mapReady && !mapError ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-[#4a5060] uppercase shadow-[0_4px_16px_rgba(15,17,20,0.12)]">
                    <span className="ila-loader ila-loader--sm" aria-hidden />
                    Loading map
                  </span>
                </div>
              ) : null}

              {mapError ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#dfe3ea] px-6 text-center">
                  <p className="max-w-sm text-sm font-medium leading-relaxed text-[#4a5060]">
                    The map could not load on this device. Check that the phone
                    is on the same network as this site, then reload the page.
                  </p>
                </div>
              ) : null}
              </div>

              {/* Below `lg` this flows under the map; at `lg` it re-attaches as
                  an overlay in the map's bottom-right. Either way the marker
                  is no longer hidden behind it, so the map's centre needs no
                  upward offset to keep the pin in view. */}
              {activeLocation ? (
                <div
                  className={
                    mapFullscreen
                      ? // Fullscreen has no room below the map, so the card is an
                        // overlay at every width, not just at `lg`.
                        "absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-[18px] bg-[#1b1d22] p-4 shadow-[0_8px_30px_rgba(15,17,20,0.12)] lg:inset-x-auto lg:right-3 lg:max-w-sm"
                      : "shrink-0 overflow-hidden bg-[#1b1d22] p-4 lg:absolute lg:inset-x-auto lg:right-3 lg:bottom-3 lg:z-10 lg:max-w-sm lg:rounded-[18px] lg:shadow-[0_8px_30px_rgba(15,17,20,0.12)]"
                  }
                  aria-live="polite"
                >
                  {/* Same locality cover image, with the same scrim, so the
                      map overlay matches the list card it came from.
                      Only rendered when the API supplies one. */}
                  {activeLocation.cover_url ? (
                    <div aria-hidden className="absolute inset-0 z-0">
                      <Image
                        src={activeLocation.cover_url}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 24rem, 100vw"
                        unoptimized
                        onError={(event) => {
                          event.currentTarget.parentElement?.style.setProperty(
                            "display",
                            "none",
                          );
                        }}
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/62 to-black/45" />
                    </div>
                  ) : null}

                  <div className="relative z-10">
                    <p className="text-[9px] font-semibold tracking-[0.18em] text-[#c9a84c] uppercase">
                      {activeLocation.status}
                    </p>

                    {/* Name at 18px/700 is the card's anchor. Smaller than the
                        list card's 26px because this one sits under or over a
                        live map rather than in a grid of peers. */}
                    <h3 className="mt-1.5 text-[18px] font-bold tracking-tight text-white">
                      {activeLocation.name}
                    </h3>

                    <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed font-normal text-white/70">
                      <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c9a84c]" />
                      <span className="min-w-0">{activeLocation.address}</span>
                    </p>

                    {/* Rendered only when it says something the address has
                        not already said. */}
                    {detail ? (
                      <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-white/70">
                        {detail}
                      </p>
                    ) : null}

                    {/* Below `lg` the card sits under the map, so this row is
                        the only route from the map to what is for sale here.
                        Directions is an external map link, not an API call, so
                        it deliberately does not go through apiFetch. */}
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => viewProperties(activeLocation)}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#c9a84c] px-4 text-[13px] font-bold tracking-[0.02em] text-[#0f1114] uppercase transition hover:bg-[#d4b57e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1114] active:scale-[0.98]"
                      >
                        View properties
                      </button>

                      {directionsUrl ? (
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-white/30 bg-transparent px-4 text-[12px] font-semibold tracking-[0.02em] text-white uppercase transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
                        >
                          Get directions
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            </div>
          </>
        )}
        </div>
    </section>
  );
}