import type { Campaign } from "@/lib/types";

export function adminAccessMessage(campaignId: string, admin: string): string {
  return `Phase admin access\nCampaign: ${campaignId}\nAdmin: ${admin.toLowerCase()}`;
}

export function isCampaignCreator(campaign: Campaign | null | undefined, address?: string | null): boolean {
  if (!campaign || !address || !campaign.creator) return false;
  return campaign.creator.toLowerCase() === address.toLowerCase();
}

export function adminAccessStorageKey(campaignId: string, admin: string): string {
  return `phase:admin:${campaignId}:${admin.toLowerCase()}`;
}
