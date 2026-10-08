"use client";

import { useState } from "react";

const STEPS = [
  {
    id: "select",
    number: "01",
    name: "Select & review",
    summary: "Shortlist the plot, zoning, and itemized price sheet.",
  },
  {
    id: "inspect",
    number: "02",
    name: "Site inspection",
    summary: "Walk boundaries, access, drainage, and utilities.",
  },
  {
    id: "legal",
    number: "03",
    name: "Legal diligence",
    summary: "Title chain, approvals, and advocate access.",
  },
  {
    id: "agreement",
    number: "04",
    name: "Agreement & payment",
    summary: "Sale agreement with clear payment paths.",
  },
  {
    id: "register",
    number: "05",
    name: "Registration",
    summary: "Complete registration with guided paperwork.",
  },
] as const;

export default function BuyingJourneySteps() {
  const [activeId, setActiveId] = useState<(typeof STEPS)[number]["id"]>(
    STEPS[0].id,
  );
  const active = STEPS.find((step) => step.id === activeId) ?? STEPS[0];

  return (
    <section className="pd-section pd-journey" aria-labelledby="pd-journey-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Buying journey</p>
        <h2 id="pd-journey-title">From shortlist to registration</h2>
        <p className="pd-section__lead">
          Shared process for every property — the plot changes, the steps stay
          clear.
        </p>

        <ol className="pd-journey__steps">
          {STEPS.map((step) => {
            const selected = step.id === activeId;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={selected ? "is-active" : ""}
                  aria-pressed={selected}
                  onClick={() => setActiveId(step.id)}
                >
                  <span>{step.number}</span>
                  {step.name}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="pd-journey__detail" aria-live="polite">
          <p className="pd-journey__number">{active.number}</p>
          <h3>{active.name}</h3>
          <p>{active.summary}</p>
        </div>
      </div>
    </section>
  );
}
