# Winchester Round Table

Internal flood-room app for teams: Winchester-themed round table (**13 seats**), realtime text (**Socket.IO**), and optional mesh voice (**WebRTC** + signaling over Socket.IO), with microphone and speaking indicators.

## Requirements

Node.js **18+**

## Install

```bash
npm install
```

## Development

Runs the signaling/API server on **`0.0.0.0:3000`** and the UI with Vite on **`http://localhost:5173`** (proxies Socket.IO paths to `:3000`).

```bash
npm run dev
```

**Open:** [http://localhost:5173](http://localhost:5173)

## Production build (single URL / ngrok)

Build output:

- **`dist/client/`** — static UI from Vite  
- **`dist/server/`** — compiled Express + Socket.IO entrypoint  

Commands:

```bash
npm run build
npm start
```

**Open:** [http://localhost:3000](http://localhost:3000)  
The server resolves the client bundle with **`path.resolve(process.cwd(), "dist/client")`**, so always run **`npm start` from the project root**.

### Share with HTTPS (recommended for microphones)

Expose port **3000**:

```bash
ngrok http 3000
```

Use the **`https`** URL ngrok prints. Browser microphone access expects a secure context (**HTTPS**) or **`http://localhost`**.

Other scripts:

| Script | Purpose |
|--------|---------|
| `npm run clean` | Remove `dist/` |
| `npm run typecheck` | Type-check client + server (no emit) |

## Troubleshooting

- **Mic blocked:** Prefer ngrok HTTPS or localhost; confirm browser permission prompts.  
- **`Client bundle not found`:** Run `npm run build` **from repo root**, then ensure `dist/client/index.html` exists. Do not rely on paths under `dist/server/client`.  
- **Room full:** Thirteen occupants maximum; try again after someone leaves.

## Ports

| Mode | UI |
|------|-----|
| `npm run dev` | `http://localhost:5173` |
| `npm start` | `http://localhost:3000` |

Override port: `PORT=8080 npm start` (Unix) or equivalent on Windows.

## Keyboard

- **`V`** — toggle microphone (**ignored while typing** in `<input>` / `<textarea>` / contenteditable chat fields).
