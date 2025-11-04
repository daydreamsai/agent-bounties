import { app } from "./agent";
import { monitoringService } from "./runtime";

const configuredPort = Number(process.env.PORT ?? 8787);
const servePort = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 0;

monitoringService.start();

const serveOptions =
  servePort === 0
    ? { fetch: app.fetch }
    : { fetch: app.fetch, port: servePort };

const server = Bun.serve(serveOptions);

console.log(
  `🚀 Agent ready at http://${server.hostname}:${server.port}/.well-known/agent.json`
);

const shutdown = () => {
  console.log("[server] Shutting down yield pool watcher...");
  monitoringService.stop();
  server.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
