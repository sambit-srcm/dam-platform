FROM node:25-alpine AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY services/api/package.json services/api/package.json
COPY services/worker/package.json services/worker/package.json
COPY services/video-worker/package.json services/video-worker/package.json
COPY services/web/package.json services/web/package.json
RUN npm install -g pnpm@10.24.0 && pnpm install --frozen-lockfile
COPY . .
RUN CI=true pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:25-alpine AS runtime
RUN apk add --no-cache ffmpeg
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
COPY --from=build --chown=app:app /repo /repo
USER app
WORKDIR /repo/services/video-worker
ENV HEARTBEAT_FILE=/tmp/worker-alive
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD find "$HEARTBEAT_FILE" -mmin -1 | grep -q . || exit 1
CMD ["node", "src/index.ts"]
