import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Sparkles, Plus, Clock, ChevronDown } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';

export default function LinkedInCampaignBuilder() {
  const navigate = useNavigate();
  const [campaignName, setCampaignName] = useState('');
  const [campaignGoal, setCampaignGoal] = useState<'lead-gen' | 'networking' | 'event'>('lead-gen');
  const [targetAudience, setTargetAudience] = useState('');
  const [tags, setTags] = useState<string[]>(['Retirement', 'Q1 2026']);
  const [tagInput, setTagInput] = useState('');
  
  const [step1Message, setStep1Message] = useState("Hi {{first_name}}, I'm a financial advisor specializing in retirement planning. I noticed your background in {{industry}} and thought we might benefit from connecting. Looking forward to sharing insights!");
  const [step2Message, setStep2Message] = useState("Thanks for connecting, {{first_name}}! I work with professionals like you who are thinking about their retirement strategy. I recently published an article on tax-efficient retirement planning that might interest you. Would you be open to a brief conversation about your financial goals?");
  const [step3Message, setStep3Message] = useState("Hi {{first_name}}, I wanted to follow up one last time. I'm hosting a complimentary retirement planning webinar next month that covers strategies for maximizing Social Security benefits and minimizing tax burden. Would you like me to send you the details? Either way, I'm happy to be connected!");
  
  const [delay1, setDelay1] = useState('2 days');
  const [delay2, setDelay2] = useState('5 days');
  
  const [startDate, setStartDate] = useState('2026-03-07');
  const [endDate, setEndDate] = useState('2026-04-06');
  const [runUntilComplete, setRunUntilComplete] = useState(false);
  const [dailyLimit, setDailyLimit] = useState('25');
  const [sendStartTime, setSendStartTime] = useState('9:00 AM');
  const [sendEndTime, setSendEndTime] = useState('5:00 PM');
  const [timezone, setTimezone] = useState('EST');
  const [activeDays, setActiveDays] = useState({
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: false,
    sun: false,
  });

  const mergeFields = ['{{first_name}}', '{{last_name}}', '{{company}}', '{{industry}}', '{{job_title}}'];

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = () => {
    // Submit for compliance review logic
    navigate('/linkedin');
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard this campaign? All changes will be lost.')) {
      navigate('/linkedin');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/linkedin')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create LinkedIn Campaign</h1>
              <p className="text-sm text-gray-500 mt-0.5">Build a multi-step outreach sequence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Discard
            </button>
            <Button
              variant="outline"
              className="border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
            >
              Save Draft
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {/* Section 1: Campaign Details */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-5">Campaign Details</h2>
          
          <div className="space-y-5">
            {/* Campaign Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Name
              </label>
              <Input
                type="text"
                placeholder="e.g., Q1 Retirement Planning Outreach"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
              />
            </div>

            {/* Campaign Goal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Campaign Goal
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setCampaignGoal('lead-gen')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    campaignGoal === 'lead-gen'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-[#1E3A5F] mb-1">Lead Generation</div>
                  <div className="text-xs text-gray-600">Connect with prospects and nurture them into leads</div>
                </button>
                <button
                  onClick={() => setCampaignGoal('networking')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    campaignGoal === 'networking'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-[#1E3A5F] mb-1">Networking</div>
                  <div className="text-xs text-gray-600">Build relationships with industry professionals</div>
                </button>
                <button
                  onClick={() => setCampaignGoal('event')}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    campaignGoal === 'event'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-[#1E3A5F] mb-1">Event Promotion</div>
                  <div className="text-xs text-gray-600">Invite connections to webinars or events</div>
                </button>
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Audience
              </label>
              <Input
                type="text"
                placeholder="e.g., CFOs at companies with 50-200 employees in Texas"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20 border px-3 py-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-2 hover:text-[#0284C7]"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Add tags to organize campaigns..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                  className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                />
                <Button
                  onClick={handleAddTag}
                  variant="outline"
                  className="border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 2: Outreach Sequence */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Build Your Outreach Sequence</h2>
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate with AI
            </Button>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Define each step of your campaign. Messages are sent automatically based on the delays you configure.
          </p>

          {/* Step 1 - Connection Request */}
          <div className="relative pl-8 pb-8">
            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-[#0EA5E9] text-white flex items-center justify-center font-semibold text-sm z-10">
              1
            </div>
            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300"></div>
            
            <div className="ml-4">
              <div className="bg-white border-l-4 border-[#0EA5E9] rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-[#0EA5E9] text-white">Connection Request</Badge>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Message Template
                    </label>
                    <Textarea
                      value={step1Message}
                      onChange={(e) => setStep1Message(e.target.value)}
                      rows={3}
                      className="text-sm border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{step1Message.length}/300</span>
                      <span className="text-xs text-gray-500">Keep connection request notes under 300 characters</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Merge Fields
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {mergeFields.map((field) => (
                        <button
                          key={field}
                          onClick={() => setStep1Message(step1Message + field)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 font-mono transition-colors"
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delay 1 */}
          <div className="relative pl-8 pb-8">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            <div className="ml-4">
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 text-sm">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-700">Wait</span>
                <select
                  value={delay1}
                  onChange={(e) => setDelay1(e.target.value)}
                  className="bg-transparent border-none text-[#0EA5E9] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="1 day">1 day</option>
                  <option value="2 days">2 days</option>
                  <option value="3 days">3 days</option>
                  <option value="5 days">5 days</option>
                  <option value="7 days">7 days</option>
                  <option value="14 days">14 days</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#0EA5E9]" />
              </div>
            </div>
          </div>

          {/* Step 2 - Follow-up Message */}
          <div className="relative pl-8 pb-8">
            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-sm z-10">
              2
            </div>
            <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300"></div>
            
            <div className="ml-4">
              <div className="bg-white border-l-4 border-blue-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-blue-500 text-white">Follow-up Message</Badge>
                  <Badge className="bg-gray-100 text-gray-700 border border-gray-300">
                    Only if: Connection Accepted
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Message Template
                    </label>
                    <Textarea
                      value={step2Message}
                      onChange={(e) => setStep2Message(e.target.value)}
                      rows={4}
                      className="text-sm border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{step2Message.length}/2000</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Merge Fields
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {mergeFields.map((field) => (
                        <button
                          key={field}
                          onClick={() => setStep2Message(step2Message + field)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 font-mono transition-colors"
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Delay 2 */}
          <div className="relative pl-8 pb-8">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            <div className="ml-4">
              <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2 text-sm">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-700">Wait</span>
                <select
                  value={delay2}
                  onChange={(e) => setDelay2(e.target.value)}
                  className="bg-transparent border-none text-[#0EA5E9] font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="1 day">1 day</option>
                  <option value="2 days">2 days</option>
                  <option value="3 days">3 days</option>
                  <option value="5 days">5 days</option>
                  <option value="7 days">7 days</option>
                  <option value="14 days">14 days</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#0EA5E9]" />
              </div>
            </div>
          </div>

          {/* Step 3 - Final Follow-up */}
          <div className="relative pl-8 pb-4">
            <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-semibold text-sm z-10">
              3
            </div>
            
            <div className="ml-4">
              <div className="bg-white border-l-4 border-orange-500 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-orange-500 text-white">Final Message</Badge>
                  <Badge className="bg-gray-100 text-gray-700 border border-gray-300">
                    Only if: No Reply to Step 2
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Message Template
                    </label>
                    <Textarea
                      value={step3Message}
                      onChange={(e) => setStep3Message(e.target.value)}
                      rows={4}
                      className="text-sm border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">{step3Message.length}/2000</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Merge Fields
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {mergeFields.map((field) => (
                        <button
                          key={field}
                          onClick={() => setStep3Message(step3Message + field)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-700 font-mono transition-colors"
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Step Button */}
          <div className="mt-6">
            <Button
              variant="outline"
              className="w-full border-dashed border-2 border-gray-300 text-gray-600 hover:border-[#0EA5E9] hover:text-[#0EA5E9] hover:bg-[#0EA5E9]/5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
            <p className="text-xs text-gray-500 text-center mt-2">
              You can add up to 5 steps per sequence
            </p>
          </div>
        </Card>

        {/* Section 3: Schedule & Limits */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-5">Campaign Schedule</h2>
          
          <div className="space-y-5">
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={runUntilComplete}
                  className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9] disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Run Until Complete */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="runUntilComplete"
                checked={runUntilComplete}
                onChange={(e) => setRunUntilComplete(e.target.checked)}
                className="w-4 h-4 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
              />
              <label htmlFor="runUntilComplete" className="text-sm text-gray-700">
                Run until all prospects are contacted
              </label>
            </div>

            {/* Daily Message Limit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Message Limit
              </label>
              <Input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum messages sent per day. LinkedIn recommends staying under 100 daily to avoid restrictions.
              </p>
            </div>

            {/* Sending Window */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sending Window
              </label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Send between</span>
                <select
                  value={sendStartTime}
                  onChange={(e) => setSendStartTime(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="6:00 AM">6:00 AM</option>
                  <option value="7:00 AM">7:00 AM</option>
                  <option value="8:00 AM">8:00 AM</option>
                  <option value="9:00 AM">9:00 AM</option>
                  <option value="10:00 AM">10:00 AM</option>
                </select>
                <span className="text-sm text-gray-600">and</span>
                <select
                  value={sendEndTime}
                  onChange={(e) => setSendEndTime(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="3:00 PM">3:00 PM</option>
                  <option value="4:00 PM">4:00 PM</option>
                  <option value="5:00 PM">5:00 PM</option>
                  <option value="6:00 PM">6:00 PM</option>
                  <option value="7:00 PM">7:00 PM</option>
                </select>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="EST">EST</option>
                  <option value="CST">CST</option>
                  <option value="MST">MST</option>
                  <option value="PST">PST</option>
                </select>
              </div>
            </div>

            {/* Days of Week */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Days of Week
              </label>
              <div className="flex gap-3">
                {[
                  { key: 'mon', label: 'Mon' },
                  { key: 'tue', label: 'Tue' },
                  { key: 'wed', label: 'Wed' },
                  { key: 'thu', label: 'Thu' },
                  { key: 'fri', label: 'Fri' },
                  { key: 'sat', label: 'Sat' },
                  { key: 'sun', label: 'Sun' },
                ].map((day) => (
                  <label
                    key={day.key}
                    className={`flex items-center justify-center w-14 h-10 rounded-lg border-2 cursor-pointer transition-all ${
                      activeDays[day.key as keyof typeof activeDays]
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0EA5E9] font-semibold'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={activeDays[day.key as keyof typeof activeDays]}
                      onChange={(e) =>
                        setActiveDays({ ...activeDays, [day.key]: e.target.checked })
                      }
                      className="sr-only"
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Section 4: Review */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-5">Campaign Summary</h2>
          
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="text-gray-600">Campaign Name</div>
            <div className="text-[#1E3A5F] font-medium">
              {campaignName || 'Q1 Retirement Planning Outreach'}
            </div>

            <div className="text-gray-600">Goal</div>
            <div className="text-[#1E3A5F] font-medium">
              {campaignGoal === 'lead-gen' ? 'Lead Generation' : campaignGoal === 'networking' ? 'Networking' : 'Event Promotion'}
            </div>

            <div className="text-gray-600">Sequence Steps</div>
            <div className="text-[#1E3A5F] font-medium">
              3 (Connection Request → Follow-up → Final Message)
            </div>

            <div className="text-gray-600">Schedule</div>
            <div className="text-[#1E3A5F] font-medium">
              {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>

            <div className="text-gray-600">Daily Limit</div>
            <div className="text-[#1E3A5F] font-medium">
              {dailyLimit} messages/day
            </div>

            <div className="text-gray-600">Sending Window</div>
            <div className="text-[#1E3A5F] font-medium">
              {sendStartTime} — {sendEndTime} {timezone} (Mon-Fri)
            </div>

            <div className="text-gray-600">Est. Prospects</div>
            <div className="text-[#1E3A5F] font-medium">
              Up to 750 over 30 days
            </div>
          </div>

          {/* Compliance Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
            <div className="w-5 h-5 text-amber-600 flex-shrink-0">⚠️</div>
            <p className="text-sm text-amber-900">
              LinkedIn outreach messages will be reviewed for compliance with FINRA communication guidelines before the campaign goes live.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-12 text-base font-semibold"
            >
              Submit for Compliance Review
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-gray-300 text-[#1E3A5F] hover:bg-gray-50 h-12 text-base"
            >
              Save as Draft
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
