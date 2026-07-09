import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye, LockKeyhole, UserCheck } from "lucide-react";
import AppChrome from "../../components/AppChrome";
import CopyButton from "../../components/CopyButton";
import StatusBadge from "../../components/StatusBadge";
import { getCampaign } from "../../lib/campaign-store";
import { absoluteUrl, maskAddress } from "../../lib/format";
import { claimWindowLabel, formatUnixDate, formatUnixRange } from "../../lib/distribution-status";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  const distributionUrl = absoluteUrl(`/campaign/${campaign.id}`);
  const recipientUrl = absoluteUrl(`/claim/${campaign.id}`);
  const windowLabel = claimWindowLabel(campaign);

  return (
    <AppChrome campaignId={campaign.id}>
      <section className="distribution-page" aria-labelledby="distribution-title">
        <div className="distribution-hero panel">
          <div className="distribution-hero-top">
            <span className="product-kicker">
              <LockKeyhole size={15} aria-hidden="true" />
              Public distribution
            </span>
            <StatusBadge campaign={campaign} />
          </div>

          <h1 id="distribution-title">{campaign.name}</h1>
          <p>
            Recipients can reveal only their own allocation. Observers can verify activity without seeing amounts or the full
            recipient list.
          </p>

          <div className="distribution-stat-grid">
            <DistributionStat label="Status" value={campaign.status} />
            <DistributionStat label="Token" value={maskAddress(campaign.tokenAddress)} mono />
            <DistributionStat label="Claims" value={`${campaign.claimsCount} / ${campaign.recipientCount}`} />
            <DistributionStat label="Claim window" value={`${windowLabel} · ${formatUnixRange(campaign.startTimestamp, campaign.endTimestamp)}`} />
            <DistributionStat
              label="Launch date"
              value={formatUnixDate(
                Number.isFinite(Date.parse(campaign.createdAt))
                  ? Math.floor(Date.parse(campaign.createdAt) / 1000)
                  : campaign.startTimestamp,
              )}
            />
            <DistributionStat label="Privacy model" value="Sealed amounts · wallet-scoped reveal" />
          </div>

          <div className="distribution-actions">
            <Link className="button-primary" href={`/claim/${campaign.id}`}>
              Open Recipient Portal <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link className="button-secondary" href={`/observer/${campaign.id}`}>
              <Eye size={16} aria-hidden="true" />
              Observer view
            </Link>
            <CopyButton value={distributionUrl} label="Copy distribution link" />
            <CopyButton value={recipientUrl} label="Copy recipient link" className="button-ghost" />
          </div>
        </div>

        <div className="distribution-privacy panel">
          <h2>What stays private</h2>
          <ul>
            <li>Allocation amounts</li>
            <li>Full recipient list</li>
            <li>Aggregate totals</li>
          </ul>
          <p>
            Public pages show status, claim counts, masked addresses, and proof hashes only.
          </p>
          <Link className="button-secondary" href="/recipient">
            <UserCheck size={16} aria-hidden="true" />
            Recipient workspace
          </Link>
        </div>
      </section>
    </AppChrome>
  );
}

function DistributionStat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="distribution-stat">
      <span>{label}</span>
      <strong className={mono ? "mono" : undefined}>{value}</strong>
    </div>
  );
}
