"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { sepoliaChainId } from "@/lib/env";

export default function NetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === sepoliaChainId) return null;

  return (
    <div className="network-banner" role="status" aria-live="polite">
      <div className="network-banner-inner">
        <p>
          You&apos;re on the wrong network. Phase demo actions require <strong>Sepolia</strong>.
        </p>
        <button
          className="button-primary network-banner-action"
          type="button"
          disabled={isPending}
          onClick={() => switchChain({ chainId: sepoliaChainId })}
        >
          {isPending ? "Switching…" : "Switch to Sepolia"}
        </button>
      </div>
    </div>
  );
}
