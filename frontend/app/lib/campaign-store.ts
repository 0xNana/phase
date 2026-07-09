import { isAddress, type Address, type Hex } from "viem";
import { hashish, maskAddress } from "./format";
import { getSupabase } from "./supabase/server";
import type {
  Campaign,
  CampaignInput,
  ClaimPayload,
  IssueClaimInput,
  PublicRecipientPreview,
  SaveVestingScheduleInput,
  VestingScheduleRecord,
  DistributionRecipientRow,
} from "./types";

type CampaignRow = {
  id: string;
  name: string;
  kind: Campaign["kind"] | null;
  token_address: string;
  airdrop_address: string | null;
  creator: string | null;
  start_timestamp: number;
  end_timestamp: number;
  recipient_count: number;
  claims_count: number;
  status: Campaign["status"];
  metadata_uri: string | null;
  created_at: string;
  updated_at: string;
};

type PreviewRow = {
  campaign_id: string;
  recipient_address: string;
  masked_address: string;
  status: PublicRecipientPreview["status"];
  proof_hash: string;
  updated_at: string;
};

type ClaimRow = {
  campaign_id: string;
  recipient: string;
  encrypted_handle: string;
  input_proof: string;
  signature: string;
  issued_at: string;
  revealed_at: string | null;
  claimed_at: string | null;
};

type VestingRow = {
  campaign_id: string;
  recipient: string;
  vesting_id: string;
  manager_address: string | null;
  batch_index: number | null;
  tx_hash: string | null;
  created_at: string;
};

function previewFor(address: string, status: PublicRecipientPreview["status"]): PublicRecipientPreview {
  return {
    maskedAddress: maskAddress(address),
    status,
    proofHash: hashish(`${address}:${status}`),
  };
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `campaign-${Date.now()}`
  );
}

function mapCampaign(row: CampaignRow, previews: PublicRecipientPreview[]): Campaign {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind ?? undefined,
    tokenAddress: row.token_address as Address,
    airdropAddress: row.airdrop_address ? (row.airdrop_address as Address) : undefined,
    creator: row.creator ? (row.creator as Address) : undefined,
    startTimestamp: Number(row.start_timestamp),
    endTimestamp: Number(row.end_timestamp),
    recipientCount: row.recipient_count,
    claimsCount: row.claims_count,
    status: row.status,
    metadataUri: row.metadata_uri ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previews,
  };
}

function mapPreview(row: PreviewRow): PublicRecipientPreview {
  return {
    maskedAddress: row.masked_address,
    status: row.status,
    proofHash: row.proof_hash as Hex,
  };
}

function mapClaim(row: ClaimRow): ClaimPayload {
  return {
    campaignId: row.campaign_id,
    recipient: row.recipient as Address,
    encryptedInput: {
      handle: row.encrypted_handle as Hex,
      inputProof: row.input_proof as Hex,
    },
    signature: row.signature as Hex,
    issuedAt: row.issued_at,
    revealedAt: row.revealed_at ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
  };
}

function mapVesting(row: VestingRow): VestingScheduleRecord {
  return {
    campaignId: row.campaign_id,
    recipient: row.recipient as Address,
    vestingId: row.vesting_id as Hex,
    managerAddress: row.manager_address ? (row.manager_address as Address) : undefined,
    batchIndex: row.batch_index ?? undefined,
    txHash: row.tx_hash ? (row.tx_hash as Hex) : undefined,
    createdAt: row.created_at,
  };
}

async function loadPreviewsForCampaigns(campaignIds: string[]): Promise<Map<string, PublicRecipientPreview[]>> {
  const previewsByCampaign = new Map<string, PublicRecipientPreview[]>();
  if (campaignIds.length === 0) return previewsByCampaign;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("campaign_previews")
    .select("campaign_id, recipient_address, masked_address, status, proof_hash, updated_at")
    .in("campaign_id", campaignIds)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as PreviewRow[]) {
    const current = previewsByCampaign.get(row.campaign_id) ?? [];
    current.push(mapPreview(row));
    previewsByCampaign.set(row.campaign_id, current);
  }

  return previewsByCampaign;
}

async function upsertPreview(campaignId: string, address: string, status: PublicRecipientPreview["status"]): Promise<void> {
  const supabase = getSupabase();
  const preview = previewFor(address, status);
  const now = new Date().toISOString();

  const { error } = await supabase.from("campaign_previews").upsert(
    {
      campaign_id: campaignId,
      recipient_address: address.toLowerCase(),
      masked_address: preview.maskedAddress,
      status: preview.status,
      proof_hash: preview.proofHash,
      updated_at: now,
    },
    { onConflict: "campaign_id,recipient_address" },
  );

  if (error) throw new Error(error.message);

}

