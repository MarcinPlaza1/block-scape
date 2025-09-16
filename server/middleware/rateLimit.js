import config from '../config/config.js';

function nowMs() {
  return Date.now();
}

function createInMemoryRateLimiter({ windowMs, max, keyGenerator, errorMessage }) {
  const hitsByKey = new Map();

  return function rateLimiter(req, res, next) {
    try {
      const key = keyGenerator(req);
      const currentTime = nowMs();

      let entry = hitsByKey.get(key);
      if (!entry) {
        entry = { count: 0, windowStart: currentTime };
        hitsByKey.set(key, entry);
      }

      // Reset window if expired
      if (currentTime - entry.windowStart >= windowMs) {
        entry.count = 0;
        entry.windowStart = currentTime;
      }

      entry.count += 1;

      if (entry.count > max) {
        res.status(429).json({ error: errorMessage || 'Too many requests' });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export const loginRateLimiter = createInMemoryRateLimiter({
  windowMs: config.security.rateLimit.login.windowMs,
  max: config.security.rateLimit.login.maxPerIp,
  keyGenerator: req => `${req.ip}:login`,
  errorMessage: 'Too many login attempts. Try again later.'
});

export const refreshRateLimiter = createInMemoryRateLimiter({
  windowMs: config.security.rateLimit.refresh.windowMs,
  max: config.security.rateLimit.refresh.maxPerIp,
  keyGenerator: req => `${req.ip}:refresh`,
  errorMessage: 'Too many refresh requests. Slow down.'
});


