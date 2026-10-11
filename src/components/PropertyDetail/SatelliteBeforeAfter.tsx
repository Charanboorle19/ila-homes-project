"use client";

import { useState } from "react";
import type { PropertyRecord } from "@/data/properties";

export default function SatelliteBeforeAfter({
  property,
}: {
  property: PropertyRecord;
}) {
  const [activeYear, setActiveYear] = useState(
    property.timeline[property.timeline.length - 2]?.year ??
      property.timeline[0]?.year ??
      "",
  );

  const active =
    property.timeline.find((item) => item.year === activeYear) ??
    property.timeline[0];

  return (
    <section className="pd-section pd-sat" aria-labelledby="pd-sat-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Location story</p>
        <h2 id="pd-sat-title">How this place has changed</h2>
        <p className="pd-section__lead">
          Timeline copy is property-specific.
        </p>

        <div className="pd-sat__layout">
          <div className="pd-sat__story">
            <div className="pd-sat__years" role="tablist" aria-label="Timeline years">
              {property.timeline.map((item) => {
                const selected = item.year === active?.year;
                return (
                  <button
                    key={item.year}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={selected ? "is-active" : ""}
                    onClick={() => setActiveYear(item.year)}
                  >
                    {item.year}
                  </button>
                );
              })}
            </div>
            {active ? (
              <div aria-live="polite">
                <h3>{active.title}</h3>
                <p>{active.story}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}