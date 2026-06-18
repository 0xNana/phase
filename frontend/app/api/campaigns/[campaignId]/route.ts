import { NextResponse } from "next/server";
import { getCampaign, updateCampaignStatus } from "@/lib/campaign-store";
import type { CampaignStatus } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const body = (await request.json()) as { status?: CampaignStatus };
  if (!isCampaignStatus(body.status)) {
    return NextResponse.json({ error: "Valid campaign status is required" }, { status: 400 });
  }

  const campaign = await updateCampaignStatus(campaignId, body.status);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

function isCampaignStatus(value: unknown): value is CampaignStatus {
  return value === "draft" || value === "deploying" || value === "live" || value === "ended";
}
