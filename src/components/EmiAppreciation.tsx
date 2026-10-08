"use client";

import Image, { type StaticImageData } from "next/image";
import {
  useLayoutEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent,
} from "react";
import WhatsAppBudgetModal from "@/components/WhatsAppBudgetModal";
import { trackEvent } from "@/services/analytics/tracker";
import plotImageA12 from "@/app/assets/extra-image-3.png";
import plotImageB7 from "@/app/assets/extra-image-5.png";
import plotImageC3 from "@/app/assets/extra-image-8.png";
import plotImageKokapet from "@/app/assets/extra-image-6.png";
import plotImageMansanpally from "@/app/assets/IMAGE-6-ORG.png";
import plotImageSarkGreen from "@/app/assets/about-panel/hero-property.jpg";
import "./EmiAppreciation.css";

const ANNUAL_RATE = 0.085;
const TENURE_YEARS = 20;
const APPRECIATION_3YR = 0.38;
const ACTIVE_PLOT_ID = "sark-green-plains";
const MOBILE_QUERY = "(max-width: 980px)";

type PlotId =
  | "sark-green-plains"
  | "a12"
  | "b7"
  | "c3"
  | "kokapet"
  | "mansanpally";

type Plot = {
  id: PlotId;
  name: string;
  location: string;
  size: string;
  price: number;
  priceLabel: string;
  image: StaticImageData;
  available: boolean;
};

const PLOTS: Plot[] = [
  {
    id: "sark-green-plains",
    name: "Sark Green Plains",
    location: "Tukkuguda",
    size: "435 sq.yd",
    price: 20880000,
    priceLabel: "₹2.09 Cr",
    image: plotImageSarkGreen,
    available: true,
  },
  {
    id: "a12",
    name: "Plot A12",
    location: "Narsingi",
    size: "267 sq.yd",
    price: 5200000,
    priceLabel: "₹52 Lakhs",
    image: plotImageA12,
    available: false,
  },
  {
    id: "b7",
    name: "Plot B7",
    location: "Mokila",
    size: "200 sq.yd",
    price: 3800000,
    priceLabel: "₹38 Lakhs",
    image: plotImageB7,
    available: false,
  },
  {
    id: "c3",
    name: "Plot C3",
    location: "Tukkuguda",
    size: "300 sq.yd",
    price: 4400000,
    priceLabel: "₹44 Lakhs",
    image: plotImageC3,
    available: false,
  },
  {
    id: "kokapet",
    name: "Kokapet Heights",
    location: "Financial District Belt",
    size: "240 sq.yd",
    price: 6800000,
    priceLabel: "₹68 Lakhs",
    image: plotImageKokapet,
    available: false,
  },
  {
    id: "mansanpally",
    name: "Mansanpally Meadows",
    location: "Shamshabad Belt",
    size: "220 sq.yd",
    price: 2900000,
    priceLabel: "₹29 Lakhs",
    image: plotImageMansanpally,
    available: false,
  },
];

const INSIGHTS = [
  {
    title: "Your EMI pays the bank. The land pays you back.",
    copy: "Every month you pay, your plot grows in value. Buyers in our corridors have seen appreciation cover their EMI cost within 4–5 years.",
  },
  {
    title: "Loans made easy",
    copy: "We coordinate with SBI, HDFC and Axis Bank — pre-approval in 24 hours, paperwork handled by us.",
  },
  {
    title: "See it for yourself",
    copy: "Select any plot and adjust your down payment to see your monthly cost and projected returns update live.",
  },
] as const;

function formatLakhs(amount: number) {
  const lakhs = amount / 100000;
  if (lakhs >= 100) {
    return `₹${(lakhs / 100).toFixed(2)} Cr`;
  }
  return `₹${lakhs.toFixed(lakhs >= 10 ? 0 : 1)}L`;
}

