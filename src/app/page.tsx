"use client";

import { useEffect, useState } from "react";
import MapSection from "@/components/MapSection";
import IlaIntroLoader from "@/components/IlaIntroLoader";

/**
 * Homepage composition.
 *
 * Map fills the viewport directly below the sticky Navbar with zero page scrollbars.
 * An architectural reveal intro loader from into-ila-homes.html plays initially
 * while the map and pins are loading.
 */
export default function Home() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");

    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, []);

  const handleMapLoaded = () => {
    if (!mapLoaded) {
      setMapLoaded(true);
      // Allow animation to complete its reveal gracefully before fading out
      setTimeout(() => {
        setLoaderVisible(false);
      }, 700);
    }
  };

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-var(--nav-h))] max-h-[calc(100vh-var(--nav-h))] overflow-hidden">
      {loaderVisible && (
        <IlaIntroLoader
          className={
            mapLoaded
              ? "opacity-0 pointer-events-none transition-opacity duration-700"
              : "opacity-100"
          }
        />
      )}
      <MapSection
        className="h-full w-full"
        hideDetails={true}
        onMapLoaded={handleMapLoaded}
      />
    </div>
  );
}