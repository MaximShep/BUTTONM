# Transcription Setup

## Локальная бесплатная расшифровка

Основной бесплатный режим для MVP — локальный `faster-whisper`. Pipeline:

1. `yt-dlp` скачивает публичные YouTube/TikTok/Instagram Reels ссылки.
2. `ffmpeg` извлекает аудио.
3. `scripts/transcribe_local.py` запускает `faster-whisper`.
4. `transcriptText` сохраняется в `ProjectReference`.
5. LLM извлекает сценарную структуру.

Instagram может работать нестабильно: платформа ограничивает скачивание, особенно для приватных, удалённых или недоступных роликов. В MVP нет авторизации Instagram, не нужно просить логин/пароль и не нужно обходить закрытые аккаунты. Для приватных или недоступных роликов используйте ручную загрузку видеофайла или вставьте расшифровку вручную.

## Установка локально

```bash
pip install -r requirements.txt
yt-dlp --version
ffmpeg -version
```

Нужны:

- Python
- ffmpeg
- yt-dlp
- faster-whisper

`.env`:

```env
TRANSCRIPTION_PROVIDER=local
LOCAL_WHISPER_MODEL=small
LOCAL_WHISPER_LANGUAGE=ru
LOCAL_WHISPER_PYTHON=python3
```

Модели:

- `tiny` — быстрее, хуже
- `base` — быстро, средне
- `small` — нормальный баланс
- `medium` — лучше, но тяжелее

Для слабого VPS используйте `tiny` или `base`. Для локального Mac можно `small` или `medium`.

Первый запуск выбранной модели скачивает файлы в Hugging Face cache. В UI референса в этот момент будет статус `скачивание модели`; после загрузки статус сменится на `расшифровка`. Для модели `small` загрузка обычно около 460 MB.

## Проверка

Передайте путь к audio/video файлу:

```bash
npm run transcribe:test -- ./test-assets/example.mp4
```

Команда проверяет:

- `ffmpeg` запускается
- Python запускается
- `faster-whisper` импортируется
- JSON с `text` возвращается

Если `test-assets` существует и в нём есть audio/video файл, путь можно не передавать.

## Docker/VPS без Dockerfile

В проекте нет Dockerfile. Для ручной установки на VPS:

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip ffmpeg yt-dlp
pip3 install -r requirements.txt
```

Если автообработка не сработала, референс не удаляется. Вставьте расшифровку вручную и снова нажмите `Обработать`.

Локально, если `REFERENCE_DATA_DIR` не задан, файлы пишутся в `data/references` внутри проекта. На VPS можно явно указать `REFERENCE_DATA_DIR=/data/references`.
