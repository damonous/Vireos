import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Sparkles,
  Plus,
  FileText,
  LogOut,
  Settings,
  BarChart3,
  ArrowUp,
  SlidersHorizontal,
  Bird,
  ChevronDown,
  RefreshCw,
  Search,
  Shield,
  MessageSquare,
} from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { LoadingState } from '../components/ui/loading-state';
import type { FrontendRole } from '../types/api';

interface ConversationSummary {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  updatedAt: string;
}

interface ConversationListResponse {
  data: ConversationSummary[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  status: string;
  messages: Message[];
}

interface AgentCommandResult {
  conversationId: string;
  message: string;
}

type ActionCardTone = 'blue' | 'green' | 'purple' | 'teal';

function formatRole(role: FrontendRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'compliance-officer':
      return 'Compliance Officer';
    case 'super-admin':
      return 'Super Admin';
    default:
      return 'Advisor';
  }
}

function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || 'U';
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

function formatClockTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function summarizeConversation(status: string, title: string, messageCount: number): string {
  const label = status.replace(/_/g, ' ');
  return `${label} conversation · ${messageCount} ${messageCount === 1 ? 'message' : 'messages'} · ${title}`;
}

function getAssistantCard(title: string, content: string, status: string): {
  icon: typeof FileText;
  tone: ActionCardTone;
  title: string;
  description: string;
} {
  const haystack = `${title} ${content}`.toLowerCase();

  if (haystack.includes('compliance') || haystack.includes('review') || haystack.includes('approve')) {
    return {
      icon: Shield,
      tone: 'purple',
      title: 'Compliance Workflow Updated',
      description: `${status.replace(/_/g, ' ')} · Review the latest compliance status in Boss Mode`,
    };
  }

  if (haystack.includes('analytics') || haystack.includes('performance') || haystack.includes('report')) {
    return {
      icon: BarChart3,
      tone: 'blue',
      title: 'Analytics Insight Ready',
      description: `${title} · Open the detailed reporting view in Boss Mode`,
    };
  }

  if (haystack.includes('linkedin') || haystack.includes('facebook') || haystack.includes('campaign')) {
    return {
      icon: Sparkles,
      tone: 'green',
      title: 'Campaign Workflow Updated',
      description: `${title} · Continue setup from the full workflow view`,
    };
  }

  return {
    icon: FileText,
    tone: 'teal',
    title: title || 'Draft Updated',
    description: summarizeConversation(status, title || 'Easy Mode conversation', 1),
  };
}

function actionCardToneClasses(tone: ActionCardTone): string {
  switch (tone) {
    case 'green':
      return 'bg-[#10B981]';
    case 'purple':
      return 'bg-[#8B5CF6]';
    case 'teal':
      return 'bg-[#0EA5E9]';
    default:
      return 'bg-[#3B82F6]';
  }
}

const quickActions = [
  { label: 'Create marketing content', value: 'Create marketing content for my firm' },
  { label: 'Find new prospects', value: 'Find new prospects for my advisory firm' },
  { label: 'View my analytics', value: 'Show me my latest marketing analytics' },
  { label: 'Manage my leads', value: 'Help me manage and follow up with my leads' },
  { label: 'Start a campaign', value: 'Start a new marketing campaign for this month' },
];

