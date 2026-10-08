import Image from "next/image";
import Link from "next/link";
import type { SimilarCard } from "@/lib/similar";
import { formatInr } from "@/lib/propertyUtils";
import { getPropertyGallery } from "@/data/properties";

export default function SimilarProperties({ items }: { items: SimilarCard[] }) {
  if (items.length === 0) return null;

  return (
    <section className="pd-section pd-similar" aria-labelledby="pd-similar-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Keep exploring</p>
        <h2 id="pd-similar-title">Similar properties</h2>
        <p className="pd-section__lead">
          Scored by locality, price band, facing, and shared features.
        </p>

        <ul className="pd-similar__grid">
          {items.map(({ property, reasons }) => {
            const image = getPropertyGallery(property)[0];
            return (
              <li key={property.id}>
                <Link
                  href={`/properties/${property.id}`}
                  className="pd-similar__card"
                >
                  <div className="pd-similar__media">
                    {image ? (
                      <Image
                        src={image.src}
                        alt=""
                        fill
                        sizes="(max-width: 700px) 100vw, 33vw"
                      />
                    ) : null}
                    <span className="pd-similar__badge">{property.approval}</span>
                  </div>
                  <div className="pd-similar__body">
                    <h3>{property.name}</h3>
                    <p>{property.location}</p>
                    <p className="pd-similar__meta">
                      {property.sqYards} · {property.facing} ·{" "}
                      {formatInr(property.price)}
                    </p>
                    {reasons.length > 0 ? (
                      <p className="pd-similar__reasons">{reasons.join(" · ")}</p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
