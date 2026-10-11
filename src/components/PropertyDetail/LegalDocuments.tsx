"use client";

import { useState } from "react";
import type { PropertyDocument, PropertyRecord } from "@/data/properties";
import { whatsappUrl } from "@/lib/propertyUtils";

/**
 * The records behind this section are plain strings and they are not consistent
 * between themselves: one label arrives as "Plot" and the next as "brochure",
 * and `visibility` carries internal access tags like "CUSTOMER". Everything
 * below shapes those strings for the card and none of it writes back — the data
 * is left exactly as it arrived.
 */

/** Four rows is still a short list. Past that it is a scroll. */
const COLLAPSE_DOCUMENT_COUNT = 4;
const VISIBLE_DOCUMENT_COUNT = 3;

type DocKind = "pdf" | "doc" | "file";

/** All on a 24x24 grid so one stroke weight carries the set. */
const DOC_ICONS: Record<DocKind, string[]> = {
  pdf: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
    "M12 11.5v5",
    "m9.5 14 2.5 2.5 2.5-2.5",
  ],
  doc: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
    "M8.5 13.5h7",
    "M8.5 17h4.5",
  ],
  file: [
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
    "M14 2v6h6",
  ],
};

/** Spoken as well as drawn, so the card's accessible name can name the type. */
const DOC_KIND_LABELS: Record<DocKind, string> = {
  pdf: "PDF",
  doc: "document",
  file: "file",
};

const EXTENSION_KINDS: Record<string, DocKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  odt: "doc",
  rtf: "doc",
  xls: "doc",
  xlsx: "doc",
  csv: "doc",
};

/**
 * `visibility` is an access flag from the API rather than something a buyer
 * acts on. These read as internal routing tags, so they are dropped instead of
 * shown; any other value is passed through in case it does carry meaning.
 */
const INTERNAL_VISIBILITY = new Set([
  "customer",
  "internal",
  "private",
  "staff",
  "agent",
  "draft",
  "confidential",
]);

/**
 * Static rows link to a fragment (`#document-title`) and API rows to a storage
 * reference, so the extension is whatever follows the last dot with any query
 * or fragment removed. Anything unrecognised falls back to a plain file mark.
 */
