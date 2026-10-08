const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "src", "data", "projects", "geo");

function mercToWgs(x, y) {
  const lng = (x / 20037508.34) * 180;
  let lat = (y / 20037508.34) * 180;
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lng, lat];
}

function looksProjected(coords) {
  const flat = [];
  (function walk(v) {
    if (typeof v === "number") {
      flat.push(v);
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
  })(coords);
  return flat.some((n) => Math.abs(n) > 180);
}

function reprojectGeometry(geometry) {
  if (!geometry) return geometry;
  const mapCoords = (coords) => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      return looksProjected([x, y]) ? mercToWgs(x, y) : [x, y];
    }
    return coords.map(mapCoords);
  };
  return {
    ...geometry,
    coordinates: mapCoords(geometry.coordinates),
  };
}

function normalizeCollection(raw, { reproject = false } = {}) {
  return {
    type: "FeatureCollection",
    name: raw.name,
    features: (raw.features || []).map((feature) => ({
      type: "Feature",
      properties: feature.properties || {},
      geometry: reproject
        ? reprojectGeometry(feature.geometry)
        : feature.geometry,
    })),
  };
}

function writeJson(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log("wrote", name, "features", data.features.length);
}

function bbox(collection) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  const walk = (v) => {
    if (typeof v[0] === "number") {
      minLng = Math.min(minLng, v[0]);
      maxLng = Math.max(maxLng, v[0]);
      minLat = Math.min(minLat, v[1]);
      maxLat = Math.max(maxLat, v[1]);
      return;
    }
    v.forEach(walk);
  };
  for (const f of collection.features) walk(f.geometry.coordinates);
  return { minLng, minLat, maxLng, maxLat };
}

const demo3 = path.join(ROOT, "src", "components", "ila-demo-3");

const meadowsPlots = normalizeCollection(
  JSON.parse(
    fs.readFileSync(path.join(demo3, "green_medows_plots.geojson"), "utf8"),
  ),
);
const meadowsRoads = normalizeCollection(
  JSON.parse(
    fs.readFileSync(path.join(demo3, "green_medows_roads.geojson"), "utf8"),
  ),
);
const meadowsOpen = normalizeCollection(
  JSON.parse(
    fs.readFileSync(path.join(demo3, "green_medows_open_areas.geojson"), "utf8"),
  ),
);

writeJson("green-meadows-plots.json", meadowsPlots);
writeJson("green-meadows-roads.json", meadowsRoads);
writeJson("green-meadows-open-areas.json", meadowsOpen);

console.log("meadows plots bbox", bbox(meadowsPlots));
console.log("meadows roads bbox", bbox(meadowsRoads));
