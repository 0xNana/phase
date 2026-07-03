"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Eye, Search, ShieldCheck } from "lucide-react";
import { maskAddress } from "@/lib/format";
import type { Campaign } from "@/lib/types";

type ObserverFilter = "all" | "live";

const filterOptions: Array<{ id: ObserverFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
];

export default function ObserverDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ObserverFilter>("all");

  const filteredCampaigns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (!campaignMatchesFilter(campaign, filter)) return false;
      if (!needle) return true;

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
  }, [campaigns, filter, query]);

  const filterCounts = useMemo(
    () =>
      Object.fromEntries(
        filterOptions.map((option) => [option.id, campaigns.filter((campaign) => campaignMatchesFilter(campaign, option.id)).length]),
      ) as Record<ObserverFilter, number>,
    [campaigns],
  );

  return (
    <section className="observer-page" aria-labelledby="observer-title">
      <div className="observer-hero observer-hero-clean">
        <h1 id="observer-title">Observer</h1>
        <div className="observer-hero-proofbar" aria-label="Observer privacy summary">
          <span><ShieldCheck size={15} aria-hidden="true" /> Proof</span>
          <span>Sealed</span>
        </div>
      </div>

      <div className="observer-toolbar panel">
        <label className="observer-search">
          <Search size={17} aria-hidden="true" />
          <input className="input" placeholder="Search campaigns" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        {campaigns.length > 0 ? (
          <>
            <div className="observer-filterbar" aria-label="Campaign filters">
              {filterOptions.map((option) => (
                <button
                  className={filter === option.id ? "is-active" : ""}
                  type="button"
                  aria-pressed={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  key={option.id}
                >
                  <span>{option.label}</span>
                  <strong>{filterCounts[option.id].toLocaleString()}</strong>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <section className="observer-empty panel">
          <Eye size={22} aria-hidden="true" />
          <h2>No campaigns.</h2>
        </section>
      ) : filteredCampaigns.length === 0 ? (
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
  const isBatch = campaign.kind === "batch";
  const latestProof = campaign.previews[0]?.proofHash;
  const progress = isBatch ? 100 : progressPercent(campaign.claimsCount, campaign.recipientCount);
  const proofLabel = latestProof ? maskAddress(latestProof, 10, 6) : isBatch ? "sealed" : "none";
  const campaignKind = campaign.kind ?? "claim";

  return (
    <Link className="observer-campaign-card" href={`/observer/${campaign.id}`} aria-label={`Open observer for ${campaign.name}`}>
      <div className="observer-campaign-top">
        <span className={statusPillClass(campaign)}>{observerStatusLabel(campaign)}</span>
        <span className={latestProof || isBatch ? "observer-state-pill is-ready" : "observer-state-pill"}>
          <ShieldCheck size={13} aria-hidden="true" />
          {campaignKind}
        </span>
      </div>

      <div className="observer-campaign-main">
        <div>
          <h2>{campaign.name}</h2>
          <span>{formatCampaignTiming(campaign)}</span>
        </div>
        <span className="observer-card-arrow" aria-hidden="true">
          <ArrowRight size={17} />
        </span>
      </div>

      <div className="observer-campaign-signal">
        <div className="observer-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span>{isBatch ? observerStatusLabel(campaign) : `${progress}% claimed`}</span>
      </div>

      <div className="observer-proof-preview">
        <ShieldCheck size={15} aria-hidden="true" />
        <strong className="mono">{proofLabel}</strong>
        <span>{campaign.recipientCount.toLocaleString()} recipients</span>
      </div>
    </Link>
  );
}

function statusPillClass(campaign: Campaign): string {
  if (campaign.kind === "batch") {
    if (campaign.status === "ended" || campaign.status === "live") return "pill pill-live";
    return "pill pill-watch";
  }
  if (campaign.status === "live") return "pill pill-live";
  if (campaign.status === "deploying") return "pill pill-watch";
  return "pill pill-sealed";
}

function observerStatusLabel(campaign: Campaign): string {
  if (campaign.kind !== "batch") return campaign.status;
  if (campaign.status === "ended") return "dispersed";
  if (campaign.status === "deploying") return "preparing";
  if (campaign.status === "live") return "active";
  return "setup";
}

function formatCampaignTiming(campaign: Campaign): string {
  if (campaign.kind === "batch") return "Batch";
  if (campaign.kind === "vesting") return "Vesting";
  return formatWindow(campaign.startTimestamp, campaign.endTimestamp);
}

function formatWindow(startTimestamp: number, endTimestamp: number): string {
  return `${formatDate(startTimestamp)} to ${formatDate(endTimestamp)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function campaignMatchesFilter(campaign: Campaign, filter: ObserverFilter): boolean {
  if (filter === "all") return true;
  return campaign.status === "live";
}

function progressPercent(claims: number, recipients: number): number {
  if (recipients === 0) return 0;
  return Math.min(100, Math.round((claims / recipients) * 100));
}
