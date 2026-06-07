import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { estimateGasRoute } from "./core.js";

const port = Number(process.env.PORT || 3000);
const payTo = process.env.X402_PAY_TO;
const network = process.env.X402_NETWORK || "eip155:84532";
const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";
const price = process.env.X402_PRICE || "$0.001";

if (!payTo) {
  throw new Error("X402_PAY_TO is required. Set it to the EVM address that receives x402 payments.");
}

const app = express();
app.use(express.json({ limit: "64kb" }));

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitatorClient).register(
  network,
  new ExactEvmScheme()
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "gasroute-oracle", x402_network: network });
});

app.use(
  paymentMiddleware(
    {
      "POST /estimate_gas_route": {
        accepts: {
          scheme: "exact",
          price,
          network,
          payTo
        },
        description: "GasRoute Oracle: choose the cheapest EVM chain and timing hint for a transaction."
      }
    },
    resourceServer,
    {
      appName: "GasRoute Oracle",
      testnet: network !== "eip155:8453"
    }
  )
);

app.post("/estimate_gas_route", async (req, res, next) => {
  try {
    const output = await estimateGasRoute(req.body);
    res.json(output);
  } catch (error) {
    next(error);
  }
});

app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(400).json({ error: error.message });
});

app.listen(port, () => {
  console.log(`gasroute-oracle listening on :${port}`);
});
