"use client";

import type {
  ContractAbi,
  EIP712TypedData,
  GenericSigner,
  Hex,
  ReadContractConfig,
  ReadContractReturnType,
  ReadFunctionName,
  SignerLifecycleCallbacks,
  TransactionReceipt,
  WriteContractArgs,
  WriteContractConfig,
  WriteFunctionName,
} from "@zama-fhe/sdk";
import type { Config } from "wagmi";
import {
  getAccount,
  getBlock,
  getChainId,
  readContract,
  signTypedData,
  waitForTransactionReceipt,
  watchAccount,
  watchChainId,
  writeContract,
} from "wagmi/actions";

export class PhaseWagmiSigner implements GenericSigner {
  constructor(private readonly config: Config) {}

  async getChainId(): Promise<number> {
    return getChainId(this.config);
  }

  async getAddress() {
    const account = getAccount(this.config);
    if (!account.address) throw new Error("Connect a wallet before signing.");
    return account.address;
  }

  async signTypedData(typedData: EIP712TypedData): Promise<Hex> {
    return signTypedData(this.config, {
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType ?? "UserDecryptRequestVerification",
      message: typedData.message,
    } as never);
  }

  async writeContract<
    const TAbi extends ContractAbi,
    TFunctionName extends WriteFunctionName<TAbi>,
    const TArgs extends WriteContractArgs<TAbi, TFunctionName>,
  >(config: WriteContractConfig<TAbi, TFunctionName, TArgs>): Promise<Hex> {
    return writeContract(this.config, config as never);
  }

  async readContract<
    const TAbi extends ContractAbi,
    TFunctionName extends ReadFunctionName<TAbi>,
    const TArgs extends ReadContractConfig<TAbi, TFunctionName>["args"],
  >(
    config: ReadContractConfig<TAbi, TFunctionName, TArgs>,
  ): Promise<ReadContractReturnType<TAbi, TFunctionName, TArgs>> {
    return readContract(this.config, config as never) as Promise<
      ReadContractReturnType<TAbi, TFunctionName, TArgs>
    >;
  }

  async waitForTransactionReceipt(hash: Hex): Promise<TransactionReceipt> {
    const receipt = await waitForTransactionReceipt(this.config, { hash });
    return {
      logs: receipt.logs.map((log) => ({
        topics: log.topics,
        data: log.data,
      })),
    };
  }

  async getBlockTimestamp(): Promise<bigint> {
    const block = await getBlock(this.config);
    return block.timestamp;
  }

  subscribe(callbacks: SignerLifecycleCallbacks): () => void {
    const unwatchAccount = watchAccount(this.config, {
      onChange: (account, previousAccount) => {
        if (previousAccount.isConnected && !account.isConnected) callbacks.onDisconnect?.();
        if (account.address) callbacks.onAccountChange?.(account.address);
      },
    });
    const unwatchChain = watchChainId(this.config, {
      onChange: (chainId) => callbacks.onChainChange?.(chainId),
    });

    return () => {
      unwatchAccount();
      unwatchChain();
    };
  }
}
