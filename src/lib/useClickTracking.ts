"use client";

import { useEffect } from "react";
import { trackEvent } from "@/services/analytics/tracker";
import { isEventType } from "@/services/analytics/events";
import { recordSectionClick } from "@/lib/useSectionDwell";

/**
 * Delegated click tracking.
 *
 * Any element can emit an event by carrying data attributes — no handler
 * changes required, which keeps instrumentation out of the way of existing
 * component logic:
 *
 *   <button data-track="WHATSAPP_CHAT_CLICK"
 *           data-track-property={property.id}
 *           data-track-meta='{"button_location":"hero"}'>
 *
 * A single document-level listener handles all of them, so there is no per
 * component cost and the map / 3D guide stay untouched.
 */

function parseMeta(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function emitFromElement(el: HTMLElement) {
  const type = el.dataset.track;
  if (!type || !isEventType(type)) return;

  const propertyId = el.dataset.trackProperty ?? null;

  trackEvent({
    event_type: type,
    property_id: propertyId,
    metadata: parseMeta(el.dataset.trackMeta ?? null),
  });
}

export function useClickTracking(): void {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const tracked = target.closest<HTMLElement>("[data-track]");
      if (tracked) emitFromElement(tracked);

      // Section clicks are tracked for any click inside a data-section block,
      // whether or not it has its own data-track.
      const sectionEl = target.closest<HTMLElement>("[data-section]");
      const section = sectionEl?.dataset.section;

      // Section dwell is reported via SESSION_SECTION_SUMMARY on pagehide.
      // SECTION_CLICK is rejected by the public batch endpoint, so it is only
      // counted locally and folded into that summary as click counts.
      if (section) {
        recordSectionClick(section);
      }
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
}