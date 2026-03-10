import { Clock, CheckCircle, XCircle, TrendingDown, Linkedin, Facebook, Mail, FileText, AlertCircle, Download } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { Toast } from '../components/ui/toast';

const kpiData = [
  { label: 'Pending Review', value: '8', icon: Clock, color: 'bg-orange-500', badge: 'URGENT' },
  { label: 'Approved Today', value: '12', icon: CheckCircle, color: 'bg-green-500' },
  { label: 'Rejected This Week', value: '3', icon: XCircle, color: 'bg-red-500' },
  { label: 'Avg Review Time', value: '4.2 hrs', icon: TrendingDown, color: 'bg-blue-500' },
];

const priorityQueue = [
  {
    title: 'Q1 Market Outlook - Contains "guaranteed returns"',
    advisor: 'Sarah Mitchell',
    platform: 'linkedin',
    submitted: '2 hours ago',
    urgency: 'urgent',
  },
  {
    title: 'Tax Workshop Invitation',
    advisor: 'Michael Chen',
    platform: 'facebook',
    submitted: '3 hours ago',
    urgency: 'urgent',
  },
  {
    title: 'Estate Planning Video Script',
    advisor: 'Jennifer Walsh',
    platform: 'linkedin',
    submitted: '4 hours ago',
    urgency: 'normal',
  },
  {
    title: 'LinkedIn Connection Message',
    advisor: 'David Park',
    platform: 'linkedin',
    submitted: '5 hours ago',
    urgency: 'normal',
  },
  {
    title: 'Monthly Newsletter Draft',
    advisor: 'Lisa Nguyen',
    platform: 'email',
    submitted: '6 hours ago',
    urgency: 'normal',
  },
];

const auditTrail = [
  { action: 'Approved: Understanding 401k Rollovers', user: 'R. Torres', time: '10 min ago' },
  { action: 'Rejected: Guaranteed Returns Post', user: 'R. Torres', time: '1 hr ago' },
  { action: 'Approved: Estate Planning Basics', user: 'R. Torres', time: '2 hrs ago' },
  { action: 'Approved: Tax-Loss Harvesting Guide', user: 'R. Torres', time: '3 hrs ago' },
  { action: 'Rejected: Risk-Free Investment Claim', user: 'R. Torres', time: '4 hrs ago' },
  { action: 'Approved: Monthly Market Update', user: 'R. Torres', time: '5 hrs ago' },
  { action: 'Approved: Retirement Planning Checklist', user: 'R. Torres', time: '6 hrs ago' },
  { action: 'Flagged: Performance Promise Language', user: 'R. Torres', time: '7 hrs ago' },
];

const prohibitedTerms = [
  { term: 'guaranteed', count: 23 },
  { term: 'promise', count: 8 },
  { term: 'risk-free', count: 6 },
  { term: 'will double', count: 4 },
  { term: 'no risk', count: 3 },
];

const platformIcons = {
  linkedin: Linkedin,
  facebook: Facebook,
  email: Mail,
};

export default function ComplianceOfficerHome() {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowToast(true);
    }, 800);
  };
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Review and monitor content compliance</p>
          </div>
          <Button className="bg-[#1E3A5F] hover:bg-[#2B4A6F] text-white" onClick={handleExport} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export PDF Report'}
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content - 65% */}
          <div className="flex-1">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {kpiData.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-600">{kpi.label}</p>
                          {kpi.badge && (
                            <Badge className="bg-orange-100 text-orange-800 text-xs hover:bg-orange-100">
                              {kpi.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-3xl font-semibold text-[#1E3A5F]">{kpi.value}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Priority Queue */}
            <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-[#1E3A5F]">Requires Immediate Review</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {priorityQueue.map((item, index) => {
                  const PlatformIcon = platformIcons[item.platform as keyof typeof platformIcons];
                  return (
                    <div key={index} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="mt-1.5">
                            {item.urgency === 'urgent' ? (
                              <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-[#1E3A5F]">{item.title}</h3>
                              {item.urgency === 'urgent' && (
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span>{item.advisor}</span>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <PlatformIcon className="w-4 h-4" />
                                <span className="capitalize">{item.platform}</span>
                              </div>
                              <span>•</span>
                              <span>{item.submitted}</span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => navigate('/compliance-officer/review')}
                          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm"
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Prohibited Terms */}
            <Card className="rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-[#1E3A5F]">Prohibited Terms Flagged This Month</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-3">
                  {prohibitedTerms.map((term) => (
                    <Badge
                      key={term.term}
                      className="bg-red-100 text-red-800 text-sm px-3 py-1.5 hover:bg-red-100"
                    >
                      "{term.term}" ({term.count}x)
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Audit Trail - 35% */}
          <div className="w-[400px]">
            <Card className="rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Recent Actions</h2>
              <div className="space-y-4">
                {auditTrail.map((activity, index) => (
                  <div key={index} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-[#1E3A5F] mb-1">{activity.action}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">{activity.user}</p>
                      <p className="text-xs text-gray-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          type="info"
          message="Export ready — downloading..."
          onClose={() => setShowToast(false)}
          duration={3000}
        />
      )}
    </div>
  );
}