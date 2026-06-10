/**
 * Prosty in-memory rate limiter (sliding window).
 * Bez zewnętrznych zależności — wystarczający dla single-instance deploy.
 *
 * Użycie:
 *   const limiter = createRateLimiter({ interval: 60_000, maxRequests: 30 })
 *   const { success } = limiter.check(key)
 */

type Entry = { timestamps: number[] }

export function createRateLimiter(opts: { interval: number; maxRequests: number }) {
  const store = new Map<string, Entry>()

  // Cleanup co 5 minut — usuwa wygasłe klucze
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < opts.interval)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }, 5 * 60_000).unref()

  return {
    check(key: string): { success: boolean; remaining: number } {
      const now = Date.now()
      let entry = store.get(key)

      if (!entry) {
        entry = { timestamps: [] }
        store.set(key, entry)
      }

      // Usuń timestamps poza oknem
      entry.timestamps = entry.timestamps.filter((t) => now - t < opts.interval)

      if (entry.timestamps.length >= opts.maxRequests) {
        return { success: false, remaining: 0 }
      }

      entry.timestamps.push(now)
      return { success: true, remaining: opts.maxRequests - entry.timestamps.length }
    },
  }
}

// Predefiniowane limitery
export const webhookLimiter = createRateLimiter({ interval: 60_000, maxRequests: 60 })
export const voiceLimiter = createRateLimiter({ interval: 60_000, maxRequests: 20 })
export const apiLimiter = createRateLimiter({ interval: 60_000, maxRequests: 100 })
// Brute-force na logowaniu: 10 prób / 15 min per email
export const loginLimiter = createRateLimiter({ interval: 15 * 60_000, maxRequests: 10 })
