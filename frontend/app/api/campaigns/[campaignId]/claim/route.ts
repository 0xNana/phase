import { NextResponse } from "next/server";
import { getClaimPayload, markClaimState } from "@/lib/campaign-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("recipient");

  if (!recipient) {
    return NextResponse.json({ error: "Recipient address is required" }, { status: 400 });
  }

  const claim = await getClaimPayload(campaignId, recipient);
  if (!claim) {
    return NextResponse.json({ error: "No claim payload for this wallet" }, { status: 404 });
  }

  return NextResponse.json({ claim });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const body = (await request.json()) as { recipient?: string; state?: "revealed" | "claimed" };

  if (!body.recipient || !body.state) {
    return NextResponse.json({ error: "Recipient and state are required" }, { status: 400 });
  }

  const campaign = await markClaimState(campaignId, body.recipient, body.state);
  if (!campaign) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}
