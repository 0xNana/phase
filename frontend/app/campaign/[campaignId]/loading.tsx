import AppChrome from "../../components/AppChrome";
import { SkeletonCard } from "../../components/Skeleton";

export default function CampaignLoading() {
  return (
    <AppChrome>
      <section className="distribution-page" aria-busy="true" aria-label="Loading distribution">
        <SkeletonCard />
        <SkeletonCard />
      </section>
    </AppChrome>
  );
}
