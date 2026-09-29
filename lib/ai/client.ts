import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

let anthropic: Anthropic | null = null;

/** Server-only Claude client. The API key never reaches the browser. */
export function claude() {
  anthropic ??= new Anthropic({ apiKey: serverEnv.anthropicApiKey(), timeout: 55_000, maxRetries: 1 });
  return anthropic;
}

export const model = () => serverEnv.claudeModel();

// Server-side refusal fallback: if the model declines, the API re-runs the request on a fallback model.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";
