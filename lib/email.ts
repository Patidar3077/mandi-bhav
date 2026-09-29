import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { makeT, type Locale } from "@/lib/i18n/config";

/**
 * App-sent emails over any SMTP provider (Gmail app password, Resend, Brevo, ...).
 * Not configured → isEmailConfigured() is false and login falls back to Supabase's own email.
 */
export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport: Transporter | null = null;
function transporter() {
  const port = Number(process.env.SMTP_PORT || 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendLoginCode(to: string, code: string, locale: Locale) {
  const t = makeT(locale);
  const app = t("common.appName");
  const subject = t("email.subject", { code, app });
  const text = `${t("email.intro")}\n\n${code}\n\n${t("email.expiry")}\n${t("email.ignore")}\n\n${app} · ${t("common.company")}`;
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f4ebdd;font-family:'Noto Sans',Arial,sans-serif;color:#3b3128">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px">
    <div style="background:#fffbf4;border:1px solid #e2d7c3;border-radius:16px;padding:24px">
      <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#164525">${escape(app)}</p>
      <p style="margin:0 0 16px;font-size:15px">${escape(t("email.intro"))}</p>
      <p style="margin:0 0 16px;font-size:34px;font-weight:800;letter-spacing:8px;color:#2f5d3a;text-align:center">${escape(code)}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#6e6155">${escape(t("email.expiry"))}</p>
      <p style="margin:0;font-size:13px;color:#6e6155">${escape(t("email.ignore"))}</p>
    </div>
    <p style="font-size:11px;color:#6e6155;text-align:center">${escape(app)} · ${escape(t("common.company"))}</p>
  </div></body></html>`;

  await transporter().sendMail({
    from: process.env.EMAIL_FROM || `${app} <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
