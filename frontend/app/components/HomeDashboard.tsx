import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, EyeOff, FileCheck2, LockKeyhole, UploadCloud, Wallet, type LucideIcon } from "lucide-react";
import type { Campaign } from "@/lib/types";

const sealedRows = ["Recipient list", "Allocation amounts", "Public report"];
const sceneNodes = ["a", "b", "c", "d", "e", "f", "g"];
const scenePackets = ["a", "b", "c", "d", "e"];

const productCards: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  {
    title: "Claimable drops",
    copy: "Issue wallet-bound claims so recipients reveal and claim only the allocation assigned to them.",
    icon: Wallet,
  },
  {
    title: "Bulk airdrops",
    copy: "Upload recipient lists, validate wallets, and prepare private airdrop allocations for large stakeholder groups.",
    icon: UploadCloud,
  },
  {
    title: "Vested airdrops",
    copy: "Configure time-based releases while keeping schedules and allocation values sealed from public views.",
    icon: LockKeyhole,
  },
  {
    title: "Proof-safe reporting",
    copy: "Publish status, masked recipients, and proof hashes so observers can verify progress without seeing amounts.",
    icon: FileCheck2,
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
        <div className="overview-hero-scene" aria-hidden="true">
          <span className="overview-scene-grid" />
          <span className="overview-scene-horizon" />
          <span className="overview-scene-beam overview-scene-beam-a" />
          <span className="overview-scene-beam overview-scene-beam-b" />

          <div className="overview-vault-shell">
            <span className="overview-vault-ring overview-vault-ring-a" />
            <span className="overview-vault-ring overview-vault-ring-b" />
            <span className="overview-vault-ring overview-vault-ring-c" />
            <span className="overview-vault-core" />
            <span className="overview-vault-lockline overview-vault-lockline-a" />
            <span className="overview-vault-lockline overview-vault-lockline-b" />
          </div>

          <div className="overview-recipient-field">
            {sceneNodes.map((node) => (
              <span className={`overview-recipient-node overview-recipient-node-${node}`} key={node}>
                <span />
              </span>
            ))}
          </div>

          <div className="overview-data-lanes">
            <span className="overview-data-lane overview-data-lane-a" />
            <span className="overview-data-lane overview-data-lane-b" />
            <span className="overview-data-lane overview-data-lane-c" />
          </div>

          <div className="overview-sealed-packets">
            {scenePackets.map((packet) => (
              <span className={`overview-sealed-packet overview-sealed-packet-${packet}`} key={packet} />
            ))}
          </div>
        </div>

        <div className="overview-hero-copy">
          <span className="overview-eyebrow">Built on TokenOps SDK</span>
          <h1 id="hero-title">Private airdrops that only you can see</h1>
          <p>
            Phase uses TokenOps SDK to launch claimable, bulk, and vested private airdrops without exposing plaintext allocation tables.
          </p>
          <div className="overview-hero-actions">
            <Link className="button-primary" href="/admin">
              Start Airdrop <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <article className="overview-hero-panel" aria-label="Airdrop workspace preview">
          <div className="overview-panel-top">
            <div>
              <span>Airdrop workspace</span>
              <strong>{campaign?.name ?? "No airdrop created"}</strong>
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
              <span>Claim progress</span>
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
            <StatusChip icon={<LockKeyhole size={15} aria-hidden="true" />} label="Private by default" value="Sealed" />
            <StatusChip icon={<EyeOff size={15} aria-hidden="true" />} label="Public output" value="Proof-only" />
          </div>
        </article>
      </section>

      <section id="platform" className="overview-platform" aria-labelledby="platform-title">
        <div className="overview-section-heading">
          <span className="section-label">Product</span>
          <h2 id="platform-title">A private airdrop platform for every launch path.</h2>
          <p>Configure claimable, bulk, and vested airdrops while recipient amounts stay sealed.</p>
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

        {campaign ? (
          <div className="overview-campaign-strip" aria-label="Current campaign summary">
            <CampaignMetric label="Recipients" value={campaign.recipientCount.toLocaleString()} />
            <CampaignMetric label="Claims" value={campaign.claimsCount.toLocaleString()} />
            <CampaignMetric label="Status" value={campaign.status} />
          </div>
        ) : null}
      </section>


      <section className="overview-cta" aria-labelledby="cta-title">
        <div className="overview-ready-graphic" aria-hidden="true">
          <span className="ready-frame ready-frame-a" />
          <span className="ready-frame ready-frame-b" />
          <span className="ready-packet ready-packet-a" />
          <span className="ready-packet ready-packet-b" />
          <span className="ready-packet ready-packet-c" />
          <span className="ready-scan" />
        </div>
        <span className="section-label">Ready</span>
        <h2 id="cta-title">Create the first private airdrop from the admin workspace.</h2>
        <div className="overview-cta-actions">
          <Link className="button-primary" href="/admin">
            Start Airdrop <ArrowRight size={16} aria-hidden="true" />
          </Link>
          {campaign ? (
            <Link className="button-secondary" href={`/observer/${campaign.id}`}>
              Open Observer
            </Link>
          ) : null}
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

function CampaignMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="overview-campaign-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
