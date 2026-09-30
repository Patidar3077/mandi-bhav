import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { FloatingChat } from "@/components/chat/FloatingChat";
import { requireProfile } from "@/lib/auth";
import { recentSearches } from "@/lib/limits";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const [lastCrop] = await recentSearches(profile.id, 1);
  const trendsHref = lastCrop
    ? `/analysis/${encodeURIComponent(lastCrop)}?district=${encodeURIComponent(profile.district)}`
    : "/market";

  return (
    <ChatProvider>
      <Header profile={profile} trendsHref={trendsHref} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">{children}</main>
      <Footer />
      <FloatingChat />
    </ChatProvider>
  );
}
