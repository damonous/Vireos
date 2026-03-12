import { ArrowLeft, Target } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  budget?: number | string | null;
  budgetCurrency?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  targetingJson?: Record<string, unknown> | null;
  impressions?: number;
  clicks?: number;
  leads?: number;
  spend?: number | string;
  createdAt: string;
}

interface CampaignListResponse {
  data: FacebookCampaign[];
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

function renderTargetingEntries(value: Record<string, unknown>, depth = 0): JSX.Element {
  return (
    <div className={depth === 0 ? 'space-y-3' : 'space-y-2'}>
      {Object.entries(value).map(([key, entry]) => {
        if (Array.isArray(entry)) {
          return (
            <div key={`${depth}-${key}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanize(key)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entry.length === 0 ? (
                  <span className="text-sm text-slate-500">None</span>
                ) : entry.map((item, index) => (
                  <span key={`${key}-${index}`} className="rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {typeof item === 'string' ? humanize(item) : String(item)}
                  </span>
                ))}
              </div>
            </div>
          );
        }
        if (entry && typeof entry === 'object') {
          return (
            <div key={`${depth}-${key}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanize(key)}</p>
              <div className="mt-2">{renderTargetingEntries(entry as Record<string, unknown>, depth + 1)}</div>
            </div>
          );
        }
        return (
          <div key={`${depth}-${key}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{humanize(key)}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{typeof entry === 'string' ? humanize(entry) : String(entry ?? 'Not set')}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function FacebookCampaignDetail() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId');
  const campaigns = useApiData<CampaignListResponse>('/facebook/campaigns?page=1&limit=20');
  const campaign = useApiData<FacebookCampaign>(`/facebook/campaigns/${campaignId ?? ''}`, [campaignId], Boolean(campaignId));

  const selectedCampaign = campaignId ? campaign.data : campaigns.data?.[0] ?? null;

  if (campaigns.loading || (campaignId ? campaign.loading : false)) {
    return <LoadingState label="Loading Facebook campaign..." />;
  }

  if (campaigns.error || (campaignId ? campaign.error : null)) {
    return <ErrorState message={campaigns.error || campaign.error || 'Failed to load Facebook campaign.'} onRetry={() => {
      void campaigns.reload();
      if (campaignId) void campaign.reload();
    }} />;
  }

  if (!selectedCampaign) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        <Card className="p-10 rounded-lg shadow-sm border border-gray-200">
          <EmptyState title="No Facebook campaign available" description="Create a campaign draft before opening the detail screen." />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center gap-4">
          <Link to="/facebook" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">{selectedCampaign.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Created {new Date(selectedCampaign.createdAt).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <div className="space-y-6">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Campaign Summary</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Status</p>
                <p className="mt-1 font-semibold text-[#1E3A5F]">{selectedCampaign.status}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Objective</p>
                <p className="mt-1 font-semibold text-[#1E3A5F]">{selectedCampaign.objective}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Budget</p>
                <p className="mt-1 font-semibold text-[#1E3A5F]">{selectedCampaign.budget ?? 0} {selectedCampaign.budgetCurrency ?? 'USD'}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Date Range</p>
                <p className="mt-1 font-semibold text-[#1E3A5F]">
                  {selectedCampaign.startDate ? new Date(selectedCampaign.startDate).toLocaleDateString() : 'TBD'} to {selectedCampaign.endDate ? new Date(selectedCampaign.endDate).toLocaleDateString() : 'TBD'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Performance</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Impressions', selectedCampaign.impressions ?? 0],
                ['Clicks', selectedCampaign.clicks ?? 0],
                ['Leads', selectedCampaign.leads ?? 0],
                ['Spend', selectedCampaign.spend ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1E3A5F]">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-[#0EA5E9]" />
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Targeting</h2>
          </div>
          {selectedCampaign.targetingJson && Object.keys(selectedCampaign.targetingJson).length > 0 ? (
            renderTargetingEntries(selectedCampaign.targetingJson)
          ) : (
            <EmptyState title="No targeting saved" description="Update the campaign if you want to add more detailed audience rules." />
          )}
        </Card>
      </div>
    </div>
  );
}
