"use client";

import { useEffect, useRef } from "react";
import {
  isSectionName,
  VIEWED_THRESHOLD_SECONDS,
  type SectionName,
} from "@/services/analytics/events";
import { trackEvent } from "@/services/analytics/tracker";
import { getSessionId } from "@/lib/session";

/**
 * Section dwell tracking.
 *
 * Answers: which section got the most time, which were viewed (>= 2s visible),
 * skimmed (< 2s), or never reached, and what was clicked inside each.
 *
 * Dwell accrues only while the tab is visible AND the visitor is active, so a
 * tab left open overnight does not read as engagement. Summary is emitted on
 * page hide as SESSION_SECTION_SUMMARY per section.
 */

type DwellRecord = {
  seconds: number;
  clicks: number;
  reached: boolean;
};

export type SectionSummary = {
  section: SectionName;
  seconds: number;
  classification: "viewed" | "skimmed" | "never_reached";
  clicks: number;
};

const records = new Map<string, DwellRecord>();

function ensure(section: string): DwellRecord {
  let record = records.get(section);
  if (!record) {
    record = { seconds: 0, clicks: 0, reached: false };
    records.set(section, record);
  }
  return record;
}

/**
 * Adds dwell for a section.
 *
 * Each call is capped at 2s so a throttled background tab cannot dump minutes
 * of "dwell" into one record when it returns to the foreground.
 */
function credit(section: string, deltaMs: number): void {
  if (deltaMs <= 0) return;
  const seconds = Math.min(deltaMs, 2_000) / 1000;
  const record = ensure(section);
  record.seconds += seconds;
  record.reached = true;
}

/** Records a click inside a section without a re-render. */
export function recordSectionClick(section: string): void {
  if (!isSectionName(section)) return;
  ensure(section).clicks += 1;
}

export function classify(record: DwellRecord): "viewed" | "skimmed" | "never_reached" {
  if (!record.reached) return "never_reached";
  return record.seconds >= VIEWED_THRESHOLD_SECONDS ? "viewed" : "skimmed";
}

export function getSectionSummaries(): SectionSummary[] {
  return Array.from(records.entries())
    .filter(([section]) => isSectionName(section))
    .map(([section, record]) => ({
      section: section as SectionName,
      seconds: Math.round(record.seconds),
      classification: classify(record),
      clicks: record.clicks,
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

export function resetSectionTracking(): void {
  records.clear();
}

/**
 * Tracks dwell for every element carrying data-section.
 *
 * Uses IntersectionObserver to know which sections are on screen. Only the
 * visible section with the largest intersection ratio accrues time, which
 * prevents two sections counting the same second.
 */
export function useSectionDwellTracking(): void {
  const visibleRef = useRef<string | null>(null);

  useEffect(() => {
    const visible = new Map<string, number>();
    let lastSwitch = Date.now();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const section = (entry.target as HTMLElement).dataset.section;
          if (!section || !isSectionName(section)) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visible.set(section, entry.intersectionRatio);
          } else {
            visible.delete(section);
          }
        }

        // Credit only the single most-visible section.
        let top: string | null = null;
        let topRatio = 0;
        for (const [section, ratio] of visible) {
          if (ratio > topRatio) {
            top = section;
            topRatio = ratio;
          }
        }

        if (top === visibleRef.current) return;

        const now = Date.now();

        if (visibleRef.current) {
          credit(visibleRef.current, now - lastSwitch);
        }

        lastSwitch = now;
        visibleRef.current = top;

        // SECTION_ENTER / SECTION_EXIT are NOT emitted: the public
        // /api/events/batch endpoint rejects both names. Section engagement is
        // captured as SESSION_SECTION_SUMMARY on pagehide, which the backend
        // does accept.
      },
      { threshold: [0, 0.5, 1] },
    );

    const scan = () => {
      observer.disconnect();
      document
        .querySelectorAll<HTMLElement>("[data-section]")
        .forEach((node) => observer.observe(node));
    };

    // Sections may mount lazily (map, 3D guide), so rescan as the DOM changes.
    // Debounced because a map/3D scene mutates the DOM constantly and a full
    // rescan per mutation would be a visible frame-rate cost.
    let rescanTimer: number | null = null;
    const mutation = new MutationObserver(() => {
      if (rescanTimer !== null) return;
      rescanTimer = window.setTimeout(() => {
        rescanTimer = null;
        scan();
      }, 500);
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    scan();

    // Only count while visible and recently active.
    let lastActivity = Date.now();
    const bump = () => {
      lastActivity = Date.now();
    };
    const isActive = () =>
      document.visibilityState === "visible" &&
      Date.now() - lastActivity < 60_000;

    let lastTick = Date.now();

    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (!visibleRef.current || !isActive()) return;

      credit(visibleRef.current, delta);
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") lastTick = Date.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPageHide = () => emitSummary();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      observer.disconnect();
      mutation.disconnect();
      if (rescanTimer !== null) window.clearTimeout(rescanTimer);
      window.clearInterval(interval);
      ["click", "scroll", "keydown", "touchstart"].forEach((event) =>
        window.removeEventListener(event, bump),
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}

let summaryEmitted = false;

function emitSummary() {
  if (summaryEmitted) return;

  const summaries = getSectionSummaries();
  if (summaries.length === 0) return;

  summaryEmitted = true;

  summaries.forEach((entry) => {
    trackEvent({
      event_type: "SESSION_SECTION_SUMMARY",
      metadata: {
        section_type: entry.section,
        dwell_seconds: entry.seconds,
        classification: entry.classification,
        clicks: entry.clicks,
        session_id: getSessionId(),
      },
    });
  });

  console.info("[analytics] section summary", summaries);
}