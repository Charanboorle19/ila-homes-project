"use client";

import { useEffect } from "react";
import { startVisitorSession } from "@/services/visitorService";
import { getSessionId, setSessionId } from "@/lib/session";
import { whenVisitorReady } from "@/lib/visitorReady";
import { useVisitorActivity } from "@/lib/useVisitorActivity";

/**
 * Guards against duplicate POSTs under React StrictMode's double effect
 * invocation. See VisitorInitializer for the same pattern.
 */
let inFlight: Promise<void> | null = null;

export default function SessionInitializer() {
  // Mounted so activity is tracked for the whole visit. The state is not
  // rendered; consumers should call useVisitorActivity() directly.
  const activity = useVisitorActivity();

  useEffect(() => {
    if (activity.isActive) {
      console.log("[session] Activity signal", {
        session_id: activity.sessionId,
        idle_for_minutes: Math.round(activity.idleForMs / 60000),
      });
    }
  }, [activity.isActive, activity.idleForMs, activity.sessionId]);

  useEffect(() => {
    const existingSessionId = getSessionId();

    if (existingSessionId) {
      console.log("[session] Session id found in sessionStorage, skipping POST /api/sessions", {
        session_id: existingSessionId,
      });
      return;
    }

    if (inFlight) {
      console.log("[session] Request already in progress, skipping duplicate");
      return;
    }

    console.log("[session] No session id in sessionStorage, calling POST /api/sessions");

    inFlight = (async () => {
      // On a first visit the visitor_code cookie does not exist yet, since
      // POST /api/visitors is still in flight. Wait for it rather than
      // failing on a missing code.
      const visitor = await whenVisitorReady();

      if (visitor.error || !visitor.code) {
        console.error(
          "[session] Skipped: no visitor_code available (visitor creation failed)",
          visitor.error,
        );
        return;
      }

      try {
        const response = await startVisitorSession();
        const sessionId = response.data?.session_id;
        const reused = response.data?.reused;

        console.log("[session] API response received", {
          session_id: sessionId,
          reused,
        });

        if (sessionId) {
          setSessionId(sessionId);
          console.log("[session] session_id saved to sessionStorage", {
            session_id: sessionId,
          });
        } else {
          console.warn("[session] API returned no session_id");
        }
      } catch (error) {
        console.error("[session] Failed to start visitor session", error);
      } finally {
        inFlight = null;
      }
    })();
  }, []);

  return null;
}