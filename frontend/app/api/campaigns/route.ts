import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { createCampaign, listCampaigns } from "@/lib/campaign-store";
import type { CampaignInput, CampaignKind, CampaignStatus } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ campaigns });
  } catch (cause) {
    return storageErrorResponse(cause, "Could not load campaigns");
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<CampaignInput> | null;
  if (!body) {
    return NextResponse.json({ error: "Valid campaign JSON is required" }, { status: 400 });
  }
  const campaignKind: CampaignKind =
    body.kind === "batch" || body.kind === "vesting" || body.kind === "claim" ? body.kind : "claim";

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
  }
  if (!body.tokenAddress || !isAddress(body.tokenAddress)) {
    return NextResponse.json({ error: "Valid token address is required" }, { status: 400 });
  }
  if (body.airdropAddress && !isAddress(body.airdropAddress)) {
    return NextResponse.json({ error: "Invalid airdrop address" }, { status: 400 });
  }
  if (campaignKind !== "batch" && (!body.startTimestamp || !body.endTimestamp || body.endTimestamp <= body.startTimestamp)) {
    return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
  }

  try {
    const campaign = await createCampaign({
      name: body.name,
      kind: campaignKind,
      tokenAddress: body.tokenAddress,
      airdropAddress: body.airdropAddress,
      creator: body.creator,
      startTimestamp: body.startTimestamp,
      endTimestamp: body.endTimestamp,
      recipientCount: Number(body.recipientCount ?? 0),
      status: parseCampaignStatus(body.status),
      metadataUri: body.metadataUri,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (cause) {
    return storageErrorResponse(cause, "Could not save campaign");
  }
}

function parseCampaignStatus(value: unknown): CampaignStatus | undefined {
  return value === "draft" || value === "deploying" || value === "live" || value === "ended" ? value : undefined;
}

function storageErrorResponse(cause: unknown, fallback: string) {
  const detail = cause instanceof Error ? cause.message : fallback;
  return NextResponse.json({ error: detail }, { status: 500 });
}
