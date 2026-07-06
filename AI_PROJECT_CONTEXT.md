# AI Project Context

Этот файл нужно читать перед каждым запуском работы над проектом.

## Что это за проект

Это MVP веб-сервиса для одного блогера, который помогает создавать UGC-сценарии по рекламному брифу.

Типичный процесс:

1. Заказчик присылает рекламный бриф.
2. Блогер создает проект и сохраняет текст брифа.
3. Сервис автоматически анализирует бриф и задает только важные уточняющие вопросы.
4. Сервис генерирует N коротких сценариев для вертикальных роликов.
5. Блогер редактирует сценарии прямо в платформе.
6. Блогер может перегенерировать один неудачный сценарий с причиной, не трогая остальные.
7. Сервис анализирует правки блогера и сохраняет конкретные правила стиля для следующих генераций.
8. В будущем сценарии можно будет экспортировать.

Текущая цель MVP: пользователь может войти, увидеть dashboard, создать проект из PDF-брифа или ручного текста, добавить комментарий к генерации и проектные референсы, после создания проекта автоматически получить важные уточняющие вопросы по брифу, подтвердить ответы на странице проекта, настроить память стиля, вручную запустить генерацию сценариев, редактировать сценарии, сохранять историю ручных правок, анализировать правки для обучения стиля и перегенерировать один сценарий с учетом причины.

Референсы уже являются рабочей частью MVP: пользователь может добавить YouTube/TikTok/Instagram Reels ссылку, загрузить видеофайл или вставить ручную расшифровку. Сервис скачивает публичные ссылки через `yt-dlp`, извлекает аудио через `ffmpeg`, расшифровывает локально через `faster-whisper`, сохраняет `ProjectReference.transcriptText`, извлекает сценарную структуру и использует только готовые референсы в генерации.

Генерация сценариев запускается только по кнопке "Сгенерировать сценарии" на странице проекта. Автоматически после создания проекта полные сценарии не генерируются, чтобы не тратить LLM-токены без действия пользователя.

## Исходные материалы

В корне проекта лежат два PDF-файла:

- `Бриф_АБ_ВиТ.pdf` - пример рекламного брифа.
- `сценарии_oblv9o.pdf` - эталонные сценарии, написанные по этому брифу.

Нельзя переписывать эти файлы и нельзя дублировать их содержимое в коде. Приложение должно ссылаться на них как на исходные материалы через `lib/files/source-materials.ts`.

Метаданные исходников вынесены в `lib/files/source-materials-data.ts`, потому что Prisma seed запускается через обычный `tsx` вне Next runtime и не может импортировать модули с `server-only`. Next-серверный слой продолжает использовать `lib/files/source-materials.ts`.

## Стек

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite для локального MVP
- Возможность позже заменить SQLite на PostgreSQL

## Основные папки

- `app/` - страницы и API routes.
- `components/` - компоненты интерфейса.
- `components/ui/` - локальные UI-примитивы в духе shadcn.
- `lib/` - серверная логика и инфраструктурные модули.
- `lib/llm/` - LLM Gateway, типы и провайдеры.
- `lib/prompts/` - промпты анализа брифа и генерации сценариев.
- `lib/files/` - доступ к исходным файлам проекта.
- `lib/export/` - будущий экспорт.
- `prisma/` - Prisma schema, migrations, seed.
- `docs/` - дополнительная документация.

## Auth

Авторизация простая: login/password.

Пользователь создается вручную через seed или Prisma. OAuth, email confirmation и восстановление пароля не нужны для MVP.

Текущий dev-пользователь:

- login: `blogger`
- password: `password123`

Логин, logout и создание проекта сделаны через API routes, а не Server Actions:

- `POST /api/login`
- `POST /api/logout`
- `POST /api/projects`
- `PATCH /api/projects/[id]/questions/[questionId]`
- `POST /api/projects/[id]/questions/approve`
- `POST /api/projects/[id]/scripts/generate`
- `PATCH /api/projects/[id]/scripts/[scriptId]`
- `POST /api/projects/[id]/scripts/[scriptId]/analyze-edits`
- `POST /api/projects/[id]/scripts/[scriptId]/regenerate`
- `POST /api/settings/style/rules`
- `POST /api/settings/style/examples`
- `GET /api/dev/llm-test` - dev-only проверка LLM Gateway на последнем проекте пользователя или на `?projectId=...`.

Причина: в dev-режиме Next.js Server Actions могут ломаться после перезапуска сервера из-за устаревших action-id в открытой вкладке.

## Доступ к данным

Пользователь должен видеть только свои проекты.

Обязательные проверки:

- dashboard фильтрует проекты по `userId`;
- страница проекта ищет проект по `id` и `userId`;
- страница сценария проверяет владельца через `project.userId`;
- создание проекта берет `userId` только из текущей сессии, не из формы.
- генерация сценариев проверяет проект по `id` и `userId`;
- редактирование сценария, смена статуса, клиентское одобрение, сохранение эталона, legacy-анализ правок и перегенерация одного сценария проверяют сценарий через `project.userId`;
- настройки стиля создают `StyleRule` и `StyleExample` только для текущего пользователя;
- dev route для LLM-теста берет проект только текущего пользователя.

## Создание проекта из брифа

На `/projects/new` пользователь делает первый рабочий шаг: создает отдельный проект и передает входные данные для будущей генерации.

- вводит название проекта;
- вводит бренд;
- выбирает количество сценариев;
- загружает PDF-бриф или вставляет текст вручную;
- добавляет комментарий к генерации;
- указывает, сколько сценариев делать по референсам;
- может добавить несколько проектных референсов:
  - TikTok URL;
  - YouTube URL;
  - Instagram Reels URL;
  - видеофайл;
  - ручное описание или расшифровку.

