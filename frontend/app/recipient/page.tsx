import AppChrome from "../components/AppChrome";
import RecipientDashboard from "../components/RecipientDashboard";
import { listCampaigns } from "../lib/campaign-store";

export const dynamic = "force-dynamic";

export default async function RecipientPage() {
  const campaigns = await listCampaigns();
  const [campaign] = campaigns;

  return (
    <AppChrome campaignId={campaign?.id}>
      <RecipientDashboard campaigns={campaigns} />
    </AppChrome>
  );
}
