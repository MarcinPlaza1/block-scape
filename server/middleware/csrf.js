import crypto from 'crypto';
import config from '../config/config.js';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function issueCsrfToken(req, res, next) {
  try {
    const name = config.security.csrf.cookieName;
    const have = req.cookies?.[name];
    if (!have || typeof have !== 'string' || have.length < 32) {
      const token = generateToken();
      req.csrfToken = token;
      res.cookie(name, token, {
        httpOnly: false,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: config.security.csrf.cookieMaxAgeMs
      });
    } else {
      req.csrfToken = have;
    }
  } catch (e) {
    // Ignore errors and continue
  }
  next();
}

export function requireDoubleSubmitCsrf(req, res, next) {
  const name = config.security.csrf.cookieName;
  const header = config.security.csrf.headerName;
  const cookieToken = req.cookies?.[name];
  const headerToken = req.get(header);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  req.csrfVerified = true;
  next();
}


