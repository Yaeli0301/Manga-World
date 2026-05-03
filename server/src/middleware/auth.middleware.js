import jwt from "jsonwebtoken";
import { User } from "../models/User.model.js";

export function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set and at least 32 characters in production");
    }
    return "dev-only-insecure-secret-change-me-32chars!!";
  }
  return s;
}

/** Short-lived access JWT (prefer over legacy long TTL when using refresh rotation). */
export function signAccessToken(userId, extra = {}) {
  const exp =
    process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || (process.env.NODE_ENV === "production" ? "15m" : "7d");
  return jwt.sign({ sub: userId, typ: "access", ...extra }, getJwtSecret(), { expiresIn: exp });
}

/** Same as legacy `signToken` — callers use this for Bearer auth. Prefer `signAccessToken` naming in new code. */
export function signToken(userId, extra = {}) {
  return signAccessToken(userId, extra);
}

export async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.sub).select("roles email language").lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = {
      id: user._id.toString(),
      roles: user.roles,
      email: user.email,
      language: user.language || "en",
    };
    req.tokenPayload = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuthMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.sub).select("roles email language").lean();
    req.user = user
      ? {
          id: user._id.toString(),
          roles: user.roles,
          email: user.email,
          language: user.language || "en",
        }
      : null;
  } catch {
    req.user = null;
  }
  next();
}

/** GraphQL / tools: resolve user from `Authorization: Bearer …` without Express middleware. */
export async function verifyBearerUser(authorizationHeader) {
  const header = authorizationHeader || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.sub).select("roles email language").lean();
    if (!user) return null;
    return {
      id: user._id.toString(),
      roles: user.roles,
      email: user.email,
      language: user.language || "en",
    };
  } catch {
    return null;
  }
}
