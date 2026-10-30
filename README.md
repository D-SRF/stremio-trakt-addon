# Stremio Trakt Companion

Addon comunitario **multiusuario** de Stremio, con autenticación individual mediante Trakt OAuth 2.0. Licencia MIT.

> **Estado: MVP / beta.** Muestra watchlists, colección, historial y el progreso **ya registrado en Trakt**. **NO captura automáticamente la posición del reproductor de Stremio.** El protocolo estándar de catálogos de Stremio no proporciona eventos universales de reproducción. No afirmamos compatibilidad de scrobbling automático con todos los dispositivos. Para Stremio → Trakt, usar la integración nativa de Trakt de Stremio, si está disponible en la plataforma y versión. Este proyecto no la sustituye.

## Qué incluye

- OAuth 2.0 Trakt, refresh automático, almacenamiento cifrado AES-256-GCM.
- URLs de instalación individuales y catálogos Stremio: watchlists, colección, películas vistas y series con historial.
- Panel web que consulta `/sync/playback` y muestra porcentaje registrado en Trakt.
- Docker, SQLite persistente, límites básicos de peticiones y borrado de cuenta local.

## Preparar Trakt

1. En https://trakt.tv/oauth/applications crea una aplicación nueva.
2. **Redirect URI**: `https://TU-DOMINIO/auth/callback` (para desarrollo: `http://localhost:7000/auth/callback`).
3. Guarda **Client ID** y **Client Secret**. Nunca subas el secreto a GitHub.

## Ejecutar localmente

Requiere Node.js 20+ y herramientas para compilar `better-sqlite3` si tu plataforma no tiene binarios precompilados.

```bash
cp .env.example .env
# Edita .env: TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
# Para generar las dos claves: openssl rand -hex 32
npm install
npm start
```

Abre `http://localhost:7000`. Pulsa **Conectar con Trakt** y después **Abrir en Stremio**. En algunas plataformas Stremio no permite instalar addons desde `localhost`; despliega con HTTPS para instalación pública.

## Despliegue con Docker

```bash
cp .env.example .env
# Configura PUBLIC_URL=https://tu-dominio y los demás secretos
# Configura en Trakt Redirect URI=https://tu-dominio/auth/callback
docker compose up -d --build
```

Configura un proxy HTTPS (Caddy, Nginx, Traefik o servicio gestionado) hacia el puerto 7000. Si se usa un proxy confiable, `TRUST_PROXY=1`. **Conserva el volumen `trakt_data` y las claves**; perderlas invalida la recuperación de tokens. No publiques el puerto 7000 sin protección de red en producción.

## Estructura de archivos

```text
.github/workflows/ci.yml  Pruebas en GitHub Actions
src/server.js             Web, OAuth, endpoints del addon y panel
src/trakt.js              Cliente Trakt y renovación de tokens
src/store.js              SQLite y cifrado
src/catalogs.js           Catálogos Stremio
src/config.js             Variables de entorno y validación
public/index.html         Interfaz de configuración
Dockerfile                Imagen de despliegue
docker-compose.yml        Servicio y volumen de datos
.env.example              Plantilla de configuración (sin secretos)
.gitignore                Archivos que no deben subirse
```

## Endpoints

- `GET /` página de configuración.
- `GET /auth/start` y `GET /auth/callback` OAuth.
- `GET /api/me`, `GET /api/progress`, `POST /api/disconnect` sesión web.
- `GET /u/:id/manifest.json` manifiesto personalizado.
- `GET /u/:id/catalog/:type/:catalogId.json` catálogo Stremio.

## Privacidad y limitaciones

- La URL individual del addon es una **capability URL**: cualquiera que la tenga puede leer los catálogos asociados. No la compartas ni la incluyas en capturas públicas.
- No se guardan contraseñas Trakt; se guardan tokens cifrados en SQLite. El administrador del servidor controla las claves y por tanto debe ser de confianza.
- No se implementan todavía listas personalizadas, imágenes enriquecidas, siguiente episodio exacto ni escritura de scrobbles.
- El panel consulta Trakt al pulsar el botón. No ejecuta una sincronización periódica ni conoce el progreso local de Stremio.
- El historial de series muestra series vistas, **no** garantiza que haya episodios pendientes.
- Para producción pública se recomienda añadir protección CSRF explícita, políticas de privacidad, supervisión, backups cifrados y pruebas de carga. Esta entrega es un MVP y requiere validación real con cuentas Trakt/Stremio.

## Cómo subir a GitHub

En https://github.com/D-SRF/stremio-trakt-addon pulsa **Add file → Upload files** y arrastra **el contenido** de esta carpeta (no la carpeta contenedora). GitHub web puede no conservar correctamente carpetas ocultas; lo más fiable es Git:

```bash
git clone https://github.com/D-SRF/stremio-trakt-addon.git
cd stremio-trakt-addon
# Copia AQUÍ todos los archivos y carpetas del ZIP extraído
git add .
git commit -m "Initial multi-user Trakt companion addon"
git push origin main
```

**No subas `.env`, `data/`, claves, tokens ni bases de datos.**

## Próximos pasos

1. Validar OAuth y los catálogos en Trakt y Stremio reales.
2. Completar siguiente episodio y listas personalizadas.
3. Investigar integración de eventos del reproductor únicamente en clientes que la soporten, sin asumir que todos los Stremio los envían.
4. Añadir pruebas de integración y endurecimiento de seguridad antes de abrir al público.
