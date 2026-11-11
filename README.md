# Santa Rosa — Backend

API del sistema Santa Rosa: autenticación, usuarios, roles y permisos, áreas, inventario de animales (ovinos y caprinos) con su control de peso y registro sanitario, y reproducción (montas, partos y categoría genética).

**Stack:** NestJS 11 · TypeORM · PostgreSQL 17 · pnpm. Referencia de endpoints en [docs/API.md](docs/API.md) y Swagger en `/docs`.

El frontend (`santa_rosa_front_rk`) es un proyecto aparte que corre en su propio contenedor y consume esta API por HTTP.

Para publicarlo en un servidor, ver [docs/DEPLOY.md](docs/DEPLOY.md).

## Configuración

```bash
cp .env.example .env
```

Defina al menos `JWT_SECRET` (mínimo 32 caracteres) y `CORS_ORIGINS` con la URL del frontend. Genere el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## Correr con Docker (API + base de datos + Garage)

```bash
docker compose up -d --build
```

| Servicio | Contenedor | Puerto en el host |
| --- | --- | --- |
| API | `santa_rosa_backend-api-1` | `API_EXTERNAL_PORT` (3000) |
| PostgreSQL | `santa_rosa_backend-postgres-1` | `DB_EXTERNAL_PORT` (5439) |
| Garage (API S3) | `santa_rosa_backend-garage-1` | `GARAGE_S3_EXTERNAL_PORT` (3900) |

Al arrancar, la API aplica las migraciones pendientes y crea los permisos, el rol **Administrador** y el usuario `admin` / `Admin123` (que debe cambiar la contraseña en el primer ingreso). Los datos de la base persisten en el volumen `santa_rosa_backend_postgres_data` y los archivos (fotos de animales y certificados ABSID) en **Garage** (almacenamiento compatible con S3), volúmenes `santa_rosa_backend_garage_meta` y `santa_rosa_backend_garage_data`. Garage corre como un solo nodo: en su primer arranque crea el bucket `S3_BUCKET` y la clave `S3_ACCESS_KEY`. La API no arranca si no puede conectarse a Garage.

Antes del primer arranque, genere los secretos de Garage (`S3_ACCESS_KEY`, `S3_SECRET_KEY`, `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`) con el comando que figura en [.env.example](.env.example): Garage exige un formato específico.

Garage no tiene consola web. Para revisar el almacenamiento se usa su CLI:

```bash
docker compose exec garage /garage status              # estado del nodo
docker compose exec garage /garage bucket info santa-rosa  # tamaño y cantidad de archivos
```

La configuración está en [docker/garage/garage.toml](docker/garage/garage.toml); los secretos llegan por variables de entorno.

```bash
docker compose logs -f api        # ver logs
docker compose up -d --build api  # reconstruir la API tras cambios
docker compose down               # detener (conserva los datos)
docker compose down -v            # detener y BORRAR la base de datos y los archivos
```

## Correr en local (desarrollo con recarga automática)

