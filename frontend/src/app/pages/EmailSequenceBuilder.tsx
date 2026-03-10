import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Zap, Plus, GripVertical, MoreVertical, ChevronDown, ChevronUp, Clock, Bold, Italic, Underline, Link2, List, ListOrdered, Sparkles, Monitor, Smartphone } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

interface EmailStep {
  id: number;
  subject: string;
  preview: string;
  body: string;
  delay: number;
  delayUnit: 'minutes' | 'hours' | 'days' | 'weeks';
  status: 'draft' | 'active';
  expanded: boolean;
  editorOpen: boolean;
}

export default function EmailSequenceBuilder() {
  const navigate = useNavigate();
  
  const [sequenceName, setSequenceName] = useState('');
  const [trigger, setTrigger] = useState('sign-up');
  const [tags, setTags] = useState('');
  const [sendWindowStart, setSendWindowStart] = useState('09:00');
  const [sendWindowEnd, setSendWindowEnd] = useState('17:00');
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [unsubscribeHandling, setUnsubscribeHandling] = useState('stop-immediately');
  const [senderName, setSenderName] = useState('Sarah Mitchell');
  const [senderEmail, setSenderEmail] = useState('sarah@pinnaclefinancial.com');
  const [replyTo, setReplyTo] = useState('sarah@pinnaclefinancial.com');
  
  const [emailSteps, setEmailSteps] = useState<EmailStep[]>([
    {
      id: 1,
      subject: 'Welcome to Pinnacle Financial!',
      preview: 'Thank you for your interest in our services...',
      body: `Hi {{first_name}},

Thank you for your interest in Pinnacle Financial. We are excited to help you on your financial journey.

As a first step, I'd love to learn more about your goals and current financial situation. Whether you're planning for retirement, managing investments, or looking for comprehensive wealth management, we have solutions tailored to your needs.

Here are a few resources to get you started:
- Our Retirement Planning Guide
- Investment Portfolio Assessment Tool
- Upcoming Webinar: Market Outlook 2026

Feel free to reply to this email or call me directly at {{advisor_phone}} to schedule a complimentary consultation.

Best regards,
{{advisor_name}}
Pinnacle Financial Advisors`,
      delay: 1,
      delayUnit: 'days',
      status: 'draft',
      expanded: false,
      editorOpen: true,
    },
    {
      id: 2,
      subject: '3 Tips for Growing Your Retirement Savings',
      preview: 'Are you on track for retirement? Here are some strategies...',
      body: `Hi {{first_name}},

I wanted to share three powerful strategies that could significantly boost your retirement savings:

1. **Maximize Your Employer Match** - If your company offers a 401(k) match, contribute at least enough to get the full match. It's free money that can compound over decades.

2. **Diversify Your Portfolio** - Don't put all your eggs in one basket. A balanced mix of stocks, bonds, and other assets can help manage risk while optimizing returns.

3. **Start a Roth IRA** - Tax-free growth and withdrawals in retirement can be incredibly valuable, especially if you expect to be in a higher tax bracket later.

At {{company}}, we help clients implement these strategies and more. Would you like to discuss how these apply to your specific situation?

Best regards,
{{advisor_name}}
{{advisor_phone}}`,
      delay: 2,
      delayUnit: 'days',
      status: 'draft',
      expanded: false,
      editorOpen: false,
    },
    {
      id: 3,
      subject: 'Schedule Your Free Consultation',
      preview: "We'd love to meet you and discuss your financial goals...",
      body: `Hi {{first_name}},

I hope you've found the resources and tips I've shared helpful. I'd love to take the next step and offer you a complimentary, no-obligation consultation to discuss your financial goals in detail.

During our meeting, we'll:
- Review your current financial situation
- Identify opportunities for growth
- Create a personalized action plan
- Answer any questions you have

You can easily schedule a time that works for you by replying to this email or calling me at {{advisor_phone}}.

I look forward to speaking with you soon!

Best regards,
{{advisor_name}}
Pinnacle Financial Advisors`,
      delay: 3,
      delayUnit: 'days',
      status: 'draft',
      expanded: false,
      editorOpen: false,
    },
  ]);

  const handleSaveDraft = () => {
    alert('Sequence saved as draft!');
    navigate('/email');
  };

  const handleDiscard = () => {
    if (confirm('Are you sure you want to discard this sequence? All changes will be lost.')) {
      navigate('/email');
    }
  };

  const handleActivate = () => {
    alert('Sequence activated! It will begin sending to leads matching your trigger.');
    navigate('/email');
  };

  const toggleStepExpanded = (id: number) => {
    setEmailSteps(steps =>
      steps.map(step => (step.id === id ? { ...step, expanded: !step.expanded } : step))
    );
  };

  const handleAddStep = () => {
    const newStep: EmailStep = {
      id: emailSteps.length + 1,
      subject: 'New Email Step',
      preview: 'Email preview text...',
      body: 'Email body content for the new step...',
      delay: 1,
      delayUnit: 'days',
      status: 'draft',
      expanded: false,
      editorOpen: false,
    };
    setEmailSteps([...emailSteps, newStep]);
  };

  const getTriggerLabel = () => {
    const triggers: Record<string, string> = {
      'sign-up': 'Sign-up',
      'lead-added': 'Lead Added',
      'form-submission': 'Form Submission',
      'facebook-ad-lead': 'Facebook Ad Lead',
      'linkedin-reply': 'LinkedIn Reply',
      'manual-enrollment': 'Manual Enrollment',
      'tag-added': 'Tag Added',
      'status-change': 'Status Change',
    };
    return triggers[trigger] || 'Sign-up';
  };

  const calculateTotalDuration = () => {
    const totalDays = emailSteps.reduce((sum, step) => {
      if (step.delayUnit === 'days') return sum + step.delay;
      if (step.delayUnit === 'hours') return sum + step.delay / 24;
      if (step.delayUnit === 'weeks') return sum + step.delay * 7;
      if (step.delayUnit === 'minutes') return sum + step.delay / (24 * 60);
      return sum;
    }, 0);
    return Math.round(totalDays);
  };

  const toggleEditorOpen = (id: number) => {
    setEmailSteps(steps =>
      steps.map(step => (step.id === id ? { ...step, editorOpen: !step.editorOpen } : step))
    );
  };

  const replaceMergeFields = (text: string) => {
    return text
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{last_name\}\}/g, 'Smith')
      .replace(/\{\{email\}\}/g, 'john.smith@example.com')
      .replace(/\{\{company\}\}/g, 'Smith Enterprises')
      .replace(/\{\{advisor_name\}\}/g, senderName)
      .replace(/\{\{advisor_phone\}\}/g, '(555) 123-4567');
  };

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [testEmail, setTestEmail] = useState('');

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/email')}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#0EA5E9] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sequences
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create Email Sequence</h1>
              <p className="text-sm text-gray-500 mt-0.5">Build an automated email workflow</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDiscard}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Discard
            </button>
            <Button
              variant="ghost"
              onClick={handleSaveDraft}
              className="text-gray-700 hover:text-[#0EA5E9]"
            >
              Save Draft
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* SECTION 1: Sequence Setup */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Sequence Setup</h2>
          
          <div className="space-y-5">
            <div>
              <Label htmlFor="sequenceName" className="text-sm font-medium text-gray-700 mb-2 block">
                Sequence Name
              </Label>
              <Input
                id="sequenceName"
                value={sequenceName}
                onChange={(e) => setSequenceName(e.target.value)}
                placeholder="e.g., Welcome Series for New Leads"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="trigger" className="text-sm font-medium text-gray-700 mb-2 block">
                Trigger
              </Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger id="trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sign-up">Sign-up</SelectItem>
                  <SelectItem value="lead-added">Lead Added</SelectItem>
                  <SelectItem value="form-submission">Form Submission</SelectItem>
                  <SelectItem value="facebook-ad-lead">Facebook Ad Lead</SelectItem>
                  <SelectItem value="linkedin-reply">LinkedIn Reply</SelectItem>
                  <SelectItem value="manual-enrollment">Manual Enrollment</SelectItem>
                  <SelectItem value="tag-added">Tag Added</SelectItem>
                  <SelectItem value="status-change">Status Change</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-2">
                This sequence will start automatically when the selected trigger event occurs.
              </p>
            </div>

            <div>
              <Label htmlFor="tags" className="text-sm font-medium text-gray-700 mb-2 block">
                Tags (optional)
              </Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags to organize sequences..."
                className="w-full"
              />
            </div>
          </div>
        </Card>

        {/* SECTION 2: Sequence Steps - Visual Timeline Builder */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">Build Your Sequence</h2>
          <p className="text-sm text-gray-600 mb-6">
            Add email steps with delays between them. Drag to reorder.
          </p>

          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[#0EA5E9]"></div>

            {/* Trigger Event */}
            <div className="relative flex items-start gap-4 mb-6">
              <div className="relative z-10 w-10 h-10 bg-[#0EA5E9] rounded-full flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 pt-2">
                <p className="text-sm font-semibold text-[#1E3A5F]">
                  Trigger: {getTriggerLabel()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Sequence starts when this event occurs</p>
              </div>
            </div>

            {/* Email Steps with Delays */}
            {emailSteps.map((step, index) => (
              <div key={step.id}>
                {/* Delay */}
                <div className="relative flex items-center gap-4 mb-6">
                  <div className="relative z-10 ml-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-full">
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-700">
                        Wait {step.delay} {step.delayUnit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email Step Card */}
                <div className="relative flex items-start gap-4 mb-6">
                  <div className="relative z-10 w-10 h-10 bg-white border-2 border-[#0EA5E9] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-[#0EA5E9]">{step.id}</span>
                  </div>
                  <div className="flex-1">
                    <Card className="border-l-4 border-l-[#0EA5E9] shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1">
                            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                            <div className="flex-1">
                              <Input
                                value={step.subject}
                                onChange={(e) => {
                                  setEmailSteps(steps =>
                                    steps.map(s => (s.id === step.id ? { ...s, subject: e.target.value } : s))
                                  );
                                }}
                                className="font-medium text-[#1E3A5F] border-0 px-0 focus:ring-0"
                                placeholder="Email subject line"
                              />
                              <Input
                                value={step.preview}
                                onChange={(e) => {
                                  setEmailSteps(steps =>
                                    steps.map(s => (s.id === step.id ? { ...s, preview: e.target.value } : s))
                                  );
                                }}
                                className="text-sm text-gray-600 border-0 px-0 mt-1 focus:ring-0"
                                placeholder="Preview text"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                              Draft
                            </span>
                            <button
                              onClick={() => toggleEditorOpen(step.id)}
                              className="text-[#0EA5E9] text-sm font-medium hover:text-[#0284C7]"
                            >
                              {step.editorOpen ? 'Close Editor' : 'Edit Template'}
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                              <MoreVertical className="w-4 h-4 text-gray-500" />
                            </button>
                            <button
                              onClick={() => toggleStepExpanded(step.id)}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              {step.expanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {step.expanded && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="bg-gray-50 rounded p-3">
                              <p className="text-xs text-gray-500 mb-2">Email Body Preview</p>
                              <p className="text-sm text-gray-700">
                                Email template content would be shown here...
                              </p>
                            </div>
                          </div>
                        )}

                        {step.editorOpen && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex gap-6">
                              {/* LEFT COLUMN - Email Editor */}
                              <div className="flex-1" style={{ width: '60%' }}>
                                <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">Email Template</h3>
                                
                                {/* Toolbar */}
                                <div className="flex items-center gap-1 mb-3 p-2 bg-gray-50 border border-gray-200 rounded-lg flex-wrap">
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Bold">
                                    <Bold className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Italic">
                                    <Italic className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Underline">
                                    <Underline className="w-4 h-4 text-gray-600" />
                                  </button>
                                  
                                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                  
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Link">
                                    <Link2 className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Bullet List">
                                    <List className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="Numbered List">
                                    <ListOrdered className="w-4 h-4 text-gray-600" />
                                  </button>
                                  
                                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                  
                                  <select className="px-2 py-1 text-xs border border-gray-300 rounded bg-white hover:bg-gray-50 transition-colors">
                                    <option value="">Insert Merge Field</option>
                                    <option value="{{first_name}}">{'{{first_name}}'}</option>
                                    <option value="{{last_name}}">{'{{last_name}}'}</option>
                                    <option value="{{email}}">{'{{email}}'}</option>
                                    <option value="{{company}}">{'{{company}}'}</option>
                                    <option value="{{advisor_name}}">{'{{advisor_name}}'}</option>
                                    <option value="{{advisor_phone}}">{'{{advisor_phone}}'}</option>
                                  </select>
                                  
                                  <div className="w-px h-5 bg-gray-300 mx-1"></div>
                                  
                                  <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0EA5E9] hover:bg-[#0EA5E9]/10 rounded transition-colors">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI Generate
                                  </button>
                                </div>
                                
                                {/* Email Body Textarea */}
                                <textarea
                                  value={step.body}
                                  onChange={(e) => {
                                    setEmailSteps(steps =>
                                      steps.map(s => (s.id === step.id ? { ...s, body: e.target.value } : s))
                                    );
                                  }}
                                  className="w-full h-64 p-3 border border-gray-300 rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                                  placeholder="Write your email content here..."
                                />
                                
                                {/* Character Count and Compliance Check */}
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-500">{step.body.length} characters</span>
                                  <button className="text-xs text-[#0EA5E9] hover:text-[#0284C7] font-medium">
                                    Compliance check
                                  </button>
                                </div>
                              </div>
                              
                              {/* RIGHT COLUMN - Live Preview */}
                              <div style={{ width: '40%' }}>
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="text-sm font-semibold text-[#1E3A5F]">Preview</h3>
                                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                                    <button
                                      onClick={() => setPreviewMode('desktop')}
                                      className={`p-1.5 rounded transition-colors ${
                                        previewMode === 'desktop' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                                      }`}
                                      title="Desktop View"
                                    >
                                      <Monitor className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                    <button
                                      onClick={() => setPreviewMode('mobile')}
                                      className={`p-1.5 rounded transition-colors ${
                                        previewMode === 'mobile' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                                      }`}
                                      title="Mobile View"
                                    >
                                      <Smartphone className="w-3.5 h-3.5 text-gray-600" />
                                    </button>
                                  </div>
                                </div>
                                
                                {/* Email Preview Mockup */}
                                <div className={`bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden ${
                                  previewMode === 'mobile' ? 'max-w-[320px] mx-auto' : ''
                                }`}>
                                  {/* Email Header */}
                                  <div className="bg-gray-50 border-b border-gray-200 p-3">
                                    <p className="text-xs text-gray-500 mb-0.5">From:</p>
                                    <p className="text-xs font-medium text-gray-900">
                                      {senderName} &lt;{senderEmail}&gt;
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2 mb-0.5">Subject:</p>
                                    <p className="text-xs font-medium text-gray-900">{step.subject}</p>
                                  </div>
                                  
                                  {/* Email Body */}
                                  <div className="p-4">
                                    <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                                      {replaceMergeFields(step.body)}
                                    </div>
                                  </div>
                                  
                                  {/* Email Footer */}
                                  <div className="bg-gray-50 border-t border-gray-200 p-3 text-center">
                                    <p className="text-xs font-semibold text-gray-700 mb-1">Pinnacle Financial Advisors</p>
                                    <a href="#" className="text-xs text-[#0EA5E9] hover:underline">Unsubscribe</a>
                                    <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                                      Securities offered through Pinnacle Financial Advisors. 
                                      Investment advisory services offered through PFA Advisors, LLC.
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Send Test Email */}
                                <div className="mt-4">
                                  <div className="flex gap-2">
                                    <Input
                                      type="email"
                                      placeholder="your@email.com"
                                      value={testEmail}
                                      onChange={(e) => setTestEmail(e.target.value)}
                                      className="flex-1 text-xs"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs whitespace-nowrap"
                                      onClick={() => alert('Test email sent to ' + testEmail)}
                                    >
                                      Send Test
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Step Button */}
            <div className="relative flex items-start gap-4">
              <div className="w-10"></div>
              <div className="flex-1">
                <button
                  onClick={handleAddStep}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#0EA5E9] hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5 text-gray-400 group-hover:text-[#0EA5E9]" />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-[#0EA5E9]">
                      Add Email Step
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Summary Bar */}
          <div className="flex items-center justify-center gap-8 mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-2xl font-semibold text-[#1E3A5F]">{emailSteps.length}</p>
              <p className="text-xs text-gray-500 mt-1">steps</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-[#1E3A5F]">{calculateTotalDuration()} days</p>
              <p className="text-xs text-gray-500 mt-1">Total sequence duration</p>
            </div>
            <div className="h-8 w-px bg-gray-200"></div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-[#0EA5E9]">78%</p>
              <p className="text-xs text-gray-500 mt-1">Estimated completion rate</p>
            </div>
          </div>
        </Card>

        {/* SECTION 3: Sequence Settings */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Delivery Settings</h2>
          
          <div className="space-y-6">
            {/* Send Window */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Send Window
              </Label>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Send emails between</span>
                <Input
                  type="time"
                  value={sendWindowStart}
                  onChange={(e) => setSendWindowStart(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-gray-600">and</span>
                <Input
                  type="time"
                  value={sendWindowEnd}
                  onChange={(e) => setSendWindowEnd(e.target.value)}
                  className="w-32"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Emails will only be sent during this window in the recipient's timezone
              </p>
            </div>

            {/* Skip Weekends */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-gray-700">Skip weekends when calculating delays</Label>
              </div>
              <button
                onClick={() => setSkipWeekends(!skipWeekends)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  skipWeekends ? 'bg-[#0EA5E9]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    skipWeekends ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Unsubscribe Handling */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-3 block">
                Unsubscribe Handling
              </Label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="unsubscribe"
                    value="stop-immediately"
                    checked={unsubscribeHandling === 'stop-immediately'}
                    onChange={(e) => setUnsubscribeHandling(e.target.value)}
                    className="w-4 h-4 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm text-gray-700">Stop sequence immediately</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="unsubscribe"
                    value="complete-current"
                    checked={unsubscribeHandling === 'complete-current'}
                    onChange={(e) => setUnsubscribeHandling(e.target.value)}
                    className="w-4 h-4 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm text-gray-700">Complete current step, then stop</span>
                </label>
              </div>
            </div>

            {/* Sender Info */}
            <div className="pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <Label htmlFor="senderName" className="text-sm font-medium text-gray-700 mb-2 block">
                    Sender Name
                  </Label>
                  <Input
                    id="senderName"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="senderEmail" className="text-sm font-medium text-gray-700 mb-2 block">
                    Sender Email
                  </Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="replyTo" className="text-sm font-medium text-gray-700 mb-2 block">
                    Reply-To
                  </Label>
                  <Input
                    id="replyTo"
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 pb-8">
          <p className="text-sm text-gray-600 max-w-md">
            Activating will begin sending to leads matching your trigger. You can pause at any time.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Save as Draft
            </Button>
            <Button
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-8"
              onClick={handleActivate}
            >
              Activate Sequence
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}