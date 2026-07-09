import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyAdminAccess } from "@/lib/admin-access-server";
import { getCampaign, updateCampaignEndTimestamp, updateCampaignStatus } from "@/lib/campaign-store";
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
  const body = (await request.json()) as {
    status?: CampaignStatus;
    endTimestamp?: number;
    admin?: string;
    signature?: string;
  };

  if (body.status !== undefined) {
    if (!isCampaignStatus(body.status)) {
      return NextResponse.json({ error: "Valid campaign status is required" }, { status: 400 });
    }

    const campaign = await updateCampaignStatus(campaignId, body.status);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  }

  if (body.endTimestamp !== undefined) {
    if (!Number.isFinite(body.endTimestamp) || body.endTimestamp <= 0) {
      return NextResponse.json({ error: "Valid end timestamp is required" }, { status: 400 });
    }
    if (!body.admin || !body.signature || !isAddress(body.admin)) {
      return NextResponse.json({ error: "Signed creator access is required" }, { status: 400 });
    }

    const verified = await verifyAdminAccess(campaignId, body.admin, body.signature);
    if (!verified) {
      return NextResponse.json({ error: "Invalid creator access signature" }, { status: 401 });
    }

    const campaign = await updateCampaignEndTimestamp(campaignId, Math.floor(body.endTimestamp));
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  }

  return NextResponse.json({ error: "No supported update fields provided" }, { status: 400 });
}

function isCampaignStatus(value: unknown): value is CampaignStatus {
  return value === "draft" || value === "deploying" || value === "live" || value === "ended";
}
