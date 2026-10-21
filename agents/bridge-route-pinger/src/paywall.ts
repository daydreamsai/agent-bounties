/**
 * x402 v2 paywall for the quote entrypoint.
 *
 * The x402-hono v1 middleware that agent-kit bundles advertises `network: "base"`, which the
 * official v2 client cannot sign: it rejects any network that is not `eip155:<id>`. A buyer following
 * the docs therefore gets a 402 it can never pay. This module mounts the v2 middleware instead, so the
 * challenge carries `eip155:8453` and settles through a v2-capable facilitator.
 */
import type { Hono } from "hono";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { paymentMiddleware } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export type PaywallOptions = {
  payTo: `0x${string}`;
  price: string;
  facilitatorUrl: string;
  network: string;
  path: string;
  description: string;
  /** Returns an error string for a request that must not be charged, or null to proceed. */
  preflight?: (input: Record<string, unknown>) => string | null;
};

export function mountPaywall(app: Hono, opts: PaywallOptions) {
  const facilitator = new HTTPFacilitatorClient({ url: opts.facilitatorUrl });
  const resourceServer = new x402ResourceServer(facilitator).register(
    opts.network as `${string}:${string}`,
    new ExactEvmScheme(),
  );
  // Registered ahead of the paywall: a request that cannot be served is answered 400 for free instead
  // of being charged and then failing.
  if (opts.preflight) {
    const check = opts.preflight;
    app.use(opts.path, async (c, next) => {
      let input: Record<string, unknown> = {};
      try {
        const body = await c.req.json();
        input = (body?.input ?? {}) as Record<string, unknown>;
      } catch {
        return c.json({ error: "request body must be JSON with an input object" }, 400);
      }
      const error = check(input);
      if (error) return c.json({ error }, 400);
      return next();
    });
  }
  app.use(
    paymentMiddleware(
      {
        [`POST ${opts.path}`]: {
          accepts: {
            scheme: "exact",
            price: `$${opts.price}`,
            network: opts.network as `${string}:${string}`,
            payTo: opts.payTo,
          },
          description: opts.description,
          mimeType: "application/json",
          // v2 keeps the challenge in the PAYMENT-REQUIRED header; an empty body looks like a
          // broken endpoint to a client that only reads JSON, so the price is echoed here too.
          unpaidResponseBody: () => ({
            contentType: "application/json",
            body: { error: "payment required", price_usd: opts.price, network: opts.network },
          }),
        },
        [`GET ${opts.path}`]: {
          accepts: {
            scheme: "exact",
            price: `$${opts.price}`,
            network: opts.network as `${string}:${string}`,
            payTo: opts.payTo,
          },
          description: opts.description,
          mimeType: "application/json",
          unpaidResponseBody: () => ({
            contentType: "application/json",
            body: { error: "payment required", price_usd: opts.price, network: opts.network },
          }),
        },
      },
      resourceServer,
    ),
  );
  return resourceServer;
}
