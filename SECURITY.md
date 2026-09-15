# Security remediation — 2026-09-15

## Confirmed compromise and cleanup

The project contained three separate malicious modifications:

| Location | Finding | Action |
| --- | --- | --- |
| `package.json` | Development and production startup launched `/var/tmp/.font/n0de` in the background. | Removed both injected commands. The referenced host executable was absent during inspection. |
| `middleware.ts` | Sent visitor metadata to `api.cdnapi.tech` and served remote HTML or redirects. | Deleted the malicious middleware. |
| `configindex.js` | Scanned the host for PHP sites, planted `lndex.php` webshells, and reported paths to `47.90.227.150`. | Deleted the dropper and quarantined its confirmed output. |

Exactly **93 PHP webshells** matched the decoded dropper payload byte for byte: 15 under `/var/www/hasti.krd` and 78 under `/var/www/pawan.krd`. They were moved outside the web roots into `/root/charplay-incident-quarantine/2026-09-15/`. Its protected `manifest.json` records original paths, metadata, hashes, and quarantine paths. Quarantine directories are mode `0700`, the manifest is `0600`, and payload files are `000`. Every original path was verified absent and every quarantined hash verified intact.

Evidence hashes (SHA-256):

- `configindex.js`: `6219e64b17ae0c9203db6cfbd46b85ff6e1aea445ebe2e3106764fc66250e280`
- `middleware.ts`: `5c258aacbefc865c945c0a2186183beb51809632380a7b6e3d3c6f9c20af2419`
- Each 1,555-byte PHP payload: `d4887c936be09e116f271cc1c4b08e53799d96f5728786f415c07f9a2b2b7f04`

No payload was executed during inspection. Attacker endpoints were not contacted.

## Project changes

- Upgraded Next.js 15.4.5 to **16.3.5**, the stable npm `latest` release verified on the remediation date; React/React DOM to **19.3.0**. Refreshed compatible dependencies and upgraded the provider SDK to match the project's Zod version.
- Removed the old dependency installation and reinstalled from the official npm registry using a fresh project-local `.pnpm-store` (excluded from version control), with dependency lifecycle scripts disabled during cleanup. Normal installs allow build scripts only for `sharp` and `@tailwindcss/oxide`.
- Replaced removed `next lint` with ESLint, added type checking and security tests, and pinned pnpm 11.14.0. ESLint 9.39.5 is used because Next's current React/import/accessibility plugins fail with ESLint 10; revisit this compatibility constraint when those plugins support it.
- Added streamed request-body limits, input validation, generation limits, finite model-family quotas, bounded expiring counters, and origin checks. Forwarded client IPs are trusted only with explicit deployment configuration.
- Sanitized provider errors, initialized credentials only on demand, bounded provider requests with timeouts, and added stream cancellation and model-list request coalescing.
- Restricted Socket.IO origins, payload size, connection count, and bind address; routed browser connections through the app's origin.
- Added browser security headers and a baseline CSP restricting framing, objects, form actions, and base URLs. This policy does not claim strict inline-script protection.
- Added non-root standalone containers with a read-only filesystem in Compose, restricted privileges, and explicit runtime environment variables. Only the app port is published, on localhost by default.
- Excluded secrets from Docker build context and removed dotenv copies from local standalone build output. Keep runtime secrets separate from deployment artifacts.
- Required CI audit, lint, type checks, and security unit tests before image builds; restricted image publishing to the default branch and pinned action commits and the Node image digest.

Release references: [Next.js upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16), [August 2026 security release](https://nextjs.org/blog/august-2026-security-release), [Next.js npm release metadata](https://registry.npmjs.org/next/latest).

## Verification

- Production build and TypeScript checks pass.
- Dependency audit reports **zero known vulnerabilities**, including development dependencies.
- ESLint reports no errors; existing UI migration/style findings remain warnings.
- **17 security tests pass**, including actual built-server body limits, invalid/cross-origin requests, sanitized missing-provider errors, and same-origin Socket.IO polling and WebSocket connections.
- Browser smoke checks passed for the home page, FAQ, character navigation, new conversations, and the settings dialog, with no page JavaScript errors.
- Built runtime tested without provider credentials. No paid/upstream generation was performed.
- Standalone output contains no dotenv files; generated JavaScript/HTML/JSON/source maps were checked for current nonpublic dotenv secret values, with no matches.
- Docker Compose configuration and workflow syntax validated. Docker image builds could not be executed because Docker is unavailable in this workspace.

## Host inspection coverage and limits

Post-cleanup filename checks found no remaining `lndex.php` or `feakoajna.jpg` across `/root/apps`, `/var/www`, `/srv`, `/home`, and `/var/tmp`. A content scan of both affected web roots also found no remaining unique PHP payload marker, including renamed copies. Known indicators were absent from the inspected cron, systemd, init scripts, root shell startup, and root autostart locations. No matching active malware process or active CharPlay server was identified. The saved PM2 CharPlay definition was stopped; no production service was deployed or restarted.

No non-sample project hooks or command-bearing project repository configuration were present. These are indicator-based checks, excluding repository history and symlink traversal. They do not establish that the host is clean: other payload families, altered system binaries, stolen credentials, and historical execution remain unverified. Old repository history may still contain compromised content; review it before restoring historical files.

## Recovery still required before production

1. Rebuild the compromised host from a trusted image and redeploy reviewed source and fresh dependencies. The backdoor spread into multiple sites, so patching this one application cannot restore host trust.
2. Revoke and rotate credentials available to the compromised processes: provider keys, deployment/registry tokens, database credentials, and affected host access credentials. Rotate browser-stored provider keys used while the malicious middleware was active as well.
3. Review the other affected PHP applications and their logs/backups. Restore only verified application files and data; do not restore quarantined files, old dependency trees, or old build artifacts.
4. Set `APP_ORIGIN`, put the application behind HTTPS, and configure `TRUSTED_PROXY_IP_HEADER` only when a trusted proxy overwrites it with a verified single IP and direct bypass is blocked.
5. Rebuild and rerun the documented checks in the clean environment before bringing production back online. Retain the protected quarantine manifest for incident investigation.

Chat remains intentionally anonymous. Quotas are process-local and reset on restart; multiple replicas need a shared gateway limiter. Without a trusted client-IP header, users share a quota. This remediation cannot certify an exploited host as fully secure.
