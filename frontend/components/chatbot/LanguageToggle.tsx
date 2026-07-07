'use client';

import type { ChatLanguage } from '@/lib/types';

interface LanguageToggleProps {
  value: ChatLanguage;
  onChange: (language: ChatLanguage) => void;
  label: string;
}

const OPTIONS: { value: ChatLanguage; short: string }[] = [
  { value: 'en', short: 'EN' },
  { value: 'tl', short: 'TL' },
];

export function LanguageToggle({ value, onChange, label }: LanguageToggleProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex rounded-full bg-slate-100 p-0.5 text-xs font-medium"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={[
                'rounded-full px-2.5 py-1 transition-colors',
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-900/60 hover:text-slate-900',
              ].join(' ')}
            >
              {opt.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}