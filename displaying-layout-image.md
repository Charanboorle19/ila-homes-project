# Troubleshooting & Implementing Layout TIFF Images in MapLibre

This guide explains the end-to-end pipeline for loading large CAD/survey `.tif` master-plan layout scans into MapLibre GL, why the layout might fail to display (rendering invisible or failing to load), and how to fix every step when integrating into another project.

---

## 1. The Pipeline at a Glance

```
API layout_preview_url / tif_url  (Presigned AWS S3 link)
        │
        │  ✗ Browser fetch fails: S3 blocks client requests (No CORS)
        ▼
/api/layout-image?url=...         (Next.js Route Handler fetches server-to-server)
        │                         (Returns raw binary ArrayBuffer)
        ▼
geotiff (Dynamically imported)
        │  fromArrayBuffer(buffer)  ➔ Parses TIFF container
        │  tiff.getImage(0)        ➔ Reads primary page
        ▼
readRGB({ width, height })        ➔ Resamples to fit inside 2048px (Prevents GPU crash)
        │
        ▼
Zero-Alpha & Stride Normalization ➔ Solves transparent/invisible image bug
        │
        ▼
HTMLCanvasElement                 ➔ Decoded pixels painted to 2D canvas via putImageData
        │
        ▼
source.updateImage({ image, coordinates }) ➔ MapLibre image source takes the canvas
        │
        ▼
"raster" Layer                    ➔ Georeferenced to 4 GPS coordinates (NW, NE, SE, SW)
                                     Placed *underneath* vector plot polygons
```

---

## 2. Why The Layout Image Fails to Display (The 3 Core Traps)

### Trap 1: HTTP `413 Payload Too Large` on the Proxy Route
* **Cause:** CAD survey TIFF files are frequently 20MB–50MB+. Next.js route handlers, Nginx proxies, or serverless functions often default to a 4MB payload limit.
* **Symptom:** Network request to `/api/layout-image` fails with `413 Payload Too Large` or `504 Gateway Timeout`.

### Trap 2: The "Zero-Alpha" Invisible Plan (Most Common)
* **Cause:** CAD export software often saves TIFF scans with 4 channels (RGBA), but leaves the alpha channel completely set to `0` (or premultiplied against black).
* **Symptom:** 
  * If you blindly preserve channel 4: **The layout is 100% transparent**. Vector plot lines draw on the map, but the master plan image is completely invisible.
  * If you blindly force alpha to 255: The transparent border becomes an opaque black rectangle.
* **Fix:** Inspect the alpha band. If `maxAlpha === 0`, detect that alpha is unpopulated and force it to `255`.

### Trap 3: MapLibre Layer Visibility & Z-Index Ordering
* **Cause:** 
  * If the raster layer is initialized with `layout: { visibility: "none" }`, calling `source.updateImage()` updates the texture in memory but does not make it visible.
  * If the raster layer is added *after* the vector plot layers, it draws on top of the plots instead of underneath them.

---

## 3. The Complete Working Implementation

### Step 1: The Proxy Route Handler (`app/api/layout-image/route.ts`)
Bypasses CORS restrictions and allows large file sizes:

```typescript
import { NextRequest, NextResponse } from "next/server";

// Allow sufficient execution time for large downloads
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/tiff",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[layout-image proxy] Fetch failed:", error);
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}
```

---

### Step 2: The TIFF Decoder with Alpha Normalization

