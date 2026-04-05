import { AIChat } from "@/components/chat/AIChat";
import { Navbar } from "@/components/layout/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Chat — HyperLocal",
  description: "Apni problem batao, AI se solution pao",
};

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <AIChat />
    </div>
  );
}