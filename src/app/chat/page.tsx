"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Trash2, Edit2, Send, LogOut, Check, X, Zap } from "lucide-react";
import {
  apiGetChats,
  apiCreateChat,
  apiUpdateChat,
  apiDeleteChat,
  apiGetMessages,
  apiSendMessage,
} from "@/lib/api";
import { ChatMessage } from "@/components/ChatMessage";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

const SUGGESTED_PROMPTS = [
  {
    icon: "🔩",
    title: "Bearing Selection",
    prompt: "Help me select the right bearing for a high-speed spindle application running at 15,000 RPM with radial load of 5kN",
  },
  {
    icon: "📊",
    title: "Top Bearings Comparison",
    prompt: "Show me the top 5 most popular SKF deep groove ball bearings with their specifications in a comparison table",
  },
  {
    icon: "🔧",
    title: "Failure Analysis",
    prompt: "What are the most common causes of bearing failure and how to prevent them?",
  },
  {
    icon: "📐",
    title: "Life Calculation",
    prompt: "Calculate the L10 bearing life for an SKF 6205 bearing with 3kN radial load at 3000 RPM",
  },
  {
    icon: "🏭",
    title: "Industry Applications",
    prompt: "What bearings are recommended for wind turbine main shaft applications?",
  },
  {
    icon: "💡",
    title: "Bearing Designation",
    prompt: "Explain the SKF bearing designation system. What does 6305-2RS1 mean?",
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadChats();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const loadChats = async () => {
    try {
      const data = await apiGetChats();
      setChats(data);
    } catch {
      router.push("/login");
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const data = await apiGetMessages(chatId);
      setMessages(data);
      setActiveChat(chatId);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const handleNewChat = () => {
    setActiveChat(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await apiDeleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeChat === chatId) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleRenameChat = async (chatId: string) => {
    if (!editTitle.trim()) return;
    try {
      const updated = await apiUpdateChat(chatId, editTitle.trim());
      setChats((prev) => prev.map((c) => (c.id === chatId ? updated : c)));
      setEditingChatId(null);
    } catch (err) {
      console.error("Failed to rename chat", err);
    }
  };

  const handleSend = async (messageOverride?: string) => {
    const messageText = (messageOverride || input).trim();
    if (!messageText || isStreaming) return;

    let chatId = activeChat;

    if (!chatId) {
      try {
        const chat = await apiCreateChat();
        setChats((prev) => [chat, ...prev]);
        chatId = chat.id;
        setActiveChat(chatId);
      } catch (err) {
        console.error("Failed to create chat", err);
        return;
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      chat_id: chatId,
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      await apiSendMessage(chatId, messageText, (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      });

      const freshMessages = await apiGetMessages(chatId);
      setMessages(freshMessages);
      await loadChats();
    } catch (err) {
      console.error("Failed to send message", err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          chat_id: chatId!,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  const showWelcome = messages.length === 0 && !streamingContent && !isStreaming;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 bg-[hsl(240,6%,6%)] border-r border-border flex flex-col overflow-hidden`}
      >
        <div className="p-3 flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-white" />
            </div>
            <span className="font-semibold text-sm truncate">Bearing AI</span>
          </div>
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0"
            title="New Chat"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                activeChat === chat.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
              onClick={() => loadMessages(chat.id)}
            >
              <MessageSquare size={14} className="shrink-0" />

              {editingChatId === chat.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 bg-background px-2 py-1 rounded text-xs border border-border"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameChat(chat.id);
                      if (e.key === "Escape") setEditingChatId(null);
                    }}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button onClick={(e) => { e.stopPropagation(); handleRenameChat(chat.id); }}>
                    <Check size={14} className="text-green-400" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingChatId(null); }}>
                    <X size={14} className="text-red-400" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">{chat.title}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingChatId(chat.id);
                        setEditTitle(chat.title);
                      }}
                      className="p-1 rounded hover:bg-background/50"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteChat(chat.id);
                      }}
                      className="p-1 rounded hover:bg-background/50 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <span className="text-sm font-medium text-muted-foreground truncate">
            {activeChat ? chats.find((c) => c.id === activeChat)?.title || "Chat" : "New Chat"}
          </span>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {showWelcome ? (
            <div className="flex flex-col items-center justify-center h-full px-4 max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                  <Zap size={32} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Bearing Selection Assistant</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Ask me about bearings — selection, specifications, life calculations, failure analysis, and more.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
                {SUGGESTED_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className="text-left p-4 rounded-xl border border-border hover:border-blue-500/50 hover:bg-accent/50 transition-all group"
                  >
                    <div className="text-xl mb-2">{item.icon}</div>
                    <div className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {item.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
              ))}
              {isStreaming && streamingContent && (
                <ChatMessage role="assistant" content={streamingContent} />
              )}
              {isStreaming && !streamingContent && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Zap size={14} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1.5 py-3">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-background shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-secondary rounded-2xl border border-border px-4 py-3 focus-within:border-blue-500/50 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about bearings — selection, specifications, maintenance..."
                className="flex-1 resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none min-h-[24px] max-h-[200px] text-sm leading-6"
                rows={1}
                disabled={isStreaming}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 transition-colors shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Bearing AI can make mistakes. Verify critical specifications with manufacturer datasheets.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