async function uniqueCampaignId(name: string): Promise<string> {
  const supabase = getSupabase();
  const baseId = slugify(name);
  let id = baseId;
  let i = 2;

  while (true) {
    const { data, error } = await supabase.from("campaigns").select("id").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return id;
    id = `${baseId}-${i}`;
    i += 1;
  }
}

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CampaignRow[];
  const previewsByCampaign = await loadPreviewsForCampaigns(rows.map((row) => row.id));
  return rows.map((row) => mapCampaign(row, previewsByCampaign.get(row.id) ?? []));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const previewsByCampaign = await loadPreviewsForCampaigns([id]);
  return mapCampaign(data as CampaignRow, previewsByCampaign.get(id) ?? []);
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = input.startTimestamp ?? nowTimestamp;
  const endTimestamp =
    input.endTimestamp && input.endTimestamp > startTimestamp ? input.endTimestamp : startTimestamp + 86400;
  const id = await uniqueCampaignId(input.name);

  const row: CampaignRow = {
    id,
    name: input.name.trim(),
    kind: input.kind,
    token_address: input.tokenAddress,
    airdrop_address: input.airdropAddress ?? null,
    creator: input.creator ?? null,
    start_timestamp: startTimestamp,
    end_timestamp: endTimestamp,
    recipient_count: input.recipientCount,
    claims_count: 0,
    status: input.status ?? (input.airdropAddress ? "live" : "draft"),
    metadata_uri: input.metadataUri ?? null,
    created_at: now,
    updated_at: now,
  };

  const { error } = await supabase.from("campaigns").insert(row);
  if (error) throw new Error(error.message);

  return mapCampaign(row, []);
}

export async function listDistributionRecipients(campaignId: string): Promise<DistributionRecipientRow[]> {
  const supabase = getSupabase();
  const { data: claims, error: claimsError } = await supabase
    .from("claims")
    .select("recipient, revealed_at, claimed_at")
    .eq("campaign_id", campaignId)
    .order("issued_at", { ascending: true });

  if (claimsError) throw new Error(claimsError.message);

  const { data: previews, error: previewsError } = await supabase
    .from("campaign_previews")
    .select("recipient_address, masked_address, status")
    .eq("campaign_id", campaignId);

  if (previewsError) throw new Error(previewsError.message);

  const previewByRecipient = new Map<string, { maskedAddress: string; status: PublicRecipientPreview["status"] }>();
  for (const row of previews ?? []) {
    previewByRecipient.set(String(row.recipient_address).toLowerCase(), {
      maskedAddress: String(row.masked_address),
      status: row.status as PublicRecipientPreview["status"],
    });
  }

  return ((claims ?? []) as Array<{ recipient: string; revealed_at: string | null; claimed_at: string | null }>).map((claim) => {
    const recipient = claim.recipient as Address;
    const preview = previewByRecipient.get(recipient.toLowerCase());
    const status = preview?.status ?? "pending";
    const revealStatus: DistributionRecipientRow["revealStatus"] =
      status === "revealed" || status === "claimed" || claim.revealed_at ? "revealed" : "not_revealed";
    const claimStatus: DistributionRecipientRow["claimStatus"] =
      status === "claimed" || claim.claimed_at ? "claimed" : "not_claimed";

    return {
      recipient,
      maskedAddress: preview?.maskedAddress ?? maskAddress(recipient),
      revealStatus,
      claimStatus,
    };
  });
}

export async function updateCampaignEndTimestamp(id: string, endTimestamp: number): Promise<Campaign | null> {
  const supabase = getSupabase();
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ end_timestamp: endTimestamp, updated_at: updatedAt })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const previewsByCampaign = await loadPreviewsForCampaigns([id]);
  return mapCampaign(data as CampaignRow, previewsByCampaign.get(id) ?? []);
}

export async function updateCampaignStatus(id: string, status: Campaign["status"]): Promise<Campaign | null> {
  const supabase = getSupabase();
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status, updated_at: updatedAt })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const previewsByCampaign = await loadPreviewsForCampaigns([id]);
  return mapCampaign(data as CampaignRow, previewsByCampaign.get(id) ?? []);
}

