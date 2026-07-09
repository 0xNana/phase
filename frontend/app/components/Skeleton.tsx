export default function Skeleton({
  className = "",
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={`skeleton-stack ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card panel" aria-hidden="true">
      <div className="skeleton-row is-title" />
      <div className="skeleton-row" />
      <div className="skeleton-row is-short" />
    </div>
  );
}
