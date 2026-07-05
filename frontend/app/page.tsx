import AppChrome from "./components/AppChrome";
import HomeDashboard from "./components/HomeDashboard";
import { listCampaigns } from "./lib/campaign-store";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [campaign] = await listCampaigns();

  return (
    <AppChrome campaignId={campaign?.id}>
      <HomeDashboard campaign={campaign ?? null} />
    </AppChrome>
  );
}
