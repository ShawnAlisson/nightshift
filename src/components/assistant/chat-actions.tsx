"use client";

import { createContext, useContext } from "react";

type ChatActions = {
  /** Sends a message as if the person had said it. */
  run: (text: string) => void;
};

const ChatActionsContext = createContext<ChatActions | null>(null);

export const ChatActionsProvider = ChatActionsContext;

export function useChatActions() {
  const actions = useContext(ChatActionsContext);
  if (!actions) throw new Error("useChatActions must be used inside the chat");
  return actions;
}
