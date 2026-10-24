import type { Metadata } from "next";
import { Chat } from "@/components/assistant/chat";
import { DesktopToggleSlot } from "@/components/assistant/desktop-toggle-slot";
import { ProactiveCardsSlot } from "@/components/assistant/proactive-cards-slot";

export const metadata: Metadata = { title: "Assistant" };

export default function NewChatPage() {
  return <Chat desktopToggle={<DesktopToggleSlot />} proactive={<ProactiveCardsSlot />} />;
}
