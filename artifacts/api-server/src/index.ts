import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { closeObjectStorage } from "./modules/files/storage";
import { db } from '@workspace/db';
import { verifyRuntimeRole } from './lib/runtime-role';
await verifyRuntimeRole(db);

const rawPort = process.env["PORT"] ?? "5000";

const port = Number(rawPort);

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, process.env.BIND_HOST ?? '127.0.0.1', (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
server.requestTimeout=30000;
server.headersTimeout=10000;
server.keepAliveTimeout=5000;
server.maxRequestsPerSocket=1000;
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => {
      server.closeAllConnections();
      void pool.end().finally(() => process.exit(1));
    }, 15000);
    timeout.unref();
    server.close(() => {
      closeObjectStorage();
      void pool.end().then(() => {
        clearTimeout(timeout);
        process.exit(0);
      });
    });
    server.closeIdleConnections();
  });
