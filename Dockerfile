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

# ---------- Cliente de PostgreSQL (misma versión que el servidor) ----------
FROM postgres:17-alpine AS pg-client

# ---------- Imagen final ----------
FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

# Herramientas de PostgreSQL (pg_dump, pg_restore, psql) para las copias de
# seguridad. Se copian de la misma imagen que usa la base (misma versión y
# misma Alpine), con las librerías que necesitan y que node:alpine no trae.
COPY --from=pg-client /usr/local/bin/pg_dump /usr/local/bin/pg_restore /usr/local/bin/psql /usr/local/bin/
COPY --from=pg-client /usr/local/lib/libpq.so.5* /usr/lib/libcom_err.so.2* /usr/lib/libedit.so.0* /usr/lib/libgssapi_krb5.so.2* /usr/lib/libk5crypto.so.3* /usr/lib/libkeyutils.so.1* /usr/lib/libkrb5.so.3* /usr/lib/libkrb5support.so.0* /usr/lib/liblber.so.2* /usr/lib/libldap.so.2* /usr/lib/liblz4.so.1* /usr/lib/libncursesw.so.6* /usr/lib/libsasl2.so.3* /usr/lib/libzstd.so.1* /usr/local/lib/

COPY --chown=node:node package.json ./
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
# Carpeta de las copias de seguridad generadas por terminal (volumen en docker-compose).
RUN mkdir -p /app/backups && chown node:node /app/backups

# No ejecutar como root.
USER node

EXPOSE 3000

# La migraciones pendientes se aplican al arrancar (DB_MIGRATIONS_RUN=true por defecto).
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null || exit 1

CMD ["node", "dist/main"]
