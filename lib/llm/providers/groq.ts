import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

const endpoint = "https://api.groq.com/openai/v1/chat/completions";

function apiKeys() {
  return (process.env.GROQ_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

async function callGroq(key: string, model: string, input: Parameters<LLMProvider["generateText"]>[0]) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
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
    throw new Error(`Groq request failed: ${response.status} ${JSON.stringify(data)}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Groq response did not contain text.");
  }

  return text.trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const groqProvider: LLMProvider = {
  name: "groq",
  model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  isConfigured: () => apiKeys().length > 0,
  async generateText(input) {
    const keys = apiKeys();
    if (!keys.length) throw new Error("GROQ_API_KEY is not configured.");

    const errors: string[] = [];

    for (const [index, key] of keys.entries()) {
      try {
        const text = await callGroq(key, this.model, input);
        return { provider: "groq", model: this.model, text };
      } catch (error) {
        errors.push(`key #${index + 1}: ${errorMessage(error)}`);
      }
    }

    throw new Error(`All Groq API keys failed. ${errors.join(" | ")}`);
  },
};
