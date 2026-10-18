# Properties List API & Map Pointers Functionality

This document details the API calls, sample responses, data flow, and visual design styling used to retrieve properties and render interactive pointer pins on the map.

---

## 1. Primary API Endpoint: Fetch Properties

Fetches the catalog of properties to be displayed on the map.

### Endpoint Details
* **Method:** `GET`
* **Path:** `/api/properties`
* **Query Parameters:**
  * `status=ALL` (Retrieves all active and published developments)
  * `page=1`
  * `per_page=100`

### Example Request
```http
GET /api/properties?status=ALL&page=1&per_page=100
```

### Sample Response
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
        "name": "Akshitha's Golden Crown",
        "slug": "akshithas-golden-crown",
        "description": "Premium villa plots with world-class amenities near Shadnagar.",
        "property_type": "PLOTS",
        "price": 3500000,
        "price_label": "₹35 Lakhs onwards",
        "total_plots": 142,
        "available_plots_count": 48,
        "locality": "Shadnagar",
        "city": "Hyderabad",
        "latitude": 17.0722,
        "longitude": 78.2045,
        "cover_url": "https://example-bucket.s3.amazonaws.com/properties/akshitha-cover.jpg",
        "rera_registered": true
      },
      {
        "id": "e4c3ce87-0619-4ebd-ac42-11d1a17967c9",
        "name": "Green Meadows Phase 2",
        "slug": "green-meadows-phase-2",
        "description": "HMDA approved gated community plots.",
        "property_type": "PLOTS",
        "price": 5200000,
        "price_label": "₹52 Lakhs onwards",
        "total_plots": 86,
        "available_plots_count": 19,
        "locality": "Mokila",
        "city": "Hyderabad",
        "latitude": 17.3850,
        "longitude": 78.1920,
        "cover_url": "https://example-bucket.s3.amazonaws.com/properties/meadows-cover.jpg",
        "rera_registered": true
      }
    ],
    "total": 2,
    "page": 1,
    "per_page": 100
  }
}
```

### Function Implementation
```typescript
async function fetchProperties(options: {
  status?: string;
  page?: number;
  perPage?: number;
  locationSlug?: string;
  signal?: AbortSignal;
} = {}): Promise<{
  items: PropertyListItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  const query = new URLSearchParams({
    status: options.status ?? "ALL",
    page: String(options.page ?? 1),
    per_page: String(options.perPage ?? 100),
  });

  const response = await apiFetch<{
    success?: boolean;
    data?: {
      items?: PropertyListItem[];
      total?: number;
      page?: number;
      per_page?: number;
    };
  }>(`/api/properties?${query.toString()}`, { signal: options.signal });

  return {
    items: response?.data?.items ?? [],
    total: response?.data?.total ?? 0,
    page: response?.data?.page ?? 1,
    perPage: response?.data?.per_page ?? 100,
    totalPages: Math.max(1, Math.ceil((response?.data?.total ?? 0) / 100)),
  };
}
```

---

## 2. Detail API Endpoint: Fetch Missing Coordinates

If any property from the list endpoint is missing its `latitude` and `longitude`, this endpoint is called to retrieve the full property details including exact geo-coordinates.

### Endpoint Details
* **Method:** `GET`
* **Path:** `/api/properties/{id}`

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
    "price_label": "₹35 Lakhs onwards",
    "price_per_sqft": 1450,
    "total_inventory": 142,
    "available_inventory": 48,
    "sold_inventory": 94,
    "status": "PUBLISHED",
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
    "amenities": [
      "Clubhouse",
      "Swimming Pool",
      "24/7 Security",
      "Children's Play Area",
      "Underground Drainage"
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

### Batch Resolution Function
Fetches missing coordinates in batches of concurrent requests and streams them to the map:

```typescript
async function fetchPropertyAnchors(
  items: PropertyListItem[],
  options: {
    signal?: AbortSignal;
    concurrency?: number;
    onAnchor?: (propertyId: string, anchor: PropertyAnchor) => void;
  } = {},
): Promise<Record<string, PropertyAnchor>> {
  const anchors: Record<string, PropertyAnchor> = {};
  const missing: string[] = [];

  // Collect coordinates already provided in the list
  for (const item of items) {
    const anchor = propertyAnchor(item);
    if (anchor) {
      anchors[item.id] = anchor;
      options.onAnchor?.(item.id, anchor);
    } else {
      missing.push(item.id);
    }
  }

  // Fetch coordinates for properties that were missing them
  const limit = Math.max(1, options.concurrency ?? 4);
  let cursor = 0;

  const worker = async () => {
    while (cursor < missing.length) {
      const id = missing[cursor];
      cursor += 1;
      if (options.signal?.aborted) return;
      try {
        const detail = await fetchPropertyById(id, options.signal);
        const anchor = propertyAnchor(detail);
        if (anchor) {
          anchors[id] = anchor;
          options.onAnchor?.(id, anchor);
        }
      } catch {
        // Skip properties that have no coordinates available
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, missing.length) }, worker),
  );

  return anchors;
}
```

---

## 3. Map Pointers Pipeline

### Step 1: Initial Mount and Progressive Streaming
1. Calls `/api/properties?status=ALL&page=1&per_page=100`.
2. Immediately places pins for properties that already have coordinates.
3. Asynchronously resolves missing coordinates and streams new pins onto the map as they arrive.

```typescript
useEffect(() => {
  const controller = new AbortController();

  fetchProperties({ status: "ALL", page: 1, perPage: 100, signal: controller.signal })
    .then((result) => {
      if (controller.signal.aborted) return;

      setPropertyList(result.items);

      // Seed pins that already have coordinates
      const seeded: Record<string, PropertyAnchor> = {};
      for (const item of result.items) {
        const anchor = propertyAnchor(item);
        if (anchor) seeded[item.id] = anchor;
      }
      if (Object.keys(seeded).length > 0) setPropertyAnchors(seeded);

      // Resolve missing pins and stream them as they arrive
      fetchPropertyAnchors(result.items, {
        signal: controller.signal,
        concurrency: 4,
        onAnchor: (propertyId, anchor) => {
          if (controller.signal.aborted) return;
          setPropertyAnchors((prev) =>
            prev[propertyId] ? prev : { ...prev, [propertyId]: anchor }
          );
        },
      });
    });

  return () => controller.abort();
}, []);
```

---

### Step 2: Mapping Coordinates to Pin Data
Converts API data into coordinates format `[longitude, latitude]`:

```typescript
const pins = useMemo(() => {
  const byId = new Map();

  for (const item of propertyList) {
    const anchor = propertyAnchor(item) ?? propertyAnchors[item.id];
    if (!anchor) continue;

    byId.set(item.id, {
      id: item.id,
      name: item.name,
      location: [item.locality, item.city].filter(Boolean).join(", "),
      center: [anchor.longitude, anchor.latitude],
    });
  }

  return [...byId.values()];
}, [propertyAnchors, propertyList]);
```

---

### Step 3: Placing Pins on the Map
Creates DOM markers and places them at the exact geographic coordinates:

```typescript
visiblePins.forEach((project) => {
  const el = createProjectPin(project);

  el.addEventListener("click", (event) => {
    event.stopPropagation();
    // Opens property layout on click
    selectProperty(project.id, {
      openSheet: isMobile,
      openLayout: true,
    });
  });

  const marker = new Marker({
    element: el,
    anchor: "bottom",
  })
    .setLngLat(project.center)
    .addTo(map);

  projectMarkers.push(marker);
});
```

---

## 4. Visual Design & Style of the Pointer Pins

The map pointer is a custom DOM element designed with a luxury architectural aesthetic to maintain high contrast over both vector streets and satellite photography.

### Physical Anatomy

```
               [ Halo Ring (42px) ]
           ┌────────────────────────┐
           │   ✦ Core Badge (34px)  │   <-- Black (#111111) + Gold (#C6A46C) border
           │       [House Glyph]    │   <-- Gold house SVG (15px)
           └───────────┬────────────┘
                       │  Needle (12px)  <-- #111111 with 1px white flank borders
                       ▼  Tip (Diamond)  <-- 10px diamond with gold bevel
```

---

### HTML Structure
```html
<button type="button" class="ila-project-pin" aria-label="Project Name, Locality">
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
</button>
```

---

### CSS Styling & Color Tokens

```css
/* Container & Transition */
.ila-project-pin {
  position: relative;
  display: flex;
  align-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
  transform-origin: center bottom;
  transition: transform 0.2s ease;
  z-index: 1;
}

.ila-project-pin:hover {
  z-index: 8;
  transform: translateY(-3px); /* Subtle lift on hover */
}

.ila-project-pin__anchor {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 36px;
}

/* 1. Backdrop Halo (Ensures high contrast on any terrain) */
.ila-project-pin__halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 42px;
  height: 42px;
  border-radius: 999px;
  transform: translate(-50%, -58%);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 2px rgba(17, 17, 17, 0.12);
  pointer-events: none;
}

