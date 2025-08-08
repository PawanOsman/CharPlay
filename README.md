## CharPlay (AI Character Playground)

An AI character chat playground with a modern UI, real-time presence via Socket.IO, and a pluggable model backend. Built with Next.js, React, Tailwind CSS, and pnpm. A hosted demo is available at the following link: [CharPlay Demo](https://play.pawan.krd).

### Table of contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Environment variables](#environment-variables)
- [Quick start with Docker](#quick-start-with-docker)
  - [Docker Compose](#docker-compose)
  - [Plain Docker](#plain-docker)
- [Run on Android with Termux](#run-on-android-with-termux)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview
CharPlay lets you browse characters, start conversations, and chat in real-time. It exposes a Socket.IO endpoint for online presence and supports model backends via server routes.

## Features
- **Modern UI**: Responsive layouts, themed components, and smooth interactions.
- **Real-time presence**: Live online count via Socket.IO.
- **Character-centric UX**: Character selector, profiles, and conversation management.
- **Persistence helpers**: Local storage hooks for settings and state.
- **API routes**: Chat/model endpoints and Socket.IO bootstrap via Next.js App Router.
- **Production Docker image**: Multi-stage build with pnpm, small runtime image.

## Architecture
- **Next.js app server**: Listens on port 3000 by default.
- **Socket.IO server**: Separate port, controlled by `NEXT_PUBLIC_SOCKET_PORT` (defaults to `4000`).
- **App Router**: API routes under `src/app/api/*`.

Key paths:
- `src/app/api/chat/route.ts` – chat/model API
- `src/app/api/socket/route.ts` – starts Socket.IO server at `NEXT_PUBLIC_SOCKET_PORT`
- `src/components/SocketProvider.tsx` – client connects to Socket.IO at `http(s)://<host>:<port>/api/socket`

## Tech stack
- **Framework**: Next.js 15, React 19
- **Styling**: Tailwind CSS 4
- **Real-time**: Socket.IO
- **Forms/Validation**: React Hook Form, Zod
- **Build tool**: pnpm with Corepack

## Environment variables
Copy `env.example` to `.env` and set values.

- **PAWANKRD_API_KEY**: API key for your model/provider (if required by your backend configuration).
- **NEXT_PUBLIC_SOCKET_PORT**: Port Socket.IO listens on (default `4000`). Must be reachable by the browser when the app runs.

Example `.env`:
```env
PAWANKRD_API_KEY=your_key_here
NEXT_PUBLIC_SOCKET_PORT=4000
```

## Quick start with Docker

The repository includes a production-ready `Dockerfile` and `docker-compose.yml`.

### Docker Compose
```bash
docker compose up -d --build
```
Then open `http://localhost:3000`. Real-time socket runs on port `4000`.

- **Env**: Compose will read `.env` automatically (see variables above).
- **Ports**: Maps `3000:3000` and `4000:4000` by default.

Update `.env` as needed before running:
```bash
cp env.example .env
# edit .env
```

### Plain Docker
Build:
```bash
docker build -t pawanosman/charplay:latest .
```
Run:
```bash
docker run --rm \
  -p 3000:3000 -p 4000:4000 \
  -e NEXT_PUBLIC_SOCKET_PORT=4000 \
  -e PAWANKRD_API_KEY=your_key_here \
  pawanosman/charplay:latest
```

Open `http://localhost:3000`.

## Run on Android with Termux
You can run the app directly in Termux using Node.js. This is the simplest path on Android.

1) Install Termux (preferably from F-Droid) and open it.

2) Update and install prerequisites:
```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git
```

3) Enable Corepack (pnpm) and clone the repo:
```bash
corepack enable
corepack prepare pnpm@latest --activate
git clone https://github.com/PawanOsman/CharPlay.git
cd CharPlay
```

4) Configure environment:
```bash
cp env.example .env
sed -i 's/NEXT_PUBLIC_SOCKET_PORT=.*/NEXT_PUBLIC_SOCKET_PORT=4000/' .env
```

5) Install, build, and start:
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

6) Open your Android browser to `http://localhost:3000`.

Notes:
- If port `4000` is busy, change `NEXT_PUBLIC_SOCKET_PORT` in `.env` and restart.
- Termux does not run Docker natively. If you prefer containers, consider a proot-based Linux distro and rootless Podman/Docker, but the Node.js method above is simpler and more reliable on Android.

## Local development
Prerequisites: Node 18+ or 20+, pnpm 9+ (via Corepack).

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
cp env.example .env
pnpm dev
```

App dev server will run on `http://localhost:3000`. Socket server will bind to `NEXT_PUBLIC_SOCKET_PORT` (default `4000`).

## Deployment
- **Docker Hub image**: The CI publishes to `pawanosman/charplay:latest` on every push.
- **GitHub Actions**: See `.github/workflows/docker-publish.yml`. Configure secrets:
  - `DOCKER_USERNAME`
  - `DOCKER_PASSWORD`

Running detached with Compose on a server:
```bash
docker compose pull
docker compose up -d
```

Behind a reverse proxy, ensure both ports are reachable by the client. If terminating TLS and proxying, you can forward Socket.IO at `/api/socket` to the socket port (`/api/socket` path is preserved on both ports by design).

## Troubleshooting
- **Socket not connecting**: Confirm `NEXT_PUBLIC_SOCKET_PORT` is exposed and reachable from the browser. Map `-p 4000:4000` and verify CORS/origin is `*` (default in the server route).
- **Blank page or build error**: Rebuild the image or reinstall deps: `pnpm install` then `pnpm build`.
- **Env not applied**: With Compose, verify `.env` exists in the repository root. With plain Docker, pass `-e` flags.
- **Android (Termux)**: Use Node.js path above rather than Docker. Ensure you use `nodejs-lts` and `corepack` to get pnpm.

---

For questions or feedback, feel free to open an issue or reach out. Enjoy CharPlay!

## License

This project is licensed under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

You may:
- ✅ Use, modify, and share for **personal and non-commercial** purposes.
- ❌ Not use this for **commercial purposes**.
- 🔁 Must **credit** this project and **license derivative works** under the **same license**.
