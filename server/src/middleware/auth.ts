import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database/db';
import type { AuthUser, Role } from '../types';

const JWT_ALGORITHM = 'HS256' as const;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

/**
 * Resolves the request's bearer token to a current user record, or null.
 * The role is read from the database rather than trusted from the token, so a
 * deleted account or a changed role takes effect immediately instead of when
 * the token eventually expires.
 */
function resolveUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;

  try {
    const payload = jwt.verify(header.slice('Bearer '.length).trim(), jwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    });
    if (typeof payload === 'string' || typeof payload.id !== 'number') return null;

    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id) as AuthUser | undefined;
    return user ?? null;
  } catch {
    return null;
  }
}

const authenticate: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = resolveUser(req);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.user = user;
  next();
};

/** Attaches req.user when a valid token is present, but never rejects. */
const optionalAuthenticate: RequestHandler = (req, _res, next) => {
  req.user = resolveUser(req) ?? undefined;
  next();
};

function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export { authenticate, optionalAuthenticate, requireRole, jwtSecret, JWT_ALGORITHM };
