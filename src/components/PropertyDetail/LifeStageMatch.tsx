"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
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
  const shownRef = useRef(0);
  const goalRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const moveGoal = (index: number) => {
    const nextIndex = (index + GOALS.length) % GOALS.length;
    const nextGoal = GOALS[nextIndex];
    setGoal(nextGoal.id);
    goalRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    const to = target;

    if (noScore) {
      shownRef.current = to;
      return;
    }

    const from = shownRef.current;
    if (from === to) {
      setAnimated({ goal, value: to });
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = to;
      return;
    }

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
  }, [goal, noScore, target]);

  // Only ever render a value that belongs to the goal on screen.
  const displayScore =
    animated && animated.goal === goal ? animated.value : target;
  const activeGoalIndex = GOALS.findIndex((item) => item.id === goal);

  /**
   * Fit notes for the selected goal, capped at the three the card has room for.
   *
   * Empty when there is no score at all, and also empty when the API published
   * a percentage with no reason text — a real score with nothing written about
   * it. The earlier fallback borrowed the "no fit score" sentence for that
   * second case, which printed it directly under a real number.
   */
  const notes = (
    noScore
      ? []
      : match.reasons?.length
        ? match.reasons
        : match.reason
          ? [match.reason]
          : []
  ).slice(0, 3);

  /**
   * Whether the intro can promise fit notes at all. Checked across every goal
   * rather than the selected one, so switching goals cannot retract the
   * promise halfway down the card.
   */
  const hasReasons = GOALS.some((item) => {
    const entry = property.lifeStageMatch[item.id];
    return Boolean(
      !entry.pending &&
        !entry.unavailable &&
        (entry.reasons?.length || entry.reason),
    );
  });

  const renderResult = (
    modifier = "",
    style?: CSSProperties,
  ) => (
    <div key={goal} className={`pd-match__result${modifier ? ` ${modifier}` : ""}`} style={style} aria-live="polite">
      <div className="pd-match__result-content">
        <p className="pd-match__goalname">{activeGoal.label}</p>
        {noScore ? null : (
          <>
            <p className="pd-match__score">
              <span className="pd-match__score-value">{displayScore}</span>
              <span className="pd-match__score-unit">% match</span>
            </p>
            <div
              key={`${goal}-${target}`}
              className="pd-match__meter"
              role="img"
              aria-label={`${target} percent match`}
            >
              <span style={{ width: `${target}%` }} />
            </div>
          </>
        )}
        {noScore ? (
          <p className="pd-match__reason">
            {pending
              ? "We’re working out how this property fits your goal."
              : "No fit score published for this property yet."}
          </p>
        ) : notes.length > 0 ? (
          <ul className="pd-match__reasons" aria-label="Fit notes for this goal">
            {notes.map((note) => (
              <li key={note}>
                {/* A neutral dash, not a tick. A tick asserts the note is a
                    positive result, and these are observations — "western
                    corridor spillover continues toward Isnapur" is not a
                    compliment. One of them was literally the "no fit score"
                    message, wearing a tick. */}
                <span className="pd-match__reason-mark" aria-hidden="true">—</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="pd-section pd-match" aria-labelledby="pd-match-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Buyer fit</p>
        <h2 id="pd-match-title">How this plot matches your goal</h2>
        <p className="pd-section__lead">
          {hasReasons
            ? "Scores and fit notes are property-specific. Pick a goal to see the fit for "
            : "Scores are property-specific. Pick a goal to see the fit for "}{" "}
          {property.name}.
        </p>

        <div className="pd-match__grid">
          <div
            className="pd-match__goals"
            role="radiogroup"
            aria-label="Life stage goals"
          >
            {GOALS.map((item, index) => {
              const active = item.id === goal;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`pd-match__goal${active ? " is-active" : ""}`}
                  ref={(element) => {
                    goalRefs.current[index] = element;
                  }}
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  style={{ order: index * 2 }}
                  onClick={() => setGoal(item.id)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                      event.preventDefault();
                      moveGoal(index + 1);
                    } else if (
                      event.key === "ArrowUp" ||
                      event.key === "ArrowLeft"
                    ) {
                      event.preventDefault();
                      moveGoal(index - 1);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      moveGoal(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      moveGoal(GOALS.length - 1);
                    }
                  }}
                >
                  <span className="pd-match__goal-copy">
                    <span className="pd-match__goal-label">{item.label}</span>
                    <span className="pd-match__goal-desc">{item.description}</span>
                  </span>
                  <span
                    className="pd-match__goal-indicator"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
            {renderResult("pd-match__result--mobile", {
              order: activeGoalIndex * 2 + 1,
            })}
          </div>

          {renderResult("pd-match__result--desktop")}
        </div>
      </div>
    </section>
  );
}
