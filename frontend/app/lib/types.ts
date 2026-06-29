import type { Address, Hex } from "viem";
import type { EncryptedInput } from "@tokenops/sdk/fhe-airdrop";

export type CampaignStatus = "draft" | "deploying" | "live" | "ended";
export type CampaignKind = "claim" | "batch" | "vesting";

export interface RecipientCsvRow {
  address: Address;
  amount: bigint;
}

export interface PublicRecipientPreview {
  maskedAddress: string;
  status: "pending" | "revealed" | "claimed";
  proofHash: Hex;
}

export interface Campaign {
  id: string;
  name: string;
  kind?: CampaignKind;
  tokenAddress: Address;
  airdropAddress?: Address;
  creator?: Address;
  startTimestamp: number;
  endTimestamp: number;
  recipientCount: number;
  claimsCount: number;
  status: CampaignStatus;
  metadataUri?: string;
  createdAt: string;
  updatedAt: string;
  previews: PublicRecipientPreview[];
}

export interface ClaimPayload {
  campaignId: string;
  recipient: Address;
  encryptedInput: EncryptedInput;
  signature: Hex;
  issuedAt: string;
  revealedAt?: string;
  claimedAt?: string;
}

export interface VestingScheduleRecord {
  campaignId: string;
  recipient: Address;
  vestingId: Hex;
  managerAddress?: Address;
  batchIndex?: number;
  txHash?: Hex;
  createdAt: string;
}

export interface CampaignInput {
  name: string;
  kind: CampaignKind;
  tokenAddress: Address;
  airdropAddress?: Address;
  creator?: Address;
  startTimestamp?: number;
  endTimestamp?: number;
  recipientCount: number;
  status?: CampaignStatus;
  metadataUri?: string;
}

export interface IssueClaimInput {
  recipient: Address;
  encryptedInput: EncryptedInput;
  signature: Hex;
}

export interface SaveVestingScheduleInput {
  recipient: Address;
  vestingId: Hex;
  managerAddress?: Address;
  batchIndex?: number;
  txHash?: Hex;
}

export interface PhaseDb {
  campaigns: Campaign[];
  claims: ClaimPayload[];
  vestingSchedules: VestingScheduleRecord[];
}
