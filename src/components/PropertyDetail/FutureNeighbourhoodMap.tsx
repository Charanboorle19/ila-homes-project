"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Map as MapLibre,
  NavigationControl,
  Marker,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import type { MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { NeighbourhoodItem, PropertyRecord } from "@/data/properties";
import { distanceFromGachibowliKm } from "@/lib/propertyUtils";
import {
  fetchNearbyPlaces,
  isPropertyUuid,
  type ApiNearbyPlace,
} from "@/services/propertiesService";

type Horizon = "today" | "2029";
type NearByStatus = "idle" | "locating" | "located" | "denied";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ITEMS_SOURCE = "future-items";
const LINKS_SOURCE = "future-links";
const ORIGIN_SOURCE = "future-origin-src";

const EARTH_RADIUS_KM = 6371;

export interface NearbyPlaceItem {
  id: string;
  name: string;
  kind: string;
  distanceKm: number;
  status: string;
  detail: string;
  coordinates: [number, number];
  category?: string;
  proximityLabel?: string;
  expectedYear?: number | null;
  horizon?: Horizon;
}

function formatDistanceDisplay(dist: number | null | undefined): string {
  if (dist == null || !Number.isFinite(dist)) return "Nearby";
  return `${dist.toFixed(1)} km`;
}

/** Formats uppercase category strings into clear human readable kinds */
function formatCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    AIRPORT: "Airport",
    BUSINESS: "Business & IT Park",
    HIGHWAY: "Highway / Expressway",
    HOSPITAL: "Healthcare",
    ORR: "Outer Ring Road",
    PARK: "Parks & Recreation",
    SCHOOL: "Education & School",
    METRO: "Metro Station",
    MALL: "Shopping & Retail",
    TRANSIT: "Transit Hub",
  };
  if (map[category]) return map[category];
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Formats proximity labels into friendly badges */
function formatProximityLabel(label?: string | null): string {
  if (!label) return "";
  const map: Record<string, string> = {
    WALKING: "Walking Distance",
    VERY_CLOSE: "Very Close",
    NEARBY: "Nearby Drive",
    SHORT_DRIVE: "Short Drive",
    MODERATE_DRIVE: "Moderate Drive",
    FURTHER_DRIVE: "Drive Distance",
    DRIVE_TIME_CLAIM: "Approx. drive time",
  };
  return map[label] || label.replace(/_/g, " ").toLowerCase();
}

/** Converts ApiNearbyPlace items to standard display items */
function mapApiNearbyPlace(item: ApiNearbyPlace): NearbyPlaceItem {
  const isProposed =
    item.status === "PROPOSED" ||
    item.status === "UPCOMING" ||
    item.status === "PLANNED" ||
    Boolean(item.expected_year && item.expected_year > 2026);

  const kind = formatCategoryLabel(item.category);
  const statusDisplay = item.expected_year
    ? `Expected ${item.expected_year}`
    : item.status === "OPERATIONAL"
      ? "Operational"
      : item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase();

  const prox = formatProximityLabel(item.proximity_label);
  const detail = prox
    ? `${prox} · ${kind}`
    : `${kind} · ${item.distance} ${item.distance_unit}`;

  const distNum =
    typeof item.distance === "number" && Number.isFinite(item.distance)
      ? item.distance
      : Number(item.distance) || 0;

  return {
    id: item.id,
    name: item.name,
    kind,
    distanceKm: distNum,
    status: statusDisplay,
    detail,
    coordinates: [item.longitude, item.latitude],
    category: item.category,
    proximityLabel: prox,
    expectedYear: item.expected_year,
    horizon: isProposed ? "2029" : "today",
  };
}

/**
 * The catalogue stores distances, not coordinates, so marker positions are
 * derived from the plot's own centre. Bearings are spread evenly around the
 * plot to keep labels from stacking, and distances are capped so a 12 km
 * airport run does not push everything else off screen.
 */
