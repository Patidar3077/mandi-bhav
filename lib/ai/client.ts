import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverEnv } from "@/lib/env";

/**
 * Server-only Claude access, two ways:
 * - ANTHROPIC_API_KEY set → Claude API directly (with server-side refusal fallback).
 * - Otherwise → Vercel AI Gateway, authenticated by the deployment's own OIDC token (no key to manage;
 *   billed to the Vercel account's AI credits).
 */
const GATEWAY_URL = "https://ai-gateway.vercel.sh";
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const usingGateway = () => !process.env.ANTHROPIC_API_KEY;

let direct: Anthropic | null = null;

export async function claude(): Promise<Anthropic> {
  if (!usingGateway()) {
    direct ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey(), timeout: 55_000, maxRetries: 1 });
    return direct;
  }
  // OIDC tokens are short-lived and per request on Vercel, so build a client each time.
  const apiKey = process.env.AI_GATEWAY_API_KEY || (await getVercelOidcToken());
  return new Anthropic({ apiKey, baseURL: GATEWAY_URL, timeout: 55_000, maxRetries: 1 });
}

/**
 * Model id in the right form. Directly: "claude-sonnet-5-5". Via the gateway: "provider/model", e.g.
 * "anthropic/claude-sonnet-5.5" or "openai/gpt-5-mini" (AI_MODEL; the free Vercel tier doesn't include Claude).
 */
export function model() {
  if (!usingGateway()) return serverEnv.claudeModel();
  const id = process.env.AI_MODEL || serverEnv.claudeModel();
  if (id.includes("/")) return id;
  return `anthropic/${id.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`;
}

/** Request options that only the direct Claude API accepts (the gateway ignores or rejects them). */
export function directOnly<T extends object>(extra: T): T | Record<string, never> {
  return usingGateway() ? {} : extra;
}
