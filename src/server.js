import express from "express";
import app from "./index.js";

const server = express();
server.use(express.json());

// Assuming @lucid-dreams/agent-kit provides a generic express handler or we just map it.
// The basic example exports `app` which usually has an `.express()` or `.handler()` method.
// Let's inspect what `app` is.
server.post("/x402/agent", async (req, res) => {
  try {
    // Basic standard adapter
    const result = await app.run(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Agent running on port ${PORT}`);
});
