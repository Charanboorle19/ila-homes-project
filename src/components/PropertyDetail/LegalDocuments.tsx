import type { PropertyRecord } from "@/data/properties";

export default function LegalDocuments({
  property,
}: {
  property: PropertyRecord;
}) {
  return (
    <section
      className="pd-section pd-legal"
      id="documents"
      aria-labelledby="pd-legal-title"
    >
      <div className="pd-section__inner">
        <p className="pd-kicker">Verification</p>
        <h2 id="pd-legal-title">Legal documents for {property.name}</h2>
        <p className="pd-section__lead">
          {property.documents.some((doc) => doc.href)
            ? "Demo catalogue links may be fragments until production targets are verified for each property."
            : "Recorded for this development as published by the listing."}
        </p>

        <ul className="pd-legal__list">
          {property.documents.map((doc) => (
            <li key={doc.id}>
              <div>
                <h3>{doc.label}</h3>
                <p>
                  {/* A stated fact stands on its own; only a real document
                      file gets a link to open. */}
                  {doc.detail ??
                    `${property.bankEligible ? "Bank-eligible context" : "Verify financing"} · ${
                      property.reraRegistered ? "RERA noted" : "RERA status TBA"
                    }`}
                </p>
              </div>
              {doc.href ? (
                <a className="pd-btn pd-btn--ghost" href={doc.href}>
                  View
                </a>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="pd-legal__extras">
          <a className="pd-btn pd-btn--ghost" href="#document-build-rules">
            View build rules
          </a>
          <p className="pd-legal__callout">
            Independent advocate review is encouraged. Possession:{" "}
            {property.possession}. Status: {property.status.replace("-", " ")}.
          </p>
        </div>
      </div>
    </section>
  );
}
