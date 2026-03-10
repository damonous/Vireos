import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Toast } from '../components/ui/toast';

export default function OrgSettings() {
  const [prohibitedTerms, setProhibitedTerms] = useState([
    'guaranteed',
    'promise',
    'risk-free',
    'will double',
    'no risk',
    'certain returns',
    "can't lose",
  ]);
  const [newTerm, setNewTerm] = useState('');
  const [autoFlagSensitivity, setAutoFlagSensitivity] = useState('medium');
  const [requireCompliance, setRequireCompliance] = useState(true);
  const [approvalWorkflow, setApprovalWorkflow] = useState('compliance-required');
  const [showToast, setShowToast] = useState(false);

  const handleSaveChanges = () => {
    setShowToast(true);
  };

  const addProhibitedTerm = () => {
    if (newTerm.trim() && !prohibitedTerms.includes(newTerm.trim().toLowerCase())) {
      setProhibitedTerms([...prohibitedTerms, newTerm.trim().toLowerCase()]);
      setNewTerm('');
    }
  };

  const removeProhibitedTerm = (term: string) => {
    setProhibitedTerms(prohibitedTerms.filter((t) => t !== term));
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Organization Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your organization configuration</p>
        </div>
      </div>

      <div className="p-8 max-w-4xl">
        {/* Organization Profile */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Organization Profile</h2>

          {/* Logo Upload */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Organization Logo</Label>
            <div className="flex items-center gap-6">
              <div className="w-[200px] h-[200px] rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-[#1E3A5F] text-white text-6xl font-semibold">
                PF
              </div>
              <div>
                <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </Button>
                <p className="text-xs text-gray-500 mt-2">Recommended: 200x200px, PNG or JPG</p>
              </div>
            </div>
          </div>

          {/* Organization Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orgName" className="text-sm font-medium text-gray-700 mb-2 block">
                Organization Name
              </Label>
              <Input id="orgName" defaultValue="Pinnacle Financial" className="w-full" />
            </div>
            <div>
              <Label htmlFor="industry" className="text-sm font-medium text-gray-700 mb-2 block">
                Industry
              </Label>
              <select
                id="industry"
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                defaultValue="financial-services"
              >
                <option value="financial-services">Financial Services</option>
                <option value="wealth-management">Wealth Management</option>
                <option value="investment-advisory">Investment Advisory</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="founded" className="text-sm font-medium text-gray-700 mb-2 block">
                Founded
              </Label>
              <Input id="founded" type="number" defaultValue="2008" className="w-full" />
            </div>
            <div>
              <Label htmlFor="website" className="text-sm font-medium text-gray-700 mb-2 block">
                Website
              </Label>
              <Input id="website" defaultValue="pinnaclefinancial.com" className="w-full" />
            </div>
          </div>
        </Card>

        {/* Compliance Settings */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Compliance Settings</h2>

          {/* Prohibited Terms */}
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Prohibited Terms</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {prohibitedTerms.map((term) => (
                <div
                  key={term}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm"
                >
                  <span>"{term}"</span>
                  <button
                    onClick={() => removeProhibitedTerm(term)}
                    className="hover:bg-red-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter a prohibited term"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addProhibitedTerm()}
                className="flex-1"
              />
              <Button
                onClick={addProhibitedTerm}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              >
                Add
              </Button>
            </div>
          </div>

          {/* Required Disclaimer */}
          <div className="mb-6">
            <Label htmlFor="disclaimer" className="text-sm font-medium text-gray-700 mb-2 block">
              Required Disclaimer
            </Label>
            <textarea
              id="disclaimer"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              defaultValue="Past performance is not indicative of future results. Investment products are not FDIC insured."
            />
          </div>

          {/* Auto-flag Sensitivity */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Auto-flag Sensitivity
            </Label>
            <div className="flex gap-2">
              {['low', 'medium', 'high'].map((level) => (
                <Button
                  key={level}
                  onClick={() => setAutoFlagSensitivity(level)}
                  className={
                    autoFlagSensitivity === level
                      ? 'bg-[#0EA5E9] text-white hover:bg-[#0284C7]'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Team Settings */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Team Settings</h2>

          <div className="space-y-6">
            {/* Default Timezone */}
            <div>
              <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 mb-2 block">
                Default Timezone
              </Label>
              <select
                id="timezone"
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                defaultValue="America/New_York"
              >
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                <option value="America/Denver">America/Denver (MST/MDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              </select>
            </div>

            {/* Max Daily LinkedIn Messages */}
            <div>
              <Label htmlFor="maxMessages" className="text-sm font-medium text-gray-700 mb-2 block">
                Max Daily LinkedIn Messages
              </Label>
              <Input id="maxMessages" type="number" defaultValue="100" className="w-full" />
              <p className="text-xs text-gray-500 mt-1">Per advisor limit</p>
            </div>

            {/* Require Compliance Review */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700">Require Compliance Review</Label>
                <p className="text-xs text-gray-500 mt-1">
                  All content must be reviewed before publishing
                </p>
              </div>
              <Switch
                checked={requireCompliance}
                onCheckedChange={setRequireCompliance}
                className="data-[state=checked]:bg-[#0EA5E9]"
              />
            </div>

            {/* Content Approval Workflow */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Content Approval Workflow
              </Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="workflow"
                    value="compliance-required"
                    checked={approvalWorkflow === 'compliance-required'}
                    onChange={(e) => setApprovalWorkflow(e.target.value)}
                    className="w-4 h-4 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm text-gray-700">Compliance review required</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="workflow"
                    value="auto-approve"
                    checked={approvalWorkflow === 'auto-approve'}
                    onChange={(e) => setApprovalWorkflow(e.target.value)}
                    className="w-4 h-4 text-[#0EA5E9] focus:ring-[#0EA5E9]"
                  />
                  <span className="text-sm text-gray-700">Auto-approve</span>
                </label>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11" onClick={handleSaveChanges}>
          Save Changes
        </Button>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          type="success"
          message="Changes saved successfully!"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}