"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Eye, Search, ShieldCheck } from "lucide-react";
import { maskAddress } from "@/lib/format";
import type { Campaign } from "@/lib/types";

export default function ObserverDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const [query, setQuery] = useState("");

  const filteredCampaigns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return campaigns;
    return campaigns.filter((campaign) => {
      const proofFields = campaign.previews.flatMap((preview) => [preview.maskedAddress, preview.proofHash, preview.status]);
      return [
        campaign.name,
        campaign.id,
        campaign.status,
        campaign.tokenAddress,
        campaign.airdropAddress ?? "",
        campaign.kind ?? "claim",
        ...proofFields,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [campaigns, query]);

  const liveCampaigns = campaigns.filter((campaign) => campaign.status === "live").length;
  const claimProofs = campaigns.reduce((total, campaign) => total + campaign.claimsCount, 0);
  const recipientCount = campaigns.reduce((total, campaign) => total + campaign.recipientCount, 0);

  return (
    <section className="observer-page" aria-labelledby="observer-title">
      <div className="observer-hero">
        <div>
          <span className="product-kicker">
            <Eye size={16} aria-hidden="true" />
            Observer
          </span>
          <h1 id="observer-title">Track airdrop activity.</h1>
          <p>Status, claims, proofs. Allocations sealed.</p>
        </div>
        <aside className="observer-proof-panel" aria-label="Observer proof summary">
          <span className={claimProofs > 0 ? "pill pill-live" : "pill pill-sealed"}>{claimProofs > 0 ? "proofs live" : "proofs pending"}</span>
          <strong>{claimProofs.toLocaleString()} public claim proofs</strong>
          <small>{recipientCount.toLocaleString()} masked recipients</small>
        </aside>
      </div>

      <div className="observer-toolbar panel">
        <div className="observer-search">
          <Search size={17} aria-hidden="true" />
          <input className="input" placeholder="Search campaigns or proof hashes" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="observer-toolbar-stats" aria-label="Observer campaign stats">
          <ObserverStat label="Campaigns" value={campaigns.length.toLocaleString()} />
          <ObserverStat label="Live" value={liveCampaigns.toLocaleString()} />
          <ObserverStat label="Proofs" value={claimProofs.toLocaleString()} />
        </div>
      </div>

      {campaigns.length === 0 ? null : filteredCampaigns.length === 0 ? (
        <section className="observer-empty panel">
          <Search size={22} aria-hidden="true" />
          <h2>No matching campaigns.</h2>
        </section>
      ) : (
        <div className="observer-campaign-grid">
          {filteredCampaigns.map((campaign) => (
            <ObserverCampaignCard campaign={campaign} key={campaign.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function ObserverCampaignCard({ campaign }: { campaign: Campaign }) {
  const latestProof = campaign.previews[0]?.proofHash;
  const maskedRecipient = campaign.previews[0]?.maskedAddress ?? "none";

  return (
    <article className="observer-campaign-card">
      <div className="observer-campaign-top">
        <span className={statusPillClass(campaign.status)}>{campaign.status}</span>
        <span className={latestProof ? "observer-state-pill is-ready" : "observer-state-pill"}>
          <ShieldCheck size={13} aria-hidden="true" />
          {latestProof ? "Proof activity" : "No proofs"}
        </span>
      </div>

      <div>
        <h2>{campaign.name}</h2>
        <p>{formatCampaignTiming(campaign)}</p>
      </div>

      <div className="observer-campaign-facts">
        <ObserverFact label="Token" value={maskAddress(campaign.tokenAddress)} />
        <ObserverFact label="Campaign" value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "pending"} />
        <ObserverFact label="Recipients" value={campaign.recipientCount.toLocaleString()} />
        <ObserverFact label="Claims" value={campaign.claimsCount.toLocaleString()} />
      </div>

      <div className="observer-proof-strip">
        <div>
          <span>Latest proof</span>
          <strong className="mono">{latestProof ? maskAddress(latestProof, 12, 10) : "no proofs yet"}</strong>
        </div>
        <div>
          <span>Masked recipient</span>
          <strong className="mono">{maskedRecipient}</strong>
        </div>
      </div>

      <div className="observer-campaign-action">
        <Link className="button-secondary" href={`/observer/${campaign.id}`}>
          Open observer <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function ObserverStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="observer-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ObserverFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="observer-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusPillClass(status: Campaign["status"]): string {
  if (status === "live") return "pill pill-live";
  if (status === "deploying") return "pill pill-watch";
  return "pill pill-sealed";
}

function formatCampaignTiming(campaign: Campaign): string {
  if (campaign.kind === "batch") return "On-demand disperse";
  if (campaign.kind === "vesting") return "Vesting schedule";
  return formatWindow(campaign.startTimestamp, campaign.endTimestamp);
}

function formatWindow(startTimestamp: number, endTimestamp: number): string {
  return `${formatDate(startTimestamp)} to ${formatDate(endTimestamp)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
