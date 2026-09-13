import { getAddress } from "ethers";

export const BASE_MAINNET_NETWORK = "eip155:8453";
export const BASE_MAINNET_USDC =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export interface X402ResourceInfo {
  url: string;
  description?: string;
  mimeType?: string;
  serviceName?: string;
}

export interface X402PaymentRequirement {
  scheme: "exact";
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, string>;
}

export interface X402PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: X402ResourceInfo;
  accepts: X402PaymentRequirement[];
}

export interface X402Options {
  /**
   * Atomic USDC units. 10,000 is $0.01 because USDC has six decimals.
   */
  amountAtomicUnits?: string;
  payTo: string;
  network?: string;
  asset?: string;
  maxTimeoutSeconds?: number;
  description?: string;
  serviceName?: string;
  mimeType?: string;
}

export type X402Handler = (
  request: Request,
) => Response | Promise<Response>;

function normalizePayTo(address: string): string {
  try {
    return getAddress(address);
  } catch {
    throw new TypeError(
      "x402 payTo must be a valid checksummed EVM address; do not use a Solana address",
    );
  }
}

function normalizeAmount(amount: string): string {
  if (!/^[0-9]+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new RangeError("x402 amountAtomicUnits must be a positive integer");
  }
  return amount;
}

function toBase64Json(value: unknown): string {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of encoded) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function normalizedOptions(options: X402Options) {
  return {
    amountAtomicUnits: normalizeAmount(options.amountAtomicUnits ?? "10000"),
    payTo: normalizePayTo(options.payTo),
    network: options.network ?? BASE_MAINNET_NETWORK,
    asset: options.asset ?? BASE_MAINNET_USDC,
    maxTimeoutSeconds: options.maxTimeoutSeconds ?? 300,
    description: options.description,
    serviceName: options.serviceName ?? "Yield Pool Watcher",
    mimeType: options.mimeType ?? "application/json",
  };
}

export function createPaymentRequired(
  request: Request,
  options: X402Options,
  error = "Payment required",
): X402PaymentRequired {
  const config = normalizedOptions(options);
  const resource: X402ResourceInfo = {
    url: request.url,
    description: config.description,
    mimeType: config.mimeType,
    serviceName: config.serviceName,
  };

  return {
    x402Version: 2,
    error,
    resource,
    accepts: [
      {
        scheme: "exact",
        network: config.network,
        amount: config.amountAtomicUnits,
        asset: config.asset,
        payTo: config.payTo,
        maxTimeoutSeconds: config.maxTimeoutSeconds,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
  };
}

export function paymentRequiredResponse(
  request: Request,
  options: X402Options,
  error?: string,
): Response {
  const paymentRequired = createPaymentRequired(request, options, error);

  return new Response(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "PAYMENT-REQUIRED": toBase64Json(paymentRequired),
      Vary: "PAYMENT-SIGNATURE",
    },
  });
}

/**
 * Gate a resource with the x402 v2 request/response shape.
 *
 * This foundation layer deliberately only checks that the client supplied a
 * payment signature. A production deployment can add facilitator verification
 * before invoking the handler; accepting an arbitrary signature is not
 * presented as settlement evidence.
 */
export function withX402(
  handler: X402Handler,
  options: X402Options,
): X402Handler {
  // Validate static configuration when the middleware is created, rather than
  // returning a malformed 402 response at request time.
  normalizedOptions(options);

  return async (request: Request): Promise<Response> => {
    const paymentSignature = request.headers.get("PAYMENT-SIGNATURE");
    if (!paymentSignature || paymentSignature.trim().length === 0) {
      return paymentRequiredResponse(request, options);
    }

    return handler(request);
  };
}
