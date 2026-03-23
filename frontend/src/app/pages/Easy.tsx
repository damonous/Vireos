import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Loader2,
  Check,
  Wrench,
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

type ConversationListResponse = ConversationSummary[];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface AgentAction {
  id: string;
  functionName: string;
  status: string;
  resultSummary: string | null;
  entityType: string | null;
  entityId: string | null;
  bossModePath: string | null;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  status: string;
  messages: Message[];
  actions: AgentAction[];
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

function deriveBossModePath(action: AgentAction): string {
  if (action.bossModePath) return action.bossModePath;
  const { entityType, entityId } = action;
  if (!entityType) return '/home';
  const map: Record<string, string> = {
    Draft: `/content/drafts/${entityId}`,
    Lead: `/leads/${entityId}`,
    PublishJob: `/publish/jobs/${entityId}`,
    LinkedInCampaign: `/linkedin/campaigns/${entityId}`,
    FacebookAdCampaign: `/facebook/ads/${entityId}`,
    EmailSequence: `/email/sequences/${entityId}`,
    ProspectListRequest: `/prospects/requests/${entityId}`,
  };
  return map[entityType] ?? '/home';
}

function actionIconForEntity(entityType: string | null): typeof FileText {
  if (!entityType) return Sparkles;
  const map: Record<string, typeof FileText> = {
    Draft: FileText,
    Lead: BarChart3,
    PublishJob: ArrowUp,
    LinkedInCampaign: Sparkles,
    FacebookAdCampaign: Sparkles,
    EmailSequence: MessageSquare,
    ProspectListRequest: Search,
    ComplianceReview: Shield,
  };
  return map[entityType] ?? Wrench;
}

function actionToneForEntity(entityType: string | null): ActionCardTone {
  if (!entityType) return 'teal';
  const map: Record<string, ActionCardTone> = {
    Draft: 'teal',
    Lead: 'blue',
    PublishJob: 'green',
    LinkedInCampaign: 'green',
    FacebookAdCampaign: 'green',
    EmailSequence: 'purple',
    ProspectListRequest: 'blue',
    ComplianceReview: 'purple',
  };
  return map[entityType] ?? 'teal';
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

interface StreamingTool {
  id: string;
  name: string;
  status: 'running' | 'complete';
  summary?: string;
}

function humanizeToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.filter(Boolean).map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      return (
        <a
          key={`inline-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[#0EA5E9] underline underline-offset-2 break-all"
        >
          {label}
        </a>
      );
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`inline-${index}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`inline-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`inline-${index}`}>{part.slice(1, -1)}</em>;
    }

    return <Fragment key={`inline-${index}`}>{part}</Fragment>;
  });
}

function renderMarkdownParagraph(text: string, key: string): ReactNode {
  const lines = text.split('\n');

  return (
    <p key={key} className="text-sm text-gray-900 leading-6 whitespace-pre-wrap">
      {lines.map((line, index) => (
        <Fragment key={`${key}-line-${index}`}>
          {renderInlineMarkdown(line)}
          {index < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </p>
  );
}

function renderMarkdown(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const fencePattern = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIndex = 0;

  const pushTextBlock = (text: string) => {
    const chunks = text
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    chunks.forEach((chunk) => {
      const headingMatch = chunk.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        const className =
          level === 1
            ? 'text-lg font-semibold text-gray-900'
            : level === 2
              ? 'text-base font-semibold text-gray-900'
              : 'text-sm font-semibold text-gray-900';

        nodes.push(
          <div key={`md-${keyIndex++}`} className={className}>
            {renderInlineMarkdown(title)}
          </div>
        );
        return;
      }

      const unorderedItems = chunk
        .split('\n')
        .map((line) => line.match(/^[-*]\s+(.+)$/)?.[1] ?? null);
      if (unorderedItems.every(Boolean)) {
        nodes.push(
          <ul key={`md-${keyIndex++}`} className="list-disc pl-5 space-y-1 text-sm text-gray-900 leading-6">
            {unorderedItems.map((item, index) => (
              <li key={`md-${keyIndex}-ul-${index}`}>{renderInlineMarkdown(item!)}</li>
            ))}
          </ul>
        );
        return;
      }

      const orderedItems = chunk
        .split('\n')
        .map((line) => line.match(/^\d+\.\s+(.+)$/)?.[1] ?? null);
      if (orderedItems.every(Boolean)) {
        nodes.push(
          <ol key={`md-${keyIndex++}`} className="list-decimal pl-5 space-y-1 text-sm text-gray-900 leading-6">
            {orderedItems.map((item, index) => (
              <li key={`md-${keyIndex}-ol-${index}`}>{renderInlineMarkdown(item!)}</li>
            ))}
          </ol>
        );
        return;
      }

      nodes.push(renderMarkdownParagraph(chunk, `md-${keyIndex++}`));
    });
  };

  while ((match = fencePattern.exec(content)) !== null) {
    const [fullMatch, language = '', code] = match;
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      pushTextBlock(before);
    }

    nodes.push(
      <div key={`md-${keyIndex++}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
        {language ? (
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {language}
          </div>
        ) : null}
        <pre className="overflow-x-auto p-3 text-sm leading-6 text-slate-100">
          <code>{code.replace(/\n$/, '')}</code>
        </pre>
      </div>
    );

    lastIndex = match.index + fullMatch.length;
  }

  const trailing = content.slice(lastIndex);
  if (trailing.trim()) {
    pushTextBlock(trailing);
  }

  return nodes;
}

function MarkdownMessage({ content, streaming = false }: { content: string; streaming?: boolean }) {
  const nodes = renderMarkdown(content);

  return (
    <div className="space-y-3">
      {nodes.length > 0 ? nodes : renderMarkdownParagraph(content, 'md-fallback')}
      {streaming ? (
        <span className="inline-block w-0.5 h-4 bg-[#0EA5E9] animate-pulse align-text-bottom" aria-hidden="true" />
      ) : null}
    </div>
  );
}

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
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [streamingTools, setStreamingTools] = useState<StreamingTool[]>([]);
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const sentCommandRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const detailReloadRef = useRef(detail.reload);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rows = conversations.data ?? [];
  const filteredRows = useMemo(
    () =>
      rows.filter((conversation) =>
        conversation.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
      ),
    [rows, searchTerm]
  );

  const activeConversation = rows.find((conversation) => conversation.id === selectedId) ?? null;

  // Build a map of message ID -> actions that were produced alongside that assistant message.
  // Actions are matched to the closest preceding assistant message by createdAt timestamp.
  const messageActionsMap = useMemo(() => {
    const map = new Map<string, AgentAction[]>();
    const messages = detail.data?.messages ?? [];
    const actions = (detail.data?.actions ?? []).filter(
      (a) => a.status === 'COMPLETED' && (a.bossModePath || a.entityType)
    );
    if (actions.length === 0) return map;

    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    for (const action of actions) {
      const actionTime = new Date(action.createdAt).getTime();
      // Find the closest assistant message that was created at or after the action
      let bestMsg = assistantMessages[assistantMessages.length - 1];
      for (const msg of assistantMessages) {
        const msgTime = new Date(msg.createdAt).getTime();
        if (msgTime >= actionTime) {
          bestMsg = msg;
          break;
        }
      }
      if (bestMsg) {
        const existing = map.get(bestMsg.id) ?? [];
        existing.push(action);
        map.set(bestMsg.id, existing);
      }
    }
    return map;
  }, [detail.data?.messages, detail.data?.actions]);

  useEffect(() => {
    if (!selectedId && rows.length > 0 && !showEmptyState) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId, showEmptyState]);

  useEffect(() => {
    // Don't reset selectedId while streaming — the new conversation may not
    // be in the sidebar list yet until conversations.reload() completes.
    if (selectedId && !submitting && streamingConversationId === null && !rows.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(rows[0]?.id ?? null);
    }
  }, [rows, selectedId, submitting, streamingConversationId]);

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
  }, [detail.data?.messages, selectedId, showEmptyState, streamingMessage, streamingTools]);

  useEffect(() => {
    detailReloadRef.current = detail.reload;
  }, [detail.reload]);

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedId(null);
    setShowEmptyState(true);
    setInputValue('');
    setSubmitError(null);
    setStreamingMessage(null);
    setStreamingTools([]);
    setStreamingConversationId(null);
    setSubmitting(false);
  };

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) {
      return;
    }

    const command = inputValue.trim();
    sentCommandRef.current = command;
    setInputValue('');
    setSubmitting(true);
    setSubmitError(null);
    setShowEmptyState(false);
    setStreamingMessage('');
    setStreamingTools([]);
    setStreamingConversationId(selectedId);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    await apiClient.streamPost(
      '/agent/command/stream',
      {
        command,
        conversationId: selectedId ?? undefined,
      },
      {
        onEvent: (event: Record<string, unknown>) => {
          switch (event.event) {
            case 'conversation_created':
              setSelectedId(event.conversationId as string);
              setStreamingConversationId(event.conversationId as string);
              break;
            case 'text_delta':
              setStreamingMessage((prev) => (prev ?? '') + (event.delta as string));
              break;
            case 'tool_call_start':
              setStreamingTools((prev) => [
                ...prev,
                { id: event.callId as string, name: event.name as string, status: 'running' },
              ]);
              // Reset streaming message for post-tool summary
              setStreamingMessage('');
              break;
            case 'tool_call_complete':
              setStreamingTools((prev) =>
                prev.map((t) =>
                  t.id === (event.callId as string)
                    ? { ...t, status: 'complete' as const, summary: event.summary as string }
                    : t
                )
              );
              break;
            case 'done':
              // Don't clear streamingMessage here — keep it visible until
              // onComplete reloads persisted messages from the backend.
              setStreamingTools([]);
              setSubmitting(false);
              sentCommandRef.current = '';
              break;
            case 'error':
              setSubmitError(event.message as string);
              setStreamingMessage(null);
              setStreamingTools([]);
              setStreamingConversationId(null);
              setSubmitting(false);
              sentCommandRef.current = '';
              break;
          }
        },
        onError: (err: Error) => {
          setSubmitError(err.message);
          setStreamingMessage(null);
          setStreamingTools([]);
          setStreamingConversationId(null);
          setSubmitting(false);
          sentCommandRef.current = '';
        },
        onComplete: () => {
          abortControllerRef.current = null;
          // Small delay to ensure the backend has finished persisting
          // messages before we reload the conversation detail.
          setTimeout(() => {
            void conversations.reload();
            void detailReloadRef.current().then(() => {
              setStreamingMessage(null);
              setStreamingConversationId(null);
            });
          }, 300);
        },
      },
      abortController.signal
    );
  }, [inputValue, selectedId, conversations, detail.reload]);

  const handleQuickAction = (text: string) => {
    setInputValue(text);
    textareaRef.current?.focus();
  };

  const handleConversationClick = (conversationId: string) => {
    setSelectedId(conversationId);
    setShowEmptyState(false);
    setSubmitError(null);
  };

  const isActiveStreamingConversation =
    streamingMessage !== null &&
    !showEmptyState &&
    ((streamingConversationId !== null && streamingConversationId === selectedId) ||
      (streamingConversationId === null && selectedId === null));
  const showConversationLoader = detail.loading && !detail.data && !isActiveStreamingConversation;

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
            onClick={() => {
              sessionStorage.setItem('vireos-mode', 'boss');
              const token = localStorage.getItem('vireos_access_token');
              if (token) {
                fetch('/api/v1/auth/me/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ preferredMode: 'boss' }),
                  keepalive: true,
                }).catch(() => {});
              }
              navigate('/home');
            }}
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
              onClick={() => {
                sessionStorage.setItem('vireos-mode', 'boss');
                const token = localStorage.getItem('vireos_access_token');
                if (token) {
                  fetch('/api/v1/auth/me/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ preferredMode: 'boss' }),
                    keepalive: true,
                  }).catch(() => {});
                }
                navigate('/home');
              }}
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
          ) : showConversationLoader ? (
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
                        <MarkdownMessage content={message.content} />

                        {(() => {
                          const actions = messageActionsMap.get(message.id);
                          if (actions && actions.length > 0) {
                            return actions.map((action) => {
                              const ActionIcon = actionIconForEntity(action.entityType);
                              const tone = actionToneForEntity(action.entityType);
                              const path = deriveBossModePath(action);
                              return (
                                <div key={action.id} className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 flex items-center gap-3">
                                  <div
                                    className={`flex-shrink-0 w-9 h-9 rounded-full ${actionCardToneClasses(tone)} flex items-center justify-center`}
                                  >
                                    <ActionIcon className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm text-gray-900">{humanizeToolName(action.functionName)}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{action.resultSummary ?? 'Action completed'}</div>
                                  </div>
                                  <button
                                    onClick={() => navigate(path)}
                                    className="flex-shrink-0 text-xs text-[#0EA5E9] hover:text-[#0284C7] whitespace-nowrap font-medium transition-colors"
                                  >
                                    View in Boss Mode →
                                  </button>
                                </div>
                              );
                            });
                          }
                          // Fallback for conversations with no linked actions: show generic card
                          if (activeConversation) {
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
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{formatClockTime(message.createdAt)}</div>
                    </div>
                  </div>
                )
              )}

              {/* Optimistic user bubble while streaming */}
              {isActiveStreamingConversation && sentCommandRef.current && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] md:max-w-[70%]">
                    <div className="bg-[#6366F1] text-white rounded-2xl rounded-br-sm px-4 py-3">
                      <p className="text-sm whitespace-pre-wrap">{sentCommandRef.current}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tool execution indicators */}
              {isActiveStreamingConversation && streamingTools.length > 0 && (
                <div className="space-y-2">
                  {streamingTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                    >
                      {tool.status === 'running' ? (
                        <Loader2 className="w-4 h-4 text-[#0EA5E9] animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                      <Wrench className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-medium">{humanizeToolName(tool.name)}</span>
                      {tool.status === 'running' && (
                        <span className="text-gray-400">Running...</span>
                      )}
                      {tool.status === 'complete' && tool.summary && (
                        <span className="text-gray-500 truncate">{tool.summary}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Streaming assistant bubble */}
              {isActiveStreamingConversation && (
                <div className="flex gap-3 max-w-[92%] md:max-w-[70%]">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white text-xs font-bold">
                    V
                  </div>
                  <div className="flex-1">
                    <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200 px-4 py-3">
                      {streamingMessage === '' ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-400">Thinking</span>
                          <span className="flex gap-0.5">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      ) : (
                        <MarkdownMessage content={streamingMessage} streaming />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!detail.loading && (detail.data?.messages?.length ?? 0) === 0 && streamingMessage === null ? (
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
              disabled={submitting}
              rows={1}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 pr-12 resize-none text-sm focus:outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9] disabled:opacity-60 disabled:cursor-not-allowed"
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