```bash
pnpm install
docker compose up -d postgres garage  # solo la base de datos y Garage
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

Dos casos que el generador **no** detecta y se escriben a mano en la migración:

- Índices por expresión, como `lower(name)` en `breeds` y `animal_colors`. La entidad los declara con `@Index('nombre', { synchronize: false })`.
- Cambios en los `CHECK` que restringen los enums (por ejemplo, agregar un valor a `AnimalStatus`). TypeORM compara los `CHECK` por nombre, no por contenido: hay que reemplazarlos con `DROP CONSTRAINT` + `ADD CONSTRAINT`.

## Copias de seguridad

Una copia de seguridad es un archivo `.tar.gz` con **todo el sistema**: el volcado completo de PostgreSQL y todos los archivos de Garage (fotos, miniaturas y certificados), más un manifiesto con el SHA-256 de cada pieza. Se genera de dos formas:

- **Desde el sistema:** un usuario con el permiso `backups:create` la descarga con `GET /backups/download`.
- **Por terminal**, en el servidor (con los contenedores levantados):

```bash
pnpm backup         # genera backups/santa-rosa-respaldo-AAAAMMDD-HHMMSS.tar.gz
pnpm backup:list    # lista los respaldos de ./backups
```

Los respaldos quedan en la carpeta `./backups` del servidor, montada en el contenedor de la API. Esa carpeta no se versiona ni entra en la imagen. **Copie los respaldos a otro lugar** (disco externo, nube): si se pierde el servidor, se pierden con él.

### Restaurar

Restaurar **reemplaza todos los datos y archivos actuales** por los del respaldo. Se puede hacer de dos formas:

- **Desde el sistema** (pantalla Copias de seguridad, permiso `backups:restore`): se sube el respaldo o se elige uno de `./backups`, se revisa de cuándo es y se confirma escribiendo `RESTAURAR`. Hace los mismos pasos que la terminal y además aplica las migraciones pendientes sin reiniciar. Endpoints en [docs/API.md](docs/API.md#restaurar).
- **Por terminal:**

```bash
pnpm restore santa-rosa-respaldo-20261104-153801.tar.gz   # el archivo debe estar en ./backups
docker compose restart api                                # aplica las migraciones pendientes
```

1. Lee el respaldo completo y verifica los SHA-256. Si está dañado, se detiene sin tocar nada.
2. Muestra la fecha y el contenido del respaldo, y pide escribir `RESTAURAR` para continuar.
3. Genera un respaldo del estado actual (`backups/antes-de-restaurar-...`), por si hay que volver atrás.
4. Restaura la base en **una sola transacción**: si algo falla, la base queda como estaba.
5. Sube los archivos del respaldo y borra de Garage los que no estaban en él.

Opciones: `--yes` omite la confirmación (para scripts) y `--sin-respaldo-previo` omite el paso 3.

Un respaldo subido desde el sistema puede pesar hasta `BACKUP_UPLOAD_MAX_MB` (2048 MB por defecto). Detrás de Cloudflare, el límite real es de **100 MB por petición** (plan gratuito): un respaldo más grande se copia a `./backups` del servidor (por ejemplo con `scp`) y se restaura desde la lista "Desde la carpeta del servidor".

En un servidor Linux, la carpeta `./backups` debe poder escribirla el usuario `node` del contenedor (uid 1000): `mkdir -p backups && sudo chown 1000:1000 backups`.

Las herramientas `pg_dump`, `pg_restore` y `psql` vienen en la imagen de la API, copiadas de `postgres:17-alpine` (la misma versión que la base). En modo desarrollo (`pnpm start:dev`) el botón del sistema funciona solo si esas herramientas están instaladas en la máquina.

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm start:dev` | API con recarga automática |
| `pnpm build` / `pnpm start:prod` | Compilar y correr la versión compilada |
| `pnpm test` | Tests unitarios |
| `pnpm lint` | ESLint + Prettier (con corrección automática) |
| `pnpm backup` / `pnpm backup:list` / `pnpm restore <archivo>` | Copias de seguridad por terminal (ver [Copias de seguridad](#copias-de-seguridad)) |
| `pnpm import:animals <Animales.csv> [Pesaje.csv] [Registro_Sanitario.csv] [--dry-run]` | Importa el inventario de animales, sus pesajes y su registro sanitario desde las planillas Excel exportadas como *CSV UTF-8* (separador `;`). Crea las razas, los colores y los productos veterinarios que falten. Con `--dry-run` valida todo y genera el reporte sin guardar nada. Solo corre sobre una tabla de animales vacía y lo hace en una sola transacción. El reporte (`Animales.reporte.md`) queda junto al CSV y lista lo que hay que cargar o corregir a mano. |

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
| `S3_ENDPOINT` | URL con la que la API llega a Garage. En Docker la fija el compose (`http://garage:3900`). |
| `S3_PUBLIC_ENDPOINT` | URL con la que el **navegador** llega a Garage. Se usa para firmar las URL temporales de las fotos, así que debe ser accesible desde el frontend. |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` / `S3_BUCKET` | Clave y bucket de Garage. **Obligatorias**; ver formato en `.env.example`. |
| `S3_REGION` | `garage`. Debe coincidir con `s3_region` de `docker/garage/garage.toml`. |
| `GARAGE_RPC_SECRET` / `GARAGE_ADMIN_TOKEN` | Secretos internos de Garage. **Obligatorios**. |
| `S3_PRESIGNED_URL_TTL_SECONDS` | Validez de las URL temporales de las fotos (por defecto 900 s). |
| `CORS_ORIGINS` | URLs del frontend autorizadas, separadas por coma. |
| `TRUST_PROXY` | `true` si la API está detrás de un proxy inverso. |
| `FARM_NAME` / `FARM_TIME_ZONE` | Nombre de la cabaña y zona horaria impresos en el certificado del animal (por defecto "Cabaña Santa Rosa" / `America/La_Paz`). |
| `FARM_CODE` / `FARM_BREEDERS` / `FARM_LOCALITY` / `FARM_PHONE` / `FARM_REGION` | Código de la cabaña, criadores responsables (separados por coma), localidad, teléfono y región impresos en el certificado. Ver `.env.example`. |
| `BACKUP_UPLOAD_MAX_MB` | Tamaño máximo de un respaldo subido para restaurarlo desde el sistema (por defecto 2048). |
| `API_EXTERNAL_PORT` / `DB_EXTERNAL_PORT` / `GARAGE_S3_EXTERNAL_PORT` | Puertos publicados en el host por docker compose. |
