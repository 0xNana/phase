import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, EyeOff, LockKeyhole, UploadCloud, Wallet, type LucideIcon } from "lucide-react";
import type { Campaign } from "@/lib/types";

const sealedRows = ["Recipient list", "Allocation amounts", "Observer report"];

const productCards: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  {
    title: "Claim drops",
    copy: "Recipients check eligibility, reveal their own allocation, then claim.",
    icon: Wallet,
  },
  {
    title: "Batch disperse",
    copy: "Run confidential one-to-many payouts without exposing the CSV.",
    icon: UploadCloud,
  },
  {
    title: "Vesting",
    copy: "Open private schedules and keep allocation details sealed.",
    icon: LockKeyhole,
  },
];

export default function HomeDashboard({ campaign }: { campaign: Campaign | null }) {
  const hasCampaign = Boolean(campaign);
  const proofRows = campaign?.previews.slice(0, 3) ?? [];
  const claimRate = campaign ? Math.round((campaign.claimsCount / Math.max(campaign.recipientCount, 1)) * 100) : 0;
  const claimWidth = `${Math.min(claimRate, 100)}%`;

  return (
    <div className="product-page product-overview">
      <section className="overview-hero" aria-labelledby="hero-title">
        <div className="overview-hero-copy">
          <span className="overview-eyebrow">TokenOps SDK + Zama</span>
          <h1 id="hero-title">Distribute tokens privately.</h1>
          <p>Launch private token distributions where recipients reveal only their own allocation and observers verify activity without seeing amounts.</p>
          <div className="overview-hero-actions">
            <Link className="button-primary" href="/admin">
              Start distribution <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button-secondary" href="/recipient">
              Recipient check
            </Link>
          </div>
        </div>

        <article className="overview-hero-panel" aria-label="Distribution workspace preview">
          <div className="overview-panel-top">
            <div>
              <span>Current distribution</span>
              <strong>{campaign?.name ?? "No distribution created"}</strong>
            </div>
            <span className={hasCampaign ? "pill pill-live" : "pill pill-sealed"}>{campaign?.status ?? "setup"}</span>
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
              sealedRows.map((row) => (
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

      <section id="platform" className="overview-platform" aria-labelledby="platform-title">
        <div className="overview-section-heading">
          <span className="section-label">Workspace</span>
          <h2 id="platform-title">Pick the distribution flow.</h2>
        </div>

        <div className="overview-surface-grid">
          {productCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="overview-surface-card" key={card.title}>
                <span className="overview-surface-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            );
          })}
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
