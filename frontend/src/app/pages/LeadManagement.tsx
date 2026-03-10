import { Bell, Linkedin, Facebook, Users as UsersIcon, Plus, MoreVertical, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const kanbanData = {
  'new': [
    { id: 1, name: 'Robert Johnson', company: 'Tech Innovations Inc.', source: 'linkedin', score: 85 },
    { id: 2, name: 'Emily Davis', company: 'Global Consulting', source: 'facebook', score: 72 },
    { id: 3, name: 'James Wilson', company: 'Finance Corp', source: 'referral', score: 90 },
    { id: 4, name: 'Lisa Anderson', company: 'Healthcare Systems', source: 'linkedin', score: 68 },
  ],
  'contacted': [
    { id: 5, name: 'Michael Brown', company: 'Real Estate Partners', source: 'linkedin', score: 78 },
    { id: 6, name: 'Sarah Martinez', company: 'Digital Marketing Co', source: 'facebook', score: 81 },
    { id: 7, name: 'David Thompson', company: 'Manufacturing Ltd', source: 'referral', score: 88 },
    { id: 8, name: 'Jennifer Garcia', company: 'Retail Solutions', source: 'linkedin', score: 75 },
    { id: 9, name: 'William Lee', company: 'Software Systems', source: 'facebook', score: 70 },
    { id: 10, name: 'Amanda White', company: 'Legal Services', source: 'linkedin', score: 83 },
  ],
  'meeting': [
    { id: 11, name: 'Christopher Hall', company: 'Investment Group', source: 'referral', score: 92 },
    { id: 12, name: 'Michelle Young', company: 'Education Trust', source: 'linkedin', score: 87 },
    { id: 13, name: 'Daniel King', company: 'Energy Solutions', source: 'facebook', score: 79 },
  ],
  'proposal': [
    { id: 14, name: 'Jessica Wright', company: 'Biotech Ventures', source: 'linkedin', score: 94 },
    { id: 15, name: 'Thomas Lopez', company: 'Construction Inc', source: 'referral', score: 89 },
  ],
  'closed': [
    { id: 16, name: 'Patricia Hill', company: 'Aerospace Corp', source: 'referral', score: 96 },
  ],
};

const sourceConfig = {
  linkedin: { icon: Linkedin, color: 'bg-blue-100 text-blue-700' },
  facebook: { icon: Facebook, color: 'bg-indigo-100 text-indigo-700' },
  referral: { icon: UsersIcon, color: 'bg-green-100 text-green-700' },
};

const getScoreColor = (score: number) => {
  if (score >= 85) return 'text-green-600 bg-green-100';
  if (score >= 70) return 'text-amber-600 bg-amber-100';
  return 'text-gray-600 bg-gray-100';
};

interface LeadCardProps {
  lead: {
    id: number;
    name: string;
    company: string;
    source: 'linkedin' | 'facebook' | 'referral';
    score: number;
    email?: string;
    phone?: string;
  };
  stage: string;
  onRemove: (leadId: number) => void;
  onViewDetails: (lead: any) => void;
}

function LeadCard({ lead, stage, onRemove, onViewDetails }: LeadCardProps) {
  const SourceIcon = sourceConfig[lead.source].icon;
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [{ isDragging }, dragRef] = useDrag({
    type: 'LEAD',
    item: () => ({ id: lead.id, fromStage: stage }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  
  return (
    <div
      ref={dragRef}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      className="p-4 mb-3 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow bg-white relative cursor-move"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-[#1E3A5F] mb-1">{lead.name}</h4>
          <p className="text-xs text-gray-600">{lead.company}</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${getScoreColor(lead.score)}`}>
          {lead.score}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Badge className={`${sourceConfig[lead.source].color} border-0 text-xs`}>
          <SourceIcon className="w-3 h-3 mr-1" />
          {lead.source === 'referral' ? 'Referral' : lead.source.charAt(0).toUpperCase() + lead.source.slice(1)}
        </Badge>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 top-8 z-20 bg-white shadow-lg rounded-lg border border-gray-200 py-1 min-w-[140px]">
                  <button
                    onClick={() => {
                      onViewDetails(lead);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      onRemove(lead.id);
                      setShowDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  title: string;
  count: number;
  leads: any[];
  color: string;
  stage: string;
  onDrop: (leadId: number, fromStage: string, toStage: string) => void;
  onRemove: (leadId: number) => void;
  onViewDetails: (lead: any) => void;
}

function KanbanColumn({ title, count, leads, color, stage, onDrop, onRemove, onViewDetails }: KanbanColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'LEAD',
    drop: (item: { id: number; fromStage: string }) => {
      if (item.fromStage !== stage) {
        onDrop(item.id, item.fromStage, stage);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div className="flex-shrink-0 w-80">
      <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${isOver ? 'ring-2 ring-[#0EA5E9]' : ''}`}>
        <div className={`px-4 py-3 ${color} rounded-t-lg border-b border-gray-200`}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[#1E3A5F]">{title}</h3>
            <Badge className="bg-white text-[#1E3A5F] border-0 font-semibold">
              {count}
            </Badge>
          </div>
        </div>
        <div ref={drop} className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto min-h-[300px]">
          {leads.map((lead) => (
            <LeadCard 
              key={`${stage}-${lead.id}`}
              lead={lead} 
              stage={stage}
              onRemove={onRemove}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LeadManagement() {
  const [leads, setLeads] = useState(kanbanData);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', company: '', email: '', phone: '', stage: 'new' });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [viewingLead, setViewingLead] = useState<any>(null);

  const stageOrder = ['new', 'contacted', 'meeting', 'proposal', 'closed'];
  
  const handleAddLead = () => {
    const newLeadData = {
      id: Date.now(),
      name: newLead.name,
      company: newLead.company,
      email: newLead.email,
      phone: newLead.phone,
      source: 'linkedin' as const,
      score: Math.floor(Math.random() * 30) + 70,
    };
    
    setLeads(prev => ({
      ...prev,
      [newLead.stage]: [...prev[newLead.stage as keyof typeof prev], newLeadData]
    }));
    
    setToastMessage('Lead added!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowAddModal(false);
    setNewLead({ name: '', company: '', email: '', phone: '', stage: 'new' });
  };

  const handleDropLead = (leadId: number, fromStage: string, toStage: string) => {
    const lead = leads[fromStage as keyof typeof leads].find((l: any) => l.id === leadId);
    
    if (!lead) return;
    
    // Check if moving to "closed" stage to show celebration
    if (toStage === 'closed' && fromStage !== 'closed') {
      setToastMessage('🎉 Won!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    
    setLeads(prev => ({
      ...prev,
      [fromStage]: prev[fromStage as keyof typeof prev].filter((l: any) => l.id !== leadId),
      [toStage]: [...prev[toStage as keyof typeof prev], lead]
    }));
  };

  const handleRemoveLead = (leadId: number) => {
    const stage = stageOrder.find(s => 
      leads[s as keyof typeof leads].some((l: any) => l.id === leadId)
    );
    
    if (!stage) return;
    
    setLeads(prev => ({
      ...prev,
      [stage]: prev[stage as keyof typeof prev].filter((l: any) => l.id !== leadId)
    }));
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Lead Management</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage your prospect pipeline</p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Add Lead Modal */}
        {showAddModal && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-[#1E3A5F]">Add Lead</h2>
                <button onClick={() => setShowAddModal(false)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                  <Input
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    placeholder="Enter lead name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Company</label>
                  <Input
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <Input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <Input
                    type="tel"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Stage</label>
                  <select
                    value={newLead.stage}
                    onChange={(e) => setNewLead({ ...newLead, stage: e.target.value })}
                    className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                  >
                    <option value="new">New Lead</option>
                    <option value="contacted">Contacted</option>
                    <option value="meeting">Meeting Set</option>
                    <option value="proposal">Proposal</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <Button
                  className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                  onClick={handleAddLead}
                  disabled={!newLead.name || !newLead.company}
                >
                  Add Lead
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Details Modal */}
        {viewingLead && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4"
            onClick={() => setViewingLead(null)}
          >
            <div 
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-[#1E3A5F]">Lead Details</h2>
                <button onClick={() => setViewingLead(null)}>
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p className="text-[#1E3A5F] font-medium">{viewingLead.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Company</label>
                  <p className="text-[#1E3A5F] font-medium">{viewingLead.company}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="text-[#1E3A5F] font-medium">{viewingLead.email || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Phone</label>
                  <p className="text-[#1E3A5F] font-medium">{viewingLead.phone || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Lead Score</label>
                  <p className="text-[#1E3A5F] font-medium">{viewingLead.score}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Source</label>
                  <p className="text-[#1E3A5F] font-medium capitalize">{viewingLead.source}</p>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <Button
                  className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                  onClick={() => setViewingLead(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {showToast && (
          <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            {toastMessage}
          </div>
        )}

        {/* Pipeline Stats */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Total Leads</p>
              <p className="text-2xl font-semibold text-[#1E3A5F]">16</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Conversion Rate</p>
              <p className="text-2xl font-semibold text-green-600">23%</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Avg Deal Size</p>
              <p className="text-2xl font-semibold text-[#1E3A5F]">$127K</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Pipeline Value</p>
              <p className="text-2xl font-semibold text-[#0EA5E9]">$2.3M</p>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-8">
          <div className="flex gap-6 overflow-x-auto pb-4">
            <KanbanColumn
              title="New Lead"
              count={leads.new.length}
              leads={leads.new}
              color="bg-gray-50"
              stage="new"
              onDrop={handleDropLead}
              onRemove={handleRemoveLead}
              onViewDetails={setViewingLead}
            />
            <KanbanColumn
              title="Contacted"
              count={leads.contacted.length}
              leads={leads.contacted}
              color="bg-blue-50"
              stage="contacted"
              onDrop={handleDropLead}
              onRemove={handleRemoveLead}
              onViewDetails={setViewingLead}
            />
            <KanbanColumn
              title="Meeting Set"
              count={leads.meeting.length}
              leads={leads.meeting}
              color="bg-purple-50"
              stage="meeting"
              onDrop={handleDropLead}
              onRemove={handleRemoveLead}
              onViewDetails={setViewingLead}
            />
            <KanbanColumn
              title="Proposal"
              count={leads.proposal.length}
              leads={leads.proposal}
              color="bg-amber-50"
              stage="proposal"
              onDrop={handleDropLead}
              onRemove={handleRemoveLead}
              onViewDetails={setViewingLead}
            />
            <KanbanColumn
              title="Closed Won"
              count={leads.closed.length}
              leads={leads.closed}
              color="bg-green-50"
              stage="closed"
              onDrop={handleDropLead}
              onRemove={handleRemoveLead}
              onViewDetails={setViewingLead}
            />
          </div>
        </div>
      </div>
    </DndProvider>
  );
}