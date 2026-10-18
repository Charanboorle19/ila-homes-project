# Property Details & Units API Documentation

This document explains the two essential endpoints used to load full property details, georeferenced raster layout plans, and plot-level vector geometries:
1. `GET /api/properties/{id}` — Full property details and anchor coordinates.
2. `GET /api/properties/{id}/units` — Plot-level polygons, availability, and master-plan scan URLs.

---

## 1. Property Details API: `GET /api/properties/{id}`

### Overview
When a visitor selects a development pin on the map, this endpoint fetches the complete metadata for that property. It supplies essential real estate specifications (pricing, inventory, RERA status, developer notes) and authoritative geographic coordinates.

### Endpoint Specification
* **Method:** `GET`
* **Path:** `/api/properties/{id}`
* **Path Parameter:**
  * `id` *(UUID string, required)*: The unique property UUID (e.g., `aa7de8b7-1f4b-4299-844a-0df91296d732`). Passing a slug returns a validation error.

### Example Request
```http
GET /api/properties/aa7de8b7-1f4b-4299-844a-0df91296d732
```

### Sample Response
```json
{
  "success": true,
  "data": {
    "id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
    "name": "Akshitha's Golden Crown",
    "slug": "akshithas-golden-crown",
    "property_type": "PLOTS",
    "listing_type": "SALE",
    "price": 3500000,
    "minimum_price": "3500000.00",
    "target_price": "4200000.00",
    "price_label": "₹35 Lakhs onwards",
    "price_per_sqft": 1450,
    "negotiable": true,
    "total_inventory": 142,
    "available_inventory": 48,
    "sold_inventory": 94,
    "status": "PUBLISHED",
    "description": "HMDA & RERA approved premium gated community plots offering luxury clubhouse and sports amenities.",
    "address": "Survey No. 124, Near Bangalore Highway",
    "locality": "Shadnagar",
    "city": "Hyderabad",
    "state": "Telangana",
    "pincode": "509216",
    "latitude": 17.072234,
    "longitude": 78.204512,
    "area": 25.5,
    "rera_registered": true,
    "rera_number": "P02400004512",
    "approval_details": "HMDA Approved Layout",
    "cover_url": "https://example-bucket.s3.amazonaws.com/properties/akshitha-cover.jpg",
    "amenities": [
      "Clubhouse",
      "Swimming Pool",
      "24/7 Security",
      "Children's Play Area",
      "Underground Drainage",
      "Street Lighting"
    ],
    "property_layout_cords": {
      "north": 17.074500,
      "south": 17.069900,
      "east": 78.206800,
      "west": 78.202100
    }
  }
}
```

### Key Fields Explained
* `latitude` / `longitude`: Primary anchor point used to position the project pointer pin on the map.
* `property_layout_cords`: Geographic bounding box (`north`, `south`, `east`, `west`) in WGS84 degrees. Used to georeference and align the master plan layout drawing on top of real-world terrain.
* `available_inventory` vs `total_inventory`: Live plot counters displayed in status badges and the property bottom sheet.

### Function Implementation
```typescript
async function fetchPropertyById(
  id: string,
  signal?: AbortSignal,
): Promise<ApiProperty> {
  const response = await apiFetch<{ success?: boolean; data?: ApiProperty }>(
    `/api/properties/${encodeURIComponent(id)}`,
    { signal },
  );

  if (!response?.data) {
    throw new Error("Property not found");
  }

  return response.data;
}
```

---

## 2. Property Units & Master-Plan API: `GET /api/properties/{id}/units`

### Overview
This endpoint provides the granular data required to draw individual plots and the master-plan drawing over the map:
1. **Plot Vector Polygons:** GeoJSON coordinates, plot numbers, dimensions, facing, and status (`available` vs `sold`).
2. **Master-Plan Raster Scan:** Presigned S3 URLs (`layout_preview_url` and `tifUrl`) for the architectural blueprint image.

### Endpoint Specification
* **Method:** `GET`
* **Path:** `/api/properties/{id}/units`
* **Query Parameters:**
  * `limit=all` (Requests all units)
  * `offset=0` (Pagination cursor)

### Example Request
```http
GET /api/properties/aa7de8b7-1f4b-4299-844a-0df91296d732/units?limit=all&offset=0
```

