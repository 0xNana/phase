"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FeeType, useClaim, useManagerFeeInfo, useVestingInfo, type ManagerFeeInfo, type VestingInfo } from "@tokenops/sdk/fhe-vesting/react";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Loader2, LockKeyhole, RefreshCcw, Send, WalletCards } from "lucide-react";
import { formatEther, type Address } from "viem";
import { useAccount } from "wagmi";
import { maskAddress } from "@/lib/format";
import type { Campaign, VestingScheduleRecord } from "@/lib/types";

type VestingLoadStatus = "disconnected" | "loading" | "ready" | "missing" | "error";

export default function RecipientVesting({ campaign }: { campaign: Campaign }) {
  const { address } = useAccount();
  const [vestings, setVestings] = useState<VestingScheduleRecord[]>([]);
  const [loadStatus, setLoadStatus] = useState<VestingLoadStatus>("disconnected");
  const [loadMessage, setLoadMessage] = useState("Connect wallet.");
  const managerAddress = campaign.airdropAddress;

  useEffect(() => {
    const controller = new AbortController();

    async function loadVestings() {
      if (!managerAddress || campaign.status !== "live") {
        setVestings([]);
        setLoadStatus("error");
        setLoadMessage("Vesting manager is not live.");
        return;
      }

      if (!address) {
        setVestings([]);
        setLoadStatus("disconnected");
        setLoadMessage("Connect wallet.");
        return;
      }

      setLoadStatus("loading");
      setLoadMessage("Checking vesting schedules.");

      const response = await fetch(`/api/campaigns/${campaign.id}/vestings?recipient=${address}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as { vestings?: VestingScheduleRecord[]; error?: string } | null;

      if (!response.ok || !result?.vestings) {
        setVestings([]);
        setLoadStatus("error");
        setLoadMessage(result?.error ?? "Could not check vesting schedules.");
        return;
      }

      const managerScopedVestings = result.vestings.filter(
        (record) => !record.managerAddress || record.managerAddress.toLowerCase() === managerAddress.toLowerCase(),
      );
      setVestings(managerScopedVestings);
      setLoadStatus(managerScopedVestings.length > 0 ? "ready" : "missing");
      setLoadMessage(managerScopedVestings.length > 0 ? "Vesting schedules loaded." : "No vesting schedule for this wallet.");
    }

    loadVestings().catch((cause) => {
      if (controller.signal.aborted) return;
      setVestings([]);
      setLoadStatus("error");
      setLoadMessage(errorMessage(cause));
    });

    return () => controller.abort();
  }, [address, campaign.id, campaign.status, managerAddress]);

  return (
    <section className="recipient-claim-page" aria-labelledby="vesting-title">
      <div className="recipient-claim-shell panel">
        <div className="recipient-claim-header">
          <span className="product-kicker">
            <CalendarClock size={16} aria-hidden="true" />
            Vesting
          </span>
          <h1 id="vesting-title">{campaign.name}</h1>
          <p>Track schedule. Claim vested tokens.</p>
        </div>

        {managerAddress && vestings.length > 0 && address ? (
          <VestingFlow campaign={campaign} managerAddress={managerAddress} vestings={vestings} user={address} />
        ) : (
          <VestingGate loadStatus={loadStatus} loadMessage={loadMessage} user={address} campaign={campaign} />
        )}
      </div>
    </section>
  );
}

function VestingFlow({
  campaign,
  managerAddress,
  vestings,
  user,
}: {
  campaign: Campaign;
  managerAddress: Address;
  vestings: VestingScheduleRecord[];
  user: Address;
}) {
  const feeInfo = useManagerFeeInfo({ address: managerAddress });
  const stage = feeInfo.isLoading ? "checking" : feeInfo.isError ? "blocked" : "ready";
  const stageCopy = getStageCopy(stage, vestings.length);
  const blockedMessage = feeInfo.error?.message ?? null;

  return (
    <div className="recipient-claim-body">
      <div className={`recipient-claim-stage is-${stage}`} aria-live="polite">
        <span className="recipient-claim-icon">{stageCopy.icon}</span>
        <div>
          <span className={stage === "ready" ? "pill pill-live" : stage === "checking" ? "pill pill-watch" : "pill pill-sealed"}>
            {stageCopy.kicker}
          </span>
          <h2>{stageCopy.title}</h2>
          <p>{stageCopy.copy}</p>
        </div>

        {blockedMessage ? (
          <div className="recipient-claim-alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{blockedMessage}</span>
          </div>
        ) : null}
      </div>

      <div className="recipient-simple-steps">
        <VestingStep label="Wallet" value={maskAddress(user)} done />
        <VestingStep label="Schedules" value={`${vestings.length}`} done={stage === "ready"} active={stage === "checking"} />
        <VestingStep label="Claim" value={stage === "ready" ? "When vested" : "Locked"} active={stage === "ready"} />
      </div>

      <div className="recipient-claim-meta" aria-label="Vesting details">
        <MetaItem label="Manager" value={maskAddress(managerAddress)} />
        <MetaItem label="Token" value={maskAddress(campaign.tokenAddress)} />
        <MetaItem label="Fee" value={formatFee(feeInfo.data)} />
      </div>

      <div className="recipient-vesting-list" aria-label="Vesting schedules">
        {vestings.map((vesting, index) => (
          <VestingScheduleRow
            feeInfo={feeInfo.data}
            feePending={feeInfo.isLoading}
            index={index}
            key={`${vesting.vestingId}-${index}`}
            managerAddress={managerAddress}
            record={vesting}
          />
        ))}
      </div>
    </div>
  );
}

function VestingScheduleRow({
  record,
  index,
  managerAddress,
  feeInfo,
  feePending,
}: {
  record: VestingScheduleRecord;
  index: number;
  managerAddress: Address;
  feeInfo?: ManagerFeeInfo;
  feePending: boolean;
}) {
  const queryClient = useQueryClient();
  const [lastError, setLastError] = useState<string | null>(null);
  const [claimSent, setClaimSent] = useState(false);
  const vestingInfo = useVestingInfo({ address: managerAddress, vestingId: record.vestingId });
  const claim = useClaim({ address: managerAddress });
  const timing = getVestingTiming(vestingInfo.data);
  const canClaim = Boolean(feeInfo) && !feePending && !claimSent && !claim.isPending && timing.canAttemptClaim;

  const claimVested = useCallback(async () => {
    setLastError(null);

    if (!feeInfo) {
      setLastError("Claim fee is still loading.");
      return;
    }

    try {
      if (feeInfo.feeType === FeeType.Gas) {
        await claim.mutateAsync({
          vestingId: record.vestingId,
          feeType: FeeType.Gas,
          value: feeInfo.fee,
        });
      } else {
        await claim.mutateAsync({
          vestingId: record.vestingId,
          feeType: FeeType.DistributionToken,
        });
      }
      setClaimSent(true);
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-vesting"] });
    } catch (cause) {
      setLastError(errorMessage(cause));
    }
  }, [claim, feeInfo, queryClient, record.vestingId]);

  return (
    <div className="recipient-vesting-row">
      <div className="recipient-vesting-row-main">
        <span className={`pill ${claimSent ? "pill-live" : timing.tone === "ready" ? "pill-live" : timing.tone === "checking" ? "pill-watch" : "pill-sealed"}`}>
          {claimSent ? "Submitted" : timing.label}
        </span>
        <strong>Schedule {index + 1}</strong>
        <small className="mono">{maskAddress(record.vestingId, 10, 8)}</small>
      </div>

      <div className="recipient-vesting-row-meta">
        <span>{vestingInfo.isLoading ? "Loading schedule" : vestingInfo.isError ? "Schedule unavailable" : timing.detail}</span>
        {record.txHash ? <span className="mono">Tx {maskAddress(record.txHash, 8, 6)}</span> : null}
      </div>

      <button className="button-primary recipient-vesting-row-action" type="button" disabled={!canClaim} onClick={() => void claimVested()}>
        {claim.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : claimSent ? <CheckCircle2 size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        {claim.isPending ? "Claiming" : claimSent ? "Claim sent" : "Claim vested"}
      </button>

      {lastError || vestingInfo.error ? (
        <div className="recipient-claim-alert recipient-vesting-row-alert">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{lastError ?? vestingInfo.error?.message}</span>
        </div>
      ) : null}
    </div>
  );
}

function VestingGate({
  loadStatus,
  loadMessage,
  user,
  campaign,
}: {
  loadStatus: VestingLoadStatus;
  loadMessage: string;
  user?: Address;
  campaign: Campaign;
}) {
  const state = getGateState(loadStatus);

  return (
    <div className="recipient-claim-body">
      <div className={`recipient-claim-stage is-${state.stage}`}>
        <span className="recipient-claim-icon">{state.icon}</span>
        <div>
          <span className="pill pill-watch">{state.kicker}</span>
          <h2>{state.title}</h2>
          <p>{loadMessage}</p>
        </div>
        {loadStatus === "error" ? (
          <button className="button-secondary recipient-claim-button" type="button" onClick={() => window.location.reload()}>
            <RefreshCcw size={15} aria-hidden="true" />
            Reload
          </button>
        ) : (
          <button className="button-secondary recipient-claim-button" type="button" disabled>
            {state.button}
          </button>
        )}
      </div>

      <div className="recipient-simple-steps">
        <VestingStep label="Wallet" value={user ? maskAddress(user) : "Connect"} done={Boolean(user)} active={!user} />
        <VestingStep label="Schedule" value={loadStatus === "loading" ? "Checking" : loadStatus === "ready" ? "Found" : "Waiting"} active={loadStatus === "loading"} />
        <VestingStep label="Claim" value="Locked" />
      </div>

      <div className="recipient-claim-meta" aria-label="Vesting details">
        <MetaItem label="Manager" value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "Not live"} />
        <MetaItem label="Token" value={maskAddress(campaign.tokenAddress)} />
        <MetaItem label="Status" value={campaign.status} />
      </div>
    </div>
  );
}

function VestingStep({ label, value, done, active }: { label: string; value: string; done?: boolean; active?: boolean }) {
  return (
    <div className={`recipient-simple-step ${done ? "is-done" : active ? "is-active" : ""}`}>
      <span>{done ? <CheckCircle2 size={16} aria-hidden="true" /> : active ? <Clock3 size={16} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={mono ? "mono" : undefined}>{value}</strong>
    </div>
  );
}

function getGateState(status: VestingLoadStatus): { stage: "checking" | "blocked"; icon: ReactNode; kicker: string; title: string; button: string } {
  if (status === "loading") {
    return {
      stage: "checking",
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "Checking",
      title: "Checking vesting",
      button: "Checking",
    };
  }
  if (status === "disconnected") {
    return {
      stage: "blocked",
      icon: <WalletCards size={34} aria-hidden="true" />,
      kicker: "Wallet",
      title: "Connect wallet",
      button: "Connect wallet",
    };
  }
  return {
    stage: "blocked",
    icon: <AlertCircle size={34} aria-hidden="true" />,
    kicker: status === "missing" ? "No schedule" : "Unavailable",
    title: status === "missing" ? "No vesting found" : "Vesting unavailable",
    button: "Claim locked",
  };
}

function getStageCopy(stage: "ready" | "checking" | "blocked", count: number): { icon: ReactNode; kicker: string; title: string; copy: string } {
  if (stage === "ready") {
    return {
      icon: <Send size={34} aria-hidden="true" />,
      kicker: "Ready",
      title: count === 1 ? "Vesting schedule found" : `${count} vesting schedules found`,
      copy: "Claim as each schedule unlocks. Amounts stay sealed.",
    };
  }
  if (stage === "checking") {
    return {
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "Checking",
      title: "Checking fee",
      copy: "Reading manager fee before claims open.",
    };
  }
  return {
    icon: <AlertCircle size={34} aria-hidden="true" />,
    kicker: "Blocked",
    title: "Vesting unavailable",
    copy: "Fix the blocker and reload.",
  };
}

function getVestingTiming(info?: VestingInfo): { label: string; detail: string; tone: "ready" | "checking" | "blocked"; canAttemptClaim: boolean } {
  if (!info) return { label: "Checking", detail: "Reading schedule", tone: "checking", canAttemptClaim: false };

  const now = Math.floor(Date.now() / 1000);
  const cliffTimestamp = Number(info.cliffReleaseTimestamp);
  const startTimestamp = Number(info.startTimestamp);
  const endTimestamp = Number(info.endTimestamp);
  const revokeTimestamp = Number(info.revokeTimestamp);
  const unlockTimestamp = Math.max(startTimestamp, cliffTimestamp || startTimestamp);

  if (startTimestamp > now) {
    return { label: "Scheduled", detail: `Starts ${formatDate(startTimestamp)}`, tone: "blocked", canAttemptClaim: false };
  }
  if (unlockTimestamp > now) {
    return { label: "Cliff", detail: `Unlocks ${formatDate(unlockTimestamp)}`, tone: "blocked", canAttemptClaim: false };
  }
  if (revokeTimestamp > 0 && revokeTimestamp <= now) {
    return { label: "Revoked", detail: `Revoked ${formatDate(revokeTimestamp)}`, tone: "ready", canAttemptClaim: true };
  }
  if (endTimestamp <= now) {
    return { label: "Fully vested", detail: `Ended ${formatDate(endTimestamp)}`, tone: "ready", canAttemptClaim: true };
  }

  return { label: "Vesting", detail: `Ends ${formatDate(endTimestamp)}`, tone: "ready", canAttemptClaim: true };
}

function formatFee(feeInfo?: ManagerFeeInfo): string {
  if (!feeInfo) return "Checking";
  if (feeInfo.feeType === FeeType.DistributionToken) return "Token fee";
  if (feeInfo.fee === 0n) return "0 ETH";
  return `${formatEther(feeInfo.fee)} ETH`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Vesting could not load.";
}