export default function Easy() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const conversations = useApiData<ConversationListResponse>('/agent/conversations?page=1&limit=20');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApiData<ConversationDetail>(
    `/agent/conversations/${selectedId ?? ''}`,
    [selectedId],
    Boolean(selectedId)
  );
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rows = conversations.data?.data ?? [];
  const filteredRows = useMemo(
    () =>
      rows.filter((conversation) =>
        conversation.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ),
    [rows, searchTerm]
  );

  const activeConversation = rows.find((conversation) => conversation.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && rows.length > 0 && !showEmptyState) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId, showEmptyState]);

  useEffect(() => {
    if (selectedId && !rows.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [inputValue]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail.data?.messages, selectedId, showEmptyState]);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const handleNewChat = () => {
    setSelectedId(null);
    setShowEmptyState(true);
    setInputValue('');
    setSubmitError(null);
  };

  const handleSend = async () => {
    if (!inputValue.trim()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await apiClient.post<AgentCommandResult>('/agent/command', {
        command: inputValue.trim(),
        conversationId: selectedId ?? undefined,
      });

      setInputValue('');
      setShowEmptyState(false);
      await conversations.reload();
      setSelectedId(result.conversationId);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to reach Easy Mode.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAction = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedId(conversationId);
    setShowEmptyState(false);
    setSubmitError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  if (conversations.loading && rows.length === 0) {
    return <LoadingState label="Loading Easy Mode..." />;
  }

  if (conversations.error && rows.length === 0) {
    return <div className="flex h-screen items-center justify-center text-sm text-red-600">{conversations.error}</div>;
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <div className="w-64 bg-[#1E3A5F] h-screen flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
            <Bird className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-xl font-semibold">Vireos</span>
        </div>

        <div className="bg-[#1a334d]/50 rounded-full p-0.5 mx-3 mb-4 flex">
          <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors bg-[#152d44] text-white font-medium">
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

        <div className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleNewChat}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0EA5E9] text-white rounded-lg hover:bg-[#0284C7] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">New Chat</span>
            </button>
            <div className="w-10 h-10 flex items-center justify-center bg-[#2B4A6F] text-gray-300 rounded-lg">
              <Search className="w-4 h-4" />
            </div>
          </div>

          <label className="relative block mb-3">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search conversations"
              className="w-full rounded-lg border border-[#35506f] bg-[#233d5d] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-400 outline-none focus:border-[#0EA5E9]"
            />
          </label>

          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
            Conversations
          </div>

          <div className="space-y-1">
            {filteredRows.length === 0 ? (
              <div className="px-3 py-6 text-sm text-gray-400">
                {searchTerm.trim() ? 'No conversations match your search.' : 'No conversations yet.'}
              </div>
            ) : (
              filteredRows.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                    selectedId === conversation.id && !showEmptyState
                      ? 'bg-[#0EA5E9] text-white'
                      : 'text-gray-300 hover:bg-[#2B4A6F] hover:text-white'
                  }`}
                >
                  <div className="text-sm font-medium truncate">{conversation.title}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      selectedId === conversation.id && !showEmptyState ? 'text-gray-200' : 'text-gray-500'
                    }`}
                  >
                    {formatRelativeTime(conversation.updatedAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#2B4A6F] relative" ref={dropdownRef}>
          <button
            onClick={() => setShowUserDropdown((value) => !value)}
            className="flex items-center gap-3 w-full hover:bg-[#2B4A6F] p-2 rounded-lg transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <div className="flex-1 text-left">
              <div className="text-white text-sm font-medium">
                {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'User'}
              </div>
              <div className="text-gray-400 text-xs">
                {formatRole(user?.role ?? 'advisor')} · {user?.organization?.name ?? 'Organization'}
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>

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
              <div className="border-t border-gray-200 my-1" />
              <button
                onClick={() => void handleSignOut()}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="h-14 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg font-bold text-[#1E3A5F] truncate">Vireos AI</span>
            <Sparkles className="w-4 h-4 text-[#0EA5E9] shrink-0" />
            <span className="text-sm text-gray-500 hidden md:inline">Your marketing assistant</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/home')}
              className="md:hidden text-sm font-medium text-gray-500 hover:text-[#1E3A5F] transition-colors"
            >
              Boss
            </button>
            <button
              onClick={handleNewChat}
              className="text-sm font-medium text-[#0EA5E9] hover:text-[#0284C7] transition-colors"
            >
              New Chat
            </button>
          </div>
        </div>

        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={handleNewChat}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                showEmptyState
                  ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                  : 'bg-sky-50 border-sky-200 text-[#0EA5E9]'
              }`}
            >
              New Chat
            </button>
            {filteredRows.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleConversationClick(conversation.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors ${
                  selectedId === conversation.id && !showEmptyState
                    ? 'bg-[#0EA5E9] border-[#0EA5E9] text-white'
                    : 'bg-white border-gray-200 text-[#1E3A5F]'
                }`}
              >
                {conversation.title}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
          {showEmptyState ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-2xl mx-auto px-4">
                <Sparkles className="w-12 h-12 text-indigo-400 mx-auto" />
                <h2 className="text-xl font-semibold text-gray-800 mt-3">How can I help you today?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  I can help you create content, manage leads, run campaigns, and more.
                </p>

                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {quickActions.map((action, index) => (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        index === 0
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          : index === 1
                            ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
                            : index === 2
                              ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                              : index === 3
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : detail.loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingState label="Loading conversation..." />
            </div>
          ) : detail.error ? (
            <div className="h-full flex items-center justify-center text-sm text-red-600">{detail.error}</div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 pb-6">
              {(detail.data?.messages ?? []).map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] md:max-w-[70%]">
                      <div className="bg-[#6366F1] text-white rounded-2xl rounded-br-sm px-4 py-3">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      <div className="text-xs text-gray-400 text-right mt-1">{formatClockTime(message.createdAt)}</div>
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex gap-3 max-w-[92%] md:max-w-[70%]">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white text-xs font-bold">
                      V
                    </div>

                    <div className="flex-1">
                      <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200 px-4 py-3">
                        <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>

                        {activeConversation ? (
                          (() => {
                            const card = getAssistantCard(
                              activeConversation.title,
                              message.content,
                              activeConversation.status
                            );
                            const CardIcon = card.icon;

                            return (
                              <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                                <div
                                  className={`flex-shrink-0 w-9 h-9 rounded-full ${actionCardToneClasses(card.tone)} flex items-center justify-center`}
                                >
                                  <CardIcon className="w-4 h-4 text-white" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm text-gray-900">{card.title}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">{card.description}</div>
                                </div>

                                <button
                                  onClick={() => navigate('/home')}
                                  className="flex-shrink-0 text-xs text-[#0EA5E9] hover:text-[#0284C7] whitespace-nowrap font-medium transition-colors"
                                >
                                  View in Boss Mode →
                                </button>
                              </div>
                            );
                          })()
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{formatClockTime(message.createdAt)}</div>
                    </div>
                  </div>
                )
              )}

              {!detail.loading && (detail.data?.messages?.length ?? 0) === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-xl mx-auto px-4 py-16">
                    <MessageSquare className="w-12 h-12 text-sky-400 mx-auto" />
                    <h2 className="text-xl font-semibold text-gray-800 mt-3">Start the conversation</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Ask Vireos AI for a draft, campaign, report, or lead-generation workflow.
                    </p>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 px-4 md:px-6 py-3">
          {submitError ? <div className="mb-2 text-sm text-red-600">{submitError}</div> : null}
          {conversations.error && rows.length > 0 ? (
            <div className="mb-2 text-sm text-red-600">{conversations.error}</div>
          ) : null}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 resize-none text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]"
              placeholder="Ask Vireos AI to help with your marketing..."
              style={{ maxHeight: '120px' }}
            />
            {inputValue.trim() ? (
              <button
                onClick={() => void handleSend()}
                disabled={submitting}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[#0EA5E9] rounded-full flex items-center justify-center hover:bg-[#0284C7] transition-colors disabled:opacity-60"
              >
                <ArrowUp className="w-4 h-4 text-white" />
              </button>
            ) : null}
          </div>
          <div className="text-xs text-gray-400 text-center mt-1">
            Vireos AI can make mistakes. Always review content for compliance.
          </div>
        </div>
      </div>
    </div>
  );
}
