# syntax=docker/dockerfile:1

# ---------- Base: Node + pnpm (versión fijada en package.json) ----------
FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@11.5.3 && npm cache clean --force

# ---------- Dependencias completas (para compilar) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# ---------- Compilación ----------
FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm run build

# ---------- Solo dependencias de producción ----------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

# ---------- Imagen final ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

# No ejecutar como root.
USER node

EXPOSE 3000

# La migraciones pendientes se aplican al arrancar (DB_MIGRATIONS_RUN=true por defecto).
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["node", "dist/main"]
