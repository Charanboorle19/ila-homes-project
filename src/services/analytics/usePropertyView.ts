"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/services/analytics/tracker";

/**
 * Emits PROPERTY_VIEW once per property id, plus TIME_ON_PROPERTY on unmount.
 *
 * TIME_ON_PROPERTY reports engaged seconds only (tab visible and recently
 * active), so a tab left open overnight does not read as a long visit.
 *
 * PROPERTY_REVISIT fires when the same property is viewed again within the
 * session, which is a strong intent signal the backend scores.
 */

const REVISIT_WINDOW_MS = 30 * 60 * 1000;
const seenProperties = new Set<string>();
let lastViewedProperty: { id: string; at: number } | null = null;

/** Test/debug helper so a fresh session can be simulated. */
export function resetPropertyViewState(): void {
  seenProperties.clear();
  lastViewedProperty = null;
}

export function useTrackPropertyView(propertyId: string | undefined): void {
  const startedAt = useRef<number | null>(null);
  const lastActivity = useRef<number>(0);
  const emittedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    if (emittedFor.current === propertyId) return;

    emittedFor.current = propertyId;
    startedAt.current = Date.now();
    lastActivity.current = Date.now();

    const isRevisit =
      seenProperties.has(propertyId) ||
      (lastViewedProperty?.id === propertyId &&
        Date.now() - lastViewedProperty.at < REVISIT_WINDOW_MS);

    trackEvent({
      event_type: "PROPERTY_VIEW",
      property_id: propertyId,
      metadata: {
        source: "property_listing",
        page_url: window.location.pathname,
      },
    });

    if (isRevisit) {
      trackEvent({
        event_type: "PROPERTY_REVISIT",
        property_id: propertyId,
        metadata: { page_url: window.location.pathname },
      });
    }

    seenProperties.add(propertyId);
    lastViewedProperty = { id: propertyId, at: Date.now() };

    const bump = () => {
      lastActivity.current = Date.now();
    };
    const ACTIVITY = ["click", "scroll", "keydown", "touchstart"] as const;
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump));

      const started = startedAt.current;
      if (started === null) return;

      // Only count engaged time: visible and interacted with within the last
      // 60s. Clamped so a throttled background tab cannot inflate this.
      const engaged =
        document.visibilityState === "visible" &&
        Date.now() - lastActivity.current < 60_000;

      const seconds = Math.max(
        0,
        Math.min(Math.round((Date.now() - started) / 1000), 1800),
      );

      if (seconds > 0) {
        trackEvent({
          event_type: "TIME_ON_PROPERTY",
          property_id: propertyId,
          metadata: {
            seconds,
            engaged,
            page_url: window.location.pathname,
          },
        });
      }
    };
  }, [propertyId]);
}