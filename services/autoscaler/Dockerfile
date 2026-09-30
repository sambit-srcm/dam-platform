FROM node:25-alpine AS build
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/package.json
COPY packages/queue/package.json packages/queue/package.json
COPY services/api/package.json services/api/package.json
COPY services/thumbnail-worker/package.json services/thumbnail-worker/package.json
COPY services/video-worker/package.json services/video-worker/package.json
COPY services/web/package.json services/web/package.json
COPY services/autoscaler/package.json services/autoscaler/package.json
RUN npm install -g pnpm@10.24.0 && pnpm install --frozen-lockfile
COPY . .
RUN CI=true pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:25-alpine AS runtime
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/services/autoscaler
CMD ["node", "src/index.ts"]
