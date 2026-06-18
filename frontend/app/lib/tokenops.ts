"use client";

import { createConfig, http } from "wagmi";
import { injected } from "@wagmi/core";
import { sepolia } from "wagmi/chains";
import { indexedDBStorage, RelayerWeb, SepoliaConfig } from "@zama-fhe/react-sdk";
import { rpcUrl } from "./env";
import { PhaseWagmiSigner } from "./wagmi-signer";

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

export const wagmiSigner = new PhaseWagmiSigner(wagmiConfig);

export const zamaRelayer = new RelayerWeb({
  getChainId: () => wagmiSigner.getChainId(),
  transports: {
    [sepolia.id]: {
      ...SepoliaConfig,
      network: rpcUrl,
    },
  },
});

export const zamaStorage = indexedDBStorage;
