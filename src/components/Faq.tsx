"use client";

import { useId, useState } from "react";
import "./Faq.css";

const FAQS = [
  {
    question: "Are the plots legally verified?",
    answer:
      "Yes. Every listing we share goes through title checks, approval status review, and basic due diligence before it reaches you.",
  },
  {
    question: "What approvals should I look for?",
    answer:
      "Depending on the layout, we look for HMDA, DTCP, GHMC, or RERA-linked clearances. We explain what each approval means for registration and construction.",
  },
  {
    question: "Can I compare plots before visiting?",
    answer:
      "Yes. Use Compare, Find Your Plot, and shortlist sharing to narrow options by price, size, location, and appreciation signals before you schedule a site visit.",
  },
  {
    question: "Do you help with loans and EMI planning?",
    answer:
      "We support loan introductions with major banks and help you model EMI versus expected appreciation so the monthly cost feels clear before you commit.",
  },
  {
    question: "How long does the buying process take?",
    answer:
      "Most guided transactions move from shortlist to registration in a few weeks, depending on documentation readiness and bank timelines. We map each step so nothing feels opaque.",
  },
  {
    question: "Can my family review the shortlist remotely?",
    answer:
      "Yes. Share a WhatsApp-ready shortlist with plot details and context so everyone can review the same options without forwarding scattered messages.",
  },
] as const;

export default function Faq() {
  const baseId = useId();
  const [openId, setOpenId] = useState(0);

  function toggle(index: number) {
    setOpenId((prev) => (prev === index ? -1 : index));
  }

  return (
    <section data-section="faq" className="faq" id="faq" aria-labelledby="faq-heading">
      <div className="faq__frame">
        <header className="faq__intro">
          <p className="faq__eyebrow">FAQ</p>
          <h2 id="faq-heading" className="faq__heading">
            Answers before you
            <br />
            make the call.
          </h2>
          <p className="faq__lede">
            Clear responses to the questions buyers ask most — legal checks,
            process, financing, and how we help you decide.
          </p>
        </header>

        <div className="faq__list">
          {FAQS.map((item, index) => {
            const isOpen = openId === index;
            const panelId = `${baseId}-panel-${index}`;
            const buttonId = `${baseId}-button-${index}`;

            return (
              <div
                key={item.question}
                className={`faq__item${isOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  id={buttonId}
                  className="faq__trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(index)}
                >
                  <span className="faq__question">{item.question}</span>
                  <span className="faq__icon" aria-hidden="true">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="faq__panel"
                  hidden={!isOpen}
                >
                  <p className="faq__answer">{item.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