Если загружен PDF-бриф, сервер извлекает текст через `lib/files/extractPdfText.ts`. Для MVP файл брифа не хранится: сохраняются только `Project.briefText` и `Project.briefFileName`.

Если загружен видеофайл-референс, файл сохраняется локально рядом с референсом, а путь пишется в `ProjectReference.localFilePath`. Автоматическая загрузка YouTube/TikTok/Instagram Reels, извлечение аудио, транскрибация и extraction сценария реализованы через `processReference(referenceId)`. Если окружение не настроено или ссылка недоступна, референс не удаляется: пользователь видит ошибку, может вставить `transcriptText` вручную и снова нажать "Обработать".

После создания проект получает:

- `title`;
- `brand`;
- `briefText`;
- `briefFileName`;
- `generationComment`;
- `scriptsCount`;
- `referenceScriptsCount`;
- `status = "questions_pending"`;
- `currentStep = "questions"`.

Референсы сохраняются в `ProjectReference` со статусом `added`, если в блоке есть URL, файл, описание или расшифровка.

Кнопка формы: "Создать проект и перейти к вопросам". После создания пользователь попадает на `/projects/[id]`, где основным экраном становится этап вопросов. Форма загрузки брифа больше не является частью workspace проекта.

Сразу после создания проекта сервер вызывает анализ брифа через `lib/projects/briefQuestions.ts` и prompt `lib/prompts/analyzeBriefPrompt.ts`.

Результат анализа:

- сохраняется в `ProjectQuestion`;
- пишется событие `brief.questions_analyzed`;
- если есть важные вопросы, проект остается на `status = "questions_pending"` и `currentStep = "questions"`;
- если вопросов нет, проект получает `status = "questions_approved"` и `currentStep = "generation"`;
- если LLM упал, проект все равно создается, а ошибка пишется в `ProjectEvent` с типом `brief.questions_analysis_failed`.

Уточняющие вопросы должны быть только важными:

- сохранять только `importance = "high"`;
- максимум 3 вопроса;
- если данных достаточно, вопросов может быть 0;
- не спрашивать то, что уже есть в брифе;
- не спрашивать, можно ли нарушить требования брифа;
- не задавать вопросы "ради вопросов";
- формулировать конкретно и по-человечески, обращаясь к блогеру на "ты".

## Workspace проекта

Страница `/projects/[id]` является живым workspace, а не админкой. Она показывает только текущий этап работы. Логика этапа централизована в `lib/projects/getProjectStep.ts`.

Поддерживаемые значения `Project.currentStep`:

- `questions`;
- `generation`;
- `scripts`;
- `export`.

Если `currentStep` отсутствует или некорректен, `getProjectStep(project)` выводит шаг по `Project.status` и наличию сценариев.

На странице проекта всегда видны:

- ссылка назад;
- название проекта;
- короткая подпись "Бриф загружен и сохранен в проекте";
- две вторичные кнопки: "Как это работает?" и "Детали проекта".

Не показывать одновременно:

- большой workflow;
- полный текст брифа;
- все вопросы;
- все сценарии;
- справочные описания.

Справка "Как это работает?" скрыта по умолчанию и открывает небольшой modal с этапами: бриф, вопросы, генерация, редактура, одобрение, память стиля.

"Детали проекта" скрыты по умолчанию и открывают modal, где можно посмотреть:

- текст брифа;
- комментарий к генерации;
- ответы на вопросы;
- проектные референсы;
- события проекта.

В этом же modal есть рабочий UI референсов:

- добавление YouTube/TikTok/Instagram Reels ссылки;
- загрузка видео;
- ручная расшифровка;
- заметки;
- статус обработки;
- checkbox `useInGeneration`;
- кнопки "Обработать" и "Удалить";
- preview `transcriptText`, ошибки и `extractedScenarioText`.

На странице проекта есть блок "Уточняющие вопросы":

- показывается только на шаге `questions`;
- вопросы показываются без отдельной кнопки "Проверить бриф";
- пользователь заполняет поля ответов;
- кнопка "Подтвердить ответы" вызывает `POST /api/projects/[id]/questions/approve`;
- после подтверждения ответы сохраняются, проект получает `status = "questions_approved"` и `currentStep = "generation"`;
- блок вопросов исчезает из основного экрана;
- если вопросов нет после анализа, показывается "Данных достаточно для генерации".

На шаге `generation` показывается только:

- краткое резюме "Бриф принят, ответы подтверждены, стиль подключен";
- количество сценариев;
- поле "Сколько сценариев сделать по референсам?";
- значение по референсам ограничено диапазоном от 0 до `Project.scriptsCount`;
- если готовых референсов нет, поле disabled и значение равно 0;
- кнопка "Сгенерировать сценарии".

На шаге `scripts` показывается только:

- список сценариев;
- фильтры по статусам;
- вторичная кнопка "Пересобрать сценарии" с `window.confirm`;
- карточки сценариев: номер, название, формат, короткая идея, статус, бейдж "по референсу", кнопка "Открыть";
- длинные preview сценариев не показываются;
- страница сценария `/projects/[id]/scripts/[scriptId]` содержит рабочий редактор: большой текст сценария, комментарий к сохранению, главную кнопку "Сохранить", dropdown статуса, отдельное сильное действие "Одобрено заказчиком", явное сохранение эталона, перегенерацию, блок "Не в моем стиле", компактную историю изменений и свернутую исходную генерацию.

