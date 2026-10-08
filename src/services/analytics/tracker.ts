/**
 * Event queue and transport for POST /api/events and /api/events/batch.
 *
 * Design constraints:
 * - Scoring is server-side; we never send points.
 * - This module is inert until a visitor_code exists, so it cannot block
 *   first paint or interfere with the lazy-loaded map / 3D guide.
 * - client_event_id is a UUID per emit, which is what makes server-side dedup
 *   work. Reusing an id on purpose yields duplicate:true and no double count.
 * - Events must survive page close, so we flush on pagehide via sendBeacon.
 */

import type { EventType } from "@/services/analytics/events";
import {
  COMPARE_MAX_IDS,
  COMPARE_MIN_IDS,
  isBatchSendable,
  isEventType,
} from "@/services/analytics/events";
import { getVisitorCode } from "@/lib/visitor";
import { getSessionId } from "@/lib/session";
import { whenVisitorReady } from "@/lib/visitorReady";
import { apiFetch } from "@/services/apiClient";

export type EventPayload = {
  event_type: EventType;
  property_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
  client_event_id?: string | null;
};

export type EventCreateResult = {
  event_id: string;
  session_id?: string | null;
  counted: boolean;
  points_awarded: number;
  reason?: string | null;
  duplicate: boolean;
};

const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE = 100;
const MAX_BATCH = 50;

let queue: EventPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function makeClientEventId(eventType: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `evt_${eventType.toLowerCase()}_${rand}`;
}

/**
 * Events the batch endpoint accepts but only when a top-level property_id is
 * present. Verified: omitting it yields VALIDATION_ERROR, which would fail the
 * whole batch. See PROPERTY_ID_REQUIRED_EVENTS.
 */
const PROPERTY_ID_REQUIRED_EVENTS = new Set<string>([
  "SHORTLIST_ADD",
  "SHORTLIST_REMOVE",
  "WHATSAPP_SHARE_CLICK",
]);

