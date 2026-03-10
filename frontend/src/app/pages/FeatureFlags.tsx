import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Fragment } from 'react';

interface FeatureFlag {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  override: string;
  lastModified: string;
  modifiedBy: string;
  organizations?: { name: string; enabled: boolean }[];
}

const featureFlags: FeatureFlag[] = [
  {
    id: 1,
    name: 'AI Content Generator',
    description: 'Enable AI-powered content generation',
    enabled: true,
    override: 'All orgs',
    lastModified: 'Feb 20, 2026',
    modifiedBy: 'Platform Admin',
  },
  {
    id: 2,
    name: 'LinkedIn Auto-Outreach',
    description: 'Automated LinkedIn connection campaigns',
    enabled: true,
    override: 'All orgs',
    lastModified: 'Feb 15, 2026',
    modifiedBy: 'Platform Admin',
  },
  {
    id: 3,
    name: 'Facebook Ads Integration',
    description: 'Facebook advertising module',
    enabled: true,
    override: 'All orgs',
    lastModified: 'Jan 30, 2026',
    modifiedBy: 'Platform Admin',
  },
  {
    id: 4,
    name: 'Prospect Finder',
    description: 'B2B prospect data lookup',
    enabled: true,
    override: 'All orgs',
    lastModified: 'Feb 1, 2026',
    modifiedBy: 'Platform Admin',
  },
  {
    id: 5,
    name: 'Email Sequences',
    description: 'Automated email drip campaigns',
    enabled: true,
    override: 'All orgs',
    lastModified: 'Jan 15, 2026',
    modifiedBy: 'Platform Admin',
  },
  {
    id: 6,
    name: 'Advanced Analytics',
    description: 'Enhanced analytics dashboard',
    enabled: false,
    override: 'Beta orgs only',
    lastModified: 'Feb 25, 2026',
    modifiedBy: 'Platform Admin',
    organizations: [
      { name: 'Summit Wealth', enabled: true },
      { name: 'Peak Financial Group', enabled: true },
    ],
  },
  {
    id: 7,
    name: 'White-label Mode',
    description: 'Custom branding for enterprise clients',
    enabled: false,
    override: 'Enterprise only',
    lastModified: 'Feb 10, 2026',
    modifiedBy: 'Platform Admin',
    organizations: [
      { name: 'Summit Wealth', enabled: true },
      { name: 'Peak Financial Group', enabled: true },
    ],
  },
  {
    id: 8,
    name: 'API Access',
    description: 'Public API for integrations',
    enabled: false,
    override: 'None',
    lastModified: '—',
    modifiedBy: '—',
  },
];

export default function FeatureFlags() {
  const [environment, setEnvironment] = useState('Production');
  const [showBanner, setShowBanner] = useState(true);
  const [flags, setFlags] = useState(featureFlags);
  const [expandedFlag, setExpandedFlag] = useState<number | null>(null);

  const activeCount = flags.filter((f) => f.enabled).length;
  const inactiveCount = flags.filter((f) => !f.enabled).length;

  const toggleFlag = (id: number) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Feature Flags</h1>
            <p className="text-sm text-gray-500 mt-1">
              Control feature availability across all organizations. Changes take effect immediately.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Environment:</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] bg-white"
            >
              <option value="Production">Production</option>
              <option value="Staging">Staging</option>
            </select>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium text-gray-700">{environment}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Warning Banner */}
        {showBanner && environment === 'Production' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 flex items-start justify-between">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <p className="text-sm text-yellow-800">
                You are editing Production flags. Changes affect all organizations immediately.
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-yellow-600 hover:text-yellow-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Feature Flags Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flag Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organizations Override
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Modified
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flags.map((flag) => (
                  <Fragment key={flag.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">
                        {flag.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {flag.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleFlag(flag.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            flag.enabled ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              flag.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                        <span className={`ml-3 text-xs font-medium ${flag.enabled ? 'text-[#0EA5E9]' : 'text-gray-500'}`}>
                          {flag.enabled ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="flex flex-col gap-1">
                          <span>{flag.override}</span>
                          {flag.organizations && (
                            <button
                              onClick={() => setExpandedFlag(expandedFlag === flag.id ? null : flag.id)}
                              className="text-xs text-[#0EA5E9] hover:text-[#0284C7] flex items-center gap-1 w-fit"
                            >
                              Manage overrides
                              {expandedFlag === flag.id ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {flag.lastModified}
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {flag.modifiedBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <Button
                          size="sm"
                          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                    {expandedFlag === flag.id && flag.organizations && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 bg-gray-50">
                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
                              Organization-specific overrides:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {flag.organizations.map((org, idx) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center px-3 py-1 rounded text-xs font-medium ${
                                    org.enabled
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {org.name}: {org.enabled ? 'ON' : 'OFF'}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{flags.length} feature flags</span>
              <span className="mx-2">·</span>
              <span className="font-medium">{activeCount} active</span>
              <span className="mx-2">·</span>
              <span className="font-medium">{inactiveCount} inactive</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}