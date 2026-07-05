import { NextResponse } from "next/server";
import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { listClaimPayloadsForRecipient } from "@/lib/campaign-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("recipient");
  const signature = searchParams.get("signature");

  if (!recipient || !signature || !isAddress(recipient)) {
    return NextResponse.json({ error: "Signed recipient access is required" }, { status: 400 });
  }

  const verified = await verifyRecipientAccess(recipient, signature);
  if (!verified) {
    return NextResponse.json({ error: "Invalid recipient access signature" }, { status: 401 });
  }

  const claims = await listClaimPayloadsForRecipient(recipient);
  return NextResponse.json({ claims });
}

function recipientAccessMessage(recipient: string): string {
  return `Phase recipient access\nRecipient: ${recipient.toLowerCase()}`;
}

async function verifyRecipientAccess(recipient: string, signature: string): Promise<boolean> {
  try {
    return verifyMessage({
      address: recipient as Address,
      message: recipientAccessMessage(recipient),
      signature: signature as Hex,
    });
  } catch {
    return false;
  }
}
