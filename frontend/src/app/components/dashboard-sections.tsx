import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { EmptyState } from './ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-[#1E3A5F]">{value}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-100">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold text-[#1E3A5F]">{title}</CardTitle>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const normalized = (value ?? 'unknown').toLowerCase();
  const tone = normalized.includes('active') || normalized.includes('approved') || normalized.includes('ok')
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : normalized.includes('pending') || normalized.includes('review') || normalized.includes('draft')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : normalized.includes('rejected') || normalized.includes('failed') || normalized.includes('inactive') || normalized.includes('cancel')
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  return <Badge variant="outline" className={tone}>{humanizeEnum(value ?? 'unknown')}</Badge>;
}

export function TrendList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: Array<{ label: string; value: string; progress?: number; tone?: 'default' | 'success' | 'warning' }>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const progress = Math.max(0, Math.min(100, item.progress ?? 0));
        const barTone =
          item.tone === 'success'
            ? 'bg-emerald-500'
            : item.tone === 'warning'
              ? 'bg-amber-500'
              : 'bg-sky-500';

        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <span className="text-sm text-slate-500">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${barTone}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DataTable({
  columns,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  columns: Array<{ key: string; label: string; className?: string }>;
  rows: Array<Record<string, ReactNode>>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50 hover:bg-slate-50">
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={String(row.id ?? index)}>
            {columns.map((column) => (
              <TableCell key={`${String(row.id ?? index)}-${column.key}`} className={column.className}>
                {row[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function InsightCallout({
  tone,
  title,
  description,
}: {
  tone: 'good' | 'warn' | 'neutral';
  title: string;
  description: string;
}) {
  const config = {
    good: {
      icon: CheckCircle2,
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    warn: {
      icon: AlertCircle,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    neutral: {
      icon: Clock3,
      className: 'border-sky-200 bg-sky-50 text-sky-800',
    },
  }[tone];

  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${config.className}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-90">{description}</p>
      </div>
    </div>
  );
}

export function StatDelta({
  current,
  target,
  suffix = '',
}: {
  current: number;
  target: number;
  suffix?: string;
}) {
  if (target === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Minus className="h-3 w-3" />No benchmark</span>;
  }

  const delta = current - target;
  const positive = delta >= 0;

  return (
    <span className={`text-xs ${positive ? 'text-emerald-600' : 'text-amber-600'}`}>
      {positive ? '+' : ''}
      {formatNumber(delta)}
      {suffix}
    </span>
  );
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function formatPercent(value: number | null | undefined): string {
  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value ?? 0)}%`;
}

export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'n/a';
  }

  return new Date(value).toLocaleDateString();
}

export function humanizeEnum(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
