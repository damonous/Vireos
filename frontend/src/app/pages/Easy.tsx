import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sparkles, LayoutGrid, Plus, FileText, LogOut, Settings, Shield, BarChart3, ArrowUp, Pencil, SlidersHorizontal, Bird, ChevronDown, RefreshCw, Search } from 'lucide-react';

const conversations = [
  { id: 1, title: 'Retirement planning content', time: '2m ago', active: true },
  { id: 2, title: 'Q1 analytics review', time: '1h ago', active: false },
  { id: 3, title: 'LinkedIn campaign setup', time: 'Yesterday', active: false },
  { id: 4, title: 'New prospect search', time: '2d ago', active: false },
  { id: 5, title: 'Email sequence for leads', time: '3d ago', active: false },
];

// Conversation data with messages
const conversationData: Record<number, any[]> = {
  1: [
    {
      type: 'user',
      text: 'Create a blog post about retirement planning strategies for millennials',
      time: '2:34 PM'
    },
    {
      type: 'assistant',
      text: "I've created a draft blog post about retirement planning strategies for millennials. The content covers 401(k) optimization, Roth IRA benefits, and index fund investing — all with FINRA-compliant language.",
      time: '2:34 PM',
      actionCard: {
        icon: FileText,
        iconColor: 'bg-[#0EA5E9]',
        title: 'Draft Created: Retirement Planning for Millennials',
        description: 'Blog post · Ready for review · 1,247 words'
      }
    },
    {
      type: 'user',
      text: 'Now submit it for compliance review',
      time: '2:35 PM'
    },
    {
      type: 'assistant',
      text: "Done! I've submitted the retirement planning draft for compliance review. Your compliance officer will be notified to review it.",
      time: '2:35 PM',
      actionCard: {
        icon: Shield,
        iconColor: 'bg-[#8B5CF6]',
        title: 'Submitted for Review: Retirement Planning for Millennials',
        description: 'Compliance review · Pending approval · Submitted just now'
      }
    },
    {
      type: 'user',
      text: 'How are my LinkedIn campaigns performing this quarter?',
      time: '2:36 PM'
    },
    {
      type: 'assistant',
      text: "Here's your LinkedIn campaign performance for Q1 2026. Your 'Financial Planning Tips' campaign is your top performer with a 4.2% engagement rate.",
      time: '2:36 PM',
      actionCard: {
        icon: BarChart3,
        iconColor: 'bg-[#3B82F6]',
        title: 'Q1 LinkedIn Analytics',
        description: '3 active campaigns · 12,847 impressions · 4.2% avg engagement'
      }
    }
  ],
  2: [
    {
      type: 'user',
      text: 'Show me my Q1 2026 analytics overview',
      time: '1:22 PM'
    },
    {
      type: 'assistant',
      text: "Here's your Q1 2026 performance summary. You've seen strong growth across all channels this quarter.",
      time: '1:22 PM',
      actionCard: {
        icon: BarChart3,
        iconColor: 'bg-[#3B82F6]',
        title: 'Q1 2026 Analytics Overview',
        description: 'Total reach: 48,200 · 47 posts published · 6.8% engagement · 124 leads'
      }
    },
    {
      type: 'user',
      text: 'Which platform is driving the most leads?',
      time: '1:23 PM'
    },
    {
      type: 'assistant',
      text: "LinkedIn is your top lead source at 45%, followed by Facebook at 28%. Your '401k Rollover' post on LinkedIn alone generated 18 leads.",
      time: '1:23 PM',
      actionCard: {
        icon: BarChart3,
        iconColor: 'bg-[#3B82F6]',
        title: 'Lead Source Breakdown',
        description: 'LinkedIn 45% · Facebook 28% · Email 18% · Referral 9%'
      }
    }
  ],
  3: [
    {
      type: 'user',
      text: 'Create a LinkedIn outreach campaign for CPAs in the Dallas area',
      time: 'Yesterday'
    },
    {
      type: 'assistant',
      text: "I've created a new LinkedIn campaign targeting CPAs in Dallas. The campaign includes a 3-step sequence: connection request, intro message after 2 days, and follow-up after 5 days.",
      time: 'Yesterday',
      actionCard: {
        icon: FileText,
        iconColor: 'bg-[#10B981]',
        title: 'LinkedIn Campaign Created: Dallas CPA Outreach',
        description: '3-step sequence · 25/day limit · Ready to activate'
      }
    },
    {
      type: 'user',
      text: 'Activate it',
      time: 'Yesterday'
    },
    {
      type: 'assistant',
      text: "Done! The Dallas CPA Outreach campaign is now active. It will start sending connection requests tomorrow morning within your daily limit of 25.",
      time: 'Yesterday',
      actionCard: {
        icon: FileText,
        iconColor: 'bg-[#10B981]',
        title: 'Campaign Activated: Dallas CPA Outreach',
        description: 'Active · Sending starts tomorrow · 25/day limit'
      }
    }
  ],
  4: [
    {
      type: 'user',
      text: 'Find 50 financial planning prospects in Austin, TX with over $500K in assets',
      time: '2 days ago'
    },
    {
      type: 'assistant',
      text: "I've submitted a prospect search request for 50 prospects in Austin, TX matching your criteria. The search is being processed and typically completes within a few minutes.",
      time: '2 days ago',
      actionCard: {
        icon: Search,
        iconColor: 'bg-[#0EA5E9]',
        title: 'Prospect Search Submitted',
        description: '50 prospects · Austin, TX · $500K+ assets · Processing'
      }
    }
  ],
  5: [
    {
      type: 'user',
      text: 'Create a 4-email welcome sequence for new leads from Facebook ads',
      time: '3 days ago'
    },
    {
      type: 'assistant',
      text: "I've created a welcome email sequence for your Facebook ad leads. The sequence includes: Welcome email (immediate), Value proposition (day 2), Case study (day 5), and Consultation invite (day 8).",
      time: '3 days ago',
      actionCard: {
        icon: FileText,
        iconColor: 'bg-[#8B5CF6]',
        title: 'Email Sequence Created: FB Lead Welcome',
        description: '4 emails · Trigger: Facebook ad lead · Draft'
      }
    },
    {
      type: 'user',
      text: 'Enroll all my new Facebook leads from this week',
      time: '3 days ago'
    },
    {
      type: 'assistant',
      text: "I've enrolled 12 new Facebook leads from this week into the welcome sequence. They'll receive the first email within the hour.",
      time: '3 days ago',
      actionCard: {
        icon: FileText,
        iconColor: 'bg-[#8B5CF6]',
        title: 'Leads Enrolled: FB Lead Welcome',
        description: '12 leads enrolled · First email sending shortly'
      }
    }
  ]
};

