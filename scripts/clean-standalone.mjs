import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Next.js copies loaded .env files into standalone output. Credentials must be
// supplied by the runtime, never distributed in the deployment artifact.
const directory = fileURLToPath(new URL("../.next/standalone/", import.meta.url));
for (const entry of await readdir(directory, { withFileTypes: true })) {
  if (entry.name === ".env" || entry.name.startsWith(".env.")) {
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      throw new Error(`Unexpected dotenv directory in standalone output: ${entry.name}`);
    }
    await unlink(join(directory, entry.name));
  }
}