Пример PDF-брифа в корне проекта можно использовать только как тестовый файл для загрузки и извлечения текста. Нельзя переписывать его содержимое в код.

## LLM Gateway

LLM-слой подключен к анализу брифа, ручной генерации сценариев, анализу правок, явному сохранению одобренного сценария как эталона и перегенерации одного сценария.

Основные файлы:

- `lib/llm/types.ts` - общий интерфейс и типы.
- `lib/llm/gateway.ts` - единая функция `generateText`.
- `lib/llm/providers/groq.ts` - Groq provider.
- `lib/llm/providers/openrouter.ts` - OpenRouter provider.
- `lib/llm/providers/deepseek.ts` - DeepSeek provider.
- `lib/llm/providers/mock.ts` - mock provider без внешнего API.

Единый интерфейс:

```ts
generateText({
  task,
  projectId,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
})
```

Все API-ключи читаются только из `.env`. Ключи нельзя хардкодить.

Обязательные env-переменные в `.env.example`:

```bash
GROQ_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=
LLM_PROVIDER=groq
LLM_FALLBACK_PROVIDERS=groq,openrouter,deepseek,mock
LLM_ALLOW_MOCK_FALLBACK=false
```

`GROQ_API_KEY` поддерживает несколько ключей через запятую: `GROQ_API_KEY=gsk_key1,gsk_key2,gsk_key3`. Groq provider пробует ключи по очереди. Если все Groq-ключи не сработали, gateway переходит к следующему провайдеру из `LLM_FALLBACK_PROVIDERS`.

Если основной провайдер не настроен или упал, gateway пробует следующий из fallback list. `mock` не должен молча подменять реальную генерацию сценариев: он используется только если `LLM_PROVIDER=mock` или явно задано `LLM_ALLOW_MOCK_FALLBACK=true`. Это важно, потому что mock нужен для dev smoke-тестов, но не должен создавать "успешные" мусорные сценарии при ошибке реального LLM.

Текущее локальное состояние:

- в `.env` основной провайдер переключен на `LLM_PROVIDER=groq`;
- в `GROQ_API_KEY` можно хранить несколько ключей через запятую;
- проверка показала, что 3 Groq-ключа работают;
- `OPENROUTER_API_KEY` работает;
- `DEEPSEEK_API_KEY` распознается API, но DeepSeek вернул `402 Insufficient Balance`, значит для работы DeepSeek нужно пополнить баланс;
- smoke-test через `GET /api/dev/llm-test?projectId=...` вернул `provider: "groq"` и записал успешный `LLMLog`.

Каждая попытка обращения к провайдеру пишет запись в `LLMLog`:

- `provider`;
- `model`;
- `task`;
- `prompt`;
- `response`;
- `error`.

Для проверки в dev-режиме есть `GET /api/dev/llm-test`. Он требует авторизации, берет последний проект текущего пользователя или проект из `?projectId=...`, вызывает `generateText`, возвращает JSON и пишет `LLMLog`. В production route возвращает 404.

### Анализ брифа

Основные файлы:

- `lib/prompts/analyzeBriefPrompt.ts` - prompt для анализа брифа.
- `lib/projects/briefQuestions.ts` - вызов LLM, парсинг JSON, фильтрация и сохранение вопросов.
- `components/ProjectQuestions.tsx` - блок вопросов и ответов на странице проекта.

LLM возвращает JSON:

```json
{
  "readyToGenerate": true,
  "summary": "...",
  "questions": [
    {
      "question": "...",
      "importance": "high",
      "whyItMatters": "..."
    }
  ]
}
```

На сервере сохраняются только вопросы с `importance = "high"`, максимум 3.

### Генерация сценариев

Генерация сценариев уже подключена:

- `lib/prompts/generateScriptsPrompt.ts` - prompt для генерации сценариев;
- `lib/projects/scripts.ts` - вызов LLM, парсинг JSON, сохранение сценариев;
- `POST /api/projects/[id]/scripts/generate` - API route для ручного запуска;
- `components/ProjectScripts.tsx` - кнопка генерации и карточки сценариев.

Prompt учитывает:

- `Project.briefText`;
- `Project.scriptsCount`;
- `Project.generationComment`;
- `Project.referenceScriptsCount`;
- `Script.basedOnReference`;
- `Script.referenceReason`;
- только готовые проектные референсы: `useInGeneration = true`, `status = "ready"`, непустой `extractedScenarioText`;
- ответы на `ProjectQuestion`;
- style context из `buildStyleContext(userId)`;
- запреты, обязательную механику, хронометраж и требования из брифа;
- тональность блогера;
- запрет на буквальное копирование эталонных сценариев.

Важно про эталонные кейсы: генерация сценариев не должна передавать в LLM дословный текст `StyleExample.finalScriptsText` / `scriptsText`. Это особенно критично при тесте на том же брифе, что и локальный эталон `сценарии_oblv9o.pdf`: иначе модель фактически видит часть правильного ответа и может скопировать структуру, сцены или формулировки. Для генерации используется `buildStyleContext(userId, { includeExampleScriptText: false })`: правила стиля, комментарии и наличие кейсов учитываются, но сырые финальные сценарии скрыты.

Генерация полного набора сценариев не должна отправлять весь набор в один большой LLM-запрос. Сервер генерирует сценарии последовательно: один LLM-запрос на один сценарий. Это нужно, чтобы:

- не превышать бесплатные Groq/OpenRouter лимиты по TPM и `max_tokens`;
- не смешивать несколько сценариев внутри одного ответа;
- сохранять качество подробного посекундного сценария;
- не создавать частичный набор сценариев, если один из LLM-запросов сломался.

