import AppChrome from "../components/AppChrome";
import AdminBuilder from "../components/AdminBuilder";
import { listCampaigns } from "../lib/campaign-store";

export default async function AdminPage() {
  const campaigns = await listCampaigns();
  const [campaign] = campaigns;

  return (
    <AppChrome campaignId={campaign?.id}>
      <AdminBuilder />
    </AppChrome>
  );
}
