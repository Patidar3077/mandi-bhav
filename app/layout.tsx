import type { Metadata, Viewport } from "next";
import { Noto_Sans } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { getT } from "@/lib/i18n/server";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Only the icons the app uses, so the icon font stays small on slow connections.
const ICONS = [
  "arrow_back", "arrow_downward", "arrow_upward", "auto_graph", "calendar_today", "call", "chat", "close",
  "error", "expand_more", "info", "insights", "lightbulb", "local_shipping", "logout", "person",
  "progress_activity", "radar", "refresh", "search", "send", "smart_toy", "star", "storefront",
  "trending_down", "trending_flat", "trending_up", "verified",
].sort();

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("common.appName"), template: `%s · ${t("common.appName")}` },
    description: t("common.tagline"),
  };
}

export const viewport: Viewport = { themeColor: "#2f5d3a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getT();
  return (
    <html lang={locale} className={`${notoSans.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${ICONS.join(",")}&display=block`}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
