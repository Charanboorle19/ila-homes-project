import type { PropertyRecord } from "@/data/properties";

export default function LegalDocuments({
  property,
  documentsState = "ready",
}: {
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
}) {
  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes < 1) return null;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
          {documentsState === "loading"
            ? "Loading the latest property documents…"
            : documentsState === "error"
              ? "Documents could not be loaded right now. Please try again later."
              : property.documents.length > 0
                ? `${property.documents.length} document${property.documents.length === 1 ? "" : "s"} published for this property.`
                : "No documents have been published for this property yet."}
        </p>

        <ul className="pd-legal__list">
          {documentsState === "loading" ? (
            <li>
              <div>
                <h3>Loading documents</h3>
                <p role="status">Fetching the verification files for this property…</p>
              </div>
            </li>
          ) : property.documents.map((doc) => (
            <li key={doc.id}>
              <div>
                <h3>{doc.label}</h3>
                <p>
                  {[doc.documentType, doc.visibility, formatBytes(doc.sizeBytes)]
                    .filter(Boolean)
                    .join(" · ") || doc.detail || "Published verification document"}
                </p>
              </div>
              {doc.href ? (
                <a
                  className="pd-btn pd-btn--ghost"
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                >
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
