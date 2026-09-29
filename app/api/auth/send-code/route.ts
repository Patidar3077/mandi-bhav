import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, sendLoginCode } from "@/lib/email";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_EMAIL = { seconds: 30, perHour: 5 };
const PER_IP_PER_HOUR = 20;

/**
 * POST { email } — emails a 6-digit login code to the person's own address.
 * Works for first-time users (creates the account) and returning users.
 * Returns { fallback: true } when no email sender is configured, so the browser uses Supabase's email instead.
 */
export async function POST(request: NextRequest) {
  if (!isEmailConfigured()) return NextResponse.json({ fallback: true });

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const db = adminClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();

  const [{ data: recentForEmail }, { count: ipCount }] = await Promise.all([
    db.from("login_code_sends").select("sent_at").eq("email", email).gte("sent_at", hourAgo).order("sent_at", { ascending: false }),
    ip
      ? db.from("login_code_sends").select("id", { count: "exact", head: true }).eq("ip", ip).gte("sent_at", hourAgo)
      : Promise.resolve({ count: 0 }),
  ]);
  const last = recentForEmail?.[0]?.sent_at;
  if (
    (last && Date.now() - Date.parse(last) < PER_EMAIL.seconds * 1000) ||
    (recentForEmail?.length ?? 0) >= PER_EMAIL.perHour ||
    (ipCount ?? 0) >= PER_IP_PER_HOUR
  ) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Returning users get a magic-link OTP; first-time users are created and get a signup OTP.
  let result = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (result.error) {
    result = await db.auth.admin.generateLink({
      type: "signup",
      email,
      password: randomBytes(24).toString("base64url"), // never used: login is always by code
    });
  }
  const code = result.data?.properties?.email_otp;
  if (result.error || !code) {
    console.error("[send-code] generateLink failed", result.error?.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  try {
    await sendLoginCode(email, code, await getLocale());
  } catch (err) {
    console.error("[send-code] email failed", err);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  await db.from("login_code_sends").insert({ email, ip });
  return NextResponse.json({ ok: true });
}
