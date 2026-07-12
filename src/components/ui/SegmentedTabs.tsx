'use client';

// Shared segmented tab toggle — replaces the per-page copies of the
// .seg-toggle + active-pill pattern. The active pill is a single absolutely
// positioned element that slides between equal-width segments; positioning
// uses inset-inline-start so RTL works without special-casing.

export interface SegTab<T extends string> {
  id: T;
  label: React.ReactNode;
}

export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: SegTab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const n = tabs.length;
  const index = Math.max(0, tabs.findIndex((t) => t.id === active));

  return (
    <div className={`seg-toggle !gap-0 relative ${className}`} role="tablist">
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-lg shadow-sm transition-[inset-inline-start] duration-300 ease-out"
        style={{
          background: 'var(--color-primary)',
          width: `calc((100% - 8px) / ${n})`,
          insetInlineStart: `calc(4px + ${index} * ((100% - 8px) / ${n}))`,
        }}
      />
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === active}
          onClick={() => onChange(tab.id)}
          className={`relative z-[1] flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-300 ${
            tab.id === active ? 'text-white' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
