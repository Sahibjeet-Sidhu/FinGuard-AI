import type { Request } from 'express';
import type { AuthUser } from '../types';

/**
 * A single string query parameter, or undefined. Express also parses repeated
 * and bracketed parameters into arrays and objects; those are ignored.
 */
export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Page number and page size from the query string, falling back to defaults for junk input. */
export function pagination(query: Request['query'], defaultLimit: number, maxLimit: number) {
  const page = Math.max(1, parseInt(queryString(query.page) ?? '', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(queryString(query.limit) ?? '', 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** A positive integer ID from untrusted input, or null. */
export function toId(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The authenticated user. Only call from handlers mounted behind `authenticate`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new Error('currentUser() called on an unauthenticated request');
  return req.user;
}
