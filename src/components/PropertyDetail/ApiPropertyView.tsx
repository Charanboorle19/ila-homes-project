"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PropertyPageView from "@/components/PropertyDetail/PropertyPageView";
import type { PropertyRecord } from "@/data/properties";
import {
  fetchPropertyById,
  fetchPropertyDocuments,
  fetchPropertyLifeStageFit,
  isPropertyUuid,
  type ApiProperty,
} from "@/services/propertiesService";
import {
  apiDocumentsToRecords,
  apiPropertyToRecord,
  type LifeStageSource,
} from "@/services/propertyMapper";
import { useTrackPropertyView } from "@/services/analytics/usePropertyView";

/**
 * Detail view for properties served by the API.
 *
 * The existing /properties/[propertyId] page resolves against local static
 * data, so API properties (UUID ids) have no local record. This fetches from
 * GET /api/properties/{id} and renders the same PropertyPageView template, so
 * the design matches /properties/{slug} exactly.
 *
 * GET /api/properties/{id}/life-stage-fit is fetched separately and never
 * blocks the page: the property renders as soon as it arrives, and the buyer-fit
 * section fills in when (or if) the scores do.
 */

export default function ApiPropertyView({ id }: { id: string }) {
  const [property, setProperty] = useState<ApiProperty | null>(null);
  const [lifeStage, setLifeStage] = useState<LifeStageSource>({
    status: "pending",
  });
  const [documents, setDocuments] = useState<
    { status: "loading" | "ready" | "error"; items: ReturnType<typeof apiDocumentsToRecords> }
  >({ status: "loading", items: [] });
  const [state, setState] = useState<"loading" | "ready" | "error">(
    isPropertyUuid(id) ? "loading" : "error",
  );

  useTrackPropertyView(isPropertyUuid(id) ? id : undefined);

  useEffect(() => {
    if (!isPropertyUuid(id)) return;

    const controller = new AbortController();

    fetchPropertyById(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setProperty(result);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] fetch failed", error);
        setState("error");
      });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!isPropertyUuid(id)) return;

    const controller = new AbortController();

    fetchPropertyDocuments(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setDocuments({
          status: "ready",
          items: apiDocumentsToRecords(result.items),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] documents fetch failed", error);
        setDocuments({ status: "error", items: [] });
      });

    return () => controller.abort();
  }, [id]);

  // Buyer fit. Independent of the property request, so a failure here leaves
  // the rest of the page intact. A failure is reported as "unavailable" rather
  // than left pending, so the section never sits on a spinner forever.
  useEffect(() => {
    if (!isPropertyUuid(id)) return;

    const controller = new AbortController();

    fetchPropertyLifeStageFit(id, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setLifeStage({ status: "ready", fit: result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] life-stage-fit failed", error);
        setLifeStage({ status: "unavailable" });
      });

    return () => controller.abort();
  }, [id]);

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

  if (state === "error" || !property) {
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
              We could not load this property right now. It may have been
              archived, or the link may be incorrect.
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

  // Render the shared property template with API data mapped into its shape.
  const record = apiPropertyToRecord(property, lifeStage, documents.items) as PropertyRecord;

  return <PropertyPageView property={record} documentsState={documents.status} />;
}