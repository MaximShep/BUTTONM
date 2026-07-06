#!/bin/sh
set -eu

mkdir -p /data /data/references /data/huggingface

export DATABASE_URL="${DATABASE_URL:-file:/data/dev.db}"
export REFERENCE_DATA_DIR="${REFERENCE_DATA_DIR:-/data/references}"
export HF_HOME="${HF_HOME:-/data/huggingface}"
export LOCAL_WHISPER_PYTHON="${LOCAL_WHISPER_PYTHON:-/opt/venv/bin/python}"

npx prisma migrate deploy

if [ "${RUN_PRISMA_SEED:-true}" = "true" ]; then
  npm run prisma:seed
fi

exec "$@"
