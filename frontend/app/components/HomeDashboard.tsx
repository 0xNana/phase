import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, EyeOff, LockKeyhole, UploadCloud, Wallet, type LucideIcon } from "lucide-react";
import type { Campaign } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { maskAddress } from "@/lib/format";

const demoStepCopy: Array<{ step: string; title: string; copy: string; href?: string; share?: boolean }> = [
  { step: "01", title: "Claim cUSDC", href: "/faucet", copy: "Fund your Sepolia wallet." },
  { step: "02", title: "Launch", href: "/admin", copy: "Import recipients and seal amounts." },
  { step: "03", title: "Share", share: true, copy: "Send the public distribution link." },
  { step: "04", title: "Reveal", href: "/recipient", copy: "Decrypt only your allocation." },
  { step: "05", title: "Claim", href: "/recipient", copy: "Receive confidential cUSDC." },
];

const featureCards: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  {
    title: "Private Allocations",
    copy: "Only recipients reveal their amounts.",
    icon: LockKeyhole,
  },
  {
    title: "Verifiable Claims",
    copy: "Observers verify activity without plaintext.",
    icon: EyeOff,
  },
  {
    title: "Built on Zama",
    copy: "Powered by ERC-7984 and TokenOps.",
    icon: Wallet,
  },
];

const productCards: Array<{
  eyebrow: string;
  title: string;
  copy: string;
  icon: LucideIcon;
  href: string;
  accent: "claim" | "batch" | "vesting";
}> = [
  {
    eyebrow: "Recipient portal",
    title: "Claim",
    copy: "Recipients check eligibility, reveal their own allocation, then claim on their schedule.",
    icon: Wallet,
    href: "/admin",
    accent: "claim",
  },
  {
    eyebrow: "One-to-many",
    title: "Batch",
    copy: "Disperse sealed payouts to a CSV list without a claim portal or public amounts.",
    icon: UploadCloud,
    href: "/admin",
    accent: "batch",
  },
  {
    eyebrow: "Timed unlocks",
    title: "Vesting",
    copy: "Open private schedules so recipients claim as tokens unlock — amounts stay sealed.",
    icon: LockKeyhole,
    href: "/admin",
    accent: "vesting",
  },
];

