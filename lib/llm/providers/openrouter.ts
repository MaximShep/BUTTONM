import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";

function apiKey() {
  return process.env.OPENROUTER_API_KEY;
}

export const openRouterProvider: LLMProvider = {
  name: "openrouter",
  model: process.env.OPENROUTER_MODEL ?? "openrouter/auto",
  isConfigured: () => Boolean(apiKey()),
  async generateText(input) {
    const key = apiKey();
    if (!key) throw new Error("OPENROUTER_API_KEY is not configured.");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "UGC Scripts MVP",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userPrompt },
        ],
        temperature: input.temperature ?? 0.7,
        max_tokens: input.maxTokens ?? 1200,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("OpenRouter response did not contain text.");
    }

    return { provider: "openrouter", model: this.model, text: text.trim() };
  },
};