function offsetFrom(
  origin: [number, number],
  distanceKm: number,
  bearingDeg: number,
): [number, number] {
  const angular = Math.min(distanceKm, 5.5) / EARTH_RADIUS_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin[1] * Math.PI) / 180;
  const lon1 = (origin[0] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function buildGeoJson(
  items: (NeighbourhoodItem | NearbyPlaceItem)[],
  origin: [number, number],
  horizon: Horizon,
) {
  const step = 360 / Math.max(items.length, 1);

  const points: Feature<Point>[] = items.map((item, index) => {
    // If exact coordinates are available, use them; otherwise use offset calculation
    const hasCoordinates =
      Array.isArray(item.coordinates) &&
      item.coordinates.length === 2 &&
      Number.isFinite(item.coordinates[0]) &&
      Number.isFinite(item.coordinates[1]) &&
      !(item.coordinates[0] === 0 && item.coordinates[1] === 0);

    const coords = hasCoordinates
      ? (item.coordinates as [number, number])
      : offsetFrom(origin, item.distanceKm, step * index + 24);

    return {
      id: item.id,
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {
        id: item.id,
        number: index + 1,
        name: item.name,
        meta: `${item.kind} · ${formatDistanceDisplay(item.distanceKm)} · ${item.status}`,
        status: item.status,
        horizon,
      },
    };
  });

  const links: Feature<LineString>[] = items.map((item, index) => {
    const hasCoordinates =
      Array.isArray(item.coordinates) &&
      item.coordinates.length === 2 &&
      Number.isFinite(item.coordinates[0]) &&
      Number.isFinite(item.coordinates[1]) &&
      !(item.coordinates[0] === 0 && item.coordinates[1] === 0);

    const coords = hasCoordinates
      ? (item.coordinates as [number, number])
      : offsetFrom(origin, item.distanceKm, step * index + 24);

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [origin, coords],
      },
      properties: { horizon },
    };
  });

  return {
    points: {
      type: "FeatureCollection",
      features: points,
    } as FeatureCollection<Point>,
    links: {
      type: "FeatureCollection",
      features: links,
    } as FeatureCollection<LineString>,
  };
}

/**
 * The line under a card's name.
 *
 * The proximity label used to render as its own chip floating between the
 * subtitle and the status, which is where it read as a third unrelated fact.
 * It belongs with the subtitle — "Gachibowli · Short Drive" is one thought
 * about where the place is, not two.
 *
 * Returns an empty string rather than a placeholder when there is nothing to
 * say, and the card then omits the line rather than printing the same filler
 * on every row.
 */
function cardSubtitle(item: NeighbourhoodItem | NearbyPlaceItem): string {
  const proximity =
    "proximityLabel" in item && item.proximityLabel ? item.proximityLabel : "";
  const parts = item.detail
    .split(" · ")
    .filter(
      (part) =>
        part !== item.kind &&
        part !== proximity &&
        !/drive time claim|employment hub/i.test(part),
    );
  if (proximity) parts.push(proximity);
  return parts.join(" · ");
}

