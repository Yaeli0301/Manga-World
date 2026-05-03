import crypto from "crypto";
import { RefreshToken } from "../models/RefreshToken.model.js";
import { signAccessToken } from "../middleware/auth.middleware.js";

function hashRefresh(plain) {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

function refreshTtlMs() {
  const days = Number(process.env.REFRESH_TOKEN_DAYS) || 14;
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

/**
 * @param {string} userId
 * @param {string} [userAgent]
 * @returns {Promise<{ accessToken: string, refreshToken: string, refreshExpiresAt: Date }>}
 */
export async function issueTokenPair(userId, userAgent = "") {
  const accessToken = signAccessToken(userId);
  const plain = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashRefresh(plain);
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  await RefreshToken.create({ userId, tokenHash, expiresAt, userAgent: String(userAgent || "").slice(0, 512) });
  return { accessToken, refreshToken: plain, refreshExpiresAt: expiresAt };
}

/**
 * @param {string} plainRefresh
 * @returns {Promise<{ accessToken: string, userId: string } | null>}
 */
export async function refreshWithToken(plainRefresh) {
  if (!plainRefresh || typeof plainRefresh !== "string") return null;
  const tokenHash = hashRefresh(plainRefresh.trim());
  const row = await RefreshToken.findOne({ tokenHash });
  if (!row || row.expiresAt < new Date()) {
    if (row) await RefreshToken.deleteOne({ _id: row._id });
    return null;
  }
  const accessToken = signAccessToken(row.userId.toString());
  return { accessToken, userId: row.userId.toString() };
}

/**
 * @param {string} plainRefresh
 */
export async function revokeRefreshToken(plainRefresh) {
  if (!plainRefresh) return;
  const tokenHash = hashRefresh(plainRefresh.trim());
  await RefreshToken.deleteOne({ tokenHash });
}
