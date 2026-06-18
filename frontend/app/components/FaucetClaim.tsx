"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Coins, Copy, RefreshCcw } from "lucide-react";
import type { Address, Hex, PublicClient } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { cusdcFaucetAddress, cusdcTokenAddress, sepoliaChainId } from "@/lib/env";
import { formatTokenUnits, maskAddress } from "@/lib/format";
import WalletButton from "./WalletButton";

const cusdcFaucetAbi = [
  {
    inputs: [],
    name: "CLAIM_AMOUNT",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "CLAIM_COOLDOWN",
    outputs: [{ internalType: "uint48", name: "", type: "uint48" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "nextClaimTimes",
    outputs: [{ internalType: "uint48", name: "nextClaimAt", type: "uint48" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

type FaucetState = {
  claimAmount: bigint;
  cooldown: bigint;
  nextClaimAt: bigint | null;
};

type CopyTarget = "token";

async function readFaucetState(publicClient: PublicClient, account?: Address): Promise<FaucetState> {
  const [claimAmount, cooldown, nextClaimAt] = await Promise.all([
    publicClient.readContract({ address: cusdcFaucetAddress, abi: cusdcFaucetAbi, functionName: "CLAIM_AMOUNT" }),
    publicClient.readContract({ address: cusdcFaucetAddress, abi: cusdcFaucetAbi, functionName: "CLAIM_COOLDOWN" }),
    account
      ? publicClient.readContract({
          address: cusdcFaucetAddress,
          abi: cusdcFaucetAbi,
          functionName: "nextClaimTimes",
          args: [account],
        })
      : Promise.resolve(null),
  ]);

  return {
    claimAmount: BigInt(claimAmount),
    cooldown: BigInt(cooldown),
    nextClaimAt: nextClaimAt === null ? null : BigInt(nextClaimAt),
  };
}

export default function FaucetClaim() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const { switchChain, isPending: switchingChain } = useSwitchChain();

  const [faucetState, setFaucetState] = useState<FaucetState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState("Connect a wallet to claim Sepolia cUSDC.");
  const [latestHash, setLatestHash] = useState<Hex | null>(null);
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [nowSeconds, setNowSeconds] = useState(0);

  useEffect(() => {
    setNowSeconds(Math.floor(Date.now() / 1000));
    const timer = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!publicClient) {
      setLoading(false);
      setLoadError("Sepolia client is not ready. Check the configured RPC URL.");
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    readFaucetState(publicClient, address)
      .then((nextState) => {
        if (!active) return;
        setFaucetState(nextState);
        setStatus(address ? "Faucet state synced for your wallet." : "Connect a wallet to check your claim window.");
      })
      .catch((cause) => {
        if (!active) return;
        setLoadError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [address, publicClient]);

  const wrongNetwork = Boolean(isConnected && chainId !== sepoliaChainId);
  const nextClaimAt = faucetState?.nextClaimAt ? Number(faucetState.nextClaimAt) : 0;
  const secondsUntilClaim = Math.max(nextClaimAt - nowSeconds, 0);
  const isCoolingDown = Boolean(isConnected && nextClaimAt > 0 && secondsUntilClaim > 0);
  const claimAmountLabel = faucetState ? `${formatTokenUnits(faucetState.claimAmount)} cUSDC` : "Syncing";
  const cooldownLabel = faucetState ? formatDuration(Number(faucetState.cooldown)) : "Syncing";
  const claimWindowLabel = !isConnected
    ? "Connect wallet"
    : wrongNetwork
      ? "Switch to Sepolia"
      : isCoolingDown
        ? `Ready in ${formatDuration(secondsUntilClaim)}`
        : "Ready now";
  const statusClass = loadError || wrongNetwork ? "is-error" : !isConnected || isCoolingDown || loading ? "is-waiting" : "is-good";
  const canClaim = Boolean(isConnected && address && !wrongNetwork && !isCoolingDown && !claiming && !loading && publicClient && walletClient.data);

  async function refreshFaucetState() {
    if (!publicClient) {
      setLoadError("Sepolia client is not ready. Check the configured RPC URL.");
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const nextState = await readFaucetState(publicClient, address);
      setFaucetState(nextState);
      setStatus(address ? "Faucet state refreshed." : "Connect a wallet to check your claim window.");
    } catch (cause) {
      setLoadError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress(value: Address, target: CopyTarget) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setLoadError("Could not copy the address. Select it and copy manually.");
    }
  }

  async function claimFromFaucet() {
    setLoadError(null);

    if (!address) {
      setLoadError("Connect a wallet before claiming cUSDC.");
      return;
    }
    if (wrongNetwork) {
      setLoadError("Switch your wallet to Sepolia before claiming.");
      return;
    }
    if (!publicClient || !walletClient.data) {
      setLoadError("Wallet client is not ready. Reconnect and try again.");
      return;
    }

    try {
      setClaiming(true);
      setStatus("Confirm the faucet claim in your wallet.");
      const hash = await walletClient.data.writeContract({
        account: address,
        address: cusdcFaucetAddress,
        abi: cusdcFaucetAbi,
        functionName: "claim",
      });
      setLatestHash(hash);
      setStatus("Waiting for Sepolia confirmation.");
      await publicClient.waitForTransactionReceipt({ hash });
      const nextState = await readFaucetState(publicClient, address);
      setFaucetState(nextState);
      setStatus("Claim confirmed. cUSDC was minted to your wallet.");
    } catch (cause) {
      setLoadError(errorMessage(cause));
      setStatus("Claim did not complete.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section className="faucet-page">
      <div className="faucet-hero">
        <div>
          <span className="product-kicker">Sepolia cUSDC faucet</span>
          <h1>Claim demo cUSDC for private airdrop ops.</h1>
          <p>
            Mint the confidential ERC-7984 demo token used by Phase, then use the same cUSDC
            contract in the admin builder when creating claim, batch, or vesting distributions.
          </p>
          <div className="faucet-hero-actions">
            <Link className="button-secondary" href="/admin">
              Open Admin
            </Link>
            <button className="button-ghost" type="button" onClick={() => void copyAddress(cusdcTokenAddress, "token")}>
              {copied === "token" ? <CheckCircle2 size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === "token" ? "Copied" : "Copy cUSDC"}
            </button>
          </div>
        </div>

        <div className={`faucet-status-card ${statusClass}`} aria-live="polite">
          <span>{loadError ? "Needs attention" : loading ? "Syncing" : isCoolingDown ? "Cooldown" : isConnected ? "Claim window" : "Wallet"}</span>
          <strong>{loadError ? "Action blocked" : claimWindowLabel}</strong>
          <small>{loadError ?? status}</small>
        </div>
      </div>

      <div className="faucet-grid">
        <section className="faucet-claim-card panel" aria-labelledby="faucet-claim-title">
          <div className="faucet-card-header">
            <span className="faucet-card-icon">
              <Coins size={21} aria-hidden="true" />
            </span>
            <div>
              <span className="section-label">Claim</span>
              <h2 id="faucet-claim-title">Mint cUSDC to your wallet</h2>
              <p>Each wallet can claim once per cooldown window. The minted balance remains confidential on-chain.</p>
            </div>
          </div>

          <div className="faucet-fact-grid">
            <FaucetFact label="Claim amount" value={claimAmountLabel} />
            <FaucetFact label="Cooldown" value={cooldownLabel} />
            <FaucetFact label="Wallet" value={address ? maskAddress(address) : "Not connected"} />
            <FaucetFact label="Network" value={wrongNetwork ? `Chain ${chainId}` : "Sepolia"} />
          </div>

          <div className="faucet-action-panel">
            {loadError ? (
              <div className="validation-message">
                <AlertTriangle size={16} aria-hidden="true" />
                <span>{loadError}</span>
              </div>
            ) : isCoolingDown ? (
              <div className="validation-message is-valid">
                <Clock size={16} aria-hidden="true" />
                <span>Next claim opens {formatDateTime(nextClaimAt)}.</span>
              </div>
            ) : (
              <div className="validation-message is-valid">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{isConnected && !wrongNetwork ? "This wallet can claim now." : "Connect on Sepolia to claim."}</span>
              </div>
            )}

            <div className="faucet-actions">
              {!isConnected ? (
                <WalletButton />
              ) : wrongNetwork ? (
                <button className="button-primary" type="button" disabled={switchingChain} onClick={() => switchChain({ chainId: sepoliaChainId })}>
                  {switchingChain ? "Switching" : "Switch to Sepolia"}
                </button>
              ) : (
                <button className="button-primary" type="button" disabled={!canClaim} onClick={() => void claimFromFaucet()}>
                  <Coins size={16} aria-hidden="true" />
                  {claiming ? "Claiming" : "Claim cUSDC"}
                </button>
              )}
              <button className="button-secondary" type="button" disabled={loading || claiming} onClick={() => void refreshFaucetState()}>
                <RefreshCcw size={16} aria-hidden="true" />
                Refresh
              </button>
            </div>

            {latestHash ? (
              <a className="faucet-tx-link" href={`https://sepolia.etherscan.io/tx/${latestHash}`} target="_blank" rel="noreferrer">
                Latest transaction: <span className="mono">{maskAddress(latestHash)}</span>
              </a>
            ) : null}
          </div>
        </section>

      </div>
    </section>
  );
}

function FaucetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="faucet-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}


function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "now";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${Math.max(minutes, 1)}m`;
}

function formatDateTime(timestamp: number): string {
  if (!timestamp) return "after the cooldown";
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function errorMessage(cause: unknown): string {
  if (typeof cause === "object" && cause !== null && "shortMessage" in cause) {
    const shortMessage = (cause as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string") return shortMessage;
  }

  if (cause instanceof Error) return cause.message;
  return "Faucet request failed. Try again after checking wallet and network state.";
}
