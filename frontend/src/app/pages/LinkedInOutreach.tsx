import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Edit2, Pause, Play, Trash2, CheckCircle2, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Toast } from '../components/ui/toast';

const campaigns = [
  {
    id: 1,
    name: 'Q1 Retirement Planning Outreach',
    status: 'active',
    connectionsSent: 247,
    messagesSent: 189,
    replies: 23,
  },
  {
    id: 2,
    name: 'Tax Season Leads 2026',
    status: 'active',
    connectionsSent: 312,
    messagesSent: 256,
    replies: 47,
  },
  {
    id: 3,
    name: 'Estate Planning Series',
    status: 'paused',
    connectionsSent: 156,
    messagesSent: 98,
    replies: 12,
  },
  {
    id: 4,
    name: 'Holiday Greetings Campaign',
    status: 'completed',
    connectionsSent: 428,
    messagesSent: 342,
    replies: 89,
  },
];

const contacts = [
  { id: 1, name: 'Michael Chen', title: 'Financial Advisor', company: 'Wealth Partners Inc', status: 'Connected', lastContact: '2 days ago' },
  { id: 2, name: 'Jennifer Martinez', title: 'VP of Operations', company: 'Fortune Financial', status: 'Pending', lastContact: '5 days ago' },
  { id: 3, name: 'Robert Thompson', title: 'Senior Partner', company: 'Thompson & Associates', status: 'Replied', lastContact: '1 day ago' },
  { id: 4, name: 'Lisa Wang', title: 'Managing Director', company: 'Capital Advisors', status: 'Connected', lastContact: '3 days ago' },
  { id: 5, name: 'David Rodriguez', title: 'Wealth Manager', company: 'Premier Wealth Group', status: 'Pending', lastContact: '1 week ago' },
];

export default function LinkedInOutreach() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showNewCampaignForm, setShowNewCampaignForm] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignGoal, setNewCampaignGoal] = useState('Connections');
  const [showToast, setShowToast] = useState(false);
  
  const totalConnections = campaigns.reduce((sum, c) => sum + c.connectionsSent, 0);
  const totalMessages = campaigns.reduce((sum, c) => sum + c.messagesSent, 0);
  const totalReplies = campaigns.reduce((sum, c) => sum + c.replies, 0);
  const acceptanceRate = Math.round((totalConnections / (totalConnections + 100)) * 100); // Mock calculation

  const handleStartCampaign = () => {
    setShowToast(true);
    setShowNewCampaignForm(false);
    setNewCampaignName('');
    setNewCampaignGoal('Connections');
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </span>;
      case 'paused':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
          <Pause className="w-3 h-3" />
          Paused
        </span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </span>;
      default:
        return null;
    }
  };
  
  const getContactStatusColor = (status: string) => {
    switch (status) {
      case 'Connected':
        return 'text-green-700 bg-green-100 border-green-200';
      case 'Replied':
        return 'text-blue-700 bg-blue-100 border-blue-200';
      case 'Pending':
        return 'text-gray-700 bg-gray-100 border-gray-200';
      default:
        return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">LinkedIn Outreach</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your LinkedIn connection and messaging campaigns</p>
          </div>
          <Button 
            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            onClick={() => navigate('/linkedin-builder')}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* New Campaign Form */}
        {showNewCampaignForm && (
          <Card className="mb-6 p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Create New Campaign</h3>
              <button
                onClick={() => setShowNewCampaignForm(false)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Campaign Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Q2 Financial Advisory Outreach"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Goal
                </label>
                <select
                  value={newCampaignGoal}
                  onChange={(e) => setNewCampaignGoal(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="Connections">Connections</option>
                  <option value="Messages">Messages</option>
                  <option value="Impressions">Impressions</option>
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowNewCampaignForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                  onClick={handleStartCampaign}
                  disabled={!newCampaignName}
                >
                  Start Campaign
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Connections Sent</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{totalConnections}</h3>
                <p className="text-sm text-gray-500 mt-2">This month</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Acceptance Rate</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{acceptanceRate}%</h3>
                <p className="text-sm text-green-600 mt-2">+5% vs last month</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Messages Sent</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{totalMessages}</h3>
                <p className="text-sm text-gray-500 mt-2">Across all campaigns</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Replies</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{totalReplies}</h3>
                <p className="text-sm text-blue-600 mt-2">{Math.round((totalReplies / totalMessages) * 100)}% response rate</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-[#0EA5E9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-gray-200 px-6 pt-4">
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="campaigns" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#0EA5E9] rounded-none px-4 pb-3 data-[state=active]:text-[#0EA5E9] text-gray-600"
                >
                  Campaigns
                </TabsTrigger>
                <TabsTrigger 
                  value="contacts" 
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[#0EA5E9] rounded-none px-4 pb-3 data-[state=active]:text-[#0EA5E9] text-gray-600"
                >
                  Contacts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="campaigns" className="m-0 p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Campaign Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Connections Sent</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Messages Sent</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Replies</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <p className="text-sm font-medium text-[#1E3A5F]">{campaign.name}</p>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(campaign.status)}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700">{campaign.connectionsSent}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">{campaign.messagesSent}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">{campaign.replies}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </Button>
                            {campaign.status === 'active' ? (
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <Pause className="w-4 h-4 text-gray-600" />
                              </Button>
                            ) : campaign.status === 'paused' ? (
                              <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                                <Play className="w-4 h-4 text-gray-600" />
                              </Button>
                            ) : null}
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
            </TabsContent>

            <TabsContent value="contacts" className="m-0 p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Last Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <p className="text-sm font-medium text-[#1E3A5F]">{contact.name}</p>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700">{contact.title}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">{contact.company}</td>
                        <td className="py-4 px-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getContactStatusColor(contact.status)}`}>
                            {contact.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">{contact.lastContact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Daily Limit Indicator */}
        <Card className="mt-6 p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E3A5F]">Daily Message Limit</h3>
              <p className="text-xs text-gray-500 mt-1">87 of 100 messages sent today</p>
            </div>
            <span className="text-2xl font-semibold text-[#1E3A5F]">87%</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0EA5E9] rounded-full transition-all" style={{ width: '87%' }}></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Resets in 6 hours 23 minutes</p>
        </Card>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          className="bg-[#0EA5E9] text-white"
          onOpenChange={setShowToast}
        >
          <div className="flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <p className="text-sm font-medium">Campaign started successfully!</p>
          </div>
        </Toast>
      )}
    </div>
  );
}