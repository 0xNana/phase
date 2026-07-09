import AppChrome from "./components/AppChrome";
import HomeDashboard from "./components/HomeDashboard";
import { listCampaigns } from "./lib/campaign-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const campaigns = await listCampaigns();

  return (
    <AppChrome campaignId={campaigns[0]?.id}>
      <HomeDashboard campaigns={campaigns} />
    </AppChrome>
  );
}
