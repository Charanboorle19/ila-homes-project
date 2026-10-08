"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import { getPropertyLifestyle } from "@/data/properties";

const DWELL_MS = 4200;

/**
 * Above this many points the list stops being a handful of "moments" and starts
 * being a catalogue — an API property publishes every amenity it has, and the
 * layout switches to a compact grid. The auto-cycling goes with it: cycling a
 * list this long every few seconds fights the person trying to read it.
 */
const DENSE_ITEM_COUNT = 6;

export default function Lifestyle({ property }: { property: PropertyRecord }) {
  const items = getPropertyLifestyle(property);
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [paused, setPaused] = useState(false);

  // Navigating to another property remounts this via its `key`, so the active
  // moment and paused state reset without an effect.

  const dense = items.length > DENSE_ITEM_COUNT;
  const autoCycle = items.length > 1 && !dense;

  // A restarting timeout rather than a fixed interval: picking a point by hand
  // resets the dwell time, so manual selection still gets a full beat on
  // screen instead of being cut short by the next interval tick.
  useEffect(() => {
    if (!autoCycle || paused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveId((current) => {
        const index = items.findIndex((item) => item.id === current);
        return items[(index + 1) % items.length]?.id ?? current;
      });
    }, DWELL_MS);

    return () => window.clearTimeout(timer);
  }, [activeId, autoCycle, items, paused]);

  const activeIndex = items.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? items[activeIndex] : items[0];

  return (
    <section className="pd-section pd-lifestyle" aria-labelledby="pd-life-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Lifestyle</p>
        <h2 id="pd-life-title">How days could feel here</h2>
        <p className="pd-section__lead">
          {autoCycle
            ? "Pick a moment to see it. Captions also cycle on their own."
            : "Pick one to see it."}
        </p>

        <div className="pd-lifestyle__layout">
          <ul
            className={`pd-lifestyle__points${dense ? " pd-lifestyle__points--dense" : ""}`}
            role="list"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {items.map((item, index) => {
              const selected = item.id === active?.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`pd-lifestyle__point${selected ? " is-active" : ""}`}
                    aria-pressed={selected}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onClick={() => setActiveId(item.id)}
                  >
                    <span
                      className="pd-lifestyle__point-index"
                      aria-hidden="true"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="pd-lifestyle__point-body">
                      <span className="pd-lifestyle__point-title">
                        {item.caption}
                      </span>
                      {/* Amenities carry no caption line, so the row stays
                          one line tall and a long list stays scannable. */}
                      {item.alt ? (
                        <span className="pd-lifestyle__point-alt">{item.alt}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="pd-lifestyle__stage">
            {active ? (
              active.src ? (
                <>
                  <Image
                    key={active.id}
                    src={active.src}
                    alt={active.alt}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 56vw"
                    className="pd-lifestyle__img"
                  />
                  <p className="pd-lifestyle__caption">{active.caption}</p>
                </>
              ) : (
                /* No photograph for this point — an amenity list has no
                   imagery, and a broken image would be worse than none. */
                <div
                  key={active.id}
                  className="pd-lifestyle__panel"
                  role="group"
                  aria-label={active.caption}
                >
                  <span className="pd-lifestyle__panel-index" aria-hidden="true">
                    {String(activeIndex + 1).padStart(2, "0")}
                  </span>
                  <p className="pd-lifestyle__panel-title">{active.caption}</p>
                  <p className="pd-lifestyle__panel-meta">{property.name}</p>
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}