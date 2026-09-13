import { describe, expect, test } from "vitest";
import {
  BASE_MAINNET_NETWORK,
  BASE_MAINNET_USDC,
  withX402,
} from "../x402";

const payTo = "0x0000000000000000000000000000000000000001";

function decodeHeader(value: string): unknown {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe("x402 v2 middleware", () => {
  test("returns a standard 402 response and PAYMENT-REQUIRED header", async () => {
    const request = new Request("https://example.test/metrics", {
      method: "POST",
    });
    const gated = withX402(
      async () => new Response(JSON.stringify({ ok: true })),
      { payTo },
    );

    const response = await gated(request);
    expect(response.status).toBe(402);
    expect(response.headers.get("PAYMENT-REQUIRED")).toBeTruthy();

    const requirement = decodeHeader(
      response.headers.get("PAYMENT-REQUIRED")!,
    ) as {
      x402Version: number;
      resource: { url: string };
      accepts: Array<{
        amount: string;
        asset: string;
        network: string;
        payTo: string;
        scheme: string;
      }>;
    };

    expect(requirement.x402Version).toBe(2);
    expect(requirement.resource.url).toBe(request.url);
    expect(requirement.accepts[0]).toMatchObject({
      scheme: "exact",
      network: BASE_MAINNET_NETWORK,
      amount: "10000",
      asset: BASE_MAINNET_USDC,
      payTo,
    });
  });

  test("invokes the handler when PAYMENT-SIGNATURE is supplied", async () => {
    const gated = withX402(
      async () => new Response("paid", { status: 200 }),
      { payTo },
    );

    const response = await gated(
      new Request("https://example.test/metrics", {
        method: "POST",
        headers: { "PAYMENT-SIGNATURE": "base64-payload" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("paid");
  });

  test("fails closed when configured with a Solana address as payTo", () => {
    expect(() =>
      withX402(async () => new Response("ok"), {
        payTo: "J6oH54MnY5cB4AeffhQNnrdUwGkHLfNtWQvi9pgvg3wW",
      }),
    ).toThrow("EVM address");
  });
});
