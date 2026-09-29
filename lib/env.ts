import "server-only";

/** Server-only configuration. Never import this from a client component. */
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  apifyToken: () => required("APIFY_TOKEN"),
  dataGovApiKey: () => process.env.DATA_GOV_IN_API_KEY || undefined,
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  claudeModel: () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5",
  apifyWebhookSecret: () => required("APIFY_WEBHOOK_SECRET"),
  cronSecret: () => process.env.CRON_SECRET || undefined,
  dailySpendCapUsd: () => Number(process.env.DAILY_APIFY_SPEND_CAP_USD || "5"),
  dailySyncMaxResults: () => Number(process.env.DAILY_SYNC_MAX_RESULTS || "3000"),
  siteUrl: () =>
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
};
