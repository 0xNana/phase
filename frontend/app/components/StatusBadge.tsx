import type { Campaign } from "@/lib/types";
import { distributionBadge, type DistributionBadge } from "@/lib/distribution-status";

export type { DistributionBadge };

const badgeCopy: Record<DistributionBadge, string> = {
  active: "Active",
  scheduled: "Scheduled",
  ended: "Ended",
  paused: "Paused",
  setup: "Setup",
};

export default function StatusBadge({
  campaign,
  badge,
}: {
  campaign?: Campaign;
  badge?: DistributionBadge;
}) {
  const resolved = badge ?? (campaign ? distributionBadge(campaign) : "setup");
  return <span className={`pill status-badge is-${resolved}`}>{badgeCopy[resolved]}</span>;
}
