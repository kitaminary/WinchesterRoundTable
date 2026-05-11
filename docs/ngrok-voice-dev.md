# ngrok Voice Chat Development

Share the app over the internet for multi-device voice testing using ngrok.

## Architecture

```
Browser (ngrok URL)
  |
  +--> /socket.io  -->  Vite :5173  --proxy-->  Backend :3000
  +--> /api/*       -->  Vite :5173  --proxy-->  Backend :3000
  +--> /*           -->  Vite :5173  (React app)
```

- Frontend connects Socket.IO to `window.location.origin` (same origin).
- Vite dev server proxies `/socket.io` and `/api` to the backend on port 3000.
- ngrok exposes the Vite dev server, not the backend directly.
- No hardcoded ngrok URL is needed anywhere.

## Quick Start

```bash
# Terminal 1: backend
npm run dev:server

# Terminal 2: frontend (binds 0.0.0.0 so ngrok can reach it)
npm run dev:client

# Terminal 3: ngrok tunnel
ngrok http 5173
```

Open the HTTPS URL from ngrok on any device. Login, join the room, and test voice.

## Environment Variables

**Not required for ngrok dev:**
- `VITE_SOCKET_URL` — leave unset. Socket.IO auto-connects to same origin.

**Optional for real-network WebRTC:**
- `VITE_TURN_URL` — TURN server URL(s), comma-separated (e.g. `turn:host:3478,turns:host:5349?transport=tcp`)
- `VITE_TURN_USERNAME` — TURN username
- `VITE_TURN_CREDENTIAL` — TURN credential

Without TURN, WebRTC connections may fail when peers are on different networks (NAT, mobile). STUN alone works for peers on the same LAN or simple NAT setups.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Console shows `ws://localhost:3000` | `VITE_SOCKET_URL` set or old code | Unset `VITE_SOCKET_URL`, verify `socket.ts` uses `window.location.origin` |
| Socket connects but voice silent | Autoplay blocked | Click "Enable sound" button in toolbar |
| ICE connection stays `checking` | NAT/firewall blocks peer-to-peer | Configure TURN server env vars |
| Mic permission denied | HTTP (not HTTPS) | Use the ngrok HTTPS URL, not HTTP |
| Chat works but no audio on remote | No TURN + different networks | Add TURN credentials to `.env` |
