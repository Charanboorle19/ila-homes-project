"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import IlaIntroLoader from "@/components/IlaIntroLoader";
import type { PropertyListItem } from "@/services/propertiesService";

/**
 * Duration for the luxury architectural reveal animation from into-ila-homes.html:
 * The keyframe sequences run up to 3.75s (masterGlow + progressRun 2.8s + settle).
 * We keep the loader visible until the reveal completes, then smoothly fade out.
 */
const INTRO_MAX_MS = 3800;
const INTRO_FADE_MS = 500;
/** Mount WebGL in the background so the map is warm and ready when the loader fades. */
const MAP_MOUNT_MS = 1800;

function MapSkeleton() {
  return (
    <div
      className="absolute inset-0 bg-[#090a0c]"
      aria-label="Loading map"
      role="status"
    >
      <div className="absolute inset-0 animate-pulse bg-[#12141a]" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/50 to-transparent" />
    </div>
  );
}

const MapSection = dynamic(() => import("@/components/MapSection"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export default function HomeClientView({
  initialProperties,
}: {
  initialProperties?: PropertyListItem[];
}) {
  const [shouldMountMap, setShouldMountMap] = useState(false);
  const [introOpaque, setIntroOpaque] = useState(true);
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
    const mountTimer = setTimeout(() => {
      setShouldMountMap(true);
    }, MAP_MOUNT_MS);

    const fadeTimer = setTimeout(() => {
      setIntroOpaque(false);
    }, INTRO_MAX_MS - INTRO_FADE_MS);

    const hideTimer = setTimeout(() => {
      setLoaderVisible(false);
    }, INTRO_MAX_MS);

    return () => {
      clearTimeout(mountTimer);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <div className="relative flex-1 w-full h-[calc(100vh-var(--nav-h))] max-h-[calc(100vh-var(--nav-h))] overflow-hidden">
      {/* Lightweight shell under the splash — LCP-friendly before WebGL mounts */}
      {!shouldMountMap ? <MapSkeleton /> : null}

      {shouldMountMap ? (
        <MapSection
          className="h-full w-full"
          hideDetails={true}
          initialProperties={initialProperties}
        />
      ) : null}

      {loaderVisible ? (
        <IlaIntroLoader
          className={
            introOpaque
              ? "opacity-100"
              : "opacity-0 pointer-events-none transition-opacity duration-500 ease-out"
          }
        />
      ) : null}
    </div>
  );
}