```typescript
import { fromArrayBuffer } from "geotiff";

const MAX_DECODED_EDGE = 2048; // Safe limit for mobile and desktop WebGL textures

export async function decodeTiffToCanvas(
  tifUrl: string,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement | null> {
  try {
    // 1. Fetch binary data via same-origin proxy
    const proxiedUrl = `/api/layout-image?url=${encodeURIComponent(tifUrl)}`;
    const response = await fetch(proxiedUrl, { signal });
    if (!response.ok) {
      console.warn("TIFF proxy responded with status:", response.status);
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (signal?.aborted) return null;

    // 2. Parse TIFF with geotiff.js
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage(0);

    const width = image.getWidth();
    const height = image.getHeight();
    if (!width || !height) return null;

    // 3. Resample dimensions to stay within 2048px (Prevents GPU OOM)
    const scale = Math.min(
      1,
      MAX_DECODED_EDGE / width,
      MAX_DECODED_EDGE / height,
    );
    const scaledWidth = Math.max(1, Math.round(width * scale));
    const scaledHeight = Math.max(1, Math.round(height * scale));

    // 4. Read channels
    const rawPixels = (await image.readRGB({
      interleave: true,
      enableAlpha: true,
      width: scaledWidth,
      height: scaledHeight,
      signal,
    })) as ArrayLike<number>;

    const pixelCount = scaledWidth * scaledHeight;
    const stride = rawPixels.length / pixelCount; // 3 = RGB, 4 = RGBA

    // 5. Inspect Alpha Band to guard against invisible plans
    let maxAlpha = 0;
    if (stride === 4) {
      for (let i = 3; i < rawPixels.length; i += 4) {
        if (rawPixels[i] > maxAlpha) {
          maxAlpha = rawPixels[i];
          if (maxAlpha > 10) break; // Found actual visible content
        }
      }
    }

    // 6. Paint to HTML5 Canvas
    const canvas = document.createElement("canvas");
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const imageData = ctx.createImageData(scaledWidth, scaledHeight);
    const data = imageData.data;

    if (stride === 4 && maxAlpha > 0) {
      // Valid RGBA with true transparency
      for (let i = 0; i < rawPixels.length; i++) {
        data[i] = rawPixels[i];
      }
    } else if (stride === 4 && maxAlpha === 0) {
      // 4-channel file but alpha is 0 everywhere (would render invisible!)
      // Force alpha to 255 (Opaque)
      for (let p = 0; p < pixelCount; p++) {
        const s = p * 4;
        data[s] = rawPixels[s];         // R
        data[s + 1] = rawPixels[s + 1]; // G
        data[s + 2] = rawPixels[s + 2]; // B
        data[s + 3] = 255;              // Force Alpha
      }
    } else {
      // 3-channel standard RGB: Expand to RGBA
      for (let p = 0; p < pixelCount; p++) {
        const s = p * 3;
        const d = p * 4;
        data[d] = rawPixels[s];         // R
        data[d + 1] = rawPixels[s + 1]; // G
        data[d + 2] = rawPixels[s + 2]; // B
        data[d + 3] = 255;              // Force Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Quick verification log
    console.info(`[Map] Decoded TIFF: ${scaledWidth}x${scaledHeight}, Stride: ${stride}, maxAlpha: ${maxAlpha}`);
    return canvas;
  } catch (error) {
    console.error("[Map] TIFF decode failed:", error);
    return null;
  }
}
```

---

### Step 3: MapLibre Source, Layer, and Coordinate Binding

#### 1. GPS Corner Coordinate Order
MapLibre expects 4 coordinates in clockwise order starting from Top-Left:
1. `[west, north]` — North-West (Top-Left)
2. `[east, north]` — North-East (Top-Right)
3. `[east, south]` — South-East (Bottom-Right)
4. `[west, south]` — South-West (Bottom-Left)

```typescript
export function layoutCordsToCorners(cords: {
  north: number;
  south: number;
  east: number;
  west: number;
}): [number, number][] {
  return [
    [cords.west, cords.north], // NW
    [cords.east, cords.north], // NE
    [cords.east, cords.south], // SE
    [cords.west, cords.south], // SW
  ];
}
```

#### 2. Initialize Layer on Map Load
Add the raster layer **before** any vector plot fill layers so that plots render on top:

```typescript
map.on("load", () => {
  // 1. Image source initialized without URL
  map.addSource("estate-layout-image", {
    type: "image",
    coordinates: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ],
  });

  // 2. Raster layer inserted underneath plot polygons
  map.addLayer(
    {
      id: "estate-layout-raster",
      type: "raster",
      source: "estate-layout-image",
      layout: { visibility: "none" },
      paint: {
        "raster-opacity": 0.85,
        "raster-fade-duration": 0,
      },
    },
    "estate-plots-fill" // Insert before plots fill layer (if plots layer exists)
  );
});
```

#### 3. Update Image & Reveal Layer
When a property or master plan loads:

```typescript
async function showLayoutPlan(
  map: maplibregl.Map,
  tifUrl: string,
  cords: { north: number; south: number; east: number; west: number },
) {
  // 1. Decode to HTML5 Canvas
  const canvas = await decodeTiffToCanvas(tifUrl);
  if (!canvas) return;

  const coordinates = layoutCordsToCorners(cords);

  // 2. Push canvas to MapLibre
  const source = map.getSource("estate-layout-image") as maplibregl.ImageSource;
  if (source) {
    source.updateImage({
      image: canvas,
      coordinates: coordinates,
    });

    // 3. Make sure visibility is turned ON
    map.setLayoutProperty("estate-layout-raster", "visibility", "visible");

    // 4. Zoom map to layout bounds
    map.fitBounds(
      [
        [cords.west, cords.south],
        [cords.east, cords.north],
      ],
      { padding: 60, maxZoom: 17.5, duration: 900 }
    );
  }
}
```

---

## 4. Verification & Debug Checklist

If your other project still doesn't display the image, check these 4 points:

1. **Check the Network tab:**
   - Look for `/api/layout-image?url=...`.
   - Does it return `200 OK` with `Content-Type: image/tiff`?
   - If it returns `413`, your server is rejecting the large file size.
2. **Check the console log:**
   - Does `[Map] Decoded TIFF: ...` appear?
   - What is `maxAlpha`? If `maxAlpha: 0`, verify that your code overrides alpha to 255.
3. **Verify Canvas is not blank:**
   - Run `console.log(canvas.toDataURL().slice(0, 50))` right before `source.updateImage()`. If it starts with `data:image/png;base64,`, the canvas contains a valid image.
4. **Check Layer Visibility:**
   - In browser DevTools, run: `map.getLayoutProperty('estate-layout-raster', 'visibility')`. It must return `"visible"`.