export default function FutureNeighbourhoodMap({
  property,
}: {
  property: PropertyRecord;
}) {
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [nearBy, setNearBy] = useState(false);
  const [nearByStatus, setNearByStatus] = useState<NearByStatus>("idle");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [apiPlaces, setApiPlaces] = useState<ApiNearbyPlace[] | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [mapHint, setMapHint] = useState<"touch" | "desktop">("touch");
  const [showMapHint, setShowMapHint] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const selectedMapItemRef = useRef<string | null>(null);
  const hoveredMapItemRef = useRef<string | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const readyRef = useRef(false);

  const resetMapView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(new LngLatBounds(origin, origin), {
      padding: 90,
      maxZoom: 14.5,
      duration: 700,
    });
    setSelectedItemId(null);
  };

  // Fetch live nearby places from /api/properties/{id}/nearby-places when property ID is a UUID
  // Or fallback to the sample property UUID (6429f090-c01d-4bcc-9145-b9bfb8595843)
  useEffect(() => {
    const targetPropertyId = isPropertyUuid(property.id)
      ? property.id
      : "6429f090-c01d-4bcc-9145-b9bfb8595843";

    const controller = new AbortController();
    setIsLoadingApi(true);

    fetchNearbyPlaces(targetPropertyId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(data) && data.length > 0) {
          setApiPlaces(data);
        } else {
          setApiPlaces(null);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("[neighbourhood] nearby-places fetch failed, using fallback catalogue:", error);
        setApiPlaces(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingApi(false);
        }
      });

    return () => controller.abort();
  }, [property.id]);

  const items: (NeighbourhoodItem | NearbyPlaceItem)[] = useMemo(() => {
    if (apiPlaces && apiPlaces.length > 0) {
      const mapped = apiPlaces.map(mapApiNearbyPlace);
      const filtered = mapped.filter((item) => item.horizon === horizon);
      // If there are no items for this horizon specifically (e.g. all places are OPERATIONAL),
      // show the operational ones rather than leaving the section empty
      if (filtered.length > 0) {
        return filtered;
      }
      return mapped;
    }

    return horizon === "today"
      ? property.neighbourhood.existing
      : property.neighbourhood.proposed;
  }, [apiPlaces, horizon, property.neighbourhood.existing, property.neighbourhood.proposed]);

  const [showAll, setShowAll] = useState(false);
  const [isDesktopList, setIsDesktopList] = useState(false);
  // The desktop map is 34rem tall; four two-card rows use that available
  // height much better than the previous three rows while the button keeps
  // the remaining options discoverable.
  const collapsedItemCount = isDesktopList ? 8 : 3;
  const visibleItems = showAll ? items : items.slice(0, collapsedItemCount);
  const hiddenItemCount = Math.max(items.length - collapsedItemCount, 0);
  const categoryHeading =
    items.length > 0 &&
    items.every((item) => /business|employment|it park/i.test(item.kind))
      ? "Employment hubs"
      : "Nearby landmarks";

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 760px)");
    const updateDesktopList = () => setIsDesktopList(mediaQuery.matches);
    updateDesktopList();
    mediaQuery.addEventListener("change", updateDesktopList);
    return () => mediaQuery.removeEventListener("change", updateDesktopList);
  }, []);

  const origin: [number, number] = property.coordinates;

  const geo = useMemo(
    () => buildGeoJson(items, origin, horizon),
    [items, origin, horizon],
  );

  const fromGachibowli = useMemo(
    () => distanceFromGachibowliKm(property),
    [property],
  );

  const handleNearByClick = () => {
    if (nearBy) {
      setNearBy(false);
      setNearByStatus("idle");
      return;
    }

    setNearBy(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNearByStatus("denied");
      return;
    }

    setNearByStatus("locating");
    navigator.geolocation.getCurrentPosition(
      () => setNearByStatus("located"),
      () => setNearByStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  /**
   * Hovering a card grows its pin.
   *
   * Driven through feature-state rather than a `Marker`, because the pins are
   * GeoJSON circle layers sharing one source — the layer paint reads the state
   * and the browser animates the radius for free. `hoveredMapItemRef` tracks
   * the last card so a card that unmounts mid-hover (show-all collapsed,
   * horizon switched) cannot leave a pin stuck at full size.
   *
   * Pointer-only. On touch, `mouseenter` fires on tap and `mouseleave` waits
   * for the next tap somewhere else, so an unguarded pin would stay enlarged
   * after the finger is gone.
   */
  const setMapItemHover = (itemId: string | null) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) {
      return;
    }
    const previous = hoveredMapItemRef.current;
    if (previous && previous !== itemId) {
      map.setFeatureState({ source: ITEMS_SOURCE, id: previous }, { hover: false });
    }
    hoveredMapItemRef.current = itemId;
    /* Only ids that are actually in the current horizon's source. `setData`
       drops every feature not in the new payload, and writing state for a
       missing id is an error MapLibre reports rather than ignores. */
    if (itemId && items.some((item) => item.id === itemId)) {
      map.setFeatureState({ source: ITEMS_SOURCE, id: itemId }, { hover: true });
    }
  };

  /**
   * One popup at a time.
   *
   * A card click and a pin click both land here, and a second `addTo` without
   * removing the first stacks two popups on the same screen. Holds the live
   * instance so the next open can clear it.
   */
  const openPopup = (coords: [number, number], name: string, meta?: string) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();

    const content = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = name;
    content.appendChild(title);
    if (meta) {
      const metaLine = document.createElement("span");
      metaLine.textContent = meta;
      content.appendChild(document.createElement("br"));
      content.appendChild(metaLine);
    }

    popupRef.current = new Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "240px",
    })
      .setLngLat(coords)
      .setDOMContent(content)
      .addTo(map);
  };

  const focusMapItem = (item: NeighbourhoodItem | NearbyPlaceItem) => {
    setSelectedItemId(item.id);
    document.querySelector(".pd-future__map")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const map = mapRef.current;
    if (!map) return;

    const targetCoords =
      Array.isArray(item.coordinates) &&
      Number.isFinite(item.coordinates[0]) &&
      Number.isFinite(item.coordinates[1]) &&
      !(item.coordinates[0] === 0 && item.coordinates[1] === 0)
        ? (item.coordinates as [number, number])
        : origin;

    const bounds = new LngLatBounds(origin, origin);
    bounds.extend(targetCoords);
    map.fitBounds(bounds, {
      padding: 90,
      maxZoom: 14.5,
      duration: 800,
    });

    /* Opened straight away rather than on `moveend`. A MapLibre popup re-anchors
       to its coordinate on every move, so it travels with the camera and lands
       where the pin does — deferring it to `moveend` just delays a popup the
       visitor can already see. */
    openPopup(targetCoords, item.name, cardSubtitle(item));
  };

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Absolute worker URL, matching the developments map on the homepage.
    setWorkerUrl(
      new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin)
        .toString(),
    );

    let map: MapLibreMap;
    let plotLabelMarker: Marker | null = null;
    let hintTimer: number | undefined;
    try {
      map = new MapLibre({
        container: containerRef.current,
        style: MAP_STYLE,
        center: origin,
        zoom: property.zoom,
        pitch: 0,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures:
          typeof window !== "undefined" &&
          !window.matchMedia("(min-width: 760px)").matches,
      });
    } catch (error) {
      console.error("Unable to initialise the neighbourhood map", error);
      // Deferred: reporting this needs a render, not a synchronous update
      // inside the effect body.
      queueMicrotask(() => setMapFailed(true));
      return;
    }

    mapRef.current = map;
    const isDesktop = window.matchMedia("(min-width: 760px)").matches;
    setMapHint(isDesktop ? "desktop" : "touch");
    if (isDesktop) map.scrollZoom.disable();
    if (isDesktop) {
      hintTimer = window.setTimeout(() => setShowMapHint(false), 3000);
    }
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const resetControl = document.createElement("button");
    resetControl.type = "button";
    resetControl.className = "pd-future__reset-control";
    resetControl.setAttribute("aria-label", "Reset map view to plot");
    resetControl.textContent = "Reset view";
    resetControl.addEventListener("click", resetMapView);
    const resetControlGroup = document.createElement("div");
    resetControlGroup.className = "maplibregl-ctrl maplibregl-ctrl-group pd-future__reset-group";
    resetControlGroup.appendChild(resetControl);
    map.addControl({
      onAdd: () => resetControlGroup,
      onRemove: () => resetControl.removeEventListener("click", resetMapView),
      getDefaultPosition: () => "top-right",
    }, "top-right");

    map.on("error", (event) => {
      console.error("Neighbourhood map error", event.error);
      if (!readyRef.current) setMapFailed(true);
    });

    map.on("load", () => {
      readyRef.current = true;

      map.addSource(ORIGIN_SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: origin },
              properties: { label: property.neighbourhood.mapLabel },
            },
          ],
        },
      });

      map.addSource(ITEMS_SOURCE, {
        type: "geojson",
        data: geo.points,
        promoteId: "id",
      });

      map.addSource(LINKS_SOURCE, {
        type: "geojson",
        data: geo.links,
      });

      map.addLayer({
        id: "future-link-line",
        type: "line",
        source: LINKS_SOURCE,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#b9a47c",
          "line-width": 1.5,
          "line-opacity": 0.4,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "future-item-halo",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          /* Selected wins over hovered, so a click does not get undone by the
             pointer still being over the card. Hover is 13 x 1.25 rounded. */
          "circle-radius": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            20,
            ["boolean", ["feature-state", "hover"], false],
            16,
            13,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "horizon"], "2029"],
            "#c6a46c",
            "#1f5c45",
          ],
          "circle-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.42,
            ["boolean", ["feature-state", "hover"], false],
            0.32,
            0.25,
          ],
        },
      });

      map.addLayer({
        id: "future-item-dot",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          "circle-radius": isDesktop ? 14 : [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            10,
            ["boolean", ["feature-state", "hover"], false],
            9,
            7,
          ],
          "circle-color": isDesktop ? "#1f5c45" : [
            "case",
            ["==", ["get", "horizon"], "2029"],
            "#c6a46c",
            "#1f5c45",
          ],
          "circle-stroke-color": isDesktop ? "#ffffff" : [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#c6a46c",
            "#ffffff",
          ],
          "circle-stroke-width": isDesktop ? 2 : [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            4,
            2.5,
          ],
        },
      });

      map.addLayer({
        id: "future-item-number",
        type: "symbol",
        source: ITEMS_SOURCE,
        layout: {
          "text-field": ["to-string", ["get", "number"]],
          "text-size": isDesktop ? 14 : 11,
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#1f5c45",
          "text-halo-width": 1,
        },
      });

      map.addLayer({
        id: "future-origin-halo",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 21,
          "circle-color": "#c6a46c",
          "circle-opacity": 0.18,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#c6a46c",
        },
      });

      if (isDesktop) {
        const plotLabel = document.createElement("span");
        plotLabel.className = "pd-future__plot-label";
        plotLabel.textContent = "Your plot";
        plotLabelMarker = new Marker({
          element: plotLabel,
          anchor: "left",
          offset: [18, 0],
        })
          .setLngLat(origin)
          .addTo(map);
      }

      map.addLayer({
        id: "future-origin-dot",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 11,
          "circle-color": "#c6a46c",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#6f5424",
        },
      });

      const showPopup = (event: MapMouseEvent) => {
        const feature = map.queryRenderedFeatures(event.point, {
          layers: ["future-item-dot", "future-origin-dot"],
        })[0];
        if (!feature) return;
        const properties = feature.properties as { name?: string; meta?: string; label?: string };
        openPopup(
          [event.lngLat.lng, event.lngLat.lat],
          properties.name ?? properties.label ?? "Plot",
          properties.meta,
        );
      };
      map.on("click", "future-item-dot", showPopup);
      map.on("click", "future-origin-dot", showPopup);
      map.on("click", () => {
        if (!isDesktop || map.scrollZoom.isEnabled()) return;
        map.scrollZoom.enable();
        setShowMapHint(false);
      });
      map.on("mouseenter", "future-item-dot", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "future-item-dot", () => { map.getCanvas().style.cursor = ""; });
    });

    return () => {
      readyRef.current = false;
      mapRef.current = null;
      if (hintTimer) window.clearTimeout(hintTimer);
      plotLabelMarker?.remove();
      map.remove();
    };
    // The map is created once; data updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the current horizon's data into the map and keep everything in frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyData = () => {
      try {
        const itemsSource = map.getSource(ITEMS_SOURCE) as GeoJSONSource | undefined;
        const linksSource = map.getSource(LINKS_SOURCE) as GeoJSONSource | undefined;
        itemsSource?.setData(geo.points);
        linksSource?.setData(geo.links);

        if (selectedMapItemRef.current) {
          map.removeFeatureState({
            source: ITEMS_SOURCE,
            id: selectedMapItemRef.current,
          });
        }
        if (selectedItemId) {
          map.setFeatureState(
            { source: ITEMS_SOURCE, id: selectedItemId },
            { selected: true },
          );
        }
        selectedMapItemRef.current = selectedItemId;

        /* `setData` above replaced every feature, so any hover state went with
           it. Forget the id too, or the next hover would try to clear a
           feature that no longer exists. */
        hoveredMapItemRef.current = null;

        /* A popup anchored to a pin that is no longer on screen is worse than
           none — close it before the new horizon refits the camera. */
        popupRef.current?.remove();

        if (geo.points.features.length === 0) return;

        // Frame the plot plus every landmark, using the same coordinates that
        // were just pushed into the source.
        const bounds = new LngLatBounds(origin, origin);
        for (const feature of geo.points.features) {
          bounds.extend(feature.geometry.coordinates as [number, number]);
        }

        map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 600 });
      } catch (err) {
        console.warn("[neighbourhood map] data update error", err);
      }
    };

    if (!readyRef.current || !map.isStyleLoaded()) {
      map.once("load", applyData);
      return () => {
        map.off("load", applyData);
      };
    }

    applyData();
  }, [geo, origin, selectedItemId]);

  // The map lives in a fluid grid column, so it must re-measure on resize.
  useEffect(() => {
    const map = mapRef.current;
    const node = containerRef.current;
    if (!map || !node) return;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="pd-section pd-future" aria-labelledby="pd-future-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Future neighbourhood</p>
        <h2 id="pd-future-title">Not just today. A brighter 2029.</h2>
        <p className="pd-section__lead">
          Toggle between what already surrounds this plot and the infrastructure
          expected to reshape the belt over the next few years.
        </p>

        <div className="pd-future__toggles">
          <div className="pd-segment" role="group" aria-label="Time horizon">
            <button
              type="button"
              className={horizon === "today" ? "is-active" : ""}
              aria-pressed={horizon === "today"}
              onClick={() => setHorizon("today")}
            >
              Today
            </button>
            <button
              type="button"
              className={horizon === "2029" ? "is-active" : ""}
              aria-pressed={horizon === "2029"}
              onClick={() => setHorizon("2029")}
            >
              In 2029
            </button>
          </div>
          <button
            type="button"
            className={`pd-chip${nearBy ? " is-active" : ""}`}
            aria-pressed={nearBy}
            onClick={handleNearByClick}
          >
            <svg className="pd-future__location-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.25" />
            </svg>
            Near by me
          </button>
        </div>

        {nearBy && nearByStatus === "locating" ? (
          <p className="pd-future__near" aria-live="polite">
            <span className="ila-loader ila-loader--sm" aria-hidden />
            Locating you…
          </p>
        ) : null}
        {nearBy && nearByStatus === "denied" ? (
          <p className="pd-future__near pd-future__near--error" aria-live="polite">
            Location permission was denied. Enable it in your browser settings to
            use this filter.
          </p>
        ) : null}
        {nearBy && nearByStatus === "located" ? (
          <p className="pd-future__near" aria-live="polite">
            ~{fromGachibowli.toFixed(1)} km from Gachibowli (demo) — not device
            GPS.
          </p>
        ) : null}

        <div className="pd-future__layout">
          <div className="pd-future__map">
            <div
              ref={containerRef}
              className="pd-future__canvas"
              role="application"
              aria-label={`Map of ${property.neighbourhood.mapLabel} and nearby landmarks`}
            />
            {showMapHint ? (
              <p className={`pd-future__map-hint is-${mapHint}`}>
                {mapHint === "desktop" ? "Click to interact" : "Use two fingers to move the map"}
              </p>
            ) : null}
            {mapFailed ? (
              <p className="pd-future__map-error">
                Map unavailable offline — the list beside it still has the full
                detail.
              </p>
            ) : null}
          </div>

          <div className={`pd-future__list-group${showAll ? " is-expanded" : ""}`}>
            <div className="pd-future__list-heading">
              <h3 className="pd-future__category">{categoryHeading}</h3>
              <span className="pd-future__list-count">{items.length} places</span>
            </div>
            <ul key={horizon} className="pd-future__list pd-future__list--changing">
            {isLoadingApi && items.length === 0 ? (
              <li className="pd-future__card">
                <p className="inline-flex items-center gap-2 text-sm text-neutral-500">
                  <span className="ila-loader ila-loader--sm" aria-hidden />
                  Loading nearby landmarks…
                </p>
              </li>
            ) : null}
            {visibleItems.map((item, index) => {
              const subtitle = cardSubtitle(item);
              return (
                <li
                  key={item.id}
                  className="pd-future__card"
                  role="button"
                  tabIndex={0}
                  onClick={() => focusMapItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      focusMapItem(item);
                    }
                  }}
                  onMouseEnter={() => setMapItemHover(item.id)}
                  onMouseLeave={() => setMapItemHover(null)}
                  onFocus={() => setMapItemHover(item.id)}
                  onBlur={() => setMapItemHover(null)}
                >
                  <span className="pd-future__card-number" aria-hidden="true">
                    {index + 1}
                  </span>

                  <div className="pd-future__card-main">
                    {/* An h4, not a span: the category above is the h3, and the
                        card name is the thing inside it. It was an h3 before,
                        which put every card at the same level as the heading
                        that contains it. */}
                    <h4 className="pd-future__card-name">{item.name}</h4>
                    {/* Rendered only when there is something to say. The old
                        fallback was the literal "Nearby landmark", identical on
                        every card and a restatement of the NEARBY LANDMARKS
                        heading directly above it. */}
                    {subtitle ? (
                      <p className="pd-future__card-sub">{subtitle}</p>
                    ) : null}
                  </div>

                  <div className="pd-future__card-side">
                    {item.distanceKm > 0 ? (
                      <p className="pd-future__dist">
                        {formatDistanceDisplay(item.distanceKm)} away
                      </p>
                    ) : null}
                    <p
                      className={`pd-future__status${
                        item.status.toLowerCase() === "operational"
                          ? " is-operational"
                          : " is-upcoming"
                      }`}
                    >
                      <span className="pd-future__status-dot" aria-hidden="true" />
                      {item.status}
                    </p>
                  </div>
                </li>
              );
            })}
            </ul>
            {items.length > 3 ? (
              <button
                type="button"
                className="pd-future__show-all"
                aria-expanded={showAll}
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Show less" : `Show ${hiddenItemCount} more`}
                <svg
                  className={`pd-future__chevron${showAll ? " is-up" : ""}`}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}