import config from '../config/config.js';

const loginFailures = new Map();
const refreshFailures = new Map();

function getLoginKey(req) {
  const email = (req.body?.email || '').toLowerCase().trim();
  return `${req.ip}:${email || 'anon'}`;
}

function getRefreshKey(req) {
  return `${req.ip}:refresh`;
}

function isLocked(entry, now) {
  return entry.lockedUntil && now < entry.lockedUntil;
}

function decayOrInit(map, key, now) {
  let entry = map.get(key);
  if (!entry) {
    entry = { count: 0, firstFailureAt: now, lockedUntil: 0 };
    map.set(key, entry);
  }
  if (now - entry.firstFailureAt > config.security.bruteforce.windowMs) {
    entry.count = 0;
    entry.firstFailureAt = now;
    entry.lockedUntil = 0;
  }
  return entry;
}

export function loginBruteforceGuard(req, res, next) {
  const key = getLoginKey(req);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry) return next();
  if (now - entry.firstFailureAt > config.security.bruteforce.windowMs) {
    loginFailures.delete(key);
    return next();
  }
  if (isLocked(entry, now)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }
  next();
}

export function refreshBruteforceGuard(req, res, next) {
  const key = getRefreshKey(req);
  const now = Date.now();
  const entry = refreshFailures.get(key);
  if (!entry) return next();
  if (now - entry.firstFailureAt > config.security.bruteforce.windowMs) {
    refreshFailures.delete(key);
    return next();
  }
  if (isLocked(entry, now)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }
  next();
}

export function recordLoginFailure(req) {
  const key = getLoginKey(req);
  const now = Date.now();
  const entry = decayOrInit(loginFailures, key, now);
  entry.count += 1;
  if (entry.count >= config.security.bruteforce.maxFailures) {
    entry.lockedUntil = now + config.security.bruteforce.lockoutMs;
  }
}

export function recordLoginSuccess(req) {
  const key = getLoginKey(req);
  loginFailures.delete(key);
}

export function recordRefreshFailure(req) {
  const key = getRefreshKey(req);
  const now = Date.now();
  const entry = decayOrInit(refreshFailures, key, now);
  entry.count += 1;
  if (entry.count >= config.security.bruteforce.maxFailures) {
    entry.lockedUntil = now + config.security.bruteforce.lockoutMs;
  }
}

export function recordRefreshSuccess(req) {
  const key = getRefreshKey(req);
  refreshFailures.delete(key);
}


