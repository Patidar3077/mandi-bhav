"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";
import { useChat } from "./ChatProvider";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const CONVERSATION_KEY = "mandi-chat-conversation";

function loadConversationId() {
  try {
    const existing = localStorage.getItem(CONVERSATION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(CONVERSATION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** "Ask Mandi AI" chat. Used docked on the analysis page (desktop) and as a floating sheet elsewhere. */
export function ChatPanel({ onClose, className = "" }: { onClose?: () => void; className?: string }) {
  const { t } = useI18n();
  const { viewing } = useChat();
  // The id isn't rendered, so reading localStorage during the first client render is safe.
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : loadConversationId(),
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "thinking" | "checking">(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    let alive = true;
    fetch(`/api/chat?conversationId=${conversationId}`)
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d: { messages: Msg[] }) => {
        if (alive) setMessages(d.messages.map((m) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [conversationId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy || !conversationId) return;
      setInput("");
      setMessages((m) => [...m, { role: "user", content: message }]);
      setBusy("thinking");
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, conversationId, viewing }),
        });
        if (res.status === 429) {
          setMessages((m) => [...m, { role: "assistant", content: t("limits.fairUse"), error: true }]);
          return;
        }
        if (!res.ok || !res.body) throw new Error("chat failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answered = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as { type: string; text?: string; tool?: string; reason?: string };
            if (event.type === "status") setBusy("checking");
            if (event.type === "answer" && event.text) {
              answered = true;
              setMessages((m) => [...m, { role: "assistant", content: event.text! }]);
            }
            if (event.type === "error") throw new Error(event.reason === "unavailable" ? "unavailable" : "chat error");
          }
        }
        if (!answered) throw new Error("no answer");
      } catch (err) {
        const key = err instanceof Error && err.message === "unavailable" ? "chat.unavailable" : "chat.error";
        setMessages((m) => [...m, { role: "assistant", content: t(key), error: true }]);
      } finally {
        setBusy(null);
      }
    },
    [busy, conversationId, viewing, t],
  );

  const newChat = () => {
    const id = crypto.randomUUID();
    try {
      localStorage.setItem(CONVERSATION_KEY, id);
    } catch {}
    setConversationId(id);
    setMessages([]);
  };

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3"), t("chat.s4")];

  return (
    <section className={`card flex flex-col overflow-hidden ${className}`} aria-label={t("chat.title")}>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-cream p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-deep text-card">
            <Icon name="smart_toy" className="text-[22px]" />
            <span className="pulse-dot absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-fresh" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-leaf-deep">{t("chat.title")}</h2>
            <p className="truncate text-[13px] text-brown">{t("chat.subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center">
          <button type="button" onClick={newChat} title={t("chat.clear")} aria-label={t("chat.clear")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand">
            <Icon name="refresh" className="text-[20px]" />
          </button>
          {onClose && (
            <button type="button" onClick={onClose} title={t("chat.close")} aria-label={t("chat.close")} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-sand">
              <Icon name="close" className="text-[22px]" />
            </button>
          )}
        </div>
      </header>

      <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex items-start gap-2 pr-6">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-deep text-card">
              <Icon name="smart_toy" className="text-[15px]" />
            </div>
            <p className="rounded-2xl rounded-tl-sm bg-cream p-3.5 text-[15px] leading-[22px]">{t("chat.welcome")}</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end pl-8">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-leaf-deep p-3.5 text-[15px] leading-[22px] text-card">
                {m.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2 pr-6">
              <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-leaf-deep text-card">
                <Icon name={m.error ? "error" : "smart_toy"} className="text-[15px]" />
              </div>
              <div className={`max-w-[90%] rounded-2xl rounded-tl-sm p-3.5 ${m.error ? "bg-down-bg text-down" : "bg-cream"}`}>
                {!m.error && (
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-leaf">
                    <Icon name="verified" className="text-[15px]" /> {t("chat.botName")}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-[15px] leading-[22px]">{m.content}</p>
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-brown">
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            {busy === "checking" ? t("chat.checking") : t("chat.thinking")}
          </div>
        )}
        {messages.length < 2 && !busy && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="ml-1 text-[11px] font-medium text-brown">{t("chat.suggestions")}</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="min-h-9 rounded-full bg-cream px-3 py-1.5 text-left text-xs font-semibold text-leaf-deep hover:bg-sand">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form
        className="shrink-0 border-t border-line bg-card p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-center gap-1.5 rounded-xl bg-cream px-2 py-1 focus-within:ring-2 focus-within:ring-leaf">
          <label htmlFor="chat-input" className="sr-only">{t("chat.placeholder")}</label>
          <input
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            maxLength={1000}
            autoComplete="off"
            className="min-h-12 w-full bg-transparent px-2 text-base text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || Boolean(busy)}
            aria-label={t("chat.send")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-leaf-deep text-card hover:bg-leaf-dark disabled:opacity-50"
          >
            <Icon name="send" className="text-[19px]" />
          </button>
        </div>
      </form>
    </section>
  );
}
