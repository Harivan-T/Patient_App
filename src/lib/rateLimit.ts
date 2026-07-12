// Minimal in-memory sliding-window rate limiter.
//
// Per-process only: on multi-instance/serverless deployments each instance
// keeps its own counters, so real limits scale with instance count. Good
// enough as a brute-force/SMS-bombing brake for the current single-instance
// deployment; swap for a shared store (Redis/Postgres) if the app scales out.

const buckets = new Map<string, number[]>();

const MAX_BUCKETS = 10_000; // hard memory cap — reset everything if exceeded

/**
 * Returns true if the action identified by `key` is allowed, false if the
 * caller has exceeded `limit` calls within the past `windowMs`.
 * Allowed calls are recorded; rejected calls are not.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) buckets.clear();

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
