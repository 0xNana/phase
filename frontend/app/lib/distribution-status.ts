import type { Campaign } from "@/lib/types";

export type DistributionBadge = "active" | "scheduled" | "ended" | "paused" | "setup";

export function claimWindowLabel(campaign: Campaign, now = Math.floor(Date.now() / 1000)): string {
  if (now < campaign.startTimestamp) return "Scheduled";
  if (now > campaign.endTimestamp) return "Closed";
  return "Open";
}

export function resolveDistributionBadge(
  campaign: Campaign,
  options?: { now?: number; isPaused?: boolean; endTimestamp?: number },
): DistributionBadge {
  const now = options?.now ?? Math.floor(Date.now() / 1000);
  const endTimestamp = options?.endTimestamp ?? campaign.endTimestamp;

  if (options?.isPaused) return "paused";
  if (campaign.status === "ended") return "ended";
  if (campaign.status === "draft" || campaign.status === "deploying") return "setup";
  if (campaign.status === "live") {
    if (now < campaign.startTimestamp) return "scheduled";
    if (now > endTimestamp) return "ended";
    return "active";
  }
  return campaign.status === "ended" ? "ended" : "setup";
}

export function claimProgressPercent(claims: number, recipients: number): number {
  if (recipients <= 0) return 0;
  return Math.min(100, Math.round((claims / recipients) * 100));
}

export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Window closed";
  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function distributionBadge(
  campaign: Campaign,
  now = Math.floor(Date.now() / 1000),
  options?: { isPaused?: boolean; endTimestamp?: number },
): DistributionBadge {
  return resolveDistributionBadge(campaign, { now, ...options });
}

export function formatUnixDate(timestamp: number): string {
  if (!timestamp) return "—";
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatUnixRange(start: number, end: number): string {
  return `${formatUnixDate(start)} → ${formatUnixDate(end)}`;
}
