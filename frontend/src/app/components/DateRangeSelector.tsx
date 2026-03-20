import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { Button } from './ui/button';

export type DatePreset = '7d' | '14d' | '30d' | 'this_month' | 'last_month';

interface PresetOption {
  value: DatePreset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '14d', label: 'Last 14 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

interface DateRangeSelectorProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = PRESET_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select Range';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Calendar className="w-4 h-4" />
        {currentLabel}
        <ChevronDown className="w-4 h-4 ml-1 opacity-50" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-[100]">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
              {value === option.value && <Check className="w-4 h-4 text-[#0EA5E9]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function getPresetLabel(preset: DatePreset): string {
  return PRESET_OPTIONS.find((opt) => opt.value === preset)?.label ?? preset;
}
