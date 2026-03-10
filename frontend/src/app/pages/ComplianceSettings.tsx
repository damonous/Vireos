import { useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Toast } from '../components/ui/toast';

export default function ComplianceSettings() {
  const [prohibitedTerms, setProhibitedTerms] = useState([
    'guaranteed',
    'promise',
    'risk-free',
    'will double',
    'no risk',
    'certain returns',
    "can't lose",
    'zero risk',
  ]);
  const [newTerm, setNewTerm] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [notifyOnFlag, setNotifyOnFlag] = useState(true);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure compliance rules and preferences</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-8 max-w-4xl">
        {/* Prohibited Terms */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">Prohibited Terms</h2>
          <p className="text-sm text-gray-600 mb-4">
            Content containing these terms will be automatically flagged for review
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
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
              placeholder="Enter term..."
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addProhibitedTerm()}
              className="flex-1"
            />
            <Button
              onClick={addProhibitedTerm}
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </Card>

        {/* Required Disclaimers */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">Required Disclaimers</h2>
          <p className="text-sm text-gray-600 mb-4">
            These disclaimers must appear in all published content
          </p>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium text-gray-700">Disclaimer 1 (Default)</Label>
              <span className="text-xs text-gray-500">Required</span>
            </div>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
              defaultValue="Past performance is not indicative of future results. Investment products are not FDIC insured."
            />
          </div>

          <Button className="bg-white text-[#0EA5E9] border-2 border-[#0EA5E9] hover:bg-blue-50">
            <Plus className="w-4 h-4 mr-2" />
            Add Disclaimer
          </Button>
        </Card>

        {/* Review Workflow */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Review Workflow</h2>

          <div className="space-y-6">
            {/* Auto-approve threshold */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Auto-approve content with no flagged terms
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Skip manual review for content without compliance issues
                </p>
              </div>
              <Switch
                checked={autoApprove}
                onCheckedChange={setAutoApprove}
                className="data-[state=checked]:bg-[#0EA5E9]"
              />
            </div>

            {/* Notify on flag */}
            <div className="flex items-center justify-between py-2">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Notify on flagged content
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Receive an email notification when content is flagged
                </p>
              </div>
              <Switch
                checked={notifyOnFlag}
                onCheckedChange={setNotifyOnFlag}
                className="data-[state=checked]:bg-[#0EA5E9]"
              />
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