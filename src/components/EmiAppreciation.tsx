"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import familyCommunityImg from "@/app/assets/Family Dreams Over a New Community.png";
import familyHomecomingImg from "@/app/assets/Golden-Hour Family Homecoming.png";
import realEstateGrowthImg from "@/app/assets/Golden Hour Real Estate Growth.png";
import plannedCityscapeImg from "@/app/assets/Golden-Hour View of Planned Cityscape.png";
import PriceEmiFuture from "@/components/PropertyDetail/PriceEmiFuture";
import {
  fetchProperties,
  formatPrice,
  type PropertyListItem,
} from "@/services/propertiesService";
import { trackEvent } from "@/services/analytics/tracker";
import "./EmiAppreciation.css";

/**
 * How many properties the picker offers.
 *
 * The endpoint is paginated, so this is a page rather than a total. There is no
 * "load more": a calculator picker is a shortlist, not a catalogue, and an
 * unbounded list would push the calculator itself below the fold.
 */
const PICKER_LIMIT = 12;

/**
 * Below this width the calculator is presented in a bottom-sheet popup instead
 * of rendering inline under the picker. It matches the map's mobile split.
 */
const MOBILE_QUERY = "(max-width: 767px)";

/** Matches the sheet's exit transition in EmiAppreciation.css. */
const POPUP_EXIT_MS = 200;

const PROPERTY_IMAGES: StaticImageData[] = [
  familyCommunityImg,
  familyHomecomingImg,
  realEstateGrowthImg,
  plannedCityscapeImg,
];

type PickerStatus = "loading" | "ready" | "error";

