import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

const endpoint = "https://api.deepseek.com/chat/completions";

function apiKey() {
  return process.env.DEEPSEEK_API_KEY;
}

export const deepSeekProvider: LLMProvider = {
  name: "deepseek",
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  isConfigured: () => Boolean(apiKey()),
  async generateText(input) {
    const key = apiKey();
    if (!key) throw new Error("DEEPSEEK_API_KEY is not configured.");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
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
      throw new Error(`DeepSeek request failed: ${response.status} ${JSON.stringify(data)}`);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("DeepSeek response did not contain text.");
    }

    return { provider: "deepseek", model: this.model, text: text.trim() };
  },
};
