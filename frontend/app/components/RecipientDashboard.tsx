"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, FileLock2, Search, ShieldCheck, XCircle } from "lucide-react";
import { useAccount } from "wagmi";
import { maskAddress } from "@/lib/format";
import type { Campaign } from "@/lib/types";

type ClaimCheck = {
  status: "checking" | "ready" | "missing" | "error";
  message: string;
};

export default function RecipientDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const { address } = useAccount();
  const [query, setQuery] = useState("");
  const [claimChecks, setClaimChecks] = useState<Record<string, ClaimCheck>>({});
  const claimCampaigns = useMemo(() => campaigns.filter(isClaimCampaign), [campaigns]);

  useEffect(() => {
    if (!address || claimCampaigns.length === 0) {
      setClaimChecks({});
      return;
    }

    const controller = new AbortController();
    setClaimChecks(
      Object.fromEntries(
        claimCampaigns.map((campaign) => [campaign.id, { status: "checking", message: "Checking wallet" } satisfies ClaimCheck]),
      ),
    );

    async function checkClaims() {
      const results = await Promise.all(
        claimCampaigns.map(async (campaign): Promise<[string, ClaimCheck]> => {
          try {
            const response = await fetch(`/api/campaigns/${campaign.id}/claim?recipient=${address}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            if (response.ok) return [campaign.id, { status: "ready", message: "Claim payload ready" }];
            if (response.status === 404) return [campaign.id, { status: "missing", message: "No payload for this wallet" }];
            return [campaign.id, { status: "error", message: "Could not check payload" }];
          } catch (cause) {
            if (controller.signal.aborted) return [campaign.id, { status: "checking", message: "Checking wallet" }];
            return [campaign.id, { status: "error", message: cause instanceof Error ? cause.message : "Could not check payload" }];
          }
        }),
      );

      if (!controller.signal.aborted) {
        setClaimChecks(Object.fromEntries(results));
      }
    }

    checkClaims();
    return () => controller.abort();
  }, [address, claimCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return claimCampaigns;
    return claimCampaigns.filter((campaign) => {
      return [campaign.name, campaign.id, campaign.status, campaign.tokenAddress, campaign.airdropAddress ?? ""].some((value) =>
        value.toLowerCase().includes(needle),
      );
    });
  }, [claimCampaigns, query]);

  const readyCount = Object.values(claimChecks).filter((check) => check.status === "ready").length;
  const liveCampaigns = claimCampaigns.filter((campaign) => campaign.status === "live").length;

  return (
    <section className="recipient-page" aria-labelledby="recipient-title">
      <div className="recipient-hero">
        <div>
          <span className="product-kicker">
            <FileLock2 size={16} aria-hidden="true" />
            Recipient
          </span>
          <h1 id="recipient-title">Open your private airdrop claim.</h1>
          <p>Connect the assigned wallet, find the matching airdrop campaign, and reveal only your allocation.</p>
        </div>
        <aside className="recipient-wallet-panel" aria-label="Recipient wallet status">
          <span className={address ? "pill pill-live" : "pill pill-watch"}>{address ? "connected" : "wallet needed"}</span>
          <strong>{address ? maskAddress(address) : "No wallet connected"}</strong>
          <small>{address ? `${readyCount.toLocaleString()} ready claim${readyCount === 1 ? "" : "s"}` : "Connect to match payloads"}</small>
        </aside>
      </div>

      <div className="recipient-toolbar panel">
        <div className="recipient-search">
          <Search size={17} aria-hidden="true" />
          <input className="input" placeholder="Search airdrop campaigns" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="recipient-toolbar-stats" aria-label="Recipient campaign stats">
          <RecipientStat label="Campaigns" value={claimCampaigns.length.toLocaleString()} />
          <RecipientStat label="Live" value={liveCampaigns.toLocaleString()} />
          <RecipientStat label="Ready" value={address ? readyCount.toLocaleString() : "-"} />
        </div>
      </div>

      {claimCampaigns.length === 0 ? null : filteredCampaigns.length === 0 ? (
        <section className="recipient-empty panel">
          <Search size={22} aria-hidden="true" />
          <h2>No matching campaigns.</h2>
          <p>Clear the search to see all available campaigns.</p>
        </section>
      ) : (
        <div className="recipient-campaign-grid">
          {filteredCampaigns.map((campaign) => (
            <RecipientCampaignCard campaign={campaign} claimCheck={claimChecks[campaign.id]} connected={Boolean(address)} key={campaign.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecipientCampaignCard({ campaign, claimCheck, connected }: { campaign: Campaign; claimCheck?: ClaimCheck; connected: boolean }) {
  const status = connected ? claimCheck?.status ?? "checking" : "missing";
  const payloadReady = connected && status === "ready";
  const deployed = Boolean(campaign.airdropAddress);

  return (
    <article className="recipient-campaign-card">
      <div className="recipient-campaign-top">
        <span className={campaign.status === "live" ? "pill pill-live" : "pill pill-sealed"}>{campaign.status}</span>
        <ClaimStatePill connected={connected} claimCheck={claimCheck} />
      </div>
      <div>
        <h2>{campaign.name}</h2>
        <p>{formatWindow(campaign.startTimestamp, campaign.endTimestamp)}</p>
      </div>
      <div className="recipient-campaign-facts">
        <RecipientFact label="Token" value={maskAddress(campaign.tokenAddress)} />
        <RecipientFact label="Campaign" value={deployed && campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "pending"} />
        <RecipientFact label="Recipients" value={campaign.recipientCount.toLocaleString()} />
        <RecipientFact label="Claims" value={campaign.claimsCount.toLocaleString()} />
      </div>
      <div className="recipient-campaign-action">
        {payloadReady ? (
          <Link className="button-primary" href={`/claim/${campaign.id}`}>
            Open claim <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : deployed ? (
          <Link className="button-secondary" href={`/claim/${campaign.id}`}>
            Check claim <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <button className="button-secondary" type="button" disabled>
            Not live
          </button>
        )}
      </div>
    </article>
  );
}

function ClaimStatePill({ connected, claimCheck }: { connected: boolean; claimCheck?: ClaimCheck }) {
  if (!connected) {
    return <span className="recipient-state-pill is-waiting"><Clock3 size={13} aria-hidden="true" /> Connect wallet</span>;
  }
  if (!claimCheck || claimCheck.status === "checking") {
    return <span className="recipient-state-pill is-waiting"><Clock3 size={13} aria-hidden="true" /> Checking</span>;
  }
  if (claimCheck.status === "ready") {
    return <span className="recipient-state-pill is-ready"><CheckCircle2 size={13} aria-hidden="true" /> Ready</span>;
  }
  if (claimCheck.status === "error") {
    return <span className="recipient-state-pill is-error"><XCircle size={13} aria-hidden="true" /> Error</span>;
  }
  return <span className="recipient-state-pill"><ShieldCheck size={13} aria-hidden="true" /> Not assigned</span>;
}

function RecipientStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="recipient-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecipientFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="recipient-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function isClaimCampaign(campaign: Campaign): boolean {
  return !campaign.kind || campaign.kind === "claim";
}

function formatWindow(startTimestamp: number, endTimestamp: number): string {
  return `${formatDate(startTimestamp)} to ${formatDate(endTimestamp)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}
