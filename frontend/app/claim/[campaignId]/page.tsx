import { notFound } from "next/navigation";
import AppChrome from "../../components/AppChrome";
import CampaignSummary from "../../components/CampaignSummary";
import RecipientClaim from "../../components/RecipientClaim";
import { getCampaign } from "../../lib/campaign-store";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function ClaimPage({ params }: PageProps) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <AppChrome campaignId={campaign.id}>
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="order-2 xl:order-1">
          <CampaignSummary campaign={campaign} />
        </div>
        <div className="order-1 xl:order-2">
          <RecipientClaim campaign={campaign} />
        </div>
      </div>
    </AppChrome>
  );
}
