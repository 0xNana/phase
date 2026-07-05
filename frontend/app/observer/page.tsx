import AppChrome from "../components/AppChrome";
import ObserverDashboard from "../components/ObserverDashboard";
import { listCampaigns } from "../lib/campaign-store";

export const dynamic = "force-dynamic";

export default async function ObserverIndexPage() {
  const campaigns = await listCampaigns();
  const [campaign] = campaigns;

  return (
    <AppChrome campaignId={campaign?.id}>
      <ObserverDashboard campaigns={campaigns} />
    </AppChrome>
  );
}
