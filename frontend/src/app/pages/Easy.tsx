import { useEffect, useRef, useState } from 'react';
import { Plus, Send, MessageSquare, ArrowLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';

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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

export default function Easy() {
  const conversations = useApiData<ConversationListResponse>('/agent/conversations?page=1&limit=20');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApiData<ConversationDetail>(`/agent/conversations/${selectedId ?? ''}`, [selectedId], Boolean(selectedId));
  const [command, setCommand] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const rows = conversations.data ?? [];

  useEffect(() => {
    if (!selectedId && rows.length > 0) {
      setSelectedId(rows[0]!.id);
    }
  }, [rows, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail.data?.messages]);

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setShowChat(true);
  };

  const handleSend = async (startNew = false) => {
    if (!command.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiClient.post<AgentCommandResult>('/agent/command', {
        command: command.trim(),
        conversationId: startNew ? undefined : selectedId ?? undefined,
      });
      setCommand('');
      await conversations.reload();
      setSelectedId(result.conversationId);
      setShowChat(true);
      await detail.reload();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to reach Easy Mode.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewConversation = () => {
    setSelectedId(null);
    setShowChat(true);
    setCommand('');
    setSubmitError(null);
  };

  if (conversations.loading) {
    return <LoadingState label="Loading Easy Mode..." />;
  }

  if (conversations.error) {
    return <div className="flex h-full items-center justify-center text-sm text-red-600">{conversations.error}</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-semibold text-[#1E3A5F] truncate">Vireos AI Assistant</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-0.5 hidden sm:block">Your AI-powered marketing assistant</p>
        </div>
        <Button
          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white shrink-0"
          onClick={handleNewConversation}
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">New Conversation</span>
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 p-3 md:p-6 flex gap-4 lg:gap-6">
        {/* Left Panel - Conversations */}
        <Card className={`${showChat ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 xl:w-96 shrink-0 flex-col rounded-lg shadow-sm border border-gray-200 overflow-hidden`}>
          <div className="px-4 py-3 border-b border-gray-200 shrink-0">
            <h2 className="text-sm font-semibold text-[#1E3A5F]">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">No conversations yet. Send a message to start.</div>
            ) : (
              rows.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`w-full px-4 py-3 text-left border-b border-gray-100 transition-colors ${
                    selectedId === conversation.id
                      ? 'bg-sky-50 border-l-2 border-l-[#0EA5E9]'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#1E3A5F] truncate">{conversation.title}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{conversation.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{formatTime(conversation.updatedAt)}</div>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Right Panel - Chat */}
        <Card className={`${showChat ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 flex-col rounded-lg shadow-sm border border-gray-200 overflow-hidden`}>
          {!selectedId && !showChat ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                title="No conversation selected"
                description="Select a conversation from the list or start a new one to begin chatting."
              />
            </div>
          ) : !selectedId && showChat ? (
            <>
              {/* Back button on mobile */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 lg:hidden shrink-0">
                <button onClick={() => setShowChat(false)} className="p-1 -ml-1 text-gray-500 hover:text-[#1E3A5F]">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-[#1E3A5F]">New Conversation</span>
              </div>
              <div className="hidden lg:flex px-5 py-3 border-b border-gray-200 items-center gap-2 shrink-0">
                <MessageSquare className="w-4 h-4 text-[#0EA5E9]" />
                <span className="text-sm font-medium text-[#1E3A5F]">New Conversation</span>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  title="Start a conversation"
                  description="Type a message below to begin chatting with Vireos AI."
                />
              </div>
            </>
          ) : detail.loading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState label="Loading conversation..." />
            </div>
          ) : detail.error ? (
            <div className="flex-1 flex items-center justify-center text-sm text-red-600 p-6">{detail.error}</div>
          ) : (
            <>
              {/* Chat header - mobile with back button */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2 lg:hidden shrink-0">
                <button onClick={() => setShowChat(false)} className="p-1 -ml-1 text-gray-500 hover:text-[#1E3A5F]">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-[#1E3A5F] truncate">{detail.data?.title}</span>
              </div>
              {/* Chat header - desktop */}
              <div className="hidden lg:flex px-5 py-3 border-b border-gray-200 items-center gap-2 shrink-0">
                <MessageSquare className="w-4 h-4 text-[#0EA5E9]" />
                <span className="text-sm font-medium text-[#1E3A5F] truncate">{detail.data?.title}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
                {detail.data?.messages.length === 0 ? (
                  <EmptyState title="No messages yet" description="Send a message below to start the conversation." />
                ) : (
                  detail.data?.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed break-words ${
                          message.role === 'user'
                            ? 'bg-[#0EA5E9] text-white'
                            : 'bg-gray-50 border border-gray-200 text-[#1E3A5F]'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}

          {/* Input bar */}
          <div className="border-t border-gray-200 px-3 md:px-4 py-3 shrink-0">
            {submitError && <p className="mb-2 text-xs text-red-600">{submitError}</p>}
            <div className="flex items-center gap-2 md:gap-3">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend(!selectedId);
                  }
                }}
                placeholder="Ask Vireos AI..."
                className="h-10 flex-1 min-w-0 rounded-lg border border-gray-300 px-3 md:px-4 text-sm outline-none focus:border-[#0EA5E9] focus:ring-1 focus:ring-[#0EA5E9]"
              />
              <Button
                className="h-10 bg-[#0EA5E9] hover:bg-[#0284C7] text-white shrink-0"
                onClick={() => void handleSend(!selectedId)}
                disabled={submitting || !command.trim()}
              >
                <Send className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Send</span>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
