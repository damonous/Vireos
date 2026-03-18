import { CheckCircle2, Clock3, ExternalLink } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignListResponse {
  data: FacebookCampaign[];
}

export default function FacebookSubmitted() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId');
  const campaigns = useApiData<CampaignListResponse>('/facebook/campaigns?page=1&limit=20');
  const campaign = useApiData<FacebookCampaign>(`/facebook/campaigns/${campaignId ?? ''}`, [campaignId], Boolean(campaignId));

  const rows = campaigns.data ?? [];
  const selectedCampaign = campaignId ? campaign.data : rows[0] ?? null;

  if (campaigns.loading || (campaignId ? campaign.loading : false)) {
    return <LoadingState label="Loading campaign submission status..." />;
  }

  if (campaigns.error || (campaignId ? campaign.error : null)) {
    return <ErrorState message={campaigns.error || campaign.error || 'Failed to load Facebook campaign.'} onRetry={() => {
      void campaigns.reload();
      if (campaignId) void campaign.reload();
    }} />;
  }

  if (!selectedCampaign) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        <Card className="p-10 rounded-lg shadow-sm border border-gray-200">
          <EmptyState title="No Facebook campaign found" description="Create a campaign draft before checking its submission status." />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#0EA5E9] text-white">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-4xl font-semibold text-[#1E3A5F]">Campaign Saved</h1>
          <p className="mt-3 text-lg text-gray-600">
            <span className="font-semibold text-[#1E3A5F]">{selectedCampaign.name}</span> has been saved successfully.
          </p>
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-6 h-6 text-[#0EA5E9] mt-0.5" />
              <div>
                <p className="font-semibold text-[#1E3A5F]">Campaign record created</p>
                <p className="text-sm text-gray-500">{new Date(selectedCampaign.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <Clock3 className="w-6 h-6 text-[#0EA5E9] mt-0.5" />
              <div>
                <p className="font-semibold text-[#1E3A5F]">Current status: {selectedCampaign.status}</p>
                <p className="text-sm text-gray-500">Updated {new Date(selectedCampaign.updatedAt).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 bg-blue-50">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">What happens next?</h2>
          <ul className="text-sm text-[#1E3A5F] space-y-2">
            <li>The campaign is currently in "{selectedCampaign.status}" status and will remain so until launched or updated.</li>
            <li>Delivery to Meta requires a connected Facebook account and, if applicable, an approved content draft.</li>
            <li>You can view and manage this campaign from the detail page.</li>
          </ul>
        </Card>

        <div className="flex justify-center">
          <Link to={`/facebook-campaign-detail?campaignId=${selectedCampaign.id}`} className="inline-flex items-center gap-2 rounded-md bg-[#0EA5E9] px-4 py-2 text-sm font-medium text-white hover:bg-[#0284C7]">
            View Campaign Detail
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
