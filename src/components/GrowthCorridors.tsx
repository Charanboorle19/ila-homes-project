"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  fetchLocations,
  hasCoordinates,
  type LocationRecord,
} from "@/services/locationsService";
import {
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

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const GOLD = "#c9a84c";

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

/** Formats API coordinates for display. */
function formatCoords(location: LocationRecord): string | null {
  if (!hasCoordinates(location)) return null;
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

export default function GrowthCorridors() {
  const [mapMode, setMapMode] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Every visible value comes from GET /api/locations. No local demo data.
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [locationsState, setLocationsState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);

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

  // Opens the map centred on the first usable location rather than a hardcoded
  // point, so there is no demo coordinate anywhere in this section.
  // Opens the map, defaulting to the first mappable locality so the map and
  // marker are never empty.
  const openMap = (location?: LocationRecord) => {
    const next = location ?? mappableLocations[0] ?? null;
    setActiveLocationId(next ? next.id : null);
    setMapMode(true);
  };

  useEffect(() => {
    if (!mapMode || !mapContainerRef.current || mapRef.current) return;

    const focus = activeLocation ?? mappableLocations[0] ?? null;
    const center =
      focus && hasCoordinates(focus)
        ? ([focus.longitude, focus.latitude] as [number, number])
        : ([DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude] as [number, number]);

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center,
      zoom: focus && hasCoordinates(focus) ? LOCATION_ZOOM : DEFAULT_VIEW.zoom,
      attributionControl: false,
    });

    mapRef.current = map;
    map.on("load", () => setMapReady(true));

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Intentionally runs only when the map is first opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mapMode) return;

    markerRef.current?.remove();
    markerRef.current = null;

    if (!activeLocation || !hasCoordinates(activeLocation)) return;

    map.easeTo({
      center: [activeLocation.longitude, activeLocation.latitude],
      zoom: LOCATION_ZOOM,
      duration: 900,
    });

    const el = document.createElement("div");
    el.className = "ila-corridor-marker";
    el.innerHTML = `<span class="ila-corridor-marker__dot"></span><span class="ila-corridor-marker__label">${activeLocation.name}</span>`;
    markerRef.current = new Marker({ element: el, anchor: "bottom" })
      .setLngLat([activeLocation.longitude, activeLocation.latitude])
      .addTo(map);
  }, [activeLocation, mapReady, mapMode]);

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

  return (
    <section
      data-section="growth_corridors"
      id="services"
      className="growth-corridors relative w-full overflow-hidden bg-[#eceef2]"
      aria-label="Hyderabad growth corridors"
      style={{ ["--gc-gold" as string]: GOLD }}
    >
      {/* Map mode goes edge to edge: the list and map manage their own insets. */}
      <div
        className={
          mapMode
            ? "relative w-full"
            : "relative w-full px-6 py-10 sm:px-8 sm:py-12 lg:px-12"
        }
      >
        {!mapMode ? (
          <>
            <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[10px] font-semibold tracking-[0.22em] text-[#a6862e] uppercase">
                  South Hyderabad · Growth corridors
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#0f1114] sm:text-3xl lg:text-[2rem] lg:leading-tight">
                  Explore locations shaping the next phase of Hyderabad
                </h2>
              </div>

              {mappableLocations.length > 0 ? (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="hidden text-[#c9a84c] sm:inline" aria-hidden>
                    →
                  </span>
                  <button
                    type="button"
                    onClick={() => openMap()}
                    className="inline-flex items-center gap-2 rounded-full bg-[#c9a84c] px-4 py-2.5 text-xs font-semibold tracking-[0.08em] text-[#0f1114] transition hover:bg-[#d4b57e]"
                  >
                    <MapIcon className="h-4 w-4" />
                    View on map
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
                  ← Back to localities
                </button>

                <p className="mt-5 text-[10px] font-semibold tracking-[0.18em] text-[#a6862e] uppercase">
                  Properties in {locations.find((l) => l.slug === propertiesSlug)?.name ?? propertiesSlug}
                </p>

                {propertiesState === "loading" ? (
                  <p className="mt-3 text-sm text-[#8a909e]">Loading properties…</p>
                ) : null}

                {propertiesState === "error" ? (
                  <p className="mt-3 text-sm text-[#8a909e]">
                    Properties are unavailable right now. Please try again shortly.
                  </p>
                ) : null}

                {propertiesState === "ready" && properties.length === 0 ? (
                  <p className="mt-3 text-sm text-[#8a909e]">
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
                          className="group flex h-full flex-col rounded-2xl border border-black/10 bg-white p-4 transition hover:border-[#c9a84c] hover:shadow-[0_8px_30px_rgba(15,17,20,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-base font-semibold tracking-tight text-[#0f1114]">
                              {property.name}
                            </h3>
                            {property.property_type ? (
                              <span className="shrink-0 rounded-full bg-[#c9a84c]/15 px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-[#8a6a12] uppercase">
                                {property.property_type}
                              </span>
                            ) : null}
                          </div>

                          {property.description ? (
                            <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-[#4a5060]">
                              {property.description}
                            </p>
                          ) : null}

                          <div className="mt-4 flex items-end justify-between gap-2 border-t border-black/8 pt-3">
                            <span className="truncate text-[10px] text-[#8a909e]">
                              /{property.slug}
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-[#c9a84c]">
                              {formatPrice(property.price)}
                            </span>
                          </div>

                          <span className="mt-3 inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase transition group-hover:gap-2.5">
                            View details
                            <ArrowIcon className="h-3 w-3" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {propertiesState === "ready" ? (
                  <p className="mt-4 text-[10px] font-semibold tracking-[0.18em] text-[#8a909e] uppercase">
                    Showing {properties.length} of {propertiesTotal} properties
                  </p>
                ) : null}
              </div>
            ) : null}

            {!propertiesSlug && locationsState === "loading" ? (
              <p className="mt-8 text-sm text-[#8a909e]">Loading localities…</p>
            ) : null}

            {!propertiesSlug && locationsState === "error" ? (
              <p className="mt-8 text-sm text-[#8a909e]">
                Localities are unavailable right now. Please try again shortly.
              </p>
            ) : null}

            {!propertiesSlug && locationsState === "ready" && locations.length === 0 ? (
              <p className="mt-8 text-sm text-[#8a909e]">
                No localities to show right now.
              </p>
            ) : null}

            {!propertiesSlug && locations.length > 0 ? (
              <>
                <p className="mt-8 text-[10px] font-semibold tracking-[0.18em] text-[#8a909e] uppercase">
                  Showing {locations.length} of {total} localities · Page {page} of{" "}
                  {totalPages}
                </p>

                {/* Location cards — all fields from the API response */}
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1 scrollbar-none sm:gap-3.5 lg:grid lg:grid-cols-3 lg:overflow-visible">
                  {locations.map((location, index) => {
                    const isActive = location.id === activeLocationId;
                    const mappable = hasCoordinates(location);
                    const coords = formatCoords(location);

                    return (
                      <div
                        key={location.id}
                        className={`relative flex min-w-64 flex-1 flex-col rounded-2xl border p-4 text-left transition sm:min-w-0 ${
                          isActive
                            ? "border-[#c9a84c] bg-white shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
                            : "border-black/10 bg-white/70"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f1114] text-[10px] font-bold tracking-wide text-white">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="rounded-full bg-[#c9a84c]/15 px-2 py-1 text-[9px] font-semibold tracking-[0.12em] text-[#8a6a12] uppercase">
                            {location.status}
                          </span>
                        </div>

                        <h3 className="mt-3 truncate text-base font-semibold tracking-tight text-[#0f1114]">
                          {location.name}
                        </h3>

                        {location.description ? (
                          <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-[#4a5060]">
                            {location.description}
                          </p>
                        ) : null}

                        <dl className="mt-4 space-y-1.5 border-t border-black/8 pt-3">
                          {location.address ? (
                            <div>
                              <dt className="text-[9px] font-semibold tracking-[0.16em] text-[#8a909e] uppercase">
                                Address
                              </dt>
                              <dd className="text-[12px] leading-snug text-[#4a5060]">
                                {location.address}
                              </dd>
                            </div>
                          ) : null}

                          {coords ? (
                            <div>
                              <dt className="text-[9px] font-semibold tracking-[0.16em] text-[#8a909e] uppercase">
                                Coordinates
                              </dt>
                              <dd className="text-[12px] text-[#4a5060]">
                                {coords}
                              </dd>
                            </div>
                          ) : null}
                        </dl>

                        {/* Selecting anywhere on the card opens the map for
                            this locality, so there is no explicit CTA button. */}
                        <button
                          type="button"
                          onClick={() => selectLocation(location)}
                          disabled={!mappable}
                          aria-label={`View ${location.name} on map`}
                          data-track="MAP_MARKER_CLICK"
                          data-track-meta={`{"location_id":"${location.id}","location_slug":"${location.slug}","section_type":"growth_corridors"}`}
                          className="group mt-4 flex w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-left transition hover:border-[#c9a84c] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="truncate text-[11px] text-[#4a5060]">
                            {mappable ? `/${location.slug}` : "No map location"}
                          </span>
                          <span className="flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase">
                            Explore
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#c9a84c] text-[#0f1114]">
                              <ArrowIcon className="h-3 w-3" />
                            </span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                <nav
                  className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4"
                  aria-label="Localities pagination"
                >
                  <label className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-[#8a909e] uppercase">
                    Per page
                    <select
                      value={perPage}
                      onChange={(event) => {
                        setLocationsState("loading");
                        setPerPage(Number(event.target.value));
                        setPage(1);
                      }}
                      className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0f1114] outline-none focus:border-[#c9a84c]"
                    >
                      {[5, 10, 20, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goToPreviousPage}
                      disabled={!hasPreviousPage || locationsState === "loading"}
                      aria-label="Previous page"
                      className="rounded-full border border-black/12 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#0f1114] transition hover:border-[#c9a84c] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Previous
                    </button>

                    <span className="text-[11px] font-semibold text-[#4a5060]">
                      Page {page} / {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={goToNextPage}
                      disabled={!hasNextPage || locationsState === "loading"}
                      aria-label="Next page"
                      className="rounded-full border border-black/12 bg-white px-4 py-2 text-[11px] font-semibold tracking-[0.08em] text-[#0f1114] transition hover:border-[#c9a84c] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </nav>
              </>
            ) : null}
          </>
        ) : (
          // Owns its own insets because the section padding is dropped in map mode.
          <div className="flex min-h-[62vh] flex-col gap-2.5 pt-3 sm:gap-3 sm:pt-4 lg:min-h-[75vh] lg:flex-row lg:gap-5 lg:px-12 lg:pt-12">
            {/* Locations list — left on desktop, full-bleed strip on mobile */}
            <aside
              className="shrink-0 px-4 sm:px-6 lg:flex lg:w-[min(340px,34%)] lg:flex-col lg:overflow-hidden lg:rounded-2xl lg:border lg:border-black/8 lg:bg-white lg:px-0 lg:shadow-[0_8px_30px_rgba(15,17,20,0.06)]"
              aria-label="Localities"
            >
              {/* Mobile bar: back + count */}
              <div className="flex items-center justify-between gap-3 pb-2 lg:hidden">
                <button
                  type="button"
                  onClick={() => setMapMode(false)}
                  className="-ml-1 inline-flex items-center gap-1.5 rounded-full bg-black/6 px-2.5 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase"
                >
                  <ArrowIcon className="h-3 w-3 rotate-180" />
                  Back
                </button>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-[#8a909e] uppercase">
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

              {/* Edge-to-edge horizontal strip on mobile, vertical list on desktop */}
              <ul className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:divide-y lg:divide-black/6 lg:overflow-y-auto lg:px-0 lg:pb-0">
                {mappableLocations.map((location) => {
                  const isActive = location.id === activeLocationId;
                  const coords = formatCoords(location);

                  return (
                    <li
                      key={location.id}
                      className="w-[68vw] max-w-[230px] shrink-0 snap-start sm:w-[46vw] sm:max-w-[260px] lg:w-auto lg:max-w-none lg:shrink"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveLocationId(location.id)}
                        aria-pressed={isActive}
                        data-track="MAP_MARKER_CLICK"
                        data-track-meta={`{"location_id":"${location.id}","location_slug":"${location.slug}","section_type":"growth_corridors","surface":"map_sidebar"}`}
                        className={`flex h-full w-full flex-col gap-1.5 rounded-2xl p-3.5 text-left transition active:scale-[0.98] lg:flex-row lg:items-start lg:gap-3 lg:rounded-none lg:p-0 lg:px-5 lg:py-3.5 lg:active:scale-100 ${
                          isActive
                            ? "bg-[#0f1114] text-white shadow-[0_8px_20px_rgba(15,17,20,0.18)]"
                            : "bg-white text-[#0f1114] shadow-[0_2px_10px_rgba(15,17,20,0.06)] lg:bg-transparent lg:text-inherit lg:shadow-none lg:hover:bg-black/3"
                        }`}
                      >
                        <span className="flex w-full items-center justify-between gap-2 lg:contents">
                          <span
                            className={`truncate text-sm font-semibold tracking-tight ${
                              isActive ? "text-white" : "text-[#0f1114]"
                            }`}
                          >
                            {location.name}
                          </span>

                          <span
                            className={`h-2 w-2 shrink-0 rounded-full lg:order-last lg:mt-1 ${
                              isActive ? "bg-[#c9a84c]" : "bg-[#c9a84c]"
                            }`}
                            aria-hidden
                          />
                        </span>

                        {coords ? (
                          <span
                            className={`truncate text-[10px] tracking-wide ${
                              isActive ? "text-white/60" : "text-[#8a909e]"
                            }`}
                          >
                            {coords}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </aside>

            {/* Map — full-bleed on mobile, inset card beside the list on desktop */}
            <div className="relative min-h-[46vh] flex-1 overflow-hidden bg-[#dfe3ea] lg:min-h-0 lg:rounded-2xl lg:border lg:border-black/8">
              <div
                ref={mapContainerRef}
                className="absolute inset-0 h-full w-full"
              />

              {activeLocation ? (
                <div
                  className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-white/95 p-4 shadow-[0_8px_30px_rgba(15,17,20,0.12)] backdrop-blur-sm sm:inset-x-auto sm:right-3 sm:bottom-3 sm:max-w-sm"
                  aria-live="polite"
                >
                  <p className="text-[9px] font-semibold tracking-[0.18em] text-[#a6862e] uppercase">
                    {activeLocation.status}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight text-[#0f1114]">
                    {activeLocation.name}
                  </h3>

                  {activeLocation.description ? (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[#4a5060]">
                      {activeLocation.description}
                    </p>
                  ) : null}

                  {activeLocation.address ? (
                    <p className="mt-2 text-[11px] text-[#8a909e]">
                      {activeLocation.address}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}