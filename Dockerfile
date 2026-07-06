FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV APP_BASE_URL=https://ugcbuttonm-huracanovich.amvera.io
ENV NEXT_PUBLIC_APP_URL=https://ugcbuttonm-huracanovich.amvera.io
ENV DATABASE_URL=file:/data/dev.db
ENV REFERENCE_DATA_DIR=/data/references
ENV HF_HOME=/data/huggingface
ENV LOCAL_WHISPER_PYTHON=/opt/venv/bin/python

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv python3-pip ca-certificates openssl \
  && python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/middleware.ts ./middleware.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/Бриф_АБ_ВиТ.pdf ./Бриф_АБ_ВиТ.pdf
COPY --from=builder /app/сценарии_oblv9o.pdf ./сценарии_oblv9o.pdf
COPY docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["sh", "docker-entrypoint.sh"]
CMD ["npm", "run", "start", "--", "-H", "0.0.0.0"]
