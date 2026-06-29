import { notFound } from "next/navigation";
import AppChrome from "../../components/AppChrome";
import RecipientVesting from "../../components/RecipientVesting";
import { getCampaign } from "../../lib/campaign-store";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function VestingPage({ params }: PageProps) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <AppChrome campaignId={campaign.id}>
      <RecipientVesting campaign={campaign} />
    </AppChrome>
  );
}
