import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { lmsStorage } from "./storage";

const scrypt = promisify(scryptCallback) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hashBuffer = Buffer.from(hashHex, "hex");
  const derivedKey = await scrypt(password, salt, 64);
  if (derivedKey.length !== hashBuffer.length) return false;
  return timingSafeEqual(derivedKey, hashBuffer);
}

export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export interface AuthedRequest extends Request {
  user?: User;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ error: "ログインが必要です" });
  }
  const user = await lmsStorage.getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "ログインが必要です" });
  }
  req.user = user;
  next();
}

export function requireRole(role: "admin" | "learner" | Array<"admin" | "learner">) {
  const allowed: string[] = Array.isArray(role) ? role : [role];
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "権限がありません" });
    }
    next();
  };
}
