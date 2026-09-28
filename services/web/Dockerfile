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
RUN pnpm --filter @dam/web build

FROM nginx:alpine AS runtime
COPY --from=build /repo/services/web/dist /usr/share/nginx/html
COPY services/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1
