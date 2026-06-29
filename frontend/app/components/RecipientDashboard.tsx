"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Clock3, FileLock2, ShieldCheck, WalletCards } from "lucide-react";
import { useAccount } from "wagmi";
import { maskAddress } from "@/lib/format";
import type { Campaign } from "@/lib/types";

type ClaimCheck = {
  status: "checking" | "ready" | "claimed" | "missing" | "error";
  message: string;
};
type VestingCheck = {
  status: "checking" | "ready" | "missing" | "error";
  message: string;
};

export default function RecipientDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const { address } = useAccount();
  const [claimChecks, setClaimChecks] = useState<Record<string, ClaimCheck>>({});
  const [vestingChecks, setVestingChecks] = useState<Record<string, VestingCheck>>({});
  const claimCampaigns = useMemo(() => campaigns.filter(isClaimCampaign), [campaigns]);
  const vestingCampaigns = useMemo(() => campaigns.filter(isVestingCampaign), [campaigns]);

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
          if (!campaign.airdropAddress || campaign.status !== "live") {
            return [campaign.id, { status: "missing", message: "Not live" }];
          }

          try {
            const response = await fetch(`/api/campaigns/${campaign.id}/claim?recipient=${address}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            if (response.ok) {
              const result = (await response.json().catch(() => null)) as { claim?: { claimedAt?: string } } | null;
              return [campaign.id, result?.claim?.claimedAt ? { status: "claimed", message: "Claimed" } : { status: "ready", message: "Ready" }];
            }
            if (response.status === 404) return [campaign.id, { status: "missing", message: "No claim" }];
            return [campaign.id, { status: "error", message: "Check failed" }];
          } catch (cause) {
            if (controller.signal.aborted) return [campaign.id, { status: "checking", message: "Checking wallet" }];
            return [campaign.id, { status: "error", message: cause instanceof Error ? cause.message : "Check failed" }];
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

  useEffect(() => {
    if (!address || vestingCampaigns.length === 0) {
      setVestingChecks({});
      return;
    }

    const controller = new AbortController();
    setVestingChecks(
      Object.fromEntries(
        vestingCampaigns.map((campaign) => [campaign.id, { status: "checking", message: "Checking wallet" } satisfies VestingCheck]),
      ),
    );

    async function checkVestings() {
      const results = await Promise.all(
        vestingCampaigns.map(async (campaign): Promise<[string, VestingCheck]> => {
          if (!campaign.airdropAddress || campaign.status !== "live") {
            return [campaign.id, { status: "missing", message: "Not live" }];
          }

          try {
            const response = await fetch(`/api/campaigns/${campaign.id}/vestings?recipient=${address}`, {
              cache: "no-store",
              signal: controller.signal,
            });
            if (response.ok) {
              const result = (await response.json().catch(() => null)) as { vestings?: unknown[] } | null;
              return [
                campaign.id,
                result?.vestings && result.vestings.length > 0
                  ? { status: "ready", message: `${result.vestings.length} schedule${result.vestings.length === 1 ? "" : "s"}` }
                  : { status: "missing", message: "No schedule" },
              ];
            }
            return [campaign.id, { status: "error", message: "Check failed" }];
          } catch (cause) {
            if (controller.signal.aborted) return [campaign.id, { status: "checking", message: "Checking wallet" }];
            return [campaign.id, { status: "error", message: cause instanceof Error ? cause.message : "Check failed" }];
          }
        }),
      );

      if (!controller.signal.aborted) {
        setVestingChecks(Object.fromEntries(results));
      }
    }

    checkVestings();
    return () => controller.abort();
  }, [address, vestingCampaigns]);

  const readyCampaigns = useMemo(
    () => claimCampaigns.filter((campaign) => claimChecks[campaign.id]?.status === "ready"),
    [claimCampaigns, claimChecks],
  );
  const claimedCampaigns = useMemo(
    () => claimCampaigns.filter((campaign) => claimChecks[campaign.id]?.status === "claimed"),
    [claimCampaigns, claimChecks],
  );
  const readyVestingCampaigns = useMemo(
    () => vestingCampaigns.filter((campaign) => vestingChecks[campaign.id]?.status === "ready"),
    [vestingCampaigns, vestingChecks],
  );
  const checking =
    Boolean(address) &&
    (claimCampaigns.some((campaign) => claimChecks[campaign.id]?.status === "checking") ||
      vestingCampaigns.some((campaign) => vestingChecks[campaign.id]?.status === "checking"));
  const primaryCampaign = readyCampaigns[0] ?? claimCampaigns[0] ?? null;
  const primaryCheck = primaryCampaign ? claimChecks[primaryCampaign.id] : undefined;
  const primaryVestingCampaign = readyVestingCampaigns[0] ?? vestingCampaigns[0] ?? null;
  const primaryVestingCheck = primaryVestingCampaign ? vestingChecks[primaryVestingCampaign.id] : undefined;
  const dashboardState = getDashboardState({
    connected: Boolean(address),
    campaignCount: claimCampaigns.length + vestingCampaigns.length,
    readyClaimCount: readyCampaigns.length,
    readyVestingCount: readyVestingCampaigns.length,
    claimedCount: claimedCampaigns.length,
    checking,
    hasError:
      Object.values(claimChecks).some((check) => check.status === "error") ||
      Object.values(vestingChecks).some((check) => check.status === "error"),
  });
  const hasReadyClaim = Boolean(primaryCampaign && primaryCheck?.status === "ready");
  const hasReadyVesting = Boolean(primaryVestingCampaign && primaryVestingCheck?.status === "ready");

  return (
    <section className="recipient-page recipient-page-clean" aria-labelledby="recipient-title">
      <div className="recipient-start panel">
        <div className="recipient-start-copy">
          <span className="product-kicker">
            <FileLock2 size={16} aria-hidden="true" />
            Recipient
          </span>
          <h1 id="recipient-title">{dashboardState.title}</h1>
          <p>{dashboardState.copy}</p>
        </div>

        <div className="recipient-flow-card" aria-label="Claim flow">
          <RecipientStep
            icon={<WalletCards size={18} aria-hidden="true" />}
            label="Wallet"
            value={address ? maskAddress(address) : "Connect"}
            state={address ? "done" : "active"}
          />
          <RecipientStep
            icon={checking ? <Clock3 size={18} aria-hidden="true" /> : readyCampaigns.length > 0 || readyVestingCampaigns.length > 0 || claimedCampaigns.length > 0 ? <CheckCircle2 size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
            label="Wallet check"
            value={
              !address
                ? "Waiting"
                : checking
                  ? "Checking"
                  : readyCampaigns.length > 0
                    ? "Claim ready"
                    : readyVestingCampaigns.length > 0
                      ? "Vesting ready"
                      : claimedCampaigns.length > 0
                        ? "Claimed"
                        : "No match"
            }
            state={!address ? "idle" : readyCampaigns.length > 0 || readyVestingCampaigns.length > 0 || claimedCampaigns.length > 0 ? "done" : checking ? "active" : "idle"}
          />
          <RecipientStep
            icon={readyCampaigns.length > 0 || readyVestingCampaigns.length > 0 ? <ArrowRight size={18} aria-hidden="true" /> : claimedCampaigns.length > 0 ? <CheckCircle2 size={18} aria-hidden="true" /> : <Clock3 size={18} aria-hidden="true" />}
            label="Open"
            value={readyCampaigns.length > 0 ? "Claim" : readyVestingCampaigns.length > 0 ? "Vesting" : claimedCampaigns.length > 0 ? "Done" : "Locked"}
            state={readyCampaigns.length > 0 || readyVestingCampaigns.length > 0 ? "active" : claimedCampaigns.length > 0 ? "done" : "idle"}
          />

          {hasReadyClaim && primaryCampaign ? (
            <Link className="button-primary recipient-primary-action" href={`/claim/${primaryCampaign.id}`}>
              Claim now <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : hasReadyVesting && primaryVestingCampaign ? (
            <Link className="button-primary recipient-primary-action" href={`/vesting/${primaryVestingCampaign.id}`}>
              Open vesting <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <button className="button-secondary recipient-primary-action" type="button" disabled>
              {address ? (checking ? "Checking" : claimedCampaigns.length > 0 ? "Already claimed" : "No match found") : "Connect wallet"}
            </button>
          )}
        </div>
      </div>

      {readyCampaigns.length > 1 ? (
        <section className="recipient-ready-list panel" aria-labelledby="ready-claims-title">
          <h2 id="ready-claims-title">Ready claims</h2>
          <div>
            {readyCampaigns.map((campaign) => (
              <Link className="recipient-ready-row" href={`/claim/${campaign.id}`} key={campaign.id}>
                <span>
                  <strong>{campaign.name}</strong>
                  <small>{maskAddress(campaign.tokenAddress)}</small>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {readyVestingCampaigns.length > 0 ? (
        <section className="recipient-ready-list panel" aria-labelledby="ready-vesting-title">
          <h2 id="ready-vesting-title">Vesting schedules</h2>
          <div>
            {readyVestingCampaigns.map((campaign) => (
              <Link className="recipient-ready-row" href={`/vesting/${campaign.id}`} key={campaign.id}>
                <span>
                  <strong>{campaign.name}</strong>
                  <small>{vestingChecks[campaign.id]?.message ?? maskAddress(campaign.tokenAddress)}</small>
                </span>
                <CalendarClock size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function RecipientStep({
  icon,
  label,
  value,
  state,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  state: "done" | "active" | "idle";
}) {
  return (
    <div className={`recipient-flow-step is-${state}`}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function getDashboardState({
  connected,
  campaignCount,
  readyClaimCount,
  readyVestingCount,
  claimedCount,
  checking,
  hasError,
}: {
  connected: boolean;
  campaignCount: number;
  readyClaimCount: number;
  readyVestingCount: number;
  claimedCount: number;
  checking: boolean;
  hasError: boolean;
}): { title: string; copy: string } {
  const readyCount = readyClaimCount + readyVestingCount;

  if (!campaignCount) return { title: "No distributions yet.", copy: "Live claims and schedules appear here." };
  if (!connected) return { title: "Connect wallet.", copy: "Matching claims and schedules appear automatically." };
  if (checking) return { title: "Checking wallet.", copy: "Matching this wallet." };
  if (readyCount > 0) {
    if (readyClaimCount > 0) return { title: readyClaimCount === 1 ? "Claim ready." : `${readyClaimCount} claims ready.`, copy: "Open the claim and confirm." };
    return { title: readyVestingCount === 1 ? "Vesting ready." : `${readyVestingCount} vesting schedules ready.`, copy: "Open vesting as tokens unlock." };
  }
  if (claimedCount > 0) return { title: claimedCount === 1 ? "Already claimed." : "Claims complete.", copy: "No pending claim." };
  if (hasError) return { title: "Check failed.", copy: "Refresh or reconnect wallet." };
  return { title: "No match found.", copy: "No live claim or schedule for this wallet." };
}

function isClaimCampaign(campaign: Campaign): boolean {
  return !campaign.kind || campaign.kind === "claim";
}

function isVestingCampaign(campaign: Campaign): boolean {
  return campaign.kind === "vesting";
}
