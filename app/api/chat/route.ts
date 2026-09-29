import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getProfile } from "@/lib/auth";
import { consumeChatMessage } from "@/lib/limits";
import { adminClient } from "@/lib/supabase/admin";
import { answer, type ChatTurn } from "@/lib/ai/chat";
import { todayIST } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HISTORY_LIMIT = 20;
const UUID = /^[0-9a-f-]{36}$/i;

/** GET ?conversationId= — the farmer's saved messages for that conversation. */
export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") ?? "";
  if (!UUID.test(conversationId)) return NextResponse.json({ messages: [] });
  const { data } = await adminClient()
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", profile.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);
  return NextResponse.json({ messages: data ?? [] });
}

/**
 * POST { message, conversationId, viewing? } — streams newline-delimited JSON events:
 * {type:"status", tool} while tools run, then {type:"answer", text} or {type:"error", ...}.
 */
export async function POST(request: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    conversationId?: string;
    viewing?: { commodity?: string; district?: string; market?: string | null } | null;
  };
  const message = body.message?.trim().slice(0, 1000);
  const conversationId = body.conversationId ?? "";
  if (!message || !UUID.test(conversationId)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const limit = await consumeChatMessage(profile);
  if (!limit.ok) return NextResponse.json({ error: "limit", ...limit }, { status: 429 });

  const db = adminClient();
  const { data: past } = await db
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", profile.id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT - 1);
  const history: ChatTurn[] = [...(past ?? [])]
    .reverse()
    .map((m) => ({ role: m.role as ChatTurn["role"], content: m.content }));
  // The API needs the conversation to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  history.push({ role: "user", content: message });

  await db.from("chat_messages").insert({ user_id: profile.id, conversation_id: conversationId, role: "user", content: message });

  const viewing =
    body.viewing?.commodity && body.viewing.district
      ? { commodity: body.viewing.commodity, district: body.viewing.district, market: body.viewing.market ?? null }
      : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const text = await answer(
          history,
          { district: profile.district, today: todayIST(), language: profile.language, viewing },
          (tool) => send({ type: "status", tool }),
        );
        await db.from("chat_messages").insert({
          user_id: profile.id,
          conversation_id: conversationId,
          role: "assistant",
          content: text,
        });
        send({ type: "answer", text });
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) console.error("[chat] rate limited", err.message);
        else if (err instanceof Anthropic.APIError) console.error(`[chat] API error ${err.status}`, err.message);
        else console.error("[chat] failed", err);
        send({ type: "error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
