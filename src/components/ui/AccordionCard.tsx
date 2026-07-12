'use client';

import { ChevronDownIcon } from './icons';

// Shared expandable card — replaces the per-page card+chevron accordions.
// Expansion animates smoothly via the CSS grid-template-rows 0fr→1fr trick
// (no JS height measuring), and the content stays mounted for state retention.
export function AccordionCard({
  header,
  open,
  onToggle,
  children,
  className = '',
  headerClassName = '',
}: {
  header: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 text-start px-5 py-4 ${headerClassName}`}
      >
        <div className="flex-1 min-w-0">{header}</div>
        <ChevronDownIcon
          className={`w-5 h-5 shrink-0 text-gray-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">{children}</div>
      </div>
    </div>
  );
}
