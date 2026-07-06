import "server-only";

import { deepSeekProvider } from "@/lib/llm/providers/deepseek";
import { groqProvider } from "@/lib/llm/providers/groq";
import { mockProvider } from "@/lib/llm/providers/mock";
import { openRouterProvider } from "@/lib/llm/providers/openrouter";
import type { GenerateTextInput, GenerateTextResult, LLMProvider, LLMProviderName } from "@/lib/llm/types";
import { prisma } from "@/lib/prisma";

const providers: Record<LLMProviderName, LLMProvider> = {
  groq: groqProvider,
  openrouter: openRouterProvider,
  deepseek: deepSeekProvider,
  mock: mockProvider,
};

function parseProviderName(value: string | undefined): LLMProviderName | null {
  if (value === "groq" || value === "openrouter" || value === "deepseek" || value === "mock") {
    return value;
  }

  return null;
}

function providerOrder(): LLMProviderName[] {
  const primary = parseProviderName(process.env.LLM_PROVIDER) ?? "mock";
  const allowMockFallback = primary === "mock" || process.env.LLM_ALLOW_MOCK_FALLBACK === "true";
  const fallback = (process.env.LLM_FALLBACK_PROVIDERS ?? "groq,openrouter,deepseek,mock")
    .split(",")
    .map((provider) => parseProviderName(provider.trim()))
    .filter((provider) => allowMockFallback || provider !== "mock")
    .filter((provider): provider is LLMProviderName => Boolean(provider));

  return Array.from(new Set<LLMProviderName>([
    primary,
    ...fallback,
    ...(allowMockFallback ? ["mock" as const] : []),
  ]));
}

function formatPromptForLog(input: GenerateTextInput) {
  return JSON.stringify({
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    temperature: input.temperature ?? 0.7,
    maxTokens: input.maxTokens ?? 1200,
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const prompt = formatPromptForLog(input);
  const errors: string[] = [];

  for (const providerName of providerOrder()) {
    const provider = providers[providerName];

    try {
      if (!provider.isConfigured()) {
        throw new Error(`${provider.name} provider is not configured.`);
      }

      const response = await provider.generateText({
        task: input.task,
        systemPrompt: input.systemPrompt,
        userPrompt: input.userPrompt,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
      });

      const log = await prisma.lLMLog.create({
        data: {
          projectId: input.projectId,
          provider: response.provider,
          model: response.model,
          task: input.task,
          prompt,
          response: response.text,
          error: null,
        },
      });

      return { ...response, logId: log.id };
    } catch (error) {
      const message = errorMessage(error);
      errors.push(`${provider.name}: ${message}`);

      await prisma.lLMLog.create({
        data: {
          projectId: input.projectId,
          provider: provider.name,
          model: provider.model,
          task: input.task,
          prompt,
          response: null,
          error: message,
        },
      });
    }
  }

  throw new Error(`All LLM providers failed. ${errors.join(" | ")}`);
}
