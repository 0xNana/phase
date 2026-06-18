import type { Address } from "viem";
import { safeAddress } from "./format";

const fallbackCusdcTokenAddress = "0x2a142E7C95C52e28f4E153766C837941C74F64b8" as Address;
const fallbackCusdcFaucetAddress = "0x0998DcF0E369a9e65008F743ab646CFe9db1b1AA" as Address;

export const sepoliaChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const rpcUrl =
  process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://ethereum-sepolia-rpc.publicnode.com";

export const cusdcTokenAddress =
  safeAddress(process.env.NEXT_PUBLIC_CUSDC_TOKEN_ADDRESS ?? fallbackCusdcTokenAddress) ??
  fallbackCusdcTokenAddress;

export const cusdcFaucetAddress =
  safeAddress(process.env.NEXT_PUBLIC_CUSDC_FAUCET_ADDRESS ?? fallbackCusdcFaucetAddress) ??
  fallbackCusdcFaucetAddress;

export const configuredToken = safeAddress(
  process.env.NEXT_PUBLIC_DEFAULT_CONFIDENTIAL_TOKEN ?? cusdcTokenAddress,
) ?? cusdcTokenAddress;

export const tokenOpsFactoryAddress = safeAddress(
  process.env.NEXT_PUBLIC_TOKENOPS_FACTORY_ADDRESS ?? "",
);

export const phaseRegistryAddress = safeAddress(
  process.env.NEXT_PUBLIC_PHASE_REGISTRY_ADDRESS ?? "",
);
