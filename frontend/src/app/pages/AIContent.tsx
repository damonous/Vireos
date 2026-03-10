import { useState } from 'react';
import { Bell, Sparkles, AlertTriangle, Info, Linkedin, Facebook, Mail, Megaphone } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

type Platform = 'linkedin' | 'facebook' | 'email' | 'ad-copy';

export default function AIContent() {
  const [topic, setTopic] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['linkedin']);
  const [tone, setTone] = useState('educational');
  const [generated, setGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<Platform>('linkedin');

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setGenerated(true);
      setIsGenerating(false);
      // Set active preview tab to first selected platform
      if (selectedPlatforms.length > 0) {
        setActivePreviewTab(selectedPlatforms[0]);
      }
    }, 1200);
  };

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const handleSelectAll = () => {
    const allPlatforms: Platform[] = ['linkedin', 'facebook', 'email', 'ad-copy'];
    if (selectedPlatforms.length === allPlatforms.length) {
      // Deselect all
      setSelectedPlatforms([]);
    } else {
      // Select all
      setSelectedPlatforms(allPlatforms);
    }
  };

  const isSelectAllIndeterminate = selectedPlatforms.length > 0 && selectedPlatforms.length < 4;

  const platformsData = [
    { id: 'linkedin' as Platform, name: 'LinkedIn', icon: Linkedin },
    { id: 'facebook' as Platform, name: 'Facebook', icon: Facebook },
    { id: 'email' as Platform, name: 'Email', icon: Mail },
    { id: 'ad-copy' as Platform, name: 'Ad Copy', icon: Megaphone },
  ];

  const sampleContent = {
    linkedin: `🎯 3 Key Retirement Planning Strategies for 2026

As we navigate an evolving financial landscape, it's more important than ever to revisit your retirement strategy. Here are three essential considerations:

1️⃣ Maximize Your Tax-Advantaged Accounts
With contribution limits increasing, now is the perfect time to boost your 401(k) and IRA contributions. The power of compound growth over time cannot be understated.

2️⃣ Diversification Remains Critical
Don't put all your eggs in one basket. A well-balanced portfolio across various asset classes can help weather market volatility.

3️⃣ Review Your Asset Allocation
As you move closer to retirement, your risk tolerance naturally shifts. Ensure your portfolio aligns with your timeline and goals.

Want to discuss your personalized retirement strategy? Let's connect.`,
    facebook: `Planning for retirement doesn't have to be overwhelming! 🌟

Here are 3 simple strategies to get you started:
✅ Start early and let time work in your favor
✅ Diversify your investments
✅ Review and adjust regularly

Ready to take control of your financial future? Reach out to learn more about creating a retirement plan that works for you!`,
    email: `Subject: Your Retirement Planning Checklist for 2026

Dear [Client Name],

As we begin a new year, I wanted to share some timely retirement planning strategies that could benefit your financial future.

Key Considerations for 2026:
• Contribution limits for 401(k)s and IRAs have increased
• Market conditions present unique opportunities for rebalancing
• Tax planning strategies should be reviewed annually

I'd love to schedule a brief call to discuss how these strategies might apply to your specific situation.

Best regards,
Sarah Mitchell`,
    'ad-copy': `🌟 Boost Your Retirement Savings with These 3 Simple Strategies

Planning for retirement doesn't have to be complicated. Here are three easy steps to get you started:

1️⃣ Start Early
The sooner you begin saving, the more time your money has to grow. Even small contributions can make a big difference.

2️⃣ Diversify Your Investments
Spread your investments across different asset classes to reduce risk and maximize returns.

3️⃣ Review Regularly
Market conditions change, so it's important to review and adjust your retirement plan annually.

Ready to take the first step towards a secure retirement? Contact us today!`
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">AI Content Generator</h1>
          <p className="text-sm text-gray-500 mt-1">Create compliant marketing content in seconds</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-[#0EA5E9]" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Create New Content</h3>
            </div>

            <div className="space-y-6">
              {/* Topic Input */}
              <div>
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                  What would you like to write about?
                </label>
                <Textarea
                  placeholder="E.g., Tax planning strategies for high-net-worth individuals, Benefits of starting retirement savings early, How to diversify your investment portfolio..."
                  className="min-h-[120px] border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              {/* Platform Selector */}
              <div>
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                  Platforms
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select one or more platforms. Content will be optimized for each.
                </p>
                
                {/* Select All Checkbox */}
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.length === 4}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = isSelectAllIndeterminate;
                      }
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm text-gray-700 font-medium">Select All</span>
                </label>

                {/* Platform Cards */}
                <div className="grid grid-cols-2 gap-3 mb-2">
                  {platformsData.map((platform) => {
                    const Icon = platform.icon;
                    const isSelected = selectedPlatforms.includes(platform.id);
                    
                    return (
                      <label
                        key={platform.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlatform(platform.id)}
                          className="w-4 h-4 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                        />
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#0EA5E9]' : 'text-gray-500'}`} />
                        <span className={`text-sm font-medium ${isSelected ? 'text-[#1E3A5F]' : 'text-gray-700'}`}>
                          {platform.name}
                        </span>
                      </label>
                    );
                  })}
                </div>

                {/* Selection Count */}
                <p className="text-xs text-gray-500 mt-2">
                  {selectedPlatforms.length} of 4 selected
                </p>
              </div>

              {/* Tone Dropdown */}
              <div>
                <label className="block text-sm font-medium text-[#1E3A5F] mb-2">
                  Tone
                </label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="thought-leadership">Thought Leadership</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button 
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                onClick={handleGenerate}
                disabled={isGenerating || selectedPlatforms.length === 0}
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    {selectedPlatforms.length === 0
                      ? 'Select a Platform'
                      : selectedPlatforms.length === 1
                      ? 'Generate Content'
                      : `Generate for ${selectedPlatforms.length} Platforms`}
                  </>
                )}
              </Button>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">AI-Powered & Compliant</p>
                  <p className="text-blue-700">
                    All content is automatically checked for FINRA compliance and includes required disclosures.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Output Preview Panel */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Preview</h3>

            {!generated ? (
              <div className="flex flex-col items-center justify-center h-[500px] text-center px-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 mb-2">Select your platforms and topic, then click Generate Content.</p>
                <p className="text-sm text-gray-400">
                  The AI will create optimized content for each selected platform.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Platform Tabs (if multiple platforms selected) */}
                {selectedPlatforms.length > 1 && (
                  <Tabs value={activePreviewTab} onValueChange={(value) => setActivePreviewTab(value as Platform)}>
                    <TabsList className={`grid w-full ${selectedPlatforms.length === 2 ? 'grid-cols-2' : selectedPlatforms.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                      {selectedPlatforms.map((platformId) => {
                        const platformData = platformsData.find(p => p.id === platformId);
                        if (!platformData) return null;
                        const Icon = platformData.icon;
                        
                        return (
                          <TabsTrigger key={platformId} value={platformId} className="flex items-center gap-1.5">
                            <Icon className="w-4 h-4" />
                            {platformData.name}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                )}

                {/* Generated Content */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 min-h-[280px]">
                  <p className="text-sm text-[#1E3A5F] whitespace-pre-line">
                    {sampleContent[activePreviewTab]}
                  </p>
                </div>

                {/* Compliance Warnings */}
                <div className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h4 className="font-semibold text-red-900">Compliance Warnings</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 font-mono">•</span>
                      <p className="text-red-800">
                        <span className="font-medium">Guarantee language detected:</span> "cannot be understated" - Consider rephrasing to avoid implied guarantees
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-red-600 font-mono">•</span>
                      <p className="text-red-800">
                        <span className="font-medium">Performance implications:</span> "power of compound growth" - Add disclaimer about market volatility
                      </p>
                    </div>
                  </div>
                </div>

                {/* Required Disclosures */}
                <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-blue-900">Required Disclosures</h4>
                  </div>
                  <p className="text-xs text-blue-800">
                    Investment advisory services offered through Pinnacle Financial, a registered investment adviser. 
                    Past performance is not indicative of future results. All investments carry risk, including potential 
                    loss of principal. This content is for informational purposes only and should not be considered 
                    personalized investment advice. Securities offered through XYZ Securities, Member FINRA/SIPC.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-gray-300 text-[#1E3A5F] hover:bg-gray-50">
                    Save Draft
                  </Button>
                  <Button className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
                    Request Approval
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}