export default function HomeDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const campaign = campaigns[0] ?? null;
  const proofRows = campaign?.previews.slice(0, 3) ?? [];
  const claimRate = campaign ? Math.round((campaign.claimsCount / Math.max(campaign.recipientCount, 1)) * 100) : 0;
  const claimWidth = `${Math.min(claimRate, 100)}%`;
  const demoCampaign = campaigns.find((item) => item.status === "live") ?? campaign;
  const shareHref = demoCampaign ? `/campaign/${demoCampaign.id}` : "/observer";

  return (
    <div className="product-page product-overview">
      <section className="overview-hero" aria-labelledby="hero-title">
        <div className="overview-hero-copy">
          <h1 id="hero-title">Launch confidential token distributions.</h1>
          <p>Private ERC-7984 airdrops, grants, rewards, and vesting — recipients reveal only their own allocation.</p>
          <div className="overview-hero-actions">
            <Link className="button-primary" href="/admin">
              Launch Distribution <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button-secondary" href={demoCampaign ? `/campaign/${demoCampaign.id}` : "/faucet"}>
              View Demo
            </Link>
          </div>
        </div>

        <article className="overview-hero-panel" aria-label="Distribution workspace preview">
          <div className="overview-panel-top">
            <div>
              <span>Current distribution</span>
              <strong>{campaign?.name ?? "No distribution created"}</strong>
            </div>
            {campaign ? <StatusBadge campaign={campaign} /> : <span className="pill pill-sealed">setup</span>}
          </div>

          <div className="overview-panel-grid">
            <PanelMetric label="Recipients" value={campaign ? campaign.recipientCount.toLocaleString() : "pending"} />
            <PanelMetric label="Claims" value={campaign ? campaign.claimsCount.toLocaleString() : "pending"} />
            <PanelMetric label="Allocation" value="sealed" sealed />
          </div>

          <div className="overview-progress-row">
            <div>
              <span>Progress</span>
              <strong>{campaign ? `${claimRate}%` : "not started"}</strong>
            </div>
            <div className="overview-progress-track" aria-hidden="true">
              <span style={{ width: claimWidth }} />
            </div>
          </div>

          <div className="overview-panel-list">
            {proofRows.length > 0 ? (
              proofRows.map((preview) => (
                <div className="overview-panel-row" key={preview.proofHash}>
                  <span className="mono">{preview.maskedAddress}</span>
                  <span className={preview.status === "claimed" ? "pill pill-live" : "pill pill-watch"}>{preview.status}</span>
                </div>
              ))
            ) : (
              ["Recipient list", "Allocation amounts", "Observer report"].map((row) => (
                <div className="overview-panel-row" key={row}>
                  <span>{row}</span>
                  <span className="overview-mask" aria-hidden="true" />
                </div>
              ))
            )}
          </div>

          <div className="overview-panel-footer">
            <StatusChip icon={<LockKeyhole size={15} aria-hidden="true" />} label="Private" value="Sealed" />
            <StatusChip icon={<EyeOff size={15} aria-hidden="true" />} label="Observer" value="Proof-safe" />
          </div>
        </article>
      </section>

      <section className="home-section home-dual-section" aria-label="Get started and platform values">
        <div className="home-dual-grid">
          <article className="home-dual-card home-dual-card-demo" aria-labelledby="demo-flow-title">
            <h2 className="home-section-title" id="demo-flow-title">
              Try Phase in five steps.
            </h2>

            <ol className="demo-step-rail">
              {demoStepCopy.map((item, index) => {
                const href = item.share ? shareHref : item.href ?? "/";
                return (
                  <li className="demo-step-item" key={item.step}>
                    <Link className="demo-step-card" href={href}>
                      <span className="demo-step-index">{item.step}</span>
                      <span className="demo-step-copy">
                        <strong>{item.title}</strong>
                        <span>{item.copy}</span>
                      </span>
                      <ArrowRight className="demo-step-arrow" size={15} aria-hidden="true" />
                    </Link>
                    {index < demoStepCopy.length - 1 ? <span className="demo-step-connector" aria-hidden="true" /> : null}
                  </li>
                );
              })}
            </ol>
          </article>

          <article className="home-dual-card home-dual-card-why" aria-labelledby="features-title">
            <h2 className="home-section-title" id="features-title">
              Confidential by default.
            </h2>
            <ul className="why-phase-grid">
              {featureCards.map((card) => {
                const Icon = card.icon;
                return (
                  <li className="why-phase-item" key={card.title}>
                    <span className="why-phase-icon">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{card.title}</strong>
                      <span>{card.copy}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        </div>
      </section>

      <section className="home-section flow-picker-section" id="platform" aria-labelledby="platform-title">
        <div className="home-section-inner">
          <div className="overview-section-heading home-section-heading">
            <span className="section-label">Flows</span>
            <h2 id="platform-title">Pick the distribution flow.</h2>
            <p>Choose the ops pattern that matches how your team pays — claim portal, batch disperse, or vesting.</p>
          </div>

          <div className="flow-picker-grid">
            {productCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link className={`flow-picker-card is-${card.accent}`} href={card.href} key={card.title}>
                  <div className="flow-picker-top">
                    <span className="flow-picker-eyebrow">{card.eyebrow}</span>
                    <span className="flow-picker-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                  <span className="flow-picker-cta">
                    Start {card.title.toLowerCase()} <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section distribution-directory" aria-labelledby="directory-title">
        <div className="home-section-inner">
          <div className="overview-section-heading home-section-heading">
            <span className="section-label">Workspace</span>
            <h2 id="directory-title">Recent Distributions</h2>
          </div>

          {campaigns.length === 0 ? (
            <div className="empty-state panel">
              <h3>No distributions yet.</h3>
              <p>Launch your first confidential distribution.</p>
              <Link className="button-primary" href="/admin">
                Launch Distribution <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="distribution-directory-grid">
              {campaigns.slice(0, 6).map((item) => (
                <Link className="distribution-directory-card panel" href={`/campaign/${item.id}`} key={item.id}>
                  <div className="distribution-directory-top">
                    <strong>{item.name}</strong>
                    <StatusBadge campaign={item} />
                  </div>
                  <div className="distribution-directory-meta">
                    <span>{item.kind ?? "claim"}</span>
                    <span className="mono">{maskAddress(item.tokenAddress)}</span>
                    <span>
                      {item.claimsCount}/{item.recipientCount} claims
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PanelMetric({ label, value, sealed = false }: { label: string; value: string; sealed?: boolean }) {
  return (
    <div className="overview-panel-card">
      <span>{label}</span>
      {sealed ? <strong className="overview-sealed-value">{value}</strong> : <strong>{value}</strong>}
    </div>
  );
}

function StatusChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="overview-status-chip">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
