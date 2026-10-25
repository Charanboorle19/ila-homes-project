"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PropertyPageView from "@/components/PropertyDetail/PropertyPageView";
import {
  fetchPropertyById,
  fetchPropertyDocuments,
  fetchPropertyLifeStageFit,
  fetchPropertyMedia,
  isPropertyUuid,
  resolvePropertyId,
  type ApiProperty,
  type ApiPropertyMediaItem,
} from "@/services/propertiesService";
import {
  apiDocumentsToRecords,
  apiPropertyToRecord,
  type LifeStageSource,
} from "@/services/propertyMapper";
import { propertyDetailPath } from "@/lib/propertyUtils";
import { useTrackPropertyView } from "@/services/analytics/usePropertyView";

/**
 * Detail view for properties served by the API.
 *
 * The route param may be a public name slug (`/properties/sark-green`) or a
 * legacy UUID. Detail/documents/media APIs still need the UUID, so a slug is
 * resolved through the catalogue first. When a UUID deep link loads a property
 * that has a slug, the address bar is rewritten to the slug without remounting.
 */

export default function ApiPropertyView({ id }: { id: string }) {
  const [resolvedId, setResolvedId] = useState<string | null>(
    isPropertyUuid(id) ? id : null,
  );
  const [property, setProperty] = useState<ApiProperty | null>(null);
  const [media, setMedia] = useState<ApiPropertyMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [lifeStage, setLifeStage] = useState<LifeStageSource>({
    status: "pending",
  });
  const [documents, setDocuments] = useState<{
    status: "loading" | "ready" | "error";
    items: ReturnType<typeof apiDocumentsToRecords>;
  }>({ status: "loading", items: [] });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useTrackPropertyView(resolvedId ?? undefined);

  // Resolve slug → UUID (or accept a UUID as-is).
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setProperty(null);
    setResolvedId(isPropertyUuid(id) ? id : null);

    resolvePropertyId(id, controller.signal)
      .then((uuid) => {
        if (controller.signal.aborted) return;
        if (!uuid) {
          setState("error");
          return;
        }
        setResolvedId(uuid);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] slug resolve failed", error);
        setState("error");
      });

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!resolvedId) return;

    const controller = new AbortController();

    fetchPropertyById(resolvedId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        console.log(
          "=== [TOP SECTION API RESPONSE] GET /api/properties/{id} ===",
          result,
        );
        setProperty(result);
        setState("ready");

        // Keep the public slug in the address bar without remounting the page.
        const desired = propertyDetailPath(result);
        if (
          typeof window !== "undefined" &&
          window.location.pathname !== desired
        ) {
          window.history.replaceState(null, "", desired);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] fetch failed", error);
        setState("error");
      });

    return () => controller.abort();
  }, [resolvedId]);

  useEffect(() => {
    if (!resolvedId) return;

    const controller = new AbortController();
    setMediaLoading(true);

    fetchPropertyMedia(resolvedId, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) return;
        console.log(
          "=== [TOP SECTION API RESPONSE] GET /api/properties/{id}/media ===",
          items,
        );
        setMedia(items);
        setMediaLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("[property] media fetch failed", error);
        setMediaLoading(false);
      });

    return () => controller.abort();
  }, [resolvedId]);

  useEffect(() => {
    if (!resolvedId) return;

    const controller = new AbortController();
    setDocuments({ status: "loading", items: [] });

    fetchPropertyDocuments(resolvedId, controller.signal)
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
  }, [resolvedId]);

  // Buyer fit. Independent of the property request, so a failure here leaves
  // the rest of the page intact. A failure is reported as "unavailable" rather
  // than left pending, so the section never sits on a spinner forever.
  useEffect(() => {
    if (!resolvedId) return;

    const controller = new AbortController();
    setLifeStage({ status: "pending" });

    fetchPropertyLifeStageFit(resolvedId, controller.signal)
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
  }, [resolvedId]);

  if (state === "loading") {
    return (
      <div className="property-page flex min-h-[70vh] items-center justify-center pt-8 sm:pt-[calc(var(--nav-h)+2rem)]">
        <p
          className="inline-flex items-center gap-2 text-sm text-[#5c5852]"
          role="status"
        >
          <span className="ila-loader ila-loader--sm" aria-hidden />
          Loading property…
        </p>
      </div>
    );
  }

  if (state === "error" || !property) {
    return (
      <div className="property-page pt-8 sm:pt-[calc(var(--nav-h)+2rem)]">
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

  const record = apiPropertyToRecord(
    property,
    lifeStage,
    documents.items,
    media,
  );

  return (
    <PropertyPageView
      property={record}
      documentsState={documents.status}
      imagesLoading={mediaLoading}
    />
  );
}
