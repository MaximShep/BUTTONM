const videoHelp =
  "Что можно сделать: загрузить видео вручную, вставить расшифровку, проверить ссылку или настроить yt-dlp/ffmpeg.";

function hasAny(value: string, tokens: string[]) {
  const lower = value.toLowerCase();
  return tokens.some((token) => lower.includes(token.toLowerCase()));
}

export function generationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (
    hasAny(message, [
      "LLM",
      "Groq",
      "OpenRouter",
      "DeepSeek",
      "All providers failed",
      "All LLM providers failed",
      "JSON",
      "API key",
      "rate limit",
      "timeout",
    ])
  ) {
    return "Не удалось подготовить сценарии: генератор сейчас не ответил корректно. Попробуйте ещё раз. Если ошибка повторится, проверьте настройки генерации.";
  }

  return message || "Не удалось подготовить сценарии. Попробуйте ещё раз.";
}

export function referenceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (message.includes(videoHelp)) return message;

  if (hasAny(message, ["yt-dlp", "ffmpeg", "download", "скачив", "аудио", "расшиф", "transcrib", "video"])) {
    return `${message} ${videoHelp}`;
  }

  if (hasAny(message, ["LLM", "JSON", "provider", "Groq", "OpenRouter", "DeepSeek"])) {
    return `Не удалось разобрать структуру референса автоматически. Вставьте расшифровку или краткое описание и нажмите «Обработать» ещё раз. ${videoHelp}`;
  }

  return message || `Не удалось обработать референс. ${videoHelp}`;
}

export function projectEventLabel(type: string) {
  const labels: Record<string, string> = {
    "project.created": "Проект создан",
    "brief.questions_analyzed": "Бриф проверен",
    "brief.questions_analysis_failed": "Не удалось проверить бриф автоматически",
    "questions.approved": "Ответы подтверждены",
    "references.added": "Референсы добавлены",
    "reference.added": "Референс добавлен",
    "reference.processed": "Референс обработан",
    "scripts.generated": "Сценарии сгенерированы",
    "scripts.generation_failed": "Генерация не завершилась",
  };

  return labels[type] ?? "Обновление проекта";
}
