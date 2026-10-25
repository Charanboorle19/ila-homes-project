"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import type { PropertyRecord } from "@/data/properties";
import { isPropertyUuid } from "@/services/propertiesService";
import {
  createPublicLead,
  LEAD_ERROR_CODES,
} from "@/services/leadsService";
import { bookPublicSiteVisit } from "@/services/siteVisitsService";
import { ApiError } from "@/services/apiClient";
import {
  whatsappUrl,
  DEFAULT_WHATSAPP_PHONE,
  propertyDetailPath,
} from "@/lib/propertyUtils";

function storageKey(kind: "wishlist", id: string) {
  return `ila-${kind}-${id}`;
}

/** The country code, shown as a fixed chip in the field and never typed. */
const PHONE_PREFIX = "+91";
const LOCAL_DIGITS = 10;

/**
 * The +91 lives in the field as a fixed chip, so what the visitor types is the
 * local number only: exactly ten digits. A paste of a full number is unwrapped
 * rather than truncated, because the first ten characters of "+91 98765 43210"
 * are the country code.
 */
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

/** Puts the country code back on, so the lead stores what the field showed. */
function toStoredPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length > LOCAL_DIGITS && digits.startsWith("91")) {
    return `+${digits}`;
  }
  return `${PHONE_PREFIX}${digits}`;
}

type EnquiryFields = {
  name: string;
  phone: string;
  description: string;
  /** Local `datetime-local` value, e.g. "2026-10-15T10:30". */
  scheduledAt: string;
};

type EnquiryErrors = Partial<Record<keyof EnquiryFields, string>>;

const DEFAULT_PROPERTY_MESSAGE =
  "Hi, I'm interested in learning more about this property. Could you please share the details?";

const EMPTY: EnquiryFields = {
  name: "",
  phone: "",
  description: DEFAULT_PROPERTY_MESSAGE,
  scheduledAt: "",
};

/**
 * A quote too short to be one is a placeholder, not a quotation — and the API
 * mapper hands every property `{ quote: "", author: "", role: "" }`, so a
 * present object is no evidence there is anything to show. All three fields
 * have to carry something, and the quote has to be long enough to read as one.
 */
const MIN_QUOTE_LENGTH = 20;

/**
 * Site visit slots.
 *
 * `datetime-local` renders differently on every phone, asks for a date and a
 * time in one control, and its picker is slow to fill in with a thumb. Two chip
 * rows — a day, then a part of day — is quicker and cannot produce a
 * half-typed date.
 */
const DAYS_OFFERED = 6;

const VISIT_SLOTS = [
  { id: "morning", label: "Morning", time: "10:00" },
  { id: "afternoon", label: "Afternoon", time: "14:00" },
  { id: "evening", label: "Evening", time: "18:00" },
] as const;

type VisitSlot = (typeof VISIT_SLOTS)[number];

type VisitDay = {
  /** Local `YYYY-MM-DD` — the same shape the native input held. */
  iso: string;
  weekday: string;
  day: string;
};

/**
 * The next `count` days in the visitor's own timezone, today included.
 *
 * Each date is built from local parts and read back with the local `Date`
 * constructor, so it never slips across a day boundary the way `toISOString`
 * would for anyone whose local midnight is not UTC midnight. That matters
 * because the first chip carries today's date and nothing before it.
 */
function upcomingDays(count: number): VisitDay[] {
  const base = new Date();
  const days: VisitDay[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offset,
    );
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    days.push({
      iso,
      weekday:
        offset === 0
          ? "Today"
          : date.toLocaleDateString(undefined, { weekday: "short" }),
      day: String(date.getDate()),
    });
  }

  return days;
}

/**
 * "Wed 16 Oct, Afternoon" — the slot the visitor picked. Captured before the
 * draft is cleared on success, so the confirmation can name the slot after the
 * field that held it is gone.
 */
