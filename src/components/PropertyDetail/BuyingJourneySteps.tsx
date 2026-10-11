"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    id: "enquire",
    number: "01",
    name: "Enquire",
    summary: "Tell us what you're looking for, and we'll share the right options.",
  },
  {
    id: "visit",
    number: "02",
    name: "Site Visit",
    summary: "Visit the property with our team and explore the layout and surroundings.",
  },
  {
    id: "legal",
    number: "03",
    name: "Legal Verification",
    summary: "Review approvals, title documents, and property details with complete clarity.",
  },
  {
    id: "book",
    number: "04",
    name: "Book & Pay",
    summary: "Select your plot and complete the booking with a clear payment schedule.",
  },
  {
    id: "registration",
    number: "05",
    name: "Registration",
    summary: "We coordinate the registration process and guide you through the final handover.",
  },
] as const;

/** Matches the vertical-timeline breakpoint in PropertyDetail.css. */
const TIMELINE_QUERY = "(max-width: 700px)";

export default function BuyingJourneySteps() {
  const [activeStep, setActiveStep] = useState(-1);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  /**
   * The gold fill is a mobile-timeline affordance. On desktop the five steps
   * sit side by side and are all in view at once, so there is no progress to
   * report — the classes set here have no effect above the breakpoint. Under
   * `prefers-reduced-motion` nothing is observed at all, which leaves the
   * static light-gold track.
   */
  useEffect(() => {
    const timeline = window.matchMedia(TIMELINE_QUERY);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let observer: IntersectionObserver | null = null;

    const stop = () => {
      observer?.disconnect();
      observer = null;
    };

    const start = () => {
      stop();
      setActiveStep(-1);
      if (!timeline.matches || reduced.matches) return;

      const inBand = new Set<number>();

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const index = stepRefs.current.indexOf(
              entry.target as HTMLLIElement,
            );
            if (index < 0) continue;
            if (entry.isIntersecting) inBand.add(index);
            else inBand.delete(index);
          }

          if (inBand.size === 0) {
            setActiveStep(-1);
            return;
          }
          setActiveStep(Math.max(...inBand));
        },
        /* A narrow band across the middle of the viewport, so only one step can
           own it and the highlight follows the one being read rather than the
           first one that happened to fire. */
        { rootMargin: "-40% 0px -55% 0px" },
      );

      stepRefs.current.forEach((node) => {
        if (node) observer?.observe(node);
      });
    };

    start();
    timeline.addEventListener("change", start);
    reduced.addEventListener("change", start);

    return () => {
      timeline.removeEventListener("change", start);
      reduced.removeEventListener("change", start);
      stop();
    };
  }, []);

  return (
    <section className="pd-section pd-journey" aria-labelledby="pd-journey-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Buying journey</p>
        <h2 id="pd-journey-title">A simple, transparent process.</h2>
        <p className="pd-section__lead">
          A clear path from your first conversation to the final handover.
        </p>

        {/*
          `role="list"` is load-bearing. The list is styled `list-style: none`,
          and Safari/VoiceOver drop list semantics on a markerless ol — so
          without it this announces as an unlabelled group instead of "list, 5
          items".
        */}
        <ol className="pd-journey__steps" role="list">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <li
                key={step.id}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                className={`pd-journey__step${
                  index <= activeStep ? " is-reached" : ""
                }${index === activeStep ? " is-current" : ""}`}
              >
                {/*
                  The last step closes the journey rather than counting on: a
                  filled circle and a tick read as "done", where a fifth "05"
                  would just be another number in a list. The marker is
                  decorative — the step name is in the heading below it.
                */}
                <span
                  className={`pd-journey__marker${
                    isLast ? " pd-journey__marker--final" : ""
                  }`}
                  aria-hidden="true"
                >
                  {isLast ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <h3>{step.name}</h3>
                <p>{step.summary}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
