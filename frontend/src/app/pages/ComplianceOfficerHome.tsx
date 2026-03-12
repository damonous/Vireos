import { Clock, CheckCircle, XCircle, TrendingDown, Linkedin, Facebook, Mail, AlertCircle, Download } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { Toast } from '../components/ui/toast';
import { apiClient } from '../lib/api-client';

interface ReviewItem {
  id: string;
  title?: string | null;
  status: string;
  submittedAt?: string | null;
  creator?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  channels?: string[] | null;
}

interface AuditItem {
  id: string;
  action?: string | null;
  entityType?: string | null;
  createdAt?: string | null;
}

const platformIcons = {
  linkedin: Linkedin,
  facebook: Facebook,
  email: Mail,
};

export default function ComplianceOfficerHome() {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [queueData, auditData] = await Promise.all([
        apiClient.get<ReviewItem[]>('/reviews?page=1&limit=20'),
        apiClient.get<AuditItem[]>('/audit-trail?page=1&limit=20'),
      ]);
      setQueue(queueData);
      setAuditTrail(auditData);
    };

    void load();
  }, []);

  const counts = useMemo(() => {
    const approved = queue.filter((item) => item.status === 'APPROVED').length;
    const rejected = queue.filter((item) => item.status === 'REJECTED').length;
    const pending = queue.filter((item) => item.status !== 'APPROVED' && item.status !== 'REJECTED').length;
    return { approved, rejected, pending };
  }, [queue]);

  const averageOpenAgeHours = useMemo(() => {
    const pendingItems = queue.filter((item) => item.status !== 'APPROVED' && item.status !== 'REJECTED');
    if (pendingItems.length === 0) {
      return 0;
    }

    const totalHours = pendingItems.reduce((sum, item) => {
      const submittedAt = item.submittedAt ? new Date(item.submittedAt).getTime() : new Date(item.createdAt ?? Date.now()).getTime();
      return sum + Math.max(0, (Date.now() - submittedAt) / 3600000);
    }, 0);

    return Math.round(totalHours / pendingItems.length);
  }, [queue]);

  const kpiData = [
    { label: 'Pending Review', value: String(counts.pending), icon: Clock, color: 'bg-orange-500', badge: counts.pending > 0 ? 'LIVE' : undefined },
    { label: 'Approved Today', value: String(counts.approved), icon: CheckCircle, color: 'bg-green-500' },
    { label: 'Rejected This Week', value: String(counts.rejected), icon: XCircle, color: 'bg-red-500' },
    { label: 'Avg Open Queue Age', value: `${averageOpenAgeHours} hrs`, icon: TrendingDown, color: 'bg-blue-500' },
  ];

  const priorityQueue = useMemo(() => {
    return queue.slice(0, 5).map((item, index) => ({
      title: item.title || `Draft ${index + 1}`,
      advisor: `${item.creator?.firstName ?? ''} ${item.creator?.lastName ?? ''}`.trim() || item.creator?.email || 'Unknown advisor',
      platform: (item.channels?.[0] ?? 'linkedin').toLowerCase(),
      submitted: item.submittedAt ? new Date(item.submittedAt).toLocaleString() : 'Waiting for submission',
      urgency: item.status === 'SUBMITTED' ? 'urgent' : 'normal',
    }));
  }, [queue]);

  const flaggedTerms = useMemo(() => {
    const countsByStatus = queue.reduce<Record<string, number>>((acc, item) => {
      const key = item.status.toLowerCase().replace(/_/g, ' ');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(countsByStatus).map(([term, count]) => ({ term, count }));
  }, [queue]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ queue, auditTrail }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'compliance-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowToast(true);
    }, 400);
  };
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Review and monitor content compliance</p>
          </div>
          <Button className="bg-[#1E3A5F] hover:bg-[#2B4A6F] text-white" onClick={handleExport} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {kpiData.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm text-gray-600">{kpi.label}</p>
                          {kpi.badge ? <Badge className="bg-orange-100 text-orange-800 text-xs hover:bg-orange-100">{kpi.badge}</Badge> : null}
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

            <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-[#1E3A5F]">Requires Immediate Review</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {priorityQueue.length === 0 ? (
                  <div className="px-6 py-8 text-sm text-gray-500">No items currently in the live review queue.</div>
                ) : priorityQueue.map((item, index) => {
                  const PlatformIcon = platformIcons[item.platform as keyof typeof platformIcons] ?? Linkedin;
                  return (
                    <div key={`${item.title}-${index}`} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="mt-1.5">
                            <div className={`w-2 h-2 rounded-full ${item.urgency === 'urgent' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-[#1E3A5F]">{item.title}</h3>
                              {item.urgency === 'urgent' ? <AlertCircle className="w-4 h-4 text-red-500" /> : null}
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
                        <Button onClick={() => navigate('/compliance-officer/review')} className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-sm">
                          Review
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-[#1E3A5F]">Queue Status Breakdown</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-3">
                  {flaggedTerms.length === 0 ? (
                    <p className="text-sm text-gray-500">No queue statuses to summarize yet.</p>
                  ) : flaggedTerms.map((term) => (
                    <Badge key={term.term} className="bg-red-100 text-red-800 text-sm px-3 py-1.5 hover:bg-red-100">
                      {term.term} ({term.count}x)
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="w-[400px]">
            <Card className="rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Recent Actions</h2>
              <div className="space-y-4">
                {auditTrail.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent audit actions.</p>
                ) : auditTrail.slice(0, 8).map((activity) => (
                  <div key={activity.id} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-[#1E3A5F] mb-1">
                      {(activity.action ?? 'Audit event').replace(/_/g, ' ')} {activity.entityType ? `· ${activity.entityType}` : ''}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">{activity.id}</p>
                      <p className="text-xs text-gray-400">{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'n/a'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

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