export default function EmiAppreciation() {
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [status, setStatus] = useState<PickerStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Drives whether the calculator renders inline or in the popup. */
  const [isMobile, setIsMobile] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  /** True while the sheet plays its exit transition, before it unmounts. */
  const [popupClosing, setPopupClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const popupTitleId = useId();

  /**
   * The sheet is kept mounted for the length of its exit transition rather than
   * being removed instantly, so dismissing it animates out instead of blinking
   * away. Unmounting happens on the timer.
   */
  const closePopup = useCallback(() => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    setPopupClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setPopupOpen(false);
      setPopupClosing(false);
      closeTimerRef.current = null;
    }, POPUP_EXIT_MS);
  }, []);

  const openPopup = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPopupClosing(false);
    setPopupOpen(true);
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchProperties({
      status: "ACTIVE",
      perPage: PICKER_LIMIT,
      signal: controller.signal,
    })
      .then((result) => {
        setItems(result.items);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Could not load properties.",
        );
      });

    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  /**
   * A modal sheet has to own the page while it is open: the body cannot scroll
   * behind it, and Escape must dismiss it. Matches `WhatsAppBudgetModal`.
   */
  useEffect(() => {
    if (!popupOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopup();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [popupOpen, closePopup]);

  // Leaving the mobile range while the sheet is open would strand it.
  useEffect(() => {
    if (!isMobile) closePopup();
  }, [isMobile, closePopup]);

  /**
   * Clears the current pick and dismisses the sheet, returning the section to
   * its locked state. No analytics event is emitted: the confirmed vocabulary
   * has `EMI_PROPERTY_SELECT` but no counterpart for a deselect, and inventing
   * one would need backend agreement first.
   */
  function clearSelection() {
    setSelectedId(null);
    closePopup();
  }

  function select(id: string) {
    // Tapping the property that is already picked clears it, so a second tap
    // on the same card is a deselect rather than a no-op. This is the only way
    // to deselect on desktop, where there is no popup and no clear button.
    if (selectedId === id) {
      clearSelection();
      return;
    }

    setSelectedId(id);

    // On mobile the numbers live in the sheet, so selecting opens it. On
    // desktop the calculator is already visible below the picker.
    if (isMobile) openPopup();

    trackEvent({
      event_type: "EMI_PROPERTY_SELECT",
      metadata: { property_id: id, section_type: "emi_calculator" },
    });
  }

  return (
    <section
      data-section="emi_calculator"
      id="emi-appreciation"
      className="emi-appreciation"
      aria-label="EMI calculator"
    >
      <div className="emi-appreciation__frame">
        <header className="emi-appreciation__intro">
          <h2 className="emi-appreciation__heading">
            Plan your purchase — see size, cost and returns together
          </h2>
          <p className="emi-appreciation__lede">
            Pick a property to model the loan, then adjust the down payment,
            interest rate and tenure. Every figure updates as you type.
          </p>
        </header>

        <div className="emi-appreciation__picker">
          <p className="emi-appreciation__picker-label" id="emi-picker-label">
            Select a property
          </p>

          {status === "loading" ? (
            <p className="emi-appreciation__note" role="status">
              Loading properties…
            </p>
          ) : null}

          {status === "error" ? (
            <p className="emi-appreciation__note is-error" role="alert">
              {error ?? "Could not load properties."}
            </p>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <p className="emi-appreciation__note">
              No properties are available right now. Please check back soon.
            </p>
          ) : null}

          {items.length > 0 ? (
            <div
              className="emi-appreciation__grid"
              role="group"
              aria-labelledby="emi-picker-label"
            >
              {items.map((item, index) => {
                const isOn = item.id === selectedId;
                const fallbackImage = PROPERTY_IMAGES[index % PROPERTY_IMAGES.length];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`emi-appreciation__option${isOn ? " is-on" : ""}`}
                    aria-pressed={isOn}
                    onClick={() => select(item.id)}
                  >
                    <span className="emi-appreciation__option-media">
                      <Image
                        src={item.cover_url || fallbackImage}
                        alt=""
                        fill
                        sizes="(max-width: 760px) 50vw, 220px"
                        unoptimized
                        onError={(event) => {
                          event.currentTarget.src = fallbackImage.src;
                        }}
                      />
                      <span className="emi-appreciation__option-check" aria-hidden="true">
                        {isOn ? "✓" : ""}
                      </span>
                    </span>
                    <span className="emi-appreciation__option-body">
                      <span className="emi-appreciation__option-copy">
                        <span className="emi-appreciation__option-name">
                          {item.name}
                        </span>
                        <span className="emi-appreciation__option-location">
                          {item.slug || "Property details available"}
                        </span>
                      </span>
                      <span className="emi-appreciation__option-meta">
                        {[item.property_type, formatPrice(item.price)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/*
          Until a property is chosen the calculator is replaced by a locked
          placeholder rather than rendered disabled.

          `PriceEmiFuture` has no notion of being locked: it takes a property
          and is fully live. Handing it a fabricated price just to grey it out
          would show a real-looking EMI for a property nobody picked, which is
          worse than showing nothing. The placeholder carries the same
          disabled affordance — dimmed, non-interactive, `aria-disabled` — and
          names what is missing.

          On mobile the placeholder stays inline, but once a property is chosen
          the calculator itself moves into the popup instead of rendering here.
        */}
        {!selected ? (
          <div
            className="emi-appreciation__locked"
            role="group"
            aria-disabled="true"
            aria-label="EMI calculator, awaiting a property"
          >
            <p className="emi-appreciation__locked-title">
              Select a property to run the numbers
            </p>
            <p className="emi-appreciation__locked-copy">
              The down payment, interest rate and tenure controls stay inactive
              until a property is chosen.
            </p>
          </div>
        ) : null}

        {/* Desktop: the calculator renders inline, exactly as before. */}
        {!isMobile && selected ? (
          <PriceEmiFuture
            property={{ name: selected.name, price: selected.price ?? 0 }}
            showAmortizationSchedule={false}
          />
        ) : null}

        {/* Mobile: a reopen affordance, so dismissing the sheet does not
            strand the visitor with a selected property and no visible output.
            Two siblings rather than nested buttons, since a button cannot
            legally contain another button. */}
        {isMobile && selected && !popupOpen ? (
          <div className="emi-appreciation__reopen">
            <span className="emi-appreciation__reopen-copy">
              <span className="emi-appreciation__reopen-name">
                {selected.name}
              </span>
              <span className="emi-appreciation__reopen-label">
                Property selected
              </span>
            </span>

            <span className="emi-appreciation__reopen-actions">
              <button
                type="button"
                className="emi-appreciation__reopen-open"
                onClick={openPopup}
              >
                View EMI &amp; returns
              </button>
              <button
                type="button"
                className="emi-appreciation__reopen-clear"
                onClick={clearSelection}
              >
                Clear
              </button>
            </span>
          </div>
        ) : null}

        {isMobile && selected && popupOpen ? (
          <div
            className={`emi-appreciation__popup${
              popupClosing ? " is-closing" : ""
            }`}
          >
            <button
              type="button"
              className="emi-appreciation__popup-scrim"
              aria-label="Close EMI details"
              onClick={closePopup}
            />

            <div
              className="emi-appreciation__popup-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={popupTitleId}
            >
              {/* Grip on its own line so the bar can hold close, title and the
                  clear action without the title losing its centring. */}
              <span className="emi-appreciation__popup-grip" aria-hidden="true" />

              <div className="emi-appreciation__popup-bar">
                <span className="emi-appreciation__popup-title" id={popupTitleId}>
                  {selected.name}
                </span>

                {/* The cross is a destructive action, not a dismiss: it clears
                    the selection so the section returns to its locked state
                    rather than leaving a pick with no visible output. */}
                <button
                  type="button"
                  className="emi-appreciation__popup-close"
                  aria-label={`Clear selection and close EMI details for ${selected.name}`}
                  onClick={clearSelection}
                >
                  &times;
                </button>
              </div>

              {/* Scrolls independently; the amortization schedule is long. */}
              <div className="emi-appreciation__popup-body">
                <PriceEmiFuture
                  property={{ name: selected.name, price: selected.price ?? 0 }}
                  showAmortizationSchedule={false}
                />

                {/* Trailing padding lives on a block inside the scroll area, so
                    it is only reached at the end rather than being consumed by
                    the scroll range, and still clears the safe-area inset. */}
                <div className="emi-appreciation__popup-foot" aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}