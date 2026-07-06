export type LLMProviderName = "groq" | "openrouter" | "deepseek" | "mock";

export type GenerateTextInput = {
  task: string;
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type LLMProviderRequest = Omit<GenerateTextInput, "projectId" | "task"> & {
  task: string;
};

export type LLMProviderResponse = {
  provider: LLMProviderName;
  model: string;
  text: string;
};

export type GenerateTextResult = LLMProviderResponse & {
  logId: string;
};

export type LLMProvider = {
  name: LLMProviderName;
  model: string;
  isConfigured: () => boolean;
  generateText: (input: LLMProviderRequest) => Promise<LLMProviderResponse>;
};
