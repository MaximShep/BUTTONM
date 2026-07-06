# UGC Scripts MVP

MVP веб-сервиса для блогера: заказчик присылает рекламный бриф, блогер создает проект и позже сможет генерировать 5-10 коротких UGC-сценариев.

## Стек

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite локально
- Простая авторизация по логину и паролю

SQLite подключен через `DATABASE_URL`. Для PostgreSQL позже нужно заменить provider в `prisma/schema.prisma`, обновить `DATABASE_URL` и выполнить миграции.

## Запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env`:

```bash
cp .env.example .env
```

3. Применить миграции и создать пользователя:

```bash
npm run prisma:migrate
npm run prisma:seed
```

По умолчанию seed создает пользователя:

```text
login: blogger
password: password123
```

Можно задать свои значения через `SEED_LOGIN` и `SEED_PASSWORD` в `.env`.

4. Запустить dev-сервер:

```bash
npm run dev
```

Открыть `http://localhost:3000/login`.

Не запускайте `npm run build`, пока работает `npm run dev`: оба процесса используют `.next`, и dev-сервер может начать искать уже удаленные chunks. Если это случилось, остановите dev-сервер, удалите `.next` и запустите `npm run dev` заново.

## Готовый пользовательский поток

1. Войти на `/login`.
2. Открыть `/dashboard`.
3. Создать проект на `/projects/new`.
4. После создания перейти на `/projects/[id]`.

Генерация, редакторская логика, память стиля и экспорт пока оставлены как заготовки в структуре проекта.

## Референсы и автообработка видео

В деталях проекта можно добавить YouTube/TikTok/Instagram Reels ссылку, загрузить видео или вставить ручную расшифровку. Референс обрабатывается кнопкой `Обработать`: сервис получает текст, извлекает сценарную структуру и использует только готовые референсы со статусом `ready` и включенным checkbox `использовать в генерации`.

Для автоматической обработки видео на VPS установите системные утилиты:

```bash
yt-dlp --version
ffmpeg -version
```

`yt-dlp` нужен, чтобы скачать публичные YouTube/TikTok/Instagram Reels в `REFERENCE_DATA_DIR` (`data/references` внутри проекта по умолчанию; на VPS можно поставить `/data/references`). Instagram может ограничивать скачивание; для приватных или недоступных роликов используйте загрузку видеофайла или ручную расшифровку. `ffmpeg` нужен, чтобы достать из видео аудио для транскрибации.

Переменные окружения:

```env
TRANSCRIPTION_PROVIDER=local
LOCAL_WHISPER_MODEL=small
LOCAL_WHISPER_LANGUAGE=ru
LOCAL_WHISPER_PYTHON=python3
OPENAI_API_KEY=
REFERENCE_DATA_DIR=/data/references
```

Варианты транскрибации:

- `TRANSCRIPTION_PROVIDER=local` использует бесплатный локальный `faster-whisper`.
- `TRANSCRIPTION_PROVIDER=mock` возвращает тестовую расшифровку без внешних API.
- `TRANSCRIPTION_PROVIDER=openai` использует `OPENAI_API_KEY` и OpenAI transcription API.

Если `yt-dlp`, `ffmpeg` или реальная транскрибация не настроены, приложение не падает: референс получит понятную ошибку. В этом режиме вставьте расшифровку вручную в поле `Ручная расшифровка` и снова нажмите `Обработать`.

Подробнее: `README_TRANSCRIPTION.md`.

## Исходные материалы

В корне проекта лежат PDF-файлы:

- `Бриф_АБ_ВиТ.pdf`
- `сценарии_oblv9o.pdf`

Приложение не дублирует их содержимое в коде. Ссылки на них находятся в `lib/files/source-materials.ts`.
# BUTTONM
