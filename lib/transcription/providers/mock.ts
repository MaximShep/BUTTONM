import "server-only";

import type { TranscriptionProvider } from "@/lib/transcription/types";

export const mockTranscriptionProvider: TranscriptionProvider = {
  name: "mock",
  isConfigured: () => true,
  async transcribe() {
    return {
      provider: "mock",
      text: [
        "MOCK TRANSCRIPTION: это тестовая расшифровка, реальное аудио не распознавалось.",
        "Хук: герой начинает с бытовой проблемы и быстро показывает контекст.",
        "Основная часть: несколько коротких кадров, личное наблюдение, продукт появляется через действие.",
        "Финал: простой вывод без прямой продажи.",
      ].join("\n"),
    };
  },
};
