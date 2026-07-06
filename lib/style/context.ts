import "server-only";

import { prisma } from "@/lib/prisma";

const MAX_RULES = 8;
const MAX_EXAMPLES = 2;
const MAX_FRAGMENT_LENGTH = 900;

function compactText(text: string, maxLength: number) {
  const compacted = text.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength).trim()}...`;
}

export async function buildStyleContext(userId: string, options: { includeExampleScriptText?: boolean } = {}) {
  const [rules, examples] = await Promise.all([
    prisma.styleRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: MAX_RULES,
    }),
    prisma.styleExample.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: "desc" },
      take: MAX_EXAMPLES,
    }),
  ]);

  const rulesText = rules.length
    ? rules.map((rule, index) => `${index + 1}. ${rule.rule}`).join("\n")
    : "Пользовательские правила стиля пока не заданы.";

  const examplesText = examples.length
    ? examples
        .map((example, index) =>
          [
            `Кейс ${index + 1}: ${example.title}`,
            example.briefText ? `Бриф кейса:\n${compactText(example.briefText, MAX_FRAGMENT_LENGTH)}` : "",
            options.includeExampleScriptText
              ? `Финальные сценарии:\n${compactText(example.finalScriptsText || example.scriptsText, MAX_FRAGMENT_LENGTH)}`
              : "Финальные сценарии не передаются в prompt дословно, чтобы модель не копировала эталонный ответ.",
            example.comment ? `Почему это хороший пример:\n${compactText(example.comment, 700)}` : "",
          ].filter(Boolean).join("\n\n"),
        )
        .join("\n\n")
    : "Эталонные кейсы пока не добавлены.";

  return [
    "Контекст стиля блогера:",
    "",
    "Правила стиля:",
    rulesText,
    "",
    "Эталонные кейсы:",
    examplesText,
    "",
    "Запрещено буквально копировать формулировки, сцены, шутки, титры, последовательность фраз и конкретные ходы из эталонных кейсов.",
    options.includeExampleScriptText
      ? "Из кейсов нужно брать только структуру, темп, способ интеграции продукта, тон и формат, адаптируя их под новый бриф."
      : "Сырые тексты эталонных сценариев скрыты. Учитывай только правила, комментарии и общую роль кейсов как стилевого ориентира.",
  ].join("\n");
}
