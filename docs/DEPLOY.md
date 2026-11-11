# Despliegue en el VPS de HSWare

Guía para publicar Santa Rosa (backend + frontend) en el VPS compartido de HSWare, que ya tiene nginx en el host y muchos otros sistemas en Docker.

- **Dominio:** `cabañasantarosa.hswaretecnologia.com`
- **Dominio en punycode:** `xn--cabaasantarosa-tnb.hswaretecnologia.com`

> **La ñ:** nginx, certbot, CORS y la firma de las fotos trabajan con la forma *punycode* del dominio (la `ñ` se codifica). El navegador muestra `cabañasantarosa…`, pero por dentro envía `xn--cabaasantarosa-tnb…`. En todos los archivos de configuración se usa la forma punycode. Para comprobarla:
>
> ```bash
> python3 -c "print('cabañasantarosa.hswaretecnologia.com'.encode('idna').decode())"
> ```

## Cómo queda armado

Todo funciona bajo el mismo dominio. El nginx del host es la única entrada (puertos 80 y 443) y reparte las peticiones:

| Ruta | Va a | Qué es |
| --- | --- | --- |
| `/api/...` | `127.0.0.1:3017` (contenedor de la API) | Backend NestJS. nginx quita el `/api`. |
| `/santa-rosa/...` | `127.0.0.1:3900` (contenedor de Garage) | Fotos y certificados, con URL firmadas. El prefijo es el nombre del bucket (`S3_BUCKET`). |
| `/` | `127.0.0.1:8097` (contenedor del frontend) | React compilado. |

### Puertos en el VPS

Los puertos que el sistema necesita en el host se eligieron entre los libres de `docker ps`:

| Contenedor | Puerto en el host | Puerto interno | Por qué este |
| --- | --- | --- | --- |
| API (`santa_rosa_backend-api-1`) | `127.0.0.1:3017` | `3000` | 3000 = Dokploy; 3012–3016 = otros sistemas |
| Frontend (`santa_rosa_front-web-1`) | `127.0.0.1:8097` | `80` | 8080 = clinica_villa; 8082–8096 ocupados en su mayoría |
| Garage (`santa_rosa_backend-garage-1`) | `127.0.0.1:3900` | `3900` | libre |
| PostgreSQL (`santa_rosa_backend-postgres-1`) | `127.0.0.1:5439` | `5432` | libre (solo para respaldos o inspección desde el VPS) |

Todos se publican **solo en 127.0.0.1**. Desde Internet no se llega a la base de datos, a la API ni a Garage sin pasar por nginx.

> **Importante:** Docker abre los puertos publicados por encima del firewall (ufw no los bloquea). Si en el `.env` falta el `127.0.0.1:`, el puerto queda abierto a Internet. Varios contenedores del VPS ya están así (`0.0.0.0:3000`, `0.0.0.0:3090`, `0.0.0.0:5440`…); no repita ese error.

Antes de levantar nada, confirme que los puertos siguen libres (el VPS cambia seguido):

```bash
ss -tlnp | grep -E ':(3017|8097|3900|5439)\b' || echo "libres"
```

Si alguno está ocupado, elija otro y cámbielo en el `.env` correspondiente y en el archivo de nginx (paso 7).

### El sistema anterior `santarosa-app`

En el VPS ya corren `santarosa-app` (puerto 3015) y `santarosa-db`. Esos contenedores son de **otro proyecto** y esta guía no los toca. Los nombres de contenedores, volúmenes y redes de este sistema (`santa_rosa_backend-*`, `santa_rosa_front-*`) no chocan con ellos.

Antes del paso 7, revise si el dominio ya apunta a ese sistema:

```bash
grep -rl -e "xn--cabaasantarosa" -e "3015" /etc/nginx/sites-enabled/
```

Si aparece un archivo, el dominio está sirviendo al sistema anterior. Decida con el equipo cuándo cambiarlo. Desactivar ese archivo deja fuera de servicio al sistema anterior.

## 1. Preparar el VPS

Docker y nginx ya están instalados. Verifique solamente:

```bash
docker compose version
nginx -v
dig +short xn--cabaasantarosa-tnb.hswaretecnologia.com   # debe mostrar la IP del VPS
```

Si `dig` no devuelve nada, falta el registro DNS (`A` hacia la IP del VPS) o un comodín `*.hswaretecnologia.com`.

## 2. Subir el código

Los dos repos tienen que estar en GitHub con todos los cambios (`git push`). Si son privados, el VPS necesita acceso: una *deploy key* por repo (GitHub → repo → Settings → Deploy keys) o un token personal.

```bash
sudo mkdir -p /opt/santa-rosa && sudo chown $USER: /opt/santa-rosa
cd /opt/santa-rosa
git clone https://github.com/wilmanProyect/santa_rosa_backend_rk.git santa_rosa_backend
git clone https://github.com/wilmanProyect/santa_rosa_front_rk.git santa_rosa_front_rk
```

