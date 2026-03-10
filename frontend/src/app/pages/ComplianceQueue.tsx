import { useState } from 'react';
import { Bell, CheckCircle2, XCircle, Clock, Linkedin, Facebook, Mail, Info, X, CheckCircle, AlertTriangle, MessageSquare, AlertCircle, Edit3, Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';

interface ComplianceItem {
  id: number;
  title: string;
  advisor: string;
  platform: 'linkedin' | 'facebook' | 'email';
  submitted: string;
  status: 'pending' | 'approved' | 'rejected';
  scheduledDate?: string;
  publishedDate?: string;
  publishStatus?: 'scheduled' | 'published';
  recipients?: number;
  rejectionNotes?: string;
  rejectedBy?: string;
  rejectedDate?: string;
  flaggedTerms?: string[];
  content?: string;
}

const complianceItems: ComplianceItem[] = [
  { id: 1, title: 'Market Update Q1 2026', advisor: 'Sarah Mitchell', platform: 'linkedin', submitted: '2 hours ago', status: 'pending' },
  { id: 2, title: 'Tax Planning Strategies', advisor: 'Michael Chen', platform: 'facebook', submitted: '5 hours ago', status: 'pending' },
  { 
    id: 3, 
    title: 'Retirement Planning Webinar Invite', 
    advisor: 'Sarah Mitchell', 
    platform: 'email', 
    submitted: '1 day ago', 
    status: 'approved',
    scheduledDate: 'Mar 8, 2026 at 10:00 AM',
    publishStatus: 'scheduled'
  },
  { id: 4, title: 'Investment Performance Review', advisor: 'Jennifer Walsh', platform: 'linkedin', submitted: '1 day ago', status: 'pending' },
  { 
    id: 5, 
    title: 'Estate Planning Basics', 
    advisor: 'Michael Chen', 
    platform: 'linkedin', 
    submitted: '2 days ago', 
    status: 'approved',
    scheduledDate: 'Mar 9, 2026 at 9:00 AM',
    publishStatus: 'scheduled'
  },
  { 
    id: 6, 
    title: 'Social Security Benefits Guide', 
    advisor: 'Sarah Mitchell', 
    platform: 'facebook', 
    submitted: '2 days ago', 
    status: 'rejected',
    rejectionNotes: 'This content contains language that could be interpreted as guaranteeing investment returns, which violates FINRA Rule 2210. Specifically, the phrases "guaranteed benefits" and "risk-free income" must be removed or replaced with compliant alternatives. Additionally, the content needs a standard risk disclosure statement.',
    rejectedBy: 'David Roberts, Compliance Officer',
    rejectedDate: 'Mar 4, 2026 at 3:15 PM',
    flaggedTerms: ['guaranteed', 'risk-free'],
    content: `Understanding your Social Security benefits is crucial for retirement planning. Many retirees rely on Social Security as a guaranteed source of income during retirement.

Here are key strategies to maximize your benefits:
• Delay claiming until age 70 for maximum monthly payments
• Coordinate spousal benefits for optimal household income
• Consider the impact on your overall risk-free retirement income strategy

Social Security provides a foundation, but it shouldn't be your only source of retirement income. Contact us to discuss how we can help you build a comprehensive plan.`
  },
  { 
    id: 7, 
    title: 'Portfolio Diversification Tips', 
    advisor: 'Jennifer Walsh', 
    platform: 'email', 
    submitted: '3 days ago', 
    status: 'approved',
    publishedDate: 'Mar 4, 2026 at 2:00 PM',
    publishStatus: 'published',
    recipients: 847
  },
];

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200' },
};

const platformIcons = {
  linkedin: Linkedin,
  facebook: Facebook,
  email: Mail,
};

