# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /usr/src/app

# Habilitar pnpm nativo mediante Corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias y configuración de pnpm v11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copiar el resto del código y compilar el proyecto
COPY . .
RUN pnpm run build

# Stage 2: Production Run
FROM node:20-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
