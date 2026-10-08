"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import ApiPropertyView from "@/components/PropertyDetail/ApiPropertyView";
import { fetchSharePropertyId } from "@/services/shareService";

/**
 * Tracked share landing route: `/property/{tracking_token}/view`.
 *
 * A share is a reference to a property, not a property. This route resolves
 * the tracking token to a property id and then renders the existing
 * `ApiPropertyView`, which loads the property through the existing
 * `GET /api/properties/{id}` and renders the shared `PropertyPageView`
 * template.
 *
 * Reusing `ApiPropertyView` is deliberate: it owns the property request,
 * documents and Buyer Fit, and every detail section below it reads from the
 * same `PropertyRecord`. Nothing here formats property data, and no detail
 * component is duplicated or forked, so the tracked page cannot drift from
 * `/properties/{propertyId}` in layout, typography, imagery, sections, CTAs,
 * or responsive behaviour — the only difference is which URL resolved the
 * property.
 */

type PageProps = {
  params: Promise<{ trackingToken: string }>;
};

export default function SharedPropertyViewPage({ params }: PageProps) {
  const { trackingToken } = use(params);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    fetchSharePropertyId(trackingToken, controller.signal)
      .then((id) => {
        if (controller.signal.aborted) return;
        setPropertyId(id);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[share] tracking token did not resolve", error);
        setState("error");
      });

    return () => controller.abort();
  }, [trackingToken]);

  if (state === "loading") {
    return (
      <div
        className="property-page flex min-h-[70vh] items-center justify-center"
        style={{ paddingTop: "calc(var(--nav-h) + 2rem)" }}
      >
        <p className="text-sm text-[#5c5852]" role="status">
          Loading property…
        </p>
      </div>
    );
  }

  // Same wording and recovery affordance as ApiPropertyView's unavailable state,
  // so a dead share link looks like every other failed property load.
  if (state === "error" || !propertyId) {
    return (
      <div
        className="property-page"
        style={{ paddingTop: "calc(var(--nav-h) + 2rem)" }}
      >
        <div className="pd-section">
          <div className="pd-section__inner">
            <p className="pd-kicker">Not found</p>
            <h1 style={{ margin: 0, fontSize: "clamp(1.6rem, 3.4vw, 2.2rem)" }}>
              Property unavailable
            </h1>
            <p className="pd-section__lead">
              This share link is no longer valid. Browse our current
              developments to find a property.
            </p>
            <Link
              href="/properties"
              className="mt-6 inline-flex rounded-full bg-[#0f1114] px-5 py-3 text-[11px] font-semibold tracking-[0.12em] text-white uppercase"
            >
              ← Back to properties
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // From here the page is the standard property detail experience.
  return <ApiPropertyView id={propertyId} />;
}