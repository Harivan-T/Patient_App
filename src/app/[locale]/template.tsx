// Remounts on every route navigation, replaying the entrance animation —
// a zero-dependency page transition.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-up">{children}</div>;
}
