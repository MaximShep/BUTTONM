#!/usr/bin/env python3
import argparse
import json
import sys


def json_error(message):
    print(json.dumps({"error": message}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio with faster-whisper.")
    parser.add_argument("--audio", required=True, help="Path to audio file.")
    parser.add_argument("--language", default="ru", help="Transcription language.")
    parser.add_argument("--model", default="small", help="faster-whisper model size.")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except Exception:
        json_error("Локальная расшифровка не настроена. Установите зависимости или вставьте расшифровку вручную.")
        return 0

    try:
        model = WhisperModel(args.model, device="auto", compute_type="auto")
        segments_iter, _info = model.transcribe(args.audio, language=args.language)
        segments = []

        for segment in segments_iter:
            text = segment.text.strip()
            if not text:
                continue
            segments.append({
                "start": float(segment.start),
                "end": float(segment.end),
                "text": text,
            })

        print(json.dumps({
            "text": " ".join(segment["text"] for segment in segments).strip(),
            "segments": segments,
        }, ensure_ascii=False))
        return 0
    except Exception as error:
        json_error(f"Не удалось расшифровать аудио локально: {error}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
