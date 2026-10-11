"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import PriceEmiFuture from "@/components/PropertyDetail/PriceEmiFuture";
import type { PropertyRecord } from "@/data/properties";

/**
 * The "Plan your purchase" shell from the homepage, on the property page.
 *
 * The stylesheet is imported rather than reimplemented on purpose: reusing
 * `.emi-appreciation*` is what guarantees the two surfaces share one frame,
 * heading and spacing model rather than two that drift apart — including the
 * popup, scrim, sheet and dialog furniture, which are reused verbatim.
 *
 * The homepage renders the shell as a dark band; this page is light, so
 * `PropertyDetail.css` undoes the dark surface and its text colours under
 * `.pd-afford` while the structure is reused untouched.
 *
 * See docs/features/emi-calculator.md §2 — one calculator, two surfaces.
 */
import "@/components/EmiAppreciation.css";

/** Matches the sheet's exit transition in EmiAppreciation.css. */
const POPUP_EXIT_MS = 200;

export default function AffordabilityFinancing({
  property,
}: {
  property: PropertyRecord;
}) {
  const [popupOpen, setPopupOpen] = useState(false);
  /** True while the sheet plays its exit transition, before it unmounts. */
  const [popupClosing, setPopupClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const popupTitleId = useId();

  /**
   * The sheet stays mounted for the length of its exit transition rather than
   * being removed instantly, so dismissing it animates out instead of blinking
   * away. Unmounting happens on the timer.
   */
  const openPopup = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPopupClosing(false);
    setPopupOpen(true);
  }, []);

  const closePopup = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setPopupClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setPopupOpen(false);
      setPopupClosing(false);
      closeTimerRef.current = null;
    }, POPUP_EXIT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  /**
   * A dialog owns the page while it is open: the body cannot scroll behind it,
   * Escape must dismiss it, and focus has to travel into the sheet and back out
   * to the button — otherwise the keyboard is left on a control the reader can
   * no longer see.
   */
  useEffect(() => {
    if (!popupOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      ctaRef.current?.focus();
    };
  }, [popupOpen, closePopup]);

  return (
    <>
      {/*
        Two surfaces from one component, split by CSS at 768px.

        Mobile gets the shell, the CTA and the dialog. Desktop is left exactly
        as it was before this section gained a shell: the bare calculator,
        inline, on the page's own light surface with its own `.pd-section`
        padding and its own heading. Both trees are in the document and CSS
        picks one, so neither surface has to read the viewport in JS before
        hydration and there is no flash of the wrong layout on the way in.

        The mobile tree comes first so `#pd-emi-title` resolves to the heading
        a phone reader can actually see.
      */}
      <section
        className="emi-appreciation pd-afford"
        id="pd-affordability"
        data-section="emi_calculator"
        aria-labelledby="pd-afford-title"
      >
        <div className="emi-appreciation__frame">
          <div className="emi-appreciation__intro">
            <h2 className="emi-appreciation__heading" id="pd-afford-title">
              Plan your purchase — see size, cost and returns together
            </h2>
            {/*
              The homepage lede opens with "Pick a property", because it has a
              picker. There is none here, so that clause is the only thing that
              changes; the rest of the sentence keeps the homepage rhythm.
            */}
            <p className="emi-appreciation__lede">
              Model the loan on this plot, then adjust the down payment, interest
              rate and tenure. Every figure updates as you type.
            </p>

            {/*
              The calculator stays closed until it is asked for. It is a long
              block of controls that would otherwise push everything after it
              below the fold, and there is nothing about it worth showing until
              someone wants to see the numbers.
            */}
            <button
              type="button"
              ref={ctaRef}
              className="pd-afford__cta"
              onClick={openPopup}
            >
              Calculate EMI for this property
            </button>
          </div>

          {/*
            There is no picker, so there is nothing to auto-select in the way
            the homepage means it. This page already has exactly one property,
            and `PriceEmiFuture` seeds its purchase price from `property.price`
            and labels itself with `property.name` on mount. Passing the
            property straight through is the auto-selection — no selection
            state, no fetch, no locked placeholder, and nothing to clear.

            Mounting this on open rather than keeping it in the tree also means
            the calculator's own state starts fresh on every visit.
          */}
          {popupOpen ? (
            <div
              className={`emi-appreciation__popup${
                popupClosing ? " is-closing" : ""
              }`}
            >
              <button
                type="button"
                className="emi-appreciation__popup-scrim"
                aria-label="Close EMI calculator"
                onClick={closePopup}
              />

              <div
                ref={sheetRef}
                tabIndex={-1}
                className="emi-appreciation__popup-sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={popupTitleId}
              >
                {/* Grip on its own line so the bar can hold close and title
                    without the title losing its centring. */}
                <span
                  className="emi-appreciation__popup-grip"
                  aria-hidden="true"
                />

                <div className="emi-appreciation__popup-bar">
                  <span
                    className="emi-appreciation__popup-title"
                    id={popupTitleId}
                  >
                    EMI for {property.name}
                  </span>

                  <button
                    type="button"
                    className="emi-appreciation__popup-close"
                    aria-label={`Close EMI calculator for ${property.name}`}
                    onClick={closePopup}
                  >
                    &times;
                  </button>
                </div>

                {/* Scrolls independently; the controls and the amortization
                    schedule are long. */}
                <div className="emi-appreciation__popup-body">
                  <PriceEmiFuture property={property} />

                  {/* Trailing padding lives on a block inside the scroll area,
                      so it is only reached at the end rather than being
                      consumed by the scroll range. */}
                  <div
                    className="emi-appreciation__popup-foot"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Desktop: the bare calculator, exactly where it was before the shell.
          The wrapper is inert on mobile — see the note above the section. */}
      <div className="pd-afford-desktop">
        <PriceEmiFuture property={property} />
      </div>
    </>
  );
}