export async function saveClaimPayload(campaignId: string, input: IssueClaimInput): Promise<ClaimPayload> {
  const supabase = getSupabase();
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const issuedAt = new Date().toISOString();
  const row = {
    campaign_id: campaignId,
    recipient: input.recipient.toLowerCase(),
    encrypted_handle: input.encryptedInput.handle,
    input_proof: input.encryptedInput.inputProof,
    signature: input.signature,
    issued_at: issuedAt,
    revealed_at: null,
    claimed_at: null,
  };

  const { data, error } = await supabase
    .from("claims")
    .upsert(row, { onConflict: "campaign_id,recipient" })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await upsertPreview(campaignId, input.recipient, "pending");

  const { error: campaignError } = await supabase
    .from("campaigns")
    .update({ updated_at: issuedAt })
    .eq("id", campaignId);

  if (campaignError) throw new Error(campaignError.message);

  return mapClaim(data as ClaimRow);
}

export async function getClaimPayload(campaignId: string, recipient: string): Promise<ClaimPayload | null> {
  if (!isAddress(recipient)) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("recipient", recipient.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return mapClaim(data as ClaimRow);
}

export async function listClaimPayloadsForRecipient(recipient: string): Promise<ClaimPayload[]> {
  if (!isAddress(recipient)) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .eq("recipient", recipient.toLowerCase());

  if (error) throw new Error(error.message);
  return ((data ?? []) as ClaimRow[]).map(mapClaim);
}

export async function saveVestingSchedules(
  campaignId: string,
  inputs: SaveVestingScheduleInput[],
): Promise<VestingScheduleRecord[]> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const supabase = getSupabase();
  const now = new Date().toISOString();
  const rows = inputs.map((input) => ({
    campaign_id: campaignId,
    recipient: input.recipient.toLowerCase(),
    vesting_id: input.vestingId,
    manager_address: input.managerAddress ?? campaign.airdropAddress ?? null,
    batch_index: input.batchIndex ?? null,
    tx_hash: input.txHash ?? null,
    created_at: now,
  }));

  const { data, error } = await supabase.from("vesting_schedules").upsert(rows, { onConflict: "campaign_id,vesting_id" }).select("*");
  if (error) throw new Error(error.message);

  for (const input of inputs) {
    await upsertPreview(campaignId, input.recipient, "pending");
  }

  const { error: campaignError } = await supabase.from("campaigns").update({ updated_at: now }).eq("id", campaignId);
  if (campaignError) throw new Error(campaignError.message);

  return ((data ?? []) as VestingRow[]).map(mapVesting);
}

export async function listVestingSchedules(campaignId: string, recipient?: string | null): Promise<VestingScheduleRecord[]> {
  if (recipient && !isAddress(recipient)) return [];

  const supabase = getSupabase();
  let query = supabase.from("vesting_schedules").select("*").eq("campaign_id", campaignId);
  if (recipient) query = query.eq("recipient", recipient.toLowerCase());

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return ((data ?? []) as VestingRow[]).map(mapVesting);
}

export async function markClaimState(
  campaignId: string,
  recipient: string,
  state: "revealed" | "claimed",
): Promise<Campaign | null> {
  if (!isAddress(recipient)) return null;

  const supabase = getSupabase();
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;

  const { data: claim, error: claimLookupError } = await supabase
    .from("claims")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("recipient", recipient.toLowerCase())
    .maybeSingle();

  if (claimLookupError) throw new Error(claimLookupError.message);
  if (!claim) return null;

  const now = new Date().toISOString();
  const claimPatch: Partial<ClaimRow> = {};
  if (state === "revealed") claimPatch.revealed_at = now;
  if (state === "claimed" && !claim.claimed_at) claimPatch.claimed_at = now;

  const { error: claimError } = await supabase
    .from("claims")
    .update(claimPatch)
    .eq("campaign_id", campaignId)
    .eq("recipient", recipient.toLowerCase());

  if (claimError) throw new Error(claimError.message);

  if (state === "claimed" && !claim.claimed_at) {
    const { error: countError } = await supabase
      .from("campaigns")
      .update({
        claims_count: campaign.claimsCount + 1,
        updated_at: now,
      })
      .eq("id", campaignId);

    if (countError) throw new Error(countError.message);
  } else {
    const { error: touchError } = await supabase.from("campaigns").update({ updated_at: now }).eq("id", campaignId);
    if (touchError) throw new Error(touchError.message);
  }

  await upsertPreview(campaignId, recipient, state);
  return getCampaign(campaignId);
}
