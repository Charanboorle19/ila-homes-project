"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  recordSectionClick,
  useSectionDwellTracking,
} from "@/lib/useSectionDwell";
import { startAnalytics, trackEvent } from "@/services/analytics/tracker";
import { useVisitorActivity } from "@/lib/useVisitorActivity";
import { whenVisitorReady } from "@/lib/visitorReady";
import { useClickTracking } from "@/lib/useClickTracking";

/**
 * Mounts the analytics layer once, alongside Visitor/SessionInitializer.
 *
 * Renders nothing. Kept separate so tracking concerns never leak into page
 * components, and so the lazy-loaded map / 3D guide are unaffected.
 */
export default function AnalyticsInitializer() {
  useSectionDwellTracking();
  useVisitorActivity();
  useClickTracking();

  const sentStart = useRef(false);

  useEffect(() => {
    startAnalytics();
  }, []);

  useEffect(() => {
    if (sentStart.current) return;
    sentStart.current = true;

    // Wait for the visitor cookie, otherwise the emit is dropped.
    void whenVisitorReady().then((state) => {
      if (!state.code) return;

      trackEvent({
        event_type: "SESSION_START",
        metadata: {
          page_url: window.location.pathname,
          referrer: document.referrer || null,
          // Signals a repeat visit; the backend uses total_visits for scoring.
          landing_page: window.location.href,
        },
      });

      console.info("[analytics] SESSION_START queued");
    });
  }, []);

  return null;
}

/** Convenience wrapper so components import from one place. */
export function useAnalytics() {
  const onSectionClick = useCallback((section: string) => {
    recordSectionClick(section);
    trackEvent({
      event_type: "SECTION_CLICK",
      metadata: { section_type: section },
    });
  }, []);

  return { trackEvent, onSectionClick };
}