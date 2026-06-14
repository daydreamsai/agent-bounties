export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number): bigint {
  if (amountIn <= 0n) throw new Error('amount_in must be positive');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('reserves must be positive');
  const feeDenom = 10_000n;
  const amountInWithFee = amountIn * BigInt(10_000 - feeBps);
  return (amountInWithFee * reserveOut) / (reserveIn * feeDenom + amountInWithFee);
}

export function spreadBps(highOutput: number, lowOutput: number): number {
  if (!Number.isFinite(highOutput) || !Number.isFinite(lowOutput) || lowOutput <= 0) return 0;
  return ((highOutput - lowOutput) / lowOutput) * 10_000;
}

export function round(value: number | null, digits = 6): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function parseUnits(value: string, decimals: number): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('amount_in must be a positive decimal string');
  const [whole, fraction = ''] = normalized.split('.');
  const padded = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + padded);
}

export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const raw = negative ? -value : value;
  if (decimals === 0) return `${negative ? '-' : ''}${raw.toString()}`;
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fraction ? `.${fraction}` : ''}`;
}
