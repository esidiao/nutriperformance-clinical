FROM node:20-alpine AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# Casar com o "packageManager" do package.json. Os overrides de segurança moram
# em pnpm-workspace.yaml (local do pnpm 10+); o pnpm 9 não lê esse arquivo, vê
# zero overrides contra os oito gravados no lockfile e aborta o build inteiro
# com ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
RUN npm install -g pnpm@11.2.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --filter @nutri-performance/api --frozen-lockfile
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install -g pnpm@11.2.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true pnpm install --filter @nutri-performance/api --prod --frozen-lockfile
COPY --from=builder /app/apps/api/dist ./apps/api/dist
EXPOSE 3001
CMD ["node", "apps/api/dist/src/main.js"]