function docKind(href?: string): DocKind {
  if (!href) return "file";
  const path = href.split(/[?#]/)[0] ?? "";
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_KINDS[extension] ?? "file";
}

/** First letter up, nothing else touched — so "RERA" and "1.2 MB" survive. */
function sentenceCase(value: string): string {
  const text = value.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes < 1) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function documentMeta(doc: PropertyDocument): string {
  const visibility = INTERNAL_VISIBILITY.has(
    String(doc.visibility ?? "").trim().toLowerCase(),
  )
    ? undefined
    : doc.visibility;

  const parts = [doc.documentType, visibility, formatBytes(doc.sizeBytes)]
    .filter((part): part is string => Boolean(part))
    .join(" · ");

  return sentenceCase(
    parts || doc.detail || "Published verification document",
  );
}

/**
 * A plain anchor reports nothing when its target is dead: the browser opens an
 * empty tab and this page never hears about it. The one case a click can
 * actually detect is a fragment with nothing behind it — and that is every
 * static row today, because `#document-title` and its siblings have no element
 * anywhere in the render tree. Everything else is left to the browser, so
 * middle-click and "copy link address" keep working.
 */
function isDeadFragment(href: string): boolean {
  return href.startsWith("#") && !document.querySelector(href);
}

function DocumentIcon({ kind }: { kind: DocKind }) {
  return (
    <span
      className={`pd-legal__icon pd-legal__icon--${kind}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" focusable="false">
        {DOC_ICONS[kind].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

export default function LegalDocuments({
  property,
  documentsState = "ready",
}: {
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
}) {
  const [showAllDocuments, setShowAllDocuments] = useState(false);
  /** Id of the card whose link could not be opened, if any. */
  const [openErrorId, setOpenErrorId] = useState<string | null>(null);

  const documents = property.documents;
  const collapsible = documents.length > COLLAPSE_DOCUMENT_COUNT;
  const visibleDocuments = showAllDocuments
    ? documents
    : documents.slice(0, VISIBLE_DOCUMENT_COUNT);

  // An empty list is a hole in the page, not information. The request line
  // below stands in for it, and the error case keeps only its message.
  const hasRows = documentsState === "loading" || documents.length > 0;

  const requestHref = whatsappUrl(
    `Hi ILA Homes, I'd like to request the legal documents for ${property.name} (${property.location}).`,
  );

  return (
    <section
      className="pd-section pd-legal"
      id="documents"
      aria-labelledby="pd-legal-title"
    >
      <div className="pd-section__inner">
        <p className="pd-kicker">
          {/* Trust cue for the eyebrow. The word carries the meaning, so the
              mark is decorative. */}
          <svg
            className="pd-legal__kicker-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1 1 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
          </svg>
          Verification
        </p>
        {/* The hero already names the property; repeating it here only made
            the heading wrap to two lines. */}
        <h2 id="pd-legal-title">Legal documents</h2>
        <p className="pd-section__lead">
          {documentsState === "loading" ? (
            <span className="inline-flex items-center gap-2">
              {/* --light: the loader's default ink matches a white page and
                  disappears on this section's dark band. */}
              <span className="ila-loader ila-loader--sm ila-loader--light" aria-hidden />
              Loading the latest property documents…
            </span>
          ) : documentsState === "error" ? (
            "Documents could not be loaded right now. Please try again later."
          ) : documents.length > 0 ? (
            `${documents.length} document${documents.length === 1 ? "" : "s"} published for this property.`
          ) : (
            "No documents have been published for this property yet."
          )}
        </p>

        {hasRows ? (
          <div className="pd-legal__content">
            {/* Left column: document list, show-all, rules link */}
            <div className="pd-legal__main">
              <ul className={`pd-legal__list ${documents.length > 4 ? "pd-legal__list--dense" : ""}`}>
                {documentsState === "loading" ? (
                  <li>
                    <div className="pd-legal__card">
                      <DocumentIcon kind="file" />
                      <div className="pd-legal__body">
                        <h3 className="inline-flex items-center gap-2">
                          <span className="ila-loader ila-loader--sm ila-loader--light" aria-hidden />
                          Loading documents
                        </h3>
                        <p className="pd-legal__meta">
                          Fetching the verification files for this property…
                        </p>
                      </div>
                    </div>
                  </li>
                ) : (
                  visibleDocuments.map((doc) => {
                    const kind = docKind(doc.href);
                    const name = sentenceCase(doc.label);
                    const meta = documentMeta(doc);
                    // Extract type (first part before " · ") for the tag.
                    const metaParts = meta.split(" · ");
                    const typeTag = metaParts[0] ?? "";
                    const metaRest = metaParts.slice(1).join(" · ") ?? meta;
                    const failed = openErrorId === doc.id;

                    return (
                      <li key={doc.id}>
                        {/*
                          The card is the link, so the whole row is the tap target
                          and the "View" cue inside it can never be a small thing to
                          miss. A row without an `href` is a stated fact rather than
                          a file, so it stays inert and renders no cue at all.
                        */}
                        {doc.href ? (
                          <a
                            className="pd-legal__card"
                            href={doc.href}
                            target="_blank"
                            rel="noreferrer"
                            /* Accessible name distinguishes each "View" action. */
                            aria-label={`View ${name}, ${DOC_KIND_LABELS[kind]}, opens in a new tab`}
                            onClick={(event) => {
                              if (!isDeadFragment(doc.href ?? "")) return;
                              event.preventDefault();
                              setOpenErrorId(failed ? null : doc.id);
                            }}
                          >
                            <DocumentIcon kind={kind} />
                            <span className="pd-legal__body">
                              <span className="pd-legal__name">{name}</span>
                              <span className="pd-legal__meta">
                                {metaRest && <span>{metaRest}</span>}
                                <span className="pd-legal__meta-tag">{typeTag}</span>
                              </span>
                            </span>

                            {failed ? (
                              <span className="pd-legal__error" role="alert">
                                Couldn&rsquo;t open file. Try again
                              </span>
                            ) : (
                              /* Visual cue only — the link's own label is what a
                                 screen reader gets. */
                              <span className="pd-legal__view" aria-hidden="true">
                                View
                                <svg viewBox="0 0 24 24" focusable="false">
                                  <path d="M15 3h6v6" />
                                  <path d="M10 14 21 3" />
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                </svg>
                              </span>
                            )}
                          </a>
                        ) : (
                          <div className="pd-legal__card">
                            <DocumentIcon kind={kind} />
                            <span className="pd-legal__body">
                              <span className="pd-legal__name">{name}</span>
                              <span className="pd-legal__meta">
                                {metaRest && <span>{metaRest}</span>}
                                <span className="pd-legal__meta-tag">{typeTag}</span>
                              </span>
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>

              {collapsible ? (
                <button
                  type="button"
                  className="pd-legal__show-all"
                  aria-expanded={showAllDocuments}
                  onClick={() => setShowAllDocuments((value) => !value)}
                >
                  {showAllDocuments
                    ? "Show less"
                    : `Show all ${documents.length}`}
                  <svg
                    className={`pd-legal__chevron${
                      showAllDocuments ? " pd-legal__chevron--up" : ""
                    }`}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              ) : null}

              {/*
                A link, not a document, and it says so: the label names what it is
                and where it applies, which "View build rules" never did.
              */}
              <a className="pd-legal__rules" href="#document-build-rules">
                Read build rules for this layout
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Right column: advocate note (disclaimer) */}
            <aside className="pd-legal__sidebar" aria-label="Disclaimer">
              <div className="pd-legal__note">
                <div className="pd-legal__note-row">
                  <span className="pd-legal__note-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </span>
                  <p className="pd-legal__note-text">
                    Independent advocate review is encouraged.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}
