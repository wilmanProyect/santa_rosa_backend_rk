# Santa Rosa — Backend

API del sistema Santa Rosa: autenticación, usuarios, roles y permisos, y áreas.

**Stack:** NestJS 11 · TypeORM · PostgreSQL 17 · pnpm. Referencia de endpoints en [docs/API.md](docs/API.md) y Swagger en `/docs`.

El frontend (`santa_rosa_front_rk`) es un proyecto aparte que corre en su propio contenedor y consume esta API por HTTP.

## Configuración

```bash
cp .env.example .env
```

Defina al menos `JWT_SECRET` (mínimo 32 caracteres) y `CORS_ORIGINS` con la URL del frontend. Genere el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Correr con Docker (API + base de datos)

```bash
docker compose up -d --build
```

| Servicio | Contenedor | Puerto en el host |
| --- | --- | --- |
| API | `santa_rosa_backend-api-1` | `API_EXTERNAL_PORT` (3000) |
| PostgreSQL | `santa_rosa_backend-postgres-1` | `DB_EXTERNAL_PORT` (5439) |

Al arrancar, la API aplica las migraciones pendientes y crea los permisos, el rol **Administrador** y el usuario `admin` / `Admin123` (que debe cambiar la contraseña en el primer ingreso). Los datos de la base persisten en el volumen `santa_rosa_backend_postgres_data`.

```bash
docker compose logs -f api        # ver logs
docker compose up -d --build api  # reconstruir la API tras cambios
docker compose down               # detener (conserva los datos)
docker compose down -v            # detener y BORRAR la base de datos
```

## Correr en local (desarrollo con recarga automática)

```bash
pnpm install
docker compose up -d postgres     # solo la base de datos
pnpm start:dev                    # API en http://localhost:3000
```

En este modo la API usa `DB_HOST=localhost` y `DB_PORT=5439` del `.env`.

## Migraciones

El esquema se gestiona **solo con migraciones** (`synchronize` está apagado). Están en `src/database/migrations` y se aplican solas al arrancar la API (`DB_MIGRATIONS_RUN=true`).

Al modificar una entidad (`*.orm-entity.ts`):

```bash
pnpm migration:generate src/database/migrations/NombreDelCambio   # requiere la BD levantada
pnpm migration:run                                               # o reiniciar la API
```

Otros comandos: `pnpm migration:show` (estado), `pnpm migration:revert` (deshace la última) y `pnpm migration:create src/database/migrations/Nombre` (migración vacía para SQL manual).

Revise siempre el SQL generado antes de confirmarlo.

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm start:dev` | API con recarga automática |
| `pnpm build` / `pnpm start:prod` | Compilar y correr la versión compilada |
| `pnpm test` | Tests unitarios |
| `pnpm lint` | ESLint + Prettier (con corrección automática) |

## Variables de entorno

Ver [.env.example](.env.example). Las principales:

| Variable | Descripción |
| --- | --- |
| `DB_*` | Conexión a PostgreSQL. En Docker, `DB_HOST`/`DB_PORT` los fija el compose. |
| `DB_MIGRATIONS_RUN` | Aplica migraciones al arrancar (por defecto `true`). |
| `JWT_SECRET` | Secreto para firmar los tokens. **Obligatorio.** |
| `JWT_ACCESS_TTL_MINUTES` / `JWT_REFRESH_TTL_DAYS` | Duración de los tokens (15 min / 7 días). |
| `AUTH_MAX_FAILED_ATTEMPTS` / `AUTH_LOCK_MINUTES` | Bloqueo por intentos fallidos (5 / 15 min). |
| `ADMIN_DEFAULT_USERNAME` / `ADMIN_DEFAULT_PASSWORD` | Admin inicial, creado solo si no hay administradores activos. |
| `CORS_ORIGINS` | URLs del frontend autorizadas, separadas por coma. |
| `TRUST_PROXY` | `true` si la API está detrás de un proxy inverso. |
| `API_EXTERNAL_PORT` / `DB_EXTERNAL_PORT` | Puertos publicados en el host por docker compose. |