При генерации сначала все сценарии собираются и валидируются в памяти. Только если все `scriptsCount` сценариев валидны, сервер в одной транзакции удаляет старый набор и создает новый. Если любой отдельный запрос вернул плохой JSON, короткие заметки или упал по лимиту, старые сценарии не трогаются и новый мусор не сохраняется.

Правила качества генерации:

- каждый сценарий должен быть полноценным редактируемым сценарием, расписанным по секундам;
- если в брифе указан хронометраж, `text` должен покрывать именно этот хронометраж;
- если хронометраж не указан, использовать 0-30 секунд;
- каждый тайм-блок должен содержать кадр/действие героя, реплику или VO, титр при необходимости и место появления продукта;
- нельзя возвращать вместо сценария плейсхолдеры вроде "hook", "стиль разговора", "визуальный паттерн", "показать продукт";
- сценарии после первых `referenceScriptsCount` не обязаны опираться на референсы, но должны быть такими же подробными и основанными на брифе, комментарии, ответах и стиле.
- для сценариев по референсам формат и тон готового проектного референса важнее общих style rules. Если референс разговорный, dialogue-based, interview-like или talk-to-camera, итоговый сценарий тоже должен сохранять этот формат, а не превращаться автоматически в POV от первого лица.
- референс нельзя сводить только к "структуре" и "темпу". `buildReferenceContext(projectId)` передает в prompt reference adaptation contract: speaker setup, camera/visual setup, delivery mechanic, product integration pattern, mustPreserve и короткий transcript sample только для распознавания формата. Модель должна сохранить механику формата референса и адаптировать продукт под новый бриф, не копируя фразы.

Каждый отдельный LLM-запрос генерации должен вернуть JSON:

```json
{
  "script": {
    "number": 1,
    "title": "...",
    "format": "...",
    "idea": "...",
    "text": "...",
    "integration": "...",
    "whyNative": "...",
    "basedOnReference": true,
    "referenceReason": "..."
  }
}
```

Parser для совместимости умеет принять legacy-ответ `{ "scripts": [...] }`, но основной prompt должен просить именно один объект `script`.

### Референсы и транскрибация

Основные файлы:

- `lib/references/types.ts` - `ProjectReference.type` и `detectReferenceType(url)`.
- `lib/references/downloadReference.ts` - скачивание публичных YouTube/TikTok/Instagram Reels через `yt-dlp`.
- `lib/references/extractAudio.ts` - извлечение `audio.mp3` через `ffmpeg`.
- `lib/references/processReference.ts` - единая функция `processReference(referenceId)`.
- `lib/references/context.ts` - `buildReferenceContext(projectId)` для генерации.
- `lib/transcription/transcriptionGateway.ts` - выбор провайдера транскрибации.
- `lib/transcription/providers/localWhisper.ts` - бесплатная локальная расшифровка через Python.
- `scripts/transcribe_local.py` - CLI-скрипт `faster-whisper`, возвращает JSON.
- `scripts/transcribe_test.ts` - проверка окружения, команда `npm run transcribe:test`.
- `README_TRANSCRIPTION.md` - инструкция по установке и диагностике.

Поддерживаемые типы `ProjectReference.type`:

- `youtube`;
- `tiktok`;
- `instagram`;
- `uploaded_video`;
- `manual`.

`detectReferenceType(url)`:

- `youtube.com` или `youtu.be` -> `youtube`;
- `tiktok.com` или `vm.tiktok.com` -> `tiktok`;
- `instagram.com/reel`, `instagram.com/p`, `instagram.com/tv` -> `instagram`;
- иначе `manual` или `unknown`.

Pipeline `processReference(referenceId)`:

- `manual`: если есть `transcriptText` или `notes`, сразу извлекает сценарную структуру.
- `uploaded_video`: извлекает аудио -> транскрибирует -> сохраняет `transcriptText` -> извлекает сценарную структуру.
- `youtube`, `tiktok`, `instagram`: скачивает через `yt-dlp` -> извлекает аудио -> транскрибирует -> сохраняет `transcriptText` -> извлекает сценарную структуру.

Extraction структуры референса должна сохранять не только summary/structure, но и "ДНК формата":

- `formatDNA`;
- `speakerSetup`;
- `cameraAndVisualSetup`;
- `deliveryMechanic`;
- `productIntegrationPattern`;
- `mustPreserve`;
- `scenarioStructure`;
- `visualPattern`;
- `editingTempo`;
- `tone`.

Это нужно, чтобы разговорные, interview-like, screen demo или direct-to-camera референсы не превращались при генерации в generic POV-ситуации.

Старые референсы, обработанные до появления этих полей, могут не иметь `formatDNA`, `speakerSetup`, `deliveryMechanic` и `mustPreserve` в `extractedScenarioText`. Для них `buildReferenceContext` использует fallback: `visualPattern`, `scenarioStructure`, `tone` и короткий `transcriptText` sample для распознавания формата. Для лучшего качества такие референсы нужно заново обработать кнопкой "Обработать" в деталях проекта.

Статусы обновляются по шагам: `processing`, `downloading`, `extracting_audio`, `downloading_model`, `transcribing`, `extracting_scenario`, `ready`, `failed`. Статус `downloading_model` ставится перед локальной транскрибацией, если выбранная модель `faster-whisper` еще не найдена в Hugging Face cache.

Важно:

- Instagram работает только для публичных ссылок и может ограничивать скачивание.
- В MVP не делать авторизацию Instagram, не просить логин/пароль, не обходить приватные аккаунты.
- Если `yt-dlp`, `ffmpeg` или `faster-whisper` недоступны, приложение не падает: `ProjectReference.status = "failed"`, `error` содержит понятный текст, пользователь может вставить расшифровку вручную.
- Локально файлы пишутся в `data/references`, если `REFERENCE_DATA_DIR` не задан. На VPS можно поставить `REFERENCE_DATA_DIR=/data/references`.

Env для бесплатной локальной транскрибации:

```bash
TRANSCRIPTION_PROVIDER=local
LOCAL_WHISPER_MODEL=small
LOCAL_WHISPER_LANGUAGE=ru
LOCAL_WHISPER_PYTHON=python3
REFERENCE_DATA_DIR=data/references
```

Провайдеры транскрибации:

- `TRANSCRIPTION_PROVIDER=local` - основной бесплатный режим через `faster-whisper`.
- `TRANSCRIPTION_PROVIDER=mock` - dev fallback без реальной расшифровки.
- `TRANSCRIPTION_PROVIDER=openai` - OpenAI transcription API, не основной режим.

Текущее локальное состояние окружения:

- `ffmpeg` установлен через Homebrew и доступен в `/opt/homebrew/bin/ffmpeg`.
- `yt-dlp` установлен через `python3 -m pip install yt-dlp` и доступен как `yt-dlp` и `python3 -m yt_dlp`.
- `faster-whisper` установлен через `python3 -m pip install faster-whisper`.
- `downloadReference.ts` сначала пробует команду `yt-dlp`, а если ее нет в PATH процесса, fallback на `python3 -m yt_dlp`.
- Модель `Systran/faster-whisper-small` уже скачана в Hugging Face cache; основной файл модели около 461 MB.

Сервер:

- извлекает JSON даже если модель добавила лишний текст вокруг объекта;
- для сценариев умеет чинить частый дефект LLM: сырые переносы строк внутри JSON-строк;
- делает отдельный LLM-запрос на каждый сценарий;
- каждый отдельный запрос просит JSON `{ "script": ... }`, но parser умеет принять и legacy `{ "scripts": [...] }`;
- ограничивает `maxTokens` одного сценария, чтобы бесплатные модели проходили лимиты;
- требует ровно `scriptsCount` валидных сценариев перед сохранением;
- требует, чтобы каждый сценарий был достаточно длинным и содержал минимум несколько таймкодов;
- если LLM вернул короткие заметки, плейсхолдеры или неполный JSON, сценарии не создаются;
- пересоздает набор сценариев проекта;
- сохраняет `Script.generatedText` как полный редактируемый текст;
- выставляет `Script.editedText = generatedText`;
- выставляет `Script.basedOnReference = true` только для первых `referenceScriptsCount` сценариев при наличии готовых референсов;
- сохраняет `Script.referenceReason` для сценариев по референсам;
- выставляет `Script.status = "draft"`;
- выставляет `Project.status = "scripts_generated"` и `Project.currentStep = "scripts"`;
- пишет `ProjectEvent` с типом `scripts.generated`;
- при ошибке выставляет `Project.status = "script_generation_failed"` и оставляет `Project.currentStep = "generation"`.

Сценарии должны быть нативными: без прямого рекламного тона, без сухого списка преимуществ, с появлением продукта внутри жизненной ситуации через действие героя.

### Редактор сценария

Страница `/projects/[id]/scripts/[scriptId]` реализована как серверная страница плюс client component `components/ScriptEditor.tsx`.

Она показывает:

- название сценария;
- формат;
- большой редактор финального текста;
- комментарий к сохранению;
- главную кнопку "Сохранить";
- статус через dropdown справа;
- большую кнопку "Одобрено заказчиком";
- плашку с предложением "Запомнить как эталон" после клиентского одобрения;
- блок перегенерации;
- блок "Не в моем стиле";
- исходную генерацию в collapsible "Показать исходную генерацию", по умолчанию закрыт;
- историю последних `ScriptRevision`.

Редактор:

- автосохраняет `editedText` через `PATCH /api/projects/[id]/scripts/[scriptId]`;
- ручная кнопка "Сохранить" создает `ScriptRevision`, если текст изменился относительно последней ручной ревизии или исходной версии;
- поддерживает статусы `draft`, `needs_revision`, `approved_by_creator`, `approved_by_client`, `rejected`, `reference_quality`;
- при открытии legacy-статус `approved` отображается как `approved_by_creator`;
- смена статуса идет через dropdown;
- действие "Одобрено заказчиком" отдельно выставляет `approved_by_client`, `approvedByClientAt` и пишет событие;
- действие "Запомнить как эталон" отдельно запускает LLM-анализ и сохраняет style case;
- кнопка "Не в моем стиле" ставит `rejected` и пишет `ProjectEvent` с типом `script.rejected_not_style` и причиной.

На странице сценария больше не показываются старые нижние кнопки:

- "Одобрить";
- "Нужно переделать";
- "Проанализировать правки".

`generatedText` не меняется при обычном редактировании. Он меняется только при перегенерации одного сценария.

### Перегенерация одного сценария

Один сценарий можно перегенерировать без перегенерации всего проекта.

Основные файлы:

- `lib/prompts/regenerateScriptPrompt.ts` - prompt перегенерации одного сценария;
- `lib/projects/scripts.ts` - функция `regenerateProjectScript`;
- `POST /api/projects/[id]/scripts/[scriptId]/regenerate` - API route;
- `components/ScriptEditor.tsx` - блок "Перегенерация".

