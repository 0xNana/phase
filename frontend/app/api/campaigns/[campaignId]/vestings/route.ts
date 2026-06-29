import { NextResponse } from "next/server";
import { isAddress, isHex } from "viem";
import { listVestingSchedules, saveVestingSchedules } from "@/lib/campaign-store";
import type { SaveVestingScheduleInput } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const { searchParams } = new URL(request.url);
  const recipient = searchParams.get("recipient");

  if (recipient && !isAddress(recipient)) {
    return NextResponse.json({ error: "Valid recipient address is required" }, { status: 400 });
  }

  const vestings = await listVestingSchedules(campaignId, recipient);
  return NextResponse.json({ vestings });
}

export async function POST(request: Request, context: RouteContext) {
  const { campaignId } = await context.params;
  const body = (await request.json()) as { vestings?: Partial<SaveVestingScheduleInput>[] };

  if (!Array.isArray(body.vestings) || body.vestings.length === 0) {
    return NextResponse.json({ error: "At least one vesting schedule is required" }, { status: 400 });
  }

  const vestings: SaveVestingScheduleInput[] = [];
  for (const item of body.vestings) {
    if (!item.recipient || !isAddress(item.recipient)) {
      return NextResponse.json({ error: "Valid recipient address is required" }, { status: 400 });
    }
    if (!item.vestingId || !isHex(item.vestingId)) {
      return NextResponse.json({ error: "Valid vesting id is required" }, { status: 400 });
    }
    if (item.managerAddress && !isAddress(item.managerAddress)) {
      return NextResponse.json({ error: "Valid manager address is required" }, { status: 400 });
    }
    if (item.txHash && !isHex(item.txHash)) {
      return NextResponse.json({ error: "Valid transaction hash is required" }, { status: 400 });
    }

    vestings.push({
      recipient: item.recipient,
      vestingId: item.vestingId,
      managerAddress: item.managerAddress,
      batchIndex: typeof item.batchIndex === "number" ? item.batchIndex : undefined,
      txHash: item.txHash,
    });
  }

  try {
    const saved = await saveVestingSchedules(campaignId, vestings);
    return NextResponse.json({ vestings: saved }, { status: 201 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not save vesting schedules" }, { status: 404 });
  }
}
