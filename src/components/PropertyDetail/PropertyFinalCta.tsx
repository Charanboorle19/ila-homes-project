"use client";

import { useEffect, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import { siteVisitMailto, whatsappUrl } from "@/lib/propertyUtils";

function storageKey(kind: "wishlist" | "interested", id: string) {
  return `ila-${kind}-${id}`;
}

export default function PropertyFinalCta({
  property,
}: {
  property: PropertyRecord;
}) {
  const [wishlist, setWishlist] = useState(false);
  const [interested, setInterested] = useState(false);
  const [shareNote, setShareNote] = useState("");

  useEffect(() => {
    try {
      setWishlist(localStorage.getItem(storageKey("wishlist", property.id)) === "1");
      setInterested(
        localStorage.getItem(storageKey("interested", property.id)) === "1",
      );
    } catch {
      // ignore
    }
  }, [property.id]);

  const toggle = (kind: "wishlist" | "interested") => {
    const next = kind === "wishlist" ? !wishlist : !interested;
    if (kind === "wishlist") setWishlist(next);
    else setInterested(next);
    try {
      localStorage.setItem(storageKey(kind, property.id), next ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const waText = `Hi ILA Homes, I'm interested in ${property.name} at ${property.location}. Please share next steps.`;
  const visitText = `I'd like a site visit for ${property.name} (${property.location}).`;

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
        // deliberate "no", not a failure. It must not fall through to any
        // fallback, or cancelling the sheet launches the fallback instead.
        if ((error as { name?: string } | null)?.name === "AbortError") return;
        setShareNote("Sharing did not complete");
      }
      return;
    }

    // No Web Share API: offer the link on the clipboard. This deliberately
    // never opens a chat app — the page does not get to choose where a visitor
    // takes their link, and silently launching WhatsApp turned "Share property"
    // into an unsolicited chat on every clipboard failure.
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
          Enquire on WhatsApp, book a visit, or save this property for later.
        </p>

        <div className="pd-final__actions">
          <a
            className="pd-btn pd-btn--primary"
            href={whatsappUrl(waText)}
            target="_blank"
            rel="noreferrer"
            data-track="WHATSAPP_CHAT_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"property_final_cta_whatsapp"}'
          >
            WhatsApp enquiry
          </a>
          <a
            className="pd-btn pd-btn--ghost"
            href={whatsappUrl(visitText)}
            target="_blank"
            rel="noreferrer"
            data-track="ENQUIRY_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"property_final_cta_site_visit","channel":"whatsapp"}'
          >
            WhatsApp site visit
          </a>
          <a
            className="pd-btn pd-btn--ghost"
            href={siteVisitMailto(property)}
            data-track="ENQUIRY_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"property_final_cta_site_visit","channel":"email"}'
          >
            Email site visit
          </a>
        </div>

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
            className={`pd-chip${interested ? " is-active" : ""}`}
            aria-pressed={interested}
            onClick={() => toggle("interested")}
            data-track="PROPERTY_FAVORITE"
            data-track-property={property.id}
            data-track-meta={`{"action":"${interested ? "remove" : "add"}","button_location":"property_final_cta_interested"}`}
          >
            {interested ? "Marked interested" : "I'm interested"}
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
