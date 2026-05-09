# Winchester Round Table — Audit Report
> Аудит проведён: 2026-05-09. Код не изменялся. Всё привязано к реальным файлам/строкам.

---

## Executive Summary

**Что сейчас норм:**
- WebRTC голос реализован правильно — аудио идёт peer-to-peer, НЕ через сервер.
- История чата персистируется в PostgreSQL с Docker volume — переживёт перезапуск.
- Production Dockerfile многоступенчатый, NODE_ENV=production, dev-зависимости не попадают в runtime.
- `make up` / `make up-dev` разделены через Docker Compose profiles — prod не запускает Vite/HMR.
- Cleanup WebRTC: tracks, AudioContext, PeerConnections чистятся на unmount и beforeunload.
- WakeLock реализован корректно с visibility re-request.
- Нет sourcemap в dist-бандле.

**Что критично:**
- `docker-entrypoint.sh` **обрезан** на 1307 байт — bore tunnel код не завершён, скрипт падает на `if bore_wanted`.
- `vite.config.ts` **обрезан** — proxy-конфиг для `/socket.io` не закрыт, Vite dev server в dev-режиме работает только частично.
- `ENABLE_BORE` по умолчанию `1` — bore стартует автоматически в **prod** при каждом `make up`.
- CORS `origin: true` — принимает любой origin, без ограничений.
- Нет TURN-серверов — WebRTC за strict NAT/мобильными сетями упадёт.
- Нет rate limiting на auth endpoints (`/api/auth/register`, `/api/auth/login`).
- Нет invite code / room password — любой, кто получил ngrok URL, может зарегистрироваться.

**Что мешает использовать ngrok временно:**
- Огромные knight-аватары (knight14–24: 800–960 KB каждый = ~8 MB только для части портретов). При 13 юзерах с разными аватарами — все 13 файлов грузятся.
- `logo.png` (925 KB) — при наличии `logo.webp` (125 KB).
- socket.io не ограничен transport: `websocket` — по умолчанию сначала HTTP polling, потом upgrade. Каждое подключение = дополнительные HTTP-запросы через ngrok.
- bore tunnel стартует в prod по умолчанию (если не сломан entrypoint), тратя ресурсы bore.pub.

**Что мешает 13 людям с голосом:**
- Нет TURN — за NAT/мобильными ICE не пройдёт.
- Offer glare — если два юзера включают mic одновременно, возможны конфликты PC-состояний.
- `connectionState === 'failed'` только закрывает соединение, но не пытается переподключиться.
- `audio.autoplay = true` на HTMLAudioElement без .play() — заблокируется autoplay policy Chrome, если нет user gesture.

---

## Current Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + Vite SPA)                                 │
│  client/src/                                                 │
│  ├── App.tsx              — auth flow, top-level state       │
│  ├── hooks/useRoom.ts     — socket.io state machine         │
│  ├── hooks/useVoiceChat.ts— WebRTC mesh, getUserMedia        │
│  ├── hooks/useWakeLock.ts — Screen Wake Lock API            │
│  └── socket.ts            — socket.io-client singleton      │
└────────────┬───────────────────┬────────────────────────────┘
             │ WebSocket (signaling only)    │ WebRTC (P2P audio)
             │ socket.io                     │ RTCPeerConnection × N
             ▼                              ─▼─ (direct, no server)
