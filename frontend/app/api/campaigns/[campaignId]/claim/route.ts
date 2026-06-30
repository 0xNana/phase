import { NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { getClaimPayload, markClaimState } from "@/lib/campaign-store";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("recipient");
  const signature = searchParams.get("signature");

  if (!recipient || !signature || !isAddress(recipient)) {
    return NextResponse.json({ error: "Signed recipient access is required" }, { status: 400 });
  }

  const verified = await verifyClaimAccess(campaignId, recipient, signature);
  if (!verified) {
    return NextResponse.json({ error: "Invalid claim access signature" }, { status: 401 });
  }

  const claim = await getClaimPayload(campaignId, recipient);
  if (!claim) {
    return NextResponse.json({ error: "No claim payload for this wallet" }, { status: 404 });
  }

  return NextResponse.json({ claim });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const body = (await request.json()) as { recipient?: string; state?: "revealed" | "claimed"; signature?: string };

  if (!body.recipient || !body.state || !body.signature || !isAddress(body.recipient)) {
    return NextResponse.json({ error: "Signed recipient state update is required" }, { status: 400 });
  }

  const verified = await verifyClaimAccess(campaignId, body.recipient, body.signature);
  if (!verified) {
    return NextResponse.json({ error: "Invalid claim access signature" }, { status: 401 });
  }

  const campaign = await markClaimState(campaignId, body.recipient, body.state);
  if (!campaign) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

function claimAccessMessage(campaignId: string, recipient: string): string {
  return `Phase claim access\nCampaign: ${campaignId}\nRecipient: ${recipient.toLowerCase()}`;
}

async function verifyClaimAccess(campaignId: string, recipient: string, signature: string): Promise<boolean> {
  try {
    return verifyMessage({
      address: recipient as Address,
      message: claimAccessMessage(campaignId, recipient),
      signature: signature as Hex,
    });
  } catch {
    return false;
  }
}
