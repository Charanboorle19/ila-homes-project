"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PropertyRecord } from "@/data/properties";
import { whatsappUrl } from "@/lib/propertyUtils";

/** Gap left between the bar and the content it would otherwise cover. */
const CLEARANCE_GAP_PX = 12;

/**
 * Dismissal is remembered for the browsing session, not forever. Someone who
 * sent the bar away should not have it follow them down the rest of the page,
 * or reappear on the next property they open — but a first-time visitor on
 * their next visit should still meet the site-visit CTA.
 */
const DISMISSED_KEY = "ila:sticky-cta-dismissed";

type StickyBottomCtaProps = {
  property: PropertyRecord;
  heroRef: RefObject<HTMLElement | null>;
  /** The enquiry form this bar duplicates. */
  formRef: RefObject<HTMLElement | null>;
  siteVisitHref: string;
};

export default function StickyBottomCta({
  property,
  heroRef,
  formRef,
  siteVisitHref,
}: StickyBottomCtaProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [formOnScreen, setFormOnScreen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Read once on mount. There is deliberately no reset on `property.id`: the
  // dismissal is remembered, so reopening another property is not a reason to
  // put the bar back.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(DISMISSED_KEY) === "1") setDismissed(true);
    } catch {
      // Storage blocked or unavailable: dismissal simply lasts this mount.
    }
  }, []);

  /**
   * The bar gets out of the way of the form entirely.
   *
   * With a field focused on a phone, the on-screen keyboard and this fixed bar
   * stack on top of each other at the bottom of the viewport, and the field
   * being typed into is sandwiched between them. Nothing the bar publishes can
   * fix that — clearance reserves space below the form, but the bar is still
   * painted over the thing being edited. So it leaves.
   */
  useEffect(() => {
    const isFormField = (node: EventTarget | null) =>
      node instanceof HTMLElement &&
      node.closest("input, textarea, select") !== null;

    const onFocusIn = (event: FocusEvent) => {
      if (isFormField(event.target)) setFieldFocused(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!isFormField(event.relatedTarget)) setFieldFocused(false);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Storage unavailable; dismissal still holds for this mount.
    }
  }

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.12 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef, property.id]);

  /**
   * The bar carries the same two actions as the enquiry form further down, so
   * showing both at once is a duplicate — and the bar is the one painted on
   * top. It steps aside while the form is anywhere in the viewport and comes
   * back once it has scrolled away.
   */
  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setFormOnScreen(entry.isIntersecting),
      { threshold: 0 },
    );

    observer.observe(form);
    return () => observer.disconnect();
  }, [formRef, property.id]);

  /**
   * Publishes the bar's measured height for the page to reserve.
   *
   * The bar is fixed, so it is taken out of flow and overlays whatever sits at
   * the bottom of the page. The final CTA section is the last content on the
   * page, which is exactly where the enquiry form's buttons are, so without a
   * matching bottom padding the bar paints over them and swallows their clicks.
   *
   * The height is measured rather than hard-coded because it genuinely varies:
   * the safe-area inset adds height on notched devices, and the action labels
   * change with state. A constant would silently stop clearing the bar.
   *
   * Removing the property on cleanup is what makes dismissal work: once the bar
   * is gone the variable falls back to 0 and the reserved space collapses.
   *
   * Every condition that can hide the bar has to be in this dependency list.
   * When one of them unmounts the bar, cleanup removes the clearance — and
   * without the dependency this effect never re-runs, so the bar comes back on
   * a page with no reserved space and sits on top of the content it was
   * measuring clearance for.
   */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      document.documentElement.style.removeProperty("--pd-sticky-clearance");
      return undefined;
    }

    const publish = () => {
      const height = bar.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--pd-sticky-clearance",
        `${Math.ceil(height + CLEARANCE_GAP_PX)}px`,
      );
    };

    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--pd-sticky-clearance");
    };
  }, [dismissed, visible, fieldFocused, formOnScreen]);

  if (dismissed || !visible || fieldFocused || formOnScreen) return null;

  const waText = `Hi ILA Homes, please help me schedule a site visit for ${property.name} (${property.location}).`;

  return (
    <div
      className="pd-sticky"
      ref={barRef}
      role="region"
      aria-label="Site visit shortcut"
    >
      <div className="pd-sticky__inner">
        <div className="pd-sticky__actions">
          <a
            className="pd-btn pd-btn--primary"
            href={whatsappUrl(waText)}
            target="_blank"
            rel="noreferrer"
            data-track="WHATSAPP_CHAT_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"sticky_bottom_cta"}'
          >
            WhatsApp
          </a>
          <a
            className="pd-btn pd-btn--ghost"
            href={siteVisitHref}
            data-track="ENQUIRY_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"sticky_bottom_cta","channel":"email"}'
          >
            Schedule site visit
          </a>
          <button
            type="button"
            className="pd-sticky__close"
            aria-label="Dismiss sticky bar"
            onClick={dismiss}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