┌─────────────────────────┐         ┌──────────────────────────┐
│  Node.js + Express      │         │  Each peer ↔ each peer   │
│  server/index.ts        │         │  STUN: stun.l.google.com │
│  + socket.io Server     │         │  TURN: NONE              │
│  port 3000              │         └──────────────────────────┘
│  ├── /api/auth/*        │
│  ├── /api/health        │
│  └── static dist/client │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────┐
│  PostgreSQL 16          │
│  (Docker volume:        │
│   winchester_pgdata)    │
│  tables: users,         │
│  sessions,chat_messages │
└─────────────────────────┘

Docker targets:
  make up     → docker compose up winchester + postgres (prod)
  make up-dev → docker compose --profile dev up winchester-dev + postgres

Tunnel (prod container):
  bore (baked in Dockerfile, ENABLE_BORE=1 default) → bore.pub
  cloudflared.exe присутствует в repo root (Windows, вне Docker)
  ngrok: порт 4040 в compose, NGROK_AUTHTOKEN env — но ngrok процесс нигде не запускается
```

---

## make up vs make up-dev

| Target | Command chain | Environment | Services | Ports | Volumes | Risk | Verdict |
|---|---|---|---|---|---|---|---|
| `make up` | `docker compose up -d --build winchester postgres` | NODE_ENV=production, ENABLE_BORE=1 | winchester + postgres | 3000, **4040** | winchester_pgdata | bore стартует автоматически; entrypoint truncated → bore код ломается | ⚠️ PROD-LIKE, но с багом entrypoint |
| `make up-dev` | `docker compose --profile dev up --build winchester-dev postgres` | NODE_ENV=development, CHOKIDAR_USEPOLLING=true | winchester-dev + postgres | 5173, 3000 | bind-mount `.:/app`, winchester_dev_node_modules | bind-mount исходников, tsx watch, Vite HMR | ✅ DEV-ONLY корректно |
| `make dev` | `npm run dev` (локально) | берёт из .env | — | 5173, 3000 | — | нужен локальный postgres | ℹ️ local only |

**Вывод:** Разделение prod/dev через profiles — правильное архитектурное решение. Prod НЕ запускает Vite/HMR/tsx watch. Главная проблема — обрезанный entrypoint.

---

## Critical Findings

| Severity | Area | Finding | Evidence file/line | Impact | Suggested fix |
|---|---|---|---|---|---|
| 🔴 CRITICAL | Entrypoint | `docker-entrypoint.sh` обрезан на 1307 байт. Файл заканчивается на `echo "Relay: $BOR` — строка не закрыта, скрипт невалиден. Контейнер упадёт при `if bore_wanted` блоке если bore включён. | `docker-entrypoint.sh`, байт 1307, последняя строка: `echo "Relay: $BOR` | При ENABLE_BORE=1 (default) prod-контейнер не стартует либо выдаёт синтакс-ошибку sh | Восстановить полный текст entrypoint; дописать bore-блок и `wait $SERVER_PID` |
| 🔴 CRITICAL | Vite config | `vite.config.ts` обрезан на 531 байт. Proxy-конфиг `/socket.io` не закрыт: файл заканчивается на `'/socket.io': {` без тела и закрывающих скобок. В dev (`make up-dev`) socket.io proxy будет сломан. | `vite.config.ts`, последняя строка обрезана | Dev-режим: socket.io через Vite proxy не работает → голос/чат не работают в dev | Восстановить полный vite.config.ts с закрытым proxy-блоком для `/socket.io` |
| 🔴 CRITICAL | CORS | `cors: { origin: true }` и socket.io `cors: { origin: true }` — принимают **любой** origin без ограничений | `server/index.ts:33`, `server/index.ts:36` | Любой сайт может делать credentialed requests; CSRF возможен | Ограничить origin списком допустимых значений или отключить CORS если SPA и API на одном домене |
| 🔴 CRITICAL | Security | Нет invite code / room password. Любой, кто знает ngrok URL, может самостоятельно зарегистрироваться через `/api/auth/register` и войти в комнату. | `server/auth.ts:36–70` (register endpoint без ограничений) | Посторонние попадут в "закрытый" чат | Добавить INVITE_CODE env var, проверять при register |
| 🔴 CRITICAL | WebRTC | Нет TURN-серверов. Только STUN: `stun.l.google.com:19302` и `stun1.l.google.com:19302` | `useVoiceChat.ts:18–23` (ICE_SERVERS) | За symmetric NAT и мобильными сетями (4G/5G) ICE не пройдёт, голос не заработает | Добавить TURN сервер (coturn или облачный: Metered, Twilio, Xirsys) |
| 🔴 CRITICAL | Rate limiting | Нет rate limiting на `/api/auth/register` и `/api/auth/login`. bcrypt даёт ~natural limit для login, но register + брутфорс login — без защиты | `server/auth.ts` полностью, `server/index.ts` — нет express-rate-limit | Брутфорс паролей, регистрация спам-аккаунтов, DoS через bcrypt | Добавить `express-rate-limit`: 10 req/min на /api/auth/* |

---

## High Findings

| Severity | Area | Finding | Evidence file/line | Impact | Suggested fix |
|---|---|---|---|---|---|
| 🟠 HIGH | bore default ON | `ENABLE_BORE` defaults to `1` в entrypoint (`${ENABLE_BORE:-1}`). Bore стартует при каждом `make up` даже без явного желания. | `docker-entrypoint.sh:7` (`ENABLE_BORE:-1`), `.env:ENABLE_BORE=1`, `docker-compose.yml:ENABLE_BORE: ${ENABLE_BORE:-1}` | Лишний трафик через bore.pub, непредсказуемый публичный URL при каждом старте, усложняет безопасность | Сменить default на `0`: `ENABLE_BORE:-0`. Туннель — явный opt-in |
| 🟠 HIGH | ngrok port exposed | Порт 4040 опубликован в docker-compose для `winchester` сервиса: `"4040:4040"` | `docker-compose.yml:18` | Ngrok admin UI публично доступен по IP хоста; если ngrok запустился, через admin API виден tunnel URL | Убрать 4040 из prod ports; ngrok в проекте не используется активно |
| 🟠 HIGH | WebRTC offer glare | При одновременном включении mic двумя юзерами: A создаёт offer к B, B создаёт offer к A. `handleVoiceOffer` проверяет: `if (!pc) pc = createPeerConnection(...)` — но если у A уже есть PC к B в состоянии `have-local-offer`, получение offer от B вызывает конфликт setRemoteDescription. | `useVoiceChat.ts:193–205` (`handleVoiceOffer`) | Голосовое соединение зависает, пользователи не слышат друг друга | Реализовать glare resolution по RFC 8829: сравнивать userId, "больший" отменяет свой offer и отвечает |
| 🟠 HIGH | No WebRTC reconnect | `onconnectionstatechange: 'failed'` → `closePeerConnection(targetUserId)` без попытки переподключиться | `useVoiceChat.ts:88–91` | При временной потере сети голос пропадает навсегда до мануального re-toggle mic | Добавить backoff-retry: через 2–5с создать новый PC и отправить offer |
| 🟠 HIGH | autoplay blocked | `audio.autoplay = true` на HTMLAudioElement без вызова `.play()`. Chrome/Safari блокируют autoplay без user gesture после первого входа | `useVoiceChat.ts:80` (`audio.autoplay = true`) | Удалённый голос не воспроизводится — пользователь ничего не слышит | Вызывать `audio.play().catch(...)` после `audio.srcObject = ...`; предусмотреть "click to unmute" UI |
| 🟠 HIGH | socket.io polling | socket.io-client не имеет `transports: ['websocket']`. По умолчанию: сначала HTTP long-polling (несколько XHR), потом upgrade. | `socket.ts:55–64` (нет transports параметра) | Через ngrok: каждое подключение = 2–3 HTTP-запроса до установки WebSocket. При 13 юзерах с reconnect storms — лишние запросы | Добавить `transports: ['websocket']` в socket.io-client options |
| 🟠 HIGH | CHAT_HISTORY_VERSION mismatch | `.env` имеет `CHAT_HISTORY_VERSION=1.0.0`, `.env.example` имеет `CHAT_HISTORY_VERSION=1`. DB хранит version="1" (после первого запуска), но если .env изменили на "1.0.0" — история "исчезает" (не удаляется, просто не отдаётся). | `.env:5` (`1.0.0`), `.env.example:14` (`1`), `server/db.ts:153` (`WHERE version = $1`) | Пользователи видят пустую историю при несовпадении version | Привести к единому значению; версию менять только намеренно |
| 🟠 HIGH | Assets: knight 14–24 huge | Knight portraits 14–24: от 815 KB до 962 KB каждый (webp). Итого: ~8 MB только для последних 11 аватаров. При 13 юзерах — возможна загрузка всех 24 портретов = ~12 MB. | `client/public/knights/knight14–24.webp` | Через ngrok: каждый новый пользователь тянет до 12 MB аватаров; нет кеш-заголовков | Пересжать до 100–200 KB (webp quality 70–80). Добавить Cache-Control |
| 🟠 HIGH | logo.png not used | `logo.png` (925 KB) существует рядом с `logo.webp` (125 KB). Если где-то референсируется png — перерасход | `client/public/logo.png` (925 KB), `client/public/logo.webp` (125 KB) | +800 KB трафика при загрузке страницы | Убедиться что везде используется `.webp`; удалить `.png` |
| 🟠 HIGH | cloudflared.exe in repo | 63 MB Windows-бинарь заменен в корне проекта. Не используется в Docker, не в `.gitignore` | Корень репо, `cloudflared.exe` (63 MB) | Замусоривает репозиторий, раздувает docker build context (хотя `.dockerignore` должен его исключать) | Добавить в `.gitignore`, удалить из трекинга git |

---

## Medium Findings

| Severity | Area | Finding | Evidence file/line | Impact | Suggested fix |
|---|---|---|---|---|---|
| 🟡 MEDIUM | Mute = full reconnect | `disableMic()` → `closeAllConnections()` + `socket.emit('voice_leave')`. При повторном включении mic — новые offers ко всем. Для 12 пиров = 12 новых PeerConnections + ICE negotiation. | `useVoiceChat.ts:175–186` | При частом mute/unmute — latency spike, лишний signaling трафик | Реализовать mute через `track.enabled = false` без закрытия PC |
| 🟡 MEDIUM | No cache headers | Сервер раздаёт `express.static(clientDistPath)` без явных cache-control заголовков для статики. | `server/index.ts:43` | Аватары, шрифты, бандл загружаются заново при каждом посещении через ngrok | Добавить `maxAge` в express.static: `express.static(path, { maxAge: '7d' })` |
| 🟡 MEDIUM | speaking_status frequency | `SPEAKING_CHECK_INTERVAL = 100` ms setInterval. При разговоре — событие `speaking_status` эмитируется при каждом change (ON/OFF). В активном разговоре: up to 10 events/sec на юзера × 13 юзеров | `useVoiceChat.ts:24–25`, `useVoiceChat.ts:124–134` | Через ngrok: мелкие WebSocket frames частые, но не критичны (change-only) | Добавить debounce 200–300ms на change; уменьшить check interval до 250ms |
| 🟡 MEDIUM | POSTGRES_PASSWORD=changeme | Default пароль в `.env` и docker-compose fallback: `${POSTGRES_PASSWORD:-changeme}` | `.env:4`, `docker-compose.yml:10` | В production-like запуске слабый default | Сменить в `.env` на случайный пароль; документировать |
| 🟡 MEDIUM | Session TTL = 30 дней | Сессии живут 30 дней. При компрометации токена — долгое окно атаки | `server/db.ts:98` (`SESSION_TTL_MS = 30 * 24 * ...`) | Угнанная сессия живёт долго | Уменьшить до 7 дней; добавить endpoint для инвалидации всех сессий юзера |
| 🟡 MEDIUM | /api/health без auth | Endpoint публично доступен: возвращает `{ status, users, chatVersion }` | `server/index.ts:37–39` | Раскрывает текущий count пользователей; chatVersion — информация для атакующего | Не критично для ngrok temp, но для prod: убрать chatVersion из ответа |
| 🟡 MEDIUM | Нет cleanup voice при room leave | `leaveTable()` в useRoom.ts не вызывает `disableMic()` | `useRoom.ts:270–285` (`leaveTable`), `App.tsx:91` | При нажатии Logout — mic может остаться открытым, PeerConnections висят в памяти | Вызвать `disableMic()` перед `leaveTable()` (уже есть в `handleLogout` в App.tsx — но не в leaveTable напрямую) |
| 🟡 MEDIUM | knightSession.ts не найден | Файл `client/src/lib/knightSession.ts` присутствует в файловой системе | `client/src/lib/knightSession.ts` — не прочитан | Неизвестное содержимое, возможно мёртвый код | Проверить и удалить если не используется |
| 🟡 MEDIUM | Минимальная длина пароля 4 | `MIN_PASSWORD_LEN = 4` в auth.ts | `server/auth.ts:8` | Слабые пароли допускаются | Поднять до 8 |

---

## Low Findings

| Severity | Area | Finding | Evidence file/line | Impact | Suggested fix |
|---|---|---|---|---|---|
| 🟢 LOW | TEST_USERS_ENABLED = false | Константа `TEST_USERS_ENABLED = false` hardcoded в KnightRoster.tsx (не из env). В .env есть `TEST_USERS=0` которое нигде не читается. | `client/src/components/KnightRoster.tsx:8`, `.env:9` | Мёртвый env var, путаница | Убрать `TEST_USERS` из `.env`; убрать или доработать тестовый код |
| 🟢 LOW | testMessagesEnabled = false | `const testMessagesEnabled = false` hardcoded в ChatPanel.tsx. Есть массив test-сообщений с очень длинным именем пользователя (UI стресс-тест). | `client/src/components/ChatPanel.tsx:8` | Мёртвый код, не влияет на prod | Удалить блок с testMessages если не нужен |
| 🟢 LOW | package-lock.json в Dockerfile | Prod Dockerfile не копирует package-lock.json (только package.json + npm install). Dev Dockerfile копирует package-lock.json + npm ci. | `Dockerfile:8` ("COPY package.json ./"), `Dockerfile.dev:11` (COPY package.json package-lock.json) | Prod: версии зависимостей могут поплыть между сборками | Скопировать package-lock.json и использовать npm ci в prod тоже |
| 🟢 LOW | Нет NEXT_TELEMETRY_DISABLED | Не применимо — проект не на Next.js, а на Vite. Хорошо. | — | — | — |
| 🟢 LOW | tsconfig.node.json | Файл присутствует, скорее всего для Vite-конфига. Не проверен полностью. | `tsconfig.node.json` | — | Проверить что не конфликтует с tsconfig.server.json |
| 🟢 LOW | favicon.png (87 KB) | favicon.png — PNG формат, нет ico/svg. 87 KB — крупновато для favicon. | `client/public/favicon.png` | Небольшой лишний трафик | Сконвертировать в ico/32px или svg |
| 🟢 LOW | MAX_ROOM_SIZE = 0 (unlimited) | По умолчанию `MAX_ROOM_SIZE = 0 = unlimited`. Для 13 человек не критично, но комната ничем не ограничена если env не задан. | `server/roomState.ts:8–11` | — | Установить `MAX_ROOM_SIZE=13` в prod .env |

---

## Ngrok Survival Checklist

### Что точно надо сделать чтобы не улетали лимиты:

1. **Пересжать knight14–24.webp** до ≤150 KB каждый — это самые жирные файлы (800–960 KB).
2. **Удалить logo.png** (925 KB) — использовать только logo.webp (125 KB).
3. **Добавить `transports: ['websocket']`** в socket.io-client (`socket.ts:55`) — убрать HTTP polling при установке соединения.
4. **Включить cache headers** в express.static — `{ maxAge: '7d' }` для /knights/, /fonts/, assets. Иначе при каждом F5 все аватары грузятся заново.
5. **ENABLE_BORE=0** в .env если используется ngrok — не запускать оба туннеля одновременно.
6. **Восстановить docker-entrypoint.sh** — иначе prod-контейнер ненадёжен.

### Что проверить в Network tab (Chrome DevTools):

- При первой загрузке: суммарный размер переданных данных (должен быть ≤ 2 MB без аватаров)
- Фильтр WS: убедиться что socket.io использует WebSocket, а не XHR-polling (статус `101 Switching Protocols`)
- Фильтр по `knight`: убедиться что повторные хиты на аватары возвращают `304 Not Modified` (cache работает)
- Фильтр по `speaking_status`: не должно быть шквала мелких сообщений в спокойной тишине

### Что проверить в ngrok dashboard:

- Requests/min в покое: должно быть минимально (только heartbeat WebSocket keepalive)
- Bandwidth: пик при первом подключении нового юзера (аватары)
- Нет ли HTTP polling fallback (повторные POST `/socket.io/?...` с `EIO=4&transport=polling`)

### Что выключить:

- `ENABLE_BORE=0` если используется ngrok
- Убрать порт `4040` из docker-compose prod если ngrok не используется
- Убрать/скрыть dev-entrypoint из prod-образа

---

## Voice/WebRTC Verdict

| Параметр | Значение | Примечание |
|---|---|---|
| **Audio over WebRTC** | ✅ YES | `RTCPeerConnection`, `addTrack`, `getUserMedia`, `ontrack → HTMLAudioElement.srcObject` |
| **Audio over WebSocket chunks** | ✅ NO | Нет `MediaRecorder`, нет `socket.emit('audio')`, нет binary blobs/base64 audio |
| **Signaling over WebSocket** | ✅ YES | voice_offer, voice_answer, voice_ice_candidate через socket.io |
| **Topology** | Mesh | Каждый с каждым: N=13 → 78 PeerConnections, каждый держит 12 PC |
| **TURN required** | 🔴 YES, немедленно | Без TURN за NAT/mobile голос не пройдёт |
| **Risk for 13 users (mesh)** | 🔴 HIGH | 78 PC = большая нагрузка на браузеры; offer glare при одновременном включении; нет reconnect |
| **Offer glare risk** | ⚠️ YES | Обе стороны могут отправить offer одновременно; нет glare resolution |
| **autoplay policy** | ⚠️ Risk | `audio.autoplay = true` без `.play()` call — Chrome заблокирует без user gesture |
| **Wake Lock** | ✅ Implemented | `useWakeLock.ts` корректен, с visibility re-request |

**Для 13 человек mesh WebRTC — допустимо** как временное решение (до ~8–10 человек с включёнными микрофонами комфортно; 13 — на грани). Для полноценного использования нужен SFU (mediasoup, LiveKit, Livekit Cloud, Daily.co).

---

## Docker/Make Recommended Target Design

*(Не применять — только предложение структуры)*

```makefile
# ── Production ────────────────────────────────────────────────
make up:
  docker compose up -d winchester postgres
  # (без --build для детерминированного деплоя; build отдельно)

make build:
  docker compose build winchester

# ── Development ───────────────────────────────────────────────
make up-dev:
  docker compose --profile dev up winchester-dev postgres
  # ✅ уже правильно

# ── Optional tunnel (явный opt-in) ───────────────────────────
make tunnel:
  docker compose --profile tunnel up bore
  # bore в отдельном сервисе с profile:tunnel
  # или: ngrok http 3000

# ── Logs / utils ──────────────────────────────────────────────
make logs:
  docker compose logs -f winchester

make down:
  docker compose down

make clean:
  docker compose down --rmi all --volumes --remove-orphans

# ── DB utils ──────────────────────────────────────────────────
make db-shell:
  docker compose exec postgres psql -U winchester -d winchester

make db-list-users:
  docker compose exec winchester node dist/server/../../../scripts/list-users.mjs
```

**Рекомендованное изменение:** Вынести bore в отдельный Docker Compose service с `profile: [tunnel]`. Так `make up` никогда не запускает туннель, а `make tunnel` — явный opt-in.

---

## Minimal Fix Plan

*(Для временного запуска через ngrok прямо сейчас)*

1. **Восстановить `docker-entrypoint.sh`** — дописать bore-блок и `wait $SERVER_PID` в конце. Без этого prod-контейнер ненадёжен.

2. **Восстановить `vite.config.ts`** — дописать закрывающий proxy-блок для `/socket.io`. Без этого dev не работает.

3. **Добавить invite code** (1 строка в `server/auth.ts`): проверять env `INVITE_CODE` при `/register`. Иначе ngrok URL = публичная регистрация.

4. **Установить `ENABLE_BORE=0` в `.env`** или переключить default в entrypoint с `1` на `0` — не запускать bore когда используется ngrok.

5. **Добавить `transports: ['websocket']`** в `socket.ts:55`:
   ```ts
   export const socket = io(SOCKET_URL, {
     transports: ['websocket'],  // ← добавить
     autoConnect: false,
     ...
   });
   ```

6. **Добавить `maxAge` в express.static**:
   ```ts
   app.use(express.static(clientDistPath, { maxAge: '7d' }));
   ```

7. **Добавить `.play()` после `audio.srcObject`**:
   ```ts
   audio.srcObject = event.streams[0];
   audio.play().catch(() => { /* autoplay blocked — показать UI */ });
   ```

8. **Добавить TURN** (хотя бы бесплатный Metered.ca или Coturn на том же хосте):
   ```ts
   const ICE_SERVERS = {
     iceServers: [
       { urls: 'stun:stun.l.google.com:19302' },
       { urls: 'turn:your-turn-server:3478', username: '...', credential: '...' },
     ]
   };
   ```

9. **Пересжать knight14–24.webp** до ≤150 KB (ffmpeg / squoosh / libvips, quality 75).

10. **`MAX_ROOM_SIZE=13`** в prod `.env`.

---

## Production Fix Plan

*(Для нормального деплоя на VPS/Oracle позже)*

1. **CORS**: Заменить `origin: true` на конкретный домен:
   ```ts
   cors({ origin: process.env.ALLOWED_ORIGIN || 'https://yourdomain.com', credentials: true })
   ```

2. **Rate limiting**:
   ```ts
   import rateLimit from 'express-rate-limit';
   app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 20 }));
   ```

3. **Invite code** (минимум) или admin-only регистрация:
   ```ts
   const INVITE_CODE = process.env.INVITE_CODE;
   if (INVITE_CODE && req.body.inviteCode !== INVITE_CODE) {
     return res.status(403).json({ error: 'Invalid invite code.' });
   }
   ```

4. **TURN сервер**: Поднять Coturn или использовать платный сервис. Без TURN за NAT — голос недоступен.

5. **SFU вместо mesh**: Для стабильных 13 человек с голосом — LiveKit или mediasoup. Mesh = 78 PC = перегрузка браузера.

6. **Nginx reverse proxy**: HTTPS, gzip, cache-control headers для статики, WebSocket proxy.

7. **Helmet.js**: Добавить security headers (CSP, HSTS, X-Frame-Options).

8. **Session TTL**: Уменьшить до 7 дней, добавить `POST /api/auth/logout-all`.

9. **Мute без переподключения**: Заменить `disableMic` на `track.enabled = false`.

10. **WebRTC reconnect**: При `connectionState === 'failed'` — exponential backoff retry.

11. **Offer glare resolution**: Сравнивать `socket.id` — больший отменяет свой offer.

12. **pm2 или dumb-init**: В prod контейнере PID 1 должен правильно обрабатывать сигналы.

13. **package-lock.json в prod Dockerfile** + `npm ci` вместо `npm install`.

14. **Удалить cloudflared.exe из git**: Добавить в `.gitignore`, сделать `git rm --cached cloudflared.exe`.

15. **Мониторинг**: `/api/health` можно расширить для uptime-kuma или подобного.

---

## Questions / Unknowns

1. **`docker-entrypoint.sh` и `vite.config.ts` обрезаны**: Неизвестно, является ли это проблемой файловой системы при монтировании (Windows NTFS → Linux) или файлы реально неполные. **Необходимо проверить на хост-машине** командой `wc -c docker-entrypoint.sh` и открыть в редакторе. Если файлы реально обрезаны — это критичный баг который нужно починить в первую очередь.

2. **`client/src/lib/knightSession.ts`**: Файл существует в директории, но его содержимое не было прочитано в ходе аудита. Неизвестно — это активный код или мёртвый.

3. **Полное содержимое `vite.config.ts`**: Что именно в proxy-конфиге для `/socket.io`? WebSocket proxy требует `ws: true`. Неизвестно, было ли это там.

4. **bore tunnel полный код**: Что делает bore-блок в entrypoint после запуска? Foreground wait? Logging URL? — не видно из-за обрезки.

5. **ngrok**: Порт 4040 опубликован и `NGROK_AUTHTOKEN` в env, но нигде нет `ngrok` бинаря или процесса. Была ли когда-то интеграция с ngrok? Или это legacy env/port?

6. **Font CloisterBlack.ttf** (71 KB): Лицензия шрифта? Проверить разрешено ли коммерческое использование.

7. **`ROUND_TABLE_SEAT_COUNT = 24`** в tableOrbit.ts, но в README/описании проекта "13 человек". Есть ли ограничение в roomState на 13? `MAX_ROOM_SIZE` по умолчанию 0 (unlimited). Нужно явно задать.

8. **История при перезапуске**: `CHAT_HISTORY_VERSION=1.0.0` в .env vs `1` в примере — прояснить какое значение было при первом запуске на конкретном инстансе. Если версии не совпадают — история "потеряна" (не удалена, но не отдаётся).