export default function Easy() {
  const navigate = useNavigate();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'dashboard'>('chat');
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  const handleSignOut = () => {
    localStorage.removeItem('vireos_role');
    localStorage.removeItem('vireos_user_name');
    localStorage.removeItem('vireos_user_initials');
    navigate('/login');
  };

  const handleNewChat = () => {
    setShowEmptyState(true);
    setInputValue('');
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      // In a real app, this would send the message
      console.log('Sending message:', inputValue);
      setInputValue('');
      setShowEmptyState(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (text: string) => {
    setInputValue(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleConversationClick = (conversationId: number) => {
    setActiveConversationId(conversationId);
    setShowEmptyState(false);
  };

  // Get current conversation messages
  const currentMessages = conversationData[activeConversationId] || [];

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* LEFT RAIL - Matching Boss Mode Sidebar */}
      <div className="w-64 bg-[#1E3A5F] h-screen flex flex-col">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
            <Bird className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-semibold">Vireos</span>
        </div>

        {/* Easy/Boss Mode Toggle */}
        <div className="bg-[#1a334d]/50 rounded-full p-0.5 mx-3 mb-4 flex">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors bg-[#152d44] text-white font-medium"
          >
            <Sparkles className="w-3 h-3" />
            <span>Easy</span>
          </button>
          <button
            onClick={() => navigate('/home')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors text-gray-400 hover:text-gray-300"
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Boss</span>
          </button>
        </div>

        {/* Middle Section - New Chat, Search, and Conversations */}
        <div className="flex-1 px-3 py-2 overflow-y-auto">
          {/* New Chat Button with Search Icon */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleNewChat}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center bg-[#2B4A6F] text-gray-300 rounded-lg hover:bg-[#354d6f] transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Conversations Label */}
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
            Conversations
          </div>

          {/* Conversation List */}
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleConversationClick(conv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  activeConversationId === conv.id
                    ? 'bg-[#0EA5E9] text-white'
                    : 'text-gray-300 hover:bg-[#2B4A6F] hover:text-white'
                }`}
              >
                <div className="text-sm font-medium truncate">
                  {conv.title}
                </div>
                <div className={`text-xs mt-0.5 ${
                  activeConversationId === conv.id ? 'text-gray-200' : 'text-gray-500'
                }`}>{conv.time}</div>
              </button>
            ))}
          </div>
        </div>

        {/* User Profile with Dropdown - Matching Boss Mode */}
        <div className="p-4 border-t border-[#2B4A6F] relative" ref={dropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-3 w-full hover:bg-[#2B4A6F] p-2 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium">
              SM
            </div>
            <div className="flex-1 text-left">
              <div className="text-white text-sm font-medium">Sarah Mitchell</div>
              <div className="text-gray-400 text-xs">Advisor · Pinnacle Financial</div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showUserDropdown && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  navigate('/settings');
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                View Profile
              </button>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  navigate('/login');
                }}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Switch Role
              </button>
              <div className="border-t border-gray-200 my-1"></div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[#1E3A5F]">Vireos AI</span>
            <Sparkles className="w-4 h-4 text-[#0EA5E9]" />
            <span className="text-sm text-gray-500">Your marketing assistant</span>
          </div>
          <button
            onClick={handleNewChat}
            className="text-sm font-medium text-[#0EA5E9] hover:text-[#0284C7] transition-colors"
          >
            New Chat
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {showEmptyState ? (
            /* Empty Chat State */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-2xl mx-auto px-4">
                <Sparkles className="w-12 h-12 text-indigo-400 mx-auto" />
                <h2 className="text-xl font-semibold text-gray-800 mt-3">
                  How can I help you today?
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  I can help you create content, manage leads, run campaigns, and more.
                </p>

                {/* Quick Action Chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  <button
                    onClick={() => handleQuickAction('Create marketing content')}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  >
                    Create marketing content
                  </button>
                  <button
                    onClick={() => handleQuickAction('Find new prospects')}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                  >
                    Find new prospects
                  </button>
                  <button
                    onClick={() => handleQuickAction('View my analytics')}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    View my analytics
                  </button>
                  <button
                    onClick={() => handleQuickAction('Manage my leads')}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    Manage my leads
                  </button>
                  <button
                    onClick={() => handleQuickAction('Start a campaign')}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    Start a campaign
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 pb-6">
              {currentMessages.map((message, index) => (
                message.type === 'user' ? (
                  /* User Message */
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[70%]">
                      <div className="bg-[#6366F1] text-white rounded-2xl rounded-br-sm px-4 py-3">
                        <p className="text-sm">{message.text}</p>
                      </div>
                      <div className="text-xs text-gray-400 text-right mt-1">{message.time}</div>
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div key={index} className="flex gap-3 max-w-[70%]">
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white text-xs font-bold">
                      V
                    </div>
                   
                    {/* Message Content */}
                    <div className="flex-1">
                      <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200 px-4 py-3">
                        <p className="text-sm text-gray-900 leading-relaxed">
                          {message.text}
                        </p>

                        {/* Action Card (if present) */}
                        {message.actionCard && (() => {
                          const ActionIcon = message.actionCard.icon;
                          return (
                            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                              {/* Icon */}
                              <div className={`flex-shrink-0 w-9 h-9 rounded-full ${message.actionCard.iconColor} flex items-center justify-center`}>
                                <ActionIcon className="w-4 h-4 text-white" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-gray-900">
                                  {message.actionCard.title}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {message.actionCard.description}
                                </div>
                              </div>

                              {/* Action Button */}
                              <button
                                onClick={() => navigate('/home')}
                                className="flex-shrink-0 text-xs text-[#0EA5E9] hover:text-[#0284C7] whitespace-nowrap font-medium transition-colors"
                              >
                                View in Boss Mode →
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{message.time}</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 px-6 py-3">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 resize-none text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]"
              placeholder="Ask Vireos AI to help with your marketing..."
              style={{ maxHeight: '120px' }}
            />
            {inputValue.trim() && (
              <button
                onClick={handleSend}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#0EA5E9] rounded-full flex items-center justify-center hover:bg-[#0284C7] transition-colors"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400 text-center mt-1">
            Vireos AI can make mistakes. Always review content for compliance.
          </div>
        </div>
      </div>
    </div>
  );
}