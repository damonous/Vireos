import { useState } from 'react';
import { Check, X, Edit, Linkedin, Facebook, Mail, AlertCircle, Calendar, Clock } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface ContentSubmission {
  id: number;
  advisor: {
    name: string;
    initials: string;
  };
  platform: 'linkedin' | 'facebook' | 'email';
  submittedTime: string;
  content: string;
  isUrgent?: boolean;
  prohibitedTerms?: string[];
  demoState?: 'rejected-with-notes' | 'rejected-final' | 'approved';
  demoNotes?: string;
}

const contentSubmissions: ContentSubmission[] = [
  {
    id: 1,
    advisor: { name: 'Sarah Mitchell', initials: 'SM' },
    platform: 'linkedin',
    submittedTime: '2 hrs ago',
    content: 'Q1 Market Outlook: We guaranteed strong returns this quarter based on our proprietary analysis. Our investment strategies have consistently outperformed the market.',
    isUrgent: true,
    prohibitedTerms: ['guaranteed'],
    demoState: 'rejected-with-notes',
    demoNotes: 'The term \'guaranteed\' violates FINRA Rule 2210. Please replace with \'historically strong\' or similar non-promissory language. Also remove \'consistently outperformed\' as it implies guaranteed future performance.',
  },
  {
    id: 2,
    advisor: { name: 'Michael Chen', initials: 'MC' },
    platform: 'facebook',
    submittedTime: '3 hrs ago',
    content: 'Tax Workshop: We promise our strategies will reduce your taxes significantly. Join us next Thursday for an exclusive workshop on tax-efficient investing.',
    isUrgent: true,
    prohibitedTerms: ['promise'],
    demoState: 'rejected-final',
    demoNotes: 'Remove the word \'promise\' — FINRA prohibits promissory language in marketing materials.',
  },
  {
    id: 3,
    advisor: { name: 'Jennifer Walsh', initials: 'JW' },
    platform: 'linkedin',
    submittedTime: '4 hrs ago',
    content: 'Estate Planning basics for high-net-worth individuals. Schedule a consultation to discuss how we can help protect your legacy and ensure your wishes are honored.',
    demoState: 'approved',
  },
  {
    id: 4,
    advisor: { name: 'David Park', initials: 'DP' },
    platform: 'linkedin',
    submittedTime: '5 hrs ago',
    content: 'Connecting with fellow financial professionals to discuss market trends and share insights on portfolio diversification strategies in the current economic climate.',
  },
  {
    id: 5,
    advisor: { name: 'Lisa Nguyen', initials: 'LN' },
    platform: 'email',
    submittedTime: '6 hrs ago',
    content: 'Monthly Newsletter: Market update for February 2026. No investment is risk-free, but proper diversification can help manage your portfolio exposure to market volatility.',
    prohibitedTerms: ['risk-free'],
  },
  {
    id: 6,
    advisor: { name: 'Tom Bradley', initials: 'TB' },
    platform: 'linkedin',
    submittedTime: '7 hrs ago',
    content: 'Retirement planning tips: Start early, contribute regularly, and consider working with a financial advisor to create a comprehensive retirement strategy.',
  },
  {
    id: 7,
    advisor: { name: 'Sarah Mitchell', initials: 'SM' },
    platform: 'facebook',
    submittedTime: '8 hrs ago',
    content: 'Did you know that compound interest is one of the most powerful tools for building wealth? Let\'s discuss how to make it work for your financial goals.',
  },
  {
    id: 8,
    advisor: { name: 'Jennifer Walsh', initials: 'JW' },
    platform: 'email',
    submittedTime: '9 hrs ago',
    content: 'Quarterly Review Reminder: It\'s time to review your portfolio performance and discuss any adjustments needed to stay aligned with your financial objectives.',
  },
];

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'linkedin':
      return <Linkedin className="w-4 h-4 text-blue-600" />;
    case 'facebook':
      return <Facebook className="w-4 h-4 text-blue-700" />;
    case 'email':
      return <Mail className="w-4 h-4 text-gray-600" />;
    default:
      return null;
  }
};

