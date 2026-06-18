"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, Eye, Loader2, LogOut, Wallet } from "lucide-react";
import { useConfidentialBalance } from "@zama-fhe/react-sdk";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { cusdcTokenAddress } from "@/lib/env";
import { formatTokenUnits, maskAddress } from "@/lib/format";

const BALANCE_TIMEOUT_MS = 15_000;

export default function WalletDropdown() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [balanceRequested, setBalanceRequested] = useState(false);
  const [balanceTimedOut, setBalanceTimedOut] = useState(false);

  const confidentialBalance = useConfidentialBalance(
    { tokenAddress: cusdcTokenAddress },
    {
      enabled: Boolean(open && isConnected && address && balanceRequested),
      retry: false,
      staleTime: 15_000,
      gcTime: 60_000,
    },
  );

  const balanceBusy = confidentialBalance.isFetching && !balanceTimedOut;
  const decryptedBalance = confidentialBalance.data ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setCopied(false);
    setCopyError(null);
    setBalanceRequested(false);
    setBalanceTimedOut(false);
  }, [address]);

  useEffect(() => {
    if (!confidentialBalance.isFetching || !balanceRequested) {
      setBalanceTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => setBalanceTimedOut(true), BALANCE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [balanceRequested, confidentialBalance.isFetching]);

  useEffect(() => {
    if (confidentialBalance.isSuccess || confidentialBalance.isError) {
      setBalanceTimedOut(false);
    }
  }, [confidentialBalance.isError, confidentialBalance.isSuccess]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError("Could not copy the address.");
    }
  }

  function requestBalanceDecrypt() {
    setBalanceTimedOut(false);
    setBalanceRequested(true);
    if (balanceRequested) void confidentialBalance.refetch({ cancelRefetch: true });
  }

  if (!isConnected || !address) {
    const injected = connectors[0];
    return (
      <button
        className="button-primary"
        type="button"
        disabled={!injected || isPending}
        onClick={() => injected && connect({ connector: injected })}
      >
        <Wallet size={16} aria-hidden="true" />
        {isPending ? "Connecting" : "Connect wallet"}
      </button>
    );
  }

  const displayBalance = decryptedBalance !== null ? `${formatTokenUnits(decryptedBalance)} cUSDC` : null;
  const balanceStatus = displayBalance ?? balanceFallbackText(confidentialBalance.error, balanceRequested, balanceBusy, balanceTimedOut, copyError);

  return (
    <div className="wallet-dropdown" ref={menuRef}>
      <button
        className={`button-secondary wallet-dropdown-trigger ${open ? "is-open" : ""}`}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="wallet-dropdown-trigger-main">
          <Wallet size={16} aria-hidden="true" />
          <span>{maskAddress(address)}</span>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open ? (
        <div className="wallet-dropdown-menu" role="menu" aria-label="Wallet details">
          <div className="wallet-dropdown-header">
            <span className="wallet-dropdown-avatar" aria-hidden="true">
              <Wallet size={18} />
            </span>
            <div className="wallet-dropdown-copyline">
              <div>
                <span className="section-label">Wallet</span>
                <strong>{maskAddress(address)}</strong>
                <p>Connected account for private claims and cUSDC balance decrypts.</p>
              </div>
              <button className="wallet-dropdown-copy" type="button" onClick={() => void copyAddress()} aria-label="Copy wallet address">
                {copied ? <CheckCircle2 size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          <div className="wallet-dropdown-body">
            <button className="wallet-dropdown-action" type="button" disabled={balanceBusy} onClick={requestBalanceDecrypt}>
              {balanceBusy ? <Loader2 className="wallet-spinner" size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
              {decryptedBalance !== null ? "Refresh balance" : balanceTimedOut ? "Try again" : "Decrypt balance"}
            </button>

            <div className="wallet-dropdown-balance" aria-live="polite">
              <span>Balance</span>
              <strong>{balanceStatus}</strong>
            </div>

            <button className="wallet-dropdown-action is-danger" type="button" onClick={() => disconnect()}>
              <LogOut size={15} aria-hidden="true" />
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function balanceFallbackText(
  error: Error | null,
  requested: boolean,
  busy: boolean,
  timedOut: boolean,
  copyError: string | null,
): string {
  if (copyError) return copyError;
  if (timedOut) return "Wallet signature or relayer timed out. Try again.";
  if (busy) return "Decrypting";
  if (error) return errorMessage(error);
  return requested ? "Ready to decrypt" : "Sealed";
}

function errorMessage(cause: unknown): string {
  if (typeof cause === "object" && cause !== null && "shortMessage" in cause) {
    const shortMessage = (cause as { shortMessage?: unknown }).shortMessage;
    if (typeof shortMessage === "string") return shortMessage;
  }

  if (cause instanceof Error) return cause.message;
  return "Could not load the confidential balance.";
}