function formatSlot(value: string, days: VisitDay[]): string {
  const iso = value.slice(0, 10);
  const slot = VISIT_SLOTS.find((entry) => entry.time === value.slice(11, 16));
  const day = days.find((entry) => entry.iso === iso);
  if (!iso || !slot || !day) return "";

  const date = new Date(`${iso}T00:00`);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })}, ${slot.label}`;
}

export default function PropertyFinalCta({
  property,
  formRef,
}: {
  property: PropertyRecord;
  /** Observed by the sticky bar so it can stand aside while this is on screen. */
  formRef?: RefObject<HTMLElement | null>;
}) {
  const [wishlist, setWishlist] = useState(false);
  /** Confirmation line for the wishlist and share actions. */
  const [toast, setToast] = useState("");
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
  /** The booked slot, kept for the confirmation after the draft is cleared. */
  const [confirmedSlot, setConfirmedSlot] = useState("");
  const visitRef = useRef<HTMLDivElement>(null);

  const nameId = useId();
  const phoneId = useId();
  const descriptionId = useId();
  const visitAtId = useId();

  // A site visit can only be booked against a real property UUID, and unlike a
  // lead the endpoint requires that id. Catalogue records carry slugs, so they
  // get the callback path only.
  const canBookVisit = isPropertyUuid(property.id);

  /**
   * Built once per mount. `scheduledAt` stays the single source of truth for
   * the booking, so the two chip rows only ever rewrite its date or time half
   * rather than keeping a second selection state that could disagree with it.
   */
  const visitDays = useMemo(() => upcomingDays(DAYS_OFFERED), []);
  const selectedDay = fields.scheduledAt.slice(0, 10);
  const selectedTime = fields.scheduledAt.slice(11, 16);

  function setScheduled(value: string) {
    setFields((current) => ({ ...current, scheduledAt: value }));
    // Same courtesy as the other fields: a corrected choice should not have to
    // be submitted again to clear the complaint it was rejected for.
    setVisitError(null);
    setVisitStatus("idle");
    setVisitMessage("");
  }

  function selectDay(iso: string) {
    const time = selectedTime || VISIT_SLOTS[0].time;
    setScheduled(`${iso}T${time}`);
  }

  function selectSlot(slot: VisitSlot) {
    const day = selectedDay || visitDays[0]?.iso;
    if (!day) return;
    setScheduled(`${day}T${slot.time}`);
  }

  /** Today only — a later day's slot is never in the past. */
  function slotHasPassed(slot: VisitSlot): boolean {
    const day = selectedDay || visitDays[0]?.iso;
    if (!day || day !== visitDays[0]?.iso) return false;
    return new Date(`${day}T${slot.time}`).getTime() <= Date.now();
  }

  /**
   * The two buttons are alternatives, but they are separate endpoints and
   * separate status. Without one shared lock a visitor can tap "Request a
   * callback" and then "Schedule site visit" before the first one resolves,
   * and both endpoints will happily create a second interaction for the same
   * person. So both buttons read one flag.
   */
  const busy = status === "submitting" || visitStatus === "submitting";
  const sent = status === "sent" || visitStatus === "sent";

  const testimonial = property.testimonial;
  const hasTestimonial =
    testimonial.quote.trim().length >= MIN_QUOTE_LENGTH &&
    testimonial.author.trim().length > 0 &&
    testimonial.role.trim().length > 0;

  /**
   * Booking without a slot has nothing to send. Rather than leave a button that
   * silently does nothing, it says why and takes the visitor to the control —
   * which teaches them what it was for.
   */
  function requestVisit() {
    if (!fields.scheduledAt) {
      setVisitError("Pick a slot above to choose a date and time.");
      visitRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      return;
    }
    void submitSiteVisit();
  }

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
    setToast(next ? "Saved to wishlist" : "Removed from wishlist");
    try {
      localStorage.setItem(storageKey(kind, property.id), next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  /** A toast is a moment, not a log line — it clears itself. */
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  /** Digits only, capped at ten, so the field can never hold the country code. */
  const updatePhone = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = updatePhoneValue(event.target.value);
    setFields((current) => ({ ...current, phone: value }));
    setErrors((current) =>
      current.phone ? { ...current, phone: undefined } : current,
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
      next.phone = `Enter a ${LOCAL_DIGITS}-digit phone number.`;
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
      const submittedName = fields.name.trim();
      const submittedPhone = toStoredPhone(fields.phone);
      const submittedNotes = fields.description.trim();
      const submittedSlot = fields.scheduledAt;

      await createPublicLead({
        name: submittedName,
        mobile: submittedPhone,
        // Optional fields are sent as null rather than empty strings.
        email: null,
        message: submittedNotes || null,
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
      setConfirmedSlot(formatSlot(submittedSlot, visitDays));
      setFields(EMPTY);

      // Redirect to WhatsApp with enquiry details
      if (typeof window !== "undefined") {
        const text = submittedNotes || DEFAULT_PROPERTY_MESSAGE;
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
   * `scheduled_at` is assembled from a chip pair into the same local
   * `YYYY-MM-DDTHH:MM` string the native control used. That form is wall-clock
   * local time per the ES spec, so `toISOString()` converts it correctly. The
   * chips start at today and past slots on today are disabled, but the backend
   * rejects a past slot regardless, so the value is re-checked here.
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
      const submittedName = fields.name.trim();
      const submittedPhone = toStoredPhone(fields.phone);
      const submittedNotes = fields.description.trim();
      const submittedSlot = fields.scheduledAt;

      const booking = await bookPublicSiteVisit({
        // Required by this endpoint, so the control is only rendered when the
        // record carries a real UUID.
        property_id: property.id,
        unit_id: null,
        scheduled_at: chosen.toISOString(),
        visitor: {
          name: submittedName,
          mobile: submittedPhone,
          email: null,
        },
        // The optional description doubles as visit instructions.
        notes: submittedNotes || null,
      });

      const when = new Date(booking.scheduled_at ?? chosen);
      const label = Number.isNaN(when.getTime())
        ? ""
        : when.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });

      const slotText = formatSlot(submittedSlot, visitDays) || label || "";
      setVisitStatus("sent");
      setConfirmedSlot(slotText);
      setFields(EMPTY);

      // Redirect to WhatsApp with site-visit booking details
      if (typeof window !== "undefined") {
        const text = `Hi ILA Homes, my name is ${submittedName} (${submittedPhone}). I have booked a site visit for ${property.name} (${property.location}) on ${slotText}.${submittedNotes ? ` Note: ${submittedNotes}` : ""}`;
        const targetUrl = whatsappUrl(text, DEFAULT_WHATSAPP_PHONE);
        window.location.href = targetUrl;
      }
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
        : `https://ilahomes.example${propertyDetailPath(property)}`;
    const payload = {
      title: property.name,
      text: `${property.name} — ${property.location}`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(payload);
        setToast("Shared");
      } catch (error) {
        // Dismissing the share sheet rejects with AbortError. That is a
        // deliberate "no", not a failure, and must not fall through to any
        // fallback.
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        setToast("Sharing did not complete");
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast("Copy the link from your address bar");
    }
  };

  return (
    <section
      id="next-step"
      className="pd-section pd-final"
      ref={formRef}
      aria-labelledby="pd-final-title"
    >
      <div className="pd-section__inner pd-final__inner">
        <div className="pd-final__copy">
          <p className="pd-kicker">Next step</p>
          {/* The property name is already in the hero and on every card above;
              carrying it here too wrapped the heading to three lines. */}
          <h2 id="pd-final-title">Ready to visit this plot?</h2>
          <p className="pd-section__lead">
            Leave your details and our team will call you back with
            availability. You can also pick a preferred slot and book a site
            visit directly.
          </p>

          {/*
            Illustration for the desktop layout only — see `.pd-final__art`,
            which is hidden until the copy column sits beside the form. It is
            decorative: the heading above carries the meaning, and nothing in
            the artwork is text a screen reader would be missing.
          */}
          <div className="pd-final__art" aria-hidden="true">
            <Image
              src="/assets/Call%20center.gif"
              alt=""
              fill
              sizes="(min-width: 1100px) 22rem"
              unoptimized
            />
          </div>
        </div>

        <div className="pd-final__aside">
          <form className="pd-form" noValidate onSubmit={submitEnquiry}>
            <div className="pd-form__row">
              <div className="pd-form__field">
                <label className="pd-form__label" htmlFor={nameId}>
                  Name
                </label>
                {/*
                  `required` carries the requirement to assistive tech; the form
                  is `noValidate`, so the browser's own bubble never appears and
                  the message below is the one that is read. Both are needed —
                  the attribute alone never reaches a screen reader as a prompt.
                */}
                <input
                  id={nameId}
                  className="pd-form__input"
                  type="text"
                  name="name"
                  autoComplete="name"
                  required
                  aria-required="true"
                  value={fields.name}
                  onChange={update("name")}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name ? (
                  <p
                    className="pd-form__error"
                    id={`${nameId}-error`}
                    aria-live="polite"
                  >
                    {errors.name}
                  </p>
                ) : null}
              </div>

              <div className="pd-form__field">
                <label className="pd-form__label" htmlFor={phoneId}>
                  Phone number
                </label>
                {/*
                  The +91 is a chip in the field rather than part of the
                  placeholder. A placeholder showing a prefix invites it being
                  typed, which is how the country code ends up in the number
                  twice. The visitor types ten digits; `toStoredPhone` puts the
                  code back on when the lead is posted.

                  `tel-national` rather than `tel`: the country code is already
                  fixed here, so autofill should fill the national number and not
                  push a full +91 number into a ten-digit field.
                */}
                <div
                  className={`pd-form__phone${
                    errors.phone ? " is-invalid" : ""
                  }`}
                >
                  <span className="pd-form__phone-prefix" aria-hidden="true">
                    {PHONE_PREFIX}
                  </span>
                  <input
                    id={phoneId}
                    className="pd-form__input pd-form__phone-input"
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
                    className="pd-form__error"
                    id={`${phoneId}-error`}
                    aria-live="polite"
                  >
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
                {/* A group of buttons, not a form control, so this is a span and
                    the label relationship is carried by aria-labelledby. */}
                <span className="pd-form__label" id={`${visitAtId}-label`}>
                  Preferred visit slot
                  {/* Marked optional because it is: a callback needs neither a
                      day nor a slot, and a field that only looks required is one
                      more reason to put the form down. */}
                  <span className="pd-form__hint">Optional</span>
                </span>

                <div
                  className="pd-visit"
                  ref={visitRef}
                  role="group"
                  aria-labelledby={`${visitAtId}-label`}
                  aria-describedby={`${visitAtId}-hint`}
                >
                  <div className="pd-visit__row">
                    {visitDays.map((day) => (
                      <button
                        key={day.iso}
                        type="button"
                        className={`pd-visit__chip pd-visit__chip--day${
                          selectedDay === day.iso ? " is-on" : ""
                        }`}
                        aria-pressed={selectedDay === day.iso}
                        onClick={() => selectDay(day.iso)}
                      >
                        <span className="pd-visit__weekday">{day.weekday}</span>
                        <span className="pd-visit__numeral">{day.day}</span>
                      </button>
                    ))}
                  </div>

                  {/*
                    A full calendar alongside the quick chips. The six offered
                    days cover the coming week; the date control takes any later
                    day with it, so the choice is limited by when a visit is
                    possible rather than by what the row showed. It rewrites the
                    date half of `scheduledAt` through the same `selectDay` the
                    chips use, keeping the picked time.
                  */}
                  <div className="pd-visit__row pd-visit__row--date">
                    <label
                      className="pd-visit__date-label"
                      htmlFor={`${visitAtId}-date`}
                    >
                      Or pick a date
                      <span className="pd-form__hint">Optional</span>
                    </label>
                    <input
                      id={`${visitAtId}-date`}
                      className="pd-visit__date"
                      type="date"
                      value={selectedDay}
                      min={visitDays[0]?.iso}
                      onChange={(event) => {
                        if (event.target.value) selectDay(event.target.value);
                      }}
                    />
                  </div>

                  <div className="pd-visit__row pd-visit__row--slots">
                    {VISIT_SLOTS.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`pd-visit__chip pd-visit__chip--slot${
                          selectedTime === slot.time ? " is-on" : ""
                        }`}
                        aria-pressed={selectedTime === slot.time}
                        disabled={slotHasPassed(slot)}
                        onClick={() => selectSlot(slot)}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                </div>

                <p
                  className="pd-form__hint pd-form__hint--visit"
                  id={`${visitAtId}-hint`}
                >
                  Pick a slot to book a visit, or leave it empty and we&rsquo;ll
                  call you back.
                </p>
                {visitError ? (
                  <p
                    className="pd-form__error"
                    id={`${visitAtId}-error`}
                    aria-live="polite"
                  >
                    {visitError}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="pd-form__submit">
              {/*
                DOM order, not visual order. Someone tabbing through the form has
                filled every field by the time they reach the buttons, so the
                primary action should be the last stop rather than the first.
                `.pd-form__submit .pd-btn--primary { order: -1 }` puts it back on
                top visually. Within a two-button group the one upward step is a
                fair trade for landing on "Request a callback".
              */}

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
                  onClick={requestVisit}
                  disabled={busy || sent}
                  aria-busy={visitStatus === "submitting"}
                >
                  {visitStatus === "submitting" ? (
                    <>
                      <span className="ila-loader" aria-hidden />
                      Booking…
                    </>
                  ) : visitStatus === "sent" ? (
                    "Booked"
                  ) : (
                    "Schedule site visit"
                  )}
                </button>
              ) : null}

              <button
                type="submit"
                className="pd-btn pd-btn--primary"
                disabled={busy || sent}
                aria-busy={status === "submitting"}
              >
                {status === "submitting" ? (
                  <>
                    <span className="ila-loader" aria-hidden />
                    Sending…
                  </>
                ) : status === "sent" ? (
                  "Sent"
                ) : (
                  "Request a callback"
                )}
              </button>
            </div>

            <p className="pd-form__privacy">
              We&rsquo;ll only use your number to contact you about this property.
            </p>

            {sent ? (
              <div className="pd-form__done" role="status">
                <span className="pd-form__done-mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="pd-form__done-copy">
                  <span className="pd-form__done-title">
                    Thanks, we&rsquo;ll call you shortly
                  </span>
                  {confirmedSlot ? (
                    <span className="pd-form__done-slot">
                      Site visit: {confirmedSlot}
                    </span>
                  ) : null}
                </span>
              </div>
            ) : null}

            {/* Errors only. Success is the confirmation above, so a second line
                of prose under it would just repeat the same news. */}
            {status === "error" && statusMessage ? (
              <p className="pd-form__status pd-form__status--error" role="alert">
                {statusMessage}
              </p>
            ) : null}

            {visitStatus === "error" && visitMessage ? (
              <p
                className="pd-form__status pd-form__status--error"
                role="alert"
              >
                {visitMessage}
              </p>
            ) : null}
          </form>

            {/*
              Not part of the form. Saving and sharing are different actions from
              asking for a callback, and sitting in the form's button row made all
              three read as one submission. Both are icon buttons here, so the only
              text on screen in this row is whatever the toast is saying.
            */}
            <div className="pd-final__actions">
              <button
                type="button"
                className={`pd-final__icon-btn${wishlist ? " is-on" : ""}`}
                aria-pressed={wishlist}
                aria-label={
                  wishlist ? "Remove from wishlist" : "Save to wishlist"
                }
                onClick={() => toggle("wishlist")}
                data-track="PROPERTY_FAVORITE"
                data-track-property={property.id}
                data-track-meta={`{"action":"${wishlist ? "remove" : "add"}","button_location":"property_final_cta"}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>

              <button
                type="button"
                className="pd-final__icon-btn"
                aria-label="Share this property"
                onClick={() => void share()}
                data-track="PROPERTY_SHARE"
                data-track-property={property.id}
                data-track-meta='{"button_location":"property_final_cta"}'
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <path d="M16 6l-4-4-4 4" />
                  <path d="M12 2v13" />
                </svg>
              </button>
            </div>

            {toast ? (
              <p className="pd-final__toast" role="status" aria-live="polite">
                {toast}
              </p>
            ) : null}

            {/* No quote mark glyphs: the gold bar and the italic carry it, and
                literal quotation marks on top of those read as decoration. */}
            {hasTestimonial ? (
              <blockquote className="pd-final__quote">
                <p>{testimonial.quote}</p>
                <footer>
                  <span className="pd-final__quote-author">
                    {testimonial.author}
                  </span>
                  <span className="pd-final__quote-role">{testimonial.role}</span>
                </footer>
              </blockquote>
            ) : null}
        </div>
      </div>
    </section>
  );
}