import { Plus, Edit2, Pause, Trash2, ArrowRight, TrendingUp, DollarSign, Users, Target } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router';

const ads = [
  {
    id: 0,
    name: 'Retirement Planning Free Consultation',
    status: 'pending',
    budget: 150,
    spend: 0,
    impressions: 0,
    leads: 0,
  },
  {
    id: 1,
    name: 'Retirement Planning Free Consultation',
    status: 'active',
    budget: 500,
    spend: 487,
    impressions: 24567,
    leads: 18,
  },
  {
    id: 2,
    name: 'Tax Season Workshop - Spring 2026',
    status: 'active',
    budget: 300,
    spend: 298,
    impressions: 15234,
    leads: 12,
  },
  {
    id: 3,
    name: 'Estate Planning Seminar',
    status: 'paused',
    budget: 200,
    spend: 142,
    impressions: 8912,
    leads: 3,
  },
  {
    id: 4,
    name: 'Social Security Webinar',
    status: 'active',
    budget: 250,
    spend: 320,
    impressions: 18765,
    leads: 5,
  },
];

export default function FacebookAds() {
  const navigate = useNavigate();
  
  const activeAds = ads.filter(ad => ad.status === 'active').length;
  const totalSpend = ads.reduce((sum, ad) => sum + ad.spend, 0);
  const totalLeads = ads.reduce((sum, ad) => sum + ad.leads, 0);
  const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
          Active
        </span>;
      case 'paused':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
          Paused
        </span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
          Pending Review
        </span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Facebook Ads</h1>
            <p className="text-sm text-gray-500 mt-1">Create and track Facebook advertising campaigns</p>
          </div>
          <Button 
            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            onClick={() => navigate('/facebook-wizard')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Ad
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Ads</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{activeAds}</h3>
                <p className="text-sm text-gray-500 mt-2">Currently running</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-[#1877F2]" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Spend</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">${totalSpend.toLocaleString()}</h3>
                <p className="text-sm text-gray-500 mt-2">This month</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Leads Generated</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{totalLeads}</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +12% vs last month
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Cost Per Lead</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">${costPerLead.toFixed(2)}</h3>
                <p className="text-sm text-green-600 mt-2">-8% vs last month</p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Ads Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Active Campaigns</h3>
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
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ads.map((ad) => (
                    <tr key={ad.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-[#1E3A5F]">{ad.name}</p>
                      </td>
                      <td className="py-4 px-4">
                        {getStatusBadge(ad.status)}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {ad.status === 'pending' ? '$5/day' : `$${ad.budget}/mo`}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {ad.status === 'pending' ? '—' : `$${ad.spend}`}
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">
                        {ad.status === 'pending' ? '—' : ad.impressions.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-sm font-medium text-[#1E3A5F]">
                        {ad.status === 'pending' ? '—' : ad.leads}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Pause className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Lead Flow Indicator */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A5F]">Lead Integration Active</h3>
                <Link 
                  to="/leads" 
                  className="flex items-center gap-2 mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <span className="text-2xl font-semibold text-[#0EA5E9]">{totalLeads} leads</span>
                  <ArrowRight className="w-5 h-5 text-[#0EA5E9]" />
                  <span className="text-sm font-medium text-[#0EA5E9] hover:underline">
                    Lead Management
                  </span>
                </Link>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Automated lead sync enabled</p>
              <p className="text-xs text-gray-500 mt-1">Last synced: 5 minutes ago</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}