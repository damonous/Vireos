import { useNavigate } from 'react-router';
import { CheckCircle, Circle, Clock, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function FacebookSubmitted() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-[#0EA5E9] rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-semibold text-[#1E3A5F] text-center mb-3">
            Ad Submitted for Review!
          </h1>
          <p className="text-gray-600 text-center mb-10 max-w-xl mx-auto">
            Your Facebook ad campaign <span className="font-semibold text-[#1E3A5F]">'Retirement Planning Free Consultation'</span> has been submitted to your compliance officer for review.
          </p>

          {/* Status Timeline */}
          <Card className="p-8 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="space-y-8">
              {/* Step 1: Submitted */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-[#0EA5E9] rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-semibold text-[#1E3A5F] mb-1">Submitted for Review</div>
                  <div className="text-sm text-gray-500">Just now</div>
                </div>
              </div>

              {/* Connector Line */}
              <div className="ml-5 -my-6 border-l-2 border-dashed border-gray-300 h-8"></div>

              {/* Step 2: Compliance Review */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 border-2 border-[#0EA5E9] rounded-full flex items-center justify-center bg-white relative">
                  <div className="w-3 h-3 bg-[#0EA5E9] rounded-full animate-pulse"></div>
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-semibold text-[#1E3A5F] mb-1">Compliance Review</div>
                  <div className="text-sm text-gray-500">Pending review by compliance officer</div>
                </div>
              </div>

              {/* Connector Line */}
              <div className="ml-5 -my-6 border-l-2 border-dashed border-gray-300 h-8"></div>

              {/* Step 3: Ad Goes Live */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 border-2 border-gray-300 rounded-full flex items-center justify-center bg-white">
                  <Circle className="w-6 h-6 text-gray-300" />
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-semibold text-gray-400 mb-1">Ad Goes Live</div>
                  <div className="text-sm text-gray-500">Automatically published after approval</div>
                </div>
              </div>
            </div>
          </Card>

          {/* What Happens Next Card */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200 bg-blue-50 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#1E3A5F] mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                    <span>Your compliance officer will review the ad for FINRA compliance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                    <span>You'll receive a notification when it's approved or if changes are needed</span>
                  </li>
                  <li className="flex items-start">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                    <span>Once approved, the ad will automatically launch on Facebook</span>
                  </li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate('/facebook-campaign-detail')}
                className="border-[#0EA5E9] text-[#0EA5E9] hover:bg-blue-50"
              >
                View Campaign
              </Button>
              <Button
                onClick={() => navigate('/facebook-wizard')}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              >
                Create Another Ad
              </Button>
            </div>
            <button
              onClick={() => navigate('/facebook')}
              className="text-sm text-gray-600 hover:text-[#1E3A5F] transition-colors"
            >
              Back to Facebook Ads
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
