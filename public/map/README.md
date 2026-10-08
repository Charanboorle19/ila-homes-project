# Master Plan — 3D Connectivity Map

Interactive real-estate **master plan** demo: sale plots, floating local GLB/GLTF place icons, bike/car routes with time & distance, year timeline (2015 → 2031), and a guided tour that frames plot + place.

**No map API key. No paid tile account.** Basemap is [OpenFreeMap](https://openfreemap.org/) dark streets.

---

## Quick start

Serve the folder over HTTP (required for GLB/GLTF modules):

```bash
cd "map sample"
python3 -m http.server 8080
```

Open: **http://localhost:8080/**

Hard-refresh (Cmd+Shift+R) after code or model changes.

> Do not open `index.html` as `file://` — ES modules and large models will fail.

---

## What’s included

| Feature | Behaviour |
| :--- | :--- |
| **Dark street map** | OpenFreeMap style — free, no API key |
| **Sale plots** | Green available units + sold villa (3D extrusions) |
| **Place icons** | Local GLB/GLTF floating above sites with gentle yaw |
| **One route at a time** | Plot gate → selected place; auto-cycles until you tap |
| **Bike / Car** | Minutes + km on list, map label, and bottom chip |
| **Years** | 2015 / 2021 / 2026 / 2031 unlock places & story card |
| **Play tour** | Zoom out (plot + place) → zoom in on place → zoom out again; insight card updates |
| **Resume auto** | Clears locked route and restarts auto route cycle |

---

## Project files

```
map sample/
├── index.html              # UI + MapLibre map, routes, tour, years
├── model-buildings.js      # Three.js custom layer for local GLB/GLTF
├── cafe.glb                # Park icon
├── airport.glb
├── store.glb               # Mall
├── bank.glb                # Finance
├── school.gltf
├── hospital.glb
├── README.md               # This file
└── sample_interactive_real_estate_map_guide.md   # Original free-stack guide
```

### Icon mapping

| Place | File |
| :--- | :--- |
| Park | `cafe.glb` |
| Airport | `airport.glb` |
| Mall | `store.glb` |
| Finance | `bank.glb` |
| School | `school.gltf` |
| Hospital | `hospital.glb` |
| Metro / Bus / IT | Labels + dots only (no model file yet) |

---

## Stack (lifetime free)

- **MapLibre GL JS** 4.7 (CDN)
- **OpenFreeMap** dark vector basemap (no key)
- **Three.js** r160 + `GLTFLoader` (CDN) for local models
- Plain HTML/CSS/JS — no build step

Paid hosts (MapTiler, Mapbox, Stadia, etc.) are blocked in `transformRequest` so “API required” watermarks do not appear.

---

## Controls

| Control | Action |
| :--- | :--- |
| **Year buttons / timeline** | Switch development year |
| **Bike / Car** | Travel mode for times & distances |
| **Place list / map label / dot** | Lock that route; stops auto cycle & tour |
| **Play tour** | Guided plot ↔ place framing + insight card |
| **Play years** | Step through 2015 → 2031 |
| **Resume auto** | Unlock route; resume place-to-place line cycle |

---

## Customise

**Move places** — edit `SITE` in `index.html` (lng/lat pairs).

**Icon size / float height** — edit `modelPlacements`:

```js
{ id: 'school', url: './school.gltf', lngLat: SITE.school, since: 2021, sizeMeters: 155, floatMeters: 30 }
```

**Routes** — edit `destinations` (`bike` / `car` `km`, `min`, `path`).

**Tour stops** — edit `tourStops` (year, dest, title, body, timing).

**Add a new GLB** — drop the file in this folder, add an entry to `modelPlacements`, and a matching `destinations` / `SITE` entry.

---

## Notes

- First load can take a while (`school.gltf` and `hospital.glb` are large).
- MapLibre + Three.js need network once for the CDN; tiles need network for OpenFreeMap.
- Models are served from disk only — nothing is uploaded to a 3D cloud API.

---

## License / attribution

Map data © OpenStreetMap contributors via OpenFreeMap. Libraries: MapLibre GL JS, Three.js (their respective licenses).