const highlightProhibitedTerms = (text: string, terms?: string[]) => {
  if (!terms || terms.length === 0) {
    return <span>{text}</span>;
  }

  const parts: JSX.Element[] = [];
  let remainingText = text;
  let keyCounter = 0;

  terms.forEach((term) => {
    const regex = new RegExp(`(${term})`, 'gi');
    const newParts: JSX.Element[] = [];
    
    if (parts.length === 0) {
      const matches = remainingText.split(regex);
      matches.forEach((part, index) => {
        if (part.toLowerCase() === term.toLowerCase()) {
          newParts.push(
            <span key={`${keyCounter++}`} className="bg-red-200 text-red-900 px-1 rounded">
              {part}
            </span>
          );
        } else if (part) {
          newParts.push(<span key={`${keyCounter++}`}>{part}</span>);
        }
      });
    }
    
    if (newParts.length > 0) {
      parts.push(...newParts);
    }
  });

  if (parts.length === 0) {
    // Fallback: highlight all terms in one pass
    let processedText = remainingText;
    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, 'gi');
      const segments = processedText.split(regex);
      processedText = segments.map((segment, i) => 
        segment.toLowerCase() === term.toLowerCase() 
          ? `|||HIGHLIGHT|||${segment}|||END|||`
          : segment
      ).join('');
    });

    return (
      <>
        {processedText.split('|||').map((part, i) => {
          if (part === 'HIGHLIGHT') return null;
          if (part === 'END') return null;
          
          const prevPart = i > 0 ? processedText.split('|||')[i - 1] : '';
          if (prevPart === 'HIGHLIGHT') {
            return (
              <span key={i} className="bg-red-200 text-red-900 px-1 rounded">
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  }

  return <>{parts}</>;
};

export default function ContentReview() {
  const [activeTab, setActiveTab] = useState('pending');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [advisorFilter, setAdvisorFilter] = useState('all');
  const [showingNotesFor, setShowingNotesFor] = useState<{ id: number; type: 'reject' | 'edits' } | null>(null);
  const [notesText, setNotesText] = useState('');
  const [contentStatus, setContentStatus] = useState<{ 
    [key: number]: { 
      status: 'approved' | 'rejected' | 'edits';
      notes?: string;
    } 
  }>({});

  const handleApprove = (id: number) => {
    setContentStatus({
      ...contentStatus,
      [id]: { status: 'approved' },
    });
  };

  const handleRejectClick = (id: number) => {
    setShowingNotesFor({ id, type: 'reject' });
    setNotesText('');
  };

  const handleRequestEditsClick = (id: number) => {
    setShowingNotesFor({ id, type: 'edits' });
    setNotesText('');
  };

  const handleConfirmReject = (id: number) => {
    setContentStatus({
      ...contentStatus,
      [id]: { status: 'rejected', notes: notesText },
    });
    setShowingNotesFor(null);
    setNotesText('');
  };

  const handleConfirmEdits = (id: number) => {
    setContentStatus({
      ...contentStatus,
      [id]: { status: 'edits', notes: notesText },
    });
    setShowingNotesFor(null);
    setNotesText('');
  };

  const handleCancel = () => {
    setShowingNotesFor(null);
    setNotesText('');
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar with Filters */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Content Review</h1>
            <p className="text-sm text-gray-500 mt-1">Review and approve content submissions</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            >
              <option value="all">All Platforms</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="email">Email</option>
            </select>
            <select
              value={advisorFilter}
              onChange={(e) => setAdvisorFilter(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            >
              <option value="all">All Advisors</option>
              <option value="sarah">Sarah Mitchell</option>
              <option value="michael">Michael Chen</option>
              <option value="jennifer">Jennifer Walsh</option>
              <option value="david">David Park</option>
              <option value="lisa">Lisa Nguyen</option>
              <option value="tom">Tom Bradley</option>
            </select>
            <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
              <Calendar className="w-4 h-4 mr-2" />
              Date Range
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 -mb-px">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === 'pending'
                ? 'text-[#0EA5E9]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pending Review (8)
            {activeTab === 'pending' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0EA5E9]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === 'approved'
                ? 'text-[#0EA5E9]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Approved
            {activeTab === 'approved' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0EA5E9]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
              activeTab === 'rejected'
                ? 'text-[#0EA5E9]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rejected
            {activeTab === 'rejected' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0EA5E9]" />
            )}
          </button>
        </div>
      </div>

      {/* Content List */}
      <div className="p-8">
        {activeTab === 'pending' && (
          <>
            {/* Stats Bar */}
            <div className="flex items-center gap-6 mb-6 bg-white border border-gray-200 rounded-lg px-6 py-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700">Today: <span className="font-semibold text-[#1E3A5F]">3 reviewed</span>, <span className="font-semibold text-[#1E3A5F]">5 pending</span></span>
              </div>
              <div className="h-4 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0EA5E9]" />
                <span className="text-sm text-gray-700">Avg review time: <span className="font-semibold text-[#1E3A5F]">4 min</span></span>
              </div>
            </div>

            <div className="space-y-4">
              {contentSubmissions.map((submission) => {
                const status = contentStatus[submission.id];
                const showingNotes = showingNotesFor?.id === submission.id;
                
                // Determine card state
                let borderColor = 'border-gray-200';
                if (submission.demoState === 'approved' || status?.status === 'approved') {
                  borderColor = 'border-l-4 border-l-green-500';
                } else if (submission.demoState === 'rejected-final' || status?.status === 'rejected') {
                  borderColor = 'border-l-4 border-l-red-500';
                } else if (status?.status === 'edits') {
                  borderColor = 'border-l-4 border-l-amber-500';
                }

                return (
                  <Card key={submission.id} className={`p-6 rounded-lg shadow-sm border ${borderColor}`}>
                    {submission.isUrgent && !status?.status && submission.demoState !== 'approved' && submission.demoState !== 'rejected-final' && (
                      <div className="absolute top-4 right-4 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                        URGENT
                      </div>
                    )}
                    
                    <div className="flex items-start gap-6">
                      {/* Left: Advisor Info */}
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {submission.advisor.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1E3A5F] truncate">
                            {submission.advisor.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getPlatformIcon(submission.platform)}
                            <span className="text-xs text-gray-500">{submission.submittedTime}</span>
                          </div>
                        </div>
                      </div>

                      {/* Center: Content */}
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          {highlightProhibitedTerms(submission.content, submission.prohibitedTerms)}
                        </p>
                        {submission.prohibitedTerms && submission.prohibitedTerms.length > 0 && !status?.status && submission.demoState !== 'approved' && submission.demoState !== 'rejected-final' && submission.demoState !== 'rejected-with-notes' && (
                          <div className="flex items-center gap-2 mt-3 text-xs text-red-600">
                            <AlertCircle className="w-4 h-4" />
                            <span>Contains prohibited terms</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Action Buttons or Status Badge */}
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {/* Demo State: Approved */}
                        {submission.demoState === 'approved' && !status?.status && (
                          <div className="space-y-2">
                            <div className="bg-green-100 text-green-800 px-3 py-2 rounded text-sm font-medium text-center">
                              Approved ✓
                            </div>
                            <p className="text-xs text-gray-600 text-center">Queued for auto-distribution</p>
                          </div>
                        )}

                        {/* Demo State: Rejected Final */}
                        {submission.demoState === 'rejected-final' && !status?.status && (
                          <div className="space-y-2">
                            <div className="bg-red-100 text-red-800 px-3 py-2 rounded text-sm font-medium text-center">
                              Rejected ✗
                            </div>
                            <p className="text-xs text-gray-600 text-center">Sent to advisor for revision</p>
                          </div>
                        )}

                        {/* Regular Status: Approved */}
                        {!submission.demoState && status?.status === 'approved' && (
                          <div className="space-y-2">
                            <div className="bg-green-100 text-green-800 px-3 py-2 rounded text-sm font-medium text-center">
                              Approved ✓
                            </div>
                            <p className="text-xs text-gray-600 text-center">Queued for auto-distribution</p>
                          </div>
                        )}

                        {/* Regular Status: Rejected */}
                        {!submission.demoState && status?.status === 'rejected' && (
                          <div className="space-y-2">
                            <div className="bg-red-100 text-red-800 px-3 py-2 rounded text-sm font-medium text-center">
                              Rejected ✗
                            </div>
                            <p className="text-xs text-gray-600 text-center">Sent to advisor for revision</p>
                          </div>
                        )}

                        {/* Regular Status: Edits Requested */}
                        {!submission.demoState && status?.status === 'edits' && (
                          <div className="space-y-2">
                            <div className="bg-amber-100 text-amber-800 px-3 py-2 rounded text-sm font-medium text-center">
                              Edits Requested ✎
                            </div>
                            <p className="text-xs text-gray-600 text-center">Advisor notified</p>
                          </div>
                        )}

                        {/* Pending - Show Action Buttons */}
                        {!status?.status && submission.demoState !== 'approved' && submission.demoState !== 'rejected-final' && submission.demoState !== 'rejected-with-notes' && (
                          <>
                            <Button className="bg-green-600 hover:bg-green-700 text-white text-sm h-9" onClick={() => handleApprove(submission.id)}>
                              <Check className="w-4 h-4 mr-2" />
                              Approve
                            </Button>
                            <Button className="bg-red-600 hover:bg-red-700 text-white text-sm h-9" onClick={() => handleRejectClick(submission.id)}>
                              <X className="w-4 h-4 mr-2" />
                              Reject
                            </Button>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white text-sm h-9" onClick={() => handleRequestEditsClick(submission.id)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Request Edits
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Demo State: Show Rejection Notes Form (Item 1) */}
                    {submission.demoState === 'rejected-with-notes' && !status?.status && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Rejection Notes
                        </label>
                        <textarea
                          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                          placeholder="Explain why this content was rejected and what needs to change..."
                          value={submission.demoNotes}
                          readOnly
                        />
                        <div className="flex items-center gap-3 mt-3">
                          <Button className="bg-red-600 hover:bg-red-700 text-white">
                            Confirm Rejection
                          </Button>
                          <button className="text-sm text-gray-600 hover:text-[#1E3A5F]">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show Notes Section after Rejection (Demo Item 2) */}
                    {submission.demoState === 'rejected-final' && !status?.status && submission.demoNotes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Rejection Notes:</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-3 rounded-lg border border-red-200">
                          {submission.demoNotes}
                        </p>
                      </div>
                    )}

                    {/* Show Notes Section after Regular Status */}
                    {status?.status === 'rejected' && status.notes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Rejection Notes:</p>
                        <p className="text-sm text-gray-600 bg-red-50 p-3 rounded-lg border border-red-200">
                          {status.notes}
                        </p>
                      </div>
                    )}

                    {status?.status === 'edits' && status.notes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Edit Notes:</p>
                        <p className="text-sm text-gray-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                          {status.notes}
                        </p>
                      </div>
                    )}

                    {/* Interactive Notes Form (for user interactions) */}
                    {showingNotes && (
                      <div className="mt-6 pt-6 border-t border-gray-200">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {showingNotesFor?.type === 'reject' ? 'Rejection Notes' : 'Edit Notes'}
                        </label>
                        <textarea
                          className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] resize-none"
                          placeholder={
                            showingNotesFor?.type === 'reject'
                              ? 'Explain why this content was rejected and what needs to change...'
                              : 'Describe what changes are needed...'
                          }
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex items-center gap-3 mt-3">
                          {showingNotesFor?.type === 'reject' ? (
                            <Button 
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => handleConfirmReject(submission.id)}
                            >
                              Confirm Rejection
                            </Button>
                          ) : (
                            <Button 
                              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                              onClick={() => handleConfirmEdits(submission.id)}
                            >
                              Send Edit Request
                            </Button>
                          )}
                          <button 
                            className="text-sm text-gray-600 hover:text-[#1E3A5F]"
                            onClick={handleCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'approved' && (
          <Card className="p-12 rounded-lg shadow-sm border border-gray-200 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">No Approved Content</h3>
              <p className="text-sm text-gray-500">
                Approved content will appear here
              </p>
            </div>
          </Card>
        )}

        {activeTab === 'rejected' && (
          <Card className="p-12 rounded-lg shadow-sm border border-gray-200 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">No Rejected Content</h3>
              <p className="text-sm text-gray-500">
                Rejected content will appear here
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
