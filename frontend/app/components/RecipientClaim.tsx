"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUserDecrypt } from "@zama-fhe/react-sdk";
import { createConfidentialAirdropClient, type PreflightResult } from "@tokenops/sdk/fhe-airdrop";
import {
  useAirdropGasFee,
  useAirdropIsClaimWindowActive,
  useAirdropIsSignatureClaimed,
  useAirdropIsSignatureValid,
  useClaim,
  useGetClaimAmount,
} from "@tokenops/sdk/fhe-airdrop/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Eye,
  Fingerprint,
  KeyRound,
  Loader2,
  LockKeyhole,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatTokenUnits, maskAddress } from "@/lib/format";
import type { Campaign, ClaimPayload } from "@/lib/types";

type ClaimLoadStatus = "disconnected" | "loading" | "ready" | "missing" | "error";
type ClaimMarkState = "revealed" | "claimed";
type ClaimPreflightState = {
  status: "idle" | "checking" | "ready" | "blocked" | "error";
  result?: PreflightResult;
  error?: string;
};

export default function RecipientClaim({ campaign }: { campaign: Campaign }) {
  const { address } = useAccount();
  const [claimPayload, setClaimPayload] = useState<ClaimPayload | null>(null);
  const [loadStatus, setLoadStatus] = useState<ClaimLoadStatus>("disconnected");
  const [loadState, setLoadState] = useState("Connect eligible wallet.");

  useEffect(() => {
    let cancelled = false;

    async function loadClaim() {
      if (!campaign.airdropAddress) {
        setClaimPayload(null);
        setLoadStatus("error");
        setLoadState("Airdrop not created yet.");
        return;
      }

      if (!address) {
        setClaimPayload(null);
        setLoadStatus("disconnected");
        setLoadState("Connect eligible wallet.");
        return;
      }

      setLoadStatus("loading");
      setLoadState("Checking eligibility.");

      const response = await fetch(`/api/campaigns/${campaign.id}/claim?recipient=${address}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as { claim?: ClaimPayload; error?: string };

      if (cancelled) return;

      if (!response.ok || !result.claim) {
        setClaimPayload(null);
        setLoadStatus(response.status === 404 ? "missing" : "error");
        setLoadState(result.error ?? "No allocation for this wallet.");
        return;
      }

      setClaimPayload(result.claim);
      setLoadStatus("ready");
      setLoadState("Payload loaded. Reveal when ready.");
    }

    loadClaim().catch((cause) => {
      if (!cancelled) {
        setClaimPayload(null);
        setLoadStatus("error");
        setLoadState(errorMessage(cause));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [address, campaign.airdropAddress, campaign.id]);

  return (
    <section className="workspace-panel overflow-hidden">
      <div className="grid gap-5 border-b border-[var(--line)] bg-white p-6 lg:grid-cols-[minmax(0,1fr)_168px]">
        <div>
          <span className="pill pill-sealed">Claim</span>
          <h1 className="mt-3 text-3xl font-[790] leading-tight">Reveal allocation</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Decrypt privately, then claim. Public views show proof activity only.</p>
        </div>
        <div className="grid h-[132px] place-items-center rounded-phase border border-[var(--line)] bg-[var(--surface-soft)]">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-[rgba(104,64,198,0.22)] bg-white text-[var(--primary)]">
            <Fingerprint size={40} aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="p-5">
        {campaign.airdropAddress && claimPayload && address ? (
          <ClaimFlow campaign={campaign} claimPayload={claimPayload} user={address} />
        ) : (
          <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
            <ClaimUnavailable loadStatus={loadStatus} loadState={loadState} />
            <PortalSidebar
              campaign={campaign}
              user={address}
              claimPayload={claimPayload}
              hasPayload={false}
              revealed={false}
              claimed={false}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ClaimFlow({
  campaign,
  claimPayload,
  user,
}: {
  campaign: Campaign;
  claimPayload: ClaimPayload;
  user: Address;
}) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [viewHandle, setViewHandle] = useState<Hex | null>(null);
  const [decryptEnabled, setDecryptEnabled] = useState(false);
  const [markedRevealed, setMarkedRevealed] = useState(Boolean(claimPayload.revealedAt));
  const [markedClaimed, setMarkedClaimed] = useState(Boolean(claimPayload.claimedAt));
  const [revealedAt, setRevealedAt] = useState(claimPayload.revealedAt);
  const [claimedAt, setClaimedAt] = useState(claimPayload.claimedAt);
  const [claimState, setClaimState] = useState(
    claimPayload.claimedAt
      ? "Claimed. Amount hidden publicly."
      : "Reveal before claiming.",
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [preflightState, setPreflightState] = useState<ClaimPreflightState>({ status: "idle" });
  const airdropAddress = campaign.airdropAddress as Address;
  const airdropClient = useMemo(() => {
    if (!publicClient) return null;
    return createConfidentialAirdropClient({
      publicClient,
      walletClient,
      address: airdropAddress,
    });
  }, [airdropAddress, publicClient, walletClient]);

  const windowActive = useAirdropIsClaimWindowActive({ address: airdropAddress });
  const claimed = useAirdropIsSignatureClaimed({
    address: airdropAddress,
    user,
    encryptedAmountHandle: claimPayload.encryptedInput.handle,
  });
  const signatureValid = useAirdropIsSignatureValid({
    address: airdropAddress,
    encryptedAmountHandle: claimPayload.encryptedInput.handle,
    signature: claimPayload.signature,
    caller: user,
  });
  const gasFee = useAirdropGasFee({ address: airdropAddress });
  const getClaimAmount = useGetClaimAmount({ address: airdropAddress });
  const claim = useClaim({ address: airdropAddress });
  const decrypt = useUserDecrypt(
    {
      handles: viewHandle ? [{ handle: viewHandle, contractAddress: airdropAddress }] : [],
    },
    { enabled: Boolean(viewHandle && decryptEnabled) },
  );

  const decryptedAmount = useMemo(() => {
    if (!viewHandle || !decrypt.data) return null;
    const values = decrypt.data as Record<string, bigint | number | string>;
    const value = values[viewHandle] ?? values[viewHandle.toLowerCase()] ?? Object.values(values)[0];
    if (value === undefined) return null;
    return BigInt(value);
  }, [decrypt.data, viewHandle]);

  const mark = useCallback(
    async (state: ClaimMarkState) => {
      const response = await fetch(`/api/campaigns/${campaign.id}/claim`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient: user, state }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? `Could not mark claim as ${state}`);
      }
    },
    [campaign.id, user],
  );

  const runPreflight = useCallback(async () => {
    if (!airdropClient) {
      setPreflightState({ status: "idle" });
      return null;
    }

    setPreflightState({ status: "checking" });
    try {
      const result = await airdropClient.preflightClaim({
        caller: user,
        encryptedAmountHandle: claimPayload.encryptedInput.handle,
      });
      setPreflightState({ status: result.ready ? "ready" : "blocked", result });
      return result;
    } catch (cause) {
      const message = errorMessage(cause);
      setPreflightState({ status: "error", error: message });
      return null;
    }
  }, [airdropClient, claimPayload.encryptedInput.handle, user]);

  useEffect(() => {
    let cancelled = false;

    async function checkClaim() {
      if (!airdropClient) {
        setPreflightState({ status: "idle" });
        return;
      }

      setPreflightState({ status: "checking" });
      try {
        const result = await airdropClient.preflightClaim({
          caller: user,
          encryptedAmountHandle: claimPayload.encryptedInput.handle,
        });
        if (!cancelled) setPreflightState({ status: result.ready ? "ready" : "blocked", result });
      } catch (cause) {
        if (!cancelled) setPreflightState({ status: "error", error: errorMessage(cause) });
      }
    }

    checkClaim();
    return () => {
      cancelled = true;
    };
  }, [airdropClient, claimPayload.encryptedInput.handle, user]);

  useEffect(() => {
    if (decryptedAmount === null) return;
    setClaimState("Amount revealed. Claim when ready.");

    if (markedRevealed) return;
    setMarkedRevealed(true);
    setRevealedAt(new Date().toISOString());
    mark("revealed").catch((cause) => {
      setLastError(errorMessage(cause));
    });
  }, [decryptedAmount, mark, markedRevealed]);

  useEffect(() => {
    if (!decrypt.isError) return;
    setLastError(errorMessage(decrypt.error));
    setClaimState("Decrypt cancelled.");
  }, [decrypt.error, decrypt.isError]);

  async function reveal() {
    setLastError(null);
    setClaimState("Requesting access.");

    try {
      const result = await getClaimAmount.mutateAsync({
        encryptedInput: claimPayload.encryptedInput,
        signature: claimPayload.signature,
      });
      setViewHandle(result.handle);
      setDecryptEnabled(true);
      setClaimState("Approve decrypt in wallet.");
    } catch (cause) {
      setLastError(errorMessage(cause));
      setClaimState("Reveal failed.");
    }
  }

  async function claimTokens() {
    setLastError(null);
    setClaimState("Running claim preflight.");

    try {
      const report = await runPreflight();
      if (!report?.ready) {
        setLastError(preflightBlockerMessage(report) ?? "Claim preflight blocked this transaction.");
        setClaimState("Claim blocked.");
        return;
      }

      setClaimState("Submitting claim.");
      await claim.mutateAsync({
        encryptedInput: claimPayload.encryptedInput,
        signature: claimPayload.signature,
        value: gasFee.data,
      });
      await mark("claimed");
      setMarkedClaimed(true);
      setClaimedAt(new Date().toISOString());
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
      setClaimState("Claimed. Amount stays private.");
    } catch (cause) {
      setLastError(errorMessage(cause));
      setClaimState("Claim failed.");
    }
  }

  const alreadyClaimed = markedClaimed || claimed.data === true;
  const sdkChecksReady = windowActive.data === true && signatureValid.data === true && claimed.data === false && !markedClaimed;
  const claimPreflightReady = preflightState.status === "ready";
  const revealPending = getClaimAmount.isPending || decrypt.isPending;
  const canReveal = sdkChecksReady && !viewHandle && !revealPending;
  const hasDecryptedAmount = decryptedAmount !== null;
  const canClaim = sdkChecksReady && claimPreflightReady && hasDecryptedAmount && !claim.isPending;
  const isRevealed = hasDecryptedAmount || markedRevealed;
  const blockingMessage =
    lastError ??
    signatureValid.error?.message ??
    (preflightState.status === "blocked" ? preflightBlockerMessage(preflightState.result) : null) ??
    (preflightState.status === "error" ? preflightState.error ?? "Claim preflight unavailable." : null);
  const statusLabel = alreadyClaimed
    ? "Claimed"
    : hasDecryptedAmount
      ? "Unsealed"
      : markedRevealed
        ? "Access granted"
        : revealPending
          ? "Decrypting"
          : "Sealed";
  const activeHandle = viewHandle ?? claimPayload.encryptedInput.handle;

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-raised)] p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-11 w-11 flex-none place-items-center rounded-phase border border-[rgba(104,64,198,0.2)] bg-[rgba(104,64,198,0.08)] text-[var(--primary)]">
                {alreadyClaimed ? <CheckCircle2 size={22} aria-hidden="true" /> : isRevealed ? <KeyRound size={22} aria-hidden="true" /> : <LockKeyhole size={22} aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-[780] leading-tight">Your allocation</h2>
                <p className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[var(--muted)]">
                  Issued {formatDate(claimPayload.issuedAt)} - {maskAddress(claimPayload.encryptedInput.handle, 10, 8)}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="block text-xs font-bold text-[var(--muted)]">Status</span>
              <span className={alreadyClaimed || isRevealed ? "pill pill-live mt-2" : "pill pill-sealed mt-2"}>{statusLabel}</span>
            </div>
          </div>

          <div className={`recipient-confidential-card grid min-h-[390px] place-items-center p-5 text-center ${isRevealed ? "is-revealed" : ""}`}>
            <div className="grid w-full max-w-[560px] justify-items-center">
              <div
                className={`relative grid h-20 w-20 place-items-center rounded-full border ${
                  alreadyClaimed || isRevealed
                    ? "border-[rgba(20,122,80,0.25)] bg-[rgba(20,122,80,0.1)] text-[var(--green)]"
                    : "border-[var(--line)] bg-white text-[var(--primary)]"
                }`}
              >
                {alreadyClaimed ? <CheckCircle2 size={40} aria-hidden="true" /> : isRevealed ? <KeyRound size={40} aria-hidden="true" /> : <LockKeyhole size={40} aria-hidden="true" />}
                {!isRevealed ? <span className="fhe-pulse absolute inset-0 rounded-full border-2 border-[rgba(104,64,198,0.22)]" /> : null}
              </div>

              <div className="mt-6">
                <span className="block text-xs font-bold uppercase text-[var(--muted)]">Encrypted allocation</span>
                {decryptedAmount !== null ? (
                  <strong className="recipient-allocation-value mono mt-3 block text-4xl font-[780] leading-tight text-[var(--ink)] sm:text-5xl">
                    {formatTokenUnits(decryptedAmount)} cUSDC
                  </strong>
                ) : (
                  <span className="recipient-allocation-value is-sealed masked sealed-allocation-mask mt-3" aria-label="Encrypted allocation sealed" />
                )}
                <p className="mx-auto mt-4 max-w-[430px] text-sm leading-6 text-[var(--muted)]">
                  {decryptedAmount !== null
                    ? "Visible only to this wallet."
                    : markedRevealed
                      ? "Access granted. Decrypt again to view."
                      : "Sealed until wallet approval."}
                </p>
              </div>

              <div className="mt-7 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:justify-center">
                <button className="button-primary min-w-[210px]" type="button" disabled={!canReveal || alreadyClaimed} onClick={reveal}>
                  {revealPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  {revealPending ? "Decrypting" : hasDecryptedAmount ? "Allocation revealed" : markedRevealed ? "Decrypt amount" : "Reveal allocation"}
                </button>
                <button className="button-secondary min-w-[190px]" type="button" disabled={!canClaim || alreadyClaimed} onClick={claimTokens}>
                  {claim.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  {alreadyClaimed ? "Claimed" : "Claim allocation"}
                </button>
              </div>

              <p className="mt-5 min-h-[24px] text-sm leading-6 text-[var(--muted)]">{claimState}</p>
              {blockingMessage ? (
                <p className="mt-2 flex max-w-[520px] items-center justify-center gap-2 text-sm leading-6 text-red-700">
                  <AlertCircle size={16} aria-hidden="true" />
                  {blockingMessage}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-center gap-2">
              <span className="fhe-pulse h-2 w-2 rounded-full bg-[var(--primary)]" />
              <span className="text-sm font-bold">FHE channel</span>
            </div>
            <span className="mono max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[var(--muted)]">
              {maskAddress(activeHandle, 12, 10)}
            </span>
          </div>
        </section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StateTile
            icon={<Clock3 size={16} aria-hidden="true" />}
            label="Claim window"
            state={windowActive.data === true ? "Open" : windowActive.data === false ? "Closed" : "Checking"}
            tone={windowActive.data === true ? "good" : "watch"}
          />
          <StateTile
            icon={<ShieldCheck size={16} aria-hidden="true" />}
            label="Signature"
            state={signatureValid.data === true ? "Valid" : signatureValid.data === false ? "Invalid" : "Checking"}
            tone={signatureValid.data === true ? "good" : "watch"}
          />
          <StateTile
            icon={<ShieldCheck size={16} aria-hidden="true" />}
            label="Preflight"
            state={preflightStatusLabel(preflightState)}
            tone={claimPreflightReady ? "good" : "watch"}
          />
          <StateTile
            icon={<KeyRound size={16} aria-hidden="true" />}
            label="Claim fee"
            state={gasFee.isError ? "Unavailable" : formatNativeFee(gasFee.data)}
            tone={gasFee.data !== undefined ? "good" : "watch"}
          />
          <StateTile
            icon={<CheckCircle2 size={16} aria-hidden="true" />}
            label="Claim state"
            state={alreadyClaimed ? "Claimed" : claimed.data === false ? "Unclaimed" : "Checking"}
            tone={alreadyClaimed ? "good" : "watch"}
          />
        </div>

        <ClaimHistory
          claimPayload={claimPayload}
          decryptedAmount={decryptedAmount}
          revealed={markedRevealed || decryptedAmount !== null}
          claimed={alreadyClaimed}
          revealedAt={revealedAt}
          claimedAt={claimedAt}
        />
      </div>

      <PortalSidebar
        campaign={campaign}
        user={user}
        claimPayload={claimPayload}
        hasPayload
        revealed={markedRevealed || decryptedAmount !== null}
        claimed={alreadyClaimed}
        windowOpen={windowActive.data}
        signatureOk={signatureValid.data}
        preflight={preflightState}
        gasFee={gasFee.data}
      />
    </div>
  );
}

function ClaimUnavailable({ loadStatus, loadState }: { loadStatus: ClaimLoadStatus; loadState: string }) {
  const icon =
    loadStatus === "loading" ? (
      <Loader2 size={38} className="animate-spin" aria-hidden="true" />
    ) : loadStatus === "missing" || loadStatus === "error" ? (
      <AlertCircle size={38} aria-hidden="true" />
    ) : (
      <WalletCards size={38} aria-hidden="true" />
    );

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--surface-raised)] p-5">
        <h2 className="text-xl font-[780] leading-tight">Connect wallet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Eligibility check starts after connect.</p>
      </div>

      <div className="recipient-confidential-card grid min-h-[390px] place-items-center p-5 text-center">
        <div className="grid max-w-[520px] justify-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--primary)]">
            {icon}
          </div>
          <span className="mt-6 block text-xs font-bold uppercase text-[var(--muted)]">Encrypted allocation</span>
          <span className="recipient-allocation-value is-sealed masked sealed-allocation-mask mt-3" aria-label="Encrypted allocation sealed" />
          <p className="mt-5 max-w-[400px] text-sm leading-6 text-[var(--muted)]">{loadState}</p>
        </div>
      </div>
    </section>
  );
}

function PortalSidebar({
  campaign,
  user,
  claimPayload,
  hasPayload,
  revealed,
  claimed,
  windowOpen,
  signatureOk,
  preflight,
  gasFee,
}: {
  campaign: Campaign;
  user?: Address;
  claimPayload: ClaimPayload | null;
  hasPayload: boolean;
  revealed: boolean;
  claimed: boolean;
  windowOpen?: boolean;
  signatureOk?: boolean;
  preflight?: ClaimPreflightState;
  gasFee?: bigint;
}) {
  return (
    <aside className="grid content-start gap-5">
      <section className="panel bg-[var(--navy)] p-5 text-white">
        <div className="flex items-center gap-2 text-[#6ee7d8]">
          <ShieldCheck size={18} aria-hidden="true" />
          <h2 className="font-bold">Access</h2>
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-white/60">Session</span>
            <span className="mono text-[#6ee7d8]">{user ? maskAddress(user) : "Not connected"}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-white/60">Payload</span>
            <span>{hasPayload ? "Loaded" : "Sealed"}</span>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">Checks</h2>
        <div className="mt-4 grid gap-2">
          <HealthRow label="Claim window" value={windowOpen === true ? "Open" : windowOpen === false ? "Closed" : "Checking"} good={windowOpen === true} />
          <HealthRow label="Signature" value={signatureOk === true ? "Valid" : signatureOk === false ? "Invalid" : "Checking"} good={signatureOk === true} />
          <HealthRow label="Preflight" value={preflightStatusLabel(preflight)} good={preflight?.status === "ready"} />
          <HealthRow label="Claim fee" value={formatNativeFee(gasFee)} good={gasFee !== undefined} />
          <HealthRow label="Airdrop contract" value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "Missing"} good={Boolean(campaign.airdropAddress)} />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">Claim lifecycle</h2>
        <div className="mt-4 grid gap-3">
          <FlowStep done={hasPayload} active={!hasPayload} label="Load payload" copy="Eligible wallet only." />
          <FlowStep done={revealed} active={hasPayload && !revealed} label="Reveal" copy="Approve wallet decrypt." />
          <FlowStep done={claimed} active={revealed && !claimed} label="Claim" copy="Submit signed payload." />
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-bold">Public data</h2>
        <div className="mt-4 grid gap-2 text-sm">
          <InfoRow label="Status" value={campaign.status} />
          <InfoRow label="Claims" value={campaign.claimsCount.toLocaleString()} />
          <InfoRow label="Recipients" value="sealed" />
          <InfoRow label="Amount" value="sealed" />
          <InfoRow label="Proof" value={claimPayload ? maskAddress(claimPayload.signature, 10, 8) : "hidden"} mono />
        </div>
      </section>
    </aside>
  );
}

function ClaimHistory({
  claimPayload,
  decryptedAmount,
  revealed,
  claimed,
  revealedAt,
  claimedAt,
}: {
  claimPayload: ClaimPayload;
  decryptedAmount: bigint | null;
  revealed: boolean;
  claimed: boolean;
  revealedAt?: string;
  claimedAt?: string;
}) {
  const amount = decryptedAmount === null ? "sealed" : `${formatTokenUnits(decryptedAmount)} cUSDC`;
  const rows = [
    {
      date: formatDate(claimPayload.issuedAt),
      action: "Payload issued",
      amount: "sealed",
      status: "Encrypted",
      proof: maskAddress(claimPayload.encryptedInput.handle, 10, 8),
      tone: "sealed" as const,
    },
    {
      date: revealed ? formatDate(revealedAt) : "Pending",
      action: "Reveal",
      amount,
      status: revealed ? "Revealed" : "Awaiting wallet",
      proof: maskAddress(claimPayload.signature, 10, 8),
      tone: revealed ? ("live" as const) : ("watch" as const),
    },
    {
      date: claimed ? formatDate(claimedAt) : "Pending",
      action: "Claim",
      amount: claimed ? "sealed" : "pending",
      status: claimed ? "Claimed" : "Not claimed",
      proof: maskAddress(claimPayload.signature, 10, 8),
      tone: claimed ? ("live" as const) : ("watch" as const),
    },
  ];

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-white p-5">
        <div>
          <h2 className="text-lg font-bold">Claim history</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Private amounts, public-safe refs.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead className="border-b border-[var(--line)] bg-[var(--surface-soft)] text-xs font-bold uppercase text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Action</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {rows.map((row) => (
              <tr key={row.action} className="bg-white">
                <td className="px-5 py-4 text-sm text-[var(--muted)]">{row.date}</td>
                <td className="px-5 py-4 text-sm font-semibold">{row.action}</td>
                <td className="mono px-5 py-4 text-sm">{row.amount}</td>
                <td className="px-5 py-4">
                  <span className={row.tone === "live" ? "pill pill-live" : row.tone === "sealed" ? "pill pill-sealed" : "pill pill-watch"}>
                    {row.status}
                  </span>
                </td>
                <td className="mono px-5 py-4 text-sm text-[var(--muted)]">{row.proof}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FlowStep({ label, copy, done, active }: { label: string; copy: string; done?: boolean; active?: boolean }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-3 rounded-phase border border-[var(--line)] bg-white p-3">
      <span
        className={`grid h-[34px] w-[34px] place-items-center rounded-full ${
          done
            ? "bg-[rgba(20,122,80,0.12)] text-[var(--green)]"
            : active
              ? "bg-[rgba(104,64,198,0.12)] text-[var(--primary)]"
              : "bg-[var(--surface-soft)] text-[var(--muted)]"
        }`}
      >
        {done ? <CheckCircle2 size={16} aria-hidden="true" /> : <LockKeyhole size={15} aria-hidden="true" />}
      </span>
      <span>
        <strong className="block text-sm">{label}</strong>
        <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">{copy}</span>
      </span>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-phase border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
      <span className="text-[var(--muted)]">{label}</span>
      <strong className={`${mono ? "mono " : ""}max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs`}>{value}</strong>
    </div>
  );
}

function HealthRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-phase border border-[var(--line)] bg-white px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <span className={`h-2 w-2 flex-none rounded-full ${good ? "bg-[var(--green)]" : "bg-[var(--amber)]"}`} />
        <span className="truncate text-[var(--muted)]">{label}</span>
      </span>
      <strong className="mono max-w-[145px] overflow-hidden text-ellipsis whitespace-nowrap text-xs">{value}</strong>
    </div>
  );
}

function StateTile({
  icon,
  label,
  state,
  tone,
}: {
  icon: ReactNode;
  label: string;
  state: string;
  tone: "good" | "watch";
}) {
  return (
    <div className="panel p-4">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${tone === "good" ? "bg-[rgba(20,122,80,0.1)] text-[var(--green)]" : "bg-[rgba(169,103,19,0.12)] text-[var(--amber)]"}`}>
        {icon}
      </span>
      <span className="mt-3 block text-xs font-bold uppercase text-[var(--muted)]">{label}</span>
      <strong className="mono mt-2 block overflow-hidden text-ellipsis whitespace-nowrap">{state}</strong>
    </div>
  );
}

function preflightStatusLabel(preflight?: ClaimPreflightState): string {
  if (!preflight) return "Checking";
  if (preflight.status === "ready") return "Ready";
  if (preflight.status === "blocked") return "Blocked";
  if (preflight.status === "checking") return "Checking";
  if (preflight.status === "error") return "Unavailable";
  return "Pending";
}

function preflightBlockerMessage(result?: PreflightResult | null): string | null {
  return result?.blockers[0]?.message ?? null;
}

function formatNativeFee(value?: bigint): string {
  if (value === undefined) return "Checking";
  if (value === 0n) return "0 ETH";
  return `${formatEther(value)} ETH`;
}

function formatDate(value?: string): string {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "The claim flow could not complete.";
}
