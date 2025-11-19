/**
 * Simple in-memory rate limiter for Edge Functions
 * For production, consider using Redis (Upstash) for distributed rate limiting
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  private getIdentifier(req: Request): string {
    // Try to get IP from various headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const cfConnectingIp = req.headers.get('cf-connecting-ip');

    const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0] || 'unknown';
    return ip.trim();
  }

  public check(req: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const identifier = this.getIdentifier(req);
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // New window
      const resetTime = now + this.config.windowMs;
      this.requests.set(identifier, { count: 1, resetTime });
      return { allowed: true, remaining: this.config.maxRequests - 1, resetTime };
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Increment count
    entry.count++;
    this.requests.set(identifier, entry);
    return { allowed: true, remaining: this.config.maxRequests - entry.count, resetTime: entry.resetTime };
  }

  public middleware(config?: Partial<RateLimitConfig>) {
    const limiter = config ? new RateLimiter({ ...this.config, ...config }) : this;

    return async (req: Request, handler: () => Promise<Response>): Promise<Response> => {
      const result = limiter.check(req);

      if (!result.allowed) {
        const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
        return new Response(
          JSON.stringify({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': this.config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': result.resetTime.toString(),
            },
          }
        );
      }

      const response = await handler();

      // Add rate limit headers to response
      const headers = new Headers(response.headers);
      headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
      headers.set('X-RateLimit-Remaining', result.remaining.toString());
      headers.set('X-RateLimit-Reset', result.resetTime.toString());

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
  }
}

// Export default rate limiters with different configurations
export const publicRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 requests per minute
});

export const authRateLimiter = new RateLimiter({
  windowMs: 900000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

export const strictRateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 5, // 5 requests per minute
});

export { RateLimiter };