## 3. Generar los secretos

En el VPS, genere valores **nuevos**. No reutilice los del equipo de desarrollo ni los de `.env.example`.

```bash
echo "JWT_SECRET=$(openssl rand -hex 48)"
echo "DB_PASSWORD=$(openssl rand -hex 24)"
echo "ADMIN_DEFAULT_PASSWORD=$(openssl rand -hex 8)"
echo "S3_ACCESS_KEY=GK$(openssl rand -hex 12)"
for v in S3_SECRET_KEY GARAGE_RPC_SECRET GARAGE_ADMIN_TOKEN; do echo "$v=$(openssl rand -hex 32)"; done
```

Guarde la salida en un gestor de contraseñas. `GARAGE_RPC_SECRET` y `DB_PASSWORD` no se pueden cambiar después sin intervenir los volúmenes.

## 4. Configurar el backend

```bash
cd /opt/santa-rosa/santa_rosa_backend
cp .env.example .env
chmod 600 .env
nano .env
```

Cambie estos valores (deje el resto como viene):

```dotenv
NODE_ENV=production

DB_PASSWORD=<generado>
JWT_SECRET=<generado>
ADMIN_DEFAULT_PASSWORD=<generado>

S3_ACCESS_KEY=<generado>
S3_SECRET_KEY=<generado>
GARAGE_RPC_SECRET=<generado>
GARAGE_ADMIN_TOKEN=<generado>
S3_BUCKET=santa-rosa

# El navegador descarga las fotos por el dominio (nginx → Garage).
# En punycode y sin "/" al final: el Host forma parte de la firma de la URL.
S3_PUBLIC_ENDPOINT=https://xn--cabaasantarosa-tnb.hswaretecnologia.com

# El navegador envía el Origin en punycode.
CORS_ORIGINS=https://xn--cabaasantarosa-tnb.hswaretecnologia.com
TRUST_PROXY=true

# Puertos solo en la máquina local: se entra únicamente por nginx.
DB_EXTERNAL_PORT=127.0.0.1:5439
API_EXTERNAL_PORT=127.0.0.1:3017
GARAGE_S3_EXTERNAL_PORT=127.0.0.1:3900
```

Si cambia `S3_BUCKET`, cambie también la ruta `/santa-rosa/` en nginx (paso 7).

Cree la carpeta de respaldos con el dueño que usa el contenedor y levante el backend:

```bash
mkdir -p backups && sudo chown 1000:1000 backups
docker compose up -d --build
docker compose logs -f api   # espere "Application is running", luego Ctrl+C
```

Compruebe:

```bash
docker compose ps                                                       # postgres, garage y api en "healthy"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3017/docs     # 200
ss -tlnp | grep -E ':(3017|3900|5439)\b'                                # todos en 127.0.0.1, ninguno en 0.0.0.0
```

## 5. Configurar el frontend

```bash
cd /opt/santa-rosa/santa_rosa_front_rk
echo "FRONTEND_PORT=127.0.0.1:8097" > .env
docker compose up -d --build
curl -s http://127.0.0.1:8097/healthz    # ok
```

El frontend se compila con `VITE_API_URL=/api`: llama a la API por el mismo dominio y no necesita CORS. En el VPS, `/api` lo atiende directamente el nginx del host (paso 7). El proxy `/api` interno del contenedor del frontend solo se usa en local.

## 6. Pasar los datos reales

La base del equipo de desarrollo tiene los datos reales cargados. Se trasladan con el sistema de copias de seguridad.

En el equipo de desarrollo (Windows, con los contenedores levantados):

```powershell
cd santa_rosa_backend
pnpm backup        # genera backups\santa-rosa-respaldo-AAAAMMDD-HHMMSS.tar.gz
scp backups\santa-rosa-respaldo-AAAAMMDD-HHMMSS.tar.gz usuario@IP_DEL_VPS:/opt/santa-rosa/santa_rosa_backend/backups/
```

En el VPS:

```bash
cd /opt/santa-rosa/santa_rosa_backend
sudo chown 1000:1000 backups/*.tar.gz
docker compose run --rm api node dist/modules/backups/cli/backup.cli.js restore santa-rosa-respaldo-AAAAMMDD-HHMMSS.tar.gz
docker compose restart api
```

El comando pide escribir `RESTAURAR`. Después de restaurar, los usuarios y contraseñas son los del equipo de desarrollo (el admin generado en el paso 3 deja de existir).

## 7. Configurar nginx y HTTPS

Cree `/etc/nginx/sites-available/cabanasantarosa`:

```nginx
server {
    listen 80;
    listen [::]:80;
    # cabañasantarosa.hswaretecnologia.com en punycode.
    server_name xn--cabaasantarosa-tnb.hswaretecnologia.com;

    # Fotos (hasta 15 MB) y certificados (hasta 10 MB).
    client_max_body_size 50m;

    # Restaurar una copia de seguridad subiéndola desde el sistema: el archivo
    # puede pesar cientos de MB. Cloudflare (plan gratuito) corta en 100 MB; un
    # respaldo más grande se copia a ./backups y se restaura desde el servidor.
    location = /api/backups/restore/upload {
        client_max_body_size 2g;
        proxy_pass http://127.0.0.1:3017/backups/restore/upload;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
        # Pasa el archivo a la API mientras llega, sin guardarlo antes en disco.
        proxy_request_buffering off;
    }

    # API: /api/animals -> http://127.0.0.1:3017/animals
    location /api/ {
        proxy_pass http://127.0.0.1:3017/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Las copias de seguridad tardan y pesan: se pasan sin guardarlas en disco.
        proxy_read_timeout 900s;
        proxy_send_timeout 900s;
        proxy_buffering off;
    }

    # Garage. Sin "/" al final del proxy_pass: la ruta llega intacta, y el Host
    # tiene que ser el del dominio, porque es parte de la firma de la URL.
    location /santa-rosa/ {
        proxy_pass http://127.0.0.1:3900;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
    }

    # Frontend.
    location / {
        proxy_pass http://127.0.0.1:8097;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Actívelo y obtenga el certificado HTTPS (Let's Encrypt):

```bash
sudo ln -s /etc/nginx/sites-available/cabanasantarosa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d xn--cabaasantarosa-tnb.hswaretecnologia.com --redirect
```

certbot agrega el bloque `listen 443 ssl` y redirige HTTP a HTTPS. Si `certbot` no está instalado: `sudo apt install -y certbot python3-certbot-nginx`. La renovación es automática (`sudo certbot renew --dry-run` para probarla).

> `nginx -t` revisa **todos** los sitios del VPS. Si falla por un archivo que no es `cabanasantarosa`, no recargue: el error es de otro sistema y un reload no aplicaría nada. Avise al responsable de ese sistema.

## 8. Verificar

1. Abra `https://cabañasantarosa.hswaretecnologia.com` e inicie sesión.
2. Abra un animal y suba una foto: debe verse la miniatura. Si la foto no carga y el navegador muestra `403` o `SignatureDoesNotMatch`, revise que `S3_PUBLIC_ENDPOINT` esté en punycode, con `https` y sin `/` al final, y que el `location /santa-rosa/` tenga `proxy_set_header Host $host`.
3. Descargue un certificado PDF.
4. Descargue una copia de seguridad desde el sistema.

## Actualizar a una versión nueva

```bash
cd /opt/santa-rosa/santa_rosa_backend
docker compose exec -T api node dist/modules/backups/cli/backup.cli.js backup   # respaldo antes de actualizar
git pull
docker compose up -d --build        # aplica las migraciones al arrancar

cd /opt/santa-rosa/santa_rosa_front_rk
git pull
docker compose up -d --build
```

Siempre ejecute `docker compose` **dentro de la carpeta del proyecto**. Así solo afecta a los contenedores de Santa Rosa y no a los demás sistemas del VPS. Nunca use `docker compose down -v`: borra la base de datos y las fotos.

## Contingencias

| Síntoma | Revisar |
| --- | --- |
| `502 Bad Gateway` en todo el sitio | `docker ps \| grep santa_rosa_front`; `curl -s http://127.0.0.1:8097/healthz`; el puerto en `grep proxy_pass /etc/nginx/sites-enabled/cabanasantarosa` |
| `502` solo al iniciar sesión o al cargar datos | `docker compose ps` en el backend; `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3017/docs`; `docker compose logs --tail 50 api` |
| Las fotos no cargan (`403`, `SignatureDoesNotMatch`) | `S3_PUBLIC_ENDPOINT` en punycode y con `https`; `proxy_set_header Host $host` en `/santa-rosa/` |
| `port is already allocated` al levantar | Otro sistema tomó el puerto: elija otro libre (`ss -tlnp`) y cámbielo en el `.env` y en nginx |
| La API se reinicia en bucle | `docker compose logs api`: casi siempre falta una variable en `.env` o la base no arrancó |
| `git pull` rechaza por cambios locales | `git stash && git pull && git stash pop` |

## Copias de seguridad en el servidor

Respaldo diario a las 02:00 con `crontab -e`:

```cron
0 2 * * * cd /opt/santa-rosa/santa_rosa_backend && docker compose exec -T api node dist/modules/backups/cli/backup.cli.js backup >> backups/cron.log 2>&1
```

Los respaldos quedan en `/opt/santa-rosa/santa_rosa_backend/backups`. Cópielos fuera del VPS con regularidad (por ejemplo con `scp` hacia su equipo). Guarde también una copia del `.env`: sin él no se puede levantar el sistema en otro servidor.
