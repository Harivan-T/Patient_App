// Shimmer loading placeholder — replaces ad-hoc animate-pulse divs and, where
// applied, whole-page spinners with content-shaped skeletons.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden />;
}

// A card-shaped skeleton list for typical list pages.
export function SkeletonCards({ count = 3, cardClassName = 'h-28' }: { count?: number; cardClassName?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5" style={{ animationDelay: `${i * 80}ms` }}>
          <Skeleton className={`w-full ${cardClassName}`} />
        </div>
      ))}
    </div>
  );
}
