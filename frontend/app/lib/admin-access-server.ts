import { isAddress, verifyMessage, type Address, type Hex } from "viem";
import { getCampaign } from "@/lib/campaign-store";
import { adminAccessMessage } from "@/lib/admin-access";

export async function verifyAdminAccess(campaignId: string, admin: string, signature: string): Promise<boolean> {
  if (!isAddress(admin)) return false;

  const campaign = await getCampaign(campaignId);
  if (!campaign?.creator) return false;
  if (campaign.creator.toLowerCase() !== admin.toLowerCase()) return false;

  try {
    return verifyMessage({
      address: admin as Address,
      message: adminAccessMessage(campaignId, admin),
      signature: signature as Hex,
    });
  } catch {
    return false;
  }
}
