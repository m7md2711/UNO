/**
 * Server-side in-memory auth store.
 * Passwords are stored as HMAC-SHA256 (salted).
 * Survives Next.js hot reloads via global variables.
 */

import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoredUser {
  id: string;
  username: string;        // lowercased, unique
  displayName: string;     // original casing
  passwordHash: string;
  salt: string;
  createdAt: number;
}

export interface UserSession {
  token: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: number;
}

export type PublicUser = Omit<StoredUser, 'passwordHash' | 'salt'>;

// ─── Singleton stores ─────────────────────────────────────────────────────────

declare global {
  var __unoUsers:    Map<string, StoredUser>   | undefined; // keyed by username
  var __unoSessions: Map<string, UserSession>  | undefined; // keyed by token
}

const users: Map<string, StoredUser>  = global.__unoUsers    ?? (global.__unoUsers    = new Map());
const sessions: Map<string, UserSession> = global.__unoSessions ?? (global.__unoSessions = new Map());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(password: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

function generateId(): string { return crypto.randomBytes(12).toString('hex'); }
function generateToken(): string { return crypto.randomBytes(32).toString('hex'); }

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Public API ───────────────────────────────────────────────────────────────

export function register(
  username: string,
  password: string,
): { user: PublicUser; token: string } | { error: string } {
  const normalized = username.trim().toLowerCase();
  const display    = username.trim();

  if (normalized.length < 2)  return { error: 'Username must be at least 2 characters' };
  if (normalized.length > 20) return { error: 'Username must be 20 characters or fewer' };
  if (!/^[a-z0-9_]+$/.test(normalized)) return { error: 'Username may only contain letters, numbers, underscores' };
  if (password.length < 4)    return { error: 'Password must be at least 4 characters' };
  if (users.has(normalized))  return { error: 'Username is already taken' };

  const salt         = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const id           = generateId();
  const now          = Date.now();

  const user: StoredUser = { id, username: normalized, displayName: display, passwordHash, salt, createdAt: now };
  users.set(normalized, user);

  const token   = generateToken();
  const session: UserSession = { token, userId: id, username: normalized, displayName: display, expiresAt: now + SESSION_TTL_MS };
  sessions.set(token, session);

  return { user: { id, username: normalized, displayName: display, createdAt: now }, token };
}

export function login(
  username: string,
  password: string,
): { user: PublicUser; token: string } | { error: string } {
  const normalized = username.trim().toLowerCase();
  const user       = users.get(normalized);
  if (!user) return { error: 'Username not found' };

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return { error: 'Incorrect password' };

  const token   = generateToken();
  const session: UserSession = { token, userId: user.id, username: user.username, displayName: user.displayName, expiresAt: Date.now() + SESSION_TTL_MS };
  sessions.set(token, session);

  return { user: { id: user.id, username: user.username, displayName: user.displayName, createdAt: user.createdAt }, token };
}

export function getSession(token: string): UserSession | null {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) { sessions.delete(token); return null; }
  return s;
}

export function logout(token: string): void {
  sessions.delete(token);
}

export function clearAllSessions(): void {
  sessions.clear();
}

export function getUserCount(): number { return users.size; }
export function getSessionCount(): number { return sessions.size; }
