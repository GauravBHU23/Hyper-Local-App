"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

import { ServiceCard } from "@/components/services/ServiceCard";
import { useLocation } from "@/hooks/useLocation";
import { chatApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ChatResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  chatData?: ChatResponse;
}

const QUICK_PROMPTS = [
  "My AC is not working",
  "I need electrical wiring fixed",
  "There is a water pipe leak",
  "I need home cleaning",
  "I am looking for a tutor",
  "I need a 24-hour chemist",
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { coords } = useLocation();

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hello! I am HyperLocal AI. Tell me what problem you are facing, and I will help you find the best nearby service providers.",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await chatApi.sendMessage({
        message: text.trim(),
        session_token: sessionToken || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        language: "en",
      });

      const data: ChatResponse = res.data;
      if (!sessionToken) setSessionToken(data.session_token);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        timestamp: new Date(),
        chatData: data,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      toast.error("Could not connect to AI. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px)] w-full max-w-3xl min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow">
          <Bot size={20} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">HyperLocal AI</h2>
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-green-500" />
            Online - English support
          </div>
        </div>
        {coords && (
          <div className="hidden items-center gap-1 text-xs text-slate-400 sm:flex">
            <MapPin size={11} />
            Location detected
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "chat-bubble flex gap-3",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            <div
              className={cn(
                "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-orange-500 to-rose-500"
                  : "bg-slate-700"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot size={15} className="text-white" />
              ) : (
                <User size={15} className="text-white" />
              )}
            </div>

            <div className="min-w-0 max-w-[calc(100%-2.75rem)] space-y-3 sm:max-w-[85%]">
              <div
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "rounded-tr-sm bg-orange-500 text-white"
                    : "rounded-tl-sm border border-slate-100 bg-white text-slate-800 shadow-sm"
                )}
              >
                {msg.content}
              </div>

              {msg.chatData && (
                <div className="min-w-0 space-y-2">
                  {(msg.chatData.estimated_cost_range || msg.chatData.best_time_to_book) && (
                    <div className="flex flex-wrap gap-2">
                      {msg.chatData.estimated_cost_range && (
                        <div className="flex items-center gap-1.5 rounded-xl border border-green-100 bg-green-50 px-3 py-1.5 text-xs text-green-800">
                          <IndianRupee size={11} />
                          Est. Rs. {msg.chatData.estimated_cost_range.min} - Rs. {msg.chatData.estimated_cost_range.max}
                        </div>
                      )}
                      {msg.chatData.best_time_to_book && (
                        <div className="flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
                          <Clock size={11} />
                          {msg.chatData.best_time_to_book}
                        </div>
                      )}
                    </div>
                  )}

                  {msg.chatData.suggested_services && msg.chatData.suggested_services.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
                        <Sparkles size={11} className="text-orange-500" />
                        Nearby providers found:
                      </p>
                      {msg.chatData.suggested_services.map((svc) => (
                        <ServiceCard key={svc.id} provider={svc} compact />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <p className="px-1 text-[10px] text-slate-400">
                {msg.timestamp.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-bubble flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500">
              <Bot size={15} className="text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-2 w-2 rounded-full bg-orange-400"
                    style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-3 py-2 sm:px-4">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 transition-colors hover:border-orange-300 hover:text-orange-600"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-slate-100 bg-white px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your issue..."
            className="input flex-1 resize-none text-sm"
            disabled={loading}
            maxLength={500}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="btn-primary flex w-full items-center justify-center rounded-xl p-3 disabled:opacity-50 sm:w-auto"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
