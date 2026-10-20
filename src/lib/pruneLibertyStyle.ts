import type { StyleSpecification } from "maplibre-gl";

/**
 * OpenFreeMap Liberty ships layers this product never shows (rail, 3D
 * buildings, footpaths, highway shields, airport POIs). Dropping them before
 * MapLibre commits the style avoids unused glyph (.pbf) downloads and skips
 * bucket work for those layers during tile parse on mobile CPUs.
 */
export function shouldDropLibertyLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();

  if (id.includes("rail")) return true;
  if (id === "building-3d") return true;
  if (id.includes("path_pedestrian") || id.includes("path-pedestrian")) {
    return true;
  }
  if (id === "highway-name-path") return true;
  if (id.includes("shield")) return true;
  if (id === "airport") return true;

  return false;
}

export function pruneLibertyStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter((layer) => !shouldDropLibertyLayer(layer.id)),
  };
}

type CachedLibertyStyle = {
  url: string;
  promise: Promise<StyleSpecification>;
};

let cachedLibertyStyle: CachedLibertyStyle | null = null;

/** Fetches Liberty, prunes unused layers, and clones so MapLibre can mutate safely. */
export function loadPrunedLibertyStyle(
  url: string,
): Promise<StyleSpecification> {
  if (!cachedLibertyStyle || cachedLibertyStyle.url !== url) {
    cachedLibertyStyle = {
      url,
      promise: fetch(url).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load OpenFreeMap style (${response.status})`,
          );
        }
        const style = (await response.json()) as StyleSpecification;
        return pruneLibertyStyle(style);
      }),
    };
  }

  return cachedLibertyStyle.promise.then(
    (style) => JSON.parse(JSON.stringify(style)) as StyleSpecification,
  );
}
