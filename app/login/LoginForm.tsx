"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { afterSignIn } from "@/app/actions";

const RESEND_SECONDS = 30;

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function sendCode() {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t("login.invalidEmail"));
    setBusy(true);
    try {
      // The app emails the 6-digit code itself; if no email sender is set up, Supabase sends it instead.
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; fallback?: boolean; error?: string };
      if (res.status === 429) return setError(t("login.rateLimited"));
      if (body.error === "invalid_email") return setError(t("login.invalidEmail"));
      if (body.fallback) {
        const { error } = await createClient().auth.signInWithOtp({
          email: email.trim(),
          options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) return setError(error.status === 429 ? t("login.rateLimited") : t("common.error"));
      } else if (!body.ok) {
        return setError(t("common.error"));
      }
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError(t("login.invalidCode"));
    setBusy(true);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
    if (error) {
      setBusy(false);
      return setError(error.status === 429 ? t("login.rateLimited") : t("login.invalidCode"));
    }
    await afterSignIn();
    router.replace("/market");
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "email") sendCode();
        else verify();
      }}
    >
      {step === "email" ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t("login.emailLabel")}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.emailPlaceholder")}
            className="field"
          />
        </label>
      ) : (
        <>
          <p className="text-[15px] text-muted">{t("login.codeSentTo", { email: email.trim() })}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("login.codeLabel")}</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="field text-center text-2xl font-bold tracking-[0.5em] tabular"
              autoFocus
            />
          </label>
          <p className="text-[13px] text-muted">{t("login.linkAlso")}</p>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-down-bg p-3 text-sm text-down">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {step === "email" ? (busy ? t("login.sending") : t("login.sendCode")) : busy ? t("login.verifying") : t("login.verify")}
      </button>

      {step === "code" && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button
            type="button"
            className="min-h-11 font-semibold text-leaf disabled:text-muted"
            disabled={resendIn > 0 || busy}
            onClick={sendCode}
          >
            {resendIn > 0 ? t("login.resendIn", { s: resendIn }) : t("login.resend")}
          </button>
          <button
            type="button"
            className="min-h-11 text-brown underline"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            {t("login.changeEmail")}
          </button>
        </div>
      )}
    </form>
  );
}
