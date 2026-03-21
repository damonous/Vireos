import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type DatePreset = '7d' | '14d' | '30d' | 'this_month' | 'last_month' | 'custom';

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
  { value: 'custom', label: 'Custom Range' },
];

interface DateRangeSelectorProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLabel = PRESET_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select Range';

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback(
    (preset: DatePreset) => {
      onChange(preset);
      setIsOpen(false);
    },
    [onChange],
  );

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Use a timeout so the current click event finishes before attaching the listener
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#1E3A5F] hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:ring-offset-1"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        {currentLabel}
        <ChevronDown className={`w-4 h-4 ml-1 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg z-50">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${
                value === option.value ? 'text-[#0EA5E9] font-medium' : 'text-[#1E3A5F]'
              }`}
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
