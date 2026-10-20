"use client";

import { useEffect, useState } from "react";
import AnalyticsInitializer from "@/components/AnalyticsInitializer";
import SessionInitializer from "@/components/SessionInitializer";
import VisitorInitializer from "@/components/VisitorInitializer";

/**
 * Defers visitor / session / analytics mount until the browser is idle so
 * those network calls do not compete with MapLibre shader compile and first
 * tile decode on the critical path.
 */
export default function TelemetryBootstrap() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initTelemetry = () => {
      setReady(true);
    };

    if ("requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(initTelemetry, { timeout: 2500 });
      return () => window.cancelIdleCallback(handle);
    }

    const timer = setTimeout(initTelemetry, 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <>
      <VisitorInitializer />
      <SessionInitializer />
      <AnalyticsInitializer />
    </>
  );
}
