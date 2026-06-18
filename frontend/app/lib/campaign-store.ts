import { promises as fs } from "node:fs";
import path from "node:path";
import { isAddress } from "viem";
import { hashish, maskAddress } from "./format";
import type {
  Campaign,
  CampaignInput,
  ClaimPayload,
  IssueClaimInput,
  PublicRecipientPreview,
  PhaseDb,
} from "./types";

const dbPath =
  process.env.PHASE_DB_PATH ||
  path.join(process.cwd(), ".data", "phase-db.json");

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

async function ensureDb(): Promise<PhaseDb> {
  try {
    const raw = await fs.readFile(dbPath, "utf8");
    return JSON.parse(raw) as PhaseDb;
  } catch {
    const empty: PhaseDb = {
      campaigns: [],
      claims: [],
    };
    await writeDb(empty);
    return empty;
  }
}

async function writeDb(db: PhaseDb): Promise<void> {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

export async function listCampaigns(): Promise<Campaign[]> {
  const db = await ensureDb();
  return db.campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const db = await ensureDb();
  return db.campaigns.find((campaign) => campaign.id === id) ?? null;
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const db = await ensureDb();
  const now = new Date().toISOString();
  const nowTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = input.startTimestamp ?? nowTimestamp;
  const endTimestamp = input.endTimestamp && input.endTimestamp > startTimestamp ? input.endTimestamp : startTimestamp + 86400;
  const baseId = slugify(input.name);
  let id = baseId;
  let i = 2;
  while (db.campaigns.some((campaign) => campaign.id === id)) {
    id = `${baseId}-${i}`;
    i += 1;
  }

  const campaign: Campaign = {
    id,
    name: input.name.trim(),
    kind: input.kind,
    tokenAddress: input.tokenAddress,
    airdropAddress: input.airdropAddress,
    creator: input.creator,
    startTimestamp,
    endTimestamp,
    recipientCount: input.recipientCount,
    claimsCount: 0,
    status: input.status ?? (input.airdropAddress ? "live" : "draft"),
    metadataUri: input.metadataUri,
    createdAt: now,
    updatedAt: now,
    previews: [],
  };

  db.campaigns.unshift(campaign);
  await writeDb(db);
  return campaign;
}

export async function updateCampaignStatus(id: string, status: Campaign["status"]): Promise<Campaign | null> {
  const db = await ensureDb();
  const campaign = db.campaigns.find((item) => item.id === id);
  if (!campaign) return null;

  campaign.status = status;
  campaign.updatedAt = new Date().toISOString();
  await writeDb(db);
  return campaign;
}

export async function saveClaimPayload(campaignId: string, input: IssueClaimInput): Promise<ClaimPayload> {
  const db = await ensureDb();
  const campaign = db.campaigns.find((item) => item.id === campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const existingIndex = db.claims.findIndex(
    (claim) =>
      claim.campaignId === campaignId &&
      claim.recipient.toLowerCase() === input.recipient.toLowerCase(),
  );

  const payload: ClaimPayload = {
    campaignId,
    recipient: input.recipient,
    encryptedInput: input.encryptedInput,
    signature: input.signature,
    issuedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    db.claims[existingIndex] = payload;
  } else {
    db.claims.push(payload);
  }

  campaign.previews = upsertPreview(campaign.previews, input.recipient, "pending");
  campaign.updatedAt = new Date().toISOString();
  await writeDb(db);
  return payload;
}

export async function getClaimPayload(campaignId: string, recipient: string): Promise<ClaimPayload | null> {
  if (!isAddress(recipient)) return null;
  const db = await ensureDb();
  return (
    db.claims.find(
      (claim) =>
        claim.campaignId === campaignId &&
        claim.recipient.toLowerCase() === recipient.toLowerCase(),
    ) ?? null
  );
}

export async function markClaimState(
  campaignId: string,
  recipient: string,
  state: "revealed" | "claimed",
): Promise<Campaign | null> {
  if (!isAddress(recipient)) return null;
  const db = await ensureDb();
  const campaign = db.campaigns.find((item) => item.id === campaignId);
  const claim = db.claims.find(
    (item) => item.campaignId === campaignId && item.recipient.toLowerCase() === recipient.toLowerCase(),
  );
  if (!campaign || !claim) return null;

  const now = new Date().toISOString();
  if (state === "revealed") claim.revealedAt = now;
  if (state === "claimed" && !claim.claimedAt) {
    claim.claimedAt = now;
    campaign.claimsCount += 1;
  }

  campaign.previews = upsertPreview(campaign.previews, recipient, state);
  campaign.updatedAt = now;
  await writeDb(db);
  return campaign;
}

function upsertPreview(
  previews: PublicRecipientPreview[],
  address: string,
  status: PublicRecipientPreview["status"],
): PublicRecipientPreview[] {
  const next = previews.filter((preview) => preview.maskedAddress !== maskAddress(address));
  next.unshift(previewFor(address, status));
  return next.slice(0, 8);
}
