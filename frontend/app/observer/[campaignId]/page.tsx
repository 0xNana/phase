import { notFound } from "next/navigation";
import AppChrome from "../../components/AppChrome";
import ObserverView from "../../components/ObserverView";
import { getCampaign } from "../../lib/campaign-store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ campaignId: string }>;
};

export default async function ObserverPage({ params }: PageProps) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <AppChrome campaignId={campaign.id}>
      <ObserverView campaign={campaign} />
    </AppChrome>
  );
}
