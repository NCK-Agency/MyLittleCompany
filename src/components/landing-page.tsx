import Link from "next/link";
import { BrandMark } from "./brand-mark";

const memoryLoop = [
  {
    number: "01",
    eyebrow: "Conversation",
    title: "You say it naturally.",
    body: "Work through a real problem with an assistant. No setup form. No knowledge-management project.",
  },
  {
    number: "02",
    eyebrow: "Human approval",
    title: "You decide what becomes true.",
    body: "My Little Company suggests durable knowledge with its source and rationale. A person approves, edits, or ignores it.",
  },
  {
    number: "03",
    eyebrow: "Company memory",
    title: "Everyone uses the same answer.",
    body: "Approved knowledge enters the Playbook, where employees and assistants can find and cite it later.",
  },
];

const trustRules = [
  "AI never approves company knowledge.",
  "Only approved memory is treated as company truth.",
  "Every approved rule keeps its source, rationale, approver, and version.",
  "When the company has not decided, My Little Company says so instead of guessing.",
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">The company memory your people and assistants can trust</p>
          <h1 id="landing-title">Explain it once.<br />Your company remembers.</h1>
          <p className="landing-hero-summary">My Little Company turns everyday owner conversations into human-approved company knowledge, so every employee and assistant can act from the same truth.</p>
          <div className="landing-hero-actions">
            <Link className="primary-button" href="/chat?assistant=MARKETING">See the salon remember <span aria-hidden="true" className="ml-2">→</span></Link>
            <a className="landing-text-link" href="#how-it-works">How it works ↓</a>
          </div>
        </div>

        <div aria-label="Scattered conversation fragments becoming approved company memory" className="landing-memory-stage" role="img">
          <div className="landing-orbit landing-orbit-one" />
          <div className="landing-orbit landing-orbit-two" />
          <span className="landing-quote landing-quote-one">“We never discount more than 15%.”</span>
          <span className="landing-quote landing-quote-two">“Protect our premium image.”</span>
          <span className="landing-quote landing-quote-three">“Prefer a free add-on.”</span>
          <span className="landing-loose-fragment landing-loose-fragment-one" />
          <span className="landing-loose-fragment landing-loose-fragment-two" />
          <span className="landing-loose-fragment landing-loose-fragment-three" />
          <BrandMark className="landing-stage-mark" />
          <span className="landing-approved-label">Approved company truth</span>
        </div>

        <ol className="landing-loop-strip" aria-label="The governed company-memory loop">
          {[
            "Conversation",
            "Suggested knowledge",
            "Owner approval",
            "Company Playbook",
            "Consistent action",
          ].map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>
          ))}
        </ol>
      </section>

      <section className="landing-problem" aria-labelledby="problem-title">
        <div className="landing-section-heading">
          <p className="page-kicker">The real problem</p>
          <h2 id="problem-title">Your company knows more than it can find.</h2>
        </div>
        <div className="landing-problem-copy">
          <p className="landing-lede">Important rules live in the owner’s head, old messages, and one-off conversations. The moment the conversation ends, the company starts forgetting.</p>
          <dl className="landing-consequence-list">
            <div><dt>Owners</dt><dd>repeat the same context instead of moving the business forward.</dd></div>
            <div><dt>Employees</dt><dd>improvise because the current answer is hard to find.</dd></div>
            <div><dt>AI assistants</dt><dd>produce plausible work that ignores how the company actually operates.</dd></div>
          </dl>
        </div>
      </section>

      <section className="landing-process" id="how-it-works" aria-labelledby="process-title">
        <header>
          <p className="landing-eyebrow">Not another document folder</p>
          <h2 id="process-title">My Little Company does not remember everything.<br />It remembers what you approve.</h2>
        </header>
        <ol className="landing-process-list">
          {memoryLoop.map((step, index) => (
            <li key={step.number}>
              <span className="landing-process-number">{step.number}</span>
              <div>
                <p>{step.eyebrow}</p>
                <h3>{step.title}</h3>
              </div>
              <p>{step.body}</p>
              <div className={`landing-process-symbol landing-process-symbol-${index + 1}`} aria-hidden="true">
                {index === 2 ? <BrandMark className="size-14" /> : <span />}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-trust" aria-labelledby="trust-title">
        <div>
          <p className="page-kicker text-[var(--cobalt-deep)]">Built for trust</p>
          <h2 id="trust-title">AI can suggest what matters.<br />It cannot decide what is true.</h2>
          <p>That boundary is the product. The owner stays in control while the company gains a memory that people and assistants can safely reuse.</p>
        </div>
        <ul>
          {trustRules.map((rule, index) => (
            <li key={rule}><span>{String(index + 1).padStart(2, "0")}</span>{rule}</li>
          ))}
        </ul>
      </section>

      <section className="landing-proof" aria-labelledby="proof-title">
        <header>
          <p className="page-kicker">One conversation. Three correct outcomes.</p>
          <h2 id="proof-title">Watch the salon teach the whole company once.</h2>
        </header>
        <div className="landing-proof-grid">
          <blockquote>
            <p>“We never discount more than 15%. We prefer a free add-on because we want to maintain a premium image.”</p>
            <footer>Salon owner, during a normal Marketing conversation</footer>
          </blockquote>

          <div className="landing-approval-example">
            <div>
              <BrandMark className="size-10 shrink-0" />
              <span>Suggested company knowledge</span>
              <strong>Awaiting review</strong>
            </div>
            <h3>Promotional discounts must not exceed 15%</h3>
            <p>Prefer complimentary add-ons over deeper discounts to protect margins and premium positioning.</p>
            <span className="landing-example-action">Owner approves</span>
          </div>

          <ol className="landing-proof-results">
            <li><span>Marketing</span><strong>Revises the promotion to follow the rule.</strong></li>
            <li><span>Operations</span><strong>Turns it into a repeatable front-desk SOP.</strong></li>
            <li><span>Employee</span><strong>Answers “no” to 25% off and cites the approved source.</strong></li>
          </ol>
        </div>
        <div className="landing-proof-actions">
          <Link className="primary-button" href="/chat?assistant=MARKETING">Run the live salon story <span aria-hidden="true" className="ml-2">→</span></Link>
          <Link className="landing-text-link text-[var(--cobalt)]" href="/workspace">Open demo controls</Link>
        </div>
      </section>

      <section className="landing-closing" aria-labelledby="closing-title">
        <BrandMark className="landing-closing-mark" />
        <p className="landing-eyebrow">My Little Company</p>
        <h2 id="closing-title">One approved truth.<br />Every future answer gets better.</h2>
        <Link className="primary-button" href="/chat?assistant=MARKETING">Start with one conversation <span aria-hidden="true" className="ml-2">→</span></Link>
      </section>
    </main>
  );
}
