"use client";

import { LogOut, Wallet } from "lucide-react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { maskAddress } from "@/lib/format";

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const injected = connectors[0];

  if (isConnected && address) {
    return (
      <button className="button-secondary" type="button" onClick={() => disconnect()}>
        <LogOut size={16} aria-hidden="true" />
        {maskAddress(address)}
      </button>
    );
  }

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
