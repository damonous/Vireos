import { CheckCircle2, Database, RefreshCw, ServerCog } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface HealthReady {
  status: string;
  timestamp: string;
  version: string;
  checks?: {
    database?: { status: string };
    redis?: { status: string };
  };
}

interface BillingSummary {
  kpis: {
    organizationsTotal: number;
    trialingOrgs: number;
    activeOrgs: number;
    pastDueOrgs: number;
    cancelledOrgs: number;
    totalCreditBalance: number;
  };
  subscriptions: Array<{
    id: string;
    planName: string;
    status: string;
    organization: {
      name: string;
      slug: string;
    };
  }>;
}

export default function SystemHealth() {
  const health = useApiData<HealthReady>('/health/ready');
  const billing = useApiData<BillingSummary>('/admin/billing/summary');

  if (health.loading || billing.loading) {
    return <LoadingState label="Loading system health..." />;
  }

  if (health.error || billing.error) {
    return <ErrorState message={health.error || billing.error || 'Failed to load health data.'} onRetry={() => {
      void health.reload();
      void billing.reload();
    }} />;
  }

  const checks = [
    { label: 'API Application', value: health.data?.status ?? 'unknown', icon: ServerCog },
    { label: 'Database', value: health.data?.checks?.database?.status ?? 'unknown', icon: Database },
    { label: 'Redis', value: health.data?.checks?.redis?.status ?? 'unknown', icon: RefreshCw },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50" onClick={() => {
            void health.reload();
            void billing.reload();
          }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {checks.map((check) => {
            const Icon = check.icon;
            const ok = check.value === 'ok';
            return (
              <Card key={check.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-base font-semibold text-[#1E3A5F]">{check.label}</h3>
                  <Icon className={`w-5 h-5 ${ok ? 'text-green-600' : 'text-amber-600'}`} />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-sm font-medium text-[#1E3A5F]">
                  <CheckCircle2 className={`w-4 h-4 ${ok ? 'text-green-600' : 'text-amber-600'}`} />
                  {check.value}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Platform Billing Snapshot</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              ['Organizations', billing.data?.kpis.organizationsTotal ?? 0],
              ['Trialing', billing.data?.kpis.trialingOrgs ?? 0],
              ['Active', billing.data?.kpis.activeOrgs ?? 0],
              ['Past Due', billing.data?.kpis.pastDueOrgs ?? 0],
              ['Cancelled', billing.data?.kpis.cancelledOrgs ?? 0],
              ['Credits', billing.data?.kpis.totalCreditBalance ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-[#1E3A5F]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500">Last ready check at {health.data?.timestamp ? new Date(health.data.timestamp).toLocaleString() : 'unknown'}.</p>
        </Card>
      </div>
    </div>
  );
}
