import type { Metadata } from "next";
import { Chat } from "@/components/assistant/chat";

export const metadata: Metadata = { title: "Assistant" };

export default function NewChatPage() {
  return <Chat />;
}
