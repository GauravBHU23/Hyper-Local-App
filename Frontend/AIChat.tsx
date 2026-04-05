"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, MapPin, Loader2, IndianRupee, Clock } from "lucide-react";
import { chatApi } from "@/lib/api";
import { useLocation } from "@/hooks/useLocation";
import type { ChatResponse } from "@/types";
import { ServiceCard } from "@/components/services/ServiceCard";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  chatData?: ChatResponse;
}

const QUICK_PROMPTS = [
  "Mera AC kaam nahi kar raha 🥵",
  "Bijli ki wiring fix karni hai ⚡",
  "Pipe leak ho raha hai 💧",
  "Ghar ki safai chahiye 🧹",
  "Tutor dhundh raha hoon 📚",
  "24 ghante chemist chahiye 💊",
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { coords } = useLocation();

  // Welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Namaste! 🙏 Main HyperLocal AI hoon. Aapki kya problem hai? Mujhe batao, main aas-paas ke best service providers dhundh dunga!",
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
        language: "hi",
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
      toast.error("AI se connect nahi ho paya. Please retry karo.");
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
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 text-sm">HyperLocal AI</h2>
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-dot" />
            Online • Hindi + English
          </div>
        </div>
        {coords && (
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-400">
            <MapPin size={11} />
            Location detected
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 chat-bubble",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1",
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

            {/* Bubble */}
            <div className={cn("max-w-[80%] space-y-3", msg.role === "user" ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-orange-500 text-white rounded-tr-sm"
                    : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm shadow-sm"
                )}
              >
                {msg.content}
              </div>

              {/* AI extras */}
              {msg.chatData && (
                <div className="space-y-2">
                  {/* Cost + Time */}
                  {(msg.chatData.estimated_cost_range || msg.chatData.best_time_to_book) && (
                    <div className="flex flex-wrap gap-2">
                      {msg.chatData.estimated_cost_range && (
                        <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-800 text-xs px-3 py-1.5 rounded-xl">
                          <IndianRupee size={11} />
                          Est. ₹{msg.chatData.estimated_cost_range.min}–₹{msg.chatData.estimated_cost_range.max}
                        </div>
                      )}
                      {msg.chatData.best_time_to_book && (
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 text-xs px-3 py-1.5 rounded-xl">
                          <Clock size={11} />
                          {msg.chatData.best_time_to_book}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested Services */}
                  {msg.chatData.suggested_services && msg.chatData.suggested_services.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
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

              <p className="text-[10px] text-slate-400 px-1">
                {msg.timestamp.toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3 chat-bubble">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shrink-0">
              <Bot size={15} className="text-white" />
            </div>
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-orange-400"
                    style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="shrink-0 text-xs px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-600 transition-colors whitespace-nowrap"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white border-t border-slate-100">
        <div className="flex gap-2 items-end">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Apni problem batao... (Hindi ya English)"
            className="input flex-1 text-sm resize-none"
            disabled={loading}
            maxLength={500}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="btn-primary p-3 rounded-xl disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}