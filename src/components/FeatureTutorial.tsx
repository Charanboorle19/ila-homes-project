"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

const TUTORIAL_COOKIE = "ila_tutorial_seen";
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export type TutorialStepId = "wishlist" | "emi" | "compare" | "findYourPlot";

interface TutorialStep {
  id: TutorialStepId;
  targetId: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  positionDesktop: "left-center" | "top-center" | "bottom-center";
}

const STEPS: TutorialStep[] = [
  {
    id: "wishlist",
    targetId: "tutorial-target-wishlist",
    badge: "WISHLIST",
    description: "Save your favourite properties and share them with family on WhatsApp.",
    icon: (
      <svg className="h-5 w-5 text-[#c6a46c]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 50 85 L 20 54.5 A 20 20 0 0 1 48 24.8 L 50 27.2 L 52 24.8 A 20 20 0 0 1 80 54.5 Z" fill="currentColor" fillOpacity="0.25" />
      </svg>
    ),
    positionDesktop: "left-center",
  },
  {
    id: "emi",
    targetId: "tutorial-target-emi",
    badge: "EMI CALCULATOR",
    description: "Check your monthly loan payment and see how your property's value could grow.",
    icon: (
      <svg className="h-5 w-5 text-[#c6a46c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="3" />
        <line x1="8" y1="6" x2="16" y2="6" />
        <line x1="8" y1="10" x2="16" y2="10" />
        <line x1="8" y1="14" x2="12" y2="14" />
      </svg>
    ),
    positionDesktop: "left-center",
  },
  {
    id: "compare",
    targetId: "tutorial-target-compare",
    badge: "COMPARE",
    description: "Compare prices, plot sizes and features to find what suits you best.",
    icon: (
      <svg className="h-5 w-5 text-[#c6a46c]" viewBox="0 0 100 100" fill="currentColor">
        <rect x="18" y="22" width="26" height="26" rx="5.5" />
        <rect x="64" y="22" width="26" height="26" rx="5.5" />
        <rect x="18" y="53" width="72" height="5.5" rx="2.75" />
        <path d="M 48 56 H 60 L 70.5 76.5 A 5.5 5.5 0 0 1 65.6 84.5 H 42.4 A 5.5 5.5 0 0 1 37.5 76.5 Z" />
      </svg>
    ),
    positionDesktop: "left-center",
  },
  {
    id: "findYourPlot",
    targetId: "tutorial-target-find-your-plot",
    badge: "FIND YOUR PLOT",
    description: "Choose what matters to you and find plots that match your needs.",
    icon: (
      <svg className="h-5 w-5 text-[#c6a46c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    positionDesktop: "top-center",
  },
];

function hasTutorialCookie(): boolean {
  if (typeof document === "undefined") return true;
  return document.cookie
    .split("; ")
    .some((item) => item.startsWith(`${TUTORIAL_COOKIE}=`));
}

function setTutorialCookie(): void {
  if (typeof document === "undefined") return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const expires = new Date(Date.now() + ONE_YEAR_IN_SECONDS * 1000).toUTCString();
  document.cookie = `${TUTORIAL_COOKIE}=true; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

interface FeatureTutorialProps {
  /** Delay in milliseconds before automatically starting tutorial for first-time visitors */
  autoStartDelayMs?: number;
  /** Whether the map is fully loaded and ready */
  mapReady?: boolean;
}

export default function FeatureTutorial({
  autoStartDelayMs = 1000,
  mapReady = true,
}: FeatureTutorialProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-side mount check
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check cookie and start tutorial automatically if first time
  useEffect(() => {
    if (!mounted || !mapReady) return;
    if (hasTutorialCookie()) return;

    timerRef.current = setTimeout(() => {
      setActiveStepIndex(0);
    }, autoStartDelayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mounted, mapReady, autoStartDelayMs]);

  // Update target rect when step changes or on resize/scroll
  const updateTargetRect = useCallback(() => {
    if (activeStepIndex === null) {
      setTargetRect(null);
      return;
    }

    const step = STEPS[activeStepIndex];
    if (!step) return;

    const el = document.getElementById(step.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [activeStepIndex]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect);
    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect);
    };
  }, [updateTargetRect]);

  const handleNext = () => {
    if (activeStepIndex === null || isTransitioning) return;
    if (activeStepIndex < STEPS.length - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveStepIndex((prev) => (prev !== null ? prev + 1 : 0));
        setIsTransitioning(false);
      }, 160);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (activeStepIndex === null || isTransitioning || activeStepIndex === 0) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveStepIndex((prev) => (prev !== null ? prev - 1 : 0));
      setIsTransitioning(false);
    }, 160);
  };

  const handleComplete = () => {
    setActiveStepIndex(null);
    setTutorialCookie();
  };

  if (!mounted || activeStepIndex === null) {
    return null;
  }

  const currentStep = STEPS[activeStepIndex];
  const isLast = activeStepIndex === STEPS.length - 1;

  // Calculate coordinates & positioning for spotlight
  const isPill = targetRect ? targetRect.height < 60 : true;
  const padding = 6;
  const spotlightX = targetRect ? Math.max(0, targetRect.left - padding) : 0;
  const spotlightY = targetRect ? Math.max(0, targetRect.top - padding) : 0;
  const spotlightW = targetRect ? targetRect.width + padding * 2 : 0;
  const spotlightH = targetRect ? targetRect.height + padding * 2 : 0;
  const spotlightRadius = isPill ? spotlightH / 2 : 16;

  // Responsive card positioning
  let cardStyle: React.CSSProperties = {};
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    if (currentStep.positionDesktop === "top-center" && targetRect) {
      // When highlighting bottom Find Your Plot tags on mobile, position card well above them
      const bottomOffset = window.innerHeight - targetRect.top + 24;
      cardStyle = {
        position: "fixed",
        bottom: `${bottomOffset}px`,
        left: "16px",
        right: "16px",
        maxWidth: "420px",
        margin: "0 auto",
        zIndex: 510,
      };
    } else {
      // Default mobile dock position
      cardStyle = {
        position: "fixed",
        bottom: "24px",
        left: "16px",
        right: "16px",
        maxWidth: "420px",
        margin: "0 auto",
        zIndex: 510,
      };
    }
  } else if (targetRect && currentStep.positionDesktop === "left-center") {
    // Position comfortably to the left of the quick-action button
    const cardWidth = 360;
    const rightOffset = window.innerWidth - targetRect.left + 22;
    // Align card vertically centered with target button
    const topOffset = Math.min(
      Math.max(20, targetRect.top + targetRect.height / 2 - 130),
      window.innerHeight - 300,
    );
    cardStyle = {
      position: "fixed",
      right: `${rightOffset}px`,
      top: `${topOffset}px`,
      width: `${cardWidth}px`,
      zIndex: 510,
    };
  } else if (targetRect && currentStep.positionDesktop === "top-center") {
    // Position comfortably high above the entire bottom FindYourPlot block, centered horizontally
    const cardWidth = 400;
    const bottomOffset = window.innerHeight - targetRect.top + 28;
    cardStyle = {
      position: "fixed",
      left: "50%",
      transform: isTransitioning ? "translate(-50%, 0) scale(0.97)" : "translate(-50%, 0) scale(1)",
      bottom: `${bottomOffset}px`,
      width: `${cardWidth}px`,
      maxWidth: "calc(100vw - 32px)",
      zIndex: 510,
    };
  } else {
    cardStyle = {
      position: "fixed",
      top: "45%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: "360px",
      zIndex: 510,
    };
  }

  return (
    <>
      <style>{`
        /* GPU-composited: transform + opacity only (no box-shadow / stroke / filter). */
        @keyframes ilaTutorialPulse {
          0% {
            transform: scale(0.96);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.4;
          }
          100% {
            transform: scale(0.96);
            opacity: 0.9;
          }
        }
        @keyframes ilaBeaconPing {
          0% {
            transform: scale(0.9);
            opacity: 0.85;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
        .ila-tutorial-pulse,
        .ila-beacon-ping {
          will-change: transform, opacity;
          transform-origin: center center;
        }
      `}</style>

      {/* Dim overlay with live SVG transparent mask cutout */}
      {targetRect ? (
        <svg
          className="fixed inset-0 z-490 h-full w-full pointer-events-auto"
          onClick={handleComplete}
          aria-hidden="true"
        >
          <defs>
            <mask id="tutorial-spotlight-mask">
              {/* White = Dim backdrop covering whole screen */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Black = 100% Transparent Cutout for target button with transition */}
              <rect
                x={spotlightX}
                y={spotlightY}
                width={spotlightW}
                height={spotlightH}
                rx={spotlightRadius}
                fill="black"
                style={{
                  transition: "x 380ms cubic-bezier(0.25, 1, 0.5, 1), y 380ms cubic-bezier(0.25, 1, 0.5, 1), width 380ms cubic-bezier(0.25, 1, 0.5, 1), height 380ms cubic-bezier(0.25, 1, 0.5, 1), rx 380ms ease",
                }}
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(10, 11, 14, 0.65)"
            mask="url(#tutorial-spotlight-mask)"
          />
        </svg>
      ) : (
        <div
          className="fixed inset-0 z-490 bg-[#0a0b0e]/65 pointer-events-auto"
          onClick={handleComplete}
          aria-hidden="true"
        />
      )}

      {/* High-visibility Gold Spotlight Ring — composited pulse (transform/opacity) */}
      {targetRect ? (
        <div
          className="ila-tutorial-pulse fixed pointer-events-none z-495"
          style={{
            top: `${spotlightY}px`,
            left: `${spotlightX}px`,
            width: `${spotlightW}px`,
            height: `${spotlightH}px`,
            borderRadius: `${spotlightRadius}px`,
            border: "2px solid #e0c58e",
            boxShadow: "0 0 20px rgba(198, 164, 108, 0.35)",
            animation: "ilaTutorialPulse 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1)",
            // Do not transition transform/opacity — those are driven by the keyframes.
            transition:
              "top 380ms cubic-bezier(0.25, 1, 0.5, 1), left 380ms cubic-bezier(0.25, 1, 0.5, 1), width 380ms cubic-bezier(0.25, 1, 0.5, 1), height 380ms cubic-bezier(0.25, 1, 0.5, 1), border-radius 380ms ease",
          }}
        >
          {/* Outer beacon wave on an HTML container (not SVG stroke) */}
          <div
            className="ila-beacon-ping absolute -inset-1 rounded-[inherit] border border-[#c6a46c]/60 pointer-events-none"
            style={{ animation: "ilaBeaconPing 2.2s infinite cubic-bezier(0, 0, 0.2, 1)" }}
          />
        </div>
      ) : null}

      {/* Interactive Feature Tutorial Card */}
      <div
        style={{
          ...cardStyle,
          transition: "all 380ms cubic-bezier(0.25, 1, 0.5, 1)",
          opacity: isTransitioning ? 0.3 : 1,
          transform: cardStyle.transform
            ? cardStyle.transform
            : isTransitioning
            ? "scale(0.97)"
            : "scale(1)",
        }}
        className="pointer-events-auto flex flex-col rounded-2xl border border-[#c6a46c]/50 bg-linear-to-b from-[#1c1f26]/98 to-[#13151a]/98 p-5 text-[#f2f0ea] shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(198,164,108,0.15)] backdrop-blur-2xl"
        role="dialog"
        aria-label="Feature Guide"
      >
        {/* Header with Icon, Eyebrow (STEP X OF 4 · FEATURE), and Close */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#c6a46c]/30 to-[#c6a46c]/10 border border-[#c6a46c]/40 shadow-inner">
              {currentStep.icon}
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#c6a46c]">
              STEP {activeStepIndex + 1} OF {STEPS.length} · {currentStep.badge}
            </span>
          </div>

          <button
            type="button"
            onClick={handleComplete}
            aria-label="Close tutorial"
            title="Skip tutorial"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white active:scale-95"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="pt-3.5 pb-4">
          <p className="text-[13px] font-medium text-white/90 leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        {/* Footer with Step Dots, Back, Skip & Next Button */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (activeStepIndex !== idx) {
                    setIsTransitioning(true);
                    setTimeout(() => {
                      setActiveStepIndex(idx);
                      setIsTransitioning(false);
                    }, 160);
                  }
                }}
                title={`Go to step ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === activeStepIndex
                    ? "w-6 bg-[#c6a46c] shadow-[0_0_8px_rgba(198,164,108,0.8)]"
                    : idx < activeStepIndex
                    ? "w-2 bg-[#c6a46c]/60"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {activeStepIndex > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition hover:text-white active:scale-95"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/60 transition hover:text-white"
              >
                Skip
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#e0c58e] via-[#c6a46c] to-[#b38e52] px-4 py-1.5 text-xs font-bold text-[#141519] shadow-[0_4px_16px_rgba(198,164,108,0.35)] transition-all hover:brightness-110 active:scale-95"
            >
              <span>{isLast ? "Got it" : "Next"}</span>
              <svg className="h-3.5 w-3.5 stroke-[2.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