/* 2. Core Badge (Obsidian black circle with gold stroke) */
.ila-project-pin__core {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  color: #c6a46c; /* Metallic Gold Glyph */
  background: #111111; /* Obsidian Black */
  border: 3px solid #c6a46c;
  box-shadow:
    0 0 0 3px #ffffff,            /* Pure white separation ring */
    0 8px 18px rgba(0, 0, 0, 0.45); /* Elevation shadow */
}

/* 3. Icon */
.ila-project-pin__icon {
  width: 15px;
  height: 15px;
}

/* 4. Needle Stem */
.ila-project-pin__needle {
  position: relative;
  z-index: 1;
  width: 3px;
  height: 12px;
  margin-top: -2px;
  background: #111111;
  border-left: 1px solid #ffffff;
  border-right: 1px solid #ffffff;
}

/* 5. Anchor Point */
.ila-project-pin__point {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  background: #111111;
  transform: rotate(45deg);
  border-radius: 0 0 2px 0;
  border-right: 2px solid #c6a46c;
  border-bottom: 2px solid #c6a46c;
  box-shadow: 2px 2px 0 #ffffff;
}

/* Hover State: Invert colors to gold background with black icon */
.ila-project-pin:hover .ila-project-pin__core {
  color: #111111;
  background: #c6a46c;
  border-color: #111111;
  box-shadow:
    0 0 0 3px #ffffff,
    0 10px 22px rgba(0, 0, 0, 0.5);
}
```

---

### Design Token Summary
* **Width:** `36px` overall width, anchored at bottom-center.
* **Halo Ring:** `42px × 42px`, `rgba(255, 255, 255, 0.92)` with `rgba(17, 17, 17, 0.12)` shadow.
* **Core Badge:** `34px × 34px`, `#111111` background, `3px solid #C6A46C` gold border.
* **Separation Ring:** `3px` solid pure white `#FFFFFF`.
* **Center Glyph:** `15px × 15px` architectural house silhouette in `#C6A46C`.
* **Needle & Tip:** `3px × 12px` stem flanked with white hairlines, terminating in a 45° diamond point.
* **Hover Interaction:** Inverts core background to `#C6A46C` (Gold) with `#111111` (Black) glyph, and floats up by `3px`.
