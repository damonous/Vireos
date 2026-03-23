import { Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import type { DateRange as DayPickerRange } from 'react-day-picker';

export type DatePreset = '7d' | '14d' | '30d' | 'this_month' | 'last_month' | 'custom';

export interface CustomDateRange {
  from: Date;
  to: Date;
}

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
  onChange: (preset: DatePreset, customRange?: CustomDateRange) => void;
  customRange?: CustomDateRange;
}

export function DateRangeSelector({ value, onChange, customRange }: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [pendingRange, setPendingRange] = useState<DayPickerRange | undefined>(
    customRange ? { from: customRange.from, to: customRange.to } : undefined,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    value === 'custom' && customRange
      ? `${format(customRange.from, 'MMM d, yyyy')} – ${format(customRange.to, 'MMM d, yyyy')}`
      : PRESET_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select Range';

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setShowCalendar(false);
      }
      return !prev;
    });
  }, []);

  const handleSelect = useCallback(
    (preset: DatePreset) => {
      if (preset === 'custom') {
        setShowCalendar(true);
        setPendingRange(
          customRange ? { from: customRange.from, to: customRange.to } : undefined,
        );
        return;
      }
      onChange(preset);
      setShowCalendar(false);
      setIsOpen(false);
    },
    [onChange, customRange],
  );

  const handleApplyCustomRange = useCallback(() => {
    if (pendingRange?.from && pendingRange?.to) {
      onChange('custom', { from: pendingRange.from, to: pendingRange.to });
      setShowCalendar(false);
      setIsOpen(false);
    }
  }, [pendingRange, onChange]);

  const handleCancelCustomRange = useCallback(() => {
    setShowCalendar(false);
    setPendingRange(customRange ? { from: customRange.from, to: customRange.to } : undefined);
  }, [customRange]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCalendar(false);
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
        setShowCalendar(false);
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
        <CalendarIcon className="w-4 h-4 text-gray-500" />
        {currentLabel}
        <ChevronDown className={`w-4 h-4 ml-1 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 rounded-md border border-gray-200 bg-white shadow-lg z-50">
          <div className={`${showCalendar ? 'flex' : ''}`}>
            <div className="w-48 py-1">
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-gray-100 ${
                    value === option.value && !(option.value === 'custom' && showCalendar)
                      ? 'text-[#0EA5E9] font-medium'
                      : option.value === 'custom' && showCalendar
                        ? 'text-[#0EA5E9] bg-gray-50 font-medium'
                        : 'text-[#1E3A5F]'
                  }`}
                >
                  {option.label}
                  {value === option.value && !showCalendar && (
                    <Check className="w-4 h-4 text-[#0EA5E9]" />
                  )}
                </button>
              ))}
            </div>

            {showCalendar && (
              <div className="border-l border-gray-200 p-3">
                <Calendar
                  mode="range"
                  selected={pendingRange}
                  onSelect={setPendingRange}
                  numberOfMonths={2}
                  disabled={{ after: new Date() }}
                  defaultMonth={
                    pendingRange?.from
                      ? new Date(pendingRange.from.getFullYear(), pendingRange.from.getMonth(), 1)
                      : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
                  }
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {pendingRange?.from && pendingRange?.to
                      ? `${format(pendingRange.from, 'MMM d, yyyy')} – ${format(pendingRange.to, 'MMM d, yyyy')}`
                      : 'Select start and end dates'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelCustomRange}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomRange}
                      disabled={!pendingRange?.from || !pendingRange?.to}
                      className="px-3 py-1.5 text-xs font-medium text-white rounded-md bg-[#0EA5E9] hover:bg-[#0284C7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function getPresetLabel(preset: DatePreset, customRange?: CustomDateRange): string {
  if (preset === 'custom' && customRange) {
    return `${format(customRange.from, 'MMM d')} – ${format(customRange.to, 'MMM d')}`;
  }
  return PRESET_OPTIONS.find((opt) => opt.value === preset)?.label ?? preset;
}