function buildPayload(event: {
  event_type: string;
  property_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
  client_event_id?: string;
}): EventPayload | null {
  if (!isEventType(event.event_type)) {
    if (typeof window !== "undefined") {
      console.warn(
        `[analytics] Blocked unknown event_type "${event.event_type}". ` +
          "Add it to src/services/analytics/events.ts and the backend allow-list.",
      );
    }
    return null;
  }

  // The public batch endpoint rejects a fixed set of names. Drop them locally so
  // one unsupported event cannot fail every other event in the batch. Verified
  // against the live API; see BATCH_SENDABLE_EVENTS.
  if (!isBatchSendable(event.event_type)) {
    if (typeof window !== "undefined") {
      console.warn(
        `[analytics] Dropped "${event.event_type}": not accepted by /api/events/batch.`,
      );
    }
    return null;
  }

  const propertyId = event.property_id ?? null;

  // Shortlist and WhatsApp-share must name a property. Fall back to the live
  // map property when the caller has no specific one in context.
  if (PROPERTY_ID_REQUIRED_EVENTS.has(event.event_type) && !propertyId) {
    const fallback = event.metadata?.property_id;
    if (typeof fallback === "string" && fallback) {
      return {
        event_type: event.event_type,
        property_id: fallback,
        session_id: event.session_id ?? getSessionId(),
        metadata: event.metadata ?? {},
        client_event_id: event.client_event_id ?? makeClientEventId(event.event_type),
      };
    }

    if (typeof window !== "undefined") {
      console.warn(
        `[analytics] Dropped "${event.event_type}": a property_id is required by the API.`,
      );
    }
    return null;
  }

  // Backend rejects these shapes, so normalise rather than shipping a request
  // that would fail an entire batch. Verified against the live API.
  if (event.event_type === "PROPERTY_COMPARE") {
    const ids = Array.isArray(event.metadata?.property_ids)
      ? (event.metadata.property_ids as unknown[]).filter(
          (id): id is string => typeof id === "string",
        )
      : [];

    // "COMPARE requires metadata.property_ids with 2-5 ids"
    if (ids.length < COMPARE_MIN_IDS || ids.length > COMPARE_MAX_IDS) {
      if (typeof window !== "undefined") {
        console.warn(
          `[analytics] Skipped PROPERTY_COMPARE: needs ${COMPARE_MIN_IDS}-${COMPARE_MAX_IDS} property_ids, got ${ids.length}`,
        );
      }
      return null;
    }

    return {
      event_type: event.event_type,
      // The backend also requires a top-level property_id for this event.
      property_id: propertyId ?? ids[0],
      session_id: event.session_id ?? getSessionId(),
      metadata: { ...event.metadata, comparison_count: ids.length },
      client_event_id: event.client_event_id ?? makeClientEventId(event.event_type),
    };
  }

  // ENQUIRY_SUBMIT is deliberately rejected on the public API
  // ("not allowed on the public API"), so never send it from the browser.
  if (event.event_type === "ENQUIRY_SUBMIT") {
    if (typeof window !== "undefined") {
      console.warn(
        "[analytics] ENQUIRY_SUBMIT is not permitted from the public API. " +
          "It must be recorded server-side when the lead is created.",
      );
    }
    return null;
  }

  return {
    event_type: event.event_type,
    property_id: propertyId,
    // session_id is filled in at flush time; it may not exist yet at emit time.
    session_id: event.session_id ?? getSessionId(),
    metadata: event.metadata ?? {},
    client_event_id: event.client_event_id ?? makeClientEventId(event.event_type),
  };
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[analytics] queued ${pendingEventCount()} event(s); auto-flush in ${FLUSH_INTERVAL_MS / 1000}s. ` +
        "Force with __ilaAnalytics.flush()",
    );
  }
}

/**
 * Emits an event. Safe to call from anywhere; drops silently if the visitor
 * code is not ready yet and retries once readiness resolves.
 */
export function trackEvent(event: {
  event_type: string;
  property_id?: string | null;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
  client_event_id?: string;
}): void {
  const payload = buildPayload(event);
  if (!payload) return;

  if (typeof window === "undefined") return;

  if (!getVisitorCode()) {
    // Visitor creation may still be in flight. Wait, then emit.
    void whenVisitorReady().then((state) => {
      if (state.code) enqueue(payload);
    });
    return;
  }

  enqueue(payload);
}

function enqueue(payload: EventPayload) {
  // Collapse repeat SECTION_ENTER/EXIT for the same section so scroll jitter
  // cannot flood the queue.
  queue.push(payload);

  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
  }

  scheduleFlush();
}

function postBatch(events: EventPayload[]): Promise<unknown> {
  const visitorCode = getVisitorCode();
  if (!visitorCode || events.length === 0) return Promise.resolve(null);

  return apiFetch("/api/events/batch", {
    method: "POST",
    headers: { "X-Visitor-Code": visitorCode },
    body: { events },
    keepalive: true,
  }).catch((error) => {
    console.warn("[analytics] batch flush failed", error);
    return null;
  });
}

export async function flush(): Promise<void> {
  if (queue.length === 0) return;

  const batches: EventPayload[][] = [];
  const events = queue;
  queue = [];

  for (let i = 0; i < events.length; i += MAX_BATCH) {
    batches.push(events.slice(i, i + MAX_BATCH));
  }

  await Promise.all(batches.map((batch) => postBatch(batch)));
}

/**
 * sendBeacon cannot set custom headers, so the visitor code must ride in the
 * cookie — the backend accepts visitor_code from a cookie as well as the
 * X-Visitor-Code header (see the /api/events OpenAPI params).
 */
/**
 * Flush on page close.
 *
 * Uses fetch with keepalive rather than navigator.sendBeacon: sendBeacon cannot
 * set request headers, so it cannot carry X-Tenant-Domain (or X-Visitor-Code).
 * keepalive lets the request outlive the unloading document while still sending
 * a normal header set.
 */
function flushOnPageHide() {
  if (queue.length === 0) return;

  const visitorCode = getVisitorCode();
  if (!visitorCode) return;

  const events = queue;
  queue = [];

  const slices: EventPayload[][] = [];
  for (let i = 0; i < events.length; i += MAX_BATCH) {
    slices.push(events.slice(i, i + MAX_BATCH));
  }

  slices.forEach((batch) => {
    void apiFetch("/api/events/batch", {
      method: "POST",
      headers: { "X-Visitor-Code": visitorCode },
      body: { events: batch },
      keepalive: true,
    }).catch(() => {
      // Page is closing; nothing useful to do.
    });
  });
}

/** Idempotent. Mounted once by AnalyticsInitializer. */
export function startAnalytics(): void {
  if (started || typeof window === "undefined") return;
  started = true;

  // pagehide is the reliable close signal; beforeunload is not.
  window.addEventListener("pagehide", flushOnPageHide);

  if (process.env.NODE_ENV !== "production") {
    // Console handle so the queue can be inspected without waiting for a timer.
    (window as unknown as Record<string, unknown>).__ilaAnalytics = {
      pending: pendingEventCount,
      flush,
      queue: () => queue.slice(),
      ready: () => started,
    };
  }

  console.info("[analytics] tracking started");
}

export function stopAnalytics(): void {
  if (!started || typeof window === "undefined") return;
  window.removeEventListener("pagehide", flushOnPageHide);
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  started = false;
}

/** Test/debug helper. */
export function pendingEventCount(): number {
  return queue.length;
}