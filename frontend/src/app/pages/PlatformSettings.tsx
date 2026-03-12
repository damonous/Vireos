import { Globe, Lock, ServerCog, Settings2, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { PageShell } from '../components/page-shell';
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

interface MetricsPayload {
  startedAt?: number;
  uptimeMs?: number;
  activeConnections?: number;
  errorRate4xx?: number;
  errorRate5xx?: number;
}

interface FeatureFlagRow {
  id: string;
  flag: string;
  isEnabled: boolean;
  updatedAt: string;
}

interface BillingSummary {
  kpis: {
    organizationsTotal: number;
    activeOrgs: number;
    trialingOrgs: number;
    pastDueOrgs: number;
    cancelledOrgs: number;
  };
}

export default function PlatformSettings() {
  const health = useApiData<HealthReady>('/health/ready');
  const metrics = useApiData<MetricsPayload>('/metrics');
  const featureFlags = useApiData<FeatureFlagRow[]>('/feature-flags');
  const billing = useApiData<BillingSummary>('/admin/billing/summary');

  if (health.loading || metrics.loading || featureFlags.loading || billing.loading) {
    return <LoadingState label="Loading platform settings..." />;
  }

  if (health.error || metrics.error || featureFlags.error || billing.error) {
    return (
      <ErrorState
        message={health.error || metrics.error || featureFlags.error || billing.error || 'Failed to load platform settings.'}
        onRetry={() => {
          void health.reload();
          void metrics.reload();
          void featureFlags.reload();
          void billing.reload();
        }}
      />
    );
  }

  const readinessCards = [
    { label: 'API', value: health.data?.status ?? 'unknown' },
    { label: 'Database', value: health.data?.checks?.database?.status ?? 'unknown' },
    { label: 'Redis', value: health.data?.checks?.redis?.status ?? 'unknown' },
    { label: '4xx Rate', value: String(metrics.data?.errorRate4xx ?? 0) },
    { label: '5xx Rate', value: String(metrics.data?.errorRate5xx ?? 0) },
    { label: 'Active Connections', value: String(metrics.data?.activeConnections ?? 0) },
  ];

  const flagRows = featureFlags.data ?? [];
  const enabledFlags = flagRows.filter((flag) => flag.isEnabled);

  return (
    <PageShell
      title="Platform Settings"
      subtitle="Live operational settings and controls visible from the current backend state"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2 text-sky-700">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Frontend Origin</p>
                <p className="text-lg font-semibold text-[#1E3A5F]">{window.location.origin}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">This page now shows the live browser origin instead of a static platform URL.</p>
          </Card>

          <Card className="border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <ServerCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Backend Version</p>
                <p className="text-lg font-semibold text-[#1E3A5F]">{health.data?.version ?? 'unknown'}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              Last ready check {health.data?.timestamp ? new Date(health.data.timestamp).toLocaleString() : 'unavailable'}.
            </p>
          </Card>

          <Card className="border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tenant State</p>
                <p className="text-lg font-semibold text-[#1E3A5F]">{billing.data?.kpis.activeOrgs ?? 0} active orgs</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              {billing.data?.kpis.trialingOrgs ?? 0} trialing, {billing.data?.kpis.pastDueOrgs ?? 0} past due, {billing.data?.kpis.cancelledOrgs ?? 0} cancelled.
            </p>
          </Card>
        </div>

        <Card className="border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Runtime Readiness</h2>
            <p className="mt-1 text-sm text-gray-500">These values are loaded directly from `/health/ready` and `/metrics`.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
            {readinessCards.map((item) => {
              const ok = ['ok', '0'].includes(item.value.toLowerCase());
              return (
                <div key={item.label} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xl font-semibold text-[#1E3A5F]">{item.value}</span>
                    <Badge className={ok ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                      {ok ? 'Healthy' : 'Check'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Card className="border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-[#1E3A5F]">Feature Flags</h2>
              <p className="mt-1 text-sm text-gray-500">All values are read from the feature flag table for the current super-admin scope.</p>
            </div>
            <div className="px-6 py-6">
              {flagRows.length === 0 ? (
                <EmptyState title="No feature flags found" description="Create platform or organization flags to manage rollout behavior." />
              ) : (
                <div className="space-y-3">
                  {flagRows.map((flag) => (
                    <div key={flag.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1E3A5F]">{flag.flag}</p>
                        <p className="mt-1 text-xs text-gray-500">Updated {new Date(flag.updatedAt).toLocaleString()}</p>
                      </div>
                      <Badge className={flag.isEnabled ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}>
                        {flag.isEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1E3A5F]">Credential Policy</h2>
                  <p className="mt-1 text-sm text-gray-500">Secrets are intentionally not exposed back to the frontend.</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-gray-700">
                <li>OAuth app credentials are configured server-side and verified through actual connect flows.</li>
                <li>Stripe, SendGrid, OpenAI, and AWS keys are not rendered here by design.</li>
                <li>Use the provider setup runbook and live connection pages to validate external integrations.</li>
              </ul>
            </Card>

            <Card className="border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-100 p-2 text-indigo-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#1E3A5F]">Current Rollout Snapshot</h2>
                  <p className="mt-1 text-sm text-gray-500">Derived from live platform state, not hardcoded plans or integration cards.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Enabled Flags</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1E3A5F]">{enabledFlags.length}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Total Organizations</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1E3A5F]">{billing.data?.kpis.organizationsTotal ?? 0}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Runtime Controls</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-gray-700">
                    <Zap className="h-4 w-4 text-[#0EA5E9]" />
                    Feature flags and backend environment state are the real control surface.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
