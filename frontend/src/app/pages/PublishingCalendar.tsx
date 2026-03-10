import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Linkedin, Facebook, Mail, ChevronDown, ChevronUp, CalendarClock, X, Info, Repeat } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';

const posts = [
  { id: 1, date: 4, platform: 'linkedin', title: 'Tax Planning Strategies for 2026', status: 'published', time: '09:00 AM' },
  { id: 2, date: 7, platform: 'facebook', title: 'Understanding 401(k) Rollovers', status: 'scheduled', time: '02:00 PM' },
  { id: 3, date: 11, platform: 'linkedin', title: 'Estate Planning Basics', status: 'scheduled', time: '10:30 AM' },
  { id: 4, date: 14, platform: 'facebook', title: 'Market Update Q1 2026', status: 'scheduled', time: '03:00 PM' },
  { id: 5, date: 18, platform: 'linkedin', title: 'Retirement Income Strategies', status: 'draft', time: '11:00 AM' },
  { id: 6, date: 21, platform: 'linkedin', title: 'Social Security Optimization', status: 'scheduled', time: '09:30 AM' },
  { id: 7, date: 25, platform: 'facebook', title: 'Investment Portfolio Review', status: 'scheduled', time: '01:00 PM' },
  { id: 8, date: 27, platform: 'linkedin', title: 'Year-End Tax Tips', status: 'draft', time: '10:00 AM' },
  { id: 9, date: 28, platform: 'linkedin', title: 'Financial Planning Checklist', status: 'scheduled', time: '02:30 PM' },
];

const upcomingPosts = [
  { id: 1, title: 'Understanding 401(k) Rollovers', platform: 'facebook', time: 'Feb 7, 2:00 PM', status: 'scheduled' },
  { id: 2, title: 'Estate Planning Basics', platform: 'linkedin', time: 'Feb 11, 10:30 AM', status: 'scheduled' },
  { id: 3, title: 'Market Update Q1 2026', platform: 'facebook', time: 'Feb 14, 3:00 PM', status: 'scheduled' },
  { id: 4, title: 'Social Security Optimization', platform: 'linkedin', time: 'Feb 21, 9:30 AM', status: 'scheduled' },
  { id: 5, title: 'Investment Portfolio Review', platform: 'facebook', time: 'Feb 25, 1:00 PM', status: 'scheduled' },
];

// Available content pieces for scheduling
const availableContent = [
  { id: 1, title: 'Retirement Planning Tips', platform: 'linkedin', status: 'approved' },
  { id: 2, title: 'Tax Season Newsletter', platform: 'email', status: 'approved' },
  { id: 3, title: 'Portfolio Review Webinar', platform: 'facebook', status: 'approved' },
  { id: 4, title: '2026 Market Outlook', platform: 'linkedin', status: 'draft' },
  { id: 5, title: 'Estate Planning Guide', platform: 'email', status: 'approved' },
  { id: 6, title: 'Investment Strategy Update', platform: 'facebook', status: 'approved' },
];

// Time slots for picker
const timeSlots = [
  '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '8:30 AM',
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM'
];

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

