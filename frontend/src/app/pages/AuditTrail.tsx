import { Download } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function summarizeMetadata(metadata?: Record<string, unknown> | null): Array<{ key: string; value: string }> {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata)
    .slice(0, 4)
    .map(([key, value]) => ({
      key: humanize(key),
      value: Array.isArray(value)
        ? value.map((item) => String(item)).join(', ')
        : value && typeof value === 'object'
          ? Object.entries(value as Record<string, unknown>)
              .slice(0, 2)
              .map(([nestedKey, nestedValue]) => `${humanize(nestedKey)}: ${String(nestedValue)}`)
              .join(', ')
          : String(value),
    }))
    .filter((entry) => entry.value && entry.value !== 'undefined');
}

export default function AuditTrail() {
  const audit = useApiData<AuditEntry[]>('/audit-trail?page=1&limit=100');
  const exportAudit = () => {
    const blob = new Blob([JSON.stringify(audit.data ?? [], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vireos-audit-trail.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (audit.loading) {
    return <LoadingState label="Loading audit trail..." />;
  }

  if (audit.error) {
    return <ErrorState message={audit.error} onRetry={() => void audit.reload()} />;
  }

  const rows = audit.data ?? [];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-1">Live organization audit events</p>
          </div>
          <Button className="bg-[#1E3A5F] hover:bg-[#2B4A6F] text-white" onClick={exportAudit}>
            <Download className="w-4 h-4 mr-2" />
            Export Audit
          </Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No audit events yet" description="Logins, reviews, and state changes will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">{humanize(row.action)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{row.entityType}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {summarizeMetadata(row.metadata).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {summarizeMetadata(row.metadata).map((entry) => (
                              <span key={`${row.id}-${entry.key}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                                <span className="font-semibold">{entry.key}:</span> {entry.value}
                              </span>
                            ))}
                          </div>
                        ) : (
                          row.entityId
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
