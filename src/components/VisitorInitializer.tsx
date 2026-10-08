"use client";

import { useEffect } from "react";
import { getVisitorCode, setVisitorCode } from "@/lib/visitor";
import { createVisitor } from "@/services/visitorService";
import {
  markVisitorFailed,
  markVisitorReady,
} from "@/lib/visitorReady";

/**
 * Guards against duplicate POSTs.
 *
 * React StrictMode double-invokes effects in dev. On a first visit the cookie
 * is not written until the POST resolves, so a second invocation would still
 * see no cookie and create a second visitor. This module-level flag makes the
 * request idempotent for the lifetime of the page.
 */
let inFlight: Promise<void> | null = null;

export default function VisitorInitializer() {
  useEffect(() => {
    const existingCode = getVisitorCode();

    if (existingCode) {
      console.log("[visitor] Cookie found, skipping POST /api/visitors", {
        visitor_code: existingCode,
      });
      markVisitorReady(existingCode);
      return;
    }

    if (inFlight) {
      console.log("[visitor] Request already in progress, skipping duplicate");
      return;
    }

    console.log("[visitor] No visitor_code cookie, calling POST /api/visitors");

    inFlight = (async () => {
      try {
        const response = await createVisitor();
        const visitorCode = response.data?.visitor_code;
        const isNew = response.data?.is_new;

        console.log("[visitor] API response received", {
          visitor_code: visitorCode,
          is_new: isNew,
        });

        if (visitorCode) {
          setVisitorCode(visitorCode);
          markVisitorReady(visitorCode);
          console.log("[visitor] Cookie saved for 1 year", {
            visitor_code: visitorCode,
          });
        } else {
          console.warn("[visitor] API returned no visitor_code");
          markVisitorFailed(new Error("API returned no visitor_code"));
        }
      } catch (error) {
        console.error(
          "[visitor] Initialization failed. If this is a network/CORS error, the backend only allows http://localhost:3000 as an origin.",
          error,
        );
        markVisitorFailed(error);
      } finally {
        inFlight = null;
      }
    })();
  }, []);

  return null;
}