function formatRupee(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function calcEmi(principal: number, annualRate: number, years: number) {
  if (principal <= 0) return 0;
  const monthlyRate = annualRate / 12;
  const n = years * 12;
  const factor = (1 + monthlyRate) ** n;
  return (principal * monthlyRate * factor) / (factor - 1);
}

function buildStory(plot: Plot, downPct: number) {
  const downPayment = plot.price * (downPct / 100);
  const loanAmount = plot.price - downPayment;
  const emi = calcEmi(loanAmount, ANNUAL_RATE, TENURE_YEARS);
  const value2028 = plot.price * (1 + APPRECIATION_3YR);
  const value2030 = plot.price * (1 + APPRECIATION_3YR * 1.45);

  return {
    downPayment,
    loanAmount,
    emi,
    value2028,
    value2030,
  };
}

export default function EmiAppreciation() {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedId, setSelectedId] = useState<PlotId | null>(null);
  const [downPct, setDownPct] = useState(20);
  const [hint, setHint] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hasUserPicked, setHasUserPicked] = useState(false);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      const mobile = mediaQuery.matches;
      setIsMobile(mobile);
      if (!hasUserPicked) {
        setSelectedId(mobile ? null : ACTIVE_PLOT_ID);
        if (!mobile) setPickerOpen(false);
      }
    };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [hasUserPicked]);

  const plot = useMemo(
    () =>
      PLOTS.find((item) => item.id === selectedId && item.available !== false) ??
      null,
    [selectedId],
  );

  const isLocked = !plot;
  const showUpdatingNotice = Boolean(plot);

  const story = useMemo(() => {
    if (!plot) return null;
    return buildStory(plot, downPct);
  }, [plot, downPct]);

  function showSelectHint() {
    setHint(true);
    window.setTimeout(() => setHint(false), 2200);
  }

  function selectPlot(id: PlotId) {
    setSelectedId(id);
    setHasUserPicked(true);
    setHint(false);
    setPickerOpen(false);
    setPaymentOpen(false);
    setStoryOpen(false);

    trackEvent({
      event_type: "EMI_PROPERTY_SELECT",
      metadata: { plot_id: id, section_type: "emi_calculator" },
    });
  }

  function handleSliderChange(event: ChangeEvent<HTMLInputElement>) {
    if (isLocked) {
      showSelectHint();
      return;
    }
    setDownPct(Number(event.target.value));

    trackEvent({
      event_type: "EMI_CALCULATOR_USE",
      metadata: {
        down_payment_pct: Number(event.target.value),
        plot_id: selectedId,
        section_type: "emi_calculator",
      },
    });
  }

  function handleSliderAttempt(event: PointerEvent<HTMLLabelElement>) {
    if (!isLocked) return;
    event.preventDefault();
    showSelectHint();
  }

  function openPicker() {
    setPickerOpen(true);
    setHint(false);
  }

  function togglePicker() {
    setPickerOpen((open) => !open);
    setHint(false);
  }

  return (
    <section data-section="emi_calculator"
      className="emi-appreciation"
      id="emi-appreciation"
      aria-label="EMI and appreciation story"
    >
      {/* Desktop layout — unchanged presentation */}
      <div className="emi-appreciation__desktop">
        <div className="emi-appreciation__frame">
          <header className="emi-appreciation__intro">
            <h2 className="emi-appreciation__heading">
              Plan your purchase — see size, cost and returns together
            </h2>
            <p className="emi-appreciation__lede">
              Pick a plot to see your payment breakdown, plot dimensions and
              estimated appreciation — all in one place.
            </p>
          </header>

          <div className="emi-appreciation__grid">
            <div
              className={`emi-appreciation__card${isLocked ? " is-locked" : ""}`}
            >
              <div
                className="emi-appreciation__picker"
                role="group"
                aria-label="Select a property"
              >
                <p className="emi-appreciation__picker-label">
                  Select a property
                </p>
                <div className="emi-appreciation__chips">
                  {PLOTS.map((item) => {
                    const isOn =
                      item.id === selectedId && item.available !== false;
                    const isAvailable = item.available !== false;
                    return (
                      <button
                        key={`desktop-${item.id}`}
                        type="button"
                        className={`emi-appreciation__chip${isOn ? " is-on" : ""}${isAvailable ? "" : " is-soon"}`}
                        aria-pressed={isOn}
                        aria-disabled={!isAvailable}
                        disabled={!isAvailable}
                        onClick={() => {
                          if (!isAvailable) return;
                          selectPlot(item.id);
                        }}
                      >
                        <span className="emi-appreciation__chip-media">
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="12vw"
                          />
                        </span>
                        <span className="emi-appreciation__chip-copy">
                          <span className="emi-appreciation__chip-name">
                            {isAvailable ? item.name : "Coming soon"}
                          </span>
                          <small className="emi-appreciation__chip-size">
                            {isAvailable ? item.size : "Adding soon"}
                          </small>
                          <small className="emi-appreciation__chip-price">
                            {isAvailable ? item.priceLabel : "—"}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {showUpdatingNotice && plot ? (
                <p className="emi-appreciation__updating" role="status">
                  <strong>Updating this calculator.</strong> Figures shown for{" "}
                  {plot.name} are provisional demo estimates — not accurate or
                  final pricing.
                </p>
              ) : null}

              {hint && !isMobile ? (
                <p className="emi-appreciation__hint" role="status">
                  Select a property first to adjust the calculation
                </p>
              ) : null}

              <p
                className={`emi-appreciation__plot${isLocked ? " is-blank" : ""}`}
              >
                {isLocked || !plot
                  ? "Select a property"
                  : `${plot.name} · ${plot.size} · ${plot.location} · ${plot.priceLabel}`}
              </p>

              <label
                className={`emi-appreciation__slider${isLocked ? " is-disabled" : ""}`}
                onPointerDown={handleSliderAttempt}
              >
                <span className="emi-appreciation__slider-label">
                  Down payment
                  <strong>{isLocked ? "—" : `${downPct}%`}</strong>
                </span>
                <input
                  type="range"
                  min="10"
                  max="40"
                  step="5"
                  value={downPct}
                  disabled={isLocked}
                  aria-disabled={isLocked}
                  onChange={handleSliderChange}
                  onClick={() => {
                    if (isLocked) showSelectHint();
                  }}
                />
              </label>

              <div className="emi-appreciation__rows">
                <div className="emi-appreciation__row">
                  <span>Down payment {isLocked ? "" : `(${downPct}%)`}</span>
                  <strong className={isLocked ? "is-blank" : ""}>
                    {isLocked || !story ? "—" : formatRupee(story.downPayment)}
                  </strong>
                </div>
                <div className="emi-appreciation__row">
                  <span>
                    Loan amount {isLocked ? "" : `(${100 - downPct}%)`}
                  </span>
                  <strong className={isLocked ? "is-blank" : ""}>
                    {isLocked || !story ? "—" : formatRupee(story.loanAmount)}
                  </strong>
                </div>
                <div className="emi-appreciation__row emi-appreciation__row--emi">
                  <span>
                    Monthly EMI · {TENURE_YEARS}yr ·{" "}
                    {(ANNUAL_RATE * 100).toFixed(1)}%
                  </span>
                  <strong className={isLocked ? "is-blank" : ""}>
                    {isLocked || !story
                      ? "—"
                      : `${formatRupee(story.emi)} / month`}
                  </strong>
                </div>
              </div>

              <div
                className={`emi-appreciation__story${storyOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="emi-appreciation__story-toggle"
                  aria-expanded={storyOpen}
                  aria-controls="emi-appreciation-story-body"
                  onClick={() => setStoryOpen((open) => !open)}
                >
                  <span>How this plot grows in value</span>
                  <span
                    className="emi-appreciation__story-chevron"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>

                <div
                  id="emi-appreciation-story-body"
                  className="emi-appreciation__story-body"
                  role="region"
                  aria-label="How this plot grows in value"
                >
                  <div className="emi-appreciation__story-body-inner">
                    <p
                      className={`emi-appreciation__story-lead${isLocked ? " is-blank" : ""}`}
                    >
                      {isLocked || !plot || !story ? (
                        "—"
                      ) : (
                        <>
                          If you buy {plot.name} at {plot.priceLabel} with{" "}
                          {downPct}% down, your EMI is{" "}
                          <strong>{formatRupee(story.emi)}/month</strong>. At
                          the ORR corridor&apos;s 3-year avg. appreciation of
                          38%, this plot could be worth{" "}
                          <strong>
                            {formatLakhs(story.value2028)} in 2028
                          </strong>
                          .
                        </>
                      )}
                    </p>

                    <div className="emi-appreciation__timeline">
                      <div className="emi-appreciation__point">
                        <span>What you pay today — 2026</span>
                        <strong className={isLocked ? "is-blank" : ""}>
                          {isLocked || !plot ? "—" : plot.priceLabel}
                        </strong>
                      </div>
                      <div className="emi-appreciation__point">
                        <span>Estimated value in 2028</span>
                        <strong className={isLocked ? "is-blank" : ""}>
                          {isLocked || !story
                            ? "—"
                            : `~${formatLakhs(story.value2028)}`}
                        </strong>
                      </div>
                      <div className="emi-appreciation__point emi-appreciation__point--peak">
                        <span>
                          Projected value in 2030 — when ORR Phase 3 completes
                        </span>
                        <strong className={isLocked ? "is-blank" : ""}>
                          {isLocked || !story
                            ? "—"
                            : `~${formatLakhs(story.value2030)}`}
                        </strong>
                      </div>
                    </div>

                    <p className="emi-appreciation__disclaimer">
                      We are still updating this section. These numbers are
                      illustrative only and are not accurate market data or a
                      guaranteed return.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="emi-appreciation__insights">
              {INSIGHTS.map((item) => (
                <div key={item.title} className="emi-appreciation__insight">
                  <span
                    className="emi-appreciation__insight-mark"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="emi-appreciation__insight-title">
                      {item.title}
                    </h3>
                    <p className="emi-appreciation__insight-copy">
                      {item.copy}
                    </p>
                  </div>
                </div>
              ))}

              {plot ? (
                <button
                  type="button"
                  className="emi-appreciation__cta"
                  onClick={() => setBudgetOpen(true)}
                >
                  Calculate for my budget
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="emi-appreciation__cta"
                  onClick={showSelectHint}
                >
                  Select a property to continue
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout — progressive calculator */}
      <div className="ea-m">
        <div className="ea-m__atmosphere" aria-hidden="true">
          <div className="ea-m__atmosphere-image">
            <Image
              src={plotImageSarkGreen}
              alt=""
              fill
              sizes="100vw"
              priority={false}
            />
          </div>
          <div className="ea-m__atmosphere-veil" />
        </div>

        <div className="ea-m__frame">
          <header className="ea-m__intro">
            <p className="ea-m__eyebrow">EMI Calculator</p>
            <h2 className="ea-m__heading">
              Plan your monthly payment for your plot.
            </h2>
            <p className="ea-m__lede">
              Select a property to calculate your estimated EMI.
            </p>
          </header>

          <div className="ea-m__property">
            <p className="ea-m__label">Select a property</p>

            {plot ? (
              <button
                type="button"
                className="ea-m__gate ea-m__gate--selected"
                onClick={togglePicker}
                aria-expanded={pickerOpen}
              >
                <span className="ea-m__gate-media">
                  <Image
                    src={plot.image}
                    alt=""
                    fill
                    sizes="72px"
                  />
                </span>
                <span className="ea-m__gate-copy">
                  <span className="ea-m__gate-title">{plot.name}</span>
                  <span className="ea-m__gate-meta">
                    {plot.size} · {plot.location}
                  </span>
                  <span className="ea-m__gate-price">{plot.priceLabel}</span>
                </span>
                <span
                  className={`ea-m__gate-arrow${pickerOpen ? " is-open" : ""}`}
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="ea-m__gate ea-m__gate--empty"
                onClick={togglePicker}
                aria-expanded={pickerOpen}
              >
                <span className="ea-m__gate-icon" aria-hidden="true">
                  +
                </span>
                <span className="ea-m__gate-copy">
                  <span className="ea-m__gate-title">Choose a property</span>
                  <span className="ea-m__gate-meta">
                    Tap to select from available plots
                  </span>
                  <span className="ea-m__gate-action">Tap to select</span>
                </span>
                <span
                  className={`ea-m__gate-arrow${pickerOpen ? " is-open" : ""}`}
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            )}

            <div
              className={`ea-m__sheet-wrap${pickerOpen ? " is-open" : ""}`}
              aria-hidden={!pickerOpen}
            >
              <div className="ea-m__sheet-anim">
                <div
                  className="ea-m__sheet"
                  role="group"
                  aria-label="Available plots"
                >
                  {PLOTS.map((item) => {
                    const isOn =
                      item.id === selectedId && item.available !== false;
                    const isAvailable = item.available !== false;
                    return (
                      <button
                        key={`mobile-${item.id}`}
                        type="button"
                        className={`ea-m__option${isOn ? " is-on" : ""}${isAvailable ? "" : " is-soon"}`}
                        aria-pressed={isOn}
                        aria-disabled={!isAvailable}
                        disabled={!isAvailable}
                        tabIndex={pickerOpen ? 0 : -1}
                        onClick={() => {
                          if (!isAvailable) return;
                          selectPlot(item.id);
                        }}
                      >
                        <span className="ea-m__option-media">
                          <Image
                            src={item.image}
                            alt=""
                            fill
                            sizes="64px"
                          />
                        </span>
                        <span className="ea-m__option-copy">
                          <span className="ea-m__option-name">
                            {isAvailable ? item.name : "Coming soon"}
                          </span>
                          <span className="ea-m__option-meta">
                            {isAvailable
                              ? `${item.size} · ${item.location}`
                              : "Adding soon"}
                          </span>
                        </span>
                        <span className="ea-m__option-price">
                          {isAvailable ? item.priceLabel : "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {hint ? (
            <p className="ea-m__hint" role="status">
              Select a property first to adjust the calculation
            </p>
          ) : null}

          <div className={`ea-m__panel${isLocked ? " is-locked" : ""}`}>
            <label
              className={`ea-m__slider${isLocked ? " is-disabled" : ""}`}
              onPointerDown={handleSliderAttempt}
            >
              <span className="ea-m__slider-label">
                Down payment
                <strong>{`${downPct}%`}</strong>
              </span>
              <span className="ea-m__slider-track">
                <span
                  className="ea-m__slider-fill"
                  style={
                    {
                      "--ea-down-pct": `${((downPct - 10) / 30) * 100}%`,
                    } as CSSProperties
                  }
                  aria-hidden="true"
                />
                <input
                  type="range"
                  min="10"
                  max="40"
                  step="5"
                  value={downPct}
                  disabled={isLocked}
                  aria-disabled={isLocked}
                  onChange={handleSliderChange}
                  onClick={() => {
                    if (isLocked) showSelectHint();
                  }}
                />
              </span>
            </label>

            <div className="ea-m__emi">
              <p className="ea-m__emi-label">Your estimated EMI</p>
              <p className="ea-m__emi-value">
                {isLocked || !story
                  ? "₹ ——— / month"
                  : `${formatRupee(story.emi)} / month`}
              </p>
              {isLocked ? (
                <p className="ea-m__emi-hint">Select a property to view EMI</p>
              ) : (
                <p className="ea-m__emi-hint">
                  {TENURE_YEARS}yr · {(ANNUAL_RATE * 100).toFixed(1)}% ·
                  illustrative estimate
                </p>
              )}
            </div>

            <div
              className={`ea-m__fold${paymentOpen && !isLocked ? " is-open" : ""}${isLocked ? " is-locked" : ""}`}
            >
              <button
                type="button"
                className="ea-m__fold-toggle"
                aria-expanded={paymentOpen && !isLocked}
                aria-controls="ea-m-payment-body"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    showSelectHint();
                    return;
                  }
                  setPaymentOpen((open) => !open);
                }}
              >
                <span>Payment breakdown</span>
                <span className="ea-m__fold-chevron" aria-hidden="true">
                  ⌄
                </span>
              </button>
              <div
                id="ea-m-payment-body"
                className="ea-m__fold-body"
                role="region"
                aria-label="Payment breakdown"
              >
                <div className="ea-m__fold-inner">
                  {!isLocked && story ? (
                    <>
                      <div className="ea-m__row">
                        <span>Down payment ({downPct}%)</span>
                        <strong>{formatRupee(story.downPayment)}</strong>
                      </div>
                      <div className="ea-m__row">
                        <span>Loan amount ({100 - downPct}%)</span>
                        <strong>{formatRupee(story.loanAmount)}</strong>
                      </div>
                      <div className="ea-m__row ea-m__row--emi">
                        <span>
                          Monthly EMI · {TENURE_YEARS}yr ·{" "}
                          {(ANNUAL_RATE * 100).toFixed(1)}%
                        </span>
                        <strong>{formatRupee(story.emi)}</strong>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              className={`ea-m__fold ea-m__fold--growth${storyOpen && !isLocked ? " is-open" : ""}${isLocked ? " is-locked" : ""}`}
            >
              <button
                type="button"
                className="ea-m__fold-toggle"
                aria-expanded={storyOpen && !isLocked}
                aria-controls="ea-m-growth-body"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    showSelectHint();
                    return;
                  }
                  setStoryOpen((open) => !open);
                }}
              >
                <span>How this plot grows in value</span>
                <span className="ea-m__fold-chevron" aria-hidden="true">
                  ⌄
                </span>
              </button>
              <div
                id="ea-m-growth-body"
                className="ea-m__fold-body"
                role="region"
                aria-label="How this plot grows in value"
              >
                <div className="ea-m__fold-inner">
                  {!isLocked && plot && story ? (
                    <>
                      <p className="ea-m__growth-lead">
                        If you buy {plot.name} at {plot.priceLabel} with{" "}
                        {downPct}% down, your EMI is{" "}
                        <strong>{formatRupee(story.emi)}/month</strong>. At the
                        ORR corridor&apos;s 3-year avg. appreciation of 38%,
                        this plot could be worth{" "}
                        <strong>
                          {formatLakhs(story.value2028)} in 2028
                        </strong>
                        .
                      </p>
                      <div className="ea-m__timeline">
                        <div className="ea-m__point">
                          <span>What you pay today — 2026</span>
                          <strong>{plot.priceLabel}</strong>
                        </div>
                        <div className="ea-m__point">
                          <span>Estimated value in 2028</span>
                          <strong>~{formatLakhs(story.value2028)}</strong>
                        </div>
                        <div className="ea-m__point ea-m__point--peak">
                          <span>
                            Projected value in 2030 — when ORR Phase 3
                            completes
                          </span>
                          <strong>~{formatLakhs(story.value2030)}</strong>
                        </div>
                      </div>
                      <p className="ea-m__disclaimer">
                        Illustrative only — not accurate market data or a
                        guaranteed return.
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {plot ? (
            <button
              type="button"
              className="ea-m__cta"
              onClick={() => setBudgetOpen(true)}
            >
              Calculate for my budget
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button
              type="button"
              className="ea-m__cta ea-m__cta--muted"
              onClick={() => {
                showSelectHint();
                openPicker();
              }}
            >
              Select a property to continue
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>

      <WhatsAppBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        propertyLabel={plot ? `${plot.name} (${plot.size})` : ""}
      />
    </section>
  );
}
