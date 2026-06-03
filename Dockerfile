FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json nx.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/proxy/package.json packages/proxy/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/proxy/ packages/proxy/
COPY packages/ui/ packages/ui/
RUN pnpm --filter @one-proxy/ui build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/packages/proxy/package.json packages/proxy/
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/proxy/src packages/proxy/src
COPY --from=builder /app/packages/shared/src packages/shared/src
COPY --from=builder /app/packages/proxy/tsconfig.json packages/proxy/
COPY --from=builder /app/packages/shared/tsconfig.json packages/shared/
COPY --from=builder /app/packages/ui/dist packages/ui/dist
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/packages/proxy/node_modules packages/proxy/node_modules/
COPY --from=builder /app/packages/shared/node_modules packages/shared/node_modules/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/tsconfig.base.json ./
RUN mkdir -p data
EXPOSE 15000
VOLUME /app/data
CMD ["node", "--import", "tsx", "packages/proxy/src/index.ts"]
