import express from "express";
import app from "./fresh-markets.js";

const server = express();
server.use(express.json());

server.post("/x402/agent", async (req, res) => {
  try {
    const result = await app.run(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Agent running on port ${PORT}`);
});
