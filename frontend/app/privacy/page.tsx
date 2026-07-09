import Link from "next/link";
import AppChrome from "../components/AppChrome";

const topics = [
  {
    title: "Encrypted allocations",
    copy: "Recipient amounts are sealed as ERC-7984 ciphertext. Public pages never show plaintext totals or per-wallet values.",
  },
  {
    title: "Selective disclosure",
    copy: "A recipient can decrypt only the allocation bound to their wallet. Other recipients and observers cannot read it.",
  },
  {
    title: "Observer model",
    copy: "Observers verify campaign activity through status, claim counts, masked addresses, and proof hashes — not amounts.",
  },
  {
    title: "Wallet-authorized reveal",
    copy: "Reveal requires a write that grants ACL access, then a Zama user-decrypt signature from the recipient wallet.",
  },
];

export default function PrivacyPage() {
  return (
    <AppChrome>
      <section className="info-page" aria-labelledby="privacy-title">
        <div className="info-hero panel">
          <span className="product-kicker">Privacy model</span>
          <h1 id="privacy-title">Verification without surveillance.</h1>
          <p>
            Phase keeps distribution economics private while still proving that claims happened. No cryptography deep dive —
            just the boundaries that matter for teams and recipients.
          </p>
        </div>

        <div className="info-topic-grid">
          {topics.map((topic) => (
            <article className="info-topic panel" key={topic.title}>
              <h2>{topic.title}</h2>
              <p>{topic.copy}</p>
            </article>
          ))}
        </div>

        <div className="info-cta panel">
          <h2>See it in the product</h2>
          <div className="info-cta-actions">
            <Link className="button-secondary" href="/observer">
              Observer dashboard
            </Link>
            <Link className="button-secondary" href="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </AppChrome>
  );
}