На странице сценария есть поле "Что не так с этим сценарием?" и кнопка "Перегенерировать этот сценарий".

Причины могут быть свободным текстом, например:

- слишком рекламно;
- не в моем стиле;
- скучная ситуация;
- невозможно снять;
- не подходит локация;
- слишком сложно;
- хочется больше POV;
- хочется ситуативный ролик.

LLM получает:

- `Project.briefText`;
- ответы на `ProjectQuestion`;
- style context из `buildStyleContext(userId)`;
- старый `Script.generatedText`;
- текущий `Script.editedText`;
- причину перегенерации;
- номера и названия других сценариев проекта, чтобы не повторяться.

Сервер:

- не удаляет старый `Script`;
- создает `ScriptRevision` с предыдущим текстом и новым вариантом;
- обновляет только текущий `Script`: `title`, `format`, `generatedText`, `editedText`, `status = "draft"`;
- не меняет остальные сценарии проекта;
- пишет `ProjectEvent` с типом `script.regenerated`.

### Одобрение заказчиком и эталон стиля

На странице сценария клиентское одобрение отделено от обычного сохранения и смены статуса.

Пользователь может:

- редактировать текст сценария;
- нажать главную кнопку "Сохранить";
- выбрать статус из dropdown;
- нажать большую кнопку "Одобрено заказчиком";
- после этого явно нажать "Запомнить как эталон".

Основные файлы:

- `lib/projects/styleLearning.ts` - анализ одобренного сценария, вызов LLM, парсинг и сохранение;
- `POST /api/projects/[id]/scripts/[scriptId]/style-reference` - API route сохранения эталона;
- `PATCH /api/projects/[id]/scripts/[scriptId]` - сохраняет текст, статус и действие клиентского одобрения;
- `components/ScriptEditor.tsx` - редактор, кнопка клиентского одобрения, плашка и кнопка "Запомнить как эталон";
- `/settings/style` - блок "Выучено из правок".

Кнопка "Одобрено заказчиком":

- сохраняет текущий текст;
- выставляет `Script.status = "approved_by_client"`;
- выставляет `Script.approvedByClientAt = now`;
- пишет `ProjectEvent` с типом `script_approved_by_client`;
- показывает плашку "Этот сценарий можно запомнить как эталон для будущих генераций."

Кнопка "Запомнить как эталон" показывается только если:

- `Script.status = "approved_by_client"`;
- `Script.isStyleReference = false`.

Важно:

- черновики нельзя запоминать как эталон;
- обучение стиля не запускается на каждый save;
- обучение стиля запускается только после явного действия "Запомнить как эталон";
- статус можно оставить `approved_by_client`, но в интерфейсе показывается бейдж "Эталон", если `Script.isStyleReference = true`.

Перед сохранением эталона редактор сохраняет текущий текст, чтобы LLM анализировал актуальную финальную версию.

LLM получает:

- `Project.briefText`;
- `Project.generationComment`;
- ответы на `ProjectQuestion`;
- референсы проекта;
- старые `StyleRule`;
- `Script.generatedText`;
- текущий финальный текст сценария;
- название и формат сценария.

LLM возвращает JSON:

```json
{
  "summary": "...",
  "goodPatterns": ["..."],
  "badPatterns": ["..."],
  "phrasesToPrefer": ["..."],
  "phrasesToAvoid": ["..."],
  "newStyleRules": ["..."],
  "styleCaseComment": "..."
}
```

Правила должны быть конкретными, а не абстрактными.

Плохо:

- "писать живее";
- "меньше рекламы".

Хорошо:

- "не объяснять механику акции голосом, показывать ее через действие в приложении";
- "заменять прямой рекламный финал на личный вывод из бытовой ситуации".

Сервер после успешного анализа:

- создает `StyleLearning`;
- добавляет полезные `newStyleRules` в `StyleRule` с `source = "approved_script_reference"`;
- создает активный `StyleExample` как продуктовый style case:
  - `title = "Одобренный сценарий: {script.title}"`;
  - `briefText = Project.briefText`;
  - `scriptsText = Script.editedText || Script.generatedText`;
  - `finalScriptsText = Script.editedText || Script.generatedText`;
  - `comment = styleCaseComment`;
  - `active = true`;
- выставляет `Script.isStyleReference = true`;
- пишет `ProjectEvent` с типом `script_saved_as_style_reference`;
- новые правила и кейс автоматически попадают в `buildStyleContext(userId)` при следующей генерации.

### Legacy-анализ правок

В коде остается endpoint `POST /api/projects/[id]/scripts/[scriptId]/analyze-edits` и prompt `lib/prompts/analyzeEditsPrompt.ts`.

Это совместимая старая логика: она сравнивает исходную генерацию и финальный текст, может вернуть `skipped`, создает `StyleLearning`, добавляет `StyleRule` с `source = "script_edits"` и пишет `ProjectEvent` с типом `style.edits_analyzed`.

На текущей странице сценария кнопка "Проанализировать правки" не показывается. Продуктовый путь обучения стиля для сценариев - только явное действие "Запомнить как эталон" после клиентского одобрения.

### Память стиля

На `/settings/style` есть рабочая память стиля:

- блок "Правила": пользователь вручную добавляет короткие правила стиля;
- блок "Эталонные кейсы": пользователь сохраняет кейс стиля;
- блок "Выучено из правок": показывает последние `StyleLearning`;
- сохраненные правила и кейсы показываются на странице;
- `POST /api/settings/style/rules` создает `StyleRule`;
- `POST /api/settings/style/examples` создает `StyleExample`, который сейчас используется как style case;
- PDF/TXT/MD файлы кейса читаются через `lib/files/extractPdfText.ts` или `File.text()`.