export default function ComplianceQueue() {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [approvedSubFilter, setApprovedSubFilter] = useState<'all' | 'scheduled' | 'published'>('all');
  const [selectedItem, setSelectedItem] = useState(complianceItems[0]);
  const [items, setItems] = useState(complianceItems);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  const filteredItems = selectedFilter === 'all' 
    ? items 
    : items.filter(item => item.status === selectedFilter);

  // Apply approved sub-filter
  const finalFilteredItems = selectedFilter === 'approved' && approvedSubFilter !== 'all'
    ? filteredItems.filter(item => item.publishStatus === approvedSubFilter)
    : filteredItems;

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
    scheduled: items.filter(i => i.status === 'approved' && i.publishStatus === 'scheduled').length,
    published: items.filter(i => i.status === 'approved' && i.publishStatus === 'published').length,
  };

  const handleApprove = () => {
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, status: 'approved' } : item
    ));
    setSelectedItem({ ...selectedItem, status: 'approved' });
  };

  const handleReject = () => {
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, status: 'rejected' } : item
    ));
    setSelectedItem({ ...selectedItem, status: 'rejected' });
  };

  const handleRequestChanges = () => {
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, status: 'pending' } : item
    ));
    setSelectedItem({ ...selectedItem, status: 'pending' });
  };

  const handleEditContent = () => {
    setIsEditing(true);
    setEditedContent(selectedItem.content || '');
  };

  const handleResubmit = () => {
    setItems(items.map(item => 
      item.id === selectedItem.id ? { ...item, status: 'pending', content: editedContent } : item
    ));
    setSelectedItem({ ...selectedItem, status: 'pending', content: editedContent });
    setIsEditing(false);
  };

  // Helper function to highlight flagged terms
  const highlightFlaggedTerms = (text: string, terms: string[]) => {
    if (!terms || terms.length === 0) return text;
    
    let highlightedText = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-red-200 text-red-900">$1</mark>');
    });
    
    return highlightedText;
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve marketing content</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Pinnacle Financial</span>
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Info Banner */}
        {showInfoBanner && (
          <div className="bg-[#E0F2FE] border border-[#0EA5E9]/30 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-[#0EA5E9] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#1E3A5F] flex-1">
              Approved content is automatically published at the scheduled time. No further action is required from you.
            </p>
            <button
              onClick={() => setShowInfoBanner(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setSelectedFilter('pending')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'pending'
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setSelectedFilter('approved')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'approved'
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Approved ({counts.approved})
          </button>
          <button
            onClick={() => setSelectedFilter('rejected')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'rejected'
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Rejected ({counts.rejected})
          </button>
        </div>

        {/* Approved Sub-Filter */}
        {selectedFilter === 'approved' && (
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setApprovedSubFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                approvedSubFilter === 'all'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              All ({counts.approved})
            </button>
            <button
              onClick={() => setApprovedSubFilter('scheduled')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                approvedSubFilter === 'scheduled'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Scheduled ({counts.scheduled})
            </button>
            <button
              onClick={() => setApprovedSubFilter('published')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                approvedSubFilter === 'published'
                  ? 'bg-[#0EA5E9] text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Published ({counts.published})
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Data Table */}
          <Card className="lg:col-span-2 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Content Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Advisor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Platform
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Submitted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {finalFilteredItems.map((item) => {
                    const Icon = platformIcons[item.platform as keyof typeof platformIcons];
                    const statusStyle = statusConfig[item.status as keyof typeof statusConfig];
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setIsEditing(false);
                        }}
                        className={`cursor-pointer transition-colors ${
                          selectedItem?.id === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[#1E3A5F]">{item.title}</div>
                            {item.status === 'rejected' && (
                              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-700">{item.advisor}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{item.submitted}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            {item.status === 'approved' ? (
                              <>
                                {item.publishStatus === 'published' ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <Badge className="bg-green-600/90 text-white border-green-700">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Published
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Published {item.publishedDate}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <Badge className="bg-green-100 text-green-800 border-green-200 border">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Approved — Scheduled
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Publishing {item.scheduledDate}
                                    </p>
                                  </>
                                )}
                              </>
                            ) : item.status === 'rejected' ? (
                              <Badge className={`${statusStyle.color} border`}>
                                {statusStyle.label} — Action Required
                              </Badge>
                            ) : (
                              <Badge className={`${statusStyle.color} border`}>
                                {statusStyle.label}
                              </Badge>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detail Panel */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200 max-h-[calc(100vh-240px)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Content Details</h3>
            
            {selectedItem && (
              <div className="space-y-6">
                {/* Title and Status */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-[#1E3A5F]">{selectedItem.title}</h4>
                  </div>
                  <Badge className={`${statusConfig[selectedItem.status as keyof typeof statusConfig].color} border`}>
                    {statusConfig[selectedItem.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>

                {/* Metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Advisor:</span>
                    <span className="text-[#1E3A5F] font-medium">{selectedItem.advisor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform:</span>
                    <span className="text-[#1E3A5F] font-medium capitalize">{selectedItem.platform}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Submitted:</span>
                    <span className="text-[#1E3A5F] font-medium">{selectedItem.submitted}</span>
                  </div>
                </div>

                {/* Rejection Notice for Rejected Items */}
                {selectedItem.status === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 mb-1">
                        Rejected by Compliance
                      </h4>
                      <p className="text-xs text-red-700">
                        Reviewed by {selectedItem.rejectedBy} — {selectedItem.rejectedDate}
                      </p>
                    </div>
                  </div>
                )}

                {/* Rejection Notes for Rejected Items */}
                {selectedItem.status === 'rejected' && selectedItem.rejectionNotes && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <label className="block text-sm font-medium text-gray-600">Rejection Notes</label>
                    </div>
                    <div className="bg-red-50/50 border border-red-200 rounded-lg p-3 text-sm text-red-900">
                      {selectedItem.rejectionNotes}
                    </div>
                  </div>
                )}

                {/* Flagged Terms for Rejected Items */}
                {selectedItem.status === 'rejected' && selectedItem.flaggedTerms && selectedItem.flaggedTerms.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-gray-600" />
                      <label className="block text-sm font-medium text-gray-600">Flagged Terms</label>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedItem.flaggedTerms.map((term, index) => (
                        <Badge key={index} className="bg-red-100 text-red-800 border-red-300 border">
                          {term}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      These terms were flagged as potentially non-compliant per FINRA Rule 2210
                    </p>
                  </div>
                )}

                {/* Content Preview */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    {selectedItem.status === 'rejected' && !isEditing ? 'Content Preview (with flagged terms highlighted)' : 'Content Preview'}
                  </label>
                  {!isEditing ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-[#1E3A5F] min-h-[200px]">
                      {selectedItem.status === 'rejected' && selectedItem.content ? (
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: highlightFlaggedTerms(selectedItem.content, selectedItem.flaggedTerms || []).replace(/\n/g, '<br />') 
                          }} 
                        />
                      ) : (
                        <>
                          <p className="mb-4">
                            🎯 As we navigate the evolving financial landscape of 2026, it's crucial to stay informed about the latest developments that could impact your retirement planning.
                          </p>
                          <p className="mb-4">
                            Recent market shifts present both challenges and opportunities. Here's what you need to know:
                          </p>
                          <p>
                            • Tax-advantaged account contribution limits have increased
                            <br />
                            • Portfolio rebalancing strategies to consider
                            <br />
                            • The importance of staying diversified
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Formatting Toolbar */}
                      <div className="flex items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                          <Bold className="w-4 h-4 text-gray-700" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                          <Italic className="w-4 h-4 text-gray-700" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                          <UnderlineIcon className="w-4 h-4 text-gray-700" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors">
                          <LinkIcon className="w-4 h-4 text-gray-700" />
                        </button>
                      </div>
                      
                      {/* Editable Textarea */}
                      <Textarea
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="min-h-[300px] border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                      />
                      
                      {/* Character Count and Compliance Check */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{editedContent.length} characters</span>
                        <button className="text-[#0EA5E9] hover:text-[#0284C7] font-medium">
                          Run Compliance Check
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Edit Content Button for Rejected Items (Not Editing) */}
                {selectedItem.status === 'rejected' && !isEditing && (
                  <Button 
                    variant="outline" 
                    className="w-full border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#0EA5E9]/5"
                    onClick={handleEditContent}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit Content
                  </Button>
                )}

                {/* Resubmit Actions for Rejected Items (Editing) */}
                {selectedItem.status === 'rejected' && isEditing && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      Resubmitting will send this content back to your compliance officer for re-review.
                    </p>
                    <div className="flex gap-3">
                      <Button 
                        className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                        onClick={handleResubmit}
                      >
                        Resubmit for Review
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                        onClick={() => setIsEditing(false)}
                      >
                        Save Draft
                      </Button>
                    </div>
                  </div>
                )}

                {/* Distribution Status for Approved Items */}
                {selectedItem.status === 'approved' && selectedItem.publishStatus === 'scheduled' && (
                  <div className="space-y-3">
                    {/* Approval Callout */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-green-900 mb-1">
                          Approved & Scheduled for Distribution
                        </h4>
                        <p className="text-sm text-green-800">
                          This content has been approved by compliance and is scheduled to be automatically distributed.
                        </p>
                      </div>
                    </div>

                    {/* Distribution Details Card */}
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Platform:</span>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const Icon = platformIcons[selectedItem.platform];
                            return <Icon className="w-4 h-4 text-gray-600" />;
                          })()}
                          <span className="text-sm font-medium text-[#1E3A5F] capitalize">{selectedItem.platform}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Scheduled:</span>
                        <span className="text-sm font-medium text-[#1E3A5F]">{selectedItem.scheduledDate} EST</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-sm font-medium text-green-700">Queued for auto-publish</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Will be posted to {selectedItem.platform} automatically
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button className="text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium">
                        Reschedule
                      </button>
                      <button className="text-sm text-gray-600 hover:text-gray-800 font-medium">
                        Cancel Distribution
                      </button>
                    </div>
                  </div>
                )}

                {/* Distribution Status for Published Items */}
                {selectedItem.status === 'approved' && selectedItem.publishStatus === 'published' && (
                  <div className="space-y-3">
                    {/* Published Callout */}
                    <div className="bg-green-50/70 border border-green-200/70 rounded-lg p-4 flex gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-green-900 mb-1">
                          Published Successfully
                        </h4>
                        <p className="text-sm text-green-800">
                          This content was approved and automatically distributed.
                        </p>
                      </div>
                    </div>

                    {/* Distribution Details Card */}
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Platform:</span>
                        <div className="flex items-center gap-1.5">
                          {(() => {
                            const Icon = platformIcons[selectedItem.platform];
                            return <Icon className="w-4 h-4 text-gray-600" />;
                          })()}
                          <span className="text-sm font-medium text-[#1E3A5F] capitalize">{selectedItem.platform}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Published:</span>
                        <span className="text-sm font-medium text-[#1E3A5F]">{selectedItem.publishedDate} EST</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Status:</span>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Delivered</span>
                        </div>
                      </div>
                      {selectedItem.recipients && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Results:</span>
                            <span className="text-xs font-medium text-gray-700">Sent to {selectedItem.recipients} recipients</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button className="text-sm text-[#0EA5E9] hover:text-[#0284C7] font-medium">
                      View Analytics
                    </button>
                  </div>
                )}

                {/* Action Buttons for Pending */}
                {selectedItem.status === 'pending' && (
                  <div className="space-y-3 pt-4">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button variant="outline" className="w-full border-red-300 text-red-600 hover:bg-red-50" onClick={handleReject}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button variant="outline" className="w-full border-gray-300 text-[#1E3A5F] hover:bg-gray-50" onClick={handleRequestChanges}>
                      <Clock className="w-4 h-4 mr-2" />
                      Request Changes
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
