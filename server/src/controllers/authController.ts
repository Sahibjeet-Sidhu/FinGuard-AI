import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import db from '../database/db';
import { logAction } from '../services/auditService';
import { JWT_ALGORITHM, jwtSecret } from '../middleware/auth';
import { currentUser } from '../utils/request';
import type { Role, UserRow } from '../types';

const ROLES: readonly Role[] = ['admin', 'analyst'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);
const normalizeEmail = (email: string) => email.trim().toLowerCase();

function register(req: Request, res: Response) {
  const { name, email, password, role } = (req.body || {}) as Record<string, unknown>;
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  if (role !== undefined && !isRole(role)) {
    return res.status(400).json({ error: 'Role must be "admin" or "analyst"' });
  }

  // Self-service registration only ever creates analysts. An admin account
  // can be created solely by a caller who is already an authenticated admin.
  const userRole: Role = role ?? 'analyst';
  if (userRole === 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only an administrator can create admin accounts' });
  }

  const normalizedEmail = normalizeEmail(email);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), normalizedEmail, password_hash, userRole);

  logAction({
    userId: req.user?.id, userName: req.user?.name,
    action: 'USER_REGISTERED', entityType: 'user', entityId: result.lastInsertRowid,
    newValue: { name: name.trim(), email: normalizedEmail, role: userRole },
  });

  return res.status(201).json({ message: 'User registered successfully' });
}

function login(req: Request, res: Response) {
  const { email, password } = (req.body || {}) as Record<string, unknown>;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || '8h') as SignOptions['expiresIn'];
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    jwtSecret(),
    { algorithm: JWT_ALGORITHM, expiresIn }
  );

  logAction({ userId: user.id, userName: user.name, action: 'USER_LOGIN', entityType: 'user', entityId: user.id });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

function getMe(req: Request, res: Response) {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(currentUser(req).id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(user);
}

export { register, login, getMe };
