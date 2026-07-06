import "server-only";

import type { LLMProvider } from "@/lib/llm/types";

function scriptsCountFromPrompt(prompt: string) {
  const match = prompt.match(/Generate exactly (\d+) scripts/i);
  return match ? Math.max(1, Math.min(Number(match[1]), 20)) : 2;
}

function referenceScriptsCountFromPrompt(prompt: string) {
  const match = prompt.match(/referenceScriptsCount = (\d+)/i);
  return match ? Math.max(0, Math.min(Number(match[1]), 20)) : 0;
}

function singleScriptNumberFromPrompt(prompt: string) {
  const match = prompt.match(/Generate script #(\d+) of \d+/i);
  return match ? Math.max(1, Math.min(Number(match[1]), 20)) : null;
}

function isSingleReferenceScript(prompt: string) {
  return /Set basedOnReference to true/i.test(prompt);
}

function mockGeneratedScript(index: number, referenceScriptsCount = 0) {
  const variants = [
    {
      title: "Пятничный заказ",
      hook: "Я нашла способ сделать пятничный заказ приятнее.",
      situation: "герой открывает приложение, выбирает акцию дня и показывает путь без лишних деталей.",
    },
    {
      title: "Совет перед оплатой",
      hook: "Если в пятницу берешь перекус, проверь это перед оплатой.",
      situation: "быстрые планы телефона, выбора акции и оплаты.",
    },
    {
      title: "POV перед заказом",
      hook: "POV: ты уже почти оплатил, но вспомнил проверить одну штуку.",
      situation: "телефон в руке, короткая проверка условий и спокойный финальный вывод.",
    },
  ];
  const variant = variants[(index - 1) % variants.length];

  return {
    number: index,
    title: index <= variants.length ? variant.title : `${variant.title} ${index}`,
    format: "Нативный UGC",
    idea: "Бытовая ситуация, где продукт появляется через действие героя.",
    text: [
      `0-3 сек: Крупный план телефона в руке. Герой говорит: «${variant.hook}»`,
      `3-7 сек: Герой показывает контекст: ${variant.situation}`,
      "7-12 сек: На экране виден нужный раздел продукта. Герой не объясняет рекламу, а делает конкретное действие.",
      "12-18 сек: Быстрые перебивки: палец выбирает условие, экран подтверждения, реакция героя.",
      "18-25 сек: VO: «Я так делаю перед заказом, потому что это занимает меньше минуты и не сбивает планы».",
      "25-30 сек: Финальный кадр с результатом действия. Титр: «Проверила -> выбрала -> оплатила. Всё».",
    ].join("\n"),
    integration: "Продукт встроен в действие героя и не выглядит отдельным рекламным блоком.",
    whyNative: "Сценарий похож на личную привычку или бытовой совет, а не на презентацию продукта.",
    basedOnReference: index <= referenceScriptsCount,
    referenceReason: index <= referenceScriptsCount
      ? "Взят быстрый бытовой вход, темп коротких кадров и мягкий финальный вывод из готового референса."
      : "",
  };
}

export const mockProvider: LLMProvider = {
  name: "mock",
  model: "mock-ugc-mvp",
  isConfigured: () => true,
  async generateText(input) {
    if (input.task === "analyze_brief_questions") {
      return {
        provider: "mock",
        model: this.model,
        text: JSON.stringify({
          readyToGenerate: false,
          summary: "Mock-анализ: не хватает только ключевых съемочных ограничений.",
          questions: [
            {
              question: "Где точно можно снять ролики: дома, в машине, на улице, в кафе или в точке продаж?",
              importance: "high",
              whyItMatters: "Локации сразу ограничивают форматы и действия в кадре.",
            },
            {
              question: "Можно ли звать в кадр других людей или сценарии должны быть только с тобой?",
              importance: "high",
              whyItMatters: "От этого зависит, можно ли писать диалоги и бытовые сценки.",
            },
          ],
        }),
      };
    }

    if (input.task === "generate_scripts") {
      const singleScriptNumber = singleScriptNumberFromPrompt(input.userPrompt);
      if (singleScriptNumber) {
        return {
          provider: "mock",
          model: this.model,
          text: JSON.stringify({
            script: mockGeneratedScript(singleScriptNumber, isSingleReferenceScript(input.userPrompt) ? singleScriptNumber : 0),
          }),
        };
      }

      const scriptsCount = scriptsCountFromPrompt(input.userPrompt);
      const referenceScriptsCount = referenceScriptsCountFromPrompt(input.userPrompt);
      return {
        provider: "mock",
        model: this.model,
        text: JSON.stringify({
          scripts: Array.from(
            { length: scriptsCount },
            (_, index) => mockGeneratedScript(index + 1, referenceScriptsCount),
          ),
        }),
      };
    }

    if (input.task === "extract_reference_scenario") {
      return {
        provider: "mock",
        model: this.model,
        text: JSON.stringify({
          summary: "Mock-анализ референса: короткий UGC с бытовым входом, быстрыми кадрами и личным выводом.",
          hook: "Начать с узнаваемой ситуации или микро-проблемы.",
          scenarioStructure: "Хук -> контекст -> 2-3 действия в кадре -> мягкое появление продукта -> личный вывод.",
          visualPattern: "Крупные планы рук и телефона, бытовая локация, короткие перебивки результата.",
          editingTempo: "Быстрый темп, смена кадра каждые 2-4 секунды, без длинных объяснений.",
          tone: "Разговорный, спокойный, без рекламного нажима.",
          whatToBorrow: ["структуру входа через проблему", "быстрые визуальные шаги", "личный финальный вывод"],
          whatNotToCopy: ["точные фразы", "конкретные шутки", "уникальные сцены автора"],
          extractedScenarioText: "Хук с бытовой ситуацией. Затем короткий контекст, серия действий в кадре, нативное появление продукта и финальный личный вывод.",
        }),
      };
    }

    if (input.task === "analyze_script_edits") {
      return {
        provider: "mock",
        model: this.model,
        text: JSON.stringify({
          summary: "Mock-анализ: правки убрали прямое объяснение и сделали интеграцию более бытовой.",
          badPatterns: [
            "Механика акции объяснялась длинной репликой вместо действия в кадре.",
            "Финал звучал как рекламный вывод, а не как личная рекомендация.",
          ],
          goodPatterns: [
            "Показывать выбор акции через экран приложения и короткие действия руками.",
            "Завершать сценарий личным наблюдением без призыва к покупке.",
          ],
          newStyleRules: [
            "Не объяснять механику акции длинной репликой: показывать ключевые шаги через действие в приложении и короткие подписи.",
            "Заменять рекламный финал на личный вывод из бытовой ситуации без прямого призыва купить.",
          ],
          phrasesToAvoid: ["выгодное предложение", "обязательно попробуй", "получи максимум выгоды"],
          phrasesToPrefer: ["я бы проверила перед заказом", "мне так проще", "занимает минуту"],
        }),
      };
    }

    if (input.task === "regenerate_script") {
      return {
        provider: "mock",
        model: this.model,
        text: JSON.stringify({
          script: {
            title: "POV перед пятничным заказом",
            format: "POV-сценка",
            idea: "Блогер ловит себя на том, что выбирает перекус на автомате, и быстро проверяет акцию перед оплатой.",
            text: [
              "Хук: «POV: ты уже почти оплатил заказ, но вспомнил проверить одну штуку».",
              "Кадр 1: телефон в руке, открыт экран заказа, палец зависает перед оплатой.",
              "Кадр 2: короткий переход в приложение банка, выбор пятничной акции без длинного объяснения.",
              "VO: «Я теперь перед пятничным заказом сначала проверяю акцию дня. Это быстрее, чем потом вспоминать, почему не сработал кэшбэк».",
              "Кадр 3: оплата картой Альфа-Банка, крупный план чека или экрана подтверждения.",
              "Финальный титр: «Проверить акцию -> выбрать -> оплатить картой. Всё».",
            ].join("\n"),
            integration: "Продукт встроен в действие перед оплатой: блогер проверяет акцию, выбирает ее и оплачивает картой.",
            whyNative: "Ситуация похожа на бытовую привычку перед заказом, без прямой продажи и длинного пересказа условий.",
          },
        }),
      };
    }

    return {
      provider: "mock",
      model: this.model,
      text: [
        "Mock LLM response.",
        `Task: ${input.task}`,
        `User prompt preview: ${input.userPrompt.slice(0, 240)}`,
      ].join("\n"),
    };
  },
};
