import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Role } from "./session-config";

/**
 * Local password store for the take-home.
 *
 * Production replacement: move this to Postgres, put `password_hash` behind
 * row-level security, and use a managed auth provider (Clerk / Auth.js /
 * Supabase Auth) so you never hand-roll credential storage in real life.
 *
 * Here we use Node's built-in `scrypt` (no npm dependency, constant-time
 * compare) and persist to a flat JSON file at `.data/users.json` — good
 * enough for a local demo, intentionally bad for production.
 */

export type StoredUser = {
  email: string;
  role: Role;
  salt: string; // hex
  hash: string; // hex
  createdAt: string;
};

// In production the app's working directory is typically read-only on
// serverless hosts (Vercel, Netlify, Lambda, etc.), so we write to the OS
// temp dir. In development we keep using .data/ in the repo so data
// persists across restarts.
const DATA_DIR =
  process.env.NODE_ENV === "development"
    ? path.join(process.cwd(), ".data")
    : path.join(tmpdir(), "fitzrovia-data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

const SCRYPT_KEYLEN = 64;

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readAll(): Promise<StoredUser[]> {
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as StoredUser[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(users: StoredUser[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function hashPassword(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, "hex");
  return scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

function verifyPasswordHash(
  password: string,
  saltHex: string,
  expectedHex: string,
): boolean {
  const candidate = Buffer.from(hashPassword(password, saltHex), "hex");
  const expected = Buffer.from(expectedHex, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Case-insensitive email normalization. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUser(email: string): Promise<StoredUser | null> {
  const norm = normalizeEmail(email);
  const users = await readAll();
  return users.find((u) => u.email === norm) ?? null;
}

export type CreateUserInput = {
  email: string;
  password: string;
  role?: Role;
};

export type CreateUserError =
  | "email_taken"
  | "invalid_email"
  | "weak_password";

export async function createUser(
  input: CreateUserInput,
): Promise<
  { ok: true; user: StoredUser } | { ok: false; error: CreateUserError }
> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" };
  }
  // 8+ char requirement is for user-facing signup only. Seed entries can be
  // shorter (e.g. the canonical "admin123" demo password) because they're
  // provided by the app, not by an attacker.
  if (typeof input.password !== "string" || input.password.length === 0) {
    return { ok: false, error: "weak_password" };
  }
  if (input.role === undefined && input.password.length < 8) {
    return { ok: false, error: "weak_password" };
  }

  const users = await readAll();
  if (users.some((u) => u.email === email)) {
    return { ok: false, error: "email_taken" };
  }

  // Role assignment: @fitzrovia.ca gets analyst; everyone else viewer.
  // Override allowed via input (used by the seed script).
  const role: Role =
    input.role ?? (email.endsWith("@fitzrovia.ca") ? "analyst" : "viewer");

  const salt = randomBytes(16).toString("hex");
  const hash = hashPassword(input.password, salt);

  const user: StoredUser = {
    email,
    role,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeAll(users);
  return { ok: true, user };
}

export async function verifyUser(
  email: string,
  password: string,
): Promise<StoredUser | null> {
  const user = await findUser(email);
  if (!user) return null;
  if (!verifyPasswordHash(password, user.salt, user.hash)) return null;
  return user;
}

/**
 * Demo seed: guarantees the canonical demo accounts exist with the
 * expected credentials. Called lazily from the login/signup routes.
 *
 * This is idempotent AND self-healing: if a demo account exists but its
 * stored hash doesn't verify against the canonical password (e.g. the
 * seed password was changed between runs), the stored entry is rewritten
 * so the documented credentials always work. Non-seed users are left
 * untouched.
 */
const SEED_USERS: Array<{ email: string; password: string; role: Role }> = [
  { email: "admin@fitzrovia.ca", password: "admin123", role: "admin" },
  {
    email: "analyst@fitzrovia.ca",
    password: "fitzrovia-analyst-2026",
    role: "analyst",
  },
  {
    email: "viewer@example.com",
    password: "viewer-demo-2026",
    role: "viewer",
  },
];

export async function ensureSeedUsers(): Promise<void> {
  const users = await readAll();
  let mutated = false;

  for (const seed of SEED_USERS) {
    const email = normalizeEmail(seed.email);
    const existingIdx = users.findIndex((u) => u.email === email);
    const salt = randomBytes(16).toString("hex");
    const hash = hashPassword(seed.password, salt);

    if (existingIdx === -1) {
      users.push({
        email,
        role: seed.role,
        salt,
        hash,
        createdAt: new Date().toISOString(),
      });
      mutated = true;
      continue;
    }

    // Already exists — only heal it if the password no longer matches.
    const existing = users[existingIdx];
    if (!verifyPasswordHash(seed.password, existing.salt, existing.hash)) {
      users[existingIdx] = {
        ...existing,
        role: seed.role,
        salt,
        hash,
      };
      mutated = true;
    }
  }

  if (mutated) await writeAll(users);
}
