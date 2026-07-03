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
import { AlertCircle, CheckCircle2, Eye, Info, Loader2, LockKeyhole, RefreshCcw, Send, WalletCards } from "lucide-react";
import { type Address, type Hex } from "viem";
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
  const { data: walletClient } = useWalletClient();
  const [claimPayload, setClaimPayload] = useState<ClaimPayload | null>(null);
  const [loadStatus, setLoadStatus] = useState<ClaimLoadStatus>("disconnected");
  const [loadMessage, setLoadMessage] = useState("Connect wallet.");

  useEffect(() => {
    setClaimPayload(null);

    if (!campaign.airdropAddress) {
      setLoadStatus("error");
      setLoadMessage("Distribution is not live.");
      return;
    }

    if (!address) {
      setLoadStatus("disconnected");
      setLoadMessage("Connect wallet.");
      return;
    }

    const checkedClaim = readCheckedClaim(campaign.id, address);
    if (!checkedClaim) {
      setLoadStatus("missing");
      setLoadMessage("Check eligibility on the recipient page first.");
      return;
    }

    setClaimPayload(checkedClaim);
    setLoadStatus("ready");
    setLoadMessage("Claim loaded.");
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
          <ClaimGate loadStatus={loadStatus} loadMessage={loadMessage} />
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

  useEffect(() => {
    if (claimed.data !== true) return;
    setMarkedClaimed(true);
    setLastError(null);
    setPreflightState({ status: "ready" });
  }, [claimed.data]);
  const allocation = revealState.handle ? readDecryptedValue(decryptedClaim.data, revealState.handle) : null;
  const allocationLabel = allocation === null ? "Sealed" : `${formatTokenUnits(allocation)} cUSDC`;
  const revealBusy = claimAmount.isPending || (Boolean(revealState.handle) && decryptedClaim.isFetching && allocation === null);
  const revealDone = allocation !== null || done;

  const markClaimState = useCallback(async (state: ClaimMarkState) => {
    if (!walletClient) throw new Error("Wallet authorization is required.");
    const signature = await walletClient.signMessage({
      account: user,
      message: claimAccessMessage(campaign.id, user),
    });

    const response = await fetch(`/api/campaigns/${campaign.id}/claim`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: user, state, signature }),
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error ?? `Could not mark claim ${state}`);
    }
  }, [campaign.id, user, walletClient]);

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
      const message = errorMessage(cause);
      if (isAlreadyRedeemedError(message)) {
        setMarkedClaimed(true);
        setLastError(null);
        setPreflightState({ status: "ready" });
        await queryClient.invalidateQueries({ queryKey: ["tokenops-sdk", "fhe-airdrop"] });
        return;
      }
      setLastError(message);
    }
  }

  const revealError = revealState.error ?? decryptedClaim.error?.message ?? null;
  const checksPending =
    !done &&
    (windowActive.data === undefined ||
      signatureValid.data === undefined ||
      claimed.data === undefined ||
      gasFee.data === undefined ||
      preflightState.status === "checking");
  const ready =
    !done &&
    revealDone &&
    windowActive.data === true &&
    signatureValid.data === true &&
    claimed.data === false &&
    gasFee.data !== undefined &&
    (preflightState.status === "idle" || preflightState.status === "ready");
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
  const stage = done ? "done" : !revealDone ? "blocked" : ready ? "ready" : checksPending ? "checking" : "blocked";
  const stageCopy = getStageCopy(stage);
  const visibleBlockedMessage = !revealDone ? null : blockedMessage;

  return (
    <div className="recipient-claim-body">
      <div className={`recipient-claim-stage is-${stage}`} aria-live="polite">
        {stageCopy.icon ? <span className="recipient-claim-icon">{stageCopy.icon}</span> : null}
        <div>
          {stageCopy.kicker ? (
            <span className={stage === "done" || stage === "ready" ? "pill pill-live" : stage === "checking" ? "pill pill-watch" : "pill pill-sealed"}>
              {stageCopy.kicker}
            </span>
          ) : null}
          <div className={stageCopy.title ? "recipient-claim-title-row" : "recipient-claim-title-row is-icon-only"}>
            {stageCopy.title ? <h2>{stageCopy.title}</h2> : null}
            {stageCopy.info ? (
              <span className="recipient-claim-info" tabIndex={0} role="img" aria-label={stageCopy.info} data-tooltip={stageCopy.info}>
                <Info size={15} aria-hidden="true" />
              </span>
            ) : null}
          </div>
          {stageCopy.copy ? <p>{stageCopy.copy}</p> : null}
        </div>

        <div className={`recipient-claim-focus ${revealDone ? "is-revealed" : ""}`} aria-label="Claim proof and allocation">
          <div className="recipient-claim-focus-row">
            <span>Private allocation</span>
            <strong>{allocationLabel}</strong>
          </div>
          <div className="recipient-claim-focus-row">
            <span>Proof</span>
            <strong className="mono">{maskAddress(claimPayload.signature, 10, 8)}</strong>
          </div>
        </div>

        <div className="recipient-claim-actions">
          <button className="button-secondary recipient-reveal-button" type="button" disabled={done || revealBusy} onClick={() => void revealAllocation()}>
            {revealBusy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : revealDone ? <CheckCircle2 size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            {revealBusy ? "Revealing" : revealDone ? "Revealed" : "Reveal allocation"}
          </button>
          <button className="button-primary recipient-claim-button" type="button" disabled={!ready || claim.isPending || done} onClick={claimTokens}>
            {claim.isPending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : done ? <CheckCircle2 size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {claim.isPending ? "Claiming" : done ? "Claimed" : "Claim now"}
          </button>
        </div>

        {visibleBlockedMessage ? (
          <div className="recipient-claim-alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{visibleBlockedMessage}</span>
          </div>
        ) : null}
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
}: {
  loadStatus: ClaimLoadStatus;
  loadMessage: string;
}) {
  const state = getGateState(loadStatus);

  return (
    <div className="recipient-claim-body">
      <div className={`recipient-claim-stage is-${state.stage}`}>
        <span className="recipient-claim-icon">{state.icon}</span>
        <div>
          {state.kicker ? <span className="pill pill-watch">{state.kicker}</span> : null}
          <h2>{state.title}</h2>
          <p>{loadMessage}</p>
        </div>
        <button className="button-secondary recipient-claim-button" type="button" disabled>
          {state.button}
        </button>
      </div>
    </div>
  );
}


function getGateState(status: ClaimLoadStatus): { stage: "checking" | "blocked"; icon: ReactNode; kicker: string; title: string; button: string } {
  if (status === "loading") {
    return {
      stage: "checking",
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "",
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

function getStageCopy(stage: "done" | "ready" | "checking" | "blocked"): { icon: ReactNode; kicker: string; title: string; copy: string; info?: string } {
  if (stage === "done") {
    return {
      icon: <CheckCircle2 size={34} aria-hidden="true" />,
      kicker: "",
      title: "Claim complete",
      copy: "Your claim is recorded.",
    };
  }
  if (stage === "ready") {
    return {
      icon: <Send size={34} aria-hidden="true" />,
      kicker: "",
      title: "Ready to claim",
      copy: "Confirm once in wallet.",
    };
  }
  if (stage === "checking") {
    return {
      icon: <Loader2 size={34} className="animate-spin" aria-hidden="true" />,
      kicker: "",
      title: "Checking claim",
      copy: "Verifying window, signature, and fee.",
    };
  }
  return {
    icon: null,
    kicker: "",
    title: "",
    copy: "",
    info: "Reveal and decrypt your allocation before claiming.",
  };
}

function preflightBlockerMessage(result?: PreflightResult | null): string | null {
  return result?.blockers[0]?.message ?? null;
}


function readDecryptedValue(data: DecryptResult | undefined, handle: Hex): bigint | null {
  const value = data?.[handle];
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

function claimAccessMessage(campaignId: string, recipient: string): string {
  return "Phase claim access\nCampaign: " + campaignId + "\nRecipient: " + recipient.toLowerCase();
}

function isAlreadyRedeemedError(message: string): boolean {
  return /already (been )?redeemed|already claimed|claim has already/i.test(message);
}

function errorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "Claim could not complete.";
  if (!message.includes("Failed to initialize FHE worker")) return message;

  const isolated = typeof window !== "undefined" ? window.crossOriginIsolated : true;
  if (!isolated) {
    return "Failed to initialize the FHE worker. This claim page is not cross-origin isolated; redeploy or restart with COOP/COEP headers enabled.";
  }

  return "Failed to initialize the FHE worker. Check that cdn.zama.org is reachable and not blocked by the browser, VPN, or content blocker, then try again.";
}

function checkedClaimStorageKey(campaignId: string, recipient: string): string {
  return `phase:checked-claim:${campaignId}:${recipient.toLowerCase()}`;
}

function readCheckedClaim(campaignId: string, recipient: Address): ClaimPayload | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(checkedClaimStorageKey(campaignId, recipient));
  if (!raw) return null;

  try {
    const claim = JSON.parse(raw) as ClaimPayload;
    if (claim.campaignId !== campaignId || claim.recipient.toLowerCase() !== recipient.toLowerCase()) return null;
    return claim;
  } catch {
    return null;
  }
}
