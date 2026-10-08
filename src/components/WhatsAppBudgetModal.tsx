"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import "./WhatsAppBudgetModal.css";

const PHONE_RE = /^[6-9]\d{9}$/;

type WhatsAppBudgetModalProps = {
  open: boolean;
  onClose: () => void;
  propertyLabel: string;
};

export default function WhatsAppBudgetModal({
  open,
  onClose,
  propertyLabel,
}: WhatsAppBudgetModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    setDigits("");
    setError("");
    setSubmitted(false);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  function handleDigitsChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value.replace(/\D/g, "").slice(0, 10);
    setDigits(next);
    if (error) setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!PHONE_RE.test(digits)) {
      setError(
        "Enter a valid 10-digit Indian mobile number starting with 6–9.",
      );
      return;
    }
    setSubmitted(true);
  }

  return createPortal(
    <div className="wa-budget" role="presentation">
      <button
        type="button"
        className="wa-budget__scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="wa-budget__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="wa-budget__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        {submitted ? (
          <div className="wa-budget__done">
            <p className="wa-budget__eyebrow">WhatsApp</p>
            <h2 id={titleId} className="wa-budget__title">
              Details on the way
            </h2>
            <p className="wa-budget__copy">
              EMI and appreciation details
              {propertyLabel ? ` for ${propertyLabel}` : ""} will be sent to{" "}
              <strong>+91 {digits}</strong> on WhatsApp.
            </p>
            <button type="button" className="wa-budget__submit" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="wa-budget__form" onSubmit={handleSubmit} noValidate>
            <p className="wa-budget__eyebrow">WhatsApp</p>
            <h2 id={titleId} className="wa-budget__title">
              Calculate for my budget
            </h2>
            <p className="wa-budget__copy">
              Enter your 10-digit mobile number. We&apos;ll send EMI and
              appreciation details on WhatsApp
              {propertyLabel ? ` for ${propertyLabel}` : ""}.
            </p>

            <label className="wa-budget__field">
              <span className="wa-budget__field-label">Mobile number</span>
              <span className="wa-budget__input-wrap">
                <span className="wa-budget__prefix" aria-hidden="true">
                  +91
                </span>
                <input
                  ref={inputRef}
                  className="wa-budget__input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="9876543210"
                  value={digits}
                  onChange={handleDigitsChange}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "wa-budget-error" : undefined}
                />
              </span>
            </label>

            {error ? (
              <p id="wa-budget-error" className="wa-budget__error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="wa-budget__submit">
              Send on WhatsApp
              <span aria-hidden="true">→</span>
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
