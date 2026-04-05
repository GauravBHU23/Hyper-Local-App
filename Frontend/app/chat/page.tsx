import type { Metadata } from "next";

import { AIChat } from "@/components/chat/AIChat";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "AI Chat - HyperLocal",
  description: "Describe your problem and get help from AI",
};

export default function ChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <AIChat />
    </div>
  );
}
