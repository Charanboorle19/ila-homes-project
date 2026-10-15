"use client";

import { useEffect } from "react";
import MapSection from "@/components/MapSection";

/**
 * Homepage composition.
 *
 * Map fills the viewport directly below the sticky Navbar with zero page scrollbars.
 */
export default function Home() {
  useEffect(() => {
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, []);

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-var(--nav-h))] max-h-[calc(100vh-var(--nav-h))] overflow-hidden">
      <MapSection className="h-full w-full" />
    </div>
  );
}