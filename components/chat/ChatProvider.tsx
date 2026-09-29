"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Viewing = { commodity: string; district: string; market: string | null } | null;

type ChatState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  viewing: Viewing;
  setViewing: (v: Viewing) => void;
};

const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Viewing>(null);
  return <ChatContext.Provider value={{ open, setOpen, viewing, setViewing }}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

/** Tells the chatbot which crop and place the farmer is looking at. */
export function ChatViewing({ commodity, district, market }: { commodity: string; district: string; market: string | null }) {
  const { setViewing } = useChat();
  useEffect(() => {
    setViewing({ commodity, district, market });
    return () => setViewing(null);
  }, [commodity, district, market, setViewing]);
  return null;
}
