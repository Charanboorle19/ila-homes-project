"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import IlaIntroLoader from "@/components/IlaIntroLoader";

const MapSection = dynamic(() => import("@/components/MapSection"), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full bg-[#090a0c]"
      aria-label="Loading map"
    />
  ),
});

/**
 * Homepage composition.
 *
 * Brand intro paints first. MapLibre / WebGL mounts only after a short delay so
 * shader compile and tile decode do not contend with the architectural reveal.
 */
export default function Home() {
  const [shouldMountMap, setShouldMountMap] = useState(false);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldMountMap(true);
    }, 1200);

    return () => clearTimeout(timer);
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
      {shouldMountMap ? (
        <MapSection
          className="h-full w-full"
          hideDetails={true}
          onMapLoaded={handleMapLoaded}
        />
      ) : (
        <div className="absolute inset-0 bg-[#090a0c]" aria-hidden="true" />
      )}
    </div>
  );
}
