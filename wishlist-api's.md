# Wishlist / Favorites API Documentation

This document explains the APIs used for managing an anonymous or logged-in visitor's wishlist (favorites), including fetching saved properties, adding a property, and removing a property.

---

## 1. Visitor Tracking: `X-Visitor-Code` Header

All wishlist endpoints require an anonymous visitor token passed in the request headers:
* **Header:** `X-Visitor-Code: <visitor_code>`
* **Example:** `X-Visitor-Code: vis_9f8a2b1c4e7d`

This allows visitors to save properties across sessions without having to log in or create an account. The visitor code is typically persisted in a 1-year browser cookie (`visitor_code`).

---

## 2. GET Wishlist: `GET /api/favorites`

Fetches all properties saved in the visitor's wishlist.

### Endpoint Details
* **Method:** `GET`
* **Path:** `/api/favorites`
* **Headers:**
  * `X-Visitor-Code: <visitor_code>`

### Sample Request
```http
GET /api/favorites HTTP/1.1
Host: api.example.com
X-Visitor-Code: vis_9f8a2b1c4e7d
```

### Sample Response
```json
{
  "success": true,
  "data": {
    "total": 2,
    "items": [
      {
        "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
        "name": "Akshitha's Golden Crown",
        "property_type": "PLOTS",
        "price_from": 3500000,
        "status": "PUBLISHED"
      },
      {
        "property_id": "e4c3ce87-0619-4ebd-ac42-11d1a17967c9",
        "name": "Green Meadows Phase 2",
        "property_type": "PLOTS",
        "price_from": 5200000,
        "status": "PUBLISHED"
      }
    ]
  }
}
```

### Function Implementation
```typescript
export async function fetchFavorites(visitorCode: string, signal?: AbortSignal): Promise<FavoriteItem[]> {
  const response = await fetch("/api/favorites", {
    headers: {
      "X-Visitor-Code": visitorCode,
    },
    signal,
  });

  const json = await response.json();
  return json.data?.items ?? [];
}
```

---

## 3. ADD to Wishlist: `POST /api/favorites`

Saves a property into the visitor's wishlist.

### Endpoint Details
* **Method:** `POST`
* **Path:** `/api/favorites`
* **Headers:**
  * `Content-Type: application/json`
  * `X-Visitor-Code: <visitor_code>`
* **Request Body:**
  ```json
  {
    "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732"
  }
  ```

### Sample Request
```http
POST /api/favorites HTTP/1.1
Host: api.example.com
Content-Type: application/json
X-Visitor-Code: vis_9f8a2b1c4e7d

{
  "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732"
}
```

### Sample Response
```json
{
  "success": true,
  "message": "Property added to favorites"
}
```

### Function Implementation
```typescript
export async function saveFavorite(propertyId: string, visitorCode: string): Promise<void> {
  await fetch("/api/favorites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Visitor-Code": visitorCode,
    },
    body: JSON.stringify({ property_id: propertyId }),
  });
}
```

---

## 4. REMOVE from Wishlist: `DELETE /api/favorites/{propertyId}`

Removes a property from the visitor's wishlist.

### Endpoint Details
* **Method:** `DELETE`
* **Path:** `/api/favorites/{propertyId}`
* **Headers:**
  * `X-Visitor-Code: <visitor_code>`

### Sample Request
```http
DELETE /api/favorites/aa7de8b7-1f4b-4299-844a-0df91296d732 HTTP/1.1
Host: api.example.com
X-Visitor-Code: vis_9f8a2b1c4e7d
```

### Sample Response
```json
{
  "success": true,
  "message": "Property removed from favorites"
}
```

### Function Implementation
```typescript
export async function removeFavorite(propertyId: string, visitorCode: string): Promise<void> {
  await fetch(`/api/favorites/${encodeURIComponent(propertyId)}`, {
    method: "DELETE",
    headers: {
      "X-Visitor-Code": visitorCode,
    },
  });
}
```
