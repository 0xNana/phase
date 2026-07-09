import AppChrome from "./components/AppChrome";
import { SkeletonCard } from "./components/Skeleton";

export default function HomeLoading() {
  return (
    <AppChrome>
      <section className="product-page product-overview" aria-busy="true" aria-label="Loading Phase">
        <div className="distribution-directory-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>
    </AppChrome>
  );
}
