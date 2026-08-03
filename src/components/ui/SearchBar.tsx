'use client';

import { SearchIcon, CloseIcon } from './icons';

// Shared search input — replaces the identical bordered magnifier+clear-X
// blocks previously copy-pasted in appointments, medications, labs, health.
export function SearchBar({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 border border-border rounded-lg px-2.5 focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:border-transparent ${className}`}
      style={{ background: 'var(--card-bg)' }}
    >
      <SearchIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="flex-1 py-1.5 bg-transparent text-sm focus:outline-none"
        style={{ color: 'var(--color-heading)' }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
          aria-label="Clear"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
