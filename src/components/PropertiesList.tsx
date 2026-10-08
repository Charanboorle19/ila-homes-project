"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  fetchProperties,
  fetchPropertyById,
  formatPrice,
  type ApiProperty,
  type PropertyListItem,
} from "@/services/propertiesService";

/**
 * Caps simultaneous detail requests.
 *
 * Firing all of them at once drops connections on the free ngrok tunnel, so
 * each property is fetched through a small worker pool instead.
 */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = await worker(items[index]);
      } catch {
        results[index] = undefined as R;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run),
  );

  return results;
}

type Enriched = PropertyListItem & Partial<ApiProperty>;

/**
 * All properties, from GET /api/properties?status=ALL&page=1&per_page=100.
 *
 * The list endpoint returns only 8 fields per property, so each one is then
 * enriched from GET /api/properties/{id} to surface locality, address, status
 * and RERA. A failed detail fetch falls back to the list data rather than
 * dropping the property.
 *
 * Client-side because the tenant is identified by a header the browser sends;
 * a server-side fetch cannot resolve the tenant.
 */
export default function PropertiesList() {
  const [items, setItems] = useState<Enriched[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      const result = await fetchProperties({
        status: "ALL",
        page: 1,
        perPage: 100,
        signal,
      });

      if (signal.aborted) return;

      setTotal(result.total);
      setItems(result.items);
      setState("ready");

      // Render immediately, then fill in the richer fields per property.
      // A failed detail fetch falls back to the list data rather than
      // dropping the property.
      const enriched = await mapWithLimit(
        result.items,
        3,
        async (item) => {
          const detail = await fetchPropertyById(item.id, signal);
          return { ...item, ...detail } as Enriched;
        },
      );

      if (signal.aborted) return;

      setItems(
        enriched.map((item, i) =>
          item ? item : (result.items[i] as Enriched),
        ),
      );
    }

    load().catch((error: unknown) => {
      if (signal.aborted) return;
      console.warn("[properties] list fetch failed", error);
      setState("error");
    });

    return () => controller.abort();
  }, []);

  if (state === "loading") {
    return (
      <p className="text-sm text-[#5c5852]" role="status">
        Loading properties…
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className="text-sm text-[#5c5852]">
        Properties are unavailable right now. Please try again shortly.
      </p>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-[#5c5852]">No properties listed yet.</p>;
  }

  return (
    <>
      <p className="text-[10px] font-semibold tracking-[0.18em] text-[#8a909e] uppercase">
        {items.length} of {total} properties
      </p>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((property) => (
          <li key={property.id}>
            <Link
              href={`/properties/${property.id}`}
              data-track="PROPERTY_VIEW"
              data-track-property={property.id}
              data-track-meta='{"source":"properties_list"}'
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:border-[#c6a46c] hover:shadow-[0_8px_30px_rgba(15,17,20,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c6a46c]"
            >
              <div className="relative aspect-16/10 w-full overflow-hidden bg-[#eef0f3]">
                {property.cover_url ? (
                  <Image
                    src={property.cover_url}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold tracking-[0.16em] text-[#a8adb6] uppercase">
                    No image
                  </span>
                )}

                {property.property_type ? (
                  <span className="absolute top-3 left-3 rounded-full bg-[#0f1114] px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-white uppercase">
                    {property.property_type}
                  </span>
                ) : null}

                {property.status ? (
                  <span className="absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-semibold tracking-[0.12em] text-[#0f1114] uppercase backdrop-blur-sm">
                    {property.status}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h2 className="text-base font-semibold tracking-tight text-[#0f1114]">
                  {property.name}
                </h2>

                {property.locality || property.city ? (
                  <p className="mt-1 truncate text-[11px] font-medium tracking-wide text-[#8a909e] uppercase">
                    {[property.locality, property.city].filter(Boolean).join(", ")}
                  </p>
                ) : null}

                {property.description ? (
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[#4a5060]">
                    {property.description}
                  </p>
                ) : null}

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-black/8 pt-3">
                  <div>
                    <dt className="text-[9px] font-semibold tracking-[0.14em] text-[#8a909e] uppercase">
                      Plots
                    </dt>
                    <dd className="text-sm font-semibold text-[#0f1114]">
                      {property.total_inventory
                        ? property.total_inventory
                        : "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-[9px] font-semibold tracking-[0.14em] text-[#8a909e] uppercase">
                      RERA
                    </dt>
                    <dd className="text-sm font-semibold text-[#0f1114]">
                      {property.rera_registered ? "Registered" : "Not listed"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <span className="truncate text-[10px] text-[#8a909e]">
                    /{property.slug}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-[#a6862e]">
                    {formatPrice(property.price)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}