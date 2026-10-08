"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionId } from "@/lib/session";

/**
 * Read-only visitor activity tracking.
 *
 * This deliberately does NOT call POST /api/sessions/{id}/end. The backend owns
 * session lifecycle and its inactivity window is not exposed via /openapi.json,
 * so ending sessions from here risks splitting one visit into two whenever the
 * backend window is longer than ours. The backend ends idle sessions itself.
 *
 * Use this instead to gate UI that should only fire for engaged visitors
 * (lead forms, WhatsApp modals, follow-up prompts).
 */

const IDLE_AFTER_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Meaningful engagement only. Mousemove is excluded because it fires at
 * pointer-sampling rates (60+/s) and implies presence, not intent.
 * A tab left open is also not activity.
 */
const ACTIVITY_EVENTS = [
  "click",
  "scroll",
  "keydown",
  "touchstart",
  "pointerdown",
] as const;

type ActivityState = {
  lastActivityAt: number | null;
  idleForMs: number;
  isActive: boolean;
  sessionId: string | null;
};

export function useVisitorActivity() {
  const [state, setState] = useState<ActivityState>({
    lastActivityAt: null,
    idleForMs: 0,
    isActive: false,
    sessionId: null,
  });

  // Ref so listeners read the latest timestamp without re-binding.
  const lastActivityAt = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);

  const markActive = useCallback(() => {
    lastActivityAt.current = Date.now();
  }, []);

  useEffect(() => {
    sessionId.current = getSessionId();

    const recompute = () => {
      const last = lastActivityAt.current;

      setState({
        lastActivityAt: last,
        idleForMs: last === null ? 0 : Date.now() - last,
        isActive: last !== null && Date.now() - last < IDLE_AFTER_MS,
        sessionId: sessionId.current,
      });
    };

    // Any real interaction on this page load means the visitor is active.
    markActive();
    recompute();

    const handler = () => markActive();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handler, { passive: true }),
    );

    // Periodic check. Note browsers throttle timers in background tabs, so
    // idleForMs may update less frequently while the tab is hidden. That is
    // acceptable here: the value is a UI signal, not an authoritative timer.
    const interval = window.setInterval(recompute, CHECK_INTERVAL_MS);

    // Recompute immediately when the tab becomes visible again, so a session
    // that went idle in the background is not reported as active.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") recompute();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handler),
      );
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [markActive]);

  return state;
}

/**
 * Fire a callback once per session, but only if the visitor is still active.
 * Use for prompts that should not appear after a long idle period.
 */
export function useActiveSessionCallback(
  callback: () => void,
  deps: unknown[] = [],
) {
  const { isActive, sessionId } = useVisitorActivity();
  const firedFor = useRef<string | null>(null);
  const cb = useRef(callback);

  // Assign in an effect rather than during render, so the ref always holds the
  // latest callback without reading/writing refs mid-render.
  useEffect(() => {
    cb.current = callback;
  });

  useEffect(() => {
    if (!isActive || !sessionId) return;
    if (firedFor.current === sessionId) return;

    firedFor.current = sessionId;
    cb.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, sessionId, ...deps]);
}