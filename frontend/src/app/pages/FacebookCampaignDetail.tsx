import { useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle, Clock, Circle, ThumbsUp, MessageCircle, Share2, Globe } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

export default function FacebookCampaignDetail() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/facebook')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#1E3A5F] mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Facebook Ads
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F] mb-2">
                Retirement Planning Free Consultation
              </h1>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                  Pending Compliance Review
                </span>
                <span className="text-sm text-gray-500">Created Mar 9, 2026</span>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/facebook-wizard')}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Edit Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Timeline */}
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Campaign Status</h2>
              
              {/* Horizontal Timeline */}
              <div className="relative">
                {/* Progress Bar Background */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200"></div>
                {/* Progress Bar Fill */}
                <div className="absolute top-5 left-0 w-1/4 h-0.5 bg-[#0EA5E9]"></div>

                {/* Timeline Steps */}
                <div className="relative grid grid-cols-4 gap-4">
                  {/* Step 1: Created */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 bg-[#0EA5E9] rounded-full flex items-center justify-center mb-3 z-10">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="font-medium text-sm text-[#1E3A5F] mb-1">Created</div>
                    <div className="text-xs text-gray-500">Mar 9, 2026</div>
                    <div className="text-xs text-gray-500">2:34 PM</div>
                  </div>

                  {/* Step 2: Compliance Review */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 border-2 border-[#0EA5E9] rounded-full flex items-center justify-center bg-white mb-3 z-10">
                      <div className="w-3 h-3 bg-[#0EA5E9] rounded-full animate-pulse"></div>
                    </div>
                    <div className="font-medium text-sm text-[#1E3A5F] mb-1">Compliance Review</div>
                    <div className="text-xs text-gray-500">Waiting for review</div>
                  </div>

                  {/* Step 3: Approved */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white mb-3 z-10">
                      <Circle className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="font-medium text-sm text-gray-400 mb-1">Approved</div>
                    <div className="text-xs text-gray-400">—</div>
                  </div>

                  {/* Step 4: Live */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-10 h-10 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white mb-3 z-10">
                      <Circle className="w-6 h-6 text-gray-300" />
                    </div>
                    <div className="font-medium text-sm text-gray-400 mb-1">Live</div>
                    <div className="text-xs text-gray-400">Scheduled to launch</div>
                    <div className="text-xs text-gray-400">after approval</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Campaign Summary */}
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Campaign Summary</h2>
              
              <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                {/* Campaign Name */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Campaign Name</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Retirement Planning Free Consultation</div>
                </div>

                {/* Objective */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Objective</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Lead Generation</div>
                </div>

                {/* Daily Budget */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Daily Budget</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">$5/day</div>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Duration</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Mar 10 — Apr 9, 2026 (30 days)</div>
                </div>

                {/* Est. Total Spend */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Est. Total Spend</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">$150</div>
                </div>

                {/* Audience */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Audience</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Advantage Audience, Age 45-65+, United States</div>
                </div>

                {/* Platforms */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Platforms</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Facebook Feed</div>
                </div>

                {/* Lead Capture */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Lead Capture</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Facebook Lead Form (4 fields)</div>
                </div>

                {/* Email Follow-up */}
                <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                  <div className="text-sm font-medium text-gray-600">Email Follow-up</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">Welcome to Pinnacle Financial (5 steps)</div>
                </div>

                {/* Ad Variants */}
                <div className="flex items-center justify-between p-4 bg-white">
                  <div className="text-sm font-medium text-gray-600">Ad Variants</div>
                  <div className="text-sm text-[#1E3A5F] font-medium">3</div>
                </div>
              </div>
            </Card>

            {/* Activity Log */}
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Activity Log</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3 pb-4 border-b border-gray-200">
                  <div className="w-2 h-2 bg-[#0EA5E9] rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">
                      Campaign submitted for compliance review by <span className="font-medium text-[#1E3A5F]">Sarah Mitchell</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Mar 9, 2:34 PM</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-gray-300 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-900">Campaign created</div>
                    <div className="text-xs text-gray-500 mt-1">Mar 9, 2:34 PM</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Sidebar - Ad Preview */}
          <div className="lg:col-span-1">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200 sticky top-8">
              <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Ad Preview</h2>
              
              {/* Facebook Post Mockup */}
              <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                {/* Post Header */}
                <div className="p-3 flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    SM
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-900">Sarah Mitchell</div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <span>Sponsored</span>
                      <span>·</span>
                      <Globe className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* Primary Text */}
                <div className="px-3 pb-2">
                  <p className="text-sm text-gray-900 leading-relaxed">
                    If you have an investment portfolio of $500,000 or above, you may be overpaying in fees. Get a free portfolio analysis from our certified financial advisors.
                  </p>
                </div>

                {/* Ad Image */}
                <div className="w-full">
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800"
                    alt="Ad preview"
                    className="w-full h-48 object-cover"
                  />
                </div>

                {/* Ad Content Card */}
                <div className="bg-gray-50 p-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 uppercase mb-1">yourfirm.com</div>
                  <div className="font-semibold text-sm text-gray-900 mb-1">
                    Thinking About Retirement?
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    Click Here To Download Your FREE Guide!
                  </div>
                  <button className="w-full py-2 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-md text-sm transition-colors">
                    Learn More
                  </button>
                </div>

                {/* Post Actions */}
                <div className="px-3 py-2 border-t border-gray-200">
                  <div className="flex items-center justify-between text-gray-500">
                    <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-xs font-medium">Like</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Comment</span>
                    </button>
                    <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                      <Share2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Share</span>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
