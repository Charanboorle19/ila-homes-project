"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FEATURED_MATCH_ID,
  FEEL_SCORES,
  FEEL_TAGS,
  LIFE_STAGES,
  getLayoutById,
  propertyLayouts,
  type FeelTagId,
  type LifeStage,
  type LifeStageId,
  type PropertyLayout,
} from "@/data/propertyLayouts";
import buildingBg from "@/app/assets/Golden-Hour Family Homecoming.png";
import investmentBg from "@/app/assets/Golden Hour Real Estate Growth.png";
import familyBg from "@/app/assets/Family Dreams Over a New Community.png";
import exploringBg from "@/app/assets/Golden-Hour View of Planned Cityscape.png";

const MATCH_LOAD_MS = 900;
const MOBILE_SHEET_QUERY = "(max-width: 980px)";

const STAGE_IMAGES: Record<LifeStageId, StaticImageData> = {
  building: buildingBg,
  investment: investmentBg,
  family: familyBg,
  exploring: exploringBg,
};

type MatchResult = PropertyLayout & {
  reason: string;
  matchPct?: number;
  comingSoon?: boolean;
};

type ResultStatus = "idle" | "loading" | "ready";

function scoreFeelMatch(layoutId: string, selectedTags: FeelTagId[]): number {
  if (selectedTags.length === 0) return 0;
  const scores = FEEL_SCORES[layoutId as keyof typeof FEEL_SCORES] ?? {};
  const total = selectedTags.reduce((sum, id) => sum + (scores[id] ?? 0), 0);
  return Math.round(total / selectedTags.length);
}

function withFeaturedFirst(
  matches: MatchResult[],
  options?: { feelMode?: boolean },
): MatchResult[] {
  const featured = matches.find((match) => match.id === FEATURED_MATCH_ID);
  const rest = matches.filter((match) => match.id !== FEATURED_MATCH_ID);

  const mappedRest = rest.map((match) =>
    match.available
      ? match
      : {
          ...match,
          comingSoon: true,
          label: match.label,
          priceRange: "Adding soon",
        },
  );

  if (!featured) return mappedRest;

  const featuredCard: MatchResult = {
    ...featured,
    comingSoon: false,
    matchPct: options?.feelMode
      ? Math.max(featured.matchPct ?? 0, 90)
      : featured.matchPct,
  };

  return [featuredCard, ...mappedRest];
}

function CloseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SelectArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IdleGlowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="url(#fyp-idle-glow)" opacity="0.9" />
      <circle cx="24" cy="24" r="10" fill="#c6a46c" opacity="0.35" />
      <circle cx="24" cy="24" r="4.5" fill="#c6a46c" />
      <defs>
        <radialGradient id="fyp-idle-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c6a46c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c6a46c" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function MatchCard({
  match,
  index,
  tone = "dark",
}: {
  match: MatchResult;
  index: number;
  tone?: "dark" | "light";
}) {
  const label = String(index + 1).padStart(2, "0");
  const isLight = tone === "light";

  return (
    <article
      className={`flex overflow-hidden rounded-xl border ${
        isLight
          ? "border-black/8 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
          : "border-[rgba(242,240,234,0.12)] bg-[#23262b]"
      }`}
    >
      <div className="relative w-24 shrink-0 self-stretch sm:w-28">
        <Image
          src={match.image}
          alt=""
          fill
          sizes="112px"
          className={`object-cover ${match.comingSoon ? "grayscale" : ""}`}
        />
        <div
          className={`absolute inset-0 ${
            isLight
              ? "bg-[linear-gradient(90deg,rgba(255,255,255,0)_40%,rgba(255,255,255,0.15)_100%)]"
              : "bg-[linear-gradient(90deg,rgba(28,31,36,0)_40%,rgba(28,31,36,0.35)_100%)]"
          }`}
          aria-hidden
        />
        <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#c6a46c] text-[9px] font-bold text-[#1c1f24]">
          {label}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={`truncate text-sm font-semibold tracking-tight ${
                isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
              }`}
            >
              {match.comingSoon ? "Coming soon" : match.label}
            </h3>
            <p
              className={`mt-0.5 truncate text-[11px] ${
                isLight ? "text-[#6b655c]" : "text-[#9a9388]"
              }`}
            >
              {match.comingSoon
                ? "Full details unlocking soon"
                : `${match.location} · ${match.plotSizes}`}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${
              isLight
                ? "bg-[#1c1f24]/8 text-[#1c1f24]"
                : "bg-black/40 text-[#f2f0ea]"
            }`}
          >
            {match.matchPct != null ? `${match.matchPct}%` : match.tag}
          </span>
        </div>

        <p
          className={`line-clamp-2 text-xs leading-snug ${
            isLight ? "text-[#4a463f]" : "text-[#c4beb3]"
          }`}
        >
          {match.reason}
        </p>

        <div
          className={`flex items-center justify-between gap-2 border-t pt-1.5 ${
            isLight ? "border-black/8" : "border-[rgba(242,240,234,0.1)]"
          }`}
        >
          <p
            className={`truncate text-xs font-semibold ${
              isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
            }`}
          >
            {match.comingSoon ? "Adding soon" : match.priceRange}
          </p>
          {!match.comingSoon && match.available ? (
            <Link
              href="/#projects"
              className="shrink-0 rounded-full bg-[#c6a46c] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-[#1c1f24] uppercase transition hover:bg-[#d4b57e]"
            >
              View
            </Link>
          ) : (
            <span
              className={`shrink-0 text-[10px] font-semibold tracking-wide uppercase ${
                isLight ? "text-[#8a8378]" : "text-[#9a9388]"
              }`}
            >
              Soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function ResultsPanel({
  status,
  matches,
  loadingLabel,
  tone = "dark",
}: {
  status: ResultStatus;
  matches: MatchResult[];
  loadingLabel: string;
  tone?: "dark" | "light";
}) {
  const isLight = tone === "light";

  if (status === "idle") {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center px-6 text-center">
        <IdleGlowIcon className="h-14 w-14" />
        <p
          className={`mt-4 text-base font-semibold ${
            isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
          }`}
        >
          Your matches will appear here
        </p>
        <p
          className={`mt-2 max-w-xs text-sm leading-relaxed ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          Choose a plan above, or pick feelings below — either path works.
        </p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className="flex h-full min-h-64 flex-col items-center justify-center px-6 py-8 text-center"
        aria-busy="true"
      >
        <div
          className={`h-1 w-40 overflow-hidden rounded-full ${
            isLight ? "bg-black/10" : "bg-white/10"
          }`}
        >
          <div className="ila-fyp-progress h-full w-1/2 rounded-full bg-[#c6a46c]" />
        </div>
        <p
          className={`mt-4 text-base font-semibold ${
            isLight ? "text-[#1c1f24]" : "text-[#f2f0ea]"
          }`}
        >
          Finding your match
        </p>
        <p
          className={`mt-1.5 text-sm ${
            isLight ? "text-[#6b655c]" : "text-[#9a9388]"
          }`}
        >
          Searching properties for {loadingLabel}…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-0.5" aria-live="polite">
      <p
        className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${
          isLight ? "text-[#8a6b3a]" : "text-[#c6a46c]"
        }`}
      >
        {matches.length} match{matches.length === 1 ? "" : "es"}
      </p>
      <div className="grid gap-2">
        {matches.map((match, index) => (
          <MatchCard
            key={`${match.id}-${index}`}
            match={match}
            index={index}
            tone={tone}
          />
        ))}
      </div>
    </div>
  );
}

export default function FindYourPlot() {
  const [mode, setMode] = useState<"stage" | "feel" | null>(null);
  const [selectedStage, setSelectedStage] = useState<LifeStageId | null>(null);
  const [revealedStage, setRevealedStage] = useState<LifeStage | null>(null);
  const [selectedFeels, setSelectedFeels] = useState<FeelTagId[]>([]);
  const [revealedFeels, setRevealedFeels] = useState<FeelTagId[]>([]);
  const [status, setStatus] = useState<ResultStatus>("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_SHEET_QUERY);
    const sync = () => setIsMobileSheet(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isMobileSheet || !sheetOpen) {
      document.body.style.overflow = "";
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileSheet, sheetOpen]);

  const runLoading = (next: () => void) => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setStatus("loading");
    if (isMobileSheet) setSheetOpen(true);
    loadTimer.current = setTimeout(() => {
      next();
      setStatus("ready");
    }, MATCH_LOAD_MS);
  };

  const resetAll = () => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setMode(null);
    setSelectedStage(null);
    setRevealedStage(null);
    setSelectedFeels([]);
    setRevealedFeels([]);
    setStatus("idle");
    setSheetOpen(false);
  };

  const selectStage = (stageId: LifeStageId) => {
    if (selectedStage === stageId) {
      resetAll();
      return;
    }

    const stage = LIFE_STAGES.find((item) => item.id === stageId) ?? null;
    setMode("stage");
    setSelectedStage(stageId);
    setSelectedFeels([]);
    setRevealedFeels([]);
    runLoading(() => setRevealedStage(stage));
  };

  const toggleFeel = (tagId: FeelTagId) => {
    const next = selectedFeels.includes(tagId)
      ? selectedFeels.filter((id) => id !== tagId)
      : [...selectedFeels, tagId];

    setSelectedStage(null);
    setRevealedStage(null);
    setSelectedFeels(next);

    if (next.length === 0) {
      if (loadTimer.current) clearTimeout(loadTimer.current);
      setMode(null);
      setRevealedFeels([]);
      setStatus("idle");
      setSheetOpen(false);
      return;
    }

    setMode("feel");
    runLoading(() => setRevealedFeels(next));
  };

  const stageMatches = useMemo(() => {
    if (!revealedStage) return [];

    const raw = revealedStage.matchIds
      .map((id) => {
        const layout = getLayoutById(id);
        if (!layout) return null;
        return {
          ...layout,
          reason: revealedStage.reasons[id] ?? layout.highlight,
        } satisfies MatchResult;
      })
      .filter((item): item is MatchResult => Boolean(item));

    return withFeaturedFirst(raw);
  }, [revealedStage]);

  const feelMatches = useMemo(() => {
    if (revealedFeels.length === 0) return [];

    const raw = propertyLayouts
      .map((layout) => ({
        ...layout,
        matchPct: scoreFeelMatch(layout.id, revealedFeels),
        reason: layout.highlight,
      }))
      .sort((a, b) => {
        if (a.id === FEATURED_MATCH_ID) return -1;
        if (b.id === FEATURED_MATCH_ID) return 1;
        return b.matchPct - a.matchPct;
      })
      .slice(0, 4);

    return withFeaturedFirst(raw, { feelMode: true });
  }, [revealedFeels]);

  const matches = mode === "feel" ? feelMatches : stageMatches;

  const loadingLabel =
    mode === "feel"
      ? selectedFeels
          .map((id) => FEEL_TAGS.find((tag) => tag.id === id)?.label)
          .filter(Boolean)
          .slice(0, 2)
          .join(", ") || "your preferences"
      : (LIFE_STAGES.find((stage) => stage.id === selectedStage)?.title ??
        "your selection");

  return (
    <section data-section="land_roadmap"
      id="contact"
      className="find-your-plot relative w-full max-w-full overflow-x-clip border-t border-white/5 bg-[#1c1f24]"
      aria-label="Find your plot"
    >
      <div className="relative mx-auto w-full max-w-full min-w-0 px-4 py-10 sm:px-8 sm:py-12 lg:px-12">
        <header className="max-w-2xl">
          <p className="text-[10px] font-semibold tracking-[0.22em] text-[#c6a46c] uppercase">
            Find your plot
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#f2f0ea] sm:text-3xl">
            What are you planning?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9a9388] sm:text-[15px]">
            Tell us what matters to you. We&apos;ll show you properties that fit
            your goals.
          </p>
        </header>

        <div className="mt-8 grid min-w-0 gap-8 min-[981px]:grid-cols-[1.15fr_0.85fr] min-[981px]:items-start min-[981px]:gap-10">
          <div className="min-w-0 space-y-6">
            <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3">
              {LIFE_STAGES.map((stage) => {
                const active = selectedStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectStage(stage.id)}
                    data-track="PERSONA_SELECT"
                    data-track-meta={`{"persona_id":"${stage.id}","selected":${!active}}`}
                    className={`group relative flex min-h-44 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-[14px] border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c] sm:min-h-52 sm:p-4 ${
                      active
                        ? "border-[#c6a46c] shadow-[0_0_0_1px_rgba(198,164,108,0.45)]"
                        : "border-white/15 hover:border-white/30"
                    }`}
                  >
                    <Image
                      src={STAGE_IMAGES[stage.id]}
                      alt=""
                      fill
                      sizes="(max-width: 980px) 50vw, 280px"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      priority={stage.id === "building"}
                    />
                    <div
                      className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,12,12,0.25)_0%,rgba(12,12,12,0.62)_48%,rgba(12,12,12,0.92)_100%)]"
                      aria-hidden
                    />
                    <div className="relative z-10 mt-auto flex h-full min-h-0 flex-1 flex-col justify-end">
                      <p className="text-base font-semibold leading-snug text-white sm:text-lg">
                        {stage.title}
                      </p>
                      <p className="mt-1.5 text-xs leading-snug break-normal text-white/78 sm:mt-2 sm:text-sm">
                        {stage.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:mt-4 sm:gap-x-3">
                        <p className="text-[10px] font-semibold tracking-wide text-[#e4c48a] uppercase sm:text-[11px]">
                          {stage.countLabel}
                        </p>
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#c6a46c] text-[#1c1f24] transition group-hover:bg-[#d4b57e] sm:h-7 sm:w-7">
                          <SelectArrowIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="relative flex items-center gap-4 py-1" aria-hidden>
              <div className="h-px min-w-0 flex-1 bg-[rgba(242,240,234,0.12)]" />
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.2em] text-[#9a9388] uppercase">
                Or
              </span>
              <div className="h-px min-w-0 flex-1 bg-[rgba(242,240,234,0.12)]" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#c4beb3] uppercase">
                Tell us what you want to feel
              </p>
              <div
                className="mt-3 -mx-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0"
                role="group"
                aria-label="Emotional preferences"
              >
                <div className="grid w-max grid-rows-2 grid-flow-col gap-2">
                  {FEEL_TAGS.map((tag) => {
                    const isOn = selectedFeels.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={isOn}
                        onClick={() => toggleFeel(tag.id)}
                        data-track="PREFERENCE_TAG_SELECT"
                        data-track-meta={`{"tag_id":"${tag.id}","selected":${!isOn}}`}
                        className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c] ${
                          isOn
                            ? "bg-[#c6a46c] text-[#1c1f24]"
                            : "border border-[rgba(242,240,234,0.14)] bg-[#23262b] text-[#c4beb3] hover:border-[rgba(242,240,234,0.28)] hover:text-[#f2f0ea]"
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {isMobileSheet && status !== "idle" && !sheetOpen ? (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-[#c6a46c] px-4 py-2.5 text-xs font-semibold tracking-wide text-[#1c1f24] uppercase transition hover:bg-[#d4b57e] min-[981px]:hidden"
              >
                View matches
              </button>
            ) : null}
          </div>

          <aside className="hidden min-[981px]:block">
            <div className="sticky top-24 min-h-112 overflow-hidden rounded-[22px] bg-[radial-gradient(ellipse_at_50%_28%,#ffffff_0%,#f4f0e8_55%,#ebe4d8_100%)] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]">
              <div className="max-h-[min(70vh,40rem)] overflow-y-auto">
                <ResultsPanel
                  status={status}
                  matches={matches}
                  loadingLabel={loadingLabel}
                  tone="light"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isMobileSheet && sheetOpen ? (
        <div className="fixed inset-0 z-50 min-[981px]:hidden">
          <button
            type="button"
            aria-label="Close matches"
            className="absolute inset-0 bg-black/55"
            onClick={() => setSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Your plot matches"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[rgba(242,240,234,0.12)] bg-[#1c1f24] px-4 pt-3 pb-6 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] animate-sheet-up"
          >
            <div className="relative mb-3 flex items-center justify-center">
              <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
              <button
                type="button"
                aria-label="Close matches sheet"
                onClick={() => setSheetOpen(false)}
                className="absolute top-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2d32] text-[#f2f0ea]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <ResultsPanel
              status={status}
              matches={matches}
              loadingLabel={loadingLabel}
              tone="dark"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
