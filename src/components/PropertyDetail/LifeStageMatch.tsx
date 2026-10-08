"use client";

import { useEffect, useRef, useState } from "react";
import type { LifeStageKey, PropertyRecord } from "@/data/properties";

const GOALS: { id: LifeStageKey; label: string; description: string }[] = [
  {
    id: "family",
    label: "Starting a family",
    description: "Space, schools, and everyday ease.",
  },
  {
    id: "investment",
    label: "Investment first",
    description: "Corridor upside and resale narrative.",
  },
  {
    id: "building",
    label: "Building my home",
    description: "Plot geometry ready to construct.",
  },
  {
    id: "retirement",
    label: "Quiet retirement",
    description: "Softer pace and open sky.",
  },
];

export default function LifeStageMatch({
  property,
}: {
  property: PropertyRecord;
}) {
  const [goal, setGoal] = useState<LifeStageKey>("family");
  const match = property.lifeStageMatch[goal];
  const activeGoal = GOALS.find((item) => item.id === goal) ?? GOALS[0];

  // API-backed properties fetch their fit after the page renders. Until it
  // lands — or if it never does — show a placeholder rather than a misleading
  // 0% match.
  const pending = Boolean(match.pending);
  const noScore = pending || Boolean(match.unavailable);

  // Count the score up instead of snapping it, so switching goals reads as a
  // single animated transition rather than a content swap.
  const target = match.score;
  // The animated value is tagged with the goal it belongs to. Without that, a
  // count-up still running when another goal is picked would keep showing the
  // previous goal's number until its first frame landed — and if the visitor
  // prefers reduced motion the number never updated at all.
  const [animated, setAnimated] = useState<{
    goal: LifeStageKey;
    value: number;
  } | null>(null);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    const to = target;

    if (from === to) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const duration = 620;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const value = Math.round(from + (to - from) * eased);
      shownRef.current = value;
      setAnimated({ goal, value });
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [goal, target]);

  // Only ever render a value that belongs to the goal on screen.
  const displayScore =
    animated && animated.goal === goal && !noScore ? animated.value : target;

  return (
    <section className="pd-section pd-match" aria-labelledby="pd-match-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Buyer fit</p>
        <h2 id="pd-match-title">How this plot matches your goal</h2>
        <p className="pd-section__lead">
          Scores and reasons are property-specific. Pick a goal to see the fit for{" "}
          {property.name}.
        </p>

        <div className="pd-match__grid">
          <div
            className="pd-match__goals"
            role="group"
            aria-label="Life stage goals"
          >
            {GOALS.map((item) => {
              const active = item.id === goal;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`pd-match__goal${active ? " is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => setGoal(item.id)}
                >
                  <span className="pd-match__goal-label">{item.label}</span>
                  <span className="pd-match__goal-desc">{item.description}</span>
                </button>
              );
            })}
          </div>

          <div className="pd-match__result" aria-live="polite">
            <p key={`name-${goal}`} className="pd-match__goalname">
              {activeGoal.label}
            </p>
            <p className="pd-match__score">
              {noScore ? (
                <span className="pd-match__score-value pd-match__score-value--pending">
                  —
                </span>
              ) : (
                <span className="pd-match__score-value">{displayScore}</span>
              )}
              <span className="pd-match__score-unit">% match</span>
            </p>
            <div
              key={`${goal}-${target}`}
              className={`pd-match__meter${pending ? " pd-match__meter--pending" : ""}`}
              role="img"
              aria-label={
                noScore
                  ? "No fit score"
                  : `${target} percent match`
              }
            >
              {noScore ? null : (
                <span style={{ width: `${Math.min(target, 100)}%` }} />
              )}
            </div>
            <p key={`reason-${goal}`} className="pd-match__reason">
              {match.reason}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
