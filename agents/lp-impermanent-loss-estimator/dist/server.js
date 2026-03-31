import { serve } from "@hono/node-server";
import app from "./index.js";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
console.log(`LP Impermanent Loss Estimator starting on port ${PORT}...`);
serve({
    fetch: app.fetch,
    port: PORT,
}, (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
});
