const STEPS = [
  {
    id: "enquire",
    number: "01",
    name: "Enquire",
    summary: "Tell us what you're looking for, and we'll share the right options.",
  },
  {
    id: "visit",
    number: "02",
    name: "Site Visit",
    summary: "Visit the property with our team and explore the layout and surroundings.",
  },
  {
    id: "legal",
    number: "03",
    name: "Legal Verification",
    summary: "Review approvals, title documents, and property details with complete clarity.",
  },
  {
    id: "book",
    number: "04",
    name: "Book & Pay",
    summary: "Select your plot and complete the booking with a clear payment schedule.",
  },
  {
    id: "registration",
    number: "05",
    name: "Registration",
    summary: "We coordinate the registration process and guide you through the final handover.",
  },
] as const;

export default function BuyingJourneySteps() {
  return (
    <section className="pd-section pd-journey" aria-labelledby="pd-journey-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Buying journey</p>
        <h2 id="pd-journey-title">A simple, transparent process.</h2>
        <p className="pd-section__lead">
          A clear path from your first conversation to the final handover.
        </p>

        <ol className="pd-journey__steps">
          {STEPS.map((step) => (
            <li key={step.id} className="pd-journey__step">
              <span className="pd-journey__marker" aria-hidden="true">
                {step.number}
              </span>
              <h3>{step.name}</h3>
              <p>{step.summary}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
