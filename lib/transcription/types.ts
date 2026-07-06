import "server-only";

export type TranscriptionProviderName = "mock" | "openai" | "local";

export type TranscriptionRequest = {
  audioPath: string;
  outputDir: string;
};

export type TranscriptionResult = {
  provider: TranscriptionProviderName;
  text: string;
};

export type TranscriptionProvider = {
  name: TranscriptionProviderName;
  isConfigured: () => boolean;
  transcribe: (input: TranscriptionRequest) => Promise<TranscriptionResult>;
};
