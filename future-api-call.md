# Feature Matching API Documentation

This document explains the feature-matching API endpoint used in the **Find Your Plot** section to recommend properties based on user-selected criteria and preferences.

---

## 1. Primary Feature Match API: `POST /api/match-properties`

### Overview
This endpoint accepts a list of feature keys (such as infrastructure, amenities, connectivity, or investment metrics) and evaluates active properties against those criteria. It returns a ranked list of properties with an overall `match_score` and individual breakdown scores for each requested feature.

### Endpoint Specification
* **Method:** `POST`
* **Path:** `/api/match-properties`
* **Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "features": [
      "near_orr",
      "gated_community",
      "high_appreciation"
    ]
  }
  ```
  *(Note: The array must contain feature **keys**, not display names or UUIDs).*

---

### Sample Request
```http
POST /api/match-properties HTTP/1.1
Content-Type: application/json

{
  "features": [
    "near_orr",
    "gated_community",
    "high_appreciation"
  ]
}
```

---

### Sample Response
```json
{
  "success": true,
  "data": {
    "total": 2,
    "items": [
      {
        "property_id": "aa7de8b7-1f4b-4299-844a-0df91296d732",
        "property_name": "Akshitha's Golden Crown",
        "slug": "akshithas-golden-crown",
        "match_score": 8.7,
        "feature_scores": [
          {
            "feature_id": "",
            "feature_key": "near_orr",
            "feature_name": "near_orr",
            "score": 9.2
          },
          {
            "feature_id": "",
            "feature_key": "gated_community",
            "feature_name": "gated_community",
            "score": 8.5
          },
          {
            "feature_id": "",
            "feature_key": "high_appreciation",
            "feature_name": "high_appreciation",
            "score": 8.4
          }
        ]
      },
      {
        "property_id": "e4c3ce87-0619-4ebd-ac42-11d1a17967c9",
        "property_name": "Green Meadows Phase 2",
        "slug": "green-meadows-phase-2",
        "match_score": 7.8,
        "feature_scores": [
          {
            "feature_id": "",
            "feature_key": "near_orr",
            "feature_name": "near_orr",
            "score": 8.0
          },
          {
            "feature_id": "",
            "feature_key": "gated_community",
            "feature_name": "gated_community",
            "score": 7.9
          },
          {
            "feature_id": "",
            "feature_key": "high_appreciation",
            "feature_name": "high_appreciation",
            "score": 7.5
          }
        ]
      }
    ]
  }
}
```

---

## 2. Key Rules & Business Logic

### A. Strict "AND" Matching
* Matching is **AND**, not **OR**.
* A property is only returned if it carries a score for **every single feature** requested in the array.
* If a visitor selects 4 features and no property has scores for all 4, the API legitimately returns `total: 0` and an empty `items: []` array.

### B. Score Scale (0 to 10)
* `match_score` is a decimal number between `0.0` and `10.0` representing the arithmetic mean of the requested feature scores.
* **UI Conversion:** To display the score as a percentage badge, multiply by 10 and round:
  ```typescript
  const percentage = Math.round(match_score * 10); // 8.7 -> 87%
  ```
* **Score of `0` is valid:** A score of `0` means the property scored poorly on that feature; it does not mean the score is missing.

---

## 3. Client Implementation

```typescript
export async function findPropertiesByFeatures(
  featureKeys: string[],
  signal?: AbortSignal,
): Promise<{ items: PropertyMatch[]; total: number }> {
  // Return empty list immediately if no criteria selected (avoids network trip)
  if (featureKeys.length === 0) {
    return { items: [], total: 0 };
  }

  const response = await fetch("/api/match-properties", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ features: featureKeys }),
    signal,
  });

  const json = await response.json();
  return json.data ?? { items: [], total: 0 };
}
```

---

## 4. Supporting API: `GET /api/features`

Before calling `/api/match-properties`, the available feature chips are loaded using:

### Endpoint
* **Method:** `GET`
* **Path:** `/api/features`

### Sample Response
```json
{
  "success": true,
  "data": [
    {
      "id": "feat-001",
      "key": "near_orr",
      "name": "Near Outer Ring Road",
      "description": "Within 10-15 minutes of major ORR entry/exit junctions",
      "active": true,
      "sort_order": 1
    },
    {
      "id": "feat-002",
      "key": "gated_community",
      "name": "Gated Security",
      "description": "Compound wall with 24/7 security & CCTV surveillance",
      "active": true,
      "sort_order": 2
    },
    {
      "id": "feat-003",
      "key": "high_appreciation",
      "name": "High Appreciation Zone",
      "description": "Located in emerging growth corridors with strong ROI",
      "active": true,
      "sort_order": 3
    }
  ]
}
```
* The `key` from each object is what gets sent in the `POST /api/match-properties` request payload.