export default function PublishingCalendar() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ linkedin: true, facebook: true, email: true });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(1); // February (0-indexed)
  const [currentYear, setCurrentYear] = useState(2026);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [showSchedulingPanel, setShowSchedulingPanel] = useState(false);
  
  // Scheduling form state
  const [selectedContent, setSelectedContent] = useState('');
  const [publishDate, setPublishDate] = useState('2026-02-28');
  const [publishTime, setPublishTime] = useState('10:00 AM');
  const [timezone] = useState('EST');
  const [enableRecurrence, setEnableRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('weekly');
  const [recurrenceEnd, setRecurrenceEnd] = useState('never');
  
  const year = currentYear;
  const month = currentMonth;
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };
  
  const filteredPosts = posts.filter(post => 
    (post.platform === 'linkedin' && filters.linkedin) ||
    (post.platform === 'facebook' && filters.facebook) ||
    (post.platform === 'email' && filters.email)
  );
  
  const getPostsForDay = (day: number) => {
    return filteredPosts.filter(post => post.date === day);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-700 border-green-200';
      case 'scheduled': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'draft': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return <Linkedin className="w-3 h-3 text-[#0A66C2]" />;
      case 'facebook': return <Facebook className="w-3 h-3 text-[#1877F2]" />;
      case 'email': return <Mail className="w-3 h-3 text-gray-600" />;
      default: return null;
    }
  };
  
  const calendarDays = [];
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="min-h-32 bg-gray-50 border border-gray-200"></div>);
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dayPosts = getPostsForDay(day);
    const isToday = day === 27; // Feb 27, 2026 (current date)
    
    calendarDays.push(
      <div key={day} className={`min-h-32 border border-gray-200 p-2 bg-white ${isToday ? 'ring-2 ring-[#0EA5E9]' : ''}`}>
        <div className={`text-sm font-medium mb-2 ${isToday ? 'text-[#0EA5E9]' : 'text-gray-700'}`}>
          {day}
        </div>
        <div className="space-y-1">
          {dayPosts.map(post => (
            <div
              key={post.id}
              className={`text-xs p-1.5 rounded border ${getStatusColor(post.status)} cursor-pointer hover:opacity-80 transition-opacity`}
            >
              <div className="flex items-center gap-1 mb-0.5">
                {getPlatformIcon(post.platform)}
                <span className="font-medium">{post.time.split(' ')[0]}</span>
              </div>
              <div className="truncate">{post.title}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="w-9 h-9 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h1 className="text-2xl font-semibold text-[#1E3A5F] min-w-[200px]">{monthName}</h1>
              <Button variant="outline" size="sm" className="w-9 h-9 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleTodayClick}>Today</Button>
            
            <div className="flex items-center gap-4 ml-6 pl-6 border-l border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={filters.linkedin} 
                  onCheckedChange={(checked) => setFilters({ ...filters, linkedin: !!checked })}
                />
                <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                <span className="text-sm text-gray-700">LinkedIn</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={filters.facebook} 
                  onCheckedChange={(checked) => setFilters({ ...filters, facebook: !!checked })}
                />
                <Facebook className="w-4 h-4 text-[#1877F2]" />
                <span className="text-sm text-gray-700">Facebook</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={filters.email} 
                  onCheckedChange={(checked) => setFilters({ ...filters, email: !!checked })}
                />
                <Mail className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Email</span>
              </label>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'month'
                    ? 'bg-white text-[#1E3A5F] font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-[#1E3A5F] font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Week
              </button>
            </div>
            
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowSchedulingPanel(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Content
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Calendar Grid */}
        <div className="flex-1 p-8">
          <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-gray-50">
              {days.map(day => (
                <div key={day} className="py-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-200">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7">
              {calendarDays}
            </div>
          </Card>
        </div>

        {/* Right Sidebar */}
        {sidebarOpen && (
          <div className="w-80 bg-white border-l border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Upcoming This Week</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-8 h-8 p-0"
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {upcomingPosts.map(post => (
                <Card key={post.id} className="p-3 rounded-lg border border-gray-200 hover:border-[#0EA5E9] transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getPlatformIcon(post.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1E3A5F] truncate">{post.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{post.time}</p>
                      <div className={`inline-block text-xs px-2 py-0.5 rounded mt-2 ${getStatusColor(post.status)}`}>
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
        
        {!sidebarOpen && (
          <div className="border-l border-gray-200">
            <Button 
              variant="ghost" 
              size="sm" 
              className="m-2"
              onClick={() => setSidebarOpen(true)}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Scheduling Panel - Slide out from right */}
      {showSchedulingPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowSchedulingPanel(false)}
          />
          
          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-[500px] bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <CalendarClock className="w-5 h-5 text-[#0EA5E9]" />
                <h2 className="text-xl font-semibold text-[#1E3A5F]">Schedule Content</h2>
              </div>
              <button
                onClick={() => setShowSchedulingPanel(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Content Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Content
                </label>
                <select
                  value={selectedContent}
                  onChange={(e) => setSelectedContent(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                >
                  <option value="">Choose content to schedule...</option>
                  {availableContent.map((content) => (
                    <option key={content.id} value={content.id.toString()}>
                      {content.title} ({content.platform.charAt(0).toUpperCase() + content.platform.slice(1)})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Platform Badge */}
              {selectedContent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Platform
                  </label>
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(availableContent.find(c => c.id.toString() === selectedContent)?.platform || '')}
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 border px-3 py-1">
                      {availableContent.find(c => c.id.toString() === selectedContent)?.platform.charAt(0).toUpperCase() + availableContent.find(c => c.id.toString() === selectedContent)?.platform.slice(1)}
                    </Badge>
                  </div>
                </div>
              )}
              
              {/* Date Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publish Date
                </label>
                <Input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="border-gray-300 focus:border-[#0EA5E9] focus:ring-[#0EA5E9]"
                />
              </div>
              
              {/* Time Picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Publish Time
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={publishTime}
                    onChange={(e) => setPublishTime(e.target.value)}
                    className="flex-1 h-11 rounded-lg border border-gray-300 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                  >
                    {timeSlots.map((time) => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <Badge className="bg-gray-100 text-gray-600 border-gray-300 border px-3 py-1.5">
                    {timezone}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Content will be published at this time in your local timezone
                </p>
              </div>
              
              {/* Optimal Time Suggestion */}
              {selectedContent && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-900">
                        <strong>Suggested: 10:00 AM {timezone}</strong> — Based on your audience's peak engagement times on{' '}
                        {availableContent.find(c => c.id.toString() === selectedContent)?.platform.charAt(0).toUpperCase() + availableContent.find(c => c.id.toString() === selectedContent)?.platform.slice(1)}
                      </p>
                      <button
                        onClick={() => setPublishTime('10:00 AM')}
                        className="text-sm text-[#0EA5E9] font-medium hover:text-[#0284C7] mt-2 transition-colors"
                      >
                        Use Suggested Time
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Recurrence Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Repeat className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Repeat</span>
                  </label>
                  <button
                    onClick={() => setEnableRecurrence(!enableRecurrence)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enableRecurrence ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enableRecurrence ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {enableRecurrence && (
                  <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Frequency
                      </label>
                      <select
                        value={recurrenceType}
                        onChange={(e) => setRecurrenceType(e.target.value)}
                        className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ends
                      </label>
                      <select
                        value={recurrenceEnd}
                        onChange={(e) => setRecurrenceEnd(e.target.value)}
                        className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                      >
                        <option value="never">Never</option>
                        <option value="after">After 5 occurrences</option>
                        <option value="on">On specific date</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  onClick={() => setShowSchedulingPanel(false)}
                  variant="outline"
                  className="flex-1 border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    // Handle scheduling
                    setShowSchedulingPanel(false);
                  }}
                  disabled={!selectedContent}
                  className="flex-1 bg-[#0EA5E9] hover:bg-[#0284C7] text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Schedule
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}