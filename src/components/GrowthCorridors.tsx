"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  setWorkerUrl,
  type FilterSpecification,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlotStatus } from "@/data/plots";
import {
  fetchProperties,
  fetchPropertyTeaserUnits,
  fetchPropertyUnits,
  formatPrice,
  propertyAnchor,
  type PropertyListItem,
} from "@/services/propertiesService";
import {
  formatSizeRange,
  summariseAvailablePlots,
  type PropertyPlotFacts,
} from "@/lib/propertySummary";
import {
  estateFromUnitsApi,
  estatePlaceholderFromProperty,
} from "@/data/projects/fromApi";
import type { EstateProject } from "@/data/projects";
import {
  addEstateLayers,
  highlightPlot,
  LAYOUT_LAYER_IDS,
  LAYOUT_MAX_ZOOM,
  setLayoutData,
  SHOW_ESTATE_GEOJSON,
  syncLayoutRaster,
} from "@/lib/estateLayers";
import { loadLayoutPreviewRaster } from "@/lib/layoutPreview";
import { loadLayoutRaster } from "@/lib/layoutTiff";
import {
  SATELLITE_ATTRIBUTION,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
  SATELLITE_TILES_URL,
} from "@/lib/satelliteTiles";
import { trackEvent } from "@/services/analytics/tracker";

/**
 * Page requested for properties. Verified against the live API: every current
 * locality has 1-2 properties, so with per_page=10 there is only one page and
 * page=2 would always come back empty.
 */
const PROPERTIES_PER_PAGE = 100;

/** Plot states the layout filter can show. Mirrors `MapSection`. */
type FilterKey = "all" | PlotStatus;

/**
 * Simultaneous teaser requests.
 *
 * Held at two rather than higher: each call walks every page of a large units
 * payload, and this project talks to its API through a free tunnel that drops
 * connections under parallel load. Two keeps the cards filling in steadily
 * without crowding out the section's own requests.
 */
const TEASER_CONCURRENCY = 2;

/** Loading phase of a single card's teaser request. */
type PlotFactsState = "loading" | "ready" | "error";

/**
 * A property without a usable coordinate pair cannot be pinned or framed.
 *
 * `PropertyListItem` types both fields as optional numbers, so this guard also
 * narrows the row for the map, which is then free to read them as numbers.
 */
function hasCoordinates(
  item: PropertyListItem,
): item is PropertyListItem & { latitude: number; longitude: number } {
  const anchor = propertyAnchor(item);
  if (!anchor) return false;
  item.latitude = anchor.latitude;
  item.longitude = anchor.longitude;
  return true;
}

/**
 * The locality a property is filed under, for the card subtitle.
 *
 * `GET /api/properties` carries `locality` and `city`, but either can be null,
 * and a property with neither still needs a place on the card and the map.
 */
function localityOf(item: PropertyListItem): string {
  return (item.locality || item.city || "Hyderabad").trim();
}

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
 * Fallback viewport, used only until the API properties arrive so the map has
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

/** Close glyph, identical to `MapSection`'s `CloseIcon`. */
function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
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
 * The description, unless it merely restates the address.
 *
 * The API writes descriptions such as "Locality in Maheshwaram Mandal,
 * Ranga Reddy - 500058", which repeat the address the map detail card already
 * shows directly above it, so the same line reads twice. Returns null when
 * either string contains the other, compared on letters and digits only so
 * punctuation and casing differences cannot hide a duplicate.
 */
function descriptionIfDistinct(property: PropertyListItem): string | null {
  const description = property.description?.trim();
  if (!description) return null;

  const normalise = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const fromDescription = normalise(description);
  const fromAddress = normalise(property.address ?? "");
  if (!fromAddress) return description;

  return fromDescription.includes(fromAddress) || fromAddress.includes(fromDescription)
    ? null
    : description;
}

export default function GrowthCorridors() {
  const [mapMode, setMapMode] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  /**
   * The element wrapped around the map, watched so map mode can scroll it into
   * view. Not the map container itself -- that is sized to fill this frame, so
   * it carries no margin to offset the sticky nav by.
   */
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
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
   * on `activePropertyId` rather than on any one control.
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

  // Every visible value comes from GET /api/properties. No local demo data.
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [listState, setListState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [page, setPage] = useState(1);
  const [perPage] = useState(PROPERTIES_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  const [plotFacts, setPlotFacts] = useState<Record<string, PropertyPlotFacts>>(
    {},
  );
  const [plotFactsState, setPlotFactsState] = useState<
    Record<string, PlotFactsState>
  >({});
  /**
   * Results are cached by property id so a re-render never refetches, and the
   * in-flight set keeps the worker pool from queueing the same id twice when a
   * dependency changes mid-request.
   */
  const plotFactsCacheRef = useRef<Map<string, PropertyPlotFacts>>(new Map());
  const plotFactsPendingRef = useRef<Set<string>>(new Set());

  /**
   * Zero-based index of the property card currently in view.
   *
   * The card row is a horizontal carousel below `lg`, so this is derived from
   * its scroll offset rather than set by a click -- the visitor moves between
   * cards by swiping.
   */
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  /**
   * Which end of the card row is in view, so each arrow disables itself at the
   * end it would move past rather than scrolling into empty space.
   */
  const [cardScroll, setCardScroll] = useState({ atStart: true, atEnd: false });

  /**
   * The estate whose master plan is open on the map.
   *
   * Selection goes straight to the layout: tapping a marker, a sidebar row or a
   * card's Map button loads that property's units and draws it, so there is no
   * second click to reach the plots. `MapSection` presents the same layers.
   */
  const [activeProject, setActiveProject] = useState<EstateProject | null>(null);
  const [layoutStatus, setLayoutStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  /** Plot highlighted on the open layout, addressed by its estate plot id. */
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  /** Which plot states the layout is showing, as in `MapSection`. */
  const [plotFilter, setPlotFilter] = useState<FilterKey>("all");
  const layoutAbortRef = useRef<AbortController | null>(null);

  /**
   * Latest layout opener, for the marker effect.
   *
   * The marker effect is declared above `openPropertyLayout`, and a marker click
   * needs it. Routing through a ref keeps the effect off that declaration --
   * naming it directly would be a temporal-dead-zone error -- and keeps the
   * effect's dependency list honest, since re-running it on every render would
   * tear down and rebuild every marker.
   */
  const openLayoutRef = useRef<(item: PropertyListItem) => void>(
    () => undefined,
  );

  /**
   * Live mirrors of the open estate and its property id.
   *
   * The map's click handler is registered once, on `load`, and closes over
   * nothing -- re-registering it on every selection change would mean tearing
   * the listener down and rebuilding it. These refs give it current values
   * without that churn.
   */
  const activeProjectRef = useRef<EstateProject | null>(null);
  const activePropertyIdRef = useRef<string | null>(null);

  // No dependency list: the refs must track the current values on every render,
  // and an effect without deps is the only way to say that. It runs after paint
  // and before any click can reach the handler.
  useEffect(() => {
    activeProjectRef.current = activeProject;
    activePropertyIdRef.current = activePropertyId;
  });

  const layoutOpen = activeProject !== null;

  /**
   * Plot state tallies for the open layout.
   *
   * Counted from the loaded estate rather than the card teaser, so the filter
   * totals and the polygons on the map can never disagree.
   */
  const plotCounts = useMemo(() => {
    const plots = activeProject?.plots ?? [];
    return {
      all: plots.length,
      available: plots.filter((plot) => plot.status === "available").length,
      sold: plots.filter((plot) => plot.status === "sold").length,
    };
  }, [activeProject]);

  const plotFilters: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: plotCounts.all },
    { key: "available", label: "Available", count: plotCounts.available },
    { key: "sold", label: "Sold", count: plotCounts.sold },
  ];

  /** The tapped plot, or null when none is selected or the layout closed. */
  const selectedPlot = useMemo(
    () =>
      activeProject?.plots.find((plot) => plot.id === selectedPlotId) ?? null,
    [activeProject, selectedPlotId],
  );

  /**
   * Moves the card row one card's width. The step is measured from the rendered
   * row rather than recomputed from the width rules, for the same reason the
   * counter does it: the card is `80vw` below `sm` and a fixed width above it,
   * so a hardcoded stride would drift at the breakpoints.
   */
  const scrollCards = (direction: 1 | -1) => {
    const row = cardRowRef.current;
    if (!row) return;
    const first = row.firstElementChild as HTMLElement | null;
    if (!first) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({
      left: direction * (first.offsetWidth + gap),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const controller = new AbortController();

    fetchProperties({
      status: "ALL",
      page,
      perPage,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;

        console.log(
          `[ILA API] GET /api/properties?page=${page}&per_page=${perPage} — response`,
          result,
        );

        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setListState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setListState("error");
        console.warn("[properties] fetch failed", error);
      });

    return () => controller.abort();
  }, [page, perPage]);

  // No cleanup effect needed: the active property is derived from the current
  // page's items, so a selection from a previous page simply stops resolving.

  /**
   * Properties that have plots available come first; "Coming soon" ones go
   * last.
   *
   * `Array.prototype.sort` is stable, so the API's own ordering survives inside
   * each group -- the list is partitioned, not reshuffled. The figure comes from
   * the row's own `available_plots_count`, and a property that does not publish
   * one counts as having plots rather than as empty, so an unpublished figure
   * can never push a live development to the back.
   */
  const sortedItems = useMemo(() => {
    const rank = (item: PropertyListItem) =>
      (item.available_plots_count ?? 1) > 0 ? 0 : 1;
    return [...items].sort((a, b) => rank(a) - rank(b));
  }, [items]);

  const mappableItems = useMemo(() => items.filter(hasCoordinates), [items]);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activePropertyId) ?? null,
    [items, activePropertyId],
  );

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
      if (!first || sortedItems.length === 0) return;

      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const advance = first.offsetWidth + gap;
      if (advance <= 0) return;

      const index = Math.round(row.scrollLeft / advance);
      setActiveCardIndex(Math.min(Math.max(index, 0), sortedItems.length - 1));

      // Tolerance of 1px absorbs sub-pixel scroll offsets at fractional zoom
      // widths, which otherwise leave the end arrow permanently enabled.
      //
      // This runs on every scroll event during a smooth scroll, so the previous
      // value is returned unchanged unless an arrow actually flips -- that is
      // what stops the arrows re-rendering the row on each frame.
      const maxScroll = row.scrollWidth - row.clientWidth;
      setCardScroll((previous) => {
        const atStart = row.scrollLeft <= 1;
        const atEnd = row.scrollLeft >= maxScroll - 1;
        return previous.atStart === atStart && previous.atEnd === atEnd
          ? previous
          : { atStart, atEnd };
      });
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
  }, [sortedItems]);

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
    if (!list || !mapMode || !activePropertyId) return;

    const selected = list.querySelector<HTMLElement>('[aria-pressed="true"]');
    selected?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activePropertyId, mapMode]);

  /** Page changes set the loading state here so the effect stays pure. */
  const goToPage = (next: number) => {
    setListState("loading");
    setPage(Math.min(Math.max(1, next), Math.max(1, totalPages)));
  };

  /**
   * Derived from the page and the page count rather than stored, so they cannot
   * drift from the two numbers they are made of -- the previous flags were set
   * from a response that no longer reports them.
   */
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  const goToNextPage = () => {
    if (hasNextPage) goToPage(page + 1);
  };

  const goToPreviousPage = () => {
    if (hasPreviousPage) goToPage(page - 1);
  };

  /**
   * The ids of the properties the visible cards describe.
   *
   * A card is a property here, exactly as it is in `MapSection`, so every listed
   * property gets its own pin, its own card and its own units read. Joined and
   * sorted into one string because the effect below needs a dependency that
   * does not change identity on every render.
   */
  const cardPropertyIdsKey = useMemo(
    () => items.map((item) => item.id).sort().join("|"),
    [items],
  );

  /**
   * One teaser request per visible card, at a capped concurrency.
   *
   * A card is a property, so this is one units read per property — the same set
   * `MapSection` pins. Results are cached by property id, and the in-flight set
   * is cleared on cleanup so a request cut short by a dependency change is
   * retried rather than left stuck on "loading".
   */
  useEffect(() => {
    const ids = cardPropertyIdsKey ? cardPropertyIdsKey.split("|") : [];
    const queue = ids.filter(
      (id) =>
        !plotFactsCacheRef.current.has(id) &&
        !plotFactsPendingRef.current.has(id),
    );
    if (queue.length === 0) return;

    const controller = new AbortController();

    const worker = async () => {
      while (queue.length > 0) {
        const propertyId = queue.shift();
        if (!propertyId || controller.signal.aborted) return;

        plotFactsPendingRef.current.add(propertyId);
        setPlotFactsState((previous) => ({
          ...previous,
          [propertyId]: "loading",
        }));

        try {
          const units = await fetchPropertyTeaserUnits(
            propertyId,
            controller.signal,
          );
          if (controller.signal.aborted) return;

          console.log(
            `[ILA API] GET /api/properties/${propertyId}/units?limit=all&offset={n} — response`,
            { units: units.length, items: units },
          );

          const facts = summariseAvailablePlots(units);
          plotFactsCacheRef.current.set(propertyId, facts);
          setPlotFacts((previous) => ({ ...previous, [propertyId]: facts }));
          setPlotFactsState((previous) => ({
            ...previous,
            [propertyId]: "ready",
          }));
        } catch (error) {
          if (controller.signal.aborted) return;
          // A failed teaser is not an empty one: the card drops its stats and
          // keeps the locality name, so nothing claims there is nothing here.
          console.warn("[corridors] plot summary failed", propertyId, error);
          setPlotFactsState((previous) => ({
            ...previous,
            [propertyId]: "error",
          }));
        } finally {
          // On abort the cleanup below has already cleared the set, and deleting
          // here would also drop an id the next run has re-queued.
          if (!controller.signal.aborted) {
            plotFactsPendingRef.current.delete(propertyId);
          }
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(TEASER_CONCURRENCY, queue.length) },
      () => worker(),
    );

    return () => {
      controller.abort();
      plotFactsPendingRef.current.clear();
      void Promise.all(workers);
    };
  }, [cardPropertyIdsKey]);

  /**
   * Pagination only earns its place once there is more than one page. Every
   * current locality fits inside `perPage`, so the block used to render
   * "Page 1 / 1" with both arrows disabled -- a dead control that read as a
   * bug. Below `lg` the locality list is a horizontal carousel, so the control
   * that survives is a compact counter with arrows, not a per-page selector.
   */
  const hasMultiplePages = total > perPage;

  /**
   * Opens the map with nothing selected, for the header's "View all on map".
   *
   * Selecting one property would be wrong for an action that claims to show all
   * of them, so this only clears the selection and enters map mode: no layout
   * is loaded, and the layout effect frames the whole portfolio. With nothing
   * highlighted there is no marker emphasis and no overlay card -- the whole
   * layout reads as available.
   */
  const openMapAll = () => {
    closePropertyLayout();
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

  /**
   * Scrolls the map view into place when opening map mode or changing active property.
   *
   * List mode and map mode have drastically different heights on a phone. When the visitor
   * taps a card's "Map" button, the list carousel unmounts, collapsing the section height.
   * On mobile, smooth scrolling is interrupted or cancelled by the browser's touch event lifecycle
   * and ongoing reflow, leaving the scroll position stranded at the bottom of the section --
   * squarely on the detail card carrying the property's cover image.
   *
   * Using an instant auto-scroll targeted at the top of the section (accounting for `--nav-h`)
   * across multiple animation frames ensures the mobile screen immediately aligns at the top of the
   * map view (displaying the mobile Back button, development switcher strip, and the live interactive
   * map). We also invoke `map.resize()` to ensure MapLibre immediately sizes and renders its canvas.
   */
  /**
   * Scrolls the Growth Corridors section into view from the start when opening map mode.
   *
   * Targets `sectionRef` rather than `mapFrameRef` so the entire section (including its header,
   * mobile back button, and development switcher) is displayed from the top, without skipping down.
   */
  const scrollToMapSection = useCallback(() => {
    if (mapFullscreenRef.current) return;

    const section = sectionRef.current;
    if (!section) return;

    section.scrollIntoView({
      behavior: "auto",
      block: "start",
    });

    mapRef.current?.resize();
  }, []);

  useEffect(() => {
    if (!mapMode) return;

    scrollToMapSection();
    const rafId = window.requestAnimationFrame(() => {
      scrollToMapSection();
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [mapMode, scrollToMapSection]);

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

    const focus = activeItem ?? mappableItems[0] ?? null;
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
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: MAP_STYLE,
        center,
        zoom: focus && hasCoordinates(focus) ? LOCATION_ZOOM : DEFAULT_VIEW.zoom,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch (error) {
      console.error("[ILA map] unable to initialize growth corridors map", error);
      setMapError(true);
      return;
    }

    mapRef.current = map;

    const applyInteractions = () => {
      // Unrestricted map interaction on mobile and desktop
      map.dragPan.enable();
      map.touchZoomRotate.enable();
      map.dragRotate.disable();
      map.touchPitch.disable();

      const canvas = map.getCanvasContainer();
      const glCanvas = map.getCanvas();
      canvas.style.touchAction = "";
      glCanvas.style.touchAction = "";
    };

    applyInteractionsRef.current = applyInteractions;
    applyInteractions();

    // Fatal style, worker or WebGL failures leave an unrecoverable canvas.
    // Tile 404s and network hiccups are non-fatal and should not blank out the map.
    map.on("error", (event) => {
      console.error("[ILA map] growth corridors map error", event.error);
      const err = event.error;
      const isTileError =
        (event as { dataType?: string }).dataType === "tile" ||
        (event as { sourceDataType?: string }).sourceDataType === "tile" ||
        (err &&
          typeof err === "object" &&
          "status" in err &&
          (err as { status?: number }).status === 404);
      if (isTileError) return;

      const message =
        err && typeof err === "object" && "message" in err
          ? String(err.message)
          : "";
      const isFatal =
        message.includes("WebGL") ||
        message.includes("style") ||
        message.includes("worker") ||
        message.includes("Failed to initialize");

      if (isFatal && !mapReadyRef.current) {
        setMapError(true);
      }
    });

    map.on("load", () => {
      // Satellite imagery, hidden until a layout is open. MapLibre paints in
      // insertion order, so this must be added *before* the estate layers --
      // added after, the raster covers every plot and the layout is invisible.
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

      // Estate layers, added once and hidden, on top of the basemap.
      addEstateLayers(map);

      // A plot is only meaningful once a layout is open, so the click is read
      // from the live layer rather than registered up front -- the layer does not
      // exist yet at map construction.
      map.on("click", (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ["estate-plots-fill"],
        })[0];
        const id = feature?.properties?.id as string | undefined;
        if (!id) return;

        // The source is repointed when the layout changes, but the click can
        // still land on geometry the map has not repainted yet. Resolving the id
        // against the live estate rejects anything that is not currently drawn.
        const plot = activeProjectRef.current?.plots.find(
          (candidate) => candidate.id === id,
        );
        if (!plot) return;

        setSelectedPlotId(plot.id);

        trackEvent({
          event_type: "MAP_MARKER_CLICK",
          property_id: activePropertyIdRef.current ?? undefined,
          metadata: {
            plot_id: plot.id,
            property_id: activePropertyIdRef.current ?? undefined,
            section_type: "growth_corridors",
          },
        });
      });
      map.on("mouseenter", "estate-plots-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "estate-plots-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      mapReadyRef.current = true;
      setMapReady(true);
      setMapError(false);
      map.resize();
      window.requestAnimationFrame(() => map.resize());
      window.setTimeout(() => map.resize(), 150);
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
    const resizeMap = () => {
      map.resize();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => resizeMap())
        : null;
    resizeObserver?.observe(container);

    const onWindowResize = () => resizeMap();
    const onOrientationChange = () => {
      window.setTimeout(() => resizeMap(), 120);
    };

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onOrientationChange);
    window.requestAnimationFrame(() => resizeMap());
    const initialResizeTimer = window.setTimeout(() => {
      resizeMap();
      window.requestAnimationFrame(() => resizeMap());
    }, 100);

    return () => {
      window.clearTimeout(initialResizeTimer);
      // A layout request outlives the map that asked for it, so it is cancelled
      // here rather than being left to resolve against a removed map.
      layoutAbortRef.current?.abort();
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
   * Draws the open estate and frames it.
   *
   * Mirrors `MapSection`: the polygons go into the shared sources, every estate
   * layer flips to visible together, and the camera fits the layout rather than
   * the portfolio. Plot geometries span a couple of hundred metres, so the
   * `LAYOUT_MAX_ZOOM` ceiling lands on a close read of the plan.
   */
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

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    if (!activeProject) {
      // Back to the portfolio: frame every property again.
      const bounds = new LngLatBounds();
      let hasAny = false;
      for (const item of mappableItems) {
        if (!hasCoordinates(item)) continue;
        bounds.extend([item.longitude, item.latitude]);
        hasAny = true;
      }
      if (hasAny) {
        map.fitBounds(bounds, { padding: isMobile ? 32 : 64, maxZoom: DEFAULT_VIEW.zoom, duration: 900 });
      }
      return;
    }

    const { bounds } = activeProject;
    map.fitBounds(
      new LngLatBounds(
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ),
      { padding: isMobile ? 32 : 60, maxZoom: LAYOUT_MAX_ZOOM, duration: 900 },
    );
  }, [activeProject, mapReady, mappableItems]);

  /**
   * A layout is read against the ground it sits on, so the basemap switches to
   * satellite while a plan is open and back to the vector style when it closes.
   * Only visibility changes, so nothing is re-requested unless it is on screen.
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !layoutOpen) return;
    highlightPlot(map, selectedPlotId, Boolean(activeProject?.layoutRaster));
  }, [selectedPlotId, layoutOpen, mapReady, activeProject?.layoutRaster]);

  /**
   * Hides plots the visitor filtered out.
   *
   * The filter has to reach all three plot layers, not just the fill: hiding the
   * fill alone would leave outlines and plot numbers floating over nothing. The
   * filter is cleared rather than left applied, because the next layout's plots
   * carry their own statuses and would inherit the old filter.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !map.getLayer("estate-plots-fill")) return;

    const layers = [
      "estate-plots-fill",
      "estate-plots-outline",
      "estate-plots-label",
    ];

    if (plotFilter === "all") {
      for (const layerId of layers) map.setFilter(layerId, null);
      return;
    }

    const expression: FilterSpecification = [
      "==",
      ["get", "statusNorm"],
      plotFilter,
    ];
    for (const layerId of layers) map.setFilter(layerId, expression);
  }, [plotFilter, mapReady, layoutOpen]);

  /**
   * Brings a tapped plot into view.
   *
   * The estate fit frames the whole development, which on a large plan leaves
   * plots too small to judge individually, so a selection eases in. The floor
   * only ever zooms in -- never out -- so re-selecting a plot never pulls the
   * visitor back off a closer view they chose themselves.
   */
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
   * Keeps a marker on the map for every mappable property, marks the selected
   * one, and frames or zooms depending on how the map was opened.
   *
   * Markers are created once and then only have their active class toggled, so
   * a selection change costs no DOM work. `textContent` sets the label rather
   * than interpolating into `innerHTML`, which would parse the API's name as
   * markup.
   *
   * The open property's own marker is dropped while its layout is up — the plan
   * sits exactly where the marker was, so leaving it there puts a pin in the
   * middle of the estate.
   *
   * "View all on map" leaves nothing selected, so the view frames every
   * property; opening from a card selects that property and opens its layout.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapMode) return;

    const seen = new Set<string>();

    for (const item of mappableItems) {
      if (!hasCoordinates(item)) continue;
      // The open layout covers its own property's marker; leaving it would put
      // a pin in the middle of the estate.
      if (layoutOpen && item.id === activePropertyId) continue;
      seen.add(item.id);

      let marker = markersRef.current.get(item.id);

      if (!marker) {
        const el = document.createElement("div");
        el.className = "ila-corridor-marker";
        el.innerHTML =
          '<span class="ila-corridor-marker__dot"></span><span class="ila-corridor-marker__label"></span>';
        const label = el.querySelector(".ila-corridor-marker__label");
        if (label) label.textContent = item.name;

        // A marker opens the layout directly, exactly like the sidebar row and
        // the card's Map button.
        el.addEventListener("click", () => openLayoutRef.current(item));

        marker = new Marker({ element: el, anchor: "bottom" })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);

        markersRef.current.set(item.id, marker);
      }

      marker
        .getElement()
        ?.classList.toggle(
          "ila-corridor-marker--active",
          !layoutOpen && item.id === activePropertyId,
        );
    }

    // Drop markers for properties no longer in the response, and for the one
    // whose layout is currently covering its position.
    for (const [id, marker] of markersRef.current) {
      if (seen.has(id)) continue;
      marker.remove();
      markersRef.current.delete(id);
    }
  }, [
    activeItem,
    activePropertyId,
    layoutOpen,
    mapReady,
    mapMode,
    mappableItems,
  ]);

  /**
   * Opens a property's layout and switches the section into map mode in one
   * step, so the visitor never lands on an empty basemap first.
   */
  const openPropertyAndMap = (item: PropertyListItem) => {
    setMapMode(true);
    void openPropertyLayout(item);
  };

  const selectProperty = (item: PropertyListItem) => {
    setActivePropertyId(item.id);

    trackEvent({
      event_type: "MAP_MARKER_CLICK",
      property_id: item.id,
      metadata: {
        location_id: item.id,
        property_name: item.name,
        section_type: "growth_corridors",
      },
    });
  };

  /**
   * Opens a property's master plan straight onto the map.
   *
   * Reads the full units payload -- geometry, layout extent and the plan image
   * URLs -- rather than the trimmed teaser read the cards use, because drawing
   * the layout needs all three. Same endpoint, so the section's two-call budget
   * is unchanged.
   *
   * A previous selection is aborted rather than raced, so tapping a second
   * marker mid-load cannot leave the first layout on screen.
   */
  const openPropertyLayout = async (item: PropertyListItem) => {
    layoutAbortRef.current?.abort();
    const controller = new AbortController();
    layoutAbortRef.current = controller;

    selectProperty(item);
    setLayoutStatus("loading");
    setSelectedPlotId(null);
    // Each layout carries its own plot statuses, so a filter carried over from
    // the previous one would silently hide plots on arrival.
    setPlotFilter("all");
    setActiveProject(null);

    const anchor = hasCoordinates(item)
      ? { latitude: item.latitude, longitude: item.longitude }
      : null;
    const layoutName = item.name;
    const layoutLocation = localityOf(item);

    try {
      const { units, layoutPreviewUrl, tifUrl, layoutCords } =
        await fetchPropertyUnits(item.id, controller.signal);
      if (controller.signal.aborted) return;

      if (units.length === 0) {
        // No survey geometry yet. The property still gets the camera, framed on
        // its own coordinates, so the visitor lands on the right place.
        setActiveProject(
          anchor
            ? estatePlaceholderFromProperty({
                propertyId: item.id,
                name: layoutName,
                location: layoutLocation,
                anchor,
              })
            : null,
        );
        setLayoutStatus("ready");
        return;
      }

      const estate = estateFromUnitsApi({
        propertyId: item.id,
        name: layoutName,
        location: layoutLocation,
        anchor,
        layoutCords,
        unitsJson: units,
      });

      setActiveProject(estate);
      setLayoutStatus("ready");

      // The plan image is attached after the polygons are on the map, so a slow
      // or failed download never delays the layout itself.
      const effectiveCords =
        layoutCords ??
        (estate?.bounds
          ? {
              west: estate.bounds.minLng,
              east: estate.bounds.maxLng,
              north: estate.bounds.maxLat,
              south: estate.bounds.minLat,
            }
          : null);

      if (effectiveCords && (layoutPreviewUrl || tifUrl)) {
        void (async () => {
          // If layoutPreviewUrl points to a .tif/.tiff, treat it as a TIFF scan.
          const previewIsTiff = Boolean(
            layoutPreviewUrl &&
              /\.tiff?(?:$|\?)/i.test(layoutPreviewUrl),
          );
          const effectiveTifUrl = tifUrl ?? (previewIsTiff ? layoutPreviewUrl : null);
          const effectivePreviewUrl = previewIsTiff ? null : layoutPreviewUrl;

          const useTiff = Boolean(effectiveTifUrl);
          const raster = await (useTiff
            ? loadLayoutRaster({
                propertyId: item.id,
                tifUrl: effectiveTifUrl as string,
                cords: effectiveCords,
                signal: controller.signal,
              })
            : loadLayoutPreviewRaster({
                propertyId: item.id,
                previewUrl: effectivePreviewUrl as string,
                cords: effectiveCords,
                signal: controller.signal,
              }));
          if (controller.signal.aborted || !raster) return;
          setActiveProject((current) =>
            current && current.id === item.id
              ? { ...current, layoutRaster: raster }
              : current,
          );
        })();
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn("[corridors] layout load failed", item.id, error);
      setLayoutStatus("error");
      setActiveProject(null);
    }
  };

  /** Drops the master plan and returns the map to the portfolio view. */
  const closePropertyLayout = () => {
    layoutAbortRef.current?.abort();
    layoutAbortRef.current = null;
    setActiveProject(null);
    setLayoutStatus("idle");
    setSelectedPlotId(null);
    setPlotFilter("all");
    setActivePropertyId(null);
  };

  // Bound after both exist, so the marker effect can call the current one
  // without depending on it.
  openLayoutRef.current = (item) => {
    void openPropertyLayout(item);
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
   * `directionsUrl` is null for a property with no usable coordinates, which is
   * also why the marker cannot exist for it.
   */
  const detail = activeItem ? descriptionIfDistinct(activeItem) : null;
  const directionsUrl =
    activeItem && hasCoordinates(activeItem)
      ? `https://www.google.com/maps/dir/?api=1&destination=${activeItem.latitude},${activeItem.longitude}`
      : null;

  return (
    <section
      ref={sectionRef}
      data-section="growth_corridors"
      id="services"
      className={
        mapFullscreen
          ? "growth-corridors fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-[#eceef2]"
          : "growth-corridors relative w-full overflow-hidden bg-[#eceef2]"
      }
      aria-label="Hyderabad growth corridors"
      style={{
        scrollMarginTop: "calc(var(--nav-h) + 0.5rem)",
        ["--gc-gold" as string]: GOLD,
      }}
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
          the middle of a wide screen. It used to stop at `max-w-7xl` (1280px);
          that cap is now gone so the card row can fill the viewport, and the
          heading's own `max-w-xl` keeps the type block at its intended measure
          without the cap.

          The nav is `sticky`, not fixed, so it stays in flow and this height is
          `100svh` minus the nav -- the section ends flush with the viewport
          bottom rather than reserving space for an overlay. List mode keeps a
          generous top and a small bottom, so the grid can settle rather than
          being squeezed against the viewport edges.

          // The `max-w-7xl` cap is gone, so the card row can use the viewport the way
          // the map already does. At 1280px it left six cards ~176px each --
          // too narrow for a three-column stat row -- so they overflowed and
          // the last one was clipped at the container edge. Full width fits
          // them. The heading keeps its own `max-w-xl`, so it does not sprawl;
          // only the space to its right is reclaimed. */}
      <div
        className={
          mapMode
            ? mapFullscreen
              // Fullscreen drops the gutter and the screen-height min-height:
              // the section is already a fixed overlay, so the slot just needs
              // to fill it and let the map take what is left.
              ? "content-slot relative flex w-full flex-1 flex-col"
              : "content-slot relative w-full px-6 sm:px-10 lg:flex lg:min-h-[calc(100svh-var(--nav-h))] lg:flex-col"
            : "content-slot relative w-full px-6 py-16 sm:px-10 sm:py-24 lg:flex lg:min-h-[calc(100svh-var(--nav-h))] lg:flex-col lg:justify-center lg:pt-10 lg:pb-6 xl:pt-12"
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
              {/* Premium two-tone heading: the eyebrow, a fading hairline in the
                  section gold, then the line itself with its payoff words lifted
                  out in that same gold.

                  The phrase is marked with colour and scale rather than weight,
                  so the line stays one typographic voice -- mixing semibold and
                  bold inside one heading reads as a mistake rather than as an
                  emphasis. It is set at `1.06em` so it grows with the heading's
                  own responsive size instead of needing a second breakpoint
                  rule, and its tracking is pulled tighter, which is what makes a
                  short phrase read as deliberate rather than inherited.

                  The gold is `#8A6A1F`, the value the eyebrow already uses, not
                  the brighter `#c9a84c`: on this mist background the lighter one
                  lands near 1.9:1 and only survives as a hairline, while the
                  darker clears 4.3:1 -- ample for text this size.

                  The leading is pinned because the raised phrase makes the
                  heading's own line box taller than the type scale assumes,
                  which otherwise opens the two lines apart. */}
              <div className="max-w-xl">
                <p className="text-[10px] font-bold tracking-[0.22em] text-[#8A6A1F] uppercase">
                  {SECTION_EYEBROW}
                </p>
                <span
                  aria-hidden
                  className="mt-3 block h-px w-16 bg-linear-to-r from-[#c9a84c] to-[#c9a84c]/0"
                />
                <h2 className="mt-4 text-[24px] leading-[1.14] font-semibold tracking-[-0.01em] text-balance text-[#0f1114] lg:text-[32px] lg:leading-[1.08]">
                  Explore Properties{" "}
                  <span className="text-[1.06em] tracking-[-0.02em] text-[#8A6A1F]">
                    That Fit Your Vision
                  </span>
                </h2>
              </div>

              {/* Visible from 560px up per spec; on small mobile each card carries its own map action */}
              {items.length > 0 ? (
                <div className="mt-6 hidden items-center gap-5 sm:flex lg:shrink-0">
                  <p className="text-[13px] font-medium text-[#4a5060]">
                    {items.length}{" "}
                    {items.length === 1 ? "development" : "developments"}
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

            {listState === "loading" ? (
              <p className="mt-8 inline-flex items-center gap-2 text-sm text-[#4a5060]">
                <span className="ila-loader ila-loader--sm" aria-hidden />
                Loading developments&hellip;
              </p>
            ) : null}

            {listState === "error" ? (
              <p className="mt-8 text-sm text-[#4a5060]">
                Developments are unavailable right now. Please try again shortly.
              </p>
            ) : null}

            {listState === "ready" && items.length === 0 ? (
              <p className="mt-8 text-sm text-[#4a5060]">
                No developments to show right now.
              </p>
            ) : null}

            {items.length > 0 ? (
              <>
                {/* Count on the left, position and arrows on the right. The old
                    "Showing 7 of 7 localities &middot; Page 1 of 1" repeated itself
                    and asserted a page number for a carousel that does not
                    paginate.

                    The arrows are desktop-only because that is the breakpoint
                    where the row holds more cards than fit: below `lg` the row
                    is a touch carousel and swiping is the expected gesture, so
                    buttons would be a second way of doing the same thing. */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium text-[#4a5060]">
                    {items.length}{" "}
                    {items.length === 1 ? "development" : "developments"}
                  </p>
                  <div className="flex items-center gap-3">
                    {/* Mobile-only. Below `lg` the row is a touch carousel and
                        this is the only cue for how much is parked off-screen;
                        at `lg` the row shows whole cards and the arrows beside it
                        already carry the position, so a "1 / 4" there is just
                        noise on a desktop band. */}
                    <p className="text-[13px] font-medium tabular-nums text-[#4a5060] lg:hidden">
                      {activeCardIndex + 1} / {items.length}
                    </p>
                    <div className="hidden items-center gap-2 lg:flex">
                      <button
                        type="button"
                        onClick={() => scrollCards(-1)}
                        disabled={cardScroll.atStart}
                        aria-label="Previous developments"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] transition hover:border-[#8A6A1F] hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollCards(1)}
                        disabled={cardScroll.atEnd}
                        aria-label="Next developments"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] transition hover:border-[#8A6A1F] hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <ArrowIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Property cards -- one per property, the same set MapSection
                    pins, on one horizontal line at every breakpoint.

                    This used to become a `grid-cols-3` / `grid-cols-4` grid at
                    `lg`, which wrapped the tail onto a second row and left a
                    ragged half row under a full-width heading.

                    Above `lg` the cards share the row rather than holding a
                    fixed width, so they fill whatever width is available at
                    equal size and the last one is never clipped. `min-w` is the
                    floor: it sets how wide a card gets before the row starts
                    scrolling, which is what makes the cards read at a
                    comfortable size on a desktop instead of squeezing six onto
                    one screen. Once the floors no longer fit, the row overflows
                    and the arrows above drive it.

                    `scroll-pl-6` / `scroll-pr-6` mirror the `px-6` gutter and
                    are not optional. Snap positions are measured from the raw
                    scrollport edge, so without them `snap-mandatory` parks the
                    first card flush against the screen and swallows the gutter
                    on every swipe back. The map-mode strip further down solves
                    the same problem the same way.

                    `lg:flex-none` lets the row take the height of its tallest
                    card. As a `flex-1` item it was allowed to shrink below that,
                    and a card with a two-line title then spilled its actions
                    past the row while its neighbours looked fine. `items-stretch`
                    still gives every card the same height. */}
                <div
                  ref={cardRowRef}
                  className="-mx-6 mt-12 flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto px-6 pb-1 scrollbar-none scroll-pl-6 scroll-pr-6 sm:mx-0 sm:px-0 sm:scroll-pl-0 sm:scroll-pr-0 lg:mt-8 lg:min-h-0 lg:flex-none"
                >
                  {sortedItems.map((item, index) => {
                    const isActive = item.id === activePropertyId;
                    const mappable = hasCoordinates(item);

                    // This card's own teaser, read from its units.
                    const facts = plotFacts[item.id];

                    // Two states, both from the units request: not queued yet is
                    // loading, failed is an error that must not be mistaken for
                    // a development with nothing to sell.
                    const factsState: PlotFactsState =
                      plotFactsState[item.id] ?? "loading";
                    const isSummaryLoading = factsState === "loading";
                    const sizeLabel = formatSizeRange(
                      facts?.minSize ?? null,
                      facts?.maxSize ?? null,
                    );

                    // Nothing behind the button yet, so the gold primary is
                    // withheld -- but only once that is actually known. A
                    // request still in flight is not the same as a sold-out
                    // development, and neither is a failed request: both would
                    // claim there is nothing to buy rather than that we do not
                    // know.
                    const isComingSoon =
                      factsState === "ready" &&
                      (facts?.availableCount ?? 0) === 0;

                    return (
                      <article
                        key={item.id}
                        className={`group relative flex w-[80vw] min-h-64 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border p-6 text-left transition duration-300 sm:w-[46vw] lg:w-auto lg:min-w-[20rem] lg:flex-1 lg:flex-basis-0 lg:min-h-0 lg:p-5 xl:min-w-[22rem] ${
                          isActive
                            ? "border-[#c9a84c] bg-[#241f14]"
                            : "border-white/15 bg-[#1b1d22] hover:-translate-y-1 hover:border-[#c9a84c]"
                        }`}
                      >
                        {/* Property cover image from GET /api/properties, used as the card
                            background. Rendered only when the API supplies one --
                            several properties return cover_url: null, and those
                            cards fall back to their own dark surface rather than
                            a stock image. The article already clips its own
                            rounded corners, so no extra wrapper is needed. */}
                        {item.cover_url ? (
                          <div aria-hidden className="absolute inset-0 z-0">
                            <Image
                              src={item.cover_url}
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
                            {/* The property type holds the pill slot. Still desktop-only: the
                            card already reads index, name, locality, stats and
                            the action, and the pill competes with the enlarged
                            heading. */}
                            {item.property_type ? (
                              <span className="hidden rounded-full bg-white/20 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white uppercase sm:inline-block">
                                {item.property_type}
                              </span>
                            ) : null}
                          </div>

                          {/* Card titles are set heavier and larger than the section
                              heading -- 700 at 26px against 600 at 24px -- so the
                              property reads as the card's anchor. Both sizes are
                              fixed rather than responsive: a ramp would make
                              the section heading the larger text again at `lg`. */}
                          <h3 className="mt-4 min-h-[4rem] text-[26px] font-bold tracking-tight text-white line-clamp-2">
                            {item.name}
                          </h3>

                          {/* Locality only. The full address carried district and
                              state lines that ran past two or three wrapped rows
                              and left every card far taller than its neighbours,
                              none of which helped a buyer decide. */}
                          <p className="mt-2.5 flex items-start gap-1.5 text-[14px] leading-relaxed font-normal text-white/70">
                            <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a84c]" />
                            <span className="break-words">{localityOf(item)}</span>
                          </p>

                          {/* Three teaser facts from the property's units.
                              Values wrap to the next line cleanly if the space is not enough. */}
                          {isSummaryLoading ? (
                            <div
                              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
                              aria-hidden
                            >
                              {[0, 1, 2].map((slot) => (
                                <span
                                  key={slot}
                                  className="h-4 w-20 rounded-full bg-white/20 motion-safe:animate-pulse"
                                />
                              ))}
                            </div>
                          ) : null}

                          {facts && !isSummaryLoading ? (
                            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] leading-snug">
                              <p className="min-w-0">
                                <span className="font-bold tabular-nums text-[#c9a84c]">
                                  {facts.availableCount}
                                </span>
                                <span className="ml-1 font-medium text-white/60">
                                  {facts.availableCount === 1 ? "plot" : "plots"}
                                </span>
                              </p>
                              <p className="min-w-0 font-semibold text-white break-words">
                                {sizeLabel ?? "Size on request"}
                              </p>
                              <p className="min-w-0 font-semibold text-white break-words">
                                {facts.priceFrom !== null
                                  ? `From ${formatPrice(facts.priceFrom)}`
                                  : "Price on request"}
                              </p>
                            </div>
                          ) : null}

                          {/* Only claims the card can back up. Both chips sit
                              behind a non-empty check so a card with nothing to
                              say does not render an empty row. `allEastFacing`
                              needs the per-plot flag rather than `facings`,
                              since one plot facing "East / South" is still
                              East-facing but adds South to the union. */}
                          <div className="mt-3 flex min-h-[1.75rem] flex-wrap items-center gap-1.5">
                            {facts &&
                            facts.availableCount > 0 &&
                            (facts.allEastFacing || facts.hasCorner) ? (
                              <>
                                {facts.allEastFacing ? (
                                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[12px] font-medium text-white/85">
                                    East facing
                                  </span>
                                ) : null}
                                {facts.hasCorner ? (
                                  <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[12px] font-medium text-white/85">
                                    Corner plot
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                          </div>

                          {/* Total plots, from the row itself rather than the units read -- so it is
                              present even when that request is still in flight.
                              Held in the same spot as the old line so the action
                              row below keeps its `mt-auto` anchor and the grid
                              stays aligned. */}
                          <div className="mt-2 min-h-[1.25rem]">
                            {item.total_plots != null ? (
                              <p className="flex items-baseline gap-1.5 text-[13px]">
                                <span className="font-bold text-[#c9a84c]">
                                  {item.total_plots}
                                </span>
                                <span className="font-medium text-white/60">
                                  {item.total_plots === 1 ? "plot" : "plots"}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          {/* Actions stay compact against the 24px card title: a short gold primary plus a quieter map control beside
                              it, instead of one oversized full-width button.
                              Both buttons share `h-11 px-2 rounded-full` so they
                              are the same 44px tall with identical padding and
                              corners. `mt-auto` pins the row to the bottom so
                              every card's actions align, and pt-5 guarantees a
                              gap above them -- mt-auto alone collapses to zero
                              once the card has no free space left, which is what
                              made the button collide with the address.

                              Width: the primary is `shrink-0` and keeps to its
                              own label plus icon; Map is the same. `whitespace-nowrap`
                              on both stops the label breaking or ellipsising --
                              the card used to clip the primary's label because
                              the two buttons together were wider than the card's
                              inner width. The primary drops `min-w-0` so it can
                              never be squeezed below the width its own text
                              needs. */}
                          <div className="mt-auto flex items-center gap-3 pt-5">
                            {/* The card is a property now, so there is no
                                locality list left to swap in — the plots live on
                                the property's own page. Same destination as
                                `MapSection`'s "Visit Property" CTA, so both maps
                                lead to the same place. */}
                            <Link
                              href={`/properties/${item.id}`}
                              aria-label={`View plots in ${item.name}`}
                              data-track="PROPERTY_VIEW"
                              data-track-property={item.id}
                              data-track-meta={`{"source":"growth_corridors","surface":"card_view_plots"}`}
                              className={`inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-bold tracking-[0.02em] uppercase transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] ${
                                isComingSoon
                                  ? "border border-white/30 bg-transparent text-white hover:bg-white/10 focus-visible:outline-[#c9a84c]"
                                  : "bg-[#c9a84c] text-[#0f1114] hover:bg-[#d4b57e] focus-visible:outline-[#0f1114]"
                              }`}
                            >
                              <span>View plots</span>
                              <ArrowIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </Link>

                            {/* Rendered only for mappable properties so the row
                                never shows a dead control, and the primary takes
                                the full width when the map control is absent. */}
                            {mappable ? (
                              <button
                                type="button"
                                onClick={() => openPropertyAndMap(item)}
                                aria-label={`Show ${item.name} layout on the map`}
                                data-track="MAP_MARKER_CLICK"
                                data-track-meta={`{"property_id":"${item.id}","property_name":"${item.name}","section_type":"growth_corridors","surface":"card_map"}`}
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

                  {/* Map tile. Always last on the line, doubling as a second way
                      into map mode next to the header's "View all on map".
                      It was there to fill the empty cell a seven-item grid left
                      at four columns; the row is a single line now, so it simply
                      closes the strip, sharing the cards' sizing so every cell
                      on the line is the same width. */}
                  <button
                    type="button"
                    onClick={openMapAll}
                    data-track="MAP_MARKER_CLICK"
                    data-track-meta={`{"section_type":"growth_corridors","surface":"grid_cta"}`}
                    className="group flex min-h-64 w-[80vw] shrink-0 snap-start flex-col items-center justify-center gap-4 rounded-2xl border border-[#1b1d22]/25 bg-transparent p-6 text-center transition duration-300 hover:-translate-y-1 hover:border-[#8A6A1F] hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F] active:scale-[0.98] sm:w-[46vw] lg:w-auto lg:min-w-[20rem] lg:flex-1 lg:flex-basis-0 lg:min-h-0 lg:p-5 xl:min-w-[22rem]"
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
                      disabled={!hasPreviousPage || listState === "loading"}
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
                      disabled={!hasNextPage || listState === "loading"}
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
              : "shrink-0 -mx-6 overflow-y-hidden lg:mx-0 lg:flex lg:w-75 lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-black/8 lg:bg-white lg:px-0 lg:shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
              }
              aria-label="Localities"
            >
              {/* Mobile bar: back + count */}
              <div className="flex items-center justify-between gap-3 px-6 pb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (mapFullscreen) {
                      setMapFullscreen(false);
                      return;
                    }
                    if (layoutOpen) {
                      closePropertyLayout();
                    }
                    setMapMode(false);
                  }}
                  className="-ml-1 inline-flex items-center gap-1.5 rounded-full bg-black/6 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase"
                >
                  <ArrowIcon className="h-3 w-3 rotate-180" />
                  Back
                </button>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#4a5060] uppercase">
                  {mappableItems.length} developments
                </p>
              </div>

              {/* Desktop header */}
              <div className="hidden items-center justify-between gap-3 border-b border-black/8 px-5 py-4 lg:flex">
                <h3 className="text-base font-semibold tracking-tight text-[#0f1114]">
                  Developments
                </h3>
                <span className="shrink-0 rounded-full bg-[#0f1114]/6 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#4a5060] uppercase">
                  {mappableItems.length}
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
                {mappableItems.map((item) => {
                  const isActive = item.id === activePropertyId;

                  return (
                    <li
                      key={item.id}
                      className="w-[68vw] max-w-[230px] shrink-0 snap-start sm:w-[46vw] sm:max-w-65 lg:w-auto lg:max-w-none lg:shrink"
                    >
                      <button
                        type="button"
                        onClick={() => openPropertyAndMap(item)}
                        aria-pressed={isActive}
                        data-track="MAP_MARKER_CLICK"
                        data-track-meta={`{"property_id":"${item.id}","property_name":"${item.name}","section_type":"growth_corridors","surface":"map_sidebar"}`}
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
                            {item.name}
                          </span>

                          {/* Marks the selected property and nothing else. It
                              previously rendered on every row in the same
                              gold, so it carried no information. */}
                          {isActive ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-[#c9a84c] lg:order-last lg:self-center"
                              aria-hidden
                            />
                          ) : null}
                        </span>

                        {/* Plot count from the row itself, replacing the raw
                            "17.31065, 78.53988" pair. Coordinates meant
                            nothing to a buyer and read as low-contrast noise;
                            this is the same figure the card view shows, so the
                            two views agree. */}
                        <span
                          className={`truncate text-[10px] tracking-wide ${
                            isActive ? "text-white/60" : "text-[#4a5060]"
                          }`}
                        >
                          {item.total_plots != null
                            ? `${item.total_plots} ${
                                item.total_plots === 1 ? "plot" : "plots"
                              }`
                            : (item.available_plots_count ?? 0) > 0
                              ? `${item.available_plots_count} available`
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
                  Back to developments
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
              ref={mapFrameRef}
              // Offset for `scrollIntoView` in the map-mode effect, so the sticky
              // nav does not cover the top of the map once it scrolls into view.
              style={{ scrollMarginTop: "calc(var(--nav-h) + 0.5rem)" }}
              className={
                mapFullscreen
                  ? "ila-corridor-map-frame ila-corridor-map-frame--fullscreen relative block flex-1 overflow-hidden bg-[#dfe3ea]"
                  : "ila-corridor-map-frame relative flex w-full flex-col overflow-hidden rounded-[18px] bg-[#dfe3ea] lg:block lg:h-auto lg:flex-1 lg:min-h-0 lg:border lg:border-black/8 lg:shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
              }
            >
              <div
              className={
                mapFullscreen
                  ? "relative h-full w-full"
                  : "relative h-[58vh] min-h-[360px] w-full flex-none lg:absolute lg:inset-0 lg:h-full"
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
                onClick={() => {
                  if (mapFullscreen) {
                    setMapFullscreen(false);
                    return;
                  }
                  if (layoutOpen) {
                    closePropertyLayout();
                  }
                  setMapMode(false);
                }}
                className={`absolute left-3 top-3 z-20 items-center gap-1.5 rounded-full bg-white/95 px-3 py-2 text-[10px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase shadow-[0_4px_16px_rgba(15,17,20,0.14)] backdrop-blur-sm transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6A1F] ${mapFullscreen ? "inline-flex" : "hidden lg:inline-flex"}`}
                aria-label={
                  mapFullscreen
                    ? "Exit fullscreen map"
                    : layoutOpen
                      ? "Close layout"
                      : "Back to developments"
                }
              >
                <span aria-hidden>&larr;</span>
                Back
              </button>

              <div
                ref={mapContainerRef}
                className="absolute inset-0 h-full w-full"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                }}
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

              {/* The layout request is the heaviest this section makes, so it
                  names what it is waiting for rather than leaving the visitor
                  looking at a bare basemap. */}
              {layoutStatus === "loading" ? (
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                  role="status"
                  aria-live="polite"
                >
                  <span className="flex max-w-[80%] items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-[#4a5060] uppercase shadow-[0_4px_16px_rgba(15,17,20,0.12)]">
                    <span className="ila-loader ila-loader--sm" aria-hidden />
                    <span className="truncate">
                      Loading layout{activeItem ? ` · ${activeItem.name}` : ""}
                    </span>
                  </span>
                </div>
              ) : null}

              {layoutStatus === "error" ? (
                <div className="absolute inset-x-3 top-3 z-10 flex justify-center">
                  <span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#8a5a2b] shadow-[0_4px_16px_rgba(15,17,20,0.14)]">
                    This layout could not be loaded right now
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

              {/* Plot state filter, styled to match `MapSection`: a three-column
                  strip where the active cell inverts to near-black and carries
                  its own count. Sits below the back button rather than beside
                  it, so neither control can cover the other at any width. */}
              {layoutOpen ? (
                <div className="absolute left-3 top-14 z-20 w-56 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-xl border border-black/15 bg-[#d9d2c7] shadow-[0_8px_20px_rgba(15,23,42,0.14)]">
                  <div className="grid grid-cols-3">
                    {plotFilters.map((item) => {
                      const isActive = plotFilter === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setPlotFilter(item.key)}
                          aria-pressed={isActive}
                          className={`border-r border-black/10 px-2 py-2 text-left transition last:border-r-0 ${
                            isActive
                              ? "bg-[#171717] text-white"
                              : "bg-transparent text-[#171717] hover:bg-[#cfc3a8]"
                          }`}
                        >
                          <span className="block text-[11px] font-semibold sm:text-xs">
                            {item.label}
                          </span>
                          <span
                            className={`mt-0.5 block text-[10px] font-medium ${
                              isActive ? "text-white/70" : "text-[#5c5348]"
                            }`}
                          >
                            {item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Desktop plot read-out. The mobile bottom sheet below is
                  md:hidden, so desktop needs its own card or a selected plot
                  has no detail. */}
              {selectedPlot ? (
                <div className="pointer-events-auto absolute bottom-3 left-3 z-20 hidden w-80 overflow-hidden rounded-xl border border-black/15 bg-[#d9d2c7] shadow-[0_12px_36px_rgba(15,23,42,0.22)] md:block">
                  <div className="relative px-3 pt-3 pb-3">
                    <button
                      type="button"
                      aria-label="Close plot details"
                      onClick={() => setSelectedPlotId(null)}
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
                        {selectedPlot.area} &middot; {selectedPlot.price}
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
              </div>

              {/* Mobile bottom sheet for a tapped plot, mirroring `MapSection`.
                  `fixed` from the map card's position inside the section: the map
                  frame clips its children, so this has to escape it to reach the
                  viewport edge. */}
              {selectedPlot ? (
                <div className="pointer-events-none fixed inset-x-0 bottom-0 z-60 md:hidden">
                  <div className="pointer-events-auto max-h-[42vh] overflow-y-auto rounded-t-2xl border-t border-black/10 bg-[#d9d2c7] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(15,23,42,0.28)]">
                    <div className="flex justify-center pt-2.5 pb-1" aria-hidden>
                      <span className="h-1 w-10 rounded-full bg-black/20" />
                    </div>
                    <div className="relative px-3 pb-3">
                      <button
                        type="button"
                        aria-label="Close plot details"
                        onClick={() => setSelectedPlotId(null)}
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
                          {selectedPlot.area} &middot; {selectedPlot.price}
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
                </div>
              ) : null}

              {/* Below `lg` this flows under the map; at `lg` it re-attaches as
                  an overlay in the map's bottom-right. Either way the marker
                  is no longer hidden behind it, so the map's centre needs no
                  upward offset to keep the pin in view.

                  Suppressed once a plot is tapped: the plot read-out takes its
                  place, matching `MapSection`, so the two cards never compete
                  for the same corner. */}
              {activeItem && !selectedPlot ? (
                <div
                  className={
                    mapFullscreen
                      ? // Fullscreen has no room below the map, so the card is an
                        // overlay at every width, not just at `lg`.
                        "absolute inset-x-3 bottom-3 z-10 overflow-hidden rounded-[18px] bg-[#1b1d22] p-4 shadow-[0_8px_30px_rgba(15,17,20,0.12)] lg:inset-x-auto lg:right-3 lg:max-w-sm"
                      : "relative shrink-0 overflow-hidden bg-[#1b1d22] p-4 lg:absolute lg:inset-x-auto lg:right-3 lg:bottom-3 lg:z-10 lg:max-w-sm lg:rounded-[18px] lg:shadow-[0_8px_30px_rgba(15,17,20,0.12)]"
                  }
                  aria-live="polite"
                >
                  {/* Same locality cover image, with the same scrim, so the
                      map overlay matches the list card it came from.
                      Only rendered when the API supplies one. */}
                  {activeItem.cover_url ? (
                    <div aria-hidden className="absolute inset-0 z-0">
                      <Image
                        src={activeItem.cover_url}
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
                    {/* The property type holds the slot the locality status used
                        to occupy: `GET /api/properties` publishes no status. */}
                    {activeItem.property_type ? (
                      <p className="text-[9px] font-semibold tracking-[0.18em] text-[#c9a84c] uppercase">
                        {activeItem.property_type}
                      </p>
                    ) : null}

                    {/* The property name is the anchor, with its locality
                        underneath -- the same pair the list card leads with.
                        Smaller than the list card's 26px because this one sits
                        under or over a live map rather than in a grid of peers. */}
                    <h3 className="mt-1.5 text-[18px] font-bold tracking-tight text-white">
                      {activeItem.name}
                    </h3>

                    <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-relaxed font-normal text-white/70">
                      <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c9a84c]" />
                      <span className="min-w-0">{localityOf(activeItem)}</span>
                    </p>

                    {/* Rendered only when it says something the locality has not
                        already said. */}
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
                      <Link
                        href={`/properties/${activeItem.id}`}
                        data-track="PROPERTY_VIEW"
                        data-track-property={activeItem.id}
                        data-track-meta={`{"source":"growth_corridors","surface":"map_detail"}`}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#c9a84c] px-4 text-[13px] font-bold tracking-[0.02em] text-[#0f1114] uppercase transition hover:bg-[#d4b57e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1114] active:scale-[0.98]"
                      >
                        View properties
                      </Link>

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