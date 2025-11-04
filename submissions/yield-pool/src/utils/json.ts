function normaliseJsonValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normaliseJsonValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      normaliseJsonValue(entryValue),
    ])
  );
}

export function normaliseJson<T>(value: T): T {
  return normaliseJsonValue(value) as T;
}
