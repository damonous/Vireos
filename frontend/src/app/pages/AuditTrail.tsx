import { useState } from 'react';
import { Download, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface AuditEntry {
  id: number;
  dateTime: string;
  action: 'approved' | 'rejected' | 'requested-edits';
  contentTitle: string;
  advisor: string;
  platform: string;
  notes: string;
  reviewedBy: string;
}

const auditData: AuditEntry[] = [
  {
    id: 1,
    dateTime: 'Feb 27, 1:42 PM',
    action: 'approved',
    contentTitle: 'Understanding 401k Rollovers',
    advisor: 'Sarah Mitchell',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 2,
    dateTime: 'Feb 27, 12:18 PM',
    action: 'rejected',
    contentTitle: 'Guaranteed Returns Post',
    advisor: 'Sarah Mitchell',
    platform: 'LinkedIn',
    notes: 'Contains prohibited term: "guaranteed"',
    reviewedBy: 'R. Torres',
  },
  {
    id: 3,
    dateTime: 'Feb 27, 11:05 AM',
    action: 'approved',
    contentTitle: 'Estate Planning Basics',
    advisor: 'Jennifer Walsh',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 4,
    dateTime: 'Feb 27, 10:30 AM',
    action: 'requested-edits',
    contentTitle: 'Tax Workshop Invitation',
    advisor: 'Michael Chen',
    platform: 'Facebook',
    notes: 'Please remove guarantee language',
    reviewedBy: 'R. Torres',
  },
  {
    id: 5,
    dateTime: 'Feb 27, 9:15 AM',
    action: 'approved',
    contentTitle: 'Retirement Income Guide',
    advisor: 'Lisa Nguyen',
    platform: 'Email',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 6,
    dateTime: 'Feb 26, 4:55 PM',
    action: 'rejected',
    contentTitle: 'Risk-Free Investment Post',
    advisor: 'David Park',
    platform: 'LinkedIn',
    notes: 'Contains prohibited term: "risk-free"',
    reviewedBy: 'R. Torres',
  },
  {
    id: 7,
    dateTime: 'Feb 26, 3:22 PM',
    action: 'approved',
    contentTitle: 'Market Outlook Q1 2026',
    advisor: 'Jennifer Walsh',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 8,
    dateTime: 'Feb 26, 2:10 PM',
    action: 'requested-edits',
    contentTitle: 'Portfolio Diversification Tips',
    advisor: 'Tom Bradley',
    platform: 'Email',
    notes: 'Add required disclaimer',
    reviewedBy: 'R. Torres',
  },
  {
    id: 9,
    dateTime: 'Feb 26, 1:45 PM',
    action: 'approved',
    contentTitle: 'Monthly Newsletter - February',
    advisor: 'Sarah Mitchell',
    platform: 'Email',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 10,
    dateTime: 'Feb 26, 11:30 AM',
    action: 'rejected',
    contentTitle: 'Promise of High Returns',
    advisor: 'Michael Chen',
    platform: 'Facebook',
    notes: 'Contains prohibited term: "promise"',
    reviewedBy: 'R. Torres',
  },
  {
    id: 11,
    dateTime: 'Feb 26, 10:15 AM',
    action: 'approved',
    contentTitle: 'Tax-Loss Harvesting Strategies',
    advisor: 'Lisa Nguyen',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 12,
    dateTime: 'Feb 26, 9:05 AM',
    action: 'approved',
    contentTitle: 'Client Success Story',
    advisor: 'Jennifer Walsh',
    platform: 'Facebook',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 13,
    dateTime: 'Feb 25, 4:40 PM',
    action: 'requested-edits',
    contentTitle: 'Investment Webinar Invitation',
    advisor: 'David Park',
    platform: 'Email',
    notes: 'Clarify risk disclosure',
    reviewedBy: 'R. Torres',
  },
  {
    id: 14,
    dateTime: 'Feb 25, 3:18 PM',
    action: 'approved',
    contentTitle: 'Financial Planning Tips',
    advisor: 'Tom Bradley',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 15,
    dateTime: 'Feb 25, 2:22 PM',
    action: 'rejected',
    contentTitle: 'Certain Returns Campaign',
    advisor: 'Sarah Mitchell',
    platform: 'LinkedIn',
    notes: 'Contains prohibited term: "certain returns"',
    reviewedBy: 'R. Torres',
  },
  {
    id: 16,
    dateTime: 'Feb 25, 1:10 PM',
    action: 'approved',
    contentTitle: 'Compound Interest Explained',
    advisor: 'Michael Chen',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 17,
    dateTime: 'Feb 25, 11:55 AM',
    action: 'approved',
    contentTitle: 'Quarterly Portfolio Review',
    advisor: 'Jennifer Walsh',
    platform: 'Email',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 18,
    dateTime: 'Feb 25, 10:30 AM',
    action: 'requested-edits',
    contentTitle: 'New Client Outreach',
    advisor: 'Lisa Nguyen',
    platform: 'LinkedIn',
    notes: 'Tone down promotional language',
    reviewedBy: 'R. Torres',
  },
  {
    id: 19,
    dateTime: 'Feb 25, 9:15 AM',
    action: 'approved',
    contentTitle: 'Retirement Planning Checklist',
    advisor: 'David Park',
    platform: 'Facebook',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
  {
    id: 20,
    dateTime: 'Feb 25, 8:45 AM',
    action: 'approved',
    contentTitle: 'Market Volatility Insights',
    advisor: 'Tom Bradley',
    platform: 'LinkedIn',
    notes: '—',
    reviewedBy: 'R. Torres',
  },
];

const getActionBadge = (action: string) => {
  switch (action) {
    case 'approved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
          Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
          Rejected
        </span>
      );
    case 'requested-edits':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
          Requested Edits
        </span>
      );
    default:
      return null;
  }
};

export default function AuditTrail() {
  const [actionFilter, setActionFilter] = useState('all');
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = auditData.filter((entry) => {
    if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
    if (advisorFilter !== 'all' && entry.advisor.toLowerCase() !== advisorFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-1">View complete compliance audit history</p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
            <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
              <FileText className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Filter Row */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Actions</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="requested-edits">Requested Edits</option>
          </select>
          <select
            value={advisorFilter}
            onChange={(e) => {
              setAdvisorFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Advisors</option>
            <option value="sarah mitchell">Sarah Mitchell</option>
            <option value="michael chen">Michael Chen</option>
            <option value="jennifer walsh">Jennifer Walsh</option>
            <option value="david park">David Park</option>
            <option value="lisa nguyen">Lisa Nguyen</option>
            <option value="tom bradley">Tom Bradley</option>
          </select>
          <select
            className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            defaultValue="rachel-torres"
          >
            <option value="rachel-torres">Reviewed By: Rachel Torres</option>
          </select>
        </div>

        {/* Audit Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Advisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reviewed By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentData.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {entry.dateTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(entry.action)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {entry.contentTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {entry.advisor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {entry.platform}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {entry.notes}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {entry.reviewedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredData.length)} of {filteredData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