В интерфейсе нельзя показывать технические названия вроде `StyleRule`, `StyleExample`, `seed`, `source`, `Reference scripts`, `Example brief`.

Форма эталонного кейса содержит:

- название кейса;
- PDF-бриф или вставленный текст брифа;
- файл финальных сценариев или вставленный текст сценариев;
- комментарий, почему это хороший пример;
- checkbox "Использовать в генерации";
- кнопку "Добавить кейс".

`StyleExample` намеренно не переименован в Prisma-модели, чтобы не ломать существующие данные, но продуктово это `StyleCase`.

Функция `buildStyleContext(userId)` находится в `lib/style/context.ts`.

Она возвращает текстовый контекст для генерации:

- краткую подборку правил стиля;
- только активные эталонные кейсы;
- брифы из кейсов;
- финальные сценарии из кейсов;
- комментарии к кейсам;
- запрет на буквальное копирование примеров;
- указание брать только структуру, темп, способ интеграции продукта, тон и формат.

Seed:

- создает/обновляет demo user `blogger`;
- добавляет несколько базовых `StyleRule` без привязки к конкретному бренду;
- если локальный `сценарии_oblv9o.pdf` доступен, извлекает текст и создает/обновляет один активный style case (`StyleExample`) с названием "Локальный эталон сценариев";
- seed идемпотентный: базовые правила не дублируются, локальный эталон обновляется по названию.

### Проекты и дубли

Новый `Project` должен создаваться только на `/projects/new` через `POST /api/projects`.

Генерация сценариев, уточняющие вопросы, перегенерация, клиентское одобрение, сохранение эталона, legacy-анализ правок и смена статусов не должны создавать новый `Project`.

`/dashboard`:

- фильтрует проекты по `userId`;
- показывает каждый проект один раз;
- сворачивает возможные дубли по названию, имени файла брифа и близкой дате создания;
- если найден дубль, для карточки выбирает более содержательную запись: сначала по количеству сценариев, затем по `updatedAt`;
- карточка проекта кликабельна целиком и ведет на `/projects/[id]`;
- визуальная кнопка "Открыть" внутри карточки ведет туда же через общую ссылку карточки.

Карточка проекта показывает только:

- название;
- бренд;
- количество уже созданных сценариев;
- текущий этап;
- дату изменения;
- "Открыть".

Для диагностики дублей есть dev-скрипт:

```bash
npx tsx scripts/find-duplicate-projects.ts
```

Он ищет возможные дубли по названию, файлу брифа и близкой дате создания. Скрипт ничего не удаляет и ничего не меняет в базе.

## Сущности базы

Основные модели:

- `User`
- `Project`
- `ProjectReference`
- `ProjectQuestion`
- `Script`
- `ScriptRevision`
- `StyleRule`
- `StyleExample`
- `StyleLearning`
- `LLMLog`
- `ProjectEvent`

SQLite используется локально через `DATABASE_URL="file:./dev.db"`.

`Project`:

- `id`
- `userId`
- `title`
- `brand`
- `briefText`
- `briefFileName`
- `generationComment`
- `status`
- `currentStep`
- `referenceScriptsCount`
- `scriptsCount`
- `createdAt`
- `updatedAt`

`Project.currentStep`:

- `questions`
- `generation`
- `scripts`
- `export`

`ProjectReference`:

- `id`
- `projectId`
- `type`
- `url`
- `fileName`
- `localFilePath`
- `transcriptText`
- `extractedScenarioText`
- `notes`
- `useInGeneration`
- `status`
- `error`
- `createdAt`
- `updatedAt`

`ProjectReference.type`:

- `youtube`
- `tiktok`
- `instagram`
- `uploaded_video`
- `manual`

`ProjectReference.status`:

- `added`
- `processing`
- `downloading`
- `extracting_audio`
- `downloading_model`
- `transcribing`
- `extracting_scenario`
- `ready`
- `failed`

`ProjectQuestion`:

- `id`
- `projectId`
- `question`
- `answer`
- `importance`
- `createdAt`
- `updatedAt`

`Script`:

- `id`
- `projectId`
- `number`
- `title`
- `format`
- `generatedText`
- `editedText`
- `basedOnReference`
- `referenceReason`
- `status`
- `approvedByClientAt`
- `isStyleReference`
- `createdAt`
- `updatedAt`

Статусы `Script.status`:

- `draft` -> "Черновик"
- `needs_revision` -> "На доработку"
- `approved_by_creator` -> "Одобрен автором"
- `approved_by_client` -> "Одобрен заказчиком"
- `rejected` -> "Отклонён"
- `reference_quality` -> "Эталон"

Legacy-статус `approved` может встречаться в старых данных и должен отображаться как "Одобрен автором".

`ScriptRevision`:

- `id`
- `scriptId`
- `previousText`
- `newText`
- `changeNote`
- `createdAt`

`StyleRule`:

- `id`
- `userId`
- `rule`
- `source`
- `createdAt`

`StyleExample`:

- `id`
- `userId`
- `title`
- `briefText`
- `briefFileName`
- `scriptsText`
- `finalScriptsText`
- `scriptsFileName`
- `comment`
- `active`
- `createdAt`
- `updatedAt`

`scriptsText` оставлен для обратной совместимости со старыми данными. Новая логика должна читать `finalScriptsText || scriptsText`.

Статусы `Project.status`:

- `brief_uploaded` -> "Бриф загружен"
- `questions_pending` -> "Нужны ответы"
- `questions_approved` -> "Ответы подтверждены"
- `generating_scripts` -> "Генерация сценариев"
- `scripts_generated` -> "Сценарии готовы"
- `editing` -> "Редактура"
- `client_approved` -> "Одобрено"
- `exported` -> "Экспортировано"

Также в коде могут встречаться служебные/legacy статусы:

- `draft`
- `generating`
- `generating_scripts`
- `script_generation_failed`
- `ready`
- `archived`

`StyleLearning`:

- `id`
- `userId`
- `scriptId`
- `summary`
- `badPatternsJson`
- `goodPatternsJson`
- `phrasesToAvoidJson`
- `phrasesToPreferJson`
- `createdAt`

## Текущие страницы

- `/login` - вход.
- `/dashboard` - список проектов без визуальных дублей; карточка проекта кликабельна целиком.
- `/projects/new` - первый шаг создания проекта: название, бренд, количество сценариев, PDF/ручной бриф, комментарий к генерации, количество сценариев по референсам и несколько проектных референсов.
- `/projects/[id]` - живой workspace проекта. Показывает только текущий этап: вопросы, генерацию, сценарии или экспорт. Бриф, ответы, референсы и события спрятаны в modal "Детали проекта".
- `/projects/[id]/scripts/[scriptId]` - рабочий редактор сценария: автосохранение, ручное сохранение, dropdown статуса, отдельное клиентское одобрение, явное сохранение эталона, история `ScriptRevision`, перегенерация одного сценария и блок "Не в моем стиле".
- `/settings/style` - рабочая память стиля: правила, эталонные кейсы и блок "Выучено из правок".
- `/api/dev/llm-test` - dev-only smoke-test LLM Gateway.

## Дизайн-система

Интерфейс должен быть минималистичным, холодным и спокойным.

Основной визуальный принцип: белый общий фон, светло-серые карточки, много воздуха, мягкие скругления, без декоративных теней и лишних рамок.

### Цвета

- Общий фон страницы: белый.
- Основной текст: холодный почти черный `slate-950`.
- Вторичный текст: `slate-500`.
- Слабый текст: `slate-400`.
- Карточки и крупные поверхности: `slate-50`.
- Внутренние плашки внутри карточек: белые.
- Основная кнопка: `slate-950` с белым текстом.
- Вторичные кнопки: `slate-100` / hover `slate-200`.

Не использовать:

- бежевые, кремовые, песочные фоны;
- теплые коричневые/оранжевые палитры;
- тяжелые тени;
- большое количество обводок;
- декоративные градиенты, blobs, orbs.

### Поверхности

Карточки:

- фон `bg-slate-50`;
- скругление `rounded-2xl`;
- без `border`;
- без `shadow`;
- внутренние отступы примерно `px-7 py-7`.

Внутренние элементы в карточках:

- фон `bg-white`;
- скругление `rounded-2xl`;
- без рамок;
- разделение делается расстоянием `space-y-*`, а не линиями.

### Типографика

- Использовать системный sans-serif.
- Общий вес шрифта: regular.
- Не перегружать интерфейс `font-semibold`.
- Основные заголовки: `font-normal`, `tracking-tight`, размер около `text-3xl`.
- Заголовки карточек: `font-normal`, `text-base`.
- Описания: `text-sm`, `leading-6`, `text-slate-500`.

### Кнопки

Кнопки должны быть спокойными:

- `rounded-xl`;
- без теней;
- без рамок;
- вес текста regular;
- высота основной кнопки около `h-11`;
- у маленьких кнопок около `h-9`;
- расстояние между кнопками не меньше `gap-4`, если они стоят рядом.

### Формы

Поля:

- `rounded-xl`;
- фон белый;
- без видимой рамки;
- фокус через мягкий `focus:ring-4 focus:ring-slate-200`;
- высота input около `h-11`;
- textarea с достаточным внутренним отступом.

Ошибки:

- мягкая красная плашка `bg-red-50`;
- `rounded-2xl`;
- без рамки.

### Layout

- Header на белом фоне, без нижней линии.
- Основной контейнер: `max-w-6xl`.
- Горизонтальные отступы: `px-6`.
- Вертикальный отступ main: около `py-12`.
- Между крупными блоками использовать `mt-10` или сопоставимые значения.
- Не вкладывать карточки в карточки как декоративный прием. Если нужен блок внутри карточки, он должен выглядеть как простая белая плашка.

## Важные технические правила

- Не запускать `npm run build`, пока работает `npm run dev`: оба процесса пишут в `.next`, это может сломать dev-сервер.
- Если Next начал искать отсутствующие chunks вроде `Cannot find module './833.js'`, нужно остановить dev-сервер, удалить `.next` и запустить `npm run dev` заново.
- Если в браузере появилась runtime ошибка `__webpack_modules__[moduleId] is not a function`, нужно остановить все `next dev` / `next-server`, удалить `.next` и запустить dev-сервер заново.
- Локальный dev-сервер должен работать на `http://localhost:3000`. Если порт занят, найти и остановить старый Next-процесс, а не оставлять новый сервер на `3001`.
- Перед production build остановить dev-сервер.
- После build перед новым dev-запуском желательно удалить `.next`.
- `tsconfig.tsbuildinfo` является служебным файлом и должен быть в `.gitignore`.

## Проверки перед сдачей изменений

Минимум:

```bash
npx tsc --noEmit
npm run build
```

Для проверки входа:

```bash
curl -i -X POST http://localhost:3000/api/login -d login=blogger -d password=password123
```

Ожидаемый результат: `303 See Other`, redirect на `/dashboard`, cookie `ugc_session`.