### Sample Response
```json
{
  "success": true,
  "data": {
    "total": 62,
    "limit": 50,
    "offset": 0,
    "layout_preview_url": "https://example-bucket.s3.amazonaws.com/layouts/akshitha_preview.png?X-Amz-Signature=...",
    "tif_url": "https://example-bucket.s3.amazonaws.com/layouts/akshitha_cad_survey.tif?X-Amz-Signature=...",
    "property_layout_cords": {
      "north": 17.074500,
      "south": 17.069900,
      "east": 78.206800,
      "west": 78.202100
    },
    "items": [
      {
        "id": "unit-001",
        "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
        "plot_number": "101",
        "unit_type": "RESIDENTIAL_PLOT",
        "area_sq_yards": 200,
        "price": 3500000,
        "facing": "East",
        "status": "available",
        "centroid": {
          "lat": 17.072510,
          "lng": 78.204750
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [78.204650, 17.072450],
              [78.204850, 17.072450],
              [78.204850, 17.072570],
              [78.204650, 17.072570],
              [78.204650, 17.072450]
            ]
          ]
        }
      },
      {
        "id": "unit-002",
        "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
        "plot_number": "102",
        "unit_type": "RESIDENTIAL_PLOT",
        "area_sq_yards": 250,
        "price": 4375000,
        "facing": "North-East",
        "status": "sold",
        "centroid": {
          "lat": 17.072680,
          "lng": 78.204750
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [78.204650, 17.072580],
              [78.204850, 17.072580],
              [78.204850, 17.072780],
              [78.204650, 17.072780],
              [78.204650, 17.072580]
            ]
          ]
        }
      }
    ]
  }
}
```

### Critical Client Pagination Logic
The API silently caps the maximum items returned per call (e.g., returning 50 units even if `limit=all` was sent and `total` is 142). The client code automatically walks through offsets in a loop until all units are gathered:

```typescript
export async function fetchPropertyUnits(
  propertyId: string,
  signal?: AbortSignal,
): Promise<PropertyUnitsResult> {
  const units: PropertyUnit[] = [];
  let total = 0;
  let offset = 0;
  let layoutPreviewUrl: string | null = null;
  let tifUrl: string | null = null;
  let layoutCords: PropertyLayoutCords | null = null;

  for (let page = 0; page < 200; page += 1) {
    const query = new URLSearchParams({
      limit: "all",
      offset: String(offset),
    });

    const response = await apiFetch<UnitsResponse>(
      `/api/properties/${encodeURIComponent(propertyId)}/units?${query}`,
      { signal },
    );
    if (signal?.aborted) break;

    const data = response?.data;
    const items = data?.items ?? [];

    // Capture metadata from the first page
    if (page === 0) {
      layoutPreviewUrl = data?.layout_preview_url ?? null;
      tifUrl = data?.tif_url ?? null;
      if (data?.property_layout_cords) {
        layoutCords = parseLayoutCords(data.property_layout_cords);
      }
    }

    units.push(...items);
    if (typeof data?.total === "number") total = data.total;

    // Advance offset
    const serverLimit = data?.limit ?? items.length;
    const nextOffset = offset + serverLimit;

    // Stop when no more items exist or total is satisfied
    if (items.length === 0 || nextOffset >= total) break;
    offset = nextOffset;
  }

  return { units, total, layoutPreviewUrl, tifUrl, layoutCords };
}
```

---

## 3. How the Map Uses These Two Endpoints Together

```
Visitor clicks pin on map
         │
         ├── 1. GET /api/properties/{id}
         │      • Fetches name, price range, RERA, and description.
         │      • Populates the Property Sheet sidebar/bottom sheet.
         │
         └── 2. GET /api/properties/{id}/units
                • Extracts `layout_preview_url` (PNG) or `tif_url` (TIFF).
                • Georeferences the raster image inside `property_layout_cords`.
                • Renders `geometry` polygons into MapLibre vector layers:
                    - Emerald Green (#1F8A68) for `status: "available"`
                    - Stone Gray (#8A8178) for `status: "sold"`
                    - White text label for `plot_number`
                • Enables clicking individual plots to view plot size and pricing.
```
