"use client";

import React, { useState, useId, useMemo, useRef } from "react";
import type { PropertyRecord } from "@/data/properties";
import WhatsAppBudgetModal from "@/components/WhatsAppBudgetModal";
import { formatInr, futureValue } from "@/lib/propertyUtils";
import { trackEvent } from "@/services/analytics/tracker";

const ANNUAL_APPRECIATION = 0.11;

interface AmortizationYearRow {
  year: number;
  beginningBalance: number;
  totalEmi: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}

interface AmortizationMonthRow {
  paymentNumber: number;
  beginningBalance: number;
  emi: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}

export default function PriceEmiFuture({
  property,
}: {
  property: PropertyRecord;
}) {
  const purchasePriceId = useId();
  const downPaymentId = useId();
  const interestRateId = useId();
  const tenureId = useId();

  const initialPrice = useMemo(() => {
    return Number.isFinite(property.price) && property.price > 0
      ? property.price
      : 50_00_000;
  }, [property.price]);

  // State inputs
  const [purchasePrice, setPurchasePrice] = useState<number>(initialPrice);
  const [downPaymentMode, setDownPaymentMode] = useState<"percentage" | "flat">("percentage");
  const [downPaymentPct, setDownPaymentPct] = useState<number>(20);
  const [downPaymentFlat, setDownPaymentFlat] = useState<number>(Math.round(initialPrice * 0.2));
  const [annualRate, setAnnualRate] = useState<number>(8.5);
  const [tenureUnit, setTenureUnit] = useState<"years" | "months">("years");
  const [tenureValue, setTenureValue] = useState<number>(20);

  // Amortization table controls
  const [amortizationMode, setAmortizationMode] = useState<"yearly" | "monthly">("yearly");
  const [isAmortizationExpanded, setIsAmortizationExpanded] = useState<boolean>(true);
  const [budgetOpen, setBudgetOpen] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Derived effective down payment amount
  const effectiveDownPayment = useMemo(() => {
    if (downPaymentMode === "percentage") {
      return Math.min(purchasePrice, Math.round((purchasePrice * downPaymentPct) / 100));
    }
    return Math.min(purchasePrice, Math.max(0, downPaymentFlat));
  }, [purchasePrice, downPaymentMode, downPaymentPct, downPaymentFlat]);

  const effectiveDownPaymentPct = useMemo(() => {
    if (purchasePrice <= 0) return 0;
    return Math.min(100, Math.round((effectiveDownPayment / purchasePrice) * 100));
  }, [purchasePrice, effectiveDownPayment]);

  // Principal (Net Loan Amount)
  const principal = useMemo(() => {
    return Math.max(0, purchasePrice - effectiveDownPayment);
  }, [purchasePrice, effectiveDownPayment]);

  // Tenure in months
  const tenureMonths = useMemo(() => {
    return tenureUnit === "years" ? tenureValue * 12 : tenureValue;
  }, [tenureUnit, tenureValue]);

  // EMI calculation: EMI = [P x R x (1+R)^N] / [(1+R)^N - 1]
  const { monthlyEmi, totalInterest, totalPayment } = useMemo(() => {
    if (principal <= 0 || tenureMonths <= 0) {
      return { monthlyEmi: 0, totalInterest: 0, totalPayment: 0 };
    }

    if (annualRate <= 0) {
      const emi = principal / tenureMonths;
      return {
        monthlyEmi: emi,
        totalInterest: 0,
        totalPayment: principal,
      };
    }

    const r = annualRate / 12 / 100;
    const n = tenureMonths;
    const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const emi = principal * factor;
    const totPay = emi * n;
    const totInt = Math.max(0, totPay - principal);

    return {
      monthlyEmi: emi,
      totalInterest: totInt,
      totalPayment: totPay,
    };
  }, [principal, annualRate, tenureMonths]);

  // Amortization Schedule generation
  const { yearlySchedule, monthlySchedule } = useMemo(() => {
    const months: AmortizationMonthRow[] = [];
    const years: AmortizationYearRow[] = [];

    if (principal <= 0 || tenureMonths <= 0) {
      return { yearlySchedule: years, monthlySchedule: months };
    }

    const r = annualRate > 0 ? annualRate / 12 / 100 : 0;
    let balance = principal;

    let currentYearNumber = 1;
    let yearBeginning = balance;
    let yearTotalEmi = 0;
    let yearPrincipalPaid = 0;
    let yearInterestPaid = 0;

    for (let m = 1; m <= tenureMonths; m++) {
      const beginning = balance;
      const interestPart = annualRate > 0 ? balance * r : 0;
      let principalPart = monthlyEmi - interestPart;

      if (principalPart > balance || m === tenureMonths) {
        principalPart = balance;
      }

      const emiForMonth = principalPart + interestPart;
      const ending = Math.max(0, balance - principalPart);

      months.push({
        paymentNumber: m,
        beginningBalance: beginning,
        emi: emiForMonth,
        principalPaid: principalPart,
        interestPaid: interestPart,
        endingBalance: ending,
      });

      yearTotalEmi += emiForMonth;
      yearPrincipalPaid += principalPart;
      yearInterestPaid += interestPart;
      balance = ending;

      if (m % 12 === 0 || m === tenureMonths) {
        years.push({
          year: currentYearNumber,
          beginningBalance: yearBeginning,
          totalEmi: yearTotalEmi,
          principalPaid: yearPrincipalPaid,
          interestPaid: yearInterestPaid,
          endingBalance: ending,
        });

        currentYearNumber++;
        yearBeginning = ending;
        yearTotalEmi = 0;
        yearPrincipalPaid = 0;
        yearInterestPaid = 0;
      }

      if (balance <= 0) break;
    }

    return { yearlySchedule: years, monthlySchedule: months };
  }, [principal, annualRate, tenureMonths, monthlyEmi]);

  // SVG Donut Chart Proportions
  const chartSlices = useMemo(() => {
    const total = effectiveDownPayment + principal + totalInterest;
    if (total <= 0) {
      return {
        downPaymentPct: 0,
        principalPct: 0,
        interestPct: 0,
        circumference: 2 * Math.PI * 40,
        downOffset: 0,
        principalOffset: 0,
        interestOffset: 0,
      };
    }

    const dPct = (effectiveDownPayment / total) * 100;
    const pPct = (principal / total) * 100;
    const iPct = (totalInterest / total) * 100;

    const radius = 40;
    const circumference = 2 * Math.PI * radius;

    const dStroke = (dPct / 100) * circumference;
    const pStroke = (pPct / 100) * circumference;
    const iStroke = (iPct / 100) * circumference;

    return {
      downPaymentPct: Math.round(dPct),
      principalPct: Math.round(pPct),
      interestPct: Math.round(iPct),
      circumference,
      dStroke,
      pStroke,
      iStroke,
      dOffset: 0,
      pOffset: -dStroke,
      iOffset: -(dStroke + pStroke),
    };
  }, [effectiveDownPayment, principal, totalInterest]);

  // Future value narrative
  const nowYear = new Date().getFullYear();
  const nearYear = nowYear + 2;
  const laterYear = nowYear + 4;
  const valueNear = futureValue(purchasePrice, 2, ANNUAL_APPRECIATION);
  const valueLater = futureValue(purchasePrice, 4, ANNUAL_APPRECIATION);

  // Actions
  const handleReset = () => {
    setPurchasePrice(initialPrice);
    setDownPaymentMode("percentage");
    setDownPaymentPct(20);
    setDownPaymentFlat(Math.round(initialPrice * 0.2));
    setAnnualRate(8.5);
    setTenureUnit("years");
    setTenureValue(20);

    trackEvent({
      event_type: "EMI_CALCULATOR_USE",
      metadata: {
        action: "reset_defaults",
        section_type: "emi_calculator",
        surface: "property_detail",
      },
    });
  };

  const handlePrint = () => {
    trackEvent({
      event_type: "EMI_CALCULATOR_USE",
      metadata: {
        action: "print_export",
        section_type: "emi_calculator",
        surface: "property_detail",
      },
    });
    window.print();
  };

  return (
    <section className="pd-section pd-emi print:p-0 print:m-0" aria-labelledby="pd-emi-title" ref={printAreaRef}>
      <div className="pd-section__inner">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/10 pb-6">
          <div>
            <p className="pd-kicker">Affordability & Financing</p>
            <h2 id="pd-emi-title" className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#171717]">
              EMI Calculator for {property.name}
            </h2>
            <p className="pd-section__lead mt-2 text-sm sm:text-base text-[#5c5852]">
              Customize your purchase price, upfront down payment, and tenure to visualize your monthly installments and complete amortization schedule.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 print:hidden">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#171717] shadow-xs hover:bg-neutral-50 transition active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#171717] shadow-xs hover:bg-neutral-50 transition active:scale-95"
            >
              <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Export PDF
            </button>
            <button
              type="button"
              onClick={() => setBudgetOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#c6a46c] px-4 py-2 text-xs font-bold text-neutral-950 shadow-sm hover:bg-[#d4b57e] transition active:scale-95"
            >
              WhatsApp Budget
            </button>
          </div>
        </div>

        {/* Main 2-Column Responsive Dashboard Layout */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Input Controls (Scrollable block) */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl border border-black/10 bg-white shadow-xs overflow-hidden">
            <div className="p-5 sm:p-7 pb-4 border-b border-black/10 bg-white z-10 shrink-0 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#171717] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#c6a46c]"></span>
                Loan Parameters & Controls
              </h3>
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider hidden sm:inline-block">
                Scroll Parameters
              </span>
            </div>

            <div className="p-5 sm:p-7 pt-5 space-y-6 overflow-y-auto overscroll-y-auto max-h-145 lg:max-h-160 xl:max-h-165 pd-emi__controls-scroll">
              {/* 1. Total Purchase Price */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor={purchasePriceId} className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                    Total Purchase Price
                  </label>
                  <span className="text-xs font-bold text-[#c6a46c]">
                    {formatInr(purchasePrice)}
                  </span>
                </div>
                <div className="relative rounded-lg border border-neutral-300 bg-neutral-50/50 focus-within:border-[#c6a46c] focus-within:ring-1 focus-within:ring-[#c6a46c]">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                    ₹
                  </span>
                  <input
                    id={purchasePriceId}
                    type="number"
                    min={100000}
                    max={500000000}
                    step={50000}
                    value={purchasePrice}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setPurchasePrice(val);
                      if (downPaymentMode === "flat" && downPaymentFlat > val) {
                        setDownPaymentFlat(val);
                      }
                    }}
                    className="w-full pl-8 pr-4 py-2.5 text-sm font-semibold text-[#171717] bg-transparent outline-none rounded-lg"
                  />
                </div>
                <div className="mt-2.5">
                  <input
                    type="range"
                    min={500000}
                    max={200000000}
                    step={100000}
                    value={Math.min(purchasePrice, 200000000)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setPurchasePrice(val);
                      if (downPaymentMode === "flat" && downPaymentFlat > val) {
                        setDownPaymentFlat(val);
                      }
                    }}
                    className="w-full accent-[#c6a46c] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-medium mt-0.5">
                    <span>₹5 L</span>
                    <span>₹1 Cr</span>
                    <span>₹2 Cr+</span>
                  </div>
                </div>
              </div>

              {/* 2. Down Payment */}
              <div className="border-t border-neutral-100 pt-5">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor={downPaymentId} className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                      Down Payment
                    </label>
                    <span className="text-xs font-bold text-[#c6a46c]">
                      {formatInr(effectiveDownPayment)} ({effectiveDownPaymentPct}%)
                    </span>
                  </div>
                  {/* Mode toggle */}
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setDownPaymentMode("percentage")}
                      className={`rounded-md px-2.5 py-1 transition ${
                        downPaymentMode === "percentage"
                          ? "bg-white text-[#171717] shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDownPaymentFlat(effectiveDownPayment);
                        setDownPaymentMode("flat");
                      }}
                      className={`rounded-md px-2.5 py-1 transition ${
                        downPaymentMode === "flat"
                          ? "bg-white text-[#171717] shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      ₹ Flat
                    </button>
                  </div>
                </div>

                {downPaymentMode === "percentage" ? (
                  <>
                    <div className="relative rounded-lg border border-neutral-300 bg-neutral-50/50 focus-within:border-[#c6a46c] focus-within:ring-1 focus-within:ring-[#c6a46c]">
                      <input
                        id={downPaymentId}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={downPaymentPct}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                          setDownPaymentPct(val);
                        }}
                        className="w-full px-4 py-2.5 text-sm font-semibold text-[#171717] bg-transparent outline-none rounded-lg"
                      />
                      <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                        %
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <input
                        type="range"
                        min={0}
                        max={90}
                        step={1}
                        value={downPaymentPct}
                        onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                        className="w-full accent-[#c6a46c] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium mt-0.5">
                        <span>0%</span>
                        <span>20% (Standard)</span>
                        <span>50%</span>
                        <span>90%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative rounded-lg border border-neutral-300 bg-neutral-50/50 focus-within:border-[#c6a46c] focus-within:ring-1 focus-within:ring-[#c6a46c]">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                        ₹
                      </span>
                      <input
                        id={downPaymentId}
                        type="number"
                        min={0}
                        max={purchasePrice}
                        step={25000}
                        value={downPaymentFlat}
                        onChange={(e) => {
                          const val = Math.min(purchasePrice, Math.max(0, Number(e.target.value) || 0));
                          setDownPaymentFlat(val);
                        }}
                        className="w-full pl-8 pr-4 py-2.5 text-sm font-semibold text-[#171717] bg-transparent outline-none rounded-lg"
                      />
                    </div>
                    <div className="mt-2.5">
                      <input
                        type="range"
                        min={0}
                        max={purchasePrice}
                        step={Math.max(10000, Math.round(purchasePrice / 100))}
                        value={downPaymentFlat}
                        onChange={(e) => setDownPaymentFlat(Number(e.target.value))}
                        className="w-full accent-[#c6a46c] cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-400 font-medium mt-0.5">
                        <span>₹0</span>
                        <span>{formatInr(purchasePrice / 2)}</span>
                        <span>{formatInr(purchasePrice)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3. Read-only Net Loan Amount */}
              <div className="border-t border-neutral-100 pt-5">
                <div className="flex justify-between items-center p-3 rounded-xl bg-neutral-100/80 border border-neutral-200">
                  <div>
                    <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      Net Loan Amount (Principal)
                    </p>
                    <p className="text-xs text-neutral-400 mt-0.5">Total Price minus Down Payment</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold text-[#171717]">
                      {formatInr(principal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Interest Rate */}
              <div className="border-t border-neutral-100 pt-5">
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor={interestRateId} className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                    Interest Rate (% per annum)
                  </label>
                  <span className="text-xs font-bold text-[#c6a46c]">
                    {annualRate.toFixed(2)}%
                  </span>
                </div>
                <div className="relative rounded-lg border border-neutral-300 bg-neutral-50/50 focus-within:border-[#c6a46c] focus-within:ring-1 focus-within:ring-[#c6a46c]">
                  <input
                    id={interestRateId}
                    type="number"
                    min={0}
                    max={25}
                    step={0.1}
                    value={annualRate}
                    onChange={(e) => {
                      const val = Math.min(25, Math.max(0, Number(e.target.value) || 0));
                      setAnnualRate(val);
                    }}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-[#171717] bg-transparent outline-none rounded-lg"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                    %
                  </span>
                </div>
                <div className="mt-2.5">
                  <input
                    type="range"
                    min={4}
                    max={18}
                    step={0.1}
                    value={annualRate}
                    onChange={(e) => setAnnualRate(Number(e.target.value))}
                    className="w-full accent-[#c6a46c] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-medium mt-0.5">
                    <span>4%</span>
                    <span>8.5% (Typical Bank)</span>
                    <span>14%</span>
                    <span>18%</span>
                  </div>
                </div>
              </div>

              {/* 5. Loan Tenure */}
              <div className="border-t border-neutral-100 pt-5">
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor={tenureId} className="text-xs font-semibold text-neutral-700 tracking-wide uppercase">
                      Loan Tenure
                    </label>
                    <span className="text-xs font-bold text-[#c6a46c]">
                      {tenureValue} {tenureUnit === "years" ? (tenureValue === 1 ? "Year" : "Years") : "Months"} ({tenureMonths} mos)
                    </span>
                  </div>
                  {/* Unit toggle */}
                  <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => {
                        if (tenureUnit === "months") {
                          setTenureUnit("years");
                          setTenureValue(Math.max(1, Math.round(tenureValue / 12)));
                        }
                      }}
                      className={`rounded-md px-2.5 py-1 transition ${
                        tenureUnit === "years"
                          ? "bg-white text-[#171717] shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Years
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (tenureUnit === "years") {
                          setTenureUnit("months");
                          setTenureValue(tenureValue * 12);
                        }
                      }}
                      className={`rounded-md px-2.5 py-1 transition ${
                        tenureUnit === "months"
                          ? "bg-white text-[#171717] shadow-xs font-bold"
                          : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      Months
                    </button>
                  </div>
                </div>

                <div className="relative rounded-lg border border-neutral-300 bg-neutral-50/50 focus-within:border-[#c6a46c] focus-within:ring-1 focus-within:ring-[#c6a46c]">
                  <input
                    id={tenureId}
                    type="number"
                    min={1}
                    max={tenureUnit === "years" ? 35 : 420}
                    step={1}
                    value={tenureValue}
                    onChange={(e) => {
                      const maxVal = tenureUnit === "years" ? 35 : 420;
                      const val = Math.min(maxVal, Math.max(1, Number(e.target.value) || 1));
                      setTenureValue(val);
                    }}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-[#171717] bg-transparent outline-none rounded-lg"
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-neutral-500 font-semibold text-sm">
                    {tenureUnit}
                  </span>
                </div>
                <div className="mt-2.5">
                  <input
                    type="range"
                    min={1}
                    max={tenureUnit === "years" ? 30 : 360}
                    step={1}
                    value={tenureValue}
                    onChange={(e) => setTenureValue(Number(e.target.value))}
                    className="w-full accent-[#c6a46c] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-medium mt-0.5">
                    <span>{tenureUnit === "years" ? "1 Yr" : "12 Mo"}</span>
                    <span>{tenureUnit === "years" ? "15 Yrs" : "180 Mo"}</span>
                    <span>{tenureUnit === "years" ? "30 Yrs" : "360 Mo"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Summary Card & Interactive Doughnut Chart (Sticky like Lifestyle) */}
          <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-[calc(var(--nav-h,5rem)+1.25rem)] lg:self-start">
            {/* Primary Result Card */}
            <div className="rounded-2xl bg-[#0f1114] p-6 text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-xs uppercase tracking-widest font-semibold text-white/60">
                  Estimated Monthly EMI
                </span>
                <span className="inline-flex items-center rounded-full bg-[#c6a46c]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#d4b57e]">
                  {tenureMonths} Months
                </span>
              </div>

              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-baseline gap-1">
                  <span>{formatInr(Math.round(monthlyEmi))}</span>
                  <span className="text-sm font-medium text-white/50">/ month</span>
                </div>
                <p className="mt-1 text-xs text-white/60">
                  Based on {annualRate}% p.a. interest over {tenureMonths / 12} years
                </p>
              </div>

              {/* Chart & Legend Grid */}
              <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 items-center gap-6">
                {/* Visual SVG Donut */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-36 h-36">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#262626"
                        strokeWidth="14"
                      />
                      {/* Down Payment slice */}
                      {chartSlices.dStroke > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#10b981"
                          strokeWidth="14"
                          strokeDasharray={`${chartSlices.dStroke} ${chartSlices.circumference}`}
                          strokeDashoffset={chartSlices.dOffset}
                        />
                      )}
                      {/* Principal Loan slice */}
                      {chartSlices.pStroke > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#c6a46c"
                          strokeWidth="14"
                          strokeDasharray={`${chartSlices.pStroke} ${chartSlices.circumference}`}
                          strokeDashoffset={chartSlices.pOffset}
                        />
                      )}
                      {/* Total Interest slice */}
                      {chartSlices.iStroke > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="transparent"
                          stroke="#f59e0b"
                          strokeWidth="14"
                          strokeDasharray={`${chartSlices.iStroke} ${chartSlices.circumference}`}
                          strokeDashoffset={chartSlices.iOffset}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] uppercase font-semibold text-white/50 tracking-wider">Total</span>
                      <span className="text-xs font-bold text-white">
                        {formatInr(Math.round(totalPayment + effectiveDownPayment))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legend & Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/80">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                      Down Payment
                    </span>
                    <span className="font-bold text-white">
                      {chartSlices.downPaymentPct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/80">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c6a46c]"></span>
                      Principal Loan
                    </span>
                    <span className="font-bold text-white">
                      {chartSlices.principalPct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-white/80">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></span>
                      Interest Payable
                    </span>
                    <span className="font-bold text-white">
                      {chartSlices.interestPct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Key Metrics Breakdown List */}
              <dl className="mt-6 border-t border-white/10 pt-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-white/60">Down payment upfront</dt>
                  <dd className="font-semibold text-white">{formatInr(effectiveDownPayment)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-white/60">Principal loan amount</dt>
                  <dd className="font-semibold text-white">{formatInr(principal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-white/60">Total interest payable</dt>
                  <dd className="font-semibold text-[#f59e0b]">{formatInr(Math.round(totalInterest))}</dd>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm">
                  <dt className="font-semibold text-white">Total Outflow (Cost of Plot)</dt>
                  <dd className="font-bold text-[#c6a46c]">{formatInr(Math.round(totalPayment + effectiveDownPayment))}</dd>
                </div>
              </dl>
            </div>

            {/* Value Growth & Land Appreciation Narrative */}
            <div className="rounded-2xl border border-black/10 bg-[#faf8f5] p-5 sm:p-6">
              <h4 className="text-sm font-bold text-[#171717] tracking-tight flex items-center gap-2">
                <svg className="w-4 h-4 text-[#c6a46c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Corridor Value Growth Projection
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-[#5c5852]">
                With {effectiveDownPaymentPct}% down, your EMI is{" "}
                <strong className="text-[#171717]">{formatInr(Math.round(monthlyEmi))}/mo</strong>.
                At the corridor&apos;s average growth rate of {ANNUAL_APPRECIATION * 100}%/year, your plot is projected to appreciate to:
              </p>
              <div className="mt-3.5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase font-bold text-neutral-400">In 2 Years ({nearYear})</p>
                  <p className="text-sm font-bold text-[#171717] mt-0.5">~{formatInr(Math.round(valueNear))}</p>
                </div>
                <div className="rounded-xl border border-black/5 bg-white p-3">
                  <p className="text-[10px] uppercase font-bold text-neutral-400">In 4 Years ({laterYear})</p>
                  <p className="text-sm font-bold text-[#c6a46c] mt-0.5">~{formatInr(Math.round(valueLater))}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-neutral-400 leading-normal">
                Appreciation is estimated from corridor growth history. Illustrative only, not a guaranteed quote.
              </p>
            </div>
          </div>
        </div>

        {/* Amortization Schedule Section (Below Main Calculator Cards) */}
        <div className="mt-10 rounded-2xl border border-black/10 bg-white p-5 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 pb-5">
            <div>
              <h3 className="text-lg font-bold text-[#171717] tracking-tight">
                Amortization Schedule
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Detailed timeline of balance repayment, principal deductions, and accrued interest over the loan life.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Yearly vs Monthly Toggle */}
              <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAmortizationMode("yearly")}
                  className={`rounded-md px-3 py-1.5 transition ${
                    amortizationMode === "yearly"
                      ? "bg-white text-[#171717] shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Yearly Summary
                </button>
                <button
                  type="button"
                  onClick={() => setAmortizationMode("monthly")}
                  className={`rounded-md px-3 py-1.5 transition ${
                    amortizationMode === "monthly"
                      ? "bg-white text-[#171717] shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Monthly Schedule
                </button>
              </div>

              {/* Expand / Collapse toggle */}
              <button
                type="button"
                onClick={() => setIsAmortizationExpanded(!isAmortizationExpanded)}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
              >
                {isAmortizationExpanded ? "Collapse" : "Expand"}
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${isAmortizationExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Table Container */}
          {isAmortizationExpanded && (
            <div className="mt-5 overflow-x-auto max-h-115 overflow-y-auto rounded-xl border border-neutral-200">
              <table className="w-full text-left text-xs text-neutral-600">
                <thead className="sticky top-0 z-10 bg-neutral-100/95 backdrop-blur-xs text-[11px] font-bold uppercase tracking-wider text-neutral-700 border-b border-neutral-200">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      {amortizationMode === "yearly" ? "Year" : "Payment #"}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Beginning Balance
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {amortizationMode === "yearly" ? "Annual Payment" : "Monthly EMI"}
                    </th>
                    <th scope="col" className="px-4 py-3 text-emerald-700">
                      Principal Paid
                    </th>
                    <th scope="col" className="px-4 py-3 text-amber-700">
                      Interest Paid
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Ending Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 bg-white">
                  {amortizationMode === "yearly" ? (
                    yearlySchedule.map((row) => (
                      <tr key={`year-${row.year}`} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-neutral-900">
                          Year {row.year}
                        </td>
                        <td className="px-4 py-3">{formatInr(Math.round(row.beginningBalance))}</td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{formatInr(Math.round(row.totalEmi))}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {formatInr(Math.round(row.principalPaid))}
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700">
                          {formatInr(Math.round(row.interestPaid))}
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 text-right">
                          {formatInr(Math.round(row.endingBalance))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    monthlySchedule.map((row) => (
                      <tr key={`month-${row.paymentNumber}`} className="hover:bg-neutral-50/80 transition-colors">
                        <td className="px-4 py-3 font-bold text-neutral-900">
                          #{row.paymentNumber}
                        </td>
                        <td className="px-4 py-3">{formatInr(Math.round(row.beginningBalance))}</td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{formatInr(Math.round(row.emi))}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">
                          {formatInr(Math.round(row.principalPaid))}
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700">
                          {formatInr(Math.round(row.interestPaid))}
                        </td>
                        <td className="px-4 py-3 font-bold text-neutral-900 text-right">
                          {formatInr(Math.round(row.endingBalance))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <WhatsAppBudgetModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        propertyLabel={`${property.name} · ${formatInr(purchasePrice)} · ${effectiveDownPaymentPct}% down · EMI ${formatInr(Math.round(monthlyEmi))}`}
      />
    </section>
  );
}
