#!/bin/sh
set -eu

mkdir -p /data /data/references /data/huggingface

export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
export REFERENCE_DATA_DIR="${REFERENCE_DATA_DIR:-/data/references}"
export HF_HOME="${HF_HOME:-/data/huggingface}"
export LOCAL_WHISPER_PYTHON="${LOCAL_WHISPER_PYTHON:-/opt/venv/bin/python}"
export YT_DLP_PYTHON="${YT_DLP_PYTHON:-$LOCAL_WHISPER_PYTHON}"
export YT_DLP_SLEEP_REQUESTS="${YT_DLP_SLEEP_REQUESTS:-3}"
export PATH="/opt/venv/bin:$PATH"

case "$REFERENCE_DATA_DIR" in
  /*) ;;
  data/references) export REFERENCE_DATA_DIR="/data/references" ;;
  data/references/*) export REFERENCE_DATA_DIR="/${REFERENCE_DATA_DIR}" ;;
esac

rm -rf node_modules/.prisma/client

./node_modules/.bin/prisma generate --schema=prisma/schema.prisma
./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

if [ "${RUN_PRISMA_SEED:-true}" = "true" ]; then
  ./node_modules/.bin/tsx prisma/seed.ts
fi

exec "$@"
