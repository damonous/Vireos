import { DollarSign, Plus, Target, TrendingUp, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  budget?: number | string | null;
  spend?: number | string | null;
  impressions: number;
  clicks: number;
  leads: number;
}

interface FacebookCampaignList {
  data: FacebookCampaign[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

function toNumber(value: number | string | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export default function FacebookAds() {
  const navigate = useNavigate();
  const campaigns = useApiData<FacebookCampaignList>('/facebook/campaigns');

  if (campaigns.loading) {
    return <LoadingState label="Loading Facebook ads..." />;
  }

  if (campaigns.error) {
    return <ErrorState message={campaigns.error} onRetry={() => void campaigns.reload()} />;
  }

  const adRows = campaigns.data ?? [];
  const activeAds = adRows.filter((ad) => ad.status.toLowerCase() === 'active').length;
  const totalSpend = adRows.reduce((sum, ad) => sum + toNumber(ad.spend), 0);
  const totalLeads = adRows.reduce((sum, ad) => sum + ad.leads, 0);
  const totalImpressions = adRows.reduce((sum, ad) => sum + ad.impressions, 0);
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'active') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Active</span>;
    }
    if (normalized === 'paused') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">Paused</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{status}</span>;
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-end">
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => navigate('/facebook-wizard')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Ad
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Active Ads', value: activeAds, hint: 'Currently running', icon: Target, color: 'bg-blue-50 text-[#1877F2]' },
            { label: 'Total Spend', value: `$${totalSpend.toFixed(2)}`, hint: 'Across all campaigns', icon: DollarSign, color: 'bg-green-50 text-green-600' },
            { label: 'Leads Generated', value: totalLeads, hint: `${totalImpressions.toLocaleString()} impressions`, icon: Users, color: 'bg-purple-50 text-purple-600' },
            { label: 'Cost Per Lead', value: `$${costPerLead.toFixed(2)}`, hint: 'Current snapshot', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                    <h3 className="text-3xl font-semibold text-[#1E3A5F]">{item.value}</h3>
                    <p className="text-sm text-gray-500 mt-2">{item.hint}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${item.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Campaigns</h3>
            {adRows.length === 0 ? (
              <EmptyState title="No Facebook campaigns yet" description="Launch a campaign from the wizard to populate this view with live ad data." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ad Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Budget</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Spend</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Impressions</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adRows.map((ad) => (
                      <tr key={ad.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 text-sm font-medium text-[#1E3A5F]">{ad.name}</td>
                        <td className="py-4 px-4">{getStatusBadge(ad.status)}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">${toNumber(ad.budget).toFixed(2)}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">${toNumber(ad.spend).toFixed(2)}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">{ad.impressions.toLocaleString()}</td>
                        <td className="py-4 px-4 text-sm font-medium text-[#1E3A5F]">{ad.leads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A5F]">Lead Integration Active</h3>
                <Link to="/leads" className="flex items-center gap-2 mt-1 cursor-pointer hover:opacity-80 transition-opacity">
                  <span className="text-2xl font-semibold text-[#0EA5E9]">{totalLeads} leads</span>
                  <span className="text-sm font-medium text-[#0EA5E9] hover:underline">Lead Management</span>
                </Link>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Automated lead sync enabled</p>
              <p className="text-xs text-gray-500 mt-1">Reflects the current campaign dataset</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
