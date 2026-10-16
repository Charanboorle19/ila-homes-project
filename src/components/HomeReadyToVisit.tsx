"use client";

import React, { useId, useState } from "react";
import Image from "next/image";
import { createPublicLead, LEAD_ERROR_CODES } from "@/services/leadsService";
import { ApiError } from "@/services/apiClient";
import { whatsappUrl, DEFAULT_WHATSAPP_PHONE } from "@/lib/propertyUtils";
import "./HomeReadyToVisit.css";

const PHONE_PREFIX = "+91";
const LOCAL_DIGITS = 10;

function updatePhoneValue(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length > LOCAL_DIGITS && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, LOCAL_DIGITS);
}

function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, "").length === LOCAL_DIGITS;
}

function toStoredPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > LOCAL_DIGITS && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return `${PHONE_PREFIX}${digits}`;
}

type FormFields = {
  name: string;
  phone: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

type HomeReadyToVisitProps = {
  propertyName?: string;
  propertyId?: string;
  className?: string;
  onSuccess?: () => void;
};

export default function HomeReadyToVisit({
  propertyName,
  propertyId,
  className = "",
  onSuccess,
}: HomeReadyToVisitProps = {}) {
  const defaultMessage = propertyName
    ? `Hi, I want to book a private site visit for ${propertyName}. Could you please share the available slots and details?`
    : DEFAULT_HOME_MESSAGE;

  const [fields, setFields] = useState<FormFields>({
    name: "",
    phone: "",
    description: defaultMessage,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");

  const nameId = useId();
  const phoneId = useId();
  const descriptionId = useId();

  const update = (key: keyof FormFields) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const updatePhone = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = updatePhoneValue(event.target.value);
    setFields((current) => ({ ...current, phone: value }));
    setErrors((current) =>
      current.phone ? { ...current, phone: undefined } : current,
    );
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!fields.name.trim()) {
      next.name = "Please enter your name.";
    }
    if (!fields.phone.trim()) {
      next.phone = "Please enter your phone number.";
    } else if (!isValidPhone(fields.phone)) {
      next.phone = `Enter a ${LOCAL_DIGITS}-digit phone number.`;
    }
    return next;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus("idle");
      setStatusMessage("");
      return;
    }

    setStatus("submitting");
    setStatusMessage("");

    try {
      const lead = await createPublicLead({
        name: fields.name.trim(),
        mobile: toStoredPhone(fields.phone),
        email: null,
        message: fields.description.trim() || null,
        property_id: propertyId || null,
        unit_id: null,
        metadata: {
          form_name: "homepage_visit_enquiry",
          property_name: propertyName || null,
          page_url:
            typeof window !== "undefined" ? window.location.href : null,
        },
      });

      setStatus("sent");
      const submittedNotes = fields.description.trim();
      setFields({
        name: "",
        phone: "",
        description: defaultMessage,
      });
      onSuccess?.();

      // Redirect to WhatsApp with enquiry details
      if (typeof window !== "undefined") {
        const text = submittedNotes || defaultMessage;
        const targetUrl = whatsappUrl(text, DEFAULT_WHATSAPP_PHONE);
        window.location.href = targetUrl;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      if (
        error instanceof ApiError &&
        error.code === LEAD_ERROR_CODES.rateLimited
      ) {
        setStatus("error");
        setStatusMessage(
          "Too many requests just now. Please try again in a few minutes.",
        );
        return;
      }

      setStatus("error");
      setStatusMessage(
        "Could not send enquiry right now. Please try again or reach out on WhatsApp.",
      );
    }
  };

  const busy = status === "submitting";
  const sent = status === "sent";

  return (
    <section
      id="visit-plot"
      className={`home-visit ${className}`.trim()}
      aria-labelledby="home-visit-title"
    >
      <div className="home-visit__inner">
        {/* Left Copy & Art Column */}
        <div className="home-visit__copy">
          <p className="home-visit__kicker">Next step</p>
          <h2 id="home-visit-title" className="home-visit__heading">
            Ready to visit this plot?
          </h2>
          <p className="home-visit__lead">
            Leave your details and our team will call you back with availability
            and coordinate your private guided site visit.
          </p>

          <div className="home-visit__art" aria-hidden="true">
            <Image
              src="/assets/Call%20center.gif"
              alt=""
              fill
              sizes="(min-width: 1100px) 22rem"
              unoptimized
            />
          </div>
        </div>

        {/* Right Form Column */}
        <div className="home-visit__aside">
          <form className="home-visit__form" noValidate onSubmit={handleSubmit}>
            <div className="home-visit__form-grid">
              {/* Name Field */}
              <div className="home-visit__field">
                <label className="home-visit__label" htmlFor={nameId}>
                  Name
                </label>
                <input
                  id={nameId}
                  className="home-visit__input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  required
                  aria-required="true"
                  value={fields.name}
                  onChange={update("name")}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name ? (
                  <p
                    className="home-visit__error"
                    id={`${nameId}-error`}
                    aria-live="polite"
                  >
                    {errors.name}
                  </p>
                ) : null}
              </div>

              {/* Phone Field */}
              <div className="home-visit__field">
                <label className="home-visit__label" htmlFor={phoneId}>
                  Phone number
                </label>
                <div
                  className={`home-visit__phone${
                    errors.phone ? " is-invalid" : ""
                  }`}
                >
                  <span className="home-visit__phone-prefix" aria-hidden="true">
                    {PHONE_PREFIX}
                  </span>
                  <input
                    id={phoneId}
                    className="home-visit__input home-visit__phone-input"
                    type="tel"
                    name="phone"
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={LOCAL_DIGITS}
                    placeholder="98765 43210"
                    required
                    aria-required="true"
                    value={fields.phone}
                    onChange={updatePhone}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={
                      errors.phone ? `${phoneId}-error` : undefined
                    }
                  />
                </div>
                {errors.phone ? (
                  <p
                    className="home-visit__error"
                    id={`${phoneId}-error`}
                    aria-live="polite"
                  >
                    {errors.phone}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Optional Description Field */}
            <div className="home-visit__field home-visit__field--wide">
              <label className="home-visit__label" htmlFor={descriptionId}>
                Description
                <span className="home-visit__hint">Optional</span>
              </label>
              <textarea
                id={descriptionId}
                className="home-visit__input home-visit__textarea"
                name="description"
                rows={3}
                placeholder="Tell us what you are looking for — plot size, preferred facing, budget, or timeline."
                value={fields.description}
                onChange={update("description")}
                aria-describedby={`${descriptionId}-hint`}
              />
              <p className="home-visit__hint" id={`${descriptionId}-hint`}>
                Anything you add helps us shortlist the right plots for you.
              </p>
            </div>

            {/* Submission Status & Feedback */}
            {sent ? (
              <div className="home-visit__done" role="status" aria-live="polite">
                <span className="home-visit__done-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <div className="home-visit__done-copy">
                  <strong className="home-visit__done-title">
                    Thank you! Callback requested.
                  </strong>
                  <span className="home-visit__done-desc">
                    Our team will contact you shortly to coordinate your plot visit.
                  </span>
                </div>
              </div>
            ) : null}

            {status === "error" && statusMessage ? (
              <p
                className="home-visit__status home-visit__status--error"
                role="alert"
                aria-live="assertive"
              >
                {statusMessage}
              </p>
            ) : null}

            {/* Submit Button */}
            <div className="home-visit__submit">
              <button
                type="submit"
                className="home-visit__btn"
                disabled={busy || sent}
                aria-busy={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <span className="ila-loader" aria-hidden />
                    Submitting…
                  </>
                ) : sent ? (
                  "Submitted ✓"
                ) : (
                  "Submit Enquiry"
                )}
              </button>
            </div>

            <p className="home-visit__privacy">
              We respect your privacy. No spam — your information is exclusively
              used to coordinate your site visit.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
