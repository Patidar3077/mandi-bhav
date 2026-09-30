import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { claude, directOnly, model, FALLBACK_BETA } from "./client";
import { runTool, TOOL_DEFINITIONS } from "./tools";

const SYSTEM_RULES = `You are "Mandi AI", a helpful assistant for farmers and small traders around Mumbai and across Maharashtra. You answer questions about crop and vegetable mandi (APMC market) prices and where and when to sell.

How to answer:
- Reply in the same language and style the farmer writes in: English, Hindi or Marathi, including Hindi or Marathi typed in English letters. Keep answers short and simple, in plain words a farmer uses.
- Use prices ONLY from tool results. Never guess, estimate or recall a price from memory. If the tools return no data, say plainly that you don't have a price for that yet.
- Always mention the date of every price you state. Prices are in rupees per quintal (₹/quintal); also give ₹/kg (divide by 100) when helpful. Use Indian number formatting like ₹1,25,000.
- For future prices, use only get_forecast. Give a range, not a single number, and always add that it is an estimate based on past market prices, not a guaranteed price, and they should check with their mandi before selling. If the forecast is not available, say how many more days of data are needed.
- If stored data is missing or old for the crop and place asked about, call fetch_live_prices once, then answer from what it returned.
- Default to the farmer's district unless they name another place. For "nearby" questions use compare_markets.
- You can explain the numbers and point out better-priced mandis, but don't give personal financial or legal advice, and remind them to count transport costs when suggesting a farther mandi.
- Anything about what might move prices (season, festivals, rain, arrivals) must be worded as a possibility, not a fact.
- Stay on topic: crops, mandi prices and selling. Politely decline unrelated requests.
- Don't use markdown tables or headings; short sentences or a short list are fine.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatContext = {
  district: string;
  today: string;
  language: string;
  viewing?: { commodity: string; district: string; market: string | null } | null;
};

const MAX_TOOL_ROUNDS = 6;

/** Runs the tool loop and returns the final answer text. `onTool` reports progress to the UI. */
export async function answer(history: ChatTurn[], ctx: ChatContext, onTool: (name: string) => void): Promise<string> {
  const contextNote = [
    `Today's date (India): ${ctx.today}.`,
    `Farmer's district: ${ctx.district}.`,
    `App language setting: ${ctx.language} (still reply in the language the farmer writes in).`,
    ctx.viewing
      ? `The farmer is currently looking at ${ctx.viewing.commodity} in ${ctx.viewing.market ?? `${ctx.viewing.district} (all nearby mandis)`}; assume this crop and place when the question doesn't name one.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));

  const client = await claude();
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: model(),
      max_tokens: 4000,
      ...directOnly({
        betas: [FALLBACK_BETA],
        fallbacks: "default" as const,
        output_config: { effort: "medium" as const },
      }),
      system: [
        { type: "text", text: SYSTEM_RULES },
        { type: "text", text: contextNote },
      ],
      tools: TOOL_DEFINITIONS,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return "Sorry, I can't help with that. Please ask me about crop prices or mandis.";
    }

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (!toolUses.length || response.stop_reason === "max_tokens") {
      return text || "Sorry, I couldn't find an answer. Please try asking in a different way.";
    }

    messages.push({ role: "assistant", content: response.content });
    const results = await Promise.all(
      toolUses.map(async (tool): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        onTool(tool.name);
        try {
          const output = await runTool(tool.name, tool.input, { defaultDistrict: ctx.district });
          return { type: "tool_result", tool_use_id: tool.id, content: JSON.stringify(output) };
        } catch (err) {
          console.error(`[chat] tool ${tool.name} failed`, err);
          return {
            type: "tool_result",
            tool_use_id: tool.id,
            is_error: true,
            content: "The data lookup failed. Tell the farmer you couldn't get the data right now.",
          };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return "Sorry, that took too long. Please try a simpler question.";
}
