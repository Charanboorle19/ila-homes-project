import type { Metadata } from "next";
import PropertiesList from "@/components/PropertiesList";
import "@/components/PropertyDetail/PropertyDetail.css";

export const metadata: Metadata = {
  title: "Properties · ILA Homes",
  description: "Browse verified plotted developments across Hyderabad.",
};

export default function PropertiesIndexPage() {
  return (
    <div className="property-page">
      <section
        className="pd-section"
        style={{ paddingTop: "calc(var(--nav-h) + 2rem)" }}
      >
        <div className="pd-section__inner">
          <p className="pd-kicker">Catalogue</p>
          <h1 style={{ margin: 0, fontSize: "clamp(1.8rem, 4vw, 2.6rem)" }}>
            Properties
          </h1>
          <p className="pd-section__lead">
            Every plotted development currently on our books.
          </p>

          {/* Live listings from GET /api/properties?status=ALL&page=1&per_page=100 */}
          <div className="mt-8">
            <PropertiesList />
          </div>
        </div>
      </section>
    </div>
  );
}