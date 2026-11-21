interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: (() => number) | undefined;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: RateLimiterOptions) {
  const attempts = new Map<string, number[]>();

  return {
    take(key: string) {
      const timestamp = now();
      const recent = (attempts.get(key) ?? []).filter(
        (time) => timestamp - time < windowMs,
      );
      if (recent.length >= limit) return false;

      attempts.set(key, [...recent, timestamp]);
      if (attempts.size > 5_000) {
        for (const [entry, times] of attempts) {
          if (times.every((time) => timestamp - time >= windowMs)) {
            attempts.delete(entry);
          }
        }
      }
      return true;
    },
  };
}
