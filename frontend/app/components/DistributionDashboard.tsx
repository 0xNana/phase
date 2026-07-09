"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAirdropCanExtendClaimWindow,
  useAirdropEndTime,
  useAirdropHasClaimEnded,
  useAirdropIsPaused,
  useExtendClaimWindow,
  useSetPaused,
  useWithdraw,
} from "@tokenops/sdk/fhe-airdrop/react";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { zeroAddress, type Hex } from "viem";
import type { Campaign } from "@/lib/types";
import type { DistributionRecipientRow } from "@/lib/types";
import { absoluteUrl, dateInputToUnix, maskAddress, unixToDateInput } from "@/lib/format";
import { blockExplorerBaseUrl, explorerAddressUrl, sepoliaChainId } from "@/lib/env";
import {
  adminAccessMessage,
  adminAccessStorageKey,
  isCampaignCreator,
} from "@/lib/admin-access";
import {
  claimProgressPercent,
  distributionBadge,
  formatCountdown,
  formatUnixDate,
  formatUnixRange,
} from "@/lib/distribution-status";
import ConfirmDialog from "./ConfirmDialog";
import CopyButton from "./CopyButton";
import StatusBadge from "./StatusBadge";

type DistributionDashboardProps = {
  campaign: Campaign;
  deploymentTxHash?: string | null;
  onCampaignUpdate: (campaign: Campaign) => void;
  onLaunchNew?: () => void;
};

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export default function DistributionDashboard({
  campaign,
  deploymentTxHash,
  onCampaignUpdate,
  onLaunchNew,
}: DistributionDashboardProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const walletClient = useWalletClient();
  const queryClient = useQueryClient();
  const isCreator = isCampaignCreator(campaign, address);
  const [adminSignature, setAdminSignature] = useState<Hex | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessPending, setAccessPending] = useState(false);
  const airdropAddress = campaign.airdropAddress;
  const airdropHookAddress = airdropAddress ?? zeroAddress;
  const airdropOptions = { address: airdropHookAddress };
  const airdropReady = Boolean(airdropAddress);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [extendDate, setExtendDate] = useState(unixToDateInput(campaign.endTimestamp));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | "pause" | "resume" | "withdraw">(null);

  const endTimeQuery = useAirdropEndTime(airdropOptions);
  const pausedQuery = useAirdropIsPaused(airdropOptions);
  const canExtendQuery = useAirdropCanExtendClaimWindow(airdropOptions);
  const claimEndedQuery = useAirdropHasClaimEnded(airdropOptions);
  const extendWindow = useExtendClaimWindow(airdropOptions);
  const setPaused = useSetPaused(airdropOptions);
  const withdraw = useWithdraw(airdropOptions);

  const campaignQuery = useQuery({
    queryKey: ["phase", "campaign", campaign.id],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaign.id}`);
      const result = await readJsonResponse<{ campaign?: Campaign; error?: string }>(response);
      if (!response.ok || !result?.campaign) throw new Error(result?.error ?? "Could not refresh distribution");
      return result.campaign;
    },
    initialData: campaign,
    refetchInterval: 20_000,
  });

  const recipientsQuery = useQuery({
    queryKey: ["phase", "distribution-recipients", campaign.id, address, adminSignature],
    enabled: isCreator && Boolean(address && adminSignature),
    queryFn: async () => {
      const params = new URLSearchParams({
        admin: address as string,
        signature: adminSignature as string,
      });
      const response = await fetch(`/api/campaigns/${campaign.id}/claims?${params.toString()}`);
      const result = await readJsonResponse<{ recipients?: DistributionRecipientRow[]; error?: string }>(response);
      if (!response.ok || !result?.recipients) throw new Error(result?.error ?? "Could not load recipients");
      return result.recipients;
    },
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!address || !isCreator) {
      setAdminSignature(null);
      setAccessError(null);
      return;
    }

    const cacheKey = adminAccessStorageKey(campaign.id, address);
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached?.startsWith("0x")) {
      setAdminSignature(cached as Hex);
      return;
    }

    if (!walletClient.data) return;

    let cancelled = false;
    setAccessPending(true);
    setAccessError(null);

    void walletClient.data
      .signMessage({
        account: address,
        message: adminAccessMessage(campaign.id, address),
      })
      .then((signature) => {
        if (cancelled) return;
        window.sessionStorage.setItem(cacheKey, signature);
        setAdminSignature(signature);
      })
      .catch((cause) => {
        if (cancelled) return;
        setAccessError(cause instanceof Error ? cause.message : "Creator access signature required");
      })
      .finally(() => {
        if (!cancelled) setAccessPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address, campaign.id, isCreator, walletClient.data]);

  const activeCampaign = campaignQuery.data ?? campaign;
  const chainEndTimestamp = endTimeQuery.data ? Number(endTimeQuery.data) : activeCampaign.endTimestamp;

  useEffect(() => {
    onCampaignUpdate(activeCampaign);
  }, [activeCampaign, onCampaignUpdate]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setExtendDate(unixToDateInput(chainEndTimestamp));
  }, [chainEndTimestamp]);

  const technicalDetails = useMemo(
    () => [
      { label: "Contract", value: airdropAddress ? maskAddress(airdropAddress, 10, 8) : "—", href: airdropAddress ? explorerAddressUrl(airdropAddress) : undefined },
      {
        label: "Transaction hash",
        value: deploymentTxHash ? maskAddress(deploymentTxHash, 10, 8) : "—",
        href: deploymentTxHash ? `${blockExplorerBaseUrl}/tx/${deploymentTxHash}` : undefined,
      },
      { label: "Network", value: chainId === sepoliaChainId ? "Sepolia" : `Chain ${chainId}` },
      { label: "Deployment time", value: formatUnixDate(Math.floor(Date.parse(activeCampaign.createdAt) / 1000)) },
    ],
    [activeCampaign.createdAt, airdropAddress, chainId, deploymentTxHash],
  );

  if (!address) {
    return (
      <section className="distribution-dashboard-gate panel">
        <h1>Connect admin wallet</h1>
        <p>Connect the wallet that created this distribution to open the admin dashboard.</p>
      </section>
    );
  }

  if (!isCreator) {
    return (
      <section className="distribution-dashboard-gate panel">
        <h1>Creator access only</h1>
        <p>
          This dashboard is limited to the distribution creator
          {campaign.creator ? ` (${maskAddress(campaign.creator)})` : ""}. Public activity is available in observer view.
        </p>
        <Link className="button-secondary" href={`/observer/${campaign.id}`}>
          Open Observer View <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  if (accessPending && !adminSignature) {
    return (
      <section className="distribution-dashboard-gate panel">
        <h1>Confirm creator access</h1>
        <p>Sign the access message in your wallet to load recipient status.</p>
      </section>
    );
  }

  if (accessError && !adminSignature) {
    return (
      <section className="distribution-dashboard-gate panel">
        <h1>Creator access required</h1>
        <p>{accessError}</p>
        <button
          className="button-secondary"
          type="button"
          onClick={() => {
            if (!address) return;
            window.sessionStorage.removeItem(adminAccessStorageKey(campaign.id, address));
            setAccessError(null);
            setAdminSignature(null);
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const recipients = recipientsQuery.data ?? [];
  const isPaused = Boolean(pausedQuery.data);
  const canExtend = Boolean(canExtendQuery.data);
  const badge = distributionBadge(activeCampaign, now, { isPaused, endTimestamp: chainEndTimestamp });
  const claimPercent = claimProgressPercent(activeCampaign.claimsCount, activeCampaign.recipientCount);
  const countdownSeconds = Math.max(0, chainEndTimestamp - now);
  const countdownLabel =
    now < activeCampaign.startTimestamp
      ? `Opens in ${formatCountdown(activeCampaign.startTimestamp - now).replace(" remaining", "")}`
      : formatCountdown(countdownSeconds);

  const distributionHref = `/campaign/${activeCampaign.id}`;
  const distributionUrl = absoluteUrl(distributionHref);

  const opsBusy = extendWindow.isPending || setPaused.isPending || withdraw.isPending;

  async function refreshDistribution() {
    setErrorMessage(null);
    await Promise.all([campaignQuery.refetch(), recipientsQuery.refetch()]);
    setStatusMessage("Distribution refreshed.");
  }

  async function syncCampaignEndTimestamp(endTimestamp: number) {
    if (!address || !adminSignature) throw new Error("Creator access signature is required");
    const response = await fetch(`/api/campaigns/${activeCampaign.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endTimestamp, admin: address, signature: adminSignature }),
    });
    const result = await readJsonResponse<{ campaign?: Campaign; error?: string }>(response);
    if (!response.ok || !result?.campaign) throw new Error(result?.error ?? "Could not update distribution window");
    onCampaignUpdate(result.campaign);
    await campaignQuery.refetch();
  }

  async function handleExtendWindow() {
    if (!address || !airdropReady) return;
    setErrorMessage(null);
    const nextEnd = dateInputToUnix(extendDate, chainEndTimestamp);
    if (nextEnd <= chainEndTimestamp) {
      setErrorMessage("Choose a later close date than the current window.");
      return;
    }
    if (nextEnd <= now) {
      setErrorMessage("Choose a future close date.");
      return;
    }

    try {
      setStatusMessage("Extending claim window on-chain.");
      await extendWindow.mutateAsync({ newEndTime: nextEnd, account: address });
      await syncCampaignEndTimestamp(nextEnd);
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setStatusMessage("Claim window extended.");
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not extend claim window");
    }
  }

  async function handlePauseToggle(nextPaused: boolean) {
    if (!address || !airdropReady) return;
    setErrorMessage(null);
    try {
      setStatusMessage(nextPaused ? "Pausing claims." : "Resuming claims.");
      await setPaused.mutateAsync({ paused: nextPaused, account: address });
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      await pausedQuery.refetch();
      setStatusMessage(nextPaused ? "Claims paused." : "Claims resumed.");
      setPendingAction(null);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Could not update pause state");
      setPendingAction(null);
    }
  }

  async function handleWithdraw() {
    if (!address || !airdropReady) return;
    setErrorMessage(null);
    try {
      setStatusMessage("Withdrawing unclaimed tokens.");
      await withdraw.mutateAsync({ recipient: address, account: address });
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setStatusMessage("Unclaimed tokens withdrawn to your wallet.");
      setPendingAction(null);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : "Withdraw failed");
      setPendingAction(null);
    }
  }


  return (
    <section className="distribution-dashboard" aria-labelledby="distribution-dashboard-title">
      <header className="distribution-dashboard-header">
        <div>
          <p className="distribution-dashboard-eyebrow">Distribution dashboard</p>
          <div className="distribution-dashboard-title-row">
            <h1 id="distribution-dashboard-title">{activeCampaign.name}</h1>
            <StatusBadge badge={badge} />
          </div>
        </div>
        <div className="distribution-dashboard-header-actions">
          <button className="button-secondary" type="button" onClick={() => void refreshDistribution()} disabled={campaignQuery.isFetching}>
            <RefreshCcw size={15} aria-hidden="true" />
            Refresh
          </button>
          {onLaunchNew ? (
            <button className="button-ghost" type="button" onClick={onLaunchNew}>
              Launch new
            </button>
          ) : null}
        </div>
      </header>

      <div className="distribution-dashboard-stats panel">
        <Metric label="Claim window" value={formatUnixRange(activeCampaign.startTimestamp, chainEndTimestamp)} />
        <Metric label="Countdown" value={countdownLabel} />
        <Metric label="Token" value={maskAddress(activeCampaign.tokenAddress)} mono />
        <Metric label="Contract" value={airdropAddress ? maskAddress(airdropAddress) : "—"} mono />
        <Metric label="Recipients" value={activeCampaign.recipientCount.toLocaleString()} />
        <Metric label="Claims completed" value={`${activeCampaign.claimsCount.toLocaleString()} / ${activeCampaign.recipientCount.toLocaleString()}`} />
        <Metric label="Claim rate" value={`${claimPercent}%`} />
      </div>

      <div className="distribution-dashboard-progress panel">
        <div className="distribution-dashboard-progress-copy">
          <span>Claim progress</span>
          <strong>{claimPercent}%</strong>
        </div>
        <div className="progress-track" aria-hidden="true">
          <span style={{ width: `${claimPercent}%` }} />
        </div>
      </div>

      <section className="distribution-dashboard-actions panel" aria-label="Quick actions">
        <h2>Quick actions</h2>
        <div className="distribution-dashboard-action-grid">
          <Link className="button-secondary" href={distributionHref}>
            Open Distribution <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <CopyButton value={distributionUrl} label="Copy Distribution URL" />
        </div>
      </section>

      <section className="distribution-dashboard-recipients panel" aria-labelledby="distribution-recipients-title">
        <div className="distribution-dashboard-section-heading">
          <h2 id="distribution-recipients-title">Recipients</h2>
          <span>{recipients.length.toLocaleString()} wallets · amounts stay sealed</span>
        </div>
        <div className="distribution-dashboard-table-wrap">
          <table className="distribution-dashboard-table">
            <thead>
              <tr>
                <th scope="col">Wallet</th>
                <th scope="col">Reveal status</th>
                <th scope="col">Claim status</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={3}>No recipient activity yet.</td>
                </tr>
              ) : (
                recipients.map((row) => (
                  <tr key={row.recipient}>
                    <td className="mono">{row.maskedAddress}</td>
                    <td>
                      <RecipientPill tone={row.revealStatus === "revealed" ? "ready" : "idle"}>
                        {row.revealStatus === "revealed" ? "Revealed" : "Not revealed"}
                      </RecipientPill>
                    </td>
                    <td>
                      <RecipientPill tone={row.claimStatus === "claimed" ? "done" : "idle"}>
                        {row.claimStatus === "claimed" ? "Claimed" : "Not claimed"}
                      </RecipientPill>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="distribution-dashboard-ops panel" aria-labelledby="distribution-ops-title">
        <h2 id="distribution-ops-title">Distribution controls</h2>
        <div className="distribution-dashboard-ops-grid">
          <article className="distribution-dashboard-op-card">
            <div>
              <h3>Extend window</h3>
              <p>Push the claim close date if recipients need more time.</p>
            </div>
            {canExtend && airdropReady ? (
              <div className="distribution-dashboard-op-form">
                <label>
                  <span>New close date</span>
                  <input className="input" type="date" value={extendDate} onChange={(event) => setExtendDate(event.target.value)} />
                </label>
                <button className="button-secondary" type="button" disabled={opsBusy || !address} onClick={() => void handleExtendWindow()}>
                  Extend window
                </button>
              </div>
            ) : (
              <p className="distribution-dashboard-op-note">Window extension was disabled at deployment.</p>
            )}
          </article>

          <article className="distribution-dashboard-op-card">
            <div>
              <h3>{isPaused ? "Resume claims" : "Pause claims"}</h3>
              <p>Temporarily stop new claims without withdrawing the pool.</p>
            </div>
            <button
              className="button-secondary"
              type="button"
              disabled={opsBusy || !address}
              onClick={() => setPendingAction(isPaused ? "resume" : "pause")}
            >
              {isPaused ? <PlayCircle size={15} aria-hidden="true" /> : <PauseCircle size={15} aria-hidden="true" />}
              {isPaused ? "Resume claims" : "Pause claims"}
            </button>
          </article>

          <article className="distribution-dashboard-op-card">
            <div>
              <h3>Withdraw unclaimed</h3>
              <p>Return remaining confidential tokens to your admin wallet after the window closes.</p>
            </div>
            <button
              className="button-secondary"
              type="button"
              disabled={opsBusy || !address || !airdropReady || (!claimEndedQuery.data && badge !== "ended")}
              onClick={() => setPendingAction("withdraw")}
            >
              <Wallet size={15} aria-hidden="true" />
              Withdraw unclaimed
            </button>
          </article>
        </div>
      </section>

      <details className="distribution-dashboard-technical panel">
        <summary>
          <span>Technical details</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <dl className="distribution-dashboard-technical-grid">
          {technicalDetails.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd className={item.href ? "mono" : undefined}>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {item.value}
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {statusMessage ? <p className="distribution-dashboard-status">{statusMessage}</p> : null}
      {errorMessage ? <p className="distribution-dashboard-error">{errorMessage}</p> : null}

      <ConfirmDialog
        open={pendingAction === "pause"}
        title="Pause claims?"
        body={<p>Recipients will not be able to claim until you resume the distribution.</p>}
        confirmLabel="Pause claims"
        busy={opsBusy}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handlePauseToggle(true)}
      />
      <ConfirmDialog
        open={pendingAction === "resume"}
        title="Resume claims?"
        body={<p>Recipients can claim again while the window remains open.</p>}
        confirmLabel="Resume claims"
        busy={opsBusy}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handlePauseToggle(false)}
      />
      <ConfirmDialog
        open={pendingAction === "withdraw"}
        title="Withdraw unclaimed tokens?"
        body={<p>This sweeps remaining confidential tokens from the distribution contract to your connected wallet.</p>}
        confirmLabel="Withdraw"
        busy={opsBusy}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleWithdraw()}
      />
    </section>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="distribution-dashboard-metric">
      <span>{label}</span>
      <strong className={mono ? "mono" : undefined}>{value}</strong>
    </div>
  );
}

function RecipientPill({ children, tone }: { children: ReactNode; tone: "idle" | "ready" | "done" }) {
  return <span className={`distribution-recipient-pill is-${tone}`}>{children}</span>;
}
