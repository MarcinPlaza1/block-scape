import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import prisma from '../config/database.js';

/**
 * Middleware to verify JWT access token and attach user to request
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const payload = jwt.verify(token, config.auth.jwtAccessSecret);
    req.auth = { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        avatarUrl: true, 
        role: true, 
        createdAt: true, 
        updatedAt: true 
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Middleware to require specific role
 */
export function requireRole(required) {
  const allowed = Array.isArray(required) ? required : [required];
  return (req, res, next) => {
    if (!req.auth || !allowed.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * Optional auth middleware - attaches user if token is valid, but doesn't fail if not
 */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    
    if (!token) {
      return next();
    }
    
    const payload = jwt.verify(token, config.auth.jwtAccessSecret);
    req.auth = { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
    
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        avatarUrl: true, 
        role: true, 
        createdAt: true, 
        updatedAt: true 
      }
    });
    
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore errors for optional auth
  }
  
  next();
}
