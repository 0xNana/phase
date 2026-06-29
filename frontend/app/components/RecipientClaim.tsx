"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createConfidentialAirdropClient, type PreflightResult } from "@tokenops/sdk/fhe-airdrop";
import {
  useAirdropGasFee,
  useAirdropIsClaimWindowActive,
  useAirdropIsSignatureClaimed,
  useAirdropIsSignatureValid,
  useClaim,
  useGetClaimAmount,
} from "@tokenops/sdk/fhe-airdrop/react";
import { useUserDecrypt, type DecryptResult } from "@zama-fhe/react-sdk";
import { AlertCircle, CheckCircle2, Clock3, Eye, Loader2, LockKeyhole, RefreshCcw, Send, WalletCards } from "lucide-react";
import { formatEther, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatTokenUnits, maskAddress } from "@/lib/format";
import type { Campaign, ClaimPayload } from "@/lib/types";

type ClaimLoadStatus = "disconnected" | "loading" | "ready" | "missing" | "error";
type ClaimPreflightState = {
  status: "idle" | "checking" | "ready" | "blocked" | "error";
  result?: PreflightResult;
  error?: string;
};
type RevealState = {
  handle: Hex | null;
  error: string | null;
};
type ClaimMarkState = "revealed" | "claimed";

export default function RecipientClaim({ campaign }: { campaign: Campaign }) {
  const { address } = useAccount();
  const [claimPayload, setClaimPayload] = useState<ClaimPayload | null>(null);
  const [loadStatus, setLoadStatus] = useState<ClaimLoadStatus>("disconnected");
  const [loadMessage, setLoadMessage] = useState("Connect wallet.");

  useEffect(() => {
    const controller = new AbortController();

    async function loadClaim() {
      if (!campaign.airdropAddress) {
        setClaimPayload(null);
        setLoadStatus("error");
        setLoadMessage("Airdrop is not live.");
        return;
      }

      if (!address) {
        setClaimPayload(null);
        setLoadStatus("disconnected");
        setLoadMessage("Connect wallet.");
        return;
      }

      setLoadStatus("loading");
      setLoadMessage("Checking claim.");

      const response = await fetch(`/api/campaigns/${campaign.id}/claim?recipient=${address}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as { claim?: ClaimPayload; error?: string } | null;

      if (!response.ok || !result?.claim) {
        setClaimPayload(null);
        setLoadStatus(response.status === 404 ? "missing" : "error");
        setLoadMessage(response.status === 404 ? "No claim for this wallet." : result?.error ?? "Could not check claim.");
        return;
      }

      setClaimPayload(result.claim);
      setLoadStatus("ready");
      setLoadMessage("Claim loaded.");
    }

    loadClaim().catch((cause) => {
      if (controller.signal.aborted) return;
      setClaimPayload(null);
      setLoadStatus("error");
      setLoadMessage(errorMessage(cause));
    });

    return () => controller.abort();
  }, [address, campaign.airdropAddress, campaign.id]);

  return (
    <section className="recipient-claim-page" aria-labelledby="claim-title">
      <div className="recipient-claim-shell panel">
        <div className="recipient-claim-header">
          <span className="product-kicker">
            <LockKeyhole size={16} aria-hidden="true" />
            Claim
          </span>
          <h1 id="claim-title">{campaign.name}</h1>
          <p>Check wallet. Reveal allocation. Claim.</p>
        </div>

        {campaign.airdropAddress && claimPayload && address ? (
          <ClaimFlow campaign={campaign} claimPayload={claimPayload} user={address} />
        ) : (
          <ClaimGate loadStatus={loadStatus} loadMessage={loadMessage} user={address} campaign={campaign} />
        )}
      </div>
    </section>
  );
}

function ClaimFlow({ campaign, claimPayload, user }: { campaign: Campaign; claimPayload: ClaimPayload; user: Address }) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [markedRevealed, setMarkedRevealed] = useState(Boolean(claimPayload.revealedAt));
  const [markedClaimed, setMarkedClaimed] = useState(Boolean(claimPayload.claimedAt));
  const [lastError, setLastError] = useState<string | null>(null);
  const [preflightState, setPreflightState] = useState<ClaimPreflightState>({ status: "idle" });
  const [revealState, setRevealState] = useState<RevealState>({ handle: null, error: null });

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
  const claim = useClaim({ address: airdropAddress });
  const claimAmount = useGetClaimAmount({ address: airdropAddress });
  const decryptedClaim = useUserDecrypt(
    {
      handles: revealState.handle ? [{ handle: revealState.handle, contractAddress: airdropAddress }] : [],
    },
    {
      enabled: Boolean(revealState.handle),
      retry: false,
      staleTime: Infinity,
      gcTime: 5 * 60_000,
    },
  );

  const done = markedClaimed || claimed.data === true;
  const allocation = revealState.handle ? readDecryptedValue(decryptedClaim.data, revealState.handle) : null;
  const allocationLabel = allocation === null ? "Sealed" : `${formatTokenUnits(allocation)} cUSDC`;
  const revealBusy = claimAmount.isPending || (Boolean(revealState.handle) && decryptedClaim.isFetching && allocation === null);
  const revealDone = allocation !== null || done;

  const markClaimState = useCallback(async (state: ClaimMarkState) => {
    const response = await fetch(`/api/campaigns/${campaign.id}/claim`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: user, state }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error ?? `Could not mark claim ${state}`);
    }
  }, [campaign.id, user]);

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
    if (allocation === null || markedRevealed || done) return;

    setMarkedRevealed(true);
    markClaimState("revealed").catch((cause) => {
      setLastError(errorMessage(cause));
    });
  }, [allocation, done, markClaimState, markedRevealed]);

  async function revealAllocation() {
    setLastError(null);
    setRevealState((state) => ({ ...state, error: null }));

    try {
      const result = await claimAmount.mutateAsync({
        encryptedInput: claimPayload.encryptedInput,
        signature: claimPayload.signature,
      });
      setRevealState({ handle: result.handle, error: null });
    } catch (cause) {
      setRevealState({ handle: null, error: errorMessage(cause) });
    }
  }

  async function claimTokens() {
    setLastError(null);
    if (!revealDone) {
      setLastError("Reveal and decrypt your allocation before claiming.");
      return;
    }
    if (gasFee.data === undefined) {
      setLastError("Claim fee is still loading.");
      return;
    }

    try {
      const report = await runPreflight();
      if (!report?.ready) {
        setLastError(preflightBlockerMessage(report) ?? "Claim is not ready.");
        return;
      }

      await claim.mutateAsync({
        encryptedInput: claimPayload.encryptedInput,
        signature: claimPayload.signature,
        value: gasFee.data,
      });
      await markClaimState("claimed");
      setMarkedClaimed(true);
      await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
    } catch (cause) {
      setLastError(errorMessage(cause));
    }
  }

  const revealError = revealState.error ?? decryptedClaim.error?.message ?? null;
  const checksPending =
    !done &&
    (windowActive.data === undefined ||
      signatureValid.data === undefined ||
      claimed.data === undefined ||
      gasFee.data === undefined ||
      preflightState.status === "idle" ||
      preflightState.status === "checking");
  const ready =
    !done &&
    revealDone &&
    windowActive.data === true &&
    signatureValid.data === true &&
    claimed.data === false &&
    gasFee.data !== undefined &&
    preflightState.status === "ready";
  const blockedMessage =
    lastError ??
    signatureValid.error?.message ??
    windowActive.error?.message ??
    claimed.error?.message ??
    gasFee.error?.message ??
    revealError ??
    (windowActive.data === false ? "Claim window is closed." : null) ??
    (signatureValid.data === false ? "Signature is invalid for this wallet." : null) ??
    (!revealDone ? "Reveal and decrypt your allocation before claiming." : null) ??
    (claimed.data === true ? null : preflightState.status === "blocked" ? preflightBlockerMessage(preflightState.result) : null) ??
    (preflightState.status === "error" ? preflightState.error ?? "Claim check failed." : null);
  const stage = done ? "done" : ready ? "ready" : checksPending ? "checking" : "blocked";
  const stageCopy = getStageCopy(stage);

  return (
    <div className="recipient-claim-body">
      <div className={`recipient-claim-stage is-${stage}`} aria-live="polite">
        <span className="recipient-claim-icon">{stageCopy.icon}</span>
        <div>
          <span className={stage === "done" || stage === "ready" ? "pill pill-live" : stage === "checking" ? "pill pill-watch" : "pill pill-sealed"}>
            {stageCopy.kicker}
          </span>
          <h2>{stageCopy.title}</h2>
          <p>{stageCopy.copy}</p>
        </div>

        <button className="button-primary recipient-claim-button" type="button" disabled={!ready || claim.isPending || done} onClick={claimTokens}>
          {claim.isPending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : done ? <CheckCircle2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          {claim.isPending ? "Claiming" : done ? "Claimed" : "Claim now"}
        </button>

        {blockedMessage ? (
          <div className="recipient-claim-alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{blockedMessage}</span>
          </div>
        ) : null}
      </div>

      <div className="recipient-simple-steps">
        <ClaimStep label="Wallet" value={maskAddress(user)} done />
        <ClaimStep label="Reveal" value={revealDone ? "Decrypted" : revealBusy ? "Decrypting" : "Required"} done={revealDone} active={revealBusy} />
        <ClaimStep label="Check" value={ready || done ? "Ready" : checksPending ? "Checking" : "Blocked"} done={ready || done} active={checksPending} />
        <ClaimStep label="Claim" value={done ? "Done" : "Next"} done={done} active={ready} />
      </div>

      <div className={`recipient-reveal-panel ${revealDone ? "is-revealed" : ""}`}>
        <div>
          <span className="section-label">Private allocation</span>
          <strong>{allocationLabel}</strong>
          <p>{revealDone ? "Decrypted through Zama user decrypt for this wallet." : "Reveal verifies the signed claim amount before transfer."}</p>
        </div>
        <button className="button-secondary recipient-reveal-button" type="button" disabled={done || revealBusy} onClick={() => void revealAllocation()}>
          {revealBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : revealDone ? <CheckCircle2 size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {revealBusy ? "Revealing" : revealDone ? "Revealed" : "Reveal allocation"}
        </button>
      </div>

      <div className="recipient-claim-meta" aria-label="Claim details">
        <MetaItem label="Token" value={maskAddress(campaign.tokenAddress)} />
        <MetaItem label="Allocation" value={allocationLabel} />
        <MetaItem label="Fee" value={formatNativeFee(gasFee.data)} />
        <MetaItem label="Proof" value={maskAddress(claimPayload.signature, 10, 8)} mono />
      </div>

      {!done && (preflightState.status === "blocked" || preflightState.status === "error") ? (
        <button className="button-secondary recipient-refresh-check" type="button" onClick={() => void runPreflight()}>
          <RefreshCcw size={15} aria-hidden="true" />
          Recheck
        </button>
      ) : null}
    </div>
  );
}

function ClaimGate({
  loadStatus,
  loadMessage,
  user,
  campaign,
}: {
  loadStatus: ClaimLoadStatus;
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
        <button className="button-secondary recipient-claim-button" type="button" disabled>
          {state.button}
        </button>
      </div>

      <div className="recipient-simple-steps">
        <ClaimStep label="Wallet" value={user ? maskAddress(user) : "Connect"} done={Boolean(user)} active={!user} />
        <ClaimStep label="Check" value={loadStatus === "loading" ? "Checking" : loadStatus === "ready" ? "Ready" : "Waiting"} active={loadStatus === "loading"} />
        <ClaimStep label="Reveal" value="Locked" />
        <ClaimStep label="Claim" value="Locked" />
      </div>

      <div className="recipient-claim-meta" aria-label="Claim details">
        <MetaItem label="Campaign" value={campaign.airdropAddress ? maskAddress(campaign.airdropAddress) : "Not live"} />
        <MetaItem label="Token" value={maskAddress(campaign.tokenAddress)} />
        <MetaItem label="Status" value={campaign.status} />
      </div>
    </div>
  );
}

function ClaimStep({ label, value, done, active }: { label: string; value: string; done?: boolean; active?: boolean }) {
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

function getGateState(status: ClaimLoadStatus): { stage: "checking" | "blocked"; icon: ReactNode; kicker: string; title: string; button: string } {
  if (status === "loading") {
    return {
      stage: "checking",
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "Checking",
      title: "Checking claim",
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
    kicker: status === "missing" ? "No claim" : "Unavailable",
    title: status === "missing" ? "No claim found" : "Claim unavailable",
    button: "Claim locked",
  };
}

function getStageCopy(stage: "done" | "ready" | "checking" | "blocked"): { icon: ReactNode; kicker: string; title: string; copy: string } {
  if (stage === "done") {
    return {
      icon: <CheckCircle2 size={34} aria-hidden="true" />,
      kicker: "Done",
      title: "Claim complete",
      copy: "Your claim is recorded.",
    };
  }
  if (stage === "ready") {
    return {
      icon: <Send size={34} aria-hidden="true" />,
      kicker: "Ready",
      title: "Ready to claim",
      copy: "Confirm once in wallet.",
    };
  }
  if (stage === "checking") {
    return {
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "Checking",
      title: "Checking claim",
      copy: "Verifying window, signature, and fee.",
    };
  }
  return {
    icon: <AlertCircle size={34} aria-hidden="true" />,
    kicker: "Blocked",
    title: "Claim unavailable",
    copy: "Fix the blocker and recheck.",
  };
}

function preflightBlockerMessage(result?: PreflightResult | null): string | null {
  return result?.blockers[0]?.message ?? null;
}

function formatNativeFee(value?: bigint): string {
  if (value === undefined) return "Checking";
  if (value === 0n) return "0 ETH";
  return `${formatEther(value)} ETH`;
}

function readDecryptedValue(data: DecryptResult | undefined, handle: Hex): bigint | null {
  const value = data?.[handle];
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Claim could not complete.";
}
