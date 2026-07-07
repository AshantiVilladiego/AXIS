'use client';

import {
  CHAT_MODEL_LABELS,
  CHAT_MODEL_PROVIDERS,
  type ChatModelProvider,
} from '@/lib/types';

interface ModelSwitchProps {
  value: ChatModelProvider;
  onChange: (model: ChatModelProvider) => void;
  label: string;
}

export function ModelSwitch({ value, onChange, label }: ModelSwitchProps) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-900/60">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ChatModelProvider)}
        className="cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 outline-none transition-colors hover:border-indigo-600 focus:border-indigo-600"
      >
        {CHAT_MODEL_PROVIDERS.map((provider) => (
          <option key={provider} value={provider}>
            {CHAT_MODEL_LABELS[provider]}
          </option>
        ))}
      </select>
    </label>
  );
}