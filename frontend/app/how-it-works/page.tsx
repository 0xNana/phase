import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AppChrome from "../components/AppChrome";

const steps = [
  {
    title: "Admin",
    copy: "Import a CSV of recipients and amounts, then configure the claim window.",
  },
  {
    title: "Encrypted allocation",
    copy: "Each amount is sealed with TokenOps encryptUint64 before it leaves the admin machine.",
  },
  {
    title: "Recipient authorization",
    copy: "The admin signs EIP-712 claim authorizations bound to each wallet and encrypted handle.",
  },
  {
    title: "Reveal",
    copy: "Only the matching recipient wallet can grant ACL access and decrypt their own allocation.",
  },
  {
    title: "Claim",
    copy: "The recipient claims with the original signed ciphertext — no re-encryption.",
  },
];

export default function HowItWorksPage() {
  return (
    <AppChrome>
      <section className="info-page" aria-labelledby="how-title">
        <div className="info-hero panel">
          <span className="product-kicker">How it works</span>
          <h1 id="how-title">From CSV to confidential claim.</h1>
          <p>Phase walks teams through private ERC-7984 distributions without exposing amounts on public pages.</p>
        </div>

        <ol className="info-flow">
          {steps.map((step, index) => (
            <li className="info-flow-step panel" key={step.title}>
              <span className="info-flow-index">{index + 1}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.copy}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="info-cta panel">
          <h2>Try the demo</h2>
          <p>Claim test cUSDC, launch a distribution, then reveal and claim as a recipient.</p>
          <div className="info-cta-actions">
            <Link className="button-primary" href="/faucet">
              Claim test cUSDC <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button-secondary" href="/admin">
              Launch Distribution
            </Link>
          </div>
        </div>
      </section>
    </AppChrome>
  );
}
