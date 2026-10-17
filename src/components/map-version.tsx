"use client";

import React, { useEffect, useRef, useState } from "react";

export type MapViewMode = "default" | "satellite";

export type MapVersionProps = {
  currentMode: MapViewMode;
  onModeChange: (mode: MapViewMode) => void;
  className?: string;
};

export default function MapVersion({
  currentMode = "default",
  onModeChange,
  className = "",
}: MapVersionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-auto relative z-30 select-none ${className}`}
    >
      {/* Trigger Button: Map View */}
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        className="group flex items-center gap-2 rounded-xl border border-white/15 bg-[#171717]/90 px-3 py-2 text-xs font-semibold text-[#f2f0ea] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md transition-all duration-200 hover:border-[#c6a46c] hover:bg-[#222222] active:scale-95 sm:px-3.5 sm:py-2"
      >
        <span className="text-[11px] sm:text-xs tracking-wide">
          Map View
        </span>

        <svg
          className={`h-3.5 w-3.5 text-white/60 transition-transform duration-200 ${
            menuOpen ? "rotate-180 text-[#c6a46c]" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Options */}
      {menuOpen && (
        <div className="absolute left-0 top-full mt-2 w-48 rounded-2xl border border-white/15 bg-[#141519]/95 p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-[#c6a46c] uppercase">
            Map Layers
          </div>

          <div className="flex flex-col gap-1">
            {/* Default Option */}
            <button
              type="button"
              onClick={() => {
                onModeChange("default");
                setMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all ${
                currentMode === "default"
                  ? "bg-[#c6a46c]/15 text-[#f3e5ab] ring-1 ring-[#c6a46c]/40 font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-white">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                </span>
                <span>Default View</span>
              </div>
              {currentMode === "default" && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#c6a46c]" />
              )}
            </button>

            {/* Satellite Version Option */}
            <button
              type="button"
              onClick={() => {
                onModeChange("satellite");
                setMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-all ${
                currentMode === "satellite"
                  ? "bg-[#c6a46c]/15 text-[#f3e5ab] ring-1 ring-[#c6a46c]/40 font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
                  <svg
                    className="h-3 w-3"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </span>
                <span>Satellite Version</span>
              </div>
              {currentMode === "satellite" && (
                <span className="h-1.5 w-1.5 rounded-full bg-[#c6a46c]" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
