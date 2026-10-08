"use client";

import { useMemo, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import WhatsAppBudgetModal from "@/components/WhatsAppBudgetModal";
import {
  calcEmi,
  formatInr,
  futureValue,
} from "@/lib/propertyUtils";
import { trackEvent } from "@/services/analytics/tracker";

/**
 * Affordability and value-growth section.
 *
 * Two columns on desktop: the calculator on the left, a dark projection panel
 * on the right that narrates what the purchase could be worth. The numbers are
 * derived from the same helpers as the calculator so the two columns can never
 * disagree.
 */

const ANNUAL_APPRECIATION = 0.11;

export default function PriceEmiFuture({
  property,
}: {
  property: PropertyRecord;
}) {
  const [downPct, setDownPct] = useState(20);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const hasPrice = Number.isFinite(property.price) && property.price > 0;

  const story = useMemo(() => {
    const downPayment = property.price * (downPct / 100);
    const loanAmount = property.price - downPayment;
    const emi = calcEmi(loanAmount);

    return {
      downPayment,
      loanAmount,
      emi,
      // Two years from the current year, and four.
      valueNear: futureValue(property.price, 2, ANNUAL_APPRECIATION),
      valueLater: futureValue(property.price, 4, ANNUAL_APPRECIATION),
    };
  }, [property.price, downPct]);

  const nowYear = new Date().getFullYear();
  const nearYear = nowYear + 2;
  const laterYear = nowYear + 4;

  const onSlider = (value: number) => {
    setDownPct(value);

    trackEvent({
      event_type: "EMI_CALCULATOR_USE",
      metadata: {
        down_payment_pct: value,
        section_type: "emi_calculator",
        surface: "property_detail",
      },
    });
  };

  return (
    <section className="pd-section pd-emi" aria-labelledby="pd-emi-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Affordability</p>
        <h2 id="pd-emi-title">Plan the purchase for {property.name}</h2>
        <p className="pd-section__lead">
          Indicative EMI at 8.5% for 20 years. Appreciation figures are
          illustrative — not a loan quote or investment guarantee.
        </p>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          {/* Left: the calculator */}
          <div className="pd-emi__card">
            <div className="pd-emi__top">
              <div>
                <p className="pd-emi__label">{property.location}</p>
                <p className="pd-emi__price">
                  {hasPrice ? formatInr(property.price) : "Price on request"}
                </p>
              </div>
              <button
                type="button"
                className="pd-btn pd-btn--primary"
                onClick={() => setBudgetOpen(true)}
              >
                WhatsApp my budget
              </button>
            </div>

            <label className="pd-emi__slider">
              <span>
                Down payment <strong>{downPct}%</strong>
              </span>
              <input
                type="range"
                min={10}
                max={40}
                step={1}
                value={downPct}
                onChange={(event) => onSlider(Number(event.target.value))}
              />
            </label>

            <dl className="pd-emi__stats">
              <div>
                <dt>Down payment</dt>
                <dd>{hasPrice ? formatInr(story.downPayment) : "—"}</dd>
              </div>
              <div>
                <dt>Loan amount</dt>
                <dd>{hasPrice ? formatInr(story.loanAmount) : "—"}</dd>
              </div>
              <div>
                <dt>Monthly EMI</dt>
                <dd>{hasPrice ? formatInr(Math.round(story.emi)) : "—"}</dd>
              </div>
            </dl>

            <p className="pd-emi__note">
              Demo assumptions only. Bank eligibility, fees, and actual rates
              vary.
            </p>
          </div>

          {/* Right: value-growth narrative on a dark panel */}
          <div className="flex flex-col rounded-2xl bg-[#0f1114] p-6 text-white sm:p-7 lg:p-8">
            <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
              How this plot grows in value
            </h3>

            {hasPrice ? (
              <>
                <p className="mt-3 text-[15px] leading-relaxed text-white/75">
                  If you buy {property.name} at {formatInr(property.price)} with{" "}
                  {downPct}% down, your EMI is{" "}
                  <span className="font-semibold text-[#c9a84c]">
                    {formatInr(Math.round(story.emi))}/month
                  </span>
                  . At this corridor&apos;s average appreciation of{" "}
                  {ANNUAL_APPRECIATION * 100}% a year, this plot could be worth{" "}
                  <span className="font-semibold text-[#c9a84c]">
                    {formatInr(Math.round(story.valueNear))}
                  </span>{" "}
                  in {nearYear}.
                </p>

                <dl className="mt-6 space-y-3 border-t border-white/12 pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[13px] text-white/60">
                      What you pay today — {nowYear}
                    </dt>
                    <dd className="text-[15px] font-semibold text-white">
                      {formatInr(property.price)}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[13px] text-white/60">
                      Estimated value in {nearYear}
                    </dt>
                    <dd className="text-[15px] font-semibold text-[#c9a84c]">
                      ~{formatInr(Math.round(story.valueNear))}
                    </dd>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[13px] text-white/60">
                      Projected value in {laterYear}
                    </dt>
                    <dd className="text-[15px] font-semibold text-[#c9a84c]">
                      ~{formatInr(Math.round(story.valueLater))}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-[15px] leading-relaxed text-white/75">
                Pricing for {property.name} is shared on request. Talk to the ILA
                team for current rates, payment plans, and an indicative
                projection for this plot.
              </p>
            )}

            <p className="mt-auto pt-6 text-xs leading-relaxed text-white/45">
              Estimated from corridor growth data. Indicative only, not a
              guaranteed return.
            </p>
          </div>
        </div>
      </div>

      <WhatsAppBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        propertyLabel={`${property.name} · ${
          hasPrice ? formatInr(property.price) : "Price on request"
        } · ${downPct}% down`}
      />
    </section>
  );
}