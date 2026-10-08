"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import PriceEmiFuture from "@/components/PropertyDetail/PriceEmiFuture";
import {
  fetchProperties,
  formatPrice,
  type PropertyListItem,
} from "@/services/propertiesService";
import { trackEvent } from "@/services/analytics/tracker";
import "./EmiAppreciation.css";

/**
 * How many properties the picker offers.
 *
 * The endpoint is paginated, so this is a page rather than a total. There is no
 * "load more": a calculator picker is a shortlist, not a catalogue, and an
 * unbounded list would push the calculator itself below the fold.
 */
const PICKER_LIMIT = 12;

type PickerStatus = "loading" | "ready" | "error";

export default function EmiAppreciation() {
  const [items, setItems] = useState<PropertyListItem[]>([]);
  const [status, setStatus] = useState<PickerStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchProperties({
      status: "ACTIVE",
      perPage: PICKER_LIMIT,
      signal: controller.signal,
    })
      .then((result) => {
        setItems(result.items);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : "Could not load properties.",
        );
      });

    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  function select(id: string) {
    setSelectedId(id);

    trackEvent({
      event_type: "EMI_PROPERTY_SELECT",
      metadata: { property_id: id, section_type: "emi_calculator" },
    });
  }

  return (
    <section
      data-section="emi_calculator"
      id="emi-appreciation"
      className="emi-appreciation"
      aria-label="EMI calculator"
    >
      <div className="emi-appreciation__frame">
        <header className="emi-appreciation__intro">
          <h2 className="emi-appreciation__heading">
            Plan your purchase — see size, cost and returns together
          </h2>
          <p className="emi-appreciation__lede">
            Pick a property to model the loan, then adjust the down payment,
            interest rate and tenure. Every figure updates as you type.
          </p>
        </header>

        <div className="emi-appreciation__picker">
          <p className="emi-appreciation__picker-label" id="emi-picker-label">
            Select a property
          </p>

          {status === "loading" ? (
            <p className="emi-appreciation__note" role="status">
              Loading properties…
            </p>
          ) : null}

          {status === "error" ? (
            <p className="emi-appreciation__note is-error" role="alert">
              {error ?? "Could not load properties."}
            </p>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <p className="emi-appreciation__note">
              No properties are available right now. Please check back soon.
            </p>
          ) : null}

          {items.length > 0 ? (
            <div
              className="emi-appreciation__grid"
              role="group"
              aria-labelledby="emi-picker-label"
            >
              {items.map((item) => {
                const isOn = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`emi-appreciation__option${isOn ? " is-on" : ""}`}
                    aria-pressed={isOn}
                    onClick={() => select(item.id)}
                  >
                    <span className="emi-appreciation__option-media">
                      {item.cover_url ? (
                        <Image
                          src={item.cover_url}
                          alt=""
                          fill
                          sizes="(max-width: 760px) 50vw, 220px"
                        />
                      ) : null}
                    </span>
                    <span className="emi-appreciation__option-copy">
                      <span className="emi-appreciation__option-name">
                        {item.name}
                      </span>
                      <span className="emi-appreciation__option-price">
                        {formatPrice(item.price)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/*
          Until a property is chosen the calculator is replaced by a locked
          placeholder rather than rendered disabled.

          `PriceEmiFuture` has no notion of being locked: it takes a property
          and is fully live. Handing it a fabricated price just to grey it out
          would show a real-looking EMI for a property nobody picked, which is
          worse than showing nothing. The placeholder carries the same
          disabled affordance — dimmed, non-interactive, `aria-disabled` — and
          names what is missing.
        */}
        {selected ? (
          <PriceEmiFuture
            property={{ name: selected.name, price: selected.price ?? 0 }}
            showAmortizationSchedule={false}
          />
        ) : (
          <div
            className="emi-appreciation__locked"
            role="group"
            aria-disabled="true"
            aria-label="EMI calculator, awaiting a property"
          >
            <p className="emi-appreciation__locked-title">
              Select a property to run the numbers
            </p>
            <p className="emi-appreciation__locked-copy">
              The down payment, interest rate and tenure controls stay inactive
              until a property is chosen.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}