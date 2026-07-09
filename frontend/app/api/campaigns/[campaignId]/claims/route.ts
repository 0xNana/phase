import { NextResponse } from "next/server";
import { isAddress, isHex } from "viem";
import { verifyAdminAccess } from "@/lib/admin-access-server";
import { listDistributionRecipients, saveClaimPayload } from "@/lib/campaign-store";
import type { IssueClaimInput } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const admin = searchParams.get("admin");
  const signature = searchParams.get("signature");

  if (!admin || !signature || !isAddress(admin)) {
    return NextResponse.json({ error: "Signed creator access is required" }, { status: 400 });
  }

  const verified = await verifyAdminAccess(campaignId, admin, signature);
  if (!verified) {
    return NextResponse.json({ error: "Invalid creator access signature" }, { status: 401 });
  }

  const recipients = await listDistributionRecipients(campaignId);
  return NextResponse.json({ recipients });
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const body = (await request.json()) as Partial<IssueClaimInput>;

  if (!body.recipient || !isAddress(body.recipient)) {
    return NextResponse.json({ error: "Valid recipient is required" }, { status: 400 });
  }
  if (!body.encryptedInput?.handle || !isHex(body.encryptedInput.handle)) {
    return NextResponse.json({ error: "Encrypted handle is required" }, { status: 400 });
  }
  if (!body.encryptedInput.inputProof || !isHex(body.encryptedInput.inputProof)) {
    return NextResponse.json({ error: "Input proof is required" }, { status: 400 });
  }
  if (!body.signature || !isHex(body.signature)) {
    return NextResponse.json({ error: "Claim signature is required" }, { status: 400 });
  }

  const claim = await saveClaimPayload(campaignId, {
    recipient: body.recipient,
    encryptedInput: body.encryptedInput,
    signature: body.signature,
  });

  return NextResponse.json({ claim }, { status: 201 });
}
