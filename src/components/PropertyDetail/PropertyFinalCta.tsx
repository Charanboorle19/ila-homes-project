"use client";

import { useEffect, useId, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import { isPropertyUuid } from "@/services/propertiesService";
import {
  createPublicLead,
  LEAD_ERROR_CODES,
} from "@/services/leadsService";
import { bookPublicSiteVisit } from "@/services/siteVisitsService";
import { ApiError } from "@/services/apiClient";

function storageKey(kind: "wishlist", id: string) {
  return `ila-${kind}-${id}`;
}

/** 10–15 digits, tolerating spaces, dashes, brackets and a leading +country. */
function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

type EnquiryFields = {
  name: string;
  phone: string;
  description: string;
  /** Local `datetime-local` value, e.g. "2026-10-15T10:30". */
  scheduledAt: string;
};

type EnquiryErrors = Partial<Record<keyof EnquiryFields, string>>;

const EMPTY: EnquiryFields = {
  name: "",
  phone: "",
  description: "",
  scheduledAt: "",
};

/**
 * Earliest selectable visit time, as a `datetime-local` value.
 *
 * `datetime-local` is wall-clock local time, so the offset is subtracted
 * before slicing: without it the browser would be handed a UTC string and read
 * it back as local, letting a visitor pick a slot that is already past.
 */
function earliestVisitLocal(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function PropertyFinalCta({
  property,
}: {
  property: PropertyRecord;
}) {
  const [wishlist, setWishlist] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [fields, setFields] = useState<EnquiryFields>(EMPTY);
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">(
    "idle",
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [visitStatus, setVisitStatus] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [visitMessage, setVisitMessage] = useState("");
  const [visitError, setVisitError] = useState<string | null>(null);

  const nameId = useId();
  const phoneId = useId();
  const descriptionId = useId();
  const visitAtId = useId();

  // A site visit can only be booked against a real property UUID, and unlike a
  // lead the endpoint requires that id. Catalogue records carry slugs, so they
  // get the callback path only.
  const canBookVisit = isPropertyUuid(property.id);
  const minVisitAt = earliestVisitLocal();

  useEffect(() => {
    try {
      setWishlist(localStorage.getItem(storageKey("wishlist", property.id)) === "1");
    } catch {
      // ignore
    }
  }, [property.id]);

  // A different property means the previous draft and its errors are stale.
  useEffect(() => {
    setFields(EMPTY);
    setErrors({});
    setStatus("idle");
    setStatusMessage("");
    setVisitStatus("idle");
    setVisitMessage("");
    setVisitError(null);
  }, [property.id]);

  const toggle = (kind: "wishlist") => {
    const next = !wishlist;
    setWishlist(next);
    try {
      localStorage.setItem(storageKey(kind, property.id), next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const update = (key: keyof EnquiryFields) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    setFields((current) => ({ ...current, [key]: value }));
    // Clear a field's error as soon as it is edited, rather than making the
    // visitor resubmit to find out it was fixed.
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const validate = (): EnquiryErrors => {
    const next: EnquiryErrors = {};
    if (!fields.name.trim()) {
      next.name = "Please enter your name.";
    }
    if (!fields.phone.trim()) {
      next.phone = "Please enter your phone number.";
    } else if (!isValidPhone(fields.phone)) {
      next.phone = "Please enter a valid phone number.";
    }
    // description is intentionally optional and never validated.
    return next;
  };

  /**
   * Enquiry capture.
   *
   * Posts to POST /api/leads as a public lead. `apiFetch` throws on any
   * non-2xx response and the endpoint answers 201 on success, so the success
   * message below is only reachable once the backend has actually accepted the
   * lead. Nothing is announced as sent otherwise.
   *
   * The draft is preserved on failure: a visitor whose request was rejected
   * must not have to retype it.
   */
  const submitEnquiry = async (event: React.FormEvent<HTMLFormElement>) => {
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

    // Only an active property UUID may be attached. A local catalogue record
    // carries a slug, and sending that would fail with PROPERTY_NOT_FOUND.
    const propertyId = isPropertyUuid(property.id) ? property.id : null;

    try {
      await createPublicLead({
        name: fields.name.trim(),
        mobile: fields.phone.trim(),
        // Optional fields are sent as null rather than empty strings.
        email: null,
        message: fields.description.trim() || null,
        property_id: propertyId,
        unit_id: null,
        metadata: {
          form_name: "property_enquiry",
          page_url:
            typeof window !== "undefined" ? window.location.href : null,
          property_name: property.name,
        },
      });

      setStatus("sent");
      setStatusMessage(
        "Thank you. Our team will contact you shortly about availability and a site visit.",
      );
      setFields(EMPTY);
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
        error instanceof Error && error.message
          ? error.message
          : "We could not send your enquiry. Please try again.",
      );
      // The draft is intentionally left in place.
    }
  };

  /**
   * Site-visit booking.
   *
   * Posts to POST /api/site-visits. That endpoint creates or reuses the
   * visitor and their existing lead for this property, so booking a visit and
   * submitting the callback form would produce two interactions for one
   * visitor; the two buttons are therefore alternatives, not steps.
   *
   * `scheduled_at` is read from a `datetime-local` control, which is wall-clock
   * local time, and converted with `toISOString()` before sending. The control
   * is floored at the current local time, but that is only a convenience — the
   * backend rejects a past slot regardless, so the value is re-checked here.
   */
  const submitSiteVisit = async () => {
    // Name and phone are reported on their own fields by validate(); no
    // separate combined message is shown for them here.
    const found = validate();
    setErrors(found);

    if (found.name || found.phone) {
      // validate() has already turned the offending input red, but the booking
      // button sits at the very bottom of a long page, so an error far above the
      // fold reads as a dead button. Moving focus there is what makes it
      // obvious — and it shows nothing extra, because the field-level message
      // already says what is wrong.
      //
      // visitError is deliberately left alone: a slot error the visitor has not
      // fixed yet is still true, and clearing it here is what made this path
      // look like nothing had happened.
      const firstInvalid = found.name
        ? document.getElementById(nameId)
        : document.getElementById(phoneId);
      firstInvalid?.focus();
      setVisitStatus("idle");
      setVisitMessage("");
      return;
    }

    const chosen = fields.scheduledAt
      ? new Date(fields.scheduledAt)
      : null;
    if (!chosen || Number.isNaN(chosen.getTime())) {
      setVisitError("Please choose a preferred date and time.");
      setVisitStatus("idle");
      setVisitMessage("");
      return;
    }
    if (chosen.getTime() <= Date.now()) {
      setVisitError("Please choose a time in the future.");
      setVisitStatus("idle");
      setVisitMessage("");
      return;
    }

    setVisitError(null);
    setVisitStatus("submitting");
    setVisitMessage("");

    try {
      const booking = await bookPublicSiteVisit({
        // Required by this endpoint, so the control is only rendered when the
        // record carries a real UUID.
        property_id: property.id,
        unit_id: null,
        scheduled_at: chosen.toISOString(),
        visitor: {
          name: fields.name.trim(),
          mobile: fields.phone.trim(),
          email: null,
        },
        // The optional description doubles as visit instructions.
        notes: fields.description.trim() || null,
      });

      const when = new Date(booking.scheduled_at ?? chosen);
      const label = Number.isNaN(when.getTime())
        ? ""
        : when.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });

      setVisitStatus("sent");
      setVisitMessage(
        `Site visit requested for ${booking.property_name ?? property.name}${
          label ? ` on ${label}` : ""
        }. Our team will confirm shortly.`,
      );
      setFields(EMPTY);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      setVisitStatus("error");
      setVisitMessage(
        error instanceof Error && error.message
          ? error.message
          : "We could not book the site visit. Please try again.",
      );
      // The draft, including the chosen slot, is intentionally left in place.
    }
  };

  const share = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : `https://ilahomes.example/properties/${property.id}`;
    const payload = {
      title: property.name,
      text: `${property.name} — ${property.location}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        setShareNote("Shared");
      } catch (error) {
        // Dismissing the share sheet rejects with AbortError. That is a
        // deliberate "no", not a failure, and must not fall through to any
        // fallback.
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        setShareNote("Sharing did not complete");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Link copied");
    } catch {
      setShareNote("Copy the link from your address bar");
    }
  };

  return (
    <section className="pd-section pd-final" aria-labelledby="pd-final-title">
      <div className="pd-section__inner pd-final__inner">
        <p className="pd-kicker">Next step</p>
        <h2 id="pd-final-title">Ready to explore {property.name}?</h2>
        <p className="pd-section__lead">
          Leave your details and our team will call you back with availability.
          You can also pick a preferred slot and book a site visit directly.
        </p>

        <form className="pd-form" noValidate onSubmit={submitEnquiry}>
          <div className="pd-form__row">
            <div className="pd-form__field">
              <label className="pd-form__label" htmlFor={nameId}>
                Name
              </label>
              <input
                id={nameId}
                className="pd-form__input"
                type="text"
                name="name"
                autoComplete="name"
                value={fields.name}
                onChange={update("name")}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${nameId}-error` : undefined}
              />
              {errors.name ? (
                <p className="pd-form__error" id={`${nameId}-error`}>
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="pd-form__field">
              <label className="pd-form__label" htmlFor={phoneId}>
                Phone number
              </label>
              <input
                id={phoneId}
                className="pd-form__input"
                type="tel"
                name="phone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={fields.phone}
                onChange={update("phone")}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? `${phoneId}-error` : undefined}
              />
              {errors.phone ? (
                <p className="pd-form__error" id={`${phoneId}-error`}>
                  {errors.phone}
                </p>
              ) : null}
            </div>
          </div>

          {/* Optional, and last, so the two required fields are answered first. */}
          <div className="pd-form__field pd-form__field--wide">
            <label className="pd-form__label" htmlFor={descriptionId}>
              Description
              <span className="pd-form__hint">Optional</span>
            </label>
            <textarea
              id={descriptionId}
              className="pd-form__input pd-form__textarea"
              name="description"
              rows={3}
              placeholder="Tell us what you are looking for — plot size, facing, budget, timeline."
              value={fields.description}
              onChange={update("description")}
              aria-describedby={`${descriptionId}-hint`}
            />
            <p className="pd-form__hint" id={`${descriptionId}-hint`}>
              Anything you add helps us shortlist the right plots.
            </p>
          </div>

          {/* Visit slot, as a field of the same form rather than a separate
              block: it reuses the name and phone above, so it belongs with
              them. Only offered when a real property UUID exists. */}
          {canBookVisit ? (
            <div className="pd-form__field pd-form__field--wide">
              <label className="pd-form__label" htmlFor={visitAtId}>
                Preferred visit date &amp; time
              </label>
              <input
                id={visitAtId}
                className="pd-form__input"
                type="datetime-local"
                name="scheduledAt"
                min={minVisitAt}
                value={fields.scheduledAt}
                onChange={update("scheduledAt")}
                aria-invalid={Boolean(visitError)}
                aria-describedby={
                  visitError ? `${visitAtId}-error` : `${visitAtId}-hint`
                }
              />
              {/* Not marked "Optional" the way the description is: leaving it
                  empty is fine for a callback, but the booking button needs
                  it, so the hint states both outcomes. */}
              <p className="pd-form__hint" id={`${visitAtId}-hint`}>
                Pick a slot to book a visit, or leave it empty and we will call
                you back. Your local time, confirmed by phone.
              </p>
              {visitError ? (
                <p className="pd-form__error" id={`${visitAtId}-error`}>
                  {visitError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="pd-form__submit">
            <button
              type="submit"
              className="pd-btn pd-btn--primary"
              // Disabled while in flight so a slow or double-tap submission
              // cannot create two leads.
              disabled={status === "submitting"}
              aria-busy={status === "submitting"}
            >
              {status === "submitting"
                ? "Sending…"
                : status === "sent"
                  ? "Enquiry sent"
                  : "Request a callback"}
            </button>

            {/*
              Booking is an alternative to the callback, not an extra step: the
              endpoint creates or reuses the visitor's lead for this property, so
              doing both would produce two interactions for one visitor. Only
              rendered for a real property UUID, because the endpoint requires
              property_id and cannot omit it.
            */}
            {canBookVisit ? (
              <button
                type="button"
                className="pd-btn pd-btn--ghost"
                onClick={() => void submitSiteVisit()}
                disabled={visitStatus === "submitting"}
                aria-busy={visitStatus === "submitting"}
              >
                {visitStatus === "submitting"
                  ? "Booking…"
                  : visitStatus === "sent"
                    ? "Visit requested"
                    : "Schedule site visit"}
              </button>
            ) : null}
          </div>

          {statusMessage ? (
            <p
              className={`pd-form__status pd-form__status--${status}`}
              role="status"
            >
              {statusMessage}
            </p>
          ) : null}

          {visitMessage ? (
            <p
              className={`pd-form__status pd-form__status--${visitStatus}`}
              role="status"
            >
              {visitMessage}
            </p>
          ) : null}
        </form>

        <div className="pd-final__toggles">
          <button
            type="button"
            className={`pd-chip${wishlist ? " is-active" : ""}`}
            aria-pressed={wishlist}
            onClick={() => toggle("wishlist")}
            data-track="PROPERTY_FAVORITE"
            data-track-property={property.id}
            data-track-meta={`{"action":"${wishlist ? "remove" : "add"}","button_location":"property_final_cta"}`}
          >
            {wishlist ? "In wishlist" : "Save to wishlist"}
          </button>
          <button
            type="button"
            className="pd-chip"
            onClick={() => void share()}
            data-track="PROPERTY_SHARE"
            data-track-property={property.id}
            data-track-meta='{"button_location":"property_final_cta"}'
          >
            Share property
          </button>
        </div>
        {shareNote ? (
          <p className="pd-final__share-note" aria-live="polite">
            {shareNote}
          </p>
        ) : null}

        {property.testimonial ? (
          <blockquote className="pd-final__quote">
            <p>“{property.testimonial.quote}”</p>
            <footer>
              {property.testimonial.author} · {property.testimonial.role}
            </footer>
          </blockquote>
        ) : null}
      </div>
    </section>
  );
}