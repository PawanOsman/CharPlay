# CharPlay (AI Character Playground)

An AI character chat playground with local conversation storage, Socket.IO presence, and a pluggable model backend. Built with Next.js 16, React 19, Tailwind CSS 4, and pnpm.

## Development

Use Node.js 22.13+ or Node.js 24 LTS and the pinned pnpm 11.14.0 release.

```bash
corepack enable
corepack install
pnpm install --frozen-lockfile
cp env.example .env
pnpm dev
```

Open http://localhost:3000. Development binds to localhost. Set the provider key in `.env` to enable the hosted chat backend. Bring-your-own-key providers remain browser-side.

## Checks and production build

```bash
pnpm lint
pnpm typecheck
pnpm test:security
pnpm audit:security
pnpm build
pnpm start
```

`pnpm start` serves the app on port **6328**. The build creates standalone output and strips copied dotenv files from that artifact. Keep credentials in the runtime environment. Existing client-component lint findings remain visible as warnings; server/API rules are enforced.

For the standalone server, copy `public` and `.next/static` into their corresponding locations inside `.next/standalone`, then run `node .next/standalone/server.js` with `PORT`, `HOSTNAME`, and runtime credentials set. The Dockerfile performs these copies automatically.

HTTP security integration tests can also run against a dedicated, freshly built test server with **no provider credentials**:

```bash
SECURITY_TEST_BASE_URL=http://127.0.0.1:16328 pnpm test:security
```

The integration suite skips when this variable is unset. It checks malformed requests and socket connections; never point it at a production service.

## Environment

| Variable | Purpose |
| --- | --- |
| `PAWANKRD_API_KEY` | Server-side provider credential. Required for the hosted chat/model endpoints. |
| `APP_ORIGIN` | Public application origin, for example `https://play.example.com`. Set this in production. |
| `TRUSTED_PROXY_IP_HEADER` | Optional single-IP header overwritten by your trusted reverse proxy, for example `x-real-ip`. Leave empty if there is no trusted proxy. |
| `SOCKET_PORT` | Internal Socket.IO port, default `4000`. A custom value must be identical at build time and runtime because Next.js records rewrites during the build. Docker uses `4000`. |
| `SOCKET_HOST` | Socket bind address, default `127.0.0.1`; Compose sets `0.0.0.0` inside the container. |
| `BIND_ADDRESS` | Compose host bind address, default `127.0.0.1`. |

The browser uses same-origin `/api/socket`; port 4000 is internal. The Next.js rewrite forwards socket traffic to the local Socket.IO listener. `/api/connect` starts that listener lazily.

IP headers are ignored unless explicitly trusted. Without one, anonymous users share a quota. A trusted reverse proxy must overwrite the configured header with a single verified client IP and prevent requests bypassing the proxy. Limits are process-local and reset on restart; use a shared gateway limiter for multiple replicas or stronger abuse prevention.

## Docker

```bash
cp env.example .env
# Set fresh credentials and the production APP_ORIGIN.
docker compose up -d --build
```

Compose serves http://127.0.0.1:3000 for a reverse proxy. Configure the proxy to preserve the public Host and support WebSocket upgrades. The container runs as a non-root user with a read-only filesystem, dropped capabilities, and bounded temporary storage. Runtime credentials are passed explicitly; dotenv files are excluded from the image build.

The pinned Node image digest should be refreshed when applying security updates. Use a clean machine to rebuild after a compromise; see [SECURITY.md](SECURITY.md).

## CI

CI requires dependency audit, lint, type checks, and security unit tests before building images. Pull requests and branch pushes build without publishing. Default-branch pushes publish `pawanosman/charplay:latest` and a commit-specific tag using `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets.

## Key files

- `src/app/api/chat/route.ts`: validated chat API and provider streaming.
- `src/app/api/models/route.ts`: cached model list.
- `src/app/api/connect/route.ts`: local Socket.IO server.
- `src/lib/server-security.ts`: body limits, schema validation, origin checks, and quotas.
- `SECURITY.md`: incident findings and deployment recovery requirements.

## License

This project is licensed under the [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) license.

You may:
- ✅ Use, modify, and share for **personal and non-commercial** purposes.
- ❌ Not use this for **commercial purposes**.
- 🔁 Must **credit** this project and **license derivative works** under the **same license**.
