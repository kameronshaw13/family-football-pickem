import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2:${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [method, iterationsText, salt, originalHash] = stored.split(":");
  if (method !== "pbkdf2" || !iterationsText || !salt || !originalHash) return false;
  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations)) return false;
  const hash = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(originalHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionToken() {
  return randomBytes(32).toString("hex");
}
