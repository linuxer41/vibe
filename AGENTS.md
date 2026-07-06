# Vibe App — Full Feature Reference

## Arquitectura

| Capa | Tecnología | Puerto |
|---|---|---|
| Frontend | SvelteKit + adapter-auto | 5173 |
| Backend (Node.js) | Express + Socket.IO + pg | 3000 |
| Backend (Rust) | Axum + socketioxide + tokio-postgres | 3001 |
| DB | PostgreSQL | 5432 |
| Cache/PubSub | Valkey (Redis) | 6379 |

---

## Rutas Frontend

| Ruta | Descripción |
|---|---|
| `/` | Chats (inbox) |
| `/chat?id=X` | Chat individual/grupo |
| `/contact` | Contactos |
| `/feed` | Feed de posts (Todo/Contactos/Míos) |
| `/post/new` | Crear post (cámara, galería, texto) |
| `/live` | Lives activos + iniciar live |
| `/calls` | Llamadas recientes |
| `/shop` | Tienda Vibe |
| `/games` | Juegos |
| `/camera` | Cámara para posts (legacy) |
| `/profile` | Perfil |
| `/settings` | Ajustes |
| `/init` | Setup inicial |
| `/privacy-policy` | Política privacidad |
| `/terms` | Términos |

---

## Sistema de Autenticación

- Login vía código SMS (6 dígitos) `send_code` / `verify_code`
- Token JWT-like en localStorage (`wa_token`)
- Sesiones múltiples con gestión desde settings
- Passcode local opcional (bloqueo de app)
- Two-step password opcional (PIN de seguridad)

---

## Mensajería (Chats)

### Tipos de chat
- Privado (1:1)
- Grupos (múltiples miembros)
- Mensajes: texto, imagen, video, audio, documento

### Funcionalidades
- Mensajes con reply (`reply_to_id`) y forward (`forwarded`)
- Mensajes temporales/expiración
- Pin de chats
- Indicador de escritura (`typing`)
- Leído/entregado (`mark_read`)
- Búsqueda de mensajes
- Reenvío de mensajes entre chats

---

## Feed / Posts

### Tipos de post
- Texto, imagen, video
- Expiran a las 24h (`expires_at`)

### Interacciones
- Like/unlike posts
- Comentarios con replies (anidados vía `parent_id`)
- Vista de post (contador `post_views`)
- Likes del post

### Filtros
- **Todo**: todos los posts activos
- **Contactos**: posts del usuario + sus contactos
- **Míos**: solo posts del usuario

---

## Live Streaming

### Estados de página
1. **Browse** — lista de lives activos ordenados por fecha (FAB "Iniciar Live")
2. **Setup** — preview cámara + título + botón iniciar (fullscreen)
3. **Streaming** — transmisión en vivo (fullscreen)

### Controles de cámara
- Cambio frontal/trasera (`facingMode`)
- Zoom digital (vía `getCapabilities().zoom` + `applyConstraints`)

### Interacciones en vivo
- **Comentarios** en tiempo real (`live_comments`)
- **Reacciones** (❤️ 👍 etc) con deduplicación (`live_reactions` — UNIQUE)
- **Estrellas/Gifts** — gastar estrellas del Vibe Balance para enviar regalos al streamer

### Eventos Socket.IO
| Evento | Dirección |
|---|---|
| `start_live` / `end_live` | Cliente → Servidor |
| `get_active_lives` | Cliente → Servidor |
| `add_live_comment` | Cliente → Servidor |
| `new_live_comment` | Servidor → `live:{id}` |
| `add_live_reaction` | Cliente → Servidor |
| `new_live_reaction` | Servidor → `live:{id}` |
| `send_live_gift` | Cliente → Servidor |
| `new_live_gift` | Servidor → `live:{id}` |
| `get_user_stars` | Cliente → Servidor |

---

## Vibe Balance & Estrellas

