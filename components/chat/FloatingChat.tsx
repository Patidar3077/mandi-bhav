"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useI18n } from "@/lib/i18n/client";
import { useChat } from "./ChatProvider";
import { ChatPanel } from "./ChatPanel";

/** Floating "Ask Mandi AI" button (bottom right) that opens the chat over the page. */
export function FloatingChat() {
  const { t } = useI18n();
  const { open, setOpen } = useChat();
  const pathname = usePathname();
  if (pathname.startsWith("/onboarding")) return null;
  // On the analysis page the chat is docked beside the content on large screens.
  const hideOnDesktop = pathname.startsWith("/analysis") ? "lg:hidden" : "";

  return (
    <div className={hideOnDesktop}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-ink/30 sm:items-end sm:p-4" onClick={() => setOpen(false)}>
          <div className="h-[88dvh] w-full sm:h-[640px] sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <ChatPanel onClose={() => setOpen(false)} className="h-full rounded-b-none shadow-sheet sm:rounded-b-2xl" />
          </div>
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex min-h-14 items-center gap-2 rounded-full bg-leaf-deep px-5 font-semibold text-card shadow-float hover:bg-leaf-dark"
        >
          <Icon name="chat" className="text-[22px]" />
          <span>{t("chat.open")}</span>
        </button>
      )}
    </div>
  );
}
