import { Calendar, ChevronDown, Check } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export type DatePreset = '7d' | '30d' | 'this_month' | 'last_month';

interface PresetOption {
  value: DatePreset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

interface DateRangeSelectorProps {
  value: DatePreset;
  onChange: (preset: DatePreset) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const currentLabel = PRESET_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select Range';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          {currentLabel}
          <ChevronDown className="w-4 h-4 ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {PRESET_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            {option.label}
            {value === option.value && <Check className="w-4 h-4 text-[#0EA5E9]" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function getPresetLabel(preset: DatePreset): string {
  return PRESET_OPTIONS.find((opt) => opt.value === preset)?.label ?? preset;
}