### Cómo se ganan estrellas
- Actividad en la app (mensajería, feed, live, shop, juegos, calls)
- Cada minuto de actividad suma al balance diario
- Las estrellas se pueden gastar en lives como gifts

### Tablas
- `vibe_balance` — balance diario por usuario (minutos + estrellas)
- `live_gifts` — gifts enviados en lives

---

## WebRTC Calls

### Peer-to-Peer
- Señalización vía Socket.IO (`start_call`, `accept_call`, `ice_candidate`, `offer`, `answer`)
- Llamadas de audio y video
- Lista de llamadas activas

### LiveKit (opcional)
- Llamadas grupales vía LiveKit server
- Token JWT generado en `livekit_token` handler

### Broadcast
- Transmisiones uno-a-muchos
- Tabla `broadcasts` + `broadcast_viewers`

---

## Canales y Comunidades

### Canales
- Suscripción, posts dentro del canal
- Crear/ver canales públicos

### Comunidades
- Unirse/salir de comunidades
- Posts comunitarios

---

## Tienda (Shop)

- Productos con imágenes y precios
- Órdenes de compra
- Wishlist (lista de deseos)
- Flash Deals (ofertas relámpago)

---

## Juegos

- Lista de juegos disponibles (`getAvailableGames`)
- Sesiones multijugador (crear/unirse)
- Puntuaciones en tiempo real

---

## Memes & Stickers

- Crear memes con imágenes + texto
- Like de memes
- Sticker packs (compra/colección)
- Stickers animados

---

## Watch Together

- Sesiones de visualización sincronizada
- Control de reproducción (`playback_time`, `sync_type`)
- Sincronización en tiempo real

---

## Otras Features

| Feature | Descripción |
|---|---|
| **Perfil 3D Avatar** | Personalización de avatar con guardado JSON |
| **Notificaciones Inteligentes** | Agrupadas por tipo, mark leídas |
| **Focus Sessions** | Modo focus/work/sleep con timer |
| **Notas Compartidas** | Notas en tiempo real entre usuarios |
| **Tasks** | Lista de tareas con completado |
| **Schedule Delete** | Autodestrucción programada de cuenta |
| **Bloqueo de usuarios** | Block/unblock con verificación |
| **Two-Step Auth** | PIN secundario opcional |
| **Passcode App** | Bloqueo local con PIN |
| **Themes** | Dark/Light mode |

---

## Migraciones SQL (orden)

1. `001_init.sql` — Tablas base (users, chats, messages, posts, etc.)
2. `002_vibe_tables.sql` — Vibe features (channels, polls, shop, games, etc.)
3. `003_webrtc.sql` — WebRTC calls + broadcasts + lives
4. `004_snowflake.sql` — Convertir SERIAL a BIGINT para Snowflake IDs
5. `005_live_comments.sql` — Live comments + reactions + parent_id en posts
6. `006_stars_gifts.sql` — Estrellas en vibe_balance + live_gifts

---

## Backend Rust (en desarrollo)

- Drop-in replacement del backend Node.js
- Mismos handlers Socket.IO (socketioxide)
- Mismos eventos y estructura de datos
- Snowflake IDs vía `snowflake.rs`
- Logging con tracing + compact format
- **Pendiente**: compilar en toolchain adecuado (no disponible en Termux)

---

## Convenciones de Código

- **IDs**: Snowflake 53-bit (seguros para JS Number)
- **Logging**: Pino (Node.js) / tracing (Rust) con timestamps ISO
- **Socket.IO**: Siempre `data || {}` para null-safe destructuring
- **DB**: `pool.query` con parámetros $1, $2 ... y `RETURNING`
- **Frontend**: Svelte 5 runes (`$state`, `$derived`), stores con `.subscribe()`
- **SQL**: Migraciones en archivos numerados, ejecutadas por `migrate.js`
- **CSS**: Variables CSS personalizadas (`var(--bg)`, `var(--accent)`, etc.)
