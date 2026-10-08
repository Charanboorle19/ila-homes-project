# Free Interactive Real Estate Map Guide

This guide provides a zero-cost, open-source setup for building an interactive 3D plot map using **MapLibre GL JS** and **OpenFreeMap**. No API keys, credit cards, or paid subscriptions are required.

---

## 1. Feature Coverage

| Feature | How It Is Implemented |
| :--- | :--- |
| **Interactive Plot Layouts** | Polygons rendered via GeoJSON with clickable inspection modals |
| **Pointers & Connectivity** | Native markers for transport hubs, schools, and access points |
| **Route Tracing** | GeoJSON `LineString` elements with custom stroke colors |
| **Present vs. Future 3D Structures** | MapLibre `fill-extrusion` layers extruded by a `height` property |
| **Globe & 3D Tilt View** | Native MapLibre globe projection and dynamic pitch controls |

---

## 2. Complete Standalone Implementation

Save the code below as an `index.html` file and open it in any modern browser.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interactive Real Estate Master Plan</title>
  
  <!-- MapLibre GL CSS and JavaScript -->
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>

  <style>
    * { box-sizing: border-box; }
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    #map { width: 100vw; height: 100vh; }

    /* Floating Legend and Control Panel */
    .map-overlay {
      position: absolute;
      top: 16px;
      left: 16px;
      background: rgba(255, 255, 255, 0.95);
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      z-index: 10;
      max-width: 280px;
    }
    .map-overlay h2 { margin: 0 0 8px 0; font-size: 1.1rem; }
    .map-overlay p { margin: 0 0 12px 0; font-size: 0.85rem; color: #555; }
    .legend-item { display: flex; align-items: center; margin-bottom: 6px; font-size: 0.82rem; }
    .legend-color { width: 14px; height: 14px; border-radius: 3px; margin-right: 8px; }

    /* Custom Popup Styling */
    .maplibregl-popup-content {
      border-radius: 8px;
      padding: 14px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.2);
    }
    .popup-title { font-weight: bold; font-size: 1rem; margin-bottom: 4px; }
    .popup-badge { display: inline-block; padding: 2px 6px; font-size: 0.72rem; border-radius: 4px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
    .badge-available { background: #d3f9d8; color: #2b8a3e; }
    .badge-sold { background: #ffe3e3; color: #c92a2a; }
    .badge-planned { background: #e7f5ff; color: #1971c2; }
    .popup-metric { font-size: 0.85rem; margin: 3px 0; color: #333; }
  </style>
</head>
<body>

  <div class="map-overlay">
    <h2>Project Master Plan</h2>
    <p>Click on any plot or route to inspect details.</p>
    <div class="legend-item"><div class="legend-color" style="background: #2b8a3e;"></div> Available Plots</div>
    <div class="legend-item"><div class="legend-color" style="background: #e03131;"></div> Reserved / Sold</div>
    <div class="legend-item"><div class="legend-color" style="background: #4dabf7;"></div> Future Phase 3D</div>
    <div class="legend-item"><div class="legend-color" style="background: #f59f00;"></div> Access Arterial Road</div>
  </div>

  <div id="map"></div>

  <script>
    // 1. Initialize MapLibre with a Free Vector Style (No API Key Required)
    const map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: [78.3826, 17.4483], // [Lng, Lat]
      zoom: 16.5,
      pitch: 50, // 3D Tilt perspective
      bearing: -15
    });

    // Add navigation controls (zoom, pitch, rotation)
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // 2. Embedded GeoJSON Data: Plots, Routes, and Amenity Pointers
    const projectData = {
      type: 'FeatureCollection',
      features: [
        // Present Plot 101 (Available)
        {
          type: 'Feature',
          properties: {
            id: 'PL-101',
            title: 'Plot 101 (Commercial / Retail)',
            status: 'available',
            area_sqft: '4,500 sq.ft',
            price: '$120,000',
            height: 12,
            color: '#2b8a3e'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [78.3815, 17.4480],
              [78.3822, 17.4480],
              [78.3822, 17.4486],
              [78.3815, 17.4486],
              [78.3815, 17.4480]
            ]]
          }
        },
        // Present Plot 102 (Sold)
        {
          type: 'Feature',
          properties: {
            id: 'PL-102',
            title: 'Plot 102 (Villa Plot)',
            status: 'sold',
            area_sqft: '3,200 sq.ft',
            price: '$95,000',
            height: 8,
            color: '#e03131'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [78.3824, 17.4480],
              [78.3831, 17.4480],
              [78.3831, 17.4486],
              [78.3824, 17.4486],
              [78.3824, 17.4480]
            ]]
          }
        },
        // Future Phase High-Rise Tower (Planned Development)
        {
          type: 'Feature',
          properties: {
            id: 'TOWER-A',
            title: 'Phase II: Skyline Tower (Planned)',
            status: 'planned',
            area_sqft: '42,000 sq.ft total built-up',
            price: 'Launching Q4 2027',
            height: 38,
            color: '#4dabf7'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [78.3817, 17.4490],
              [78.3828, 17.4490],
              [78.3828, 17.4497],
              [78.3817, 17.4497],
              [78.3817, 17.4490]
            ]]
          }
        },
        // Planned Internal Road / Connectivity Route
        {
          type: 'Feature',
          properties: {
            id: 'ROAD-01',
            title: 'Direct Main Access Boulevard',
            width: '60 ft Wide Road'
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [78.3805, 17.4475],
              [78.3823, 17.4475],
              [78.3835, 17.4488],
              [78.3840, 17.4502]
            ]
          }
        }
      ]
    };

    map.on('style.load', () => {
      // Set globe projection for low zoom levels
      map.setProjection({ type: 'globe' });

      // Add our unified GeoJSON source
      map.addSource('site-data', {
        type: 'geojson',
        data: projectData
      });

      // 3. Render 3D Extruded Buildings & Plots
      map.addLayer({
        id: 'plot-extrusion',
        type: 'fill-extrusion',
        source: 'site-data',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });

      // 4. Render Connectivity Routes
      map.addLayer({
        id: 'connectivity-routes',
        type: 'line',
        source: 'site-data',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#f59f00',
          'line-width': 5,
          'line-dasharray': [2, 1] // Creates dashed road pattern
        }
      });

      // 5. Add Connectivity Pointers (Points of Interest)
      const metroMarker = document.createElement('div');
      metroMarker.innerHTML = '🚇';
      metroMarker.style.fontSize = '22px';
      metroMarker.style.cursor = 'pointer';

      new maplibregl.Marker({ element: metroMarker })
        .setLngLat([78.3805, 17.4475])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML('<b>Metro Station Connector</b><br>5 mins walk'))
        .addTo(map);

      // 6. Interactive Click Listener for 3D Plots
      map.on('click', 'plot-extrusion', (e) => {
        if (!e.features.length) return;
        const props = e.features[0].properties;

        const badgeClass = `badge-${props.status}`;

        const html = `
          <div class="popup-title">${props.title}</div>
          <span class="popup-badge ${badgeClass}">${props.status}</span>
          <div class="popup-metric"><strong>Area:</strong> ${props.area_sqft}</div>
          <div class="popup-metric"><strong>Price / Status:</strong> ${props.price}</div>
        `;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });

      // Cursor change on hover
      map.on('mouseenter', 'plot-extrusion', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'plot-extrusion', () => { map.getCanvas().style.cursor = ''; });
    });
  </script>
</body>
</html>
```

---

## 3. How to Customize Coordinates for Your Client

1. Open [geojson.io](https://geojson.io) in your browser.
2. Navigate to your client's plot site on the satellite layer.
3. Use the polygon tool to draw plot boundaries and the line tool to draw access routes.
4. Add properties such as `title`, `area_sqft`, `price`, `height`, and `color` in the right-side table.
5. Save the generated output as `plots.geojson` and link it directly via `data: './plots.geojson'` in `map.addSource()